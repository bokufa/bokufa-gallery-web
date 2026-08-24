import axios from "axios";

type MapboxTokenResponse = {
  token: string;
};

const mapApi = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "" : "https://api.bokufa.art"),
  timeout: 15_000,
});

export async function fetchMapboxToken(signal?: AbortSignal) {
  const response = await mapApi.get<MapboxTokenResponse>("/api/mapbox/token", { signal });
  return response.data.token;
}

export function isCanceledMapRequest(error: unknown) {
  return axios.isCancel(error);
}
