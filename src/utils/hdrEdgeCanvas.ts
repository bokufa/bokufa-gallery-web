export interface HdrEdgeDot {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
}

interface HdrEdgeDevice {
  lost: Promise<unknown>;
  destroy(): void;
  queue: {
    submit(commands: unknown[]): void;
    writeBuffer(buffer: unknown, offset: number, data: ArrayBufferView): void;
  };
  createBuffer(options: Record<string, unknown>): { destroy(): void };
  createCommandEncoder(): {
    beginRenderPass(options: Record<string, unknown>): {
      setPipeline(pipeline: unknown): void;
      setVertexBuffer(slot: number, buffer: unknown): void;
      draw(count: number): void;
      end(): void;
    };
    finish(): unknown;
  };
  createRenderPipeline(options: Record<string, unknown>): unknown;
  createShaderModule(options: { code: string }): unknown;
}

interface HdrEdgeGpu {
  requestAdapter(): Promise<{
    requestDevice(): Promise<HdrEdgeDevice>;
  } | null>;
}

interface HdrEdgeContext {
  configure(options: Record<string, unknown>): void;
  unconfigure(): void;
  getConfiguration(): { toneMapping?: { mode?: string } } | null;
  getCurrentTexture(): { createView(): unknown };
}

const shader = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) color: vec4f,
}

@vertex fn vertex_main(
  @location(0) position: vec2f,
  @location(1) local: vec2f,
  @location(2) color: vec4f,
) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(position, 0.0, 1.0);
  output.local = local;
  output.color = color;
  return output;
}

@fragment fn fragment_main(input: VertexOutput) -> @location(0) vec4f {
  let radius = length(input.local);
  let coverage = 1.0 - smoothstep(0.72, 1.0, radius);
  let center = input.color.rgb;
  let middle = vec3f(4.0, 2.0596707, 0.0705678);
  let rim = vec3f(3.2278090, 0.8489230, 0.0160989);
  let center_to_middle = smoothstep(0.0, 0.55, radius);
  let middle_to_rim = smoothstep(0.55, 1.0, radius);
  let warm = mix(mix(center, middle, center_to_middle), rim, middle_to_rim);
  let alpha = input.color.a * coverage;
  return vec4f(warm * alpha, alpha);
}
`;

export function mountHdrEdgeCanvas(
  canvas: HTMLCanvasElement,
  onReady: (ready: boolean) => void,
  gpu = (navigator as Navigator & { gpu?: HdrEdgeGpu }).gpu,
) {
  let disposed = false;
  let device: HdrEdgeDevice | undefined;
  let context: HdrEdgeContext | null = null;
  let pipeline: unknown;
  let buffer: { destroy(): void } | undefined;
  let bufferBytes = 0;
  let vertexCount = 0;
  let dots: HdrEdgeDot[] = [];
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let progress = 0;
  let target = 0;
  let animationFrame = 0;
  let animationStart = 0;
  let animationFrom = 0;
  const usage = (
    globalThis as typeof globalThis & {
      GPUBufferUsage?: { VERTEX: number; COPY_DST: number };
    }
  ).GPUBufferUsage;

  const release = () => {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    buffer?.destroy();
    context?.unconfigure();
    device?.destroy();
    buffer = undefined;
    context = null;
    device = undefined;
  };
  const draw = () => {
    if (!device || !context || !pipeline) return;
    const canvasWidth = Math.max(1, Math.round(width * pixelRatio));
    const canvasHeight = Math.max(1, Math.round(height * pixelRatio));

    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;
    const values: number[] = [];
    // Match the original gain-map label's #ffcd36 → #ffbe24 → #e87f0d
    // radial ink in extended linear sRGB. Keeping the target color stable and
    // animating only alpha prevents hue shifts during the light-up transition.
    const warm = [4, 2.4419823, 0.1475578, progress];
    const corners = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];

    for (const dot of dots) {
      for (const [localX, localY] of corners) {
        const x = (dot.x + localX * dot.radiusX) * pixelRatio;
        const y = (dot.y + localY * dot.radiusY) * pixelRatio;

        values.push(
          (x / canvasWidth) * 2 - 1,
          1 - (y / canvasHeight) * 2,
          localX,
          localY,
          ...warm,
        );
      }
    }
    const vertices = new Float32Array(values);

    vertexCount = vertices.length / 8;
    if (vertices.byteLength > bufferBytes) {
      buffer?.destroy();
      bufferBytes = Math.max(
        256,
        2 ** Math.ceil(Math.log2(vertices.byteLength)),
      );
      buffer = device.createBuffer({
        size: bufferBytes,
        usage: (usage?.VERTEX ?? 32) | (usage?.COPY_DST ?? 8),
      });
    }
    if (vertices.byteLength && buffer)
      device.queue.writeBuffer(buffer, 0, vertices);
    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });

    pass.setPipeline(pipeline);
    if (buffer && vertexCount) {
      pass.setVertexBuffer(0, buffer);
      pass.draw(vertexCount);
    }
    pass.end();
    device.queue.submit([encoder.finish()]);
  };
  const animate = (time: number) => {
    animationFrame = 0;
    const elapsed = Math.min(1, (time - animationStart) / 600);
    const eased = elapsed * elapsed * (3 - 2 * elapsed);

    progress = animationFrom + (target - animationFrom) * eased;
    draw();
    if (elapsed < 1) animationFrame = requestAnimationFrame(animate);
  };
  const setEnabled = (enabled: boolean) => {
    target = enabled ? 1 : 0;
    animationFrom = progress;
    animationStart = performance.now();
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(animate);
  };
  const updateScene = (
    nextWidth: number,
    nextHeight: number,
    nextPixelRatio: number,
    nextDots: HdrEdgeDot[],
  ) => {
    width = nextWidth;
    height = nextHeight;
    pixelRatio = Math.max(1, nextPixelRatio);
    dots = nextDots;
    draw();
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
    context = canvas.getContext("webgpu") as unknown as HdrEdgeContext | null;
    if (!context) {
      release();

      return;
    }
    context.configure({
      device,
      format: "rgba16float",
      colorSpace: "srgb",
      alphaMode: "premultiplied",
      toneMapping: { mode: "extended" },
    });
    if (context.getConfiguration()?.toneMapping?.mode !== "extended") {
      release();

      return;
    }
    const module = device.createShaderModule({ code: shader });

    pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module,
        entryPoint: "vertex_main",
        buffers: [
          {
            arrayStride: 32,
            attributes: [
              { shaderLocation: 0, offset: 0, format: "float32x2" },
              { shaderLocation: 1, offset: 8, format: "float32x2" },
              { shaderLocation: 2, offset: 16, format: "float32x4" },
            ],
          },
        ],
      },
      fragment: {
        module,
        entryPoint: "fragment_main",
        targets: [
          {
            format: "rgba16float",
            blend: {
              color: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
                operation: "add",
              },
            },
          },
        ],
      },
      primitive: { topology: "triangle-list" },
    });
    draw();
    onReady(true);
    void device.lost.then(() => {
      if (!disposed) onReady(false);
    });
  })().catch(() => {
    release();
    if (!disposed) onReady(false);
  });

  return {
    setEnabled,
    updateScene,
    destroy() {
      disposed = true;
      release();
    },
  };
}
