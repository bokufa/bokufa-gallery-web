import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function compile(filename, replacements = {}) {
  let code = ts.transpileModule(await readFile(new URL(filename, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) code = code.replaceAll(JSON.stringify(from), JSON.stringify(to));
  return dataUrl(code);
}
const sourcesUrl = await compile('../src/utils/photoSources.ts');
const { sdrPhotoFile, preferredPhotoFile, preloadPhotoSource, decodePhotoElement } = await import(sourcesUrl);
const photo = (id = 1) => ({
  id,
  thumb_file: { url: `thumb-${id}`, width: 100, height: 100 },
  medium_file: { url: `medium-${id}`, width: 500, height: 500 },
  large_file: { url: `large-${id}`, width: 1000, height: 1000 },
  hdr_file: { url: `hdr-${id}`, width: 8000, height: 8000 },
});

test('HDR is opt-in; missing and empty fields always fall back to valid SDR', () => {
  const item = photo();
  assert.equal(preferredPhotoFile(item, true), item.hdr_file);
  assert.equal(preferredPhotoFile(item, false), item.large_file);
  for (const hdr_file of [undefined, {}, { url: '' }, { url: '  ' }])
    assert.equal(preferredPhotoFile({ ...item, hdr_file }, true), item.large_file);
  assert.equal(sdrPhotoFile({ ...item, large_file: { url: '' } }), item.medium_file);
  assert.equal(sdrPhotoFile({ ...item, large_file: undefined, medium_file: undefined }), item.thumb_file);
});

function mockImages(t) {
  const OriginalImage = globalThis.Image;
  const requests = [];
  globalThis.Image = class {
    decode() { return new Promise((resolve, reject) => requests.push({ image: this, resolve, reject })); }
  };
  t.after(() => { globalThis.Image = OriginalImage; });
  return requests;
}

test('native decode requests are shared and failed loads can be retried without re-encoding', async t => {
  const requests = mockImages(t);
  const first = preloadPhotoSource('raw-hdr-test.jpg');
  assert.equal(preloadPhotoSource('raw-hdr-test.jpg'), first);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].image.src, 'raw-hdr-test.jpg');
  requests[0].reject(new Error('offline'));
  await assert.rejects(first);
  const retry = preloadPhotoSource('raw-hdr-test.jpg');
  assert.notEqual(retry, first);
  requests[1].resolve();
  await retry;
  assert.equal(preloadPhotoSource('raw-hdr-test.jpg'), retry);
});

const reactUrl = dataUrl(`
export const memo = component => component;
export const useState = value => globalThis.__hdrHarness.useState(value);
export const useEffect = (effect, deps) => globalThis.__hdrHarness.useEffect(effect, deps);
export const useRef = initial => globalThis.__hdrHarness.useRef(initial);
export const createElement = (type, props) => ({type, props, key: props.key});
`);
const hookUrl = await compile('../src/hooks/usePhotoSource.ts', { react: reactUrl, '../utils/photoSources': sourcesUrl });
const { default: usePhotoSource } = await import(hookUrl);
function harness(t, component = usePhotoSource) {
  const slots = [];
  let index = 0;
  let effects = [];
  globalThis.__hdrHarness = {
    useRef(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: { current: initial } };
      return slots[i].value;
    },
    useState(initial) {
      const i = index++;
      if (!slots[i]) slots[i] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, next => { slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; }];
    },
    useEffect(effect, deps) {
      const i = index++;
      const previous = slots[i];
      if (previous && deps.every((value, n) => Object.is(value, previous.deps[n]))) return;
      previous?.cleanup?.();
      slots[i] = { deps };
      effects.push(() => { slots[i].cleanup = effect(); });
    },
  };
  t.after(() => { for (const slot of slots) slot?.cleanup?.(); delete globalThis.__hdrHarness; });
  return (...args) => {
    index = 0;
    const result = component(...args);
    const pending = effects;
    effects = [];
    pending.forEach(effect => effect());
    return result;
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('switching HDR on preserves SDR until decode; opt-out and stale photo loads cannot win races', async t => {
  const requests = mockImages(t);
  const render = harness(t);
  const first = photo(21);
  const second = photo(22);
  assert.equal(render(first, true).image.url, first.large_file.url);
  assert.equal(render(first, true).loading, true);
  assert.equal(render(first, false).isHdr, false);
  assert.equal(render(second, true).image.url, second.large_file.url);
  requests[0].resolve();
  await tick();
  assert.equal(render(second, true).image.url, second.large_file.url);
  requests[1].resolve();
  await tick();
  assert.equal(render(second, true).image.url, second.hdr_file.url);
  assert.equal(render(second, true).isHdr, true);
  assert.equal(render(second, false).image.url, second.large_file.url);
});

test('an HDR error leaves SDR visible and clears the loading state', async t => {
  const requests = mockImages(t);
  const render = harness(t);
  const item = photo(23);
  render(item, true);
  requests[0].reject(new Error('invalid JPEG'));
  await tick();
  const result = render(item, true);
  assert.equal(result.image.url, item.large_file.url);
  assert.equal(result.loading, false);
  assert.equal(result.error, true);
});

test('HDR decode is serial and foreground details take priority over queued table images', async t => {
  const requests = mockImages(t);
  const active = preloadPhotoSource('queue-active', 0);
  const background = preloadPhotoSource('queue-background', 0);
  const detail = preloadPhotoSource('queue-detail', 2);
  assert.equal(requests.length, 1);
  requests[0].resolve();
  await active;
  await tick();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].image.src, 'queue-detail');
  requests[1].resolve();
  await detail;
  await tick();
  assert.equal(requests[2].image.src, 'queue-background');
  requests[2].resolve();
  await background;
  await tick();
});

const jsxUrl = dataUrl('export const jsx = (type, props, key) => ({type, props, key}); export { jsx as jsxs };');
const contextUrl = dataUrl('export const useHdr = () => globalThis.__hdrTable;');
const { default: HdrToggle } = await import(await compile('../src/components/HdrToggle.tsx', {
  'react/jsx-runtime': jsxUrl, '../contexts/HdrContext': contextUrl,
  '../contexts/LanguageContext': dataUrl('export const useLanguage = () => ({ t: key => key });'),
}));
test('controlled single-photo toggle cannot write the background table preference', t => {
  let local = 0;
  let table = 0;
  globalThis.__hdrTable = { enabled: false, toggle: () => table++ };
  t.after(() => delete globalThis.__hdrTable);
  HdrToggle({ enabled: false, onToggle: () => local++ }).props.onClick();
  assert.equal(local, 1);
  assert.equal(table, 0);
  HdrToggle().props.onClick();
  assert.equal(table, 1);
});

const { default: BufferedPhotoImage } = await import(await compile('../src/components/BufferedPhotoImage.tsx', {
  react: reactUrl, 'react/jsx-runtime': jsxUrl, '../utils/photoSources': sourcesUrl,
}));
function bufferedFixture(t) {
  const render = harness(t, BufferedPhotoImage);
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  const frames = new Map();
  let frameId = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  t.after(() => { globalThis.requestAnimationFrame = previousRaf; globalThis.cancelAnimationFrame = previousCancel; });
  const paint = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  const nodes = new Map();
  let tree;
  let props = { src: 'sdr-dom', hdrSrc: 'hdr-dom' };
  const commit = tree => {
    for (const [key, node] of nodes) {
      if (!tree.props.children.some(child => child.key === key)) {
        node.ref(null);
        nodes.delete(key);
      }
    }
    for (const child of tree.props.children) {
      if (!nodes.has(child.key)) {
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        nodes.set(child.key, { decode: () => promise, resolve });
      }
      nodes.get(child.key).ref = child.props.ref;
      child.props.ref(nodes.get(child.key));
    }
  };
  const draw = (src = props.src, extra = {}) => {
    props = { ...props, ...extra, src };
    // Flush the synchronous effect state changes just as React does.
    for (let i = 0; i < 3; i++) { tree = render(props); commit(tree); }
    return tree;
  };
  const layer = url => tree.props.children.find(layer => layer.key === url);
  const load = async url => {
    layer(url).props.onLoad({ currentTarget: nodes.get(url) });
    nodes.get(url).resolve();
    await tick();
    draw();
  };
  const end = url => layer(url).props.onTransitionEnd({ target: nodes.get(url), currentTarget: nodes.get(url), propertyName: 'opacity' });
  draw();
  return { draw, load, paint, layer, end };
}

test('DOM layers fade only after decode and two paints, keeping the old image for the full transition', async t => {
  const f = bufferedFixture(t);
  await f.load('sdr-dom');
  let tree = f.draw('hdr-dom');
  assert.equal(tree.props.children.length, 2);
  assert.equal(f.layer('sdr-dom').props.style.opacity, 1);
  assert.equal(f.layer('hdr-dom').props.style.opacity, 0);
  await f.load('hdr-dom');
  assert.equal(f.layer('hdr-dom').props.style.opacity, 0);
  f.paint(); f.draw();
  assert.equal(f.layer('hdr-dom').props.style.opacity, 0);
  f.paint(); tree = f.draw();
  assert.equal(f.layer('hdr-dom').props.style.opacity, 1);
  assert.equal(f.layer('sdr-dom').props.style.opacity, 1, 'old image is never faded to transparent');
  assert.equal(tree.props.children.length, 2, 'two paint frames start, rather than finish, the dissolve');
  f.end('hdr-dom'); tree = f.draw();
  assert.deepEqual(tree.props.children.map(layer => layer.key), ['hdr-dom']);

  // Cached reverse and repeated forward switches must still paint a zero layer.
  for (const target of ['sdr-dom', 'hdr-dom', 'sdr-dom']) {
    const base = target === 'sdr-dom' ? 'hdr-dom' : 'sdr-dom';
    f.draw(target);
    assert.equal(f.layer(base).props.style.opacity, 1);
    await f.load(target);
    assert.equal(f.layer(target).props.style.opacity, 0);
    f.paint(); f.draw(); f.paint(); tree = f.draw();
    assert.equal(tree.props.children.length, 2);
    assert.equal(f.layer(target).props.style.opacity, 1);
    f.end(target); tree = f.draw();
    assert.deepEqual(tree.props.children.map(layer => layer.key), [target]);
  }
});

test('rapid HDR reversal finishes the visible fade then dissolves back without discarding either opaque base', async t => {
  const f = bufferedFixture(t);
  await f.load('sdr-dom');
  f.draw('hdr-dom'); await f.load('hdr-dom');
  f.paint(); f.draw(); f.paint(); f.draw();
  f.draw('sdr-dom');
  assert.equal(f.layer('sdr-dom').props.style.opacity, 1);
  assert.equal(f.layer('hdr-dom').props.style.opacity, 1, 'a reverse click never tears down a running transition');
  f.end('hdr-dom'); f.draw();
  assert.equal(f.layer('sdr-dom').props.style.opacity, 0);
  assert.equal(f.layer('hdr-dom').props.style.opacity, 1);
  f.paint(); f.draw(); f.paint(); f.draw();
  f.end('sdr-dom');
  assert.deepEqual(f.draw().props.children.map(layer => layer.key), ['sdr-dom']);
});

test('failed or stale replacement decodes cannot hide the visible base', async t => {
  const f = bufferedFixture(t);
  await f.load('sdr-dom');
  f.draw('hdr-dom');
  assert.equal(f.layer('hdr-dom').props.style.opacity, 0, 'unresolved or failed loads stay transparent');
  const loading = f.load('hdr-dom');
  f.draw('sdr-dom');
  await loading;
  f.paint(); f.draw(); f.paint();
  assert.equal(f.layer('sdr-dom').props.style.opacity, 1);
  assert.equal(f.layer('hdr-dom'), undefined, 'an old request cannot activate after opt-out');
});

test('leaving the viewport aborts a running dissolve and immediately releases the old HDR DOM layer', async t => {
  const f = bufferedFixture(t);
  await f.load('sdr-dom');
  f.draw('hdr-dom'); await f.load('hdr-dom');
  f.paint(); f.draw(); f.paint(); f.draw();
  const tree = f.draw('sdr-dom', { suspend: true });
  assert.deepEqual(tree.props.children.map(layer => layer.key), ['sdr-dom']);
  assert.equal(f.layer('sdr-dom').props.style.opacity, 1);
  f.paint(); f.draw();
  assert.equal(f.layer('hdr-dom'), undefined);
});

const { default: HdrLightPanel } = await import(await compile('../src/components/HdrLightPanel.tsx', {
  react: reactUrl, 'react/jsx-runtime': jsxUrl, '../contexts/HdrContext': contextUrl,
  '../utils/hdrLight': dataUrl('export const mountHdrLight = (...args) => globalThis.__mountLight(...args);'),
}));
test('LED opt-out retains the rendered surface for its fade; toggling back does not recreate the GPU device', t => {
  let mounts = 0;
  let stops = 0;
  let ready;
  globalThis.__hdrTable = { enabled: false };
  globalThis.__mountLight = (_canvas, onReady) => { mounts++; ready = onReady; return () => stops++; };
  t.after(() => { delete globalThis.__hdrTable; delete globalThis.__mountLight; });
  const render = harness(t, HdrLightPanel);
  let tree = render();
  tree.props.ref.current = {};
  assert.equal(mounts, 0, 'SDR-only visits never allocate a GPU light');
  globalThis.__hdrTable.enabled = true;
  render(); render();
  assert.equal(mounts, 1);
  ready(true); tree = render();
  assert.equal(tree.props['data-ready'], true);
  globalThis.__hdrTable.enabled = false;
  tree = render();
  assert.equal(tree.props['data-ready'], false);
  assert.equal(stops, 0, 'opt-out must not clear the canvas during its closing fade');
  globalThis.__hdrTable.enabled = true;
  tree = render();
  assert.equal(tree.props['data-ready'], true);
  assert.equal(mounts, 1);
  assert.equal(stops, 0);
});

const { default: FilmEdgeMark } = await import(await compile('../src/components/FilmEdgeMark.tsx', {
  react: reactUrl, 'react/jsx-runtime': jsxUrl, '../contexts/HdrContext': contextUrl,
  '../utils/photoSources': sourcesUrl,
  '../utils/filmGlyphs': await compile('../src/utils/filmGlyphs.ts'),
}));
test('one decoded HDR edge image survives a reverse fade but is released when offscreen', async t => {
  const globals = new Map();
  const frames = new Map();
  let id = 0;
  for (const [name, value] of Object.entries({
    requestAnimationFrame: callback => { frames.set(++id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
  })) { globals.set(name, globalThis[name]); globalThis[name] = value; }
  globalThis.__hdrTable = { enabled: false };
  let decodes = 0;
  const node = { decode: () => { decodes++; return Promise.resolve(); } };
  const render = harness(t, props => {
    const tree = FilmEdgeMark(props);
    const image = tree.props.children[1];
    if (image) image.props.ref.current = node;
    return tree;
  });
  t.after(() => { for (const [name, value] of globals) globalThis[name] = value; delete globalThis.__hdrTable; });
  const paint = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn()); };
  let tree = render({ text: 'FUJI' });
  assert.equal(tree.props.children[1], null);
  globalThis.__hdrTable.enabled = true;
  tree = render({ text: 'FUJI' });
  tree = render({ text: 'FUJI' });
  assert.equal(tree.props['data-edge-hdr-ready'], false);
  await tick(); paint(); paint(); tree = render({ text: 'FUJI' });
  assert.equal(tree.props['data-edge-hdr-ready'], true);
  assert.equal(decodes, 1);
  globalThis.__hdrTable.enabled = false;
  tree = render({ text: 'FUJI' });
  assert.equal(tree.props['data-edge-hdr-ready'], false);
  assert.equal(tree.props.children[1].type, 'img', 'closing fade retains the one native label');
  globalThis.__hdrTable.enabled = true;
  tree = render({ text: 'FUJI' });
  assert.equal(tree.props['data-edge-hdr-ready'], true);
  assert.equal(decodes, 1, 'quick reverse switches reuse the decoded native label');
  tree = render({ text: 'FUJI', active: false });
  assert.equal(tree.props.children[1], null, 'offscreen labels must release HDR textures');
  assert.equal(tree.props['data-edge-hdr-ready'], false);
});

test('native DOM decodes share the photo queue instead of starting an unbounded second wave', async t => {
  const requests = mockImages(t);
  const first = preloadPhotoSource('serial-label-budget');
  let starts = 0;
  const dom = decodePhotoElement({ decode() { starts++; return Promise.resolve(); } }, 0);
  assert.equal(starts, 0, 'DOM work waits while a photo is decoding');
  requests[0].resolve();
  await first; await dom;
  assert.equal(starts, 1);
});

test('loupe and zoomed film details decode before ordinary previews on a cold queue', async () => {
  let releaseBlocker;
  const blocker = decodePhotoElement({
    decode() { return new Promise(resolve => { releaseBlocker = resolve; }); },
  });
  const order = [];
  const preview = decodePhotoElement({ decode() { order.push('preview'); return Promise.resolve(); } }, 2);
  const table = decodePhotoElement({ decode() { order.push('table'); return Promise.resolve(); } }, 3);
  const loupe = decodePhotoElement({ decode() { order.push('loupe'); return Promise.resolve(); } }, 4);
  releaseBlocker();
  await Promise.all([blocker, preview, table, loupe]);
  assert.deepEqual(order, ['loupe', 'table', 'preview']);
});

test('offscreen queued DOM images are cancelled before native decoding starts', async t => {
  const requests = mockImages(t);
  const first = preloadPhotoSource('cancelled-label-budget');
  const controller = new AbortController();
  let starts = 0;
  const pending = decodePhotoElement({ decode() { starts++; return Promise.resolve(); } }, 0, controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  requests[0].resolve(); await first; await tick();
  assert.equal(starts, 0);
  await decodePhotoElement({ decode() { starts++; return Promise.resolve(); } });
  assert.equal(starts, 1, 'cancellation must not lock the decode queue');
});

test('a DOM decode failure cannot freeze later image jobs', async () => {
  const first = decodePhotoElement({ decode() { throw new Error('invalid image'); } });
  let completed = false;
  const next = decodePhotoElement({ decode() { completed = true; return Promise.resolve(); } });
  await assert.rejects(first, /invalid image/);
  await next;
  assert.equal(completed, true);
});

test('aborting an active hung native decode releases the queue before its promise settles', async () => {
  const controller = new AbortController();
  let settleOld;
  const old = decodePhotoElement({ decode() { return new Promise(resolve => { settleOld = resolve; }); } }, 2, controller.signal);
  let nextStarted = false;
  const next = decodePhotoElement({ decode() { nextStarted = true; return Promise.resolve(); } });
  controller.abort();
  await assert.rejects(old, { name: 'AbortError' });
  await next;
  assert(nextStarted);
  settleOld(); await tick();
});

test('decode timeout advances the queue, and a late old callback cannot unlock a newer job', async t => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const timers = new Map(); let id = 0;
  globalThis.setTimeout = (callback, delay) => { timers.set(++id, {callback, delay}); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  t.after(() => { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; });
  let settleOld, settleNext;
  const old = decodePhotoElement({ decode() { return new Promise(resolve => { settleOld = resolve; }); } });
  const next = decodePhotoElement({ decode() { return new Promise(resolve => { settleNext = resolve; }); } });
  let thirdStarted = false;
  const third = decodePhotoElement({ decode() { thirdStarted = true; return Promise.resolve(); } });
  const timeout = [...timers.values()][0];
  assert.equal(timeout.delay, 12000);
  timeout.callback();
  await assert.rejects(old, { name: 'TimeoutError' });
  assert.equal(typeof settleNext, 'function');
  settleOld(); await tick();
  assert.equal(thirdStarted, false, 'the old completion must not clear the new active job');
  settleNext(); await next; await third;
  assert(thirdStarted);
  assert.equal(timers.size, 0);
});

test('a timed-out detached preload is aborted and evicted so a later visit can retry', async t => {
  const requests = mockImages(t);
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  const timers = new Map(); let id = 0;
  globalThis.setTimeout = (callback, delay) => { timers.set(++id, {callback, delay}); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  t.after(() => { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; });
  const old = preloadPhotoSource('deadline-preview');
  const timeout = [...timers.values()][0];
  assert.equal(timeout.delay, 30000);
  timeout.callback();
  await assert.rejects(old, { name: 'TimeoutError' });
  assert.equal(requests[0].image.src, '', 'stop retaining the old detached image source');
  const retry = preloadPhotoSource('deadline-preview');
  assert.notEqual(old, retry);
  requests[1].resolve(); await retry;
  requests[0].resolve(); await tick();
  assert.equal(timers.size, 0);
});

const { default: useFilmVisibility } = await import(await compile('../src/hooks/useFilmVisibility.ts', { react: reactUrl }));
test('film visibility keeps observing pan/zoom and cleans up on route exit', t => {
  let callback;
  let observed;
  let options;
  let stopped = 0;
  const previousWindow = globalThis.window;
  const previousObserver = globalThis.IntersectionObserver;
  const Observer = class {
    constructor(fn, config) { callback = fn; options = config; }
    observe(element) { observed = element; }
    disconnect() { stopped++; }
  };
  globalThis.IntersectionObserver = Observer;
  globalThis.window = { IntersectionObserver: Observer };
  const render = harness(t, useFilmVisibility);
  t.after(() => { globalThis.window = previousWindow; globalThis.IntersectionObserver = previousObserver; });
  const viewport = {};
  const ref = { current: { closest: () => viewport } };
  assert.equal(render(ref), false);
  assert.equal(observed, ref.current);
  assert.equal(options.root, viewport);
  assert.equal(options.rootMargin, '0px');
  callback([{ isIntersecting: true }]);
  assert.equal(render(ref), true);
  callback([{ isIntersecting: false }]);
  assert.equal(render(ref), false);
  callback([{ isIntersecting: true }]);
  assert.equal(render(ref), true);
  assert.equal(stopped, 0, 'do not disconnect after the first intersection');
});
