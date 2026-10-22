import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/utils/hdrEdgeCanvas.ts", import.meta.url),
  "utf8",
);
const code = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const { mountHdrEdgeCanvas } = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  const calls = {
    buffers: [],
    destroyed: 0,
    draws: [],
    passes: [],
    submissions: [],
    writes: [],
  };
  const pass = {
    setPipeline() {},
    setVertexBuffer() {},
    draw(count) { calls.draws.push(count); },
    end() {},
  };
  const device = {
    lost: new Promise(() => {}),
    destroy() { calls.destroyed++; },
    queue: {
      submit(commands) { calls.submissions.push(commands); },
      writeBuffer(_buffer, _offset, data) { calls.writes.push([...data]); },
    },
    createBuffer(options) {
      const buffer = { options, destroy() {} };
      calls.buffers.push(buffer);
      return buffer;
    },
    createCommandEncoder: () => ({
      beginRenderPass(options) { calls.passes.push(options); return pass; },
      finish: () => "edge-frame",
    }),
    createRenderPipeline: options => ({ options }),
    createShaderModule: options => ({ options }),
  };
  const context = {
    configure(options) { calls.config = options; },
    getConfiguration: () => ({ toneMapping: { mode: "extended" } }),
    getCurrentTexture: () => ({ createView: () => "edge-view" }),
    unconfigure() {},
  };
  const canvas = { width: 1, height: 1, getContext: () => context };
  const gpu = {
    requestAdapter: async () => ({ requestDevice: async () => device }),
  };

  return { calls, canvas, gpu };
}

test("edge dots use one persistent extended HDR canvas and redraw without restarting the light-up animation", async t => {
  const frames = new Map();
  let id = 0;
  const saved = {
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    GPUBufferUsage: globalThis.GPUBufferUsage,
    requestAnimationFrame: globalThis.requestAnimationFrame,
  };

  globalThis.GPUBufferUsage = { VERTEX: 32, COPY_DST: 8 };
  globalThis.requestAnimationFrame = callback => {
    frames.set(++id, callback);
    return id;
  };
  globalThis.cancelAnimationFrame = frame => frames.delete(frame);
  t.after(() => Object.assign(globalThis, saved));
  const { calls, canvas, gpu } = fixture();
  const ready = [];
  const renderer = mountHdrEdgeCanvas(canvas, value => ready.push(value), gpu);

  await tick();
  assert.deepEqual(ready, [true]);
  assert.equal(calls.config.format, "rgba16float");
  assert.equal(calls.config.alphaMode, "premultiplied");
  assert.equal(calls.config.toneMapping.mode, "extended");
  renderer.updateScene(100, 80, 2, [
    { x: 20, y: 30, radiusX: 2, radiusY: 2 },
  ]);
  assert.equal(canvas.width, 200);
  assert.equal(canvas.height, 160);
  renderer.setEnabled(true);
  const animate = [...frames.values()][0];
  frames.clear();
  animate(performance.now() + 600);
  assert.equal(calls.draws.at(-1), 6);
  assert(calls.writes.at(-1).some(value => value > 1), "HDR ink contains extended-range color values");
  assert.equal(calls.writes.at(-1)[4], 4, "HDR ink restores the original golden center red");
  assert(Math.abs(calls.writes.at(-1)[5] - 2.4419823) < 0.0001, "HDR ink restores the original golden center green");
  assert(Math.abs(calls.writes.at(-1)[6] - 0.1475578) < 0.0001, "HDR ink restores the original golden center blue");
  frames.clear();
  renderer.updateScene(100, 80, 2, [
    { x: 24, y: 30, radiusX: 2, radiusY: 2 },
  ]);
  assert.equal(frames.size, 0, "panning redraws the persistent surface without replaying its transition");
  renderer.destroy();
  assert.equal(calls.destroyed, 1);
});
