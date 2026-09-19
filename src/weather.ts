export const WEATHER_START = "<!-- weather:start -->";
export const WEATHER_END = "<!-- weather:end -->";

export const DEFAULT_LOCATION_QUERY = "Columbus, OH";

const WEATHER_BLOCK = /<!-- weather:start -->[\s\S]*?<!-- weather:end -->/;

export function weatherPlaceholder(): string {
  return `${WEATHER_START}
No live weather loaded yet. Click Load weather (Open-Meteo, no extra key). Jev can still judge from the situation if you skip it.
${WEATHER_END}`;
}

export function mergeWeatherIntoCase(caseText: string, inner: string): string {
  const block = `${WEATHER_START}\n${inner.trim()}\n${WEATHER_END}`;
  if (WEATHER_BLOCK.test(caseText)) {
    return caseText.replace(WEATHER_BLOCK, block);
  }
  const trimmed = caseText.trim();
  return trimmed ? `${block}\n\n${trimmed}` : block;
}

export type WeatherResponse = {
  ok: boolean;
  place?: { label: string; latitude: number; longitude: number };
  text?: string;
  summary?: string;
  message?: string;
};
