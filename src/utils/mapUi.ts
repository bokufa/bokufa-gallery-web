import type { UiMessageKey } from "../data/uiMessages";

type Translate = (key: UiMessageKey) => string;

// Updating control text must not rebuild the map or translate its geographic labels.
export function localizeMapControls(
  map: { getContainer: () => HTMLElement; getCanvas: () => HTMLCanvasElement },
  t: Translate,
) {
  const container = map.getContainer();

  for (const [selector, key] of [
    [".mapboxgl-ctrl-zoom-in", "zoom.in"],
    [".mapboxgl-ctrl-zoom-out", "zoom.out"],
    [".mapboxgl-ctrl-compass", "map.north"],
    [".mapboxgl-ctrl-attrib-button", "map.attribution"],
  ] as const) {
    for (const button of container.querySelectorAll<HTMLElement>(selector)) {
      button.setAttribute("title", t(key));
      button.setAttribute("aria-label", t(key));
    }
  }
  map.getCanvas().setAttribute("aria-label", t("map.canvas"));
}
