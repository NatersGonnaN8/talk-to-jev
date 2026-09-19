/** Open-Meteo forecast + geocoding. No API key. Server-side only. */

export const DEFAULT_LOCATION_QUERY = "Columbus, OH";

export const DEFAULT_PLACE = {
  name: "Columbus",
  admin1: "Ohio",
  country: "United States",
  latitude: 39.9612,
  longitude: -82.9988,
};

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const UA = "TalkToJev/0.3 (local workshop; Open-Meteo CC BY 4.0)";

export class WeatherHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "WeatherHttpError";
  }
}

export type WeatherPlace = {
  name: string;
  admin1: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  label: string;
};

export type WeatherPayload = {
  place: WeatherPlace;
  current: Record<string, unknown>;
  daily: unknown;
  hourly: unknown;
  json: Record<string, unknown>;
  text: string;
  summary: string;
};

type GeoHit = {
  name?: string;
  admin1?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
};

function placeLabel(p: {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}) {
  const named = [p.name, p.admin1, p.country].filter(Boolean).join(", ");
  return named || `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`;
}

function parseCoordPair(raw: string): { latitude: number; longitude: number } | null {
  const m = raw
    .trim()
    .match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const latitude = Number(m[1]);
  const longitude = Number(m[2]);
  if (!validCoord(latitude, longitude)) return null;
  return { latitude, longitude };
}

function validCoord(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function wmoText(code: unknown): string {
  const n = Number(code);
  if (!Number.isFinite(n)) return "Unknown";
  const table: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Freezing drizzle",
    61: "Slight rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Freezing rain",
    71: "Slight snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with heavy hail",
  };
  return table[n] ?? `WMO ${n}`;
}

function windFrom(deg: unknown): string {
  const d = Number(deg);
  if (!Number.isFinite(d)) return "";
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(d / 45) % 8] ?? "";
}

function num(v: unknown, digits = 0): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

async function getJson(url: string): Promise<unknown> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: "application/json", "User-Agent": UA },
    });
    if (!res.ok) {
      throw new WeatherHttpError(502, "Weather request failed.");
    }
    return await res.json();
  } catch (err) {
    if (err instanceof WeatherHttpError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new WeatherHttpError(502, "Weather request timed out.");
    }
    throw new WeatherHttpError(502, "Weather request failed.");
  } finally {
    clearTimeout(timer);
  }
}

export async function searchPlaces(q: string): Promise<WeatherPlace[]> {
  const name = q.trim();
  if (!name) throw new WeatherHttpError(400, "Need a city name to search.");
  const url = new URL(GEO);
  url.searchParams.set("name", name);
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const raw = (await getJson(url.toString())) as { results?: GeoHit[] };
  const hits = Array.isArray(raw.results) ? raw.results : [];
  return hits
    .filter(
      (h) =>
        typeof h.latitude === "number" && typeof h.longitude === "number",
    )
    .map((h) => {
      const latitude = h.latitude as number;
      const longitude = h.longitude as number;
      const name = String(h.name ?? "Unknown");
      const admin1 = String(h.admin1 ?? "");
      const country = String(h.country ?? "");
      return {
        name,
        admin1,
        country,
        latitude,
        longitude,
        timezone: h.timezone,
        label: placeLabel({ name, admin1, country, latitude, longitude }),
      };
    });
}

async function resolvePlace(input: {
  q?: string;
  latitude?: string;
  longitude?: string;
}): Promise<WeatherPlace> {
  const latN = input.latitude != null && input.latitude !== "" ? Number(input.latitude) : NaN;
  const lonN =
    input.longitude != null && input.longitude !== "" ? Number(input.longitude) : NaN;
  if (validCoord(latN, lonN)) {
    return {
      name: "Custom location",
      admin1: "",
      country: "",
      latitude: latN,
      longitude: lonN,
      label: placeLabel({
        name: "Custom location",
        latitude: latN,
        longitude: lonN,
      }),
    };
  }

  const q = (input.q ?? "").trim() || DEFAULT_LOCATION_QUERY;
  const pair = parseCoordPair(q);
  if (pair) {
    return {
      name: "Custom location",
      admin1: "",
      country: "",
      latitude: pair.latitude,
      longitude: pair.longitude,
      label: placeLabel({
        name: "Custom location",
        latitude: pair.latitude,
        longitude: pair.longitude,
      }),
    };
  }

  if (q.toLowerCase() === DEFAULT_LOCATION_QUERY.toLowerCase()) {
    return {
      ...DEFAULT_PLACE,
      label: placeLabel(DEFAULT_PLACE),
    };
  }

  const hits = await searchPlaces(q);
  if (!hits.length) {
    throw new WeatherHttpError(
      404,
      "Unknown place. Try a city name (Nashville, TN) or lat, lon.",
    );
  }
  return hits[0];
}

function takeHourly(
  hourly: Record<string, unknown> | undefined,
  count: number,
) {
  if (!hourly || !Array.isArray(hourly.time)) return [];
  const times = hourly.time as unknown[];
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < Math.min(count, times.length); i++) {
    out.push({
      time: times[i],
      temp_f: num((hourly.temperature_2m as unknown[])?.[i], 0),
      precip_prob: num((hourly.precipitation_probability as unknown[])?.[i], 0),
      precip_in: num((hourly.precipitation as unknown[])?.[i], 2),
      weather: wmoText((hourly.weather_code as unknown[])?.[i]),
      weather_code: (hourly.weather_code as unknown[])?.[i],
      wind_mph: num((hourly.wind_speed_10m as unknown[])?.[i], 0),
      cloud_pct: num((hourly.cloud_cover as unknown[])?.[i], 0),
    });
  }
  return out;
}

function takeDaily(daily: Record<string, unknown> | undefined) {
  if (!daily || !Array.isArray(daily.time)) return [];
  const times = daily.time as unknown[];
  const out: Array<Record<string, unknown>> = [];
  for (let i = 0; i < times.length; i++) {
    out.push({
      date: times[i],
      high_f: num((daily.temperature_2m_max as unknown[])?.[i], 0),
      low_f: num((daily.temperature_2m_min as unknown[])?.[i], 0),
      precip_in: num((daily.precipitation_sum as unknown[])?.[i], 2),
      precip_prob_max: num(
        (daily.precipitation_probability_max as unknown[])?.[i],
        0,
      ),
      weather: wmoText((daily.weather_code as unknown[])?.[i]),
      weather_code: (daily.weather_code as unknown[])?.[i],
      gust_mph: num((daily.wind_gusts_10m_max as unknown[])?.[i], 0),
    });
  }
  return out;
}

function formatBlock(place: WeatherPlace, json: Record<string, unknown>): string {
  const current = json.current as Record<string, unknown>;
  const daily = json.daily as Array<Record<string, unknown>>;
  const hours = json.next_hours as Array<Record<string, unknown>>;
  const dir = current.wind_from ? ` from ${current.wind_from}` : "";
  const lines = [
    "## Weather (Open-Meteo, CC BY 4.0)",
    `Place: ${place.label} (${place.latitude.toFixed(4)}, ${place.longitude.toFixed(4)})`,
    `Timezone: ${json.timezone ?? "auto"}`,
    `Observed: ${current.time ?? "n/a"}`,
    `Now: ${current.temp_f}°F (feels ${current.feels_f}°F), ${current.weather}, humidity ${current.humidity_pct}%, wind ${current.wind_mph} mph${dir}, gusts ${current.gust_mph} mph, precip ${current.precip_in} in, cloud ${current.cloud_pct}%`,
  ];
  if (daily.length) {
    lines.push("Daily:");
    for (const d of daily) {
      lines.push(
        `- ${d.date}: high ${d.high_f}°F / low ${d.low_f}°F, ${d.weather}, ${d.precip_prob_max}% chance of precip, ${d.precip_in} in, max gust ${d.gust_mph} mph`,
      );
    }
  }
  if (hours.length) {
    lines.push("Next hours:");
    for (const h of hours) {
      lines.push(
        `- ${h.time}: ${h.temp_f}°F, ${h.precip_prob}% precip, ${h.weather}, wind ${h.wind_mph} mph`,
      );
    }
  }
  lines.push("");
  lines.push("```json");
  lines.push(JSON.stringify(json, null, 2));
  lines.push("```");
  lines.push(
    "Source: Open-Meteo Forecast API (CC BY 4.0). Weather is observational input for Jev, not a model.",
  );
  return lines.join("\n");
}

export async function getWeather(input: {
  q?: string;
  latitude?: string;
  longitude?: string;
}): Promise<WeatherPayload> {
  const place = await resolvePlace(input);
  const url = new URL(FORECAST);
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "rain",
      "weather_code",
      "cloud_cover",
      "wind_speed_10m",
      "wind_gusts_10m",
      "wind_direction_10m",
      "is_day",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    [
      "temperature_2m",
      "precipitation_probability",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "cloud_cover",
      "apparent_temperature",
    ].join(","),
  );
  url.searchParams.set(
    "daily",
    [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_gusts_10m_max",
    ].join(","),
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("forecast_hours", "12");

  const raw = (await getJson(url.toString())) as Record<string, unknown>;
  if (raw && raw.error) {
    throw new WeatherHttpError(502, "Weather request failed.");
  }

  const currentRaw = (raw.current ?? {}) as Record<string, unknown>;
  const timezone = String(raw.timezone ?? place.timezone ?? "auto");
  const current = {
    time: currentRaw.time,
    temp_f: num(currentRaw.temperature_2m, 0),
    feels_f: num(currentRaw.apparent_temperature, 0),
    humidity_pct: num(currentRaw.relative_humidity_2m, 0),
    precip_in: num(currentRaw.precipitation, 2),
    weather: wmoText(currentRaw.weather_code),
    weather_code: currentRaw.weather_code,
    cloud_pct: num(currentRaw.cloud_cover, 0),
    wind_mph: num(currentRaw.wind_speed_10m, 0),
    gust_mph: num(currentRaw.wind_gusts_10m, 0),
    wind_from: windFrom(currentRaw.wind_direction_10m),
    is_day: currentRaw.is_day === 1,
  };
  const daily = takeDaily(raw.daily as Record<string, unknown> | undefined);
  const next_hours = takeHourly(
    raw.hourly as Record<string, unknown> | undefined,
    12,
  );
  const resolved: WeatherPlace = { ...place, timezone, label: place.label };
  const json = {
    source: "open-meteo",
    place: resolved.label,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
    timezone,
    current,
    daily,
    next_hours,
  };
  const text = formatBlock(resolved, json);
  const summary = `${resolved.label} · ${current.temp_f}°F · ${current.weather}`;
  return {
    place: resolved,
    current,
    daily,
    hourly: next_hours,
    json,
    text,
    summary,
  };
}
