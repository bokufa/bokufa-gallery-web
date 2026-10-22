import type { Photo } from "../models/gallery";

export const FILM_PREVIEW_MAX_EDGE = 640;
export const FILM_TABLE_DETAIL_MAX_EDGE = 1600;
export const FILM_LOUPE_DETAIL_MAX_EDGE = 4096;

export function filmSdrPreview(photo: Photo) {
  const medium = photo.medium_file;

  return medium?.url?.trim() &&
    Math.max(medium.width, medium.height) <= FILM_PREVIEW_MAX_EDGE
    ? medium
    : photo.thumb_file;
}

// The base table source stays small. High canvas zoom and the loupe use their
// own separately budgeted tiers; malformed previews never fall back to full HDR.
export function filmPreviewFile(photo: Photo, hdr: boolean) {
  const preview = photo.hdr_preview_file;

  return hdr &&
    preview?.url?.trim() &&
    preview.url !== photo.hdr_file?.url &&
    preview.width > 0 &&
    preview.height > 0 &&
    Math.max(preview.width, preview.height) <= FILM_PREVIEW_MAX_EDGE
    ? preview
    : filmSdrPreview(photo);
}

function validTier(
  file: Photo["hdr_medium_file"],
  maximum: number,
  excludedUrl?: string,
) {
  return file?.url?.trim() &&
    file.url !== excludedUrl &&
    file.width > 0 &&
    file.height > 0 &&
    Math.max(file.width, file.height) <= maximum
    ? file
    : undefined;
}

export function filmTableDetailFile(photo: Photo, hdr: boolean) {
  if (!hdr) return validTier(photo.medium_file, 2560, photo.thumb_file.url);

  return validTier(
    photo.hdr_medium_file,
    FILM_TABLE_DETAIL_MAX_EDGE,
    photo.hdr_preview_file?.url,
  );
}

export function filmLoupeDetailFile(photo: Photo, hdr: boolean) {
  if (!hdr)
    return photo.large_file?.url?.trim()
      ? photo.large_file
      : photo.medium_file?.url?.trim()
        ? photo.medium_file
        : undefined;

  return (
    validTier(
      photo.hdr_detail_file,
      FILM_LOUPE_DETAIL_MAX_EDGE,
      photo.hdr_medium_file?.url,
    ) || photo.hdr_file
  );
}
