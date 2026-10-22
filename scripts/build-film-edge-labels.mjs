// Pre-render one small native HDR image per complete edge label, not per letter.
// Run: node scripts/build-film-edge-labels.mjs (requires ultrahdr_app; Swift on macOS).
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

const code = ts.transpileModule(await readFile(new URL('../src/utils/filmGlyphs.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { filmGlyphs, FILM_EDGE_HDR_LABELS } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const temp = await mkdtemp(path.join(tmpdir(), 'film-edge-labels-'));
const unit = 16;
const labels = [];
try {
  for (const [text, imageUrl] of Object.entries(FILM_EDGE_HDR_LABELS)) {
    const columns = [...text].length * 6 - 1;
    const width = columns * unit;
    const height = 7 * unit;
    const circles = [...text].flatMap((letter, index) =>
      (filmGlyphs[letter] ?? []).flatMap((row, y) => [...row].flatMap((dot, x) => dot === '1'
        ? [`<circle cx="${index * 6 + x + 0.5}" cy="${y + 0.5}" r="0.42"/>`] : [])),
    ).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${columns} 7"><defs><radialGradient id="ink"><stop stop-color="#ffcd36"/><stop offset=".55" stop-color="#ffbe24"/><stop offset="1" stop-color="#e87f0d"/></radialGradient></defs><rect width="100%" height="100%" fill="#000"/><g fill="url(#ink)">${circles}</g></svg>`;
    const base = path.join(temp, 'base.jpg');
    const gain = path.join(temp, 'gain.jpg');
    const config = path.join(temp, 'gain.cfg');
    const output = path.join(temp, 'label.jpg');
    await sharp(Buffer.from(svg)).withIccProfile('srgb').jpeg({ quality: 90, chromaSubsampling: '4:4:4', progressive: true }).toFile(base);
    await sharp({ create: { width: columns, height: 7, channels: 3, background: '#fff' } }).jpeg({ quality: 100, chromaSubsampling: '4:4:4' }).toFile(gain);
    await writeFile(config, '--maxContentBoost 4 4 4\n--minContentBoost 1 1 1\n--gamma 1 1 1\n--offsetSdr 0 0 0\n--offsetHdr 0 0 0\n--hdrCapacityMin 1\n--hdrCapacityMax 4\n--useBaseColorSpace 1\n');
    execFileSync('ultrahdr_app', ['-m', '0', '-i', base, '-g', gain, '-f', config, '-z', output], { stdio: 'pipe' });
    const bytes = compatibleGlyphGainmap(await readFile(output));
    await writeFile(output, bytes);
    const native = process.platform === 'darwin'
      ? JSON.parse(execFileSync('swift', [fileURLToPath(new URL('./verify-film-edge-hdr.swift', import.meta.url)), output], { encoding: 'utf8' })) : {};
    const target = new URL(`../public${imageUrl}`, import.meta.url);
    await mkdir(new URL('.', target), { recursive: true });
    await writeFile(target, bytes);
    labels.push({ text, imageUrl, width, height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), ...native });
  }
  const manifest = { unit, hdrBoost: 4, labels };
  await writeFile(new URL('../public/film-edge/labels/manifest.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify({ labels: labels.length, totalBytes: labels.reduce((sum, label) => sum + label.bytes, 0), maxPixels: Math.max(...labels.map(label => label.width * label.height)) }));
} finally {
  assert(path.basename(temp).startsWith('film-edge-labels-'));
  await rm(temp, { recursive: true });
}
