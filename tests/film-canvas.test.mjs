import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/utils/filmCanvas.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const {
  zoomFilmView,
  boundFilmView,
  minimumFilmScale,
  defaultFilmView,
  FILM_BOARD_MARGIN,
} = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("zoom keeps the exact film point under the pointer stationary", () => {
  const view = { x: -200, y: -350, scale: 1.25 };
  const pointer = { x: 450, y: 200 };
  const next = zoomFilmView(view, 2.5, pointer.x, pointer.y);

  assert.equal(
    (pointer.x - next.x) / next.scale,
    (pointer.x - view.x) / view.scale,
  );
  assert.equal(
    (pointer.y - next.y) / next.scale,
    (pointer.y - view.y) / view.scale,
  );
  assert.deepEqual(zoomFilmView(next, 1.25, pointer.x, pointer.y), view);
});

test("scale stops at the allowed minimum and 300% and stays stable at either limit", () => {
  const view = { x: 0, y: 0, scale: 1 };
  const maximum = zoomFilmView(view, 100, 400, 300);
  const minimum = zoomFilmView(view, 0.01, 400, 300);

  assert.equal(maximum.scale, 3);
  assert.equal(minimum.scale, 0.1);
  assert.deepEqual(zoomFilmView(maximum, 10, 400, 300), maximum);
  assert.deepEqual(zoomFilmView(minimum, 0.01, 400, 300), minimum);
});

test("pan bounds let every edge of a large contact sheet be reached without losing it", () => {
  const start = boundFilmView(
    { x: 5000, y: 5000, scale: 2 },
    1000,
    700,
    1000,
    1800,
  );
  const end = boundFilmView(
    { x: -50000, y: -50000, scale: 2 },
    1000,
    700,
    1000,
    1800,
  );

  assert.equal(start.x, FILM_BOARD_MARGIN * 2);
  assert.equal(start.y, FILM_BOARD_MARGIN * 2);
  assert.equal(end.x, 1000 - (1000 + FILM_BOARD_MARGIN) * 2);
  assert.equal(end.y, 700 - (1800 + FILM_BOARD_MARGIN) * 2);
  const view = { x: -300, y: -800, scale: 2 };

  assert.deepEqual(boundFilmView(view, 1000, 700, 1000, 1800), view);
});

test("the enlarged board always covers the viewport at every zoom and pan limit", () => {
  for (const [width, height, contentWidth, contentHeight] of [
    [320, 700, 1440, 1200],
    [390, 780, 1440, 1200],
    [1000, 700, 1440, 1800],
    [1920, 1080, 1440, 1080],
  ]) {
    for (const scale of [0.01, 0.1, 0.6, 1, 2, 3, 100]) {
      for (const position of [-5000, 0, 5000]) {
        const view = boundFilmView(
          { x: position, y: position, scale },
          width,
          height,
          contentWidth,
          contentHeight,
        );

        assert(view.x - FILM_BOARD_MARGIN * view.scale <= 1e-9);
        assert(view.y - FILM_BOARD_MARGIN * view.scale <= 1e-9);
        assert(
          view.x + (contentWidth + FILM_BOARD_MARGIN) * view.scale >=
            width - 1e-9,
        );
        assert(
          view.y + (contentHeight + FILM_BOARD_MARGIN) * view.scale >=
            height - 1e-9,
        );
        assert(
          view.scale >=
            minimumFilmScale(width, height, contentWidth, contentHeight),
        );
      }
    }
  }
  assert.deepEqual(
    boundFilmView({ x: 0, y: 0, scale: 1 }, 1000, 700, 1000, 500),
    { x: 0, y: 0, scale: 1 },
  );
});

test("phone and desktop start at 100% even when the row is cropped", () => {
  const first = { x: 100, y: 48, width: 294, height: 294 };

  for (const [width, height] of [
    [390, 780],
    [844, 390],
    [1440, 836],
    [1920, 1016],
  ]) {
    const view = defaultFilmView(width, height, 1440, 1200, first);

    assert.equal(view.scale, 1);
    assert(view.scale >= minimumFilmScale(width, height, 1440, 1200));
  }
  assert.deepEqual(defaultFilmView(1920, 1400, 1440, 1200, first), {
    x: 240,
    y: 0,
    scale: 1,
  });
});

test("first-photo focus starts strictly below 80% of the first-row width", () => {
  const first = { x: 100, y: 48, width: 200, height: 200 };
  const row = { x: 100, y: 48, width: 1000, height: 200 };
  const mostlyFits = defaultFilmView(900, 700, 1400, 1200, first, row);
  const exactlyFits = defaultFilmView(800, 700, 1400, 1200, first, row);
  const tooNarrow = defaultFilmView(799, 700, 1400, 1200, first, row);

  assert.equal(mostlyFits.x + row.x + row.width / 2, 450);
  assert.equal(exactlyFits.x + row.x + row.width / 2, 400);
  assert.equal(exactlyFits.y, 0);
  assert.equal(tooNarrow.x + first.x + first.width / 2, 799 / 2);
  assert.equal(tooNarrow.y + first.y + first.height / 2, 350);
});

test("only the first row determines the default center, regardless of the height of later rows", () => {
  const first = { x: 100, y: 48, width: 232.44, height: 232.44 };
  const row = { x: 100, y: 48, width: 989.76, height: 232.44 };
  const view = defaultFilmView(1440, 836, 1440, 900, first, row);

  assert.equal(view.scale, 1);
  assert.equal(view.x + row.x + row.width / 2, 720);
  assert.equal(view.y, 0);
  assert.notEqual(view.x + first.x + first.width / 2, 720);
  const longerScene = defaultFilmView(1440, 836, 1440, 4000, first, row);

  assert.deepEqual(longerScene, view);
  const exactFit = defaultFilmView(row.width, 836, 1440, 4000, first, row);

  assert.equal(exactFit.x + row.x, 0);
  assert.equal(exactFit.y, view.y);
  const phone = defaultFilmView(390, 780, 1440, 900, first, row);

  assert.equal(phone.scale, 1);
  assert.equal(phone.x + first.x + first.width / 2, 195);
  assert.equal(phone.y + first.y + first.height / 2, 390);
});

test("canvas gestures suppress drag clicks, preserve normal clicks, support pinch and reset", async () => {
  const saved = new Map();
  const mockGlobal = (name, value) => {
    saved.set(name, globalThis[name]);
    globalThis[name] = value;
  };
  const listeners = new Map();
  const windowListeners = new Map();
  const frames = new Map();
  const captures = new Set();
  let frameId = 0;
  const content = {
    offsetWidth: 1000,
    offsetHeight: 1800,
    style: {},
    querySelectorAll: () => fixture.frames ?? [],
  };
  const viewport = {
    clientWidth: 1000,
    clientHeight: 700,
    dataset: {},
    getBoundingClientRect: () => ({ left: 0, top: 64 }),
    addEventListener: (name, listener) => listeners.set(name, listener),
    removeEventListener: (name) => listeners.delete(name),
    hasPointerCapture: (id) => captures.has(id),
    setPointerCapture: (id) => {
      captures.add(id);
      // Touch browsers transfer implicit capture from a photo to the canvas.
      listeners.get("lostpointercapture")({ pointerId: id, target: {} });
    },
    releasePointerCapture: (id) => captures.delete(id),
  };
  const fixture = { refs: [viewport, content], effects: [] };
  const emit = (name, overrides = {}) => {
    const event = {
      pointerId: 1,
      clientX: 500,
      clientY: 400,
      button: 0,
      detail: 1,
      deltaX: 0,
      deltaY: 0,
      deltaMode: 0,
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {
        this.stopped = true;
      },
      ...overrides,
    };

    (listeners.get(name) ?? windowListeners.get(name))(event);
    for (const [id, callback] of frames) {
      frames.delete(id);
      callback();
    }
    return event;
  };
  const dataUrl = (value) =>
    `data:text/javascript;base64,${Buffer.from(value).toString("base64")}`;
  mockGlobal("__filmCanvasFixture", fixture);
  mockGlobal("window", {
    addEventListener: (name, listener) => windowListeners.set(name, listener),
    removeEventListener: (name) => windowListeners.delete(name),
  });
  mockGlobal(
    "ResizeObserver",
    class {
      constructor(callback) {
        fixture.resizeCallback = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  mockGlobal("requestAnimationFrame", (callback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  mockGlobal("cancelAnimationFrame", (id) => frames.delete(id));
  let cleanup;

  try {
    const componentSource = await readFile(
      new URL("../src/components/FilmCanvas.tsx", import.meta.url),
      "utf8",
    );
    const scaleSource = await readFile(
      new URL("../src/utils/filmScale.ts", import.meta.url),
      "utf8",
    );
    const detailSource = await readFile(
      new URL("../src/utils/filmDetailSelection.ts", import.meta.url),
      "utf8",
    );
    const scaleModule = ts.transpileModule(scaleSource, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    const detailModule = ts.transpileModule(detailSource, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    const hooks = dataUrl(`
      export const useRef = value => ({ current: value === null ? globalThis.__filmCanvasFixture.refs.shift() : value });
      export const useState = value => [typeof value === 'function' ? value() : value, () => {}];
      export const useEffect = effect => { globalThis.__filmCanvasFixture.effects.push(effect); };
    `);
    const jsx = dataUrl(
      `export const jsx = (type, props) => ({ type, props }); export { jsx as jsxs };`,
    );
    const icons = dataUrl(
      `export const TbMinus = '', TbPlus = '', TbZoomReset = '', TbZoomScan = '';`,
    );
    const component = ts
      .transpileModule(componentSource, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2020,
          jsx: ts.JsxEmit.ReactJSX,
        },
      })
      .outputText.replace('"react"', JSON.stringify(hooks))
      .replace('"react/jsx-runtime"', JSON.stringify(jsx))
      .replace('"react-icons/tb"', JSON.stringify(icons))
      .replace(
        '"./FilmLoupe"',
        JSON.stringify(
          dataUrl("export default function FilmLoupe() { return null; }"),
        ),
      )
      .replace(
        '"./FilmBoardSurface"',
        JSON.stringify(
          dataUrl("export default function FilmBoardSurface() { return null; }"),
        ),
      )
      .replace(
        '"./HdrToggle"',
        JSON.stringify(
          dataUrl("export default function HdrToggle() { return null; }"),
        ),
      )
      .replace(
        '"./HdrLightPanel"',
        JSON.stringify(
          dataUrl("export default function HdrLightPanel() { return null; }"),
        ),
      )
      .replace(
        '"./FloatingControls"',
        JSON.stringify(
          dataUrl(
            "export const floatingControlSurface = ''; export default function FloatingControls() { return null; }",
          ),
        ),
      )
      .replace(
        '"../contexts/HdrContext"',
        JSON.stringify(
          dataUrl("export const useHdr = () => ({ enabled: false });"),
        ),
      )
      .replace(
        '"../contexts/LanguageContext"',
        JSON.stringify(
          dataUrl(
            "export const useLanguage = () => ({ t: key => key === 'film.zoom' ? '胶片缩放' : key });",
          ),
        ),
      )
      .replace(
        '"../contexts/FilmQualityContext"',
        JSON.stringify(
          dataUrl(
            "export function FilmQualityProvider({children}) { return children; }",
          ),
        ),
      )
      .replace(
        '"../utils/filmDetailSelection"',
        JSON.stringify(dataUrl(detailModule)),
      )
      .replace('"../utils/filmScale"', JSON.stringify(dataUrl(scaleModule)))
      .replace('"../utils/filmCanvas"', JSON.stringify(dataUrl(compiled)));
    const { default: FilmCanvas } = await import(dataUrl(component));
    const provider = FilmCanvas({ children: null });
    const tree = provider.props.children;
    cleanup = fixture.effects[0]();
    fixture.effects.slice(1).forEach((effect) => effect());

    emit("pointerdown");
    emit("pointermove", { clientX: 300 });
    assert.equal(
      content.style.transform,
      "translate3d(-200px, 0px, 0) scale(1)",
    );
    emit("pointerup");
    assert.equal(emit("click").stopped, true);
    emit("pointerdown");
    emit("pointerup");
    assert.equal(emit("click").stopped, undefined);

    emit("pointerdown", { clientX: 300 });
    emit("pointerdown", { pointerId: 2, clientX: 500 });
    emit("pointermove", { pointerId: 2, clientX: 700 });
    assert.match(content.style.transform, /scale\(2\)/);
    emit("pointermove", { pointerId: 2, clientX: 800 });
    assert.match(content.style.transform, /scale\(2\.5\)/);
    emit("pointerup", { pointerId: 2 });
    emit("pointerup");

    const controls = tree.props.children
      .flatMap((child) => [child, child?.props?.children])
      .find((child) => child?.props?.["aria-label"] === "胶片缩放")
      .props.children;
    controls[3].props.onClick();
    for (const callback of frames.values()) callback();
    frames.clear();
    assert.equal(content.style.transform, "translate3d(0px, 0px, 0) scale(1)");
    emit("wheel", { deltaY: 160 });
    assert.equal(
      content.style.transform,
      "translate3d(0px, -160px, 0) scale(1)",
    );
    emit("wheel", { deltaY: -60 });
    assert.equal(
      content.style.transform,
      "translate3d(0px, -100px, 0) scale(1)",
    );
    emit("wheel", { deltaX: 30, deltaY: 0 });
    assert.equal(
      content.style.transform,
      "translate3d(-30px, -100px, 0) scale(1)",
    );
    emit("wheel", { deltaY: 20, shiftKey: true });
    assert.equal(
      content.style.transform,
      "translate3d(-50px, -100px, 0) scale(1)",
    );
    emit("wheel", { deltaY: -100, ctrlKey: true });
    assert.match(content.style.transform, /scale\(1\.284/);
    emit("wheel", { deltaY: -100, metaKey: true });
    assert.match(content.style.transform, /scale\(1\.648/);

    viewport.clientWidth = 390;
    viewport.clientHeight = 780;
    fixture.frames = [
      { offsetLeft: 100, offsetTop: 48, offsetWidth: 294, offsetHeight: 294 },
      { offsetLeft: 700, offsetTop: 48, offsetWidth: 232, offsetHeight: 232 },
      { offsetLeft: 100, offsetTop: 800, offsetWidth: 232, offsetHeight: 232 },
    ];
    fixture.resizeCallback();
    for (const callback of frames.values()) callback();
    frames.clear();
    assert.equal(content.offsetWidth, 1000);
    assert.equal(content.offsetHeight, 1800);
    assert.equal(
      content.style.transform,
      "translate3d(-52px, 195px, 0) scale(1)",
    );

    viewport.clientWidth = 1440;
    viewport.clientHeight = 836;
    fixture.resizeCallback();
    for (const callback of frames.values()) callback();
    frames.clear();
    assert.equal(
      content.style.transform,
      "translate3d(204px, 0px, 0) scale(1)",
    );
    controls[3].props.onClick();
    for (const callback of frames.values()) callback();
    frames.clear();
    assert.equal(
      content.style.transform,
      "translate3d(204px, 0px, 0) scale(1)",
    );
  } finally {
    cleanup?.();
    for (const [name, value] of saved) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  }
  assert.equal(listeners.size, 0);
  assert.equal(windowListeners.size, 0);
});
