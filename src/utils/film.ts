import type { Photo } from "../models/gallery";

// Older uploads store the film camera in manufacture.name and the stock/scanner
// in model. Match known film equipment, not all Nikon/Fuji cameras or photo IDs.
const filmCameraNames = new Set(["nikon fm"]);

export function isFilmPhoto(photo: Photo): boolean {
  const camera = photo.metadata.camera;
  if (!camera) return false;

  const names = [camera.manufacture?.name, camera.model, camera.general_name];
  return names.some((name) => name && filmCameraNames.has(name.trim().toLowerCase()))
    || /\bFUJI\s+SP[-\s]?3000\b/i.test(camera.model || "");
}
