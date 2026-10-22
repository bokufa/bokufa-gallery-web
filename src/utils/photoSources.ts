import type { Photo } from "../models/gallery";

export function sdrPhotoFile(photo: Photo) {
  return [photo.large_file, photo.medium_file, photo.thumb_file].find((file) =>
    file?.url?.trim(),
  )!;
}

export function preferredPhotoFile(photo: Photo, hdrEnabled: boolean) {
  return hdrEnabled && photo.hdr_file?.url?.trim()
    ? photo.hdr_file
    : sdrPhotoFile(photo);
}

const loads = new Map<string, Promise<void>>();
const pending: Array<{ url: string; priority: number; start: () => void }> = [];
let decoding = false;

function pump() {
  if (decoding || !pending.length) return;
  pending.sort((a, b) => b.priority - a.priority);
  decoding = true;
  pending.shift()!.start();
}

// Decode original image bytes natively; canvas/re-encoding would discard gain maps.
export function preloadPhotoSource(url: string, priority = 2) {
  const existing = loads.get(url);

  if (existing) {
    const task = pending.find((task) => task.url === url);

    if (task) task.priority = Math.max(task.priority, priority);

    return existing;
  }
  const request = new Promise<void>((resolve, reject) => {
    pending.push({
      url,
      priority,
      start: () => {
        const image = new Image();

        image.decoding = "async";
        image.src = url;
        void image
          .decode()
          .then(resolve, (error) => {
            loads.delete(url);
            reject(error);
          })
          .finally(() => {
            decoding = false;
            pump();
          });
      },
    });
  });

  loads.set(url, request);
  pump();

  return request;
}
