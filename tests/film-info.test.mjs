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

test("C200 displays the new complete square image after a separator without field labels", () => {
  const html = render({ stock: "FUJI C200", scanner: "FUJI SP-3000" });
  assert.match(html, /src="\/film-logos\/fujicolor-c200\.webp"/);
  assert.match(html, /alt="FUJIFILM Fujicolor C200"/);
  assert.match(html, /width="160" height="160"/);
  assert.match(html, /object-contain/);
  assert(!html.includes("object-cover"));
  assert(html.includes("｜"));
  assert(!html.includes("扫描"));
  assert(!html.includes("胶片"));
  assert(!html.includes("FUJI SP-3000"));
});

test("all supplied stocks and their common aliases resolve to the right image", () => {
  for (const stock of ["FUJIFILM C200", "FUJICOLOR C200", "fuji c200"]) assert.match(render({ stock }), /fujicolor-c200\.webp/);
  for (const stock of ["Kodak Portra 160", "PORTRA160"]) assert.match(render({ stock }), /kodak-portra-160\.webp/);
  for (const stock of ["Kodak Portra 400", "PORTRA 400"]) assert.match(render({ stock }), /kodak-portra-400\.webp/);
  for (const stock of ["FUJI COLOR 100", "FUJICOLOR100", "Fujifilm 100"]) assert.match(render({ stock }), /fujicolor-100\.webp/);
  for (const stock of ["FUJI PROVIA 100F", "FUJICHROME PROVIA 100F", "Provia100F"]) assert.match(render({ stock }), /fujichrome-provia-100f\.webp/);
});

test("unknown film stocks are never mislabeled", () => {
  for (const stock of ["FUJI 200", "FUJI C400", "KODAK GOLD 200", "PROVIA 400F"]) {
    const html = render({ stock, scanner: "FUJI SP-3000" });
    assert(!html.includes("<img"));
    assert(html.includes(stock));
    assert(!html.includes("胶片"));
    assert(!html.includes("扫描"));
  }
});

test("the full film image fits the 20px metadata line without enlarging it", () => {
  const html = render({ stock: "FUJI C200" });
  const image = html.match(/<img\b[^>]*>/)?.[0];
  assert(image);
  assert.match(image, /class="[^"]*\bh-5\b[^"]*\bw-auto\b/);
  assert(!image.includes("h-auto"));
  assert(!image.includes("w-24"));
  assert.match(html, /inline-flex h-5 items-center/);
  assert.match(image, /object-contain/);
});

test("missing stock does not render a stock label or dangling separator", () => {
  assert.equal(render({}), "");
  const html = render({ scanner: "FUJI SP-3000" });
  assert.equal(html, "");
});

test("all bundled images exactly match the complete files supplied by the user", async () => {
  const { createHash } = await import("node:crypto");
  const assets = {
    "kodak-portra-160.jpg": [774739, "8af72bbbc76afc6741bfba82d3d7e4b0768aaef3aa0ac430d57ef81971df7d2f"],
    "kodak-portra-400.jpg": [779152, "47d84ee83e57156c2d671f54080f4fd6dd03b02198667ab2cdf1825f8979c43a"],
    "fujicolor-c200.jpg": [1877178, "69a6d7818db551f6a4a35cfa57d16a5624e5a2387eedc5f900c6585642cc17e1"],
    "fujicolor-100.jpg": [1169551, "11a343e144b3c98daa1367aec29df57ae265ba5491f9198c62645f13c39b7bf3"],
    "fujichrome-provia-100f.jpg": [923048, "755cb124832c13b518640ee9b7ae58ca28c4df01b3197beade828080e590a4a0"],
  };

  for (const [name, [size, expectedHash]] of Object.entries(assets)) {
    const data = await readFile(new URL(`../public/film-logos/${name}`, import.meta.url));
    assert.equal(data.length, size, `${name} keeps its original byte length`);
    assert.equal(createHash("sha256").update(data).digest("hex"), expectedHash, `${name} is unchanged`);
  }
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
    for (const text of ["/camera-logos/nikon.svg", "/film-logos/fujicolor-c200.webp", "AI Nikkor 50mm f/1.4S", "FUJI SP-3000", "ISO 200"]) assert(html.includes(text));
    assert(!html.includes("胶片"));
    assert(!html.includes("扫描"));
    const header = html.indexOf('data-photo-meta="camera"');
    const body = html.indexOf('data-photo-meta="lens"');
    const footer = html.indexOf('data-photo-meta="exposure"');
    const stock = html.indexOf('/film-logos/fujicolor-c200.webp');
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
