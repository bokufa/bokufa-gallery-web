import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
async function compile(file, replacements = {}) {
  let source = ts.transpileModule(await readFile(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(JSON.stringify(from), JSON.stringify(to));
  return dataUrl(source);
}
const messagesUrl = await compile('../src/data/uiMessages.ts');
const { UI_LANGUAGES, UI_LANGUAGE_KEY, uiMessages, translateUi, readUiLanguage } = await import(messagesUrl);

test('every interface message has three nonempty translations with matching placeholders', () => {
  const tokens = text => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, translations] of Object.entries(uiMessages)) {
    assert.equal(translations.length, 3, key);
    for (const translation of translations) {
      assert(translation.trim().length > 0, key);
      assert.deepEqual(tokens(translation), tokens(translations[0]), key);
    }
  }
  assert.equal(translateUi('zh-CN', 'nav.home'), '主页');
  assert.equal(translateUi('ja', 'nav.home'), 'ホーム');
  assert.equal(translateUi('en', 'nav.home'), 'Home');
});

test('saved language is validated and inaccessible or absent storage safely defaults to Chinese', () => {
  for (const language of UI_LANGUAGES) assert.equal(readUiLanguage({ getItem: key => { assert.equal(key, UI_LANGUAGE_KEY); return language; } }), language);
  for (const saved of [null, '', 'fr', '__proto__']) assert.equal(readUiLanguage({ getItem: () => saved }), 'zh-CN');
  assert.equal(readUiLanguage(), 'zh-CN');
  assert.equal(readUiLanguage({ getItem: () => { throw new Error('Storage denied'); } }), 'zh-CN');
});

test('interface interpolation preserves photo titles and other user text verbatim', () => {
  const photo = Object.freeze({ title: '东京 · Genève $& {id}', metadata: Object.freeze({ camera: 'Hasselblad 500C', datetime: '2026-10-09', city: 'København' }) });
  const before = JSON.stringify(photo);
  for (const language of UI_LANGUAGES) {
    assert(translateUi(language, 'photo.open', { title: photo.title }).endsWith(photo.title));
    assert(translateUi(language, 'zoom.scale', { scale: 150 }).includes('150%'));
    assert.equal(JSON.stringify(photo), before);
  }
});

const jsxUrl = dataUrl('export const jsx = (type, props, key) => ({type, props, key}); export { jsx as jsxs };');
const hooksUrl = dataUrl(`
export const createContext = value => ({ Provider: 'provider', value });
export const useState = initial => {
  const fixture = globalThis.__languageFixture;
  if (fixture.state === undefined) fixture.state = initial();
  return [fixture.state, value => { fixture.state = value; }];
};
export const useCallback = callback => callback;
export const useMemo = callback => callback();
export const useEffect = callback => callback();
export const useContext = () => globalThis.__languageFixture.value;
`);
const contextUrl = await compile('../src/contexts/LanguageContext.tsx', {
  react: hooksUrl, 'react/jsx-runtime': jsxUrl, '../data/uiMessages': messagesUrl,
});
const { LanguageProvider } = await import(contextUrl);
const { default: LanguageSwitcher } = await import(await compile('../src/components/LanguageSwitcher.tsx', {
  'react/jsx-runtime': jsxUrl, '../data/uiMessages': messagesUrl, '../contexts/LanguageContext': contextUrl,
  '@heroui/react': dataUrl('export const Button = "button", Dropdown = "dropdown", DropdownItem = "item", DropdownMenu = "menu", DropdownTrigger = "trigger";'),
  'react-icons/io5': dataUrl('export const IoLanguageOutline = "language-icon";'),
}));

function fixture(t, saved = 'zh-CN', denied = false) {
  const originals = new Map(['window', 'document', '__languageFixture'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const storage = new Map([[UI_LANGUAGE_KEY, saved]]);
  globalThis.window = { localStorage: {
    getItem: key => { if (denied) throw new Error('denied'); return storage.get(key); },
    setItem: (key, value) => { if (denied) throw new Error('denied'); storage.set(key, value); },
  } };
  globalThis.document = { documentElement: { lang: '' } };
  globalThis.__languageFixture = {};
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  const children = Object.freeze({ type: 'existing-photo-and-map-tree' });
  const render = () => {
    const tree = LanguageProvider({ children });
    assert.equal(tree.props.children, children, 'language changes do not replace or key the page tree');
    globalThis.__languageFixture.value = tree.props.value;
    return tree.props.value;
  };
  return { storage, render };
}

test('icon menu switches immediately, persists the choice, updates document language and restores on refresh', t => {
  const { render, storage } = fixture(t, 'en');
  let value = render();
  assert.equal(value.language, 'en');
  let menu = LanguageSwitcher().props.children[1];
  assert.deepEqual(menu.props.selectedKeys, ['en']);
  const trigger = LanguageSwitcher().props.children[0].props.children;
  assert.equal(trigger.props.isIconOnly, true);
  assert.equal(trigger.props.children.type, 'language-icon');
  assert.equal(menu.props.children.length, 3);
  menu.props.onAction('ja');
  value = render();
  assert.equal(value.t('nav.home'), 'ホーム');
  assert.equal(document.documentElement.lang, 'ja');
  assert.equal(storage.get(UI_LANGUAGE_KEY), 'ja');
  menu = LanguageSwitcher().props.children[1];
  assert.deepEqual(menu.props.selectedKeys, ['ja']);
  menu.props.onAction('not-a-language');
  assert.equal(render().language, 'ja');
  globalThis.__languageFixture.state = undefined;
  assert.equal(render().language, 'ja', 'a remount restores the saved choice');
  menu.props.onAction('zh-CN');
  assert.equal(render().t('nav.home'), '主页');
});

test('language switching remains usable when storage reads and writes are blocked', t => {
  const { render } = fixture(t, 'en', true);
  assert.equal(render().language, 'zh-CN');
  LanguageSwitcher().props.children[1].props.onAction('en');
  assert.equal(render().t('nav.home'), 'Home');
  assert.equal(document.documentElement.lang, 'en');
});

const { localizeMapControls } = await import(await compile('../src/utils/mapUi.ts'));
test('map controls update in place without rebuilding maps or changing geographic labels', () => {
  const nodes = new Map();
  const node = id => {
    if (!nodes.has(id)) nodes.set(id, { attrs: {}, setAttribute(key, value) { this.attrs[key] = value; } });
    return nodes.get(id);
  };
  const names = Object.freeze(['日本', 'Genève', 'Schweiz']);
  const map = { getContainer: () => ({ querySelectorAll: selector => [node(selector)] }), getCanvas: () => node('canvas'), names };
  for (const language of UI_LANGUAGES) {
    localizeMapControls(map, key => translateUi(language, key));
    assert.equal(node('.mapboxgl-ctrl-zoom-in').attrs.title, translateUi(language, 'zoom.in'));
    assert.equal(node('canvas').attrs['aria-label'], translateUi(language, 'map.canvas'));
    assert.equal(map.names, names);
  }
});
