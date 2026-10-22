import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/filmScale.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { filmSceneWidth, FILM_PIXELS_PER_MM } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("the new 100% baseline is exactly 65% of the previous size for both film formats", () => {
  for (const dimension of [61.5, 56, 38, 35, 36, 24]) {
    assert(Math.abs(dimension * FILM_PIXELS_PER_MM / (dimension * 5.02 * 1.5) - 0.65) < 1e-12);
  }
});

test("the scene fits four 120 frames at the compact baseline", () => {
  const needed = 2 * 100 + 4 * 61.5 * FILM_PIXELS_PER_MM + 3 * 20;

  assert.equal(filmSceneWidth(), needed + 1);
});
