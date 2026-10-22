import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const filmPage = await readFile(new URL("../src/routes/FilmPage.tsx", import.meta.url), "utf8");
const root = await readFile(new URL("../src/routes/Root.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles/globals.css", import.meta.url), "utf8");

test("film page uses an independent contact-sheet layout without location descriptions", () => {
  assert(!filmPage.includes("PhotoMasonry"));
  assert(!filmPage.includes("metadata.city"));
  assert(!filmPage.includes("description"));
  assert.match(filmPage, /film-sprockets/);
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
  assert.match(filmPage, /preloadFilmImage\(mediumFile\.url\)/);
  assert.match(filmPage, /new IntersectionObserver/);
  assert.match(filmPage, /setPreviewUrl\(mediumFile\.url\)/);
});
