import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const dataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
async function compile(filename, imports = {}) {
  let code = ts.transpileModule(await readFile(new URL(filename, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const [from, to] of Object.entries(imports)) code = code.replaceAll(JSON.stringify(from), JSON.stringify(to));
  return dataUrl(code);
}
const noOp = dataUrl('export default () => null;');
const hooks = dataUrl(`
export const useEffect = () => {};
export const useMemo = fn => fn();
export const useState = initial => [initial === undefined ? globalThis.__descriptionPhoto : initial === 'loading' ? 'ready' : initial, () => {}];
`);
const ui = dataUrl(`import React from ${JSON.stringify(import.meta.resolve('react'))};
export const Button = () => null;
export const Spinner = () => null;
export const Card = ({children}) => React.createElement('section', {}, children);
export const CardBody = ({children}) => React.createElement('p', {}, children);
`);
const imports = {
  'react': hooks,
  'react/jsx-runtime': import.meta.resolve('react/jsx-runtime'),
  '@heroui/react': ui,
  'react-icons/hi2': dataUrl('export const HiArrowLongLeft = () => null;'),
  'react-router-dom': dataUrl('export const useParams = () => ({id: "192"}); export const useNavigate = () => () => {};'),
  '../hooks/useMediaQuery': dataUrl('export default () => true;'),
  '../services/photos': dataUrl('export const fetchPhoto = () => {}; export const isCanceledPhotoRequest = () => false;'),
  '../utils/film': await compile('../src/utils/film.ts'),
  '../contexts/LanguageContext': dataUrl('export const useLanguage = () => ({ t: key => key });'),
};
for (const name of ['PhotoDateInfo', 'PhotoImageCard', 'PhotoLocationInfo', 'PhotoMapCard', 'PhotoMetaCard', 'PhotoTitle'])
  imports[`../components/${name}`] = noOp;
const { default: PhotoPage } = await import(await compile('../src/routes/PhotoPage.tsx', imports));

test('standalone film detail omits the duplicated caption panel without erasing stored data', t => {
  t.after(() => delete globalThis.__descriptionPhoto);
  const description = '5.6 1/30';
  globalThis.__descriptionPhoto = { id: 192, description, metadata: { film: { stock: 'FUJI RDP3' } } };
  const filmHtml = renderToStaticMarkup(React.createElement(PhotoPage));
  assert(!filmHtml.includes(description));
  assert.equal(globalThis.__descriptionPhoto.description, description);
  globalThis.__descriptionPhoto = { id: 202, description: 'A digital photo caption', metadata: {} };
  const digitalHtml = renderToStaticMarkup(React.createElement(PhotoPage));
  assert(digitalHtml.includes('A digital photo caption'));
});
