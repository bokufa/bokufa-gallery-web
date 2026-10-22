import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const filmPage = await readFile(new URL("../src/routes/FilmPage.tsx", import.meta.url), "utf8");
const root = await readFile(new URL("../src/routes/Root.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles/globals.css", import.meta.url), "utf8");
const board = await readFile(new URL("../src/components/FilmBoardSurface.tsx", import.meta.url), "utf8");

test("film page uses an independent contact-sheet layout without location descriptions", () => {
  assert(!filmPage.includes("PhotoMasonry"));
  assert(!filmPage.includes("metadata.city"));
  assert(!filmPage.includes("description"));
  assert.match(filmPage, /format === "135" \? <FilmStripBase portrait=\{portrait\}/);
  assert.match(filmPage, /film-edge-copy/);
  assert.match(filmPage, /film-contact-grid/);
});

test("film page receives the LED table and the same floating chrome as the map", () => {
  assert.match(root, /const isFloatingSection = isMapSection \|\| isFilmRoute/);
  assert.match(root, /film-light-table/);
  assert.match(root, /isFilmRoute \? 'film-layout-shell'/);
  assert.match(styles, /\.film-light-table/);
  assert.match(styles, /\.film-layout-shell/);
  assert.match(root, /isFilmRoute \? 'film-floating-sidebar'/);
  assert.match(styles, /\.film-floating-sidebar/);
  assert.match(styles, /left: max\(0px, calc\(\(100vw - 1024px\) \/ 2\)\)/);
  assert(!styles.includes(".film-frame-featured"));
  assert(!filmPage.includes("const scatter"));
  assert(!styles.includes("scale(1.018)"));
  assert(!styles.includes("scale(1.012)"));
  assert.match(filmPage, /photo\.thumb_file\.url/);
  assert.match(filmPage, /preloadPhotoSource\(preview\.url, 0\)/);
  assert.match(filmPage, /useFilmVisibility\(frameRef\)/);
  assert.match(filmPage, /filmPreviewFile\(photo, hdrEnabled\)/);
  assert.match(filmPage, /suspend=\{!visible \|\| compact\}/);
  assert.match(filmPage, /visible && !compact && detailSelected/);
  assert.match(filmPage, /setPreviewUrl\(preview\.url\)/);
  assert(!filmPage.includes('preloadPhotoSource(photo.hdr_file'), 'board must never preload the full HDR source');
});

test('map and film controls share the same bottom-center placement and frosted surface', async () => {
  const shared = await readFile(new URL('../src/components/FloatingControls.tsx', import.meta.url), 'utf8');
  const map = await readFile(new URL('../src/components/MapViewSwitcher.tsx', import.meta.url), 'utf8');
  const film = await readFile(new URL('../src/components/FilmCanvas.tsx', import.meta.url), 'utf8');
  assert.match(shared, /bottom-\[calc\(1\.5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(shared, /inset-x-0[^`]*justify-center/);
  assert.match(shared, /bg-content1\/80 shadow-medium backdrop-blur-md/);
  assert.match(map, /<FloatingControls/);
  assert.match(map, /tabList: floatingControlSurface/);
  assert.match(film, /<FloatingControls>/);
  assert.match(film, /film-canvas-controls[^`]*floatingControlSurface/);
  const rule = styles.match(/\.film-canvas-controls\s*\{([^}]+)\}/)?.[1];
  assert(!/right:|bottom:|box-shadow:|border:/.test(rule), 'film controls must not override the shared map positioning/surface');
});

test("every film-page visit fades the mounted table, including cached returns and delayed photo loads", () => {
  const canvas = styles.match(/\.film-contact-page > \.film-canvas\s*\{([^}]+)\}/)?.[1];
  assert.match(canvas, /animation:\s*film-page-enter 600ms ease-in-out backwards/);
  assert(!canvas.includes("forwards"), "do not retain an opacity compositing layer over native HDR after entry");
  const keyframes = styles.match(/@keyframes film-page-enter\s*\{([\s\S]*?)\n\}/)?.[1];
  assert.match(keyframes, /from\s*\{\s*opacity: 0/);
  assert.match(keyframes, /to\s*\{\s*opacity: 1/);
  assert(!/filter|transform/.test(keyframes), "entry must not blur HDR pixels or disturb drag coordinates");
  assert.match(filmPage, /photos\.length \? \(\s*<FilmCanvas>/, "start the entry on actual canvas mount, not on an earlier loading placeholder");
  assert(!filmPage.includes("<FilmCanvas key="), "HDR and image updates must not remount the animated canvas");
  assert.match(root, /film-light-table[^`]*duration-\[600ms\] ease-in-out/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.film-contact-page > \.film-canvas\s*\{\s*animation: none/);
});

test("the full board uses bounded canvas textures instead of viewport-sized CSS raster layers", () => {
  assert.match(board, /FILM_BOARD_TEXTURE_SIZE = 1024/);
  assert.match(board, /paintBoard\(sdrRef\.current, "sdr"\)/);
  assert.match(board, /paintBoard\(hdrRef\.current, "hdr"\)/);
  assert.match(styles, /\.film-board-surface/);
  assert.match(styles, /\.film-board-texture-sdr/);
  assert.match(styles, /\.film-board-texture-hdr/);
  assert(!styles.includes(".film-canvas-content::before"));
  assert(!styles.includes(".film-canvas-content::after"));
});
