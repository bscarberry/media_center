// ============================================================================
// dashboardStore – Zustand store for dashboard state with localStorage
// ============================================================================

import { createStore } from 'zustand/vanilla';
import type {
  DashboardLayout,
  WeatherSettings,
  NewsSettings,
  WidgetId,
  WidgetLayoutItem,
} from '../types/dashboard';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  DEFAULT_WEATHER_SETTINGS,
  DEFAULT_NEWS_SETTINGS,
} from '../types/dashboard';
import type { TemperatureUnit, NewsCategory } from '../types/dashboard';

// ---------------------------------------------------------------------------
// State + Actions
// ---------------------------------------------------------------------------

interface DashboardState {
  layout: DashboardLayout;
  weatherSettings: WeatherSettings;
  newsSettings: NewsSettings;
  widgetVisibility: Record<WidgetId, boolean>;
  readArticleIds: string[];
  bookmarkedArticleIds: string[];
}

interface DashboardActions {
  // Layout
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  updateWidgetLayout: (widgets: WidgetLayoutItem[]) => void;
  setWidgetVisible: (id: WidgetId, visible: boolean) => void;

  // Weather settings
  setTemperatureUnit: (unit: TemperatureUnit) => void;
  setWeatherRefreshInterval: (ms: number) => void;
  addWeatherLocation: (location: WeatherSettings['locations'][0]) => void;
  removeWeatherLocation: (index: number) => void;
  setActiveLocation: (index: number) => void;
  toggleWeatherSection: (section: 'showHourly' | 'showDaily' | 'showAlerts') => void;

  // News settings
  setNewsCategories: (categories: NewsCategory[]) => void;
  setNewsRefreshInterval: (ms: number) => void;
  setArticlesPerPage: (count: number) => void;
  toggleNewsSource: (source: string) => void;

  // Article tracking
  markArticleRead: (id: string) => void;
  toggleArticleBookmark: (id: string) => void;

  // Reset
  resetLayout: () => void;
}

export type DashboardStore = DashboardState & DashboardActions;

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'media-hub:dashboard';

function loadState(): Partial<DashboardState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveState(state: DashboardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      layout: state.layout,
      weatherSettings: state.weatherSettings,
      newsSettings: state.newsSettings,
      widgetVisibility: state.widgetVisibility,
      readArticleIds: state.readArticleIds.slice(-500), // cap stored IDs
      bookmarkedArticleIds: state.bookmarkedArticleIds,
    }));
  } catch {
    // Storage full or unavailable
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createDashboardStore() {
  const persisted = loadState();

  return createStore<DashboardStore>((set, get) => {
    const persist = () => saveState(get());

    return {
      // Initial state (persisted overrides defaults)
      layout: persisted.layout ?? { ...DEFAULT_DASHBOARD_LAYOUT },
      weatherSettings: persisted.weatherSettings ?? { ...DEFAULT_WEATHER_SETTINGS },
      newsSettings: persisted.newsSettings ?? { ...DEFAULT_NEWS_SETTINGS },
      widgetVisibility: persisted.widgetVisibility ?? { weather: true, news: true },
      readArticleIds: persisted.readArticleIds ?? [],
      bookmarkedArticleIds: persisted.bookmarkedArticleIds ?? [],

      // -- Layout actions ---------------------------------------------------

      setSidebarWidth: (width) => {
        set((s) => ({ layout: { ...s.layout, sidebarWidth: Math.max(300, Math.min(500, width)) } }));
        persist();
      },

      toggleSidebar: () => {
        set((s) => ({ layout: { ...s.layout, sidebarCollapsed: !s.layout.sidebarCollapsed } }));
        persist();
      },

      updateWidgetLayout: (widgets) => {
        set((s) => ({ layout: { ...s.layout, widgets } }));
        persist();
      },

      setWidgetVisible: (id, visible) => {
        set((s) => ({ widgetVisibility: { ...s.widgetVisibility, [id]: visible } }));
        persist();
      },

      // -- Weather settings -------------------------------------------------

      setTemperatureUnit: (unit) => {
        set((s) => ({ weatherSettings: { ...s.weatherSettings, unit } }));
        persist();
      },

      setWeatherRefreshInterval: (ms) => {
        set((s) => ({ weatherSettings: { ...s.weatherSettings, refreshIntervalMs: ms } }));
        persist();
      },

      addWeatherLocation: (location) => {
        set((s) => ({
          weatherSettings: {
            ...s.weatherSettings,
            locations: [...s.weatherSettings.locations, location],
          },
        }));
        persist();
      },

      removeWeatherLocation: (index) => {
        set((s) => {
          const locations = s.weatherSettings.locations.filter((_, i) => i !== index);
          const active = Math.min(s.weatherSettings.activeLocationIndex, Math.max(0, locations.length - 1));
          return {
            weatherSettings: {
              ...s.weatherSettings,
              locations,
              activeLocationIndex: active,
            },
          };
        });
        persist();
      },

      setActiveLocation: (index) => {
        set((s) => ({ weatherSettings: { ...s.weatherSettings, activeLocationIndex: index } }));
        persist();
      },

      toggleWeatherSection: (section) => {
        set((s) => ({
          weatherSettings: {
            ...s.weatherSettings,
            [section]: !s.weatherSettings[section],
          },
        }));
        persist();
      },

      // -- News settings ----------------------------------------------------

      setNewsCategories: (categories) => {
        set((s) => ({ newsSettings: { ...s.newsSettings, preferredCategories: categories } }));
        persist();
      },

      setNewsRefreshInterval: (ms) => {
        set((s) => ({ newsSettings: { ...s.newsSettings, refreshIntervalMs: ms } }));
        persist();
      },

      setArticlesPerPage: (count) => {
        set((s) => ({ newsSettings: { ...s.newsSettings, articlesPerPage: count } }));
        persist();
      },

      toggleNewsSource: (source) => {
        set((s) => {
          const excluded = s.newsSettings.excludedSources;
          const next = excluded.includes(source)
            ? excluded.filter((s) => s !== source)
            : [...excluded, source];
          return { newsSettings: { ...s.newsSettings, excludedSources: next } };
        });
        persist();
      },

      // -- Article tracking -------------------------------------------------

      markArticleRead: (id) => {
        set((s) => {
          if (s.readArticleIds.includes(id)) return s;
          return { readArticleIds: [...s.readArticleIds, id] };
        });
        persist();
      },

      toggleArticleBookmark: (id) => {
        set((s) => {
          const has = s.bookmarkedArticleIds.includes(id);
          return {
            bookmarkedArticleIds: has
              ? s.bookmarkedArticleIds.filter((b) => b !== id)
              : [...s.bookmarkedArticleIds, id],
          };
        });
        persist();
      },

      // -- Reset ------------------------------------------------------------

      resetLayout: () => {
        set({
          layout: { ...DEFAULT_DASHBOARD_LAYOUT },
          widgetVisibility: { weather: true, news: true },
        });
        persist();
      },
    };
  });
}
