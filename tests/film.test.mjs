import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
async function compile(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
}

const filmUrl = moduleUrl(await compile("../src/utils/film.ts"));
const { isFilmPhoto } = await import(filmUrl);
const photo = (id, manufacture, model, region = 1) => ({
  id,
  metadata: {
    datetime: `2026-03-${String(id).padStart(2, "0")}T00:00:00.000Z`,
    camera: { manufacture: { name: manufacture }, model },
    city: { id: 10, prefecture: { id: region } },
  },
});

test("recognizes existing film metadata without mistaking digital cameras for film", () => {
  assert.equal(isFilmPhoto(photo(1, "Nikon FM", "FUJI C200 · FUJI SP-3000")), true);
  assert.equal(isFilmPhoto(photo(1, "Nikon", "Nikon FM")), true);
  assert.equal(isFilmPhoto(photo(1, "Nikon", "FM")), true);
  assert.equal(isFilmPhoto({ metadata: { film: { stock: "FUJI C200" } } }), true);
  assert.equal(isFilmPhoto(photo(1, "Unknown", "FUJI C200 · FUJI SP-3000")), true);
  for (const [brand, model] of [
    ["Nikon", "Z6"], ["FUJIFILM", "X-T5"], ["SONY", "ILCE-7M4"],
    ["SONY", "ILCE-7CM2"], ["Apple", "iPhone 14 Pro"], ["Unknown", "Camera"],
  ]) assert.equal(isFilmPhoto(photo(1, brand, model)), false);
  assert.equal(isFilmPhoto({ metadata: {} }), false);
});

let instance = 0;
async function createService(photos) {
  const key = `film-test-api-${instance++}`;
  const state = { photos, calls: [], fail: false };
  globalThis[key] = state;
  const axiosUrl = moduleUrl(`
    const state = globalThis[${JSON.stringify(key)}];
    export default {
      create: () => ({ get: async (url, config) => {
        state.calls.push({ url, config });
        if (state.fail) throw new Error("Network unavailable");
        return { data: { payload: state.photos } };
      }}),
      isCancel: () => false,
    };
  `);
  const source = (await compile("../src/services/photos.ts"))
    .replace('"axios"', JSON.stringify(axiosUrl))
    .replace('"../utils/film"', JSON.stringify(filmUrl))
    .replaceAll("import.meta.env", "({ DEV: true })");
  return { service: await import(moduleUrl(source)), state };
}

const mixedPhotos = [
  photo(5, "SONY", "ILCE-7M4"), photo(4, "Nikon FM", "FUJI C200 · FUJI SP-3000"),
  photo(3, "Apple", "iPhone 14 Pro"), photo(2, "Nikon FM", "FUJI C200 · FUJI SP-3000", 2),
];

test("filters before pagination, retains order and reuses the API cache", async () => {
  const { service, state } = await createService(mixedPhotos);
  const first = await service.fetchPhotos({ film_only: true, page_size: 1 });
  assert.deepEqual(first.map((p) => p.id), [4]);
  const second = await service.fetchPhotos({ film_only: true, page_size: 1, last_datetime: first[0].metadata.datetime });
  assert.deepEqual(second.map((p) => p.id), [2]);
  assert.deepEqual(await service.fetchPhotos({ film_only: true, page_size: 20, last_datetime: second[0].metadata.datetime }), []);
  assert.deepEqual(await service.fetchPhotos({ film_only: true, page_size: 20, last_datetime: "missing" }), []);
  assert.deepEqual((await service.fetchPhotos({ film_only: true, page_size: 20, prefecture_id: "2" })).map((p) => p.id), [2]);
  assert.equal(state.calls.length, 1);
  assert.deepEqual(state.calls[0].config.params, { page_size: 2_000 });
});

test("homepage and region queries still include film alongside digital photos", async () => {
  const { service } = await createService(mixedPhotos);
  assert.deepEqual((await service.fetchPhotos({ page_size: 20 })).map((p) => p.id), [5, 4, 3, 2]);
  assert.deepEqual((await service.fetchPhotos({ page_size: 20, prefecture_id: "1" })).map((p) => p.id), [5, 4, 3]);
});

test("empty film collection is valid and failed requests can be retried", async () => {
  const { service, state } = await createService([photo(5, "SONY", "ILCE-7M4")]);
  state.fail = true;
  await assert.rejects(service.fetchPhotos({ film_only: true, page_size: 20 }));
  state.fail = false;
  assert.deepEqual(await service.fetchPhotos({ film_only: true, page_size: 20 }), []);
  assert.equal(state.calls.length, 2);
});
