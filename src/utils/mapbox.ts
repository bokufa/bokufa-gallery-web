import type { Map as MapboxMap } from "mapbox-gl";

// Mapbox Streets `name` is the endonym; `name_<language>` is a translation.
// Preserve formatted labels, road references, and script-selection expressions.
export function localMapLabelExpression(value: unknown): unknown {
  const translatedName = /^name_[a-z]{2}(?:-[A-Za-z]{2,4})?$/;

  if (typeof value === "string") {
    return value.replace(/\{(name_[a-z]{2}(?:-[A-Za-z]{2,4})?)\}/g, "{name}");
  }
  if (!Array.isArray(value)) return value;
  if (
    (value[0] === "get" || value[0] === "has") &&
    typeof value[1] === "string" &&
    translatedName.test(value[1])
  )
    return [value[0], "name", ...value.slice(2)];

  return value.map(localMapLabelExpression);
}

export function applyLocalMapLabels(map: MapboxMap) {
  map.getStyle()?.layers?.forEach((layer) => {
    if (layer.type !== "symbol") return;

    const originalText = map.getLayoutProperty(layer.id, "text-field");

    if (originalText === undefined) return;

    const localText = localMapLabelExpression(
      originalText,
    ) as typeof originalText;

    if (JSON.stringify(localText) !== JSON.stringify(originalText))
      map.setLayoutProperty(layer.id, "text-field", localText);
  });
}
