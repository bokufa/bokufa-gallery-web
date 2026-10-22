import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(
  await readFile(
    new URL("../src/utils/filmDetailSelection.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const {
  planFilmDetailSelection,
  FILM_DETAIL_SCALE_THRESHOLD,
  FILM_DETAIL_PERCENT_THRESHOLD,
  MAX_FILM_DETAIL_IMAGES,
  usesFilmDetail,
} = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const candidates = [1, 2, 3, 4].map((id, index) => ({
  id,
  distance: index * 100,
}));

test("the table starts detail upgrades only at 200 percent and caps them at three", () => {
  assert.equal(FILM_DETAIL_SCALE_THRESHOLD, 2);
  assert.equal(FILM_DETAIL_PERCENT_THRESHOLD, 200);
  assert.equal(MAX_FILM_DETAIL_IMAGES, 3);
  let ids = new Set();
  ids = planFilmDetailSelection(ids, candidates, 1.994).ids;
  assert.deepEqual([...ids], []);
  assert.equal(usesFilmDetail(1.994), false);
  assert.equal(usesFilmDetail(1.995), true);
  for (let i = 0; i < 4; i++)
    ids = planFilmDetailSelection(ids, candidates, 1.995).ids;
  assert.deepEqual([...ids], [1, 2, 3]);
});

test("zooming out keeps a sub-limit cache without replacing or unloading it", () => {
  const current = new Set([8, 9]);
  const plan = planFilmDetailSelection(current, candidates, 0.14);
  assert.deepEqual([...plan.ids], [8, 9]);
  assert.equal(plan.waitForRelease, false);
});

test("a new center candidate releases one stale texture before replacement", () => {
  const plan = planFilmDetailSelection(new Set([8, 2, 3]), candidates, 3);
  assert.equal(plan.ids.size, 2);
  assert(!plan.ids.has(8));
  assert.equal(plan.waitForRelease, true);
  const refill = planFilmDetailSelection(plan.ids, candidates, 3);
  assert.deepEqual([...refill.ids], [2, 3, 1]);
  assert.equal(refill.ids.size, MAX_FILM_DETAIL_IMAGES);
});
