import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const code = ts.transpileModule(await readFile(new URL('../src/utils/hdrLight.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { mountHdrLight } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(mode = 'extended') {
  const calls = { destroyed: 0, unconfigured: 0, passes: [], submissions: [] };
  const device = {
    lost: new Promise(() => {}),
    destroy() { calls.destroyed++; },
    queue: { submit(commands) { calls.submissions.push(commands); } },
    createCommandEncoder: () => ({
      beginRenderPass(options) { calls.passes.push(options); return { end() {} }; },
      finish: () => 'static-white-panel',
    }),
  };
  const context = {
    configure(options) { calls.config = options; },
    getConfiguration: () => ({ toneMapping: { mode } }),
    getCurrentTexture: () => ({ createView: () => 'hdr-view' }),
    unconfigure() { calls.unconfigured++; },
  };
  return { calls, device, canvas: { getContext: () => context }, gpu: { requestAdapter: async () => ({ requestDevice: async () => device }) } };
}

test('LED panel uses an extended float surface above SDR white and releases it on disposal', async () => {
  const { calls, canvas, gpu } = fixture();
  const states = [];
  const stop = mountHdrLight(canvas, ready => states.push(ready), gpu);
  await tick();
  assert.equal(calls.config.format, 'rgba16float');
  assert.equal(calls.config.toneMapping.mode, 'extended');
  assert(calls.passes[0].colorAttachments[0].clearValue.r > 1);
  assert.equal(calls.passes[0].colorAttachments[0].clearValue.r, 1.1, 'comfortable HDR white is lower than the previous 1.3');
  assert.deepEqual(calls.passes[0].colorAttachments[0].clearValue, { r: 1.1, g: 1.1, b: 1.1, a: 1 });
  assert.equal(calls.submissions.length, 1, 'static panel has no continuous rendering loop');
  assert.deepEqual(states, [true]);
  stop();
  assert.equal(calls.destroyed, 1);
  assert.equal(calls.unconfigured, 1);
});

test('unavailable or SDR-only WebGPU leaves the ordinary white background intact', async () => {
  const unavailable = [];
  mountHdrLight({}, value => unavailable.push(value), null)();
  assert.deepEqual(unavailable, []);
  const { calls, canvas, gpu } = fixture('standard');
  const states = [];
  const stop = mountHdrLight(canvas, value => states.push(value), gpu);
  await tick();
  assert.deepEqual(states, []);
  assert.equal(calls.submissions.length, 0);
  assert.equal(calls.destroyed, 1);
  stop();
  assert.equal(calls.destroyed, 1);
});

test('quickly disabling HDR while the adapter/device is pending cannot light the old canvas', async () => {
  const { calls, device, canvas } = fixture();
  let resolveDevice;
  const gpu = { requestAdapter: async () => ({ requestDevice: () => new Promise(resolve => { resolveDevice = resolve; }) }) };
  const states = [];
  const stop = mountHdrLight(canvas, value => states.push(value), gpu);
  await tick();
  stop();
  resolveDevice(device);
  await tick();
  assert.deepEqual(states, []);
  assert.equal(calls.destroyed, 1);
  assert.equal(calls.submissions.length, 0);
});
