import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import ts from 'typescript';

const source = ts.transpileModule(await readFile(new URL('../src/components/FilmStripBase.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText.replaceAll('"react/jsx-runtime"', JSON.stringify(import.meta.resolve('react/jsx-runtime')));
const { default: FilmStripBase, filmPerforations } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const css = await readFile(new URL('../src/styles/globals.css', import.meta.url), 'utf8');

test('135 contains sixteen genuine transparent holes in a pure black strip, in both orientations', async () => {
  for (const portrait of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(FilmStripBase, { portrait }));
    assert.match(html, /fill-rule="evenodd"/);
    assert(!html.includes('<mask'), 'no duplicate mask IDs when the loupe clones a frame');
    const width = portrait ? 350 : 380;
    const height = portrait ? 380 : 350;
    const { data, info } = await sharp(Buffer.from(html)).resize(width, height).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
    assert.deepEqual(pixel(Math.floor(width / 2), Math.floor(height / 2)), [0, 0, 0, 255]);
    const holes = filmPerforations(portrait);
    assert.equal(holes.length, 16);
    for (const hole of holes) {
      assert.equal(pixel(Math.round((hole.x + hole.width / 2) * 10), Math.round((hole.y + hole.height / 2) * 10))[3], 0, 'the light board must be visible, not an opaque white patch');
      assert.equal(hole.width * hole.height, 5.6);
    }
  }
  assert.match(css, /\.film-frame-135\s*\{\s*background:\s*transparent/);
  assert(!css.includes('.film-sprockets > span'));
});

test('perforations rotate with portrait film without intersecting the image window', () => {
  for (const portrait of [false, true]) {
    const frame = { width: portrait ? 35 : 38, height: portrait ? 38 : 35 };
    const image = { width: portrait ? 24 : 36, height: portrait ? 36 : 24 };
    const left = (frame.width - image.width) / 2;
    const top = (frame.height - image.height) / 2;
    for (const hole of filmPerforations(portrait)) {
      assert(hole.x > 0 && hole.y > 0 && hole.x + hole.width < frame.width && hole.y + hole.height < frame.height);
      assert(hole.x + hole.width < left || hole.x > left + image.width || hole.y + hole.height < top || hole.y > top + image.height);
    }
  }
});

test('loupe perforations reveal their own static HDR light surface without adding drag work', async () => {
  const source = await readFile(new URL('../src/components/FilmLoupe.tsx', import.meta.url), 'utf8');
  assert.match(source, /className="film-loupe-glass"[\s\S]*?<HdrLightPanel\s*\/>/);
  assert.match(css, /\.film-loupe-scene::before,\s*\.film-loupe-scene::after\s*\{\s*display:\s*none/);
});
