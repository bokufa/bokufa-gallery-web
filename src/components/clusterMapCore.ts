import { useCallback, useEffect, useRef } from "react";
import type { Country, PhotoClusterItem } from "../models/gallery";

export interface ClusterBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/*
 * Provider-agnostic core of the /cluster photo map: photos are clustered in
 * Web Mercator unit space at a *quantized* 256px-tile zoom level, only when a
 * gesture ends. Only viewport-adjacent clusters become map annotations —
 * additions fade in, removals fade out (see .photo-annotation in index.css),
 * and clusters whose membership didn't change keep their annotation untouched.
 * The Apple (mapkit) and Mapbox components supply a small ClusterMapAdapter;
 * everything else lives here.
 */

const CLUSTER_RADIUS_PX = 90;
const CULL_FACTOR = 1.5; // keep annotations within 1.5x the visible half-span
const EXIT_MS = 180;
const ZOOM_DURATION_MS = 800;
const SEPARATION_PX = 140;
// Clustering resolution is exhausted at this quantized zoom (90px ~ 11m —
// closer photos can never split by zooming); stacks bloom into rings instead.
const MAX_ZOOM = 20;
const SPREAD_SPACING_PX = 92;

// Props shared by AppleClusterMap and MapboxClusterMap.
export interface ClusterMapProps {
  token: string;
  country: Country;
  items: PhotoClusterItem[];
  onPhotoTap: (photo: PhotoClusterItem) => void;
  onViewportChangeStart: () => void;
  onViewportChange: (bounds: ClusterBounds) => void;
}

export const mercatorX = (lng: number) => (lng + 180) / 360;
export const mercatorY = (lat: number) => {
  const s = Math.min(Math.max(Math.sin(lat * Math.PI / 180), -0.9999), 0.9999);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
export const mercatorToLat = (y: number) => (2 * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - Math.PI / 2) * 180 / Math.PI;
export const mercatorToLng = (x: number) => x * 360 - 180;

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Long dives (e.g. straight to the bloom zoom) get proportionally more time
// so the per-level pace stays comfortable.
export const flightDuration = (zoomLevels: number) =>
  ZOOM_DURATION_MS * Math.min(1.75, Math.max(1, zoomLevels / 3));

interface ProjectedPhoto {
  item: PhotoClusterItem;
  x: number;
  y: number;
}

export interface ClusterPoint {
  key: string;
  latitude: number;
  longitude: number;
  x: number;
  y: number;
  members: PhotoClusterItem[];
}

function projectPhotos(items: PhotoClusterItem[]): ProjectedPhoto[] {
  const photos: ProjectedPhoto[] = [];
  for (const item of items) {
    if (!item.coordinate) continue;
    photos.push({
      item,
      x: mercatorX(item.coordinate.longitude),
      y: mercatorY(item.coordinate.latitude),
    });
  }
  return photos;
}

// Pixel offsets laying `count` photos out as a compact flower: a single ring
// with exact SPREAD_SPACING_PX neighbor gaps up to 6, then a center photo
// surrounded by hexagonally-packed rings.
function spreadOffsets(count: number): Array<[number, number]> {
  if (count <= 1) return [[0, 0]];
  if (count <= 6) {
    const radius = SPREAD_SPACING_PX / (2 * Math.sin(Math.PI / count));
    return Array.from({ length: count }, (_, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius];
    });
  }
  const offsets: Array<[number, number]> = [[0, 0]];
  let placed = 1;
  for (let ring = 1; placed < count; ring++) {
    const capacity = Math.min(count - placed, 6 * ring);
    const radius = SPREAD_SPACING_PX * ring;
    const startAngle = -Math.PI / 2 + (ring % 2) * (Math.PI / (6 * ring));
    for (let i = 0; i < capacity; i++) {
      const angle = startAngle + (2 * Math.PI * i) / capacity;
      offsets.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      placed++;
    }
  }
  return offsets;
}

function computeClusters(photos: ProjectedPhoto[], zoom: number): ClusterPoint[] {
  const radius = CLUSTER_RADIUS_PX / (256 * Math.pow(2, zoom));
  const r2 = radius * radius;
  const cellOf = (v: number) => Math.floor(v / radius);

  const grid = new Map<string, ProjectedPhoto[]>();
  for (const p of photos) {
    const key = `${cellOf(p.x)}:${cellOf(p.y)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(p);
    else grid.set(key, [p]);
  }

  const assigned = new Set<number>();
  const clusters: ClusterPoint[] = [];
  for (const seed of photos) {
    if (assigned.has(seed.item.id)) continue;
    const cx = cellOf(seed.x), cy = cellOf(seed.y);
    const members: ProjectedPhoto[] = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${cx + dx}:${cy + dy}`);
        if (!bucket) continue;
        for (const p of bucket) {
          if (assigned.has(p.item.id)) continue;
          const ddx = p.x - seed.x, ddy = p.y - seed.y;
          if (ddx * ddx + ddy * ddy <= r2) {
            assigned.add(p.item.id);
            members.push(p);
          }
        }
      }
    }

    // Sorted by id so members[0] is a deterministic cover photo: the minimum
    // id is monotone under union, so merges inherit a child's cover instead of
    // showing a bucket-scan-order random one.
    members.sort((a, b) => a.item.id - b.item.id);

    let sx = 0, sy = 0;
    for (const m of members) { sx += m.x; sy += m.y; }
    const x = sx / members.length, y = sy / members.length;

    if (zoom >= MAX_ZOOM && members.length > 1) {
      // Deepest level: zooming can't separate these, so bloom the stack into
      // a ring of individually tappable photos. They render as ordinary
      // singles (`p:` keys), so zooming out merges them back through the
      // normal crossfade. Displayed offset is a few dozen px (~10-30 m here).
      const unitPerPx = 1 / (256 * Math.pow(2, zoom));
      const offsets = spreadOffsets(members.length);
      members.forEach((m, i) => {
        const px = x + offsets[i][0] * unitPerPx;
        const py = y + offsets[i][1] * unitPerPx;
        clusters.push({
          key: `p:${m.item.id}`,
          latitude: mercatorToLat(py),
          longitude: mercatorToLng(px),
          x: px,
          y: py,
          members: [m.item],
        });
      });
      continue;
    }

    clusters.push({
      // Composition-stable key: an unchanged cluster keeps its annotation
      // across zoom levels instead of being torn down and re-animated.
      key: members.length === 1
        ? `p:${members[0].item.id}`
        : `c:${members.map((m) => m.item.id).join(",")}`,
      latitude: mercatorToLat(y),
      longitude: mercatorToLng(x),
      x,
      y,
      members: members.map((m) => m.item),
    });
  }
  return clusters;
}

function buildThumbImage(url: string, lazy: boolean): HTMLImageElement {
  const img = document.createElement("img");
  if (lazy) img.loading = "lazy";
  img.decoding = "async";
  img.alt = "";
  img.draggable = false;
  img.className = "h-full w-full object-cover";
  // Fade the photo over its placeholder once loaded, so cold-cache crossfades
  // show a calm frame -> photo sequence instead of a late content snap.
  img.style.opacity = "0";
  img.onload = () => { img.style.opacity = "1"; };
  img.src = url;
  return img;
}

export function buildSingleElement(photo: PhotoClusterItem): HTMLElement {
  const root = document.createElement("div");
  root.className = "photo-annotation h-20 w-20 p-1 cursor-pointer hover:scale-[1.04]";

  const frame = document.createElement("div");
  frame.className = "h-full w-full overflow-hidden rounded-lg border-2 border-white bg-zinc-200 shadow-md";
  frame.appendChild(buildThumbImage(photo.thumb_file.url, true));
  root.appendChild(frame);

  return root;
}

export function buildClusterElement(count: number, coverUrl: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "photo-annotation relative h-20 w-20 cursor-pointer hover:scale-[1.04]";

  for (const rotation of count > 2 ? ["rotate-[-7deg]", "rotate-[5deg]"] : ["rotate-[-7deg]"]) {
    const print = document.createElement("div");
    print.className = `absolute inset-1 rounded-lg border-2 border-white bg-white shadow-sm ${rotation}`;
    root.appendChild(print);
  }

  const cover = document.createElement("div");
  cover.className = "absolute inset-1 overflow-hidden rounded-lg border-2 border-white bg-zinc-200 shadow-md";
  cover.appendChild(buildThumbImage(coverUrl, false));
  root.appendChild(cover);

  const badge = document.createElement("span");
  badge.className = "absolute right-0 top-0 flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-zinc-900/95 px-1.5 text-xs font-semibold text-white shadow-sm ring-2 ring-white";
  badge.textContent = count > 99 ? "99+" : `${count}`;
  root.appendChild(badge);

  return root;
}

// Unit-space bounding box, with x unwrapped around the first member so groups
// near the antimeridian stay tight.
function unitBounds(items: PhotoClusterItem[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let refX: number | undefined;
  for (const item of items) {
    if (!item.coordinate) continue;
    let x = mercatorX(item.coordinate.longitude);
    refX ??= x;
    if (x - refX > 0.5) x -= 1;
    else if (x - refX < -0.5) x += 1;
    const y = mercatorY(item.coordinate.latitude);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return refX === undefined ? null : { minX, maxX, minY, maxY };
}

export interface FlightTarget {
  latitude: number;
  longitude: number;
  zoom256: number;
}

// Where a tap on a cluster should fly: deep enough that the ~80px member
// annotations can separate (SEPARATION_PX across the bbox), always at least
// one quantized level deeper, never so deep that the padded bbox no longer
// fits — and straight to the bloom level for stacks no zoom can split.
export function clusterFlightTarget(
  members: PhotoClusterItem[],
  viewport: { width: number; height: number },
  currentZoom256: number,
): FlightTarget | null {
  const bounds = unitBounds(members);
  if (!bounds) return null;

  const spanX = bounds.maxX - bounds.minX;
  const spanY = bounds.maxY - bounds.minY;
  const maxSpan = Math.max(spanX, spanY);

  let zoom: number;
  if (maxSpan * 256 * Math.pow(2, MAX_ZOOM) < CLUSTER_RADIUS_PX) {
    zoom = MAX_ZOOM;
  } else {
    const zSeparate = Math.log2(SEPARATION_PX / (256 * maxSpan));
    const zFit = Math.min(
      spanX > 0 ? Math.log2(viewport.width / (1.4 * 256 * spanX)) : Infinity,
      spanY > 0 ? Math.log2(viewport.height / (1.4 * 256 * spanY)) : Infinity,
    );
    zoom = Math.min(Math.max(zSeparate, currentZoom256 + 1), zFit, MAX_ZOOM);
  }

  let centerX = (bounds.minX + bounds.maxX) / 2;
  if (centerX > 1) centerX -= 1;
  else if (centerX < 0) centerX += 1;

  return {
    latitude: mercatorToLat((bounds.minY + bounds.maxY) / 2),
    longitude: mercatorToLng(centerX),
    zoom256: zoom,
  };
}

// The provider-specific surface: how to read the camera and how to own one
// map annotation (H = the provider's handle type).
export interface ClusterMapAdapter<H> {
  zoom256(): number;
  // Current view in degrees, without the cull margin.
  view(): { centerLng: number; centerLat: number; halfLng: number; halfLat: number } | null;
  create(cluster: ClusterPoint): H;
  add(handles: H[]): void;
  remove(handle: H): void;
  element(handle: H): HTMLElement | null;
  onDispose?(): void;
}

export interface ClusterController {
  setItems(items: PhotoClusterItem[]): void;
  regionChangeStart(): void;
  regionChangeEnd(): void;
  dispose(): void;
}

export function createClusterController<H>(adapter: ClusterMapAdapter<H>): ClusterController {
  let photos: ProjectedPhoto[] = [];
  let disposed = false;
  let updateTimer: number | undefined;
  let fillInterval: number | undefined;
  let displayedZoom: number | undefined;
  let lastFill = 0;
  const clustersByZoom = new Map<number, ClusterPoint[]>();
  const active = new Map<string, H>();
  const exiting = new Map<string, { handle: H; timer: number }>();

  const quantizedZoom = () => Math.min(MAX_ZOOM, Math.max(2, Math.round(adapter.zoom256())));

  const visibleClusters = (clusters: ClusterPoint[]) => {
    const view = adapter.view();
    if (!view) return clusters;
    const halfLng = view.halfLng * CULL_FACTOR;
    const halfLat = view.halfLat * CULL_FACTOR;
    const minX = mercatorX(view.centerLng - halfLng);
    const maxX = mercatorX(view.centerLng + halfLng);
    const minY = mercatorY(Math.min(view.centerLat + halfLat, 85));
    const maxY = mercatorY(Math.max(view.centerLat - halfLat, -85));
    // The window may extend past the antimeridian while photo x stays in
    // [0,1]; also test the +-1 wrapped copies.
    const containsX = (x: number) =>
      (x >= minX && x <= maxX) || (x + 1 >= minX && x + 1 <= maxX) || (x - 1 >= minX && x - 1 <= maxX);
    return clusters.filter((c) => containsX(c.x) && c.y >= minY && c.y <= maxY);
  };

  const sync = (target: ClusterPoint[], addOnly = false) => {
    if (!addOnly) {
      const targetKeys = new Set(target.map((c) => c.key));
      for (const [key, handle] of active) {
        if (targetKeys.has(key)) continue;
        active.delete(key);
        const element = adapter.element(handle);
        if (element) {
          // A still-running appear animation would override the exit
          // transition (animations beat transitions) and snap at the end.
          element.style.animation = "none";
          element.classList.add("is-exiting");
        }
        const timer = window.setTimeout(() => {
          exiting.delete(key);
          if (!disposed) adapter.remove(handle);
        }, EXIT_MS);
        exiting.set(key, { handle, timer });
      }
    }

    const toAdd: H[] = [];
    for (const cluster of target) {
      if (active.has(cluster.key)) continue;
      const pending = exiting.get(cluster.key);
      if (pending) {
        // Re-entered before its fade-out finished (e.g. a quick zoom back).
        window.clearTimeout(pending.timer);
        exiting.delete(cluster.key);
        adapter.element(pending.handle)?.classList.remove("is-exiting");
        active.set(cluster.key, pending.handle);
        continue;
      }
      const handle = adapter.create(cluster);
      active.set(cluster.key, handle);
      toAdd.push(handle);
    }
    if (toAdd.length) adapter.add(toAdd);
  };

  const update = () => {
    if (disposed) return;
    const zoom = quantizedZoom();
    let clusters = clustersByZoom.get(zoom);
    if (!clusters) {
      clusters = computeClusters(photos, zoom);
      clustersByZoom.set(zoom, clusters);
    }
    displayedZoom = zoom;
    sync(visibleClusters(clusters));
  };

  // While a gesture or camera flight is in progress the cluster set is frozen,
  // but panning still uncovers ground: fill the edges from the displayed zoom
  // level's cached clusters — add-only, so no churn and no removals.
  const fillEdges = () => {
    if (disposed || displayedZoom === undefined) return;
    lastFill = performance.now();
    const clusters = clustersByZoom.get(displayedZoom);
    if (clusters) sync(visibleClusters(clusters), true);
  };
  const maybeFillEdges = () => {
    if (performance.now() - lastFill > 140) fillEdges();
  };

  return {
    setItems(items) {
      photos = projectPhotos(items);
      clustersByZoom.clear();
      update();
    },
    // A gesture start cancels the pending recluster; the fill interval covers
    // long drags, the throttled immediate fill covers per-frame start/end
    // storms from camera animations.
    regionChangeStart() {
      window.clearTimeout(updateTimer);
      maybeFillEdges();
      window.clearInterval(fillInterval);
      fillInterval = window.setInterval(fillEdges, 150);
    },
    // Debounced so bursts of end events (momentum, wheel ticks) collapse into
    // one recluster.
    regionChangeEnd() {
      window.clearInterval(fillInterval);
      window.clearTimeout(updateTimer);
      updateTimer = window.setTimeout(update, 100);
    },
    dispose() {
      disposed = true;
      window.clearTimeout(updateTimer);
      window.clearInterval(fillInterval);
      for (const { handle, timer } of exiting.values()) {
        window.clearTimeout(timer);
        adapter.remove(handle);
      }
      for (const handle of active.values()) adapter.remove(handle);
      exiting.clear();
      active.clear();
      adapter.onDispose?.();
    },
  };
}

// The shared React shell: keeps the controller fed with items, tears it down
// on unmount, and hands the providers stable callbacks.
export function useClusterController(
  items: PhotoClusterItem[],
  onPhotoTap: (photo: PhotoClusterItem) => void,
) {
  const controllerRef = useRef<ClusterController | null>(null);
  const itemsRef = useRef(items);
  const tapRef = useRef(onPhotoTap);
  tapRef.current = onPhotoTap;

  useEffect(() => {
    itemsRef.current = items;
    controllerRef.current?.setItems(items);
  }, [items]);

  useEffect(() => () => {
    controllerRef.current?.dispose();
    controllerRef.current = null;
  }, []);

  const attach = useCallback((controller: ClusterController) => {
    controllerRef.current?.dispose();
    controllerRef.current = controller;
    if (itemsRef.current.length) controller.setItems(itemsRef.current);
  }, []);

  const tap = useCallback((photo: PhotoClusterItem) => tapRef.current(photo), []);
  const regionChangeStart = useCallback(() => controllerRef.current?.regionChangeStart(), []);
  const regionChangeEnd = useCallback(() => controllerRef.current?.regionChangeEnd(), []);

  return { attach, tap, regionChangeStart, regionChangeEnd };
}
