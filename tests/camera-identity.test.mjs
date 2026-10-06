import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const source = await readFile(new URL("../src/utils/cameraIdentity.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const identityUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const { cameraIdentity } = await import(identityUrl);
const metadata = (name, model) => ({ camera: { manufacture: { name }, model } });

test("known camera EXIF models resolve to the correct local wordmarks", async () => {
  for (const [brand, model, label, file, field] of [
    ["SONY", "ILCE-7M4", "α7 IV", "sony-alpha.svg", "modelLogo"],
    ["SONY", "ILCE-7CM2", "α7C II", "sony-alpha.svg", "modelLogo"],
    ["RICOH IMAGING COMPANY, LTD.", "RICOH GR IIIx", "GR IIIx", "ricoh.svg", "brandLogo"],
    ["Apple", "iPhone 14 Pro", "iPhone 14 Pro", "iphone-14-pro.svg", "modelLogo"],
  ]) {
    const identity = cameraIdentity(metadata(brand, model));
    assert.equal(identity.model, label);
    assert.equal(identity[field].src, `/camera-logos/${file}`);
    await access(new URL(`../public${identity[field].src}`, import.meta.url));
    if (identity.brandLogo) await access(new URL(`../public${identity.brandLogo.src}`, import.meta.url));
  }
});

test("Sony uses the reference alpha composition and matching symbol heights", () => {
  for (const [model, suffix] of [["ILCE-7M4", "7 IV"], ["ILCE-7CM2", "7C II"]]) {
    const identity = cameraIdentity(metadata("SONY", model));
    assert.equal(identity.brandLogo.height, 11.2);
    assert.equal(identity.modelLogo.height, identity.brandLogo.height);
    assert.equal(identity.modelLogo.label, "α");
    assert.equal(identity.modelLogo.suffix, suffix);
    assert.equal(identity.modelLogo.preserveColor, true);
  }
});

test("Ricoh uses the selected official mark and a brand-free model name", () => {
  const identity = cameraIdentity(metadata("RICOH", "GR IIIx"));
  assert.equal(identity.brandLogo.src, "/camera-logos/ricoh.svg");
  assert.equal(identity.brandLogo.height, 11.2);
  assert.equal(identity.brandLogo.preserveColor, true);
  assert.equal(identity.modelLogo, undefined);
  assert.equal(identity.model, "GR IIIx");
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

const componentSource = ts.transpileModule(await readFile(new URL("../src/components/CameraIdentity.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText
  .replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replaceAll('"react"', JSON.stringify(import.meta.resolve("react")))
  .replaceAll('"react-icons/si"', JSON.stringify(import.meta.resolve("react-icons/si")))
  .replaceAll('"../utils/cameraIdentity"', JSON.stringify(identityUrl));
const { default: CameraIdentity } = await import(`data:text/javascript;base64,${Buffer.from(componentSource).toString("base64")}`);

test("rendered Ricoh row contains one selected logo and plain model text", () => {
  const html = renderToStaticMarkup(React.createElement(CameraIdentity, { metadata: metadata("RICOH", "GR IIIx") }));
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.match(html, /alt="RICOH"/);
  assert.match(html, /src="\/camera-logos\/ricoh\.svg"/);
  assert.match(html, />GR IIIx<\/span>/);
  assert(!html.includes('/camera-logos/ricoh.png'));
  assert(!html.includes('/camera-logos/ricoh-gr-iiix.png'));
});

test("rendered Sony row uses alpha + model text with equal-height symbols", () => {
  const html = renderToStaticMarkup(React.createElement(CameraIdentity, { metadata: metadata("SONY", "ILCE-7M4") }));
  assert.equal((html.match(/<img /g) || []).length, 2);
  assert.equal((html.match(/height="11.2"/g) || []).length, 2);
  assert.match(html, /sony-alpha\.svg/);
  assert.match(html, />7 IV<\/span>/);
  assert(!html.includes('/camera-logos/sony-a7iv.svg'));
});
