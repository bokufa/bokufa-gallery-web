import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const data = await readFile(new URL('../src/data/nativePlaceNames.json', import.meta.url), 'utf8');
const source = transpile(await readFile(new URL('../src/utils/placeNames.ts', import.meta.url), 'utf8'))
  .replace('"../data/nativePlaceNames.json"', JSON.stringify(url(`export default ${data};`)));
const { nativeCityName, nativeCountryName, nativePrefectureName, nativePlaceName, nativeLocationText, countryCodeFor } = await import(url(source));
const city = (code, regionId, region, id, name) => ({ id, name, prefecture: { id: regionId, name: region, country: { code, name: code } } });

test('legacy European translations display local spelling and diacritics without changing IDs/data', () => {
  for (const [value, expected, region, country] of [
    [city('SWE', 1386953115, '斯德哥尔摩省', 1111217761, '斯德哥尔摩'), 'Stockholm', 'Stockholms län', 'Sverige'],
    [city('SWE', 1328390735, '斯科讷省', 1161728280, '马尔默'), 'Malmö', 'Skåne län', 'Sverige'],
    [city('DNK', 1893424035, '首都大區', 1336066532, '哥本哈根'), 'København', 'Hovedstaden', 'Danmark'],
    [city('NOR', 1742335846, '布斯克吕郡', 1613486988, '赫讷福斯'), 'Hønefoss', 'Buskerud', 'Norge'],
    [city('ITA', 1737045550, '伦巴第', 1411909017, '米兰'), 'Milano', 'Lombardia', 'Italia'],
  ]) {
    const before = JSON.stringify(value);
    assert.equal(nativeCityName(value), expected);
    assert.equal(nativePrefectureName(value.prefecture), region);
    assert.equal(nativeCountryName(value.prefecture.country), country);
    assert.equal(JSON.stringify(value), before);
  }
});

test('Japanese glyphs and legacy missing country codes retain native names', () => {
  const value = city('JPN', 210005, '岐阜県', 212016, '岐阜市');
  value.prefecture.country = { name: '日本', id: null };
  assert.equal(countryCodeFor(value.prefecture.country), 'JPN');
  assert.equal(nativeCityName(value), '岐阜市');
  assert.equal(nativePrefectureName(value.prefecture), '岐阜県');
  assert.equal(nativePlaceName({ name: '广岛县' }, 'JPN', 'prefecture'), '広島県');
});

test('explicit API native names win; unknown places are not guessed or translated', () => {
  assert.equal(nativePlaceName({ name: 'Translated', name_local: 'Å المحلي' }, 'SWE', 'city'), 'Å المحلي');
  assert.equal(nativePlaceName({ name: 'Translated', i18n: { sv: 'Åmål' } }, 'SWE', 'city'), 'Åmål');
  assert.equal(nativePlaceName({ name: 'Unlisted village' }, 'SWE', 'city'), 'Unlisted village');
  assert.equal(nativePlaceName({ name: 'Unknown place' }, 'XYZ', 'city'), 'Unknown place');
  assert.equal(nativePlaceName({ name: 'Lund University' }, 'SWE', 'place'), 'Lunds universitet');
});

test('Swiss places do not inherit German exonyms just because the country is multilingual', () => {
  assert.equal(nativeCountryName({ code: 'CHE', name: '瑞士' }), 'Schweiz');
  assert.equal(nativeLocationText('瑞士 · Genève'), 'Schweiz · Genève');
  assert.equal(nativePlaceName({ name: 'Genève', i18n: { de: 'Genf' } }, 'CHE', 'city'), 'Genève');
  assert.equal(nativePlaceName({ name: '瓦莱州', id: 1532128074 }, 'CHE', 'prefecture'), 'Valais / Wallis');
});

test('blog location headers normalize exact tokens without rewriting descriptive phrases', () => {
  assert.equal(nativeLocationText('东京 · 中央区 / 立川市'), '東京 · 中央区 / 立川市');
  assert.equal(nativeLocationText('瑞典 · 马尔默'), 'Sverige · Malmö');
  assert.equal(nativeLocationText('东京站附近的一段回忆'), '东京站附近的一段回忆');
});

const mapCode = transpile(await readFile(new URL('../src/utils/mapbox.ts', import.meta.url), 'utf8'));
const { applyLocalMapLabels, localMapLabelExpression } = await import(url(mapCode));

test('Mapbox endonym replacement preserves formatted text, shields, and script information', () => {
  const original = ['format', ['coalesce', ['get', 'name_zh-Hans'], ['get', 'name_en'], ['get', 'name']], { 'font-scale': 1.1 }, '\n', {}, ['get', 'ref'], {}];
  const local = localMapLabelExpression(original);
  assert.deepEqual(local, ['format', ['coalesce', ['get', 'name'], ['get', 'name'], ['get', 'name']], { 'font-scale': 1.1 }, '\n', {}, ['get', 'ref'], {}]);
  assert.equal(original[1][1][1], 'name_zh-Hans', 'style input is not mutated');
  assert.deepEqual(localMapLabelExpression(['get', 'name_script']), ['get', 'name_script']);
  assert.equal(localMapLabelExpression('{name_en} · {ref}'), '{name} · {ref}');
});

test('all symbol layers can localize; non-name labels are untouched and repeated application is a no-op', () => {
  const fields = new Map([['place-label-large', ['get', 'name_en']], ['road-shield', ['get', 'ref']], ['local-label', ['get', 'name']]]);
  const calls = [];
  const map = {
    getStyle: () => ({ layers: [...fields.keys()].map(id => ({ id, type: 'symbol' })).concat({ id: 'land', type: 'fill' }) }),
    getLayoutProperty: id => fields.get(id),
    setLayoutProperty: (id, field, expression) => { calls.push(id); fields.set(id, expression); },
  };
  applyLocalMapLabels(map);
  assert.deepEqual(calls, ['place-label-large']);
  assert.deepEqual(fields.get('road-shield'), ['get', 'ref']);
  applyLocalMapLabels(map);
  assert.equal(calls.length, 1);
});
