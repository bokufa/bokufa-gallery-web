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
const overlay = await readFile(new URL("../src/components/FilmEdgeHdrOverlay.tsx", import.meta.url), "utf8");
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const glyphCode = ts.transpileModule(await readFile(new URL('../src/utils/filmGlyphs.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const glyphUrl = dataUrl(glyphCode);
const { FILM_EDGE_HDR_SRC, FILM_GLYPH_ORDER, FILM_GLYPH_COLUMNS, FILM_GLYPH_ROWS, FILM_EDGE_HDR_LABELS } = await import(glyphUrl);
const sourcesUrl = dataUrl(ts.transpileModule(await readFile(new URL('../src/utils/photoSources.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText);
const source = ts.transpileModule(await readFile(new URL("../src/components/FilmEdgeMark.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve("react/jsx-runtime")))
  .replaceAll('"react"', JSON.stringify(import.meta.resolve('react')))
  .replaceAll('"../utils/filmGlyphs"', JSON.stringify(glyphUrl))
  .replaceAll('"../utils/photoSources"', JSON.stringify(sourcesUrl))
  .replaceAll('"../contexts/HdrContext"', JSON.stringify(dataUrl('export const useHdr = () => ({ enabled: globalThis.__testEdgeHdr === true });')));
const { default: FilmEdgeMark } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("all edge lettering, including FUJI, retains crisp vector dots and inherits the table ink", () => {
  for (const text of ["FUJI", "RDP III", "FUJICOLOR C200", "▶ RDP III"]) {
    const html = renderToStaticMarkup(React.createElement(FilmEdgeMark, { text }));
    assert.match(html, /fill="currentColor"/);
    assert.match(html, /<circle /);
    assert.match(html, /width:calc\(var\(--film-mm\) \* [\d.]+\)/);
    assert(!html.includes("<canvas"));
    assert(!html.includes("<filter"));
  }
  assert.match(css, /\.film-frame\s*\{[^}]*color:\s*var\(--film-edge-ink,/);
});

test('HDR labels use one small whole-label image rather than an atlas image per character', t => {
  t.after(() => delete globalThis.__testEdgeHdr);
  globalThis.__testEdgeHdr = false;
  assert(!renderToStaticMarkup(React.createElement(FilmEdgeMark, { text: 'FUJI' })).includes('<img'));
  globalThis.__testEdgeHdr = true;
  const html = renderToStaticMarkup(React.createElement(FilmEdgeMark, { text: '▶ RDP III' }));
  assert.match(html, /data-edge-hdr-decoded="false"/);
  assert.match(html, /data-edge-hdr-ready="false"/);
  assert(!html.includes('data-edge-hdr-settled'));
  assert.match(html, /data-hdr-active="true"/);
  const urls = [...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map(match => match[1]);
  assert.equal(urls.length, 1);
  assert.equal(urls[0], FILM_EDGE_HDR_LABELS['▶ RDP III']);
  assert.match(html, /class="film-edge-hdr-layout"/);
  assert.match(css, /\.film-edge-hdr\s*\{[^}]*dynamic-range-limit:\s*no-limit/);
  assert(!html.includes(FILM_EDGE_HDR_SRC));
  assert(!renderToStaticMarkup(React.createElement(FilmEdgeMark, { text: 'FUJI', active: false })).includes('<img'), 'offscreen labels allocate no native HDR image');
  const unknown = renderToStaticMarkup(React.createElement(FilmEdgeMark, { text: 'UNKNOWN STOCK' }));
  assert(!unknown.includes('<img'), 'unknown film stock stays accurate using the vector fallback');
  assert(unknown.includes('<circle'));
  assert(!css.includes('filter: drop-shadow(0 0 0.35px'), 'CSS glow is not a substitute for HDR output');
});

test('complete-label HDR assets preserve the warm gain map with much smaller decoding surfaces', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/film-edge/labels/manifest.json', import.meta.url)));
  let total = 0;
  assert.equal(manifest.labels.length, Object.keys(FILM_EDGE_HDR_LABELS).length);
  for (const label of manifest.labels) {
    assert.equal(FILM_EDGE_HDR_LABELS[label.text], label.imageUrl);
    const bytes = await readFile(new URL(`../public${label.imageUrl}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), label.sha256);
    const {base, gain} = splitGainmap(bytes);
    const info = await sharp(base).metadata();
    assert.equal(info.width, (label.text.length * 6 - 1) * manifest.unit);
    assert.equal(info.height, 7 * manifest.unit);
    assert(info.width * info.height < 180000, 'no 2-megapixel atlas for a short label');
    assert(bytes.length < 64 * 1024);
    assert(label.hdrPeakLuminance > 1.5);
    assert(label.appleHdrDecodeVerified);
    const prefix = Buffer.from('urn:iso:std:iso:ts:21496:-1\0');
    const metadata = jpegHeaders(gain).find(segment => segment.payload.subarray(0, prefix.length).equals(prefix));
    assert.equal(metadata.payload[prefix.length + 4], 0xc0);
    total += bytes.length;
  }
  assert(total < 256 * 1024, 'all supported labels together are smaller than the old single atlas');
});

test('LED and photo layers fade while native HDR edge ink stays out of animated compositor surfaces', () => {
  for (const selector of ['.film-hdr-light', '.buffered-photo .buffered-photo-layer']) {
    const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    assert.match(rule, /transition:\s*opacity 600ms ease-in-out/);
  }
  const edgeRule = css.slice(css.indexOf('.film-edge-hdr {')).split('}')[0];
  assert.match(edgeRule, /visibility:\s*hidden/);
  assert(!edgeRule.includes('opacity:'));
  assert(!edgeRule.includes('transition:'));
  assert(!css.includes('.buffered-photo-layer { transition: none !important; }'));
  assert(!css.includes('> .film-edge-dots {\n  visibility: hidden;'), 'SDR lettering remains visible beneath the native HDR fade');
  const dotsRule = css.slice(css.indexOf('.film-edge-dots {')).split('}')[0];
  assert.match(dotsRule, /transition:\s*color 600ms ease-in-out/);
  assert(!dotsRule.includes('transition: opacity'), 'the vector may repaint its ink but must not create an opacity compositor surface');
  assert.match(css, /\.film-edge-label\[data-edge-hdr-ready="true"\] > \.film-edge-dots\s*\{[^}]*color:\s*rgb\(255 198 37 \/ 18%\)/s);
  assert(!css.includes('mix-blend-mode: plus-lighter'));
  const layoutRule = css.slice(css.indexOf('.film-edge-hdr-layout {')).split('}')[0];
  assert.match(layoutRule, /width:\s*100%/);
  assert.match(layoutRule, /height:\s*100%/);
  assert(!layoutRule.includes('transform:'), 'zoom-settle relayout must not rebuild an HDR label texture');
  assert(!css.slice(css.indexOf('.film-edge-label {')).split('}')[0].includes('isolation:'), 'the edge label must not force HDR and SVG into one offscreen group');
  assert.match(css, /\.film-edge-label\[data-edge-hdr-decoded="true"\] \.film-edge-hdr\s*\{\s*visibility:\s*visible/);
  assert(!css.includes('data-edge-hdr-settled'));
});

test('mobile edge HDR is mirrored outside the transformed film scene without layout reads during gestures', () => {
  assert.match(overlay, /className="film-edge-screen-overlay"/);
  assert.match(overlay, /className="film-edge-screen-canvas"/);
  assert.match(overlay, /mountHdrEdgeCanvas/);
  assert.match(overlay, /rendererRef\.current\?\.updateScene/);
  assert.match(overlay, /FILM_EDGE_HDR_LABELS/);
  assert.match(overlay, /worldLeft:/);
  assert.match(overlay, /worldTop:/);
  assert.match(overlay, /sceneChangedRef\.current = update/);
  assert.match(overlay, /const labels = new Map<HTMLElement, ManagedLabel>/);
  assert.match(overlay, /let label = labels\.get\(source\)/);
  assert.match(overlay, /const containsEdgeLabel =/);
  assert(!overlay.includes('attributeFilter: ["class"]'), 'photo quality and zoom class changes must not rebuild edge HDR');
  const update = overlay.slice(overlay.indexOf('const update = () => {'), overlay.indexOf('const remove ='));
  assert(!update.includes('getBoundingClientRect'), 'drag and pinch frames use cached world geometry');
  assert.match(css, /\.film-edge-screen-overlay\s*\{[^}]*position:\s*absolute[^}]*z-index:\s*2/s);
  assert.match(css, /data-edge-screen-managed="true"[\s\S]*> \.film-edge-hdr-layout[\s\S]*visibility:\s*hidden/);
  assert.match(css, /\.film-edge-screen-vector\s*\{[^}]*transition:\s*color 600ms ease-in-out/s);
  assert.match(css, /\.film-edge-screen-hdr\s*\{[^}]*dynamic-range-limit:\s*no-limit/s);
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
