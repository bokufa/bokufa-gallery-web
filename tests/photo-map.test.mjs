import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../src/utils/photoMap.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { buildPhotoMapItems } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const photo = (id, country, location) => ({ id, metadata: { datetime: `date-${id}`, location, city: country && { prefecture: { country: { code: country } } } }, thumb_file: { url: `thumb-${id}` } });

test("photo map contains all countries and valid GPS photos with no country metadata", () => {
  const photos = [photo(1, "JPN", { longitude: 139, latitude: 35 }), photo(2, "ITA", { longitude: 9, latitude: 45 }), photo(3, "NOR", { longitude: 10, latitude: 60 }), photo(4, null, { longitude: 0, latitude: 0 })];
  const items = buildPhotoMapItems(photos);
  assert.deepEqual(items.map(p => p.id), [1, 2, 3, 4]);
  assert.equal(items[1].datetime, "date-2");
  assert.equal(items[1].thumb_file, photos[1].thumb_file);
});

test("missing, partial and out-of-range coordinates do not produce markers", () => {
  const invalid = [undefined, null, {}, { longitude: null, latitude: 35 }, { longitude: 139, latitude: NaN }, { longitude: 181, latitude: 35 }, { longitude: 0, latitude: -91 }];
  assert.deepEqual(buildPhotoMapItems(invalid.map((location, id) => photo(id, "JPN", location))), []);
});
