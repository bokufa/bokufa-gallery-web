import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const url = text => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const compile = text => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const math = url(compile(await readFile(new URL('../src/utils/filmLoupe.ts', import.meta.url), 'utf8')));
const controllerSource = compile(await readFile(new URL('../src/utils/filmLoupeController.ts', import.meta.url), 'utf8')).replace('"./filmLoupe"', JSON.stringify(math));
const { mountFilmLoupe } = await import(url(controllerSource));
const tick = () => new Promise(resolve => setImmediate(resolve));

function fixture(t, count = 100, load) {
  const metrics = { reads: 0, queries: 0, decodes: 0, rootDeepClones: 0, frameLayoutWrites: 0 };
  const view = { x: 0, y: 0, scale: 1 };
  const frames = new Map();
  const timers = new Map();
  const calls = [];
  let id = 0;
  let mutation;
  let resize;
  class Element {
    constructor(tag = 'div', className = '') {
      this.tagName = tag;
      this.attrs = new Map([['class', className]]);
      this.dataset = {};
      this.childNodes = [];
      this.listeners = new Map();
      this.captures = new Set();
      this.style = new Proxy({}, { set: (target, name, value) => {
        if (this.outer && ['left', 'top', 'width', 'height'].includes(name)) metrics.frameLayoutWrites++;
        target[name] = value; return true;
      } });
      this.classList = { add: value => this.attrs.set('class', `${this.attrs.get('class')} ${value}`) };
      this.src = '';
      this.rect = { left: 0, top: 0, width: 0, height: 0 };
    }
    get attributes() { return [...this.attrs].map(([name, value]) => ({ name, value })); }
    setAttribute(name, value) {
      this.attrs.set(name, value);
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
    }
    append(...nodes) { for (const node of nodes) { node.remove(); node.parentElement = this; this.childNodes.push(node); } }
    replaceChildren(...nodes) { for (const node of [...this.childNodes]) node.remove(); this.append(...nodes); }
    remove() { if (this.parentElement) { const children = this.parentElement.childNodes; children.splice(children.indexOf(this), 1); this.parentElement = null; } }
    replaceWith(other) {
      const parent = this.parentElement;
      const index = parent.childNodes.indexOf(this);
      other.remove(); other.parentElement = parent; parent.childNodes[index] = other; this.parentElement = null;
    }
    get childElementCount() { return this.childNodes.length; }
    cloneNode(deep) {
      if (this.root && deep) metrics.rootDeepClones++;
      const copy = new Element(this.tagName);
      for (const [name, value] of this.attrs) copy.setAttribute(name, value);
      Object.assign(copy.dataset, this.dataset);
      Object.assign(copy.style, this.style);
      copy.src = this.src;
      if (deep) copy.append(...this.childNodes.map(child => child.cloneNode(true)));
      return copy;
    }
    matches(selector) {
      if (selector === '.film-edge-label') return this.attrs.get('class').split(' ').includes('film-edge-label');
      if (selector === '.film-frame') return this.attrs.get('class').split(' ').includes('film-frame');
      if (selector === '.film-image-window') return this.attrs.get('class').split(' ').includes('film-image-window');
      if (selector.includes('img')) {
        const isActive = this.dataset.bufferActive === 'true';
        return this.tagName === 'img' && (selector.includes(':not') ? !isActive : isActive);
      }
      return false;
    }
    querySelectorAll(selector) {
      metrics.queries++;
      const result = [];
      const visit = node => { for (const child of node.childNodes) { if (child.matches(selector)) result.push(child); visit(child); } };
      visit(this); return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getBoundingClientRect() {
      metrics.reads++;
      const left = this.rect.left * view.scale + view.x;
      const top = this.rect.top * view.scale + view.y;
      return { left, top, width: this.rect.width * view.scale, height: this.rect.height * view.scale, right: left + this.rect.width * view.scale, bottom: top + this.rect.height * view.scale };
    }
    get clientWidth() { metrics.reads++; return this.width || 1000; }
    get clientHeight() { metrics.reads++; return this.height || 700; }
    decode() { metrics.decodes++; return Promise.resolve(); }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    removeEventListener(name) { this.listeners.delete(name); }
    focus() {}
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
  }
  const source = new Element('div', 'film-canvas-content');
  source.root = true;
  for (let i = 0; i < count; i++) {
    const frame = new Element('button', 'film-frame');
    const left = i < 2 ? 320 + i * 320 : 1500 + i * 320;
    frame.rect = { left, top: 200, width: 300, height: 300 };
    const window = new Element('span', 'film-image-window');
    window.rect = { left: left + 15, top: 215, width: 270, height: 270 };
    const image = new Element('img');
    Object.assign(image.dataset, { bufferActive: 'true', filmPhotoId: String(i + 1), filmThumbSrc: `thumb-${i + 1}`, filmLargeSrc: `large-${i + 1}`, filmHdrSrc: `hdr-${i + 1}`, filmHdrEnabled: 'false' });
    image.src = `medium-${i + 1}`;
    const label = new Element('span', 'film-edge-label');
    label.setAttribute('data-edge-text', 'FUJI'); label.setAttribute('data-edge-hdr-ready', 'false');
    label.append(new Element('svg'));
    window.append(image); frame.append(window, label); source.append(frame);
  }
  const viewport = new Element();
  const frame = new Element(); frame.outer = true;
  const glass = new Element('button');
  const globals = new Map();
  const mock = (name, value) => { globals.set(name, globalThis[name]); globalThis[name] = value; };
  mock('document', { createElement: tag => new Element(tag) });
  mock('window', { devicePixelRatio: 2 });
  mock('requestAnimationFrame', callback => { frames.set(++id, callback); return id; });
  mock('cancelAnimationFrame', id => frames.delete(id));
  mock('setTimeout', callback => { timers.set(++id, callback); return id; });
  mock('clearTimeout', id => timers.delete(id));
  mock('MutationObserver', class { constructor(callback) { mutation = callback; } observe() {} disconnect() {} });
  mock('ResizeObserver', class { constructor(callback) { resize = callback; } observe() {} disconnect() {} });
  const controller = mountFilmLoupe({ viewport, source, frame, glass, getView: () => view,
    loadDetail: image => { calls.push(image.dataset.filmPhotoId); return load ? load(image) : Promise.resolve(image.dataset.filmHdrEnabled === 'true' ? image.dataset.filmHdrSrc : image.dataset.filmLargeSrc); },
    onClose() {}, onMagnification() {},
  });
  t.after(() => { controller.destroy(); for (const [name, value] of globals) globalThis[name] = value; });
  const flush = queue => { const callbacks = [...queue.values()]; queue.clear(); callbacks.forEach(callback => callback()); };
  const emit = (name, x = 500, y = 350) => glass.listeners.get(name)({ button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault() {} });
  const mirror = glass.childNodes[0];
  return { metrics, view, calls, controller, viewport, frame, glass, source, mirror, frames, timers, emit, paint: () => flush(frames), idle: () => flush(timers), mutate: () => mutation(), resize: () => resize() };
}

test('100 drag frames perform zero layout reads, selector scans, decodes or detail requests', t => {
  const f = fixture(t);
  Object.keys(f.metrics).forEach(key => { f.metrics[key] = 0; });
  f.emit('pointerdown');
  for (let i = 1; i <= 100; i++) { f.emit('pointermove', 500 + i * 2.5); f.paint(); }
  assert.equal(f.metrics.reads, 0);
  assert.equal(f.metrics.queries, 0);
  assert.equal(f.metrics.decodes, 0);
  assert.equal(f.metrics.frameLayoutWrites, 0);
  assert.equal(f.calls.length, 0);
  assert.match(f.frame.style.transform, /translate3d\(610px, 210px, 0\)/);
  assert(f.mirror.childNodes.filter(node => node.style.display !== 'none').length <= 2);
});

test('release upgrades only the final sample and hidden frames release their HDR image', async t => {
  const f = fixture(t, 20);
  f.emit('pointerdown'); f.emit('pointermove', 750); f.paint();
  f.emit('pointerup', 750); f.idle();
  await tick(); f.paint(); f.paint();
  assert.deepEqual(f.calls, ['2']);
  const second = f.mirror.childNodes[1];
  const layers = second.querySelectorAll('.film-image-window img[data-buffer-active="true"]');
  assert.equal(layers.length, 2, 'old image remains opaque throughout the dissolve');
  assert.equal(layers[0].src, 'thumb-2');
  assert.equal(layers[0].style.opacity, '1');
  assert.equal(layers[1].style.opacity, '1');
  assert.equal(layers[1].style.transition, 'opacity 600ms ease-in-out');
  f.idle();
  assert.equal(second.querySelector('.film-image-window img[data-buffer-active="true"]').src, 'large-2');
  f.source.childNodes[1].querySelector('.film-image-window img[data-buffer-active="true"]').dataset.filmHdrEnabled = 'true';
  const beforeReads = f.metrics.reads;
  f.mutate(); f.paint(); f.idle(); await tick(); f.paint(); f.paint();
  f.idle();
  assert.equal(f.metrics.reads, beforeReads, 'image/HDR changes do not remeasure source layout');
  assert.equal(second.querySelector('.film-image-window img[data-buffer-active="true"]').src, 'hdr-2');
  f.emit('pointerdown', 750); f.emit('pointermove', 500); f.paint();
  assert.equal(second.style.display, 'none');
  assert.equal(second.querySelector('.film-image-window img[data-buffer-active="true"]').src, 'thumb-2');
});

test('a late detail result cannot replace a different sample, and closing cancels queued work', async t => {
  const resolvers = new Map();
  const f = fixture(t, 2, image => new Promise(resolve => resolvers.set(image.dataset.filmPhotoId, resolve)));
  f.idle();
  f.emit('pointerdown'); f.emit('pointermove', 750); f.paint(); f.emit('pointerup', 750); f.idle();
  resolvers.get('1')('large-1'); resolvers.get('2')('large-2');
  await tick(); f.paint(); f.paint();
  f.idle();
  assert.equal(f.mirror.childNodes[0].querySelector('.film-image-window img[data-buffer-active="true"]').src, 'thumb-1');
  assert.equal(f.mirror.childNodes[1].querySelector('.film-image-window img[data-buffer-active="true"]').src, 'large-2');
  f.controller.sceneChanged();
  f.controller.destroy();
  assert.equal(f.frames.size, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.glass.childNodes.length, 0);
  assert.equal(f.glass.listeners.size, 0);
});

test('loupe mirrors HDR lettering readiness and enable/disable changes without remeasuring the scene', t => {
  const f = fixture(t, 2);
  const label = f.source.childNodes[0].querySelector('.film-edge-label');
  const atlas = label.childNodes[0].cloneNode(false);
  atlas.setAttribute('class', 'film-edge-hdr'); label.append(atlas);
  label.setAttribute('data-edge-hdr-ready', 'true');
  const beforeReads = f.metrics.reads;
  f.mutate();
  let copy = f.mirror.childNodes[0].querySelector('.film-edge-label');
  assert.equal(copy.dataset.edgeHdrReady, 'true');
  assert.equal(copy.childElementCount, 2);
  const current = copy;
  f.mutate();
  assert.equal(f.mirror.childNodes[0].querySelector('.film-edge-label'), current, 'unchanged glyphs are not cloned again');
  label.setAttribute('data-edge-hdr-ready', 'false'); atlas.remove(); f.mutate();
  copy = f.mirror.childNodes[0].querySelector('.film-edge-label');
  assert.equal(copy.dataset.edgeHdrReady, 'false');
  assert.equal(copy.childElementCount, 1);
  assert.equal(f.metrics.reads, beforeReads);
});
