// Code-native dot glyphs encoded once as a native JPEG HDR atlas. No photo is altered.
// Rebuild with: node scripts/build-film-edge-hdr.mjs (requires ultrahdr_app).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ts from 'typescript';
import { compatibleGlyphGainmap } from './jpeg-gainmap.mjs';

const module = ts.transpileModule(await readFile(new URL('../src/utils/filmGlyphs.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { filmGlyphs, FILM_GLYPH_ORDER: order, FILM_GLYPH_COLUMNS: columns, FILM_GLYPH_ROWS: rows, FILM_EDGE_HDR_SRC: imageUrl } = await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
const unit = 32;
const width = columns * 6 * unit;
const height = rows * 8 * unit;
const circles = [...order].flatMap((letter, index) =>
  filmGlyphs[letter].flatMap((row, y) => [...row].flatMap((dot, x) => dot === '1'
    ? [`<circle cx="${index % columns * 6 + x + 0.5}" cy="${Math.floor(index / columns) * 8 + y + 0.5}" r="0.42"/>`]
    : [])),
).join('');
// Sampled reference: bright border pixels cluster around RGB(254,181,30).
// Keep the amber body and warmer rim, with a brighter golden center, not a white glow.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${columns * 6} ${rows * 8}"><defs><radialGradient id="ink"><stop stop-color="#ffcd36"/><stop offset=".55" stop-color="#ffbe24"/><stop offset="1" stop-color="#e87f0d"/></radialGradient></defs><rect width="100%" height="100%" fill="#000"/><g fill="url(#ink)">${circles}</g></svg>`;
const target = new URL('../public/film-edge/', import.meta.url);
const temp = await mkdtemp(path.join(tmpdir(), 'film-edge-hdr-'));
try {
  const base = path.join(temp, 'base.jpg');
  const gain = path.join(temp, 'gain.jpg');
  const config = path.join(temp, 'gain.cfg');
  const output = path.join(temp, 'glyphs-hdr.jpg');
  await sharp(Buffer.from(svg)).withIccProfile('srgb').jpeg({ quality: 90, chromaSubsampling: '4:4:4', progressive: true, optimiseCoding: true }).toFile(base);
  await sharp({ create: { width: columns * 6, height: rows * 8, channels: 3, background: '#fff' } }).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toFile(gain);
  await writeFile(config, '--maxContentBoost 4 4 4\n--minContentBoost 1 1 1\n--gamma 1 1 1\n--offsetSdr 0 0 0\n--offsetHdr 0 0 0\n--hdrCapacityMin 1\n--hdrCapacityMax 4\n--useBaseColorSpace 1\n');
  execFileSync('ultrahdr_app', ['-m', '0', '-i', base, '-g', gain, '-f', config, '-z', output], { encoding: 'utf8' });
  await writeFile(output, compatibleGlyphGainmap(await readFile(output)));
  const probe = execFileSync('ultrahdr_app', ['-m', '1', '-j', output, '-P'], { encoding: 'utf8' });
  assert.match(probe, /Ultra HDR Image: Yes/);
  assert.match(probe, /--maxContentBoost 4(?: 4 4)?\n/);
  execFileSync('ultrahdr_app', ['-m', '1', '-j', output, '-o', '1', '-O', '5', '-z', '/dev/null'], { encoding: 'utf8' });
  const native = process.platform === 'darwin'
    ? JSON.parse(execFileSync('swift', [fileURLToPath(new URL('./verify-film-edge-hdr.swift', import.meta.url)), output], { encoding: 'utf8' }))
    : {};
  const bytes = await readFile(output);
  await mkdir(target, { recursive: true });
  await writeFile(new URL(path.basename(imageUrl), target), bytes);
  const manifest = {
    glyphs: order, columns, rows, unit, width, height, cellWidth: 6, cellHeight: 8, glyphWidth: 5, glyphHeight: 7,
    hdrBoost: 4, hdrCapacityMin: 1, hdrCapacityMax: 4,
    referenceInkMedian: [254, 181, 30], bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    nativeHdrDecodeVerified: true, imageUrl, ...native,
  };
  await writeFile(new URL('glyphs-hdr.json', target), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest));
} finally {
  assert(path.basename(temp).startsWith('film-edge-hdr-'));
  await rm(temp, { recursive: true });
}
