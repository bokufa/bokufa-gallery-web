import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const css = await readFile(new URL("../src/styles/globals.css", import.meta.url), "utf8");
const source = ts.transpileModule(await readFile(new URL("../src/components/FilmEdgeMark.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")));
const { default: FilmEdgeMark } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("all edge lettering, including FUJI, retains crisp vector dots and inherits the table ink", () => {
  for (const text of ["FUJI", "RDP III", "FUJICOLOR C200", "▶ RDP III"]) {
    const html = renderToStaticMarkup(React.createElement(FilmEdgeMark, { text }));
    assert.match(html, /fill="currentColor"/);
    assert.match(html, /<circle /);
    assert(!html.includes("<canvas"));
    assert(!html.includes("<filter"));
  }
  assert.match(css, /\.film-frame\s*\{[^}]*color:\s*var\(--film-edge-ink,/);
});

test("HDR brightens saturated orange-yellow ink in both the table and inherited loupe scene", () => {
  const normal = css.match(/\.film-canvas\s*\{[^}]*--film-edge-ink:\s*(#[a-f\d]{6})/i)?.[1];
  const hdr = css.match(/\.film-canvas\[data-hdr-enabled="true"\]\s*\{[^}]*--film-edge-ink:\s*(#[a-f\d]{6})/i)?.[1];
  assert(normal && hdr);
  const channels = hex => [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16));
  const baseline = channels(normal);
  const bright = channels(hdr);
  for (const [red, green, blue] of [baseline, bright]) {
    assert((red - blue) / red > 0.65, "ink stays saturated instead of turning pale cream");
    const hue = 60 * (green - blue) / (red - blue);
    assert(hue > 30 && hue < 45, "both modes retain an orange-yellow hue");
  }
  assert(baseline[0] > baseline[1] && baseline[1] > baseline[2], "normal ink remains warm yellow");
  assert(bright.every((value, index) => value > baseline[index]), "HDR raises every channel without darkening the ink");
  assert(bright[0] > bright[1] && bright[1] > bright[2], "HDR stays warm rather than becoming neutral white");
});
