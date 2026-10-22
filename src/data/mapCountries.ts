import type { Country } from "../models/gallery";

export interface MapCountry extends Country {
  photoCenter?: [number, number];
  photoZoom: number;
}

export const MAP_COUNTRIES: MapCountry[] = [
  {
    id: 2, name: "日本", code: "JPN",
    center: [137.5, 37.5], photoCenter: [137.5, 36.2], extent: [122.5, 20, 154.5, 46.5], zoom: [4.4, 3.7, 9], photoZoom: 5.5,
  },
  {
    id: 578, name: "Norge", code: "NOR",
    center: [15, 64.5], extent: [4, 57.5, 32, 71.5], zoom: [4, 3.1, 9], photoZoom: 4.2,
  },
  {
    id: 752, name: "Sverige", code: "SWE",
    center: [16.5, 62.5], extent: [10.5, 55, 24.5, 69.5], zoom: [4.2, 3.4, 9], photoZoom: 4.5,
  },
  {
    id: 208, name: "Danmark", code: "DNK",
    center: [10, 56], extent: [7.5, 54.4, 15.5, 57.9], zoom: [5.5, 4.5, 10], photoZoom: 6,
  },
  {
    id: 756, name: "Schweiz", code: "CHE",
    center: [8.25, 46.8], extent: [5.7, 45.7, 10.7, 47.9], zoom: [6.3, 5.2, 11], photoZoom: 6.5,
  },
  {
    id: 380, name: "Italia", code: "ITA",
    center: [12.2, 42.6], extent: [6.3, 35.3, 18.8, 47.2], zoom: [4.8, 4, 9.5], photoZoom: 5,
  },
];

export function mapCountryForCode(code: string | null | undefined) {
  return MAP_COUNTRIES.find((country) => country.code === code) ?? MAP_COUNTRIES[0];
}

export function photoBelongsToCountry(country: Country | undefined, selected: Country) {
  if (!country) return selected.code === "JPN";
  return country.code ? country.code === selected.code : country.id === selected.id;
}
