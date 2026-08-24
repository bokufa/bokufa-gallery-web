import type { Map as MapboxMap } from "mapbox-gl";

export function applyChineseMapLabels(map: MapboxMap) {
  map.getStyle()?.layers?.forEach((layer) => {
    if (layer.type !== "symbol" || !layer.id.endsWith("-label")) return;

    const originalText = map.getLayoutProperty(layer.id, "text-field");
    if (originalText === undefined) return;

    map.setLayoutProperty(layer.id, "text-field", [
      "coalesce",
      ["get", "name_zh-Hans"],
      ["get", "name_zh"],
      originalText,
    ]);
  });
}
