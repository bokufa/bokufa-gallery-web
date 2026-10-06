import type { Photo, PhotoClusterItem } from "../models/gallery";

// The photo map is global. Country metadata is only used by the regions view.
export function buildPhotoMapItems(photos: Photo[]): PhotoClusterItem[] {
  return photos.flatMap((photo) => {
    const coordinate = photo.metadata.location;
    if (!coordinate || !Number.isFinite(coordinate.latitude) || !Number.isFinite(coordinate.longitude)
      || Math.abs(coordinate.latitude) > 90 || Math.abs(coordinate.longitude) > 180) return [];
    return [{
      id: photo.id,
      datetime: photo.metadata.datetime,
      coordinate,
      thumb_file: photo.thumb_file,
      clustering_identifier: `photo:${photo.id}`,
    }];
  });
}
