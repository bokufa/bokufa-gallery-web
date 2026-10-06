import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const source = ts.transpileModule(await readFile(new URL("../src/components/FilmInfo.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText
  .replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replaceAll('"react"', JSON.stringify(import.meta.resolve("react")));
const filmInfoUrl = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const { default: FilmInfo } = await import(filmInfoUrl);
const render = film => renderToStaticMarkup(React.createElement(FilmInfo, { stock: film.stock }));

test("C200 displays the complete selected image after a separator without field labels", () => {
  const html = render({ stock: "FUJI C200", scanner: "FUJI SP-3000" });
  assert.match(html, /src="\/film-logos\/fujicolor-c200\.jpg"/);
  assert.match(html, /alt="FUJIFILM FUJICOLOR C200"/);
  assert.match(html, /width="817" height="459"/);
  assert.match(html, /object-contain/);
  assert(!html.includes("object-cover"));
  assert(html.includes("｜"));
  assert(!html.includes("扫描"));
  assert(!html.includes("胶片"));
  assert(!html.includes("FUJI SP-3000"));
});

test("brand aliases are recognized but other film stocks are never mislabeled", () => {
  for (const stock of ["FUJIFILM C200", "FUJICOLOR C200", "fuji c200"]) assert.match(render({ stock }), /fujicolor-c200\.jpg/);
  for (const stock of ["FUJI 200", "FUJI C400", "KODAK GOLD 200"]) {
    const html = render({ stock, scanner: "FUJI SP-3000" });
    assert(!html.includes("<img"));
    assert(html.includes(stock));
    assert(!html.includes("胶片"));
    assert(!html.includes("扫描"));
  }
});

test("missing stock does not render a stock label or dangling separator", () => {
  assert.equal(render({}), "");
  const html = render({ scanner: "FUJI SP-3000" });
  assert.equal(html, "");
});

test("the bundled image exactly matches the full preview the user selected", async () => {
  const data = await readFile(new URL("../public/film-logos/fujicolor-c200.jpg", import.meta.url));
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(data).digest("hex");
  // Dimensions are verified above; a stable hash guards against later crops.
  assert.equal(data.length, 107524);
  assert.equal(hash, "b333af32fa2fbf69464b74573cd8ca548a5184489f1decc8d2934b4b25f7f19c");
});

async function compile(path, replacements = {}) {
  let compiled = ts.transpileModule(await readFile(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  for (const [from, to] of Object.entries({
    "react/jsx-runtime": import.meta.resolve("react/jsx-runtime"),
    "react": import.meta.resolve("react"),
    ...replacements,
  })) compiled = compiled.replaceAll(JSON.stringify(from), JSON.stringify(to));
  return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
}
const identityUrl = await compile("../src/utils/cameraIdentity.ts");
const cameraUrl = await compile("../src/components/CameraIdentity.tsx", {
  "../utils/cameraIdentity": identityUrl,
  "react-icons/si": import.meta.resolve("react-icons/si"),
});
const cardUrl = await compile("../src/components/PhotoMetaCard.tsx", {
  "@heroui/react": import.meta.resolve("@heroui/react"),
  "../utils/cameraIdentity": identityUrl,
  "./CameraIdentity": cameraUrl,
  "./FilmInfo": filmInfoUrl,
});
const { default: PhotoMetaCard } = await import(cardUrl);

test("the actual photo card shows Nikon, the full C200 image, lens and scanner for both metadata formats", () => {
  for (const metadata of [
    { camera: { manufacture: { name: "Nikon FM" }, model: "FUJI C200 · FUJI SP-3000" } },
    { camera: { manufacture: { name: "Nikon" }, model: "FM" }, film: { stock: "FUJI C200", scanner: "FUJI SP-3000" } },
  ]) {
    const photo = { metadata: { ...metadata, lens: { manufacture: { name: "Nikon" }, model: "AI Nikkor 50mm f/1.4S" }, photographic_sensitivity: 200, f_number: 1.4, exposure_time_rat: "1/1000", focal_length: 50 } };
    const html = renderToStaticMarkup(React.createElement(PhotoMetaCard, { photo, loading: false }));
    for (const text of ["/camera-logos/nikon.svg", "/film-logos/fujicolor-c200.jpg", "AI Nikkor 50mm f/1.4S", "FUJI SP-3000", "ISO 200"]) assert(html.includes(text));
    assert(!html.includes("胶片"));
    assert(!html.includes("扫描"));
    const header = html.indexOf('data-photo-meta="camera"');
    const body = html.indexOf('data-photo-meta="lens"');
    const footer = html.indexOf('data-photo-meta="exposure"');
    const stock = html.indexOf('/film-logos/fujicolor-c200.jpg');
    const lens = html.indexOf('AI Nikkor 50mm f/1.4S');
    const scanner = html.indexOf('FUJI SP-3000');
    assert(header >= 0 && header < stock && stock < body, "stock belongs after the camera in the header");
    assert(body < lens && lens < scanner && scanner < footer, "scanner belongs after the lens in the body");
    assert.equal((html.match(/｜/g) || []).length, 2);
  }
});

test("scanner-only metadata uses normal lens-row type and preserves a single separator", () => {
  const photo = { metadata: { camera: { manufacture: { name: "Nikon" }, model: "FM" }, lens: { manufacture: { name: "Nikon" }, model: "AI Nikkor 50mm f/1.4S" }, film: { scanner: "FUJI SP-3000" } } };
  const html = renderToStaticMarkup(React.createElement(PhotoMetaCard, { photo, loading: false }));
  assert(html.includes("FUJI SP-3000"));
  assert(!html.includes("/film-logos/"));
  assert(!html.includes("text-xs"));
  assert.equal((html.match(/｜/g) || []).length, 1);
});
