import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { splitGainmap, jpegHeaders } from "../scripts/jpeg-gainmap.mjs";

const css = await readFile(new URL("../src/styles/globals.css", import.meta.url), "utf8");
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const glyphCode = ts.transpileModule(await readFile(new URL('../src/utils/filmGlyphs.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const glyphUrl = dataUrl(glyphCode);
const { FILM_EDGE_HDR_SRC, FILM_GLYPH_ORDER, FILM_GLYPH_COLUMNS, FILM_GLYPH_ROWS } = await import(glyphUrl);
const source = ts.transpileModule(await readFile(new URL("../src/components/FilmEdgeMark.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replaceAll('"react"', JSON.stringify(import.meta.resolve('react')))
  .replaceAll('"../utils/filmGlyphs"', JSON.stringify(glyphUrl))
  .replaceAll('"../contexts/HdrContext"', JSON.stringify(dataUrl('export const useHdr = () => ({ enabled: globalThis.__testEdgeHdr === true });')));
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

test('HDR labels use one shared native gain-map image and retain vectors until DOM decode completes', t => {
  t.after(() => delete globalThis.__testEdgeHdr);
  globalThis.__testEdgeHdr = false;
  assert(!renderToStaticMarkup(React.createElement(FilmEdgeMark, { text: 'FUJI' })).includes('<img'));
  globalThis.__testEdgeHdr = true;
  const html = renderToStaticMarkup(React.createElement(FilmEdgeMark, { text: 'FUJI RDP III' }));
  assert.match(html, /data-edge-hdr-ready="false"/);
  assert.match(html, /data-hdr-active="true"/);
  const urls = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(urls).size, 1);
  assert.equal(urls[0], FILM_EDGE_HDR_SRC);
  assert.match(css, /\.film-edge-hdr-cell img\s*\{[^}]*dynamic-range-limit:\s*no-limit/);
  assert(!css.includes('filter: drop-shadow(0 0 0.35px'), 'CSS glow is not a substitute for HDR output');
});

test('LED, photo and edge layers share a reversible 600ms fade without hiding the opaque fallback', () => {
  for (const selector of ['.film-edge-hdr', '.film-hdr-light', '.buffered-photo .buffered-photo-layer']) {
    const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    assert.match(rule, /transition:\s*opacity 600ms ease-in-out/);
  }
  assert(!css.includes('.buffered-photo-layer { transition: none !important; }'));
  assert(!css.includes('> .film-edge-dots {\n  visibility: hidden;'), 'SDR lettering remains visible beneath the native HDR fade');
});

test('HDR atlas matches every glyph and contains compatible ISO plus legacy Adobe metadata', async () => {
  const bytes = await readFile(new URL(`../public${FILM_EDGE_HDR_SRC}`, import.meta.url));
  const manifest = JSON.parse(await readFile(new URL('../public/film-edge/glyphs-hdr.json', import.meta.url)));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), manifest.sha256);
  assert(bytes.length < 512 * 1024, 'all film lettering shares a sub-512 KiB atlas');
  assert.equal(manifest.glyphs, FILM_GLYPH_ORDER);
  assert.equal(manifest.columns, FILM_GLYPH_COLUMNS);
  assert.equal(manifest.rows, FILM_GLYPH_ROWS);
  assert(manifest.hdrPeakLuminance > 1.5);
  assert(manifest.hdrPeakLuminance / manifest.sdrPeakLuminance > 3.5);
  const { base, gain } = splitGainmap(bytes);
  const info = await sharp(base).metadata();
  assert.equal(info.width, manifest.width);
  assert.equal(info.height, manifest.height);
  assert(info.icc?.length);
  assert(bytes.includes(Buffer.from('http://ns.adobe.com/hdr-gain-map/1.0/')));
  const prefix = Buffer.from('urn:iso:std:iso:ts:21496:-1\0');
  const metadata = jpegHeaders(gain).find(segment => segment.payload.subarray(0, prefix.length).equals(prefix));
  assert(metadata);
  assert.equal(metadata.payload[prefix.length + 4], 0xc0, 'version 0 must not set the reserved common-denominator bit');
});

test('native ImageIO actually decodes HDR lettering above SDR white', { skip: process.platform !== 'darwin' }, () => {
  const output = execFileSync('swift', [new URL('../scripts/verify-film-edge-hdr.swift', import.meta.url).pathname, new URL(`../public${FILM_EDGE_HDR_SRC}`, import.meta.url).pathname], { encoding: 'utf8' });
  const result = JSON.parse(output);
  assert(result.appleHdrDecodeVerified);
  assert(result.headroom >= 3.9);
  assert(result.hdrPeakLuminance > 1.5);
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
