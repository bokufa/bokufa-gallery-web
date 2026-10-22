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
const { sdrPhotoFile, preferredPhotoFile, preloadPhotoSource } = await import(sourcesUrl);
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
  react: reactUrl, 'react/jsx-runtime': jsxUrl,
}));
test('actual DOM layers retain the old opaque photo until new-node decode and two paint frames', async t => {
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
  const commit = tree => {
    for (const child of tree.props.children) {
      if (!nodes.has(child.key)) {
        let resolve;
        const promise = new Promise(done => { resolve = done; });
        nodes.set(child.key, { decode: () => promise, resolve });
      }
      child.props.ref(nodes.get(child.key));
    }
  };
  let tree = render({ src: 'sdr-dom', hdrSrc: 'hdr-dom' });
  commit(tree);
  tree.props.children[0].props.onLoad({ currentTarget: nodes.get('sdr-dom') });
  nodes.get('sdr-dom').resolve();
  await tick();
  render({ src: 'hdr-dom', hdrSrc: 'hdr-dom' });
  tree = render({ src: 'hdr-dom', hdrSrc: 'hdr-dom' });
  commit(tree);
  assert.equal(tree.props.children.length, 2);
  assert.equal(tree.props.children.find(layer => layer.key === 'sdr-dom').props.style.opacity, 1);
  const pending = tree.props.children.find(layer => layer.key === 'hdr-dom');
  assert.equal(pending.props.style.opacity, 0);
  pending.props.onLoad({ currentTarget: nodes.get('hdr-dom') });
  nodes.get('hdr-dom').resolve();
  await tick();
  tree = render({ src: 'hdr-dom', hdrSrc: 'hdr-dom' });
  assert.equal(tree.props.children.length, 2, 'old native image survives the activation commit');
  assert.equal(tree.props.children.find(layer => layer.key === 'hdr-dom').props.style.opacity, 1);
  paint(); paint();
  tree = render({ src: 'hdr-dom', hdrSrc: 'hdr-dom' });
  assert.deepEqual(tree.props.children.map(layer => layer.key), ['hdr-dom']);
});
