import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../src/utils/cameraIdentity.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { cameraIdentity } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const metadata = (name, model) => ({ camera: { manufacture: { name }, model } });

test("known camera EXIF models resolve to the correct local wordmarks", async () => {
  for (const [brand, model, label, file] of [
    ["SONY", "ILCE-7M4", "α7 IV", "sony-a7iv.svg"],
    ["SONY", "ILCE-7CM2", "α7C II", "sony-a7cii.svg"],
    ["RICOH IMAGING COMPANY, LTD.", "RICOH GR IIIx", "GR IIIx", "ricoh-gr-iiix.png"],
    ["Apple", "iPhone 14 Pro", "iPhone 14 Pro", "iphone-14-pro.svg"],
  ]) {
    const identity = cameraIdentity(metadata(brand, model));
    assert.equal(identity.model, label);
    assert.equal(identity.modelLogo.src, `/camera-logos/${file}`);
    await access(new URL(`../public${identity.modelLogo.src}`, import.meta.url));
    if (identity.brandLogo) await access(new URL(`../public${identity.brandLogo.src}`, import.meta.url));
  }
});

test("legacy and new FM records show the same equipment and independent film info", () => {
  const legacy = metadata("Nikon FM", "FUJI C200 · FUJI SP-3000");
  const snapshot = structuredClone(legacy);
  const next = { ...metadata("Nikon", "FM"), film: { stock: "FUJI C200", scanner: "FUJI SP-3000" } };
  assert.deepEqual(cameraIdentity(legacy), cameraIdentity(next));
  assert.deepEqual(legacy, snapshot);
  assert.equal(cameraIdentity(next).brandLogo.src, "/camera-logos/nikon-1968.jpg");
});

test("unknown models retain text and never borrow an unrelated model logo", () => {
  assert.equal(cameraIdentity(metadata("SONY", "ILCE-1")).modelLogo, undefined);
  assert.equal(cameraIdentity(metadata("FUJIFILM", "X-T5")).brandLogo, undefined);
  assert.equal(cameraIdentity(metadata("Nikon", "Z6")).brandLogo, undefined);
  assert.equal(cameraIdentity({}).modelLogo, undefined);
});
