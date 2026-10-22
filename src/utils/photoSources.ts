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

// Actual DOM images share the preload budget too, including small HDR labels.
// Otherwise a preload finishing can trigger a second, unbounded decode burst.
export function decodePhotoElement(
  image: HTMLImageElement,
  priority = 2,
  signal?: AbortSignal,
) {
  const aborted = () =>
    new DOMException("Image no longer visible", "AbortError");

  if (signal?.aborted) return Promise.reject(aborted());
  const request = new Promise<void>((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", cancel);
    const cancel = () => {
      const index = pending.indexOf(task);

      if (index >= 0) pending.splice(index, 1);
      cleanup();
      reject(aborted());
    };
    const task = {
      url: "",
      priority,
      start: () => {
        void Promise.resolve()
          .then(() => {
            if (signal?.aborted) throw aborted();

            return image.decode();
          })
          .then(resolve, reject)
          .finally(() => {
            cleanup();
            decoding = false;
            pump();
          });
      },
    };

    signal?.addEventListener("abort", cancel, { once: true });
    pending.push(task);
  });

  pump();

  return request;
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
