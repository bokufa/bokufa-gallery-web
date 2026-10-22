// A tiny, static HDR surface: no image re-encoding and no animation/render loop.
// https://developer.chrome.com/blog/new-in-webgpu-129#hdr_support_with_canvas_tone_mapping_mode
interface HdrDevice {
  lost: Promise<unknown>;
  destroy(): void;
  queue: { submit(commands: unknown[]): void };
  createCommandEncoder(): {
    beginRenderPass(options: Record<string, unknown>): { end(): void };
    finish(): unknown;
  };
}
interface HdrGpu {
  requestAdapter(): Promise<{ requestDevice(): Promise<HdrDevice> } | null>;
}
interface HdrCanvasContext {
  configure(options: Record<string, unknown>): void;
  unconfigure(): void;
  getConfiguration(): { toneMapping?: { mode?: string } } | null;
  getCurrentTexture(): { createView(): unknown };
}

export function mountHdrLight(
  canvas: HTMLCanvasElement,
  onReady: (ready: boolean) => void,
  gpu = (navigator as Navigator & { gpu?: HdrGpu }).gpu,
) {
  let disposed = false;
  let device: HdrDevice | undefined;
  let context: HdrCanvasContext | null = null;
  const release = () => {
    context?.unconfigure();
    device?.destroy();
    context = null;
    device = undefined;
  };

  void (async () => {
    if (!gpu) return;
    const adapter = await gpu.requestAdapter();

    if (disposed || !adapter) return;
    const requestedDevice = await adapter.requestDevice();

    if (disposed) {
      requestedDevice.destroy();

      return;
    }
    device = requestedDevice;
    context = canvas.getContext("webgpu") as unknown as HdrCanvasContext | null;
    if (!context) {
      release();

      return;
    }
    context.configure({
      device,
      format: "rgba16float",
      colorSpace: "srgb",
      alphaMode: "opaque",
      toneMapping: { mode: "extended" },
    });
    if (context.getConfiguration()?.toneMapping?.mode !== "extended") {
      release();

      return;
    }
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 1.3, g: 1.3, b: 1.3, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.end();
    device.queue.submit([encoder.finish()]);
    onReady(true);
    void device.lost.then(() => {
      if (!disposed) onReady(false);
    });
  })().catch(() => {
    release();
    if (!disposed) onReady(false);
  });

  return () => {
    disposed = true;
    release();
  };
}
