import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/utils/filmGeometry.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { filmGeometry, filmEdgeLabel } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const photo = (width, height) => ({ thumb_file: { width, height } });

test("6×6 and 135 keep a shared physical scale instead of equal card widths", () => {
  const medium = filmGeometry(photo(8370, 8370));
  const small = filmGeometry(photo(1800, 1200));

  assert.equal(medium.format, "120");
  assert.equal(small.format, "135");
  assert.equal(medium.imageWidth, 56);
  assert.equal(medium.imageHeight, 56);
  assert.equal(small.imageWidth, 36);
  assert.equal(small.imageHeight, 24);
  assert.equal(medium.frameWidth, 61.5);
  assert.equal(medium.frameWidth / 10, 6.15);
  assert.equal(medium.frameHeight / 10, 6.15);
  assert.equal(small.frameWidth / 10, 3.8);
  assert.equal(small.frameHeight, 35);
  for (const scale of [0.6, 1, 3]) {
    assert(Math.abs((medium.imageWidth * 8 * scale) / (small.imageWidth * 8 * scale) - 56 / 36) < 1e-12);
  }
});

test("a portrait 135 frame swaps both image and strip dimensions without distortion", () => {
  const landscape = filmGeometry(photo(1800, 1200));
  const portrait = filmGeometry(photo(1200, 1800));

  assert.equal(portrait.portrait, true);
  assert.equal(portrait.imageWidth, landscape.imageHeight);
  assert.equal(portrait.imageHeight, landscape.imageWidth);
  assert.equal(portrait.frameWidth, landscape.frameHeight);
  assert.equal(portrait.frameHeight, landscape.frameWidth);
});

test("stock aliases use the reference edge name without generating fake exposure numbers", () => {
  for (const stock of ["FUJI RDP3", "FUJI PROVIA 100F", "RDP III"]) {
    assert.equal(filmEdgeLabel(stock), "RDP III");
  }
  assert.equal(filmEdgeLabel("FUJI C200"), "FUJICOLOR C200");
  assert.equal(filmEdgeLabel("Unknown stock"), "UNKNOWN STOCK");
});
