import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const code = ts.transpileModule(
  await readFile(
    new URL("../src/utils/filmPhotoSources.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const {
  filmLoupeDetailFile,
  filmPreviewFile,
  filmSdrPreview,
  filmTableDetailFile,
  FILM_LOUPE_DETAIL_MAX_EDGE,
  FILM_PREVIEW_MAX_EDGE,
  FILM_TABLE_DETAIL_MAX_EDGE,
} = await import(
  `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
);
const photo = {
  thumb_file: { url: "thumb", width: 512, height: 512 },
  medium_file: { url: "medium", width: 1920, height: 1920 },
  large_file: { url: "large", width: 6000, height: 6000 },
  hdr_file: { url: "hdr-3200", width: 3200, height: 3200 },
  hdr_preview_file: { url: "hdr-640", width: 640, height: 640 },
  hdr_medium_file: { url: "hdr-1600", width: 1600, height: 1600 },
  hdr_detail_file: { url: "hdr-4096", width: 4096, height: 4096 },
};

test("the base table source stays at 640 pixels or less at every canvas zoom", () => {
  for (const zoom of [0.1, 0.14, 0.3, 0.65, 1, 2, 3]) {
    assert.equal(filmPreviewFile(photo, true), photo.hdr_preview_file);
    assert.notEqual(filmPreviewFile(photo, true).url, photo.hdr_file.url);
    assert(filmPreviewFile(photo, true).width * zoom <= 640 * zoom);
  }
  assert.equal(filmPreviewFile(photo, false), photo.thumb_file);
  assert.equal(FILM_PREVIEW_MAX_EDGE, 640);
});

test("high zoom and loupe use separate bounded HDR tiers", () => {
  assert.equal(filmTableDetailFile(photo, true), photo.hdr_medium_file);
  assert.equal(filmLoupeDetailFile(photo, true), photo.hdr_detail_file);
  assert.equal(filmTableDetailFile(photo, false), photo.medium_file);
  assert.equal(filmLoupeDetailFile(photo, false), photo.large_file);
  assert.equal(FILM_TABLE_DETAIL_MAX_EDGE, 1600);
  assert.equal(FILM_LOUPE_DETAIL_MAX_EDGE, 4096);
});

test("missing, malformed or oversized HDR tiers never promote the full HDR onto the table", () => {
  for (const preview of [
    undefined,
    {},
    { url: " ", width: 640, height: 640 },
    { url: "huge-preview", width: 3200, height: 3200 },
    { url: "bad", width: 0, height: 640 },
    { url: "hdr-3200", width: 640, height: 640 },
  ]) {
    assert.equal(
      filmPreviewFile({ ...photo, hdr_preview_file: preview }, true),
      photo.thumb_file,
    );
  }
  for (const medium of [
    undefined,
    {},
    { url: " ", width: 1600, height: 1600 },
    { url: "huge", width: 3200, height: 3200 },
    { url: "hdr-640", width: 1600, height: 1600 },
  ]) {
    assert.equal(
      filmTableDetailFile({ ...photo, hdr_medium_file: medium }, true),
      undefined,
    );
  }
  assert.equal(filmSdrPreview(photo), photo.thumb_file);
});

test("the low tier cuts base pixels by 96% while the table detail tier remains bounded", () => {
  const lowPixels =
    14 *
    filmPreviewFile(photo, true).width *
    filmPreviewFile(photo, true).height;
  assert.equal(lowPixels / (14 * 3200 * 3200), 0.04);
  assert.equal(3 * filmTableDetailFile(photo, true).width ** 2, 3 * 1600 ** 2);
});

test("only capped overlays and the loupe can reference larger HDR tiers", async () => {
  const page = await readFile(
    new URL("../src/routes/FilmPage.tsx", import.meta.url),
    "utf8",
  );
  const canvas = await readFile(
    new URL("../src/components/FilmCanvas.tsx", import.meta.url),
    "utf8",
  );
  const loupe = await readFile(
    new URL("../src/components/FilmLoupe.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /filmTableDetailFile\(photo, hdrEnabled\)/);
  assert.match(page, /data-film-loupe-src=\{loupeFile\?\.url\}/);
  assert.match(page, /hdrSrc=\{photo.hdr_preview_file\?\.url\}/);
  assert.match(canvas, /planFilmDetailSelection/);
  assert(
    !loupe.includes("preloadPhotoSource"),
    "only the controller decodes its actual high-resolution node",
  );
  assert(loupe.includes("dataset.filmLoupeSrc"));
});
