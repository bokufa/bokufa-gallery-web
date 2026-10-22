import type { City, Country, Prefecture } from "../models/gallery";

import nativeNames from "../data/nativePlaceNames.json";

interface NamedPlace {
  id?: number | null;
  name: string;
  name_local?: string;
  native_name?: string;
  i18n?: Record<string, string>;
}
type Level = "country" | "prefecture" | "city" | "place";
type CountryNames = {
  id: number;
  name: string;
  locale: string;
  aliases: string[];
  regions: Record<string, string>;
  regionAliases: Record<string, string>;
  cities: Record<string, string>;
  cityAliases: Record<string, string>;
  places: Record<string, string>;
};
const catalog: Record<string, CountryNames> = nativeNames;
const key = (value: string) => value.trim().normalize("NFC").toLowerCase();

// Display only: preserve API objects, IDs, filtering, and authored article text.
export function countryCodeFor(country?: {
  code?: string;
  id?: number | null;
  name: string;
}) {
  if (!country) return undefined;
  if (country.code && catalog[country.code.toUpperCase()])
    return country.code.toUpperCase();
  const match = Object.entries(catalog).find(
    ([code, entry]) =>
      (country.id != null && country.id === entry.id) ||
      [code, entry.name, ...entry.aliases].some(
        (name) => key(name) === key(country.code || country.name),
      ),
  );

  return match?.[0] || country.code;
}

export function localPlaceLocale(code?: string) {
  return catalog[code || ""]?.locale || "en";
}

export function nativePlaceName(
  entity: NamedPlace | undefined,
  countryCode: string | undefined,
  level: Level,
): string {
  if (!entity) return "";
  const country = catalog[countryCode || ""];
  // Switzerland is multilingual: a country-wide German translation is not
  // necessarily local to a French- or Italian-speaking city/canton.
  const locale = countryCode === "CHE" ? "" : country?.locale || "";
  const explicit =
    entity.name_local?.trim() ||
    entity.native_name?.trim() ||
    entity.i18n?.local?.trim() ||
    entity.i18n?.[locale]?.trim();

  if (explicit) return explicit;
  if (!country) return entity.name;
  if (level === "country") return country.name;
  const aliases =
    level === "prefecture"
      ? country.regionAliases
      : level === "city"
        ? country.cityAliases
        : country.places;
  // Aliases come first: historical Buskerud records share Viken's map ID.
  const alias = aliases[entity.name];

  if (alias) return alias;
  const byId =
    level === "prefecture"
      ? country.regions
      : level === "city"
        ? country.cities
        : {};

  return byId[String(entity.id)] || entity.name;
}

export function nativeCountryName(country: Country) {
  return nativePlaceName(country, countryCodeFor(country), "country");
}

export function nativePrefectureName(prefecture: Prefecture) {
  return nativePlaceName(
    prefecture,
    countryCodeFor(prefecture.country),
    "prefecture",
  );
}

export function nativeCityName(city: City) {
  return nativePlaceName(city, countryCodeFor(city.prefecture.country), "city");
}

// Location headers are authored strings, not prose. Convert only exact place
// tokens and retain their separators; never search/replace article paragraphs.
const locationTokens = new Map<string, string>();

for (const [code, country] of Object.entries(catalog)) {
  for (const [alias, name] of Object.entries({
    ...country.regionAliases,
    ...country.cityAliases,
    ...country.places,
  })) {
    locationTokens.set(alias, name);
    if (code === "JPN") {
      const bareAlias = alias.replace(/[都府县県]$|-(?:to|fu|ken)$/i, "");
      if (bareAlias !== alias)
        locationTokens.set(bareAlias, name.replace(/[都府県]$/, ""));
    }
  }
  for (const alias of [country.name, ...country.aliases])
    locationTokens.set(alias, country.name);
}

export function nativeLocationText(value: string) {
  return value
    .split(/([·/|,，、;；])/)
    .map((token) => {
      const trimmed = token.trim();
      const name = locationTokens.get(trimmed);

      return name ? token.replace(trimmed, name) : token;
    })
    .join("");
}
