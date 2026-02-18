// ============================================================================
// WeatherService – fetches weather data from OpenWeatherMap API
// ============================================================================
//
// Supports current conditions, hourly forecast (48h), daily forecast (7d),
// and severe weather alerts. Results are cached with configurable TTL and
// auto-refreshed on a timer.
// ============================================================================

import type {
  WeatherData,
  WeatherCurrent,
  WeatherHourly,
  WeatherDaily,
  WeatherAlert,
  WeatherLocation,
  WeatherCondition,
  TemperatureUnit,
} from '../../types/dashboard';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface WeatherServiceConfig {
  apiKey: string;
  unit?: TemperatureUnit;
  cacheTtlMs?: number;
}

interface CacheEntry {
  data: WeatherData;
  timestamp: number;
}

// OpenWeatherMap One Call 3.0 response shapes (subset)
interface OWMCurrent {
  dt: number;
  temp: number;
  feels_like: number;
  humidity: number;
  wind_speed: number;
  wind_deg: number;
  visibility: number;
  uvi: number;
  weather: OWMWeather[];
}

interface OWMHourly {
  dt: number;
  temp: number;
  pop: number;
  wind_speed: number;
  humidity: number;
  weather: OWMWeather[];
}

interface OWMDaily {
  dt: number;
  temp: { min: number; max: number };
  pop: number;
  sunrise: number;
  sunset: number;
  weather: OWMWeather[];
}

interface OWMAlert {
  sender_name: string;
  event: string;
  start: number;
  end: number;
  description: string;
  tags: string[];
}

interface OWMWeather {
  id: number;
  main: string;
  description: string;
  icon: string;
}

interface OWMOneCallResponse {
  lat: number;
  lon: number;
  current: OWMCurrent;
  hourly: OWMHourly[];
  daily: OWMDaily[];
  alerts?: OWMAlert[];
}

interface OWMGeoResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEFAULT_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const BASE_URL = 'https://api.openweathermap.org';

export class WeatherService {
  private apiKey: string;
  private unit: TemperatureUnit;
  private cacheTtlMs: number;
  private cache = new Map<string, CacheEntry>();
  private refreshTimers = new Map<string, ReturnType<typeof setInterval>>();
  private listeners = new Map<string, Set<(data: WeatherData) => void>>();

  constructor(config: WeatherServiceConfig) {
    this.apiKey = config.apiKey;
    this.unit = config.unit ?? 'F';
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL;
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Fetch complete weather data for a location */
  async getWeather(location: WeatherLocation): Promise<WeatherData> {
    const key = this.cacheKey(location);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    const units = this.unit === 'C' ? 'metric' : 'imperial';
    const url =
      `${BASE_URL}/data/3.0/onecall?lat=${location.lat}&lon=${location.lon}` +
      `&units=${units}&exclude=minutely&appid=${this.apiKey}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Weather API error: ${res.status} ${res.statusText}`);
    }

    const raw: OWMOneCallResponse = await res.json();
    const data = this.mapResponse(raw, location);

    this.cache.set(key, { data, timestamp: Date.now() });
    return data;
  }

  /** Search for locations by name */
  async searchLocations(query: string): Promise<WeatherLocation[]> {
    const url =
      `${BASE_URL}/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${this.apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return [];

    const results: OWMGeoResult[] = await res.json();
    return results.map((r) => ({
      name: r.name,
      lat: r.lat,
      lon: r.lon,
      country: r.country,
      region: r.state,
    }));
  }

  /** Reverse geocode coordinates to a location name */
  async reverseGeocode(lat: number, lon: number): Promise<WeatherLocation | null> {
    const url =
      `${BASE_URL}/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${this.apiKey}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const results: OWMGeoResult[] = await res.json();
    if (results.length === 0) return null;

    const r = results[0];
    return { name: r.name, lat: r.lat, lon: r.lon, country: r.country, region: r.state };
  }

  /** Start auto-refreshing weather for a location */
  startAutoRefresh(location: WeatherLocation, intervalMs?: number): void {
    const key = this.cacheKey(location);
    this.stopAutoRefresh(location);

    const interval = intervalMs ?? this.cacheTtlMs;
    const timer = setInterval(async () => {
      try {
        this.cache.delete(key); // force fresh fetch
        const data = await this.getWeather(location);
        this.notifyListeners(key, data);
      } catch {
        // Silent – cached data remains available
      }
    }, interval);

    this.refreshTimers.set(key, timer);
  }

  /** Stop auto-refresh for a location */
  stopAutoRefresh(location: WeatherLocation): void {
    const key = this.cacheKey(location);
    const timer = this.refreshTimers.get(key);
    if (timer) {
      clearInterval(timer);
      this.refreshTimers.delete(key);
    }
  }

  /** Subscribe to weather updates for a location */
  onUpdate(location: WeatherLocation, callback: (data: WeatherData) => void): () => void {
    const key = this.cacheKey(location);
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(callback);
    return () => {
      set!.delete(callback);
      if (set!.size === 0) this.listeners.delete(key);
    };
  }

  /** Set temperature unit and clear cache */
  setUnit(unit: TemperatureUnit): void {
    this.unit = unit;
    this.cache.clear();
  }

  /** Clear all cached data */
  clearCache(): void {
    this.cache.clear();
  }

  /** Stop all timers and clear state */
  dispose(): void {
    for (const timer of this.refreshTimers.values()) {
      clearInterval(timer);
    }
    this.refreshTimers.clear();
    this.listeners.clear();
    this.cache.clear();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private cacheKey(location: WeatherLocation): string {
    return `${location.lat.toFixed(4)},${location.lon.toFixed(4)}`;
  }

  private notifyListeners(key: string, data: WeatherData): void {
    const set = this.listeners.get(key);
    if (set) {
      for (const cb of set) cb(data);
    }
  }

  private mapResponse(raw: OWMOneCallResponse, location: WeatherLocation): WeatherData {
    const current: WeatherCurrent = {
      temp: Math.round(raw.current.temp),
      feelsLike: Math.round(raw.current.feels_like),
      humidity: raw.current.humidity,
      windSpeed: Math.round(raw.current.wind_speed),
      windDirection: raw.current.wind_deg,
      visibility: Math.round(raw.current.visibility / 1000), // km
      uvIndex: raw.current.uvi,
      condition: this.mapCondition(raw.current.weather[0]?.id ?? 800),
      description: raw.current.weather[0]?.description ?? 'Unknown',
      icon: raw.current.weather[0]?.icon ?? '01d',
      updatedAt: raw.current.dt * 1000,
    };

    const hourly: WeatherHourly[] = raw.hourly.slice(0, 48).map((h) => ({
      time: h.dt * 1000,
      temp: Math.round(h.temp),
      precipProbability: Math.round(h.pop * 100),
      condition: this.mapCondition(h.weather[0]?.id ?? 800),
      icon: h.weather[0]?.icon ?? '01d',
      windSpeed: Math.round(h.wind_speed),
      humidity: h.humidity,
    }));

    const daily: WeatherDaily[] = raw.daily.slice(0, 7).map((d) => ({
      date: d.dt * 1000,
      high: Math.round(d.temp.max),
      low: Math.round(d.temp.min),
      condition: this.mapCondition(d.weather[0]?.id ?? 800),
      icon: d.weather[0]?.icon ?? '01d',
      precipProbability: Math.round(d.pop * 100),
      sunrise: d.sunrise * 1000,
      sunset: d.sunset * 1000,
      description: d.weather[0]?.description ?? '',
    }));

    const alerts: WeatherAlert[] = (raw.alerts ?? []).map((a, i) => ({
      id: `alert-${a.start}-${i}`,
      title: a.event,
      description: a.description,
      severity: this.mapAlertSeverity(a.tags),
      event: a.event,
      start: a.start * 1000,
      expires: a.end * 1000,
      source: a.sender_name,
    }));

    return { current, hourly, daily, alerts, location };
  }

  private mapCondition(owmId: number): WeatherCondition {
    if (owmId >= 200 && owmId < 300) return 'thunderstorm';
    if (owmId >= 300 && owmId < 400) return 'rain_light';
    if (owmId >= 500 && owmId < 505) return owmId <= 501 ? 'rain_light' : 'rain';
    if (owmId === 511) return 'sleet';
    if (owmId >= 520 && owmId < 600) return 'rain_heavy';
    if (owmId >= 600 && owmId < 610) return 'snow_light';
    if (owmId >= 610 && owmId < 620) return 'sleet';
    if (owmId >= 620 && owmId < 700) return 'snow';
    if (owmId === 701 || owmId === 741) return 'fog';
    if (owmId >= 700 && owmId < 800) return 'mist';
    if (owmId === 800) return 'clear';
    if (owmId === 801) return 'partly_cloudy';
    if (owmId === 802) return 'cloudy';
    return 'overcast';
  }

  private mapAlertSeverity(tags: string[]): WeatherAlert['severity'] {
    const joined = tags.join(' ').toLowerCase();
    if (joined.includes('extreme')) return 'extreme';
    if (joined.includes('severe')) return 'severe';
    if (joined.includes('moderate')) return 'moderate';
    return 'minor';
  }
}

// ---------------------------------------------------------------------------
// Helpers: weather icons → condition symbols
// ---------------------------------------------------------------------------

const WEATHER_ICONS: Record<WeatherCondition, string> = {
  clear: '\u2600\uFE0F',
  partly_cloudy: '\u26C5',
  cloudy: '\u2601\uFE0F',
  overcast: '\u2601\uFE0F',
  mist: '\uD83C\uDF2B\uFE0F',
  rain_light: '\uD83C\uDF26\uFE0F',
  rain: '\uD83C\uDF27\uFE0F',
  rain_heavy: '\uD83C\uDF27\uFE0F',
  thunderstorm: '\u26C8\uFE0F',
  snow_light: '\uD83C\uDF28\uFE0F',
  snow: '\u2744\uFE0F',
  snow_heavy: '\u2744\uFE0F',
  sleet: '\uD83C\uDF28\uFE0F',
  fog: '\uD83C\uDF2B\uFE0F',
  wind: '\uD83C\uDF2C\uFE0F',
};

export function weatherConditionIcon(condition: WeatherCondition): string {
  return WEATHER_ICONS[condition] ?? '\u2601\uFE0F';
}

export function formatTemp(temp: number, unit: TemperatureUnit): string {
  return `${Math.round(temp)}\u00B0${unit}`;
}

export function convertTemp(temp: number, from: TemperatureUnit, to: TemperatureUnit): number {
  if (from === to) return temp;
  if (from === 'F' && to === 'C') return (temp - 32) * (5 / 9);
  return temp * (9 / 5) + 32;
}
