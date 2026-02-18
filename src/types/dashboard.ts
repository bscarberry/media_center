// ============================================================================
// Dashboard types – weather, news, and widget framework
// ============================================================================

// ---------------------------------------------------------------------------
// Weather
// ---------------------------------------------------------------------------

export type TemperatureUnit = 'F' | 'C';

export type WeatherCondition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'overcast'
  | 'mist'
  | 'rain_light'
  | 'rain'
  | 'rain_heavy'
  | 'thunderstorm'
  | 'snow_light'
  | 'snow'
  | 'snow_heavy'
  | 'sleet'
  | 'fog'
  | 'wind';

export interface WeatherCurrent {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  visibility: number;
  uvIndex: number;
  condition: WeatherCondition;
  description: string;
  icon: string;
  updatedAt: number;
}

export interface WeatherHourly {
  time: number;
  temp: number;
  precipProbability: number;
  condition: WeatherCondition;
  icon: string;
  windSpeed: number;
  humidity: number;
}

export interface WeatherDaily {
  date: number;
  high: number;
  low: number;
  condition: WeatherCondition;
  icon: string;
  precipProbability: number;
  sunrise: number;
  sunset: number;
  description: string;
}

export type AlertSeverity = 'minor' | 'moderate' | 'severe' | 'extreme';

export interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  event: string;
  start: number;
  expires: number;
  source: string;
}

export interface WeatherData {
  current: WeatherCurrent;
  hourly: WeatherHourly[];
  daily: WeatherDaily[];
  alerts: WeatherAlert[];
  location: WeatherLocation;
}

export interface WeatherLocation {
  name: string;
  lat: number;
  lon: number;
  country: string;
  region?: string;
}

export interface WeatherSettings {
  unit: TemperatureUnit;
  refreshIntervalMs: number;
  locations: WeatherLocation[];
  activeLocationIndex: number;
  showHourly: boolean;
  showDaily: boolean;
  showAlerts: boolean;
}

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  unit: 'F',
  refreshIntervalMs: 15 * 60 * 1000,
  locations: [],
  activeLocationIndex: 0,
  showHourly: true,
  showDaily: true,
  showAlerts: true,
};

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export type NewsCategory =
  | 'all'
  | 'technology'
  | 'world'
  | 'business'
  | 'entertainment'
  | 'sports'
  | 'science'
  | 'health';

export const NEWS_CATEGORIES: NewsCategory[] = [
  'all',
  'technology',
  'world',
  'business',
  'entertainment',
  'sports',
  'science',
  'health',
];

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string | null;
  source: string;
  author: string | null;
  publishedAt: number;
  category: NewsCategory;
  isRead: boolean;
  isBookmarked: boolean;
  content: string | null;
}

export interface NewsSettings {
  preferredCategories: NewsCategory[];
  refreshIntervalMs: number;
  articlesPerPage: number;
  excludedSources: string[];
}

export const DEFAULT_NEWS_SETTINGS: NewsSettings = {
  preferredCategories: ['all'],
  refreshIntervalMs: 30 * 60 * 1000,
  articlesPerPage: 20,
  excludedSources: [],
};

// ---------------------------------------------------------------------------
// Widget Framework
// ---------------------------------------------------------------------------

export type WidgetId = 'weather' | 'news' | string;

export interface WidgetConfig {
  id: WidgetId;
  title: string;
  icon: string;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  removable: boolean;
}

export interface WidgetLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

export interface DashboardLayout {
  widgets: WidgetLayoutItem[];
  sidebarWidth: number;
  sidebarCollapsed: boolean;
}

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
  widgets: [
    { i: 'weather', x: 0, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
    { i: 'news', x: 0, y: 4, w: 2, h: 5, minW: 2, minH: 3 },
  ],
  sidebarWidth: 380,
  sidebarCollapsed: false,
};

// ---------------------------------------------------------------------------
// Dashboard Store State
// ---------------------------------------------------------------------------

export interface DashboardState {
  layout: DashboardLayout;
  weatherSettings: WeatherSettings;
  newsSettings: NewsSettings;
  widgetVisibility: Record<WidgetId, boolean>;
  readArticleIds: Set<string>;
  bookmarkedArticleIds: Set<string>;
}

export const DEFAULT_DASHBOARD_STATE: DashboardState = {
  layout: DEFAULT_DASHBOARD_LAYOUT,
  weatherSettings: DEFAULT_WEATHER_SETTINGS,
  newsSettings: DEFAULT_NEWS_SETTINGS,
  widgetVisibility: { weather: true, news: true },
  readArticleIds: new Set(),
  bookmarkedArticleIds: new Set(),
};
