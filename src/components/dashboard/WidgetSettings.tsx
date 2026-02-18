// ============================================================================
// WidgetSettings – configuration panels for weather and news widgets
// ============================================================================

import React, { useState, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardStore } from './useDashboardStore';
import {
  d,
  iconButton,
  pill,
  pillActive,
} from './theme';
import { categoryLabel } from '../../services/news/NewsService';
import type { TemperatureUnit, NewsCategory, WeatherLocation } from '../../types/dashboard';
import { NEWS_CATEGORIES } from '../../types/dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WidgetSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'weather' | 'news';
  onSearchLocation?: (query: string) => Promise<WeatherLocation[]>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WidgetSettings({ isOpen, onClose, activeTab, onSearchLocation }: WidgetSettingsProps) {
  const [tab, setTab] = useState<'weather' | 'news'>(activeTab);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={backdrop}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={panel}
            role="dialog"
            aria-label="Widget settings"
          >
            {/* Header */}
            <div style={header}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: d.text, margin: 0 }}>
                Settings
              </h3>
              <button onClick={onClose} style={iconButton} aria-label="Close settings">
                {'\u2715'}
              </button>
            </div>

            {/* Tabs */}
            <div style={tabBar}>
              <button
                onClick={() => setTab('weather')}
                style={tab === 'weather' ? tabActive : tabButton}
              >
                Weather
              </button>
              <button
                onClick={() => setTab('news')}
                style={tab === 'news' ? tabActive : tabButton}
              >
                News
              </button>
            </div>

            {/* Content */}
            <div style={body}>
              {tab === 'weather' ? (
                <WeatherSettingsPanel onSearchLocation={onSearchLocation} />
              ) : (
                <NewsSettingsPanel />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Weather Settings Panel
// ---------------------------------------------------------------------------

function WeatherSettingsPanel({ onSearchLocation }: { onSearchLocation?: (q: string) => Promise<WeatherLocation[]> }) {
  const {
    weatherSettings,
    setTemperatureUnit,
    setWeatherRefreshInterval,
    addWeatherLocation,
    removeWeatherLocation,
    setActiveLocation,
    toggleWeatherSection,
  } = useDashboardStore();

  const [locationQuery, setLocationQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);

  const handleLocationSearch = useCallback(async () => {
    if (!locationQuery.trim() || !onSearchLocation) return;
    setSearching(true);
    try {
      const results = await onSearchLocation(locationQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }, [locationQuery, onSearchLocation]);

  const handleAddLocation = useCallback(
    (loc: WeatherLocation) => {
      addWeatherLocation(loc);
      setSearchResults([]);
      setLocationQuery('');
    },
    [addWeatherLocation],
  );

  return (
    <div>
      {/* Temperature Unit */}
      <SettingsGroup label="Temperature Unit">
        <div style={{ display: 'flex', gap: 8 }}>
          {(['F', 'C'] as TemperatureUnit[]).map((u) => (
            <button
              key={u}
              onClick={() => setTemperatureUnit(u)}
              style={u === weatherSettings.unit ? pillActive : pill}
            >
              {'\u00B0'}{u}
            </button>
          ))}
        </div>
      </SettingsGroup>

      {/* Refresh Interval */}
      <SettingsGroup label="Update Frequency">
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '5 min', ms: 5 * 60 * 1000 },
            { label: '15 min', ms: 15 * 60 * 1000 },
            { label: '30 min', ms: 30 * 60 * 1000 },
            { label: '1 hour', ms: 60 * 60 * 1000 },
          ].map((opt) => (
            <button
              key={opt.ms}
              onClick={() => setWeatherRefreshInterval(opt.ms)}
              style={opt.ms === weatherSettings.refreshIntervalMs ? pillActive : pill}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingsGroup>

      {/* Sections Visibility */}
      <SettingsGroup label="Show/Hide Sections">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'showHourly' as const, label: 'Hourly Forecast' },
            { key: 'showDaily' as const, label: '7-Day Forecast' },
            { key: 'showAlerts' as const, label: 'Weather Alerts' },
          ].map((section) => (
            <label key={section.key} style={checkboxLabel}>
              <input
                type="checkbox"
                checked={weatherSettings[section.key]}
                onChange={() => toggleWeatherSection(section.key)}
                style={checkbox}
              />
              <span>{section.label}</span>
            </label>
          ))}
        </div>
      </SettingsGroup>

      {/* Locations */}
      <SettingsGroup label="Locations">
        {/* Saved locations */}
        {weatherSettings.locations.map((loc, i) => (
          <div key={`${loc.lat}-${loc.lon}`} style={locationRow}>
            <button
              onClick={() => setActiveLocation(i)}
              style={{
                ...pill,
                ...(i === weatherSettings.activeLocationIndex ? { borderColor: d.accent, color: d.accent } : {}),
                flex: 1,
                justifyContent: 'flex-start',
              }}
            >
              {loc.name}, {loc.country}
              {loc.region && ` (${loc.region})`}
            </button>
            <button
              onClick={() => removeWeatherLocation(i)}
              style={{ ...iconButton, fontSize: 12 }}
              aria-label={`Remove ${loc.name}`}
            >
              {'\u2715'}
            </button>
          </div>
        ))}

        {/* Add location */}
        {onSearchLocation && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleLocationSearch();
                }}
                placeholder="Search city..."
                style={textInput}
              />
              <button onClick={handleLocationSearch} style={pill} disabled={searching}>
                {searching ? '...' : 'Search'}
              </button>
            </div>

            {/* Search results */}
            {searchResults.length > 0 && (
              <div style={searchResultsList}>
                {searchResults.map((loc, i) => (
                  <button
                    key={i}
                    onClick={() => handleAddLocation(loc)}
                    style={searchResultItem}
                  >
                    {loc.name}, {loc.region && `${loc.region}, `}{loc.country}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </SettingsGroup>
    </div>
  );
}

// ---------------------------------------------------------------------------
// News Settings Panel
// ---------------------------------------------------------------------------

function NewsSettingsPanel() {
  const {
    newsSettings,
    setNewsCategories,
    setNewsRefreshInterval,
    setArticlesPerPage,
  } = useDashboardStore();

  const toggleCategory = useCallback(
    (cat: NewsCategory) => {
      const current = newsSettings.preferredCategories;
      if (cat === 'all') {
        setNewsCategories(['all']);
        return;
      }
      const without = current.filter((c) => c !== 'all' && c !== cat);
      if (current.includes(cat)) {
        setNewsCategories(without.length === 0 ? ['all'] : without);
      } else {
        setNewsCategories([...without, cat]);
      }
    },
    [newsSettings.preferredCategories, setNewsCategories],
  );

  return (
    <div>
      {/* Preferred Categories */}
      <SettingsGroup label="Preferred Categories">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCategory(cat)}
              style={newsSettings.preferredCategories.includes(cat) ? pillActive : pill}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </SettingsGroup>

      {/* Update Frequency */}
      <SettingsGroup label="Update Frequency">
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '15 min', ms: 15 * 60 * 1000 },
            { label: '30 min', ms: 30 * 60 * 1000 },
            { label: '1 hour', ms: 60 * 60 * 1000 },
            { label: '2 hours', ms: 2 * 60 * 60 * 1000 },
          ].map((opt) => (
            <button
              key={opt.ms}
              onClick={() => setNewsRefreshInterval(opt.ms)}
              style={opt.ms === newsSettings.refreshIntervalMs ? pillActive : pill}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingsGroup>

      {/* Articles Per Page */}
      <SettingsGroup label="Articles Per Page">
        <div style={{ display: 'flex', gap: 8 }}>
          {[10, 20, 30, 50].map((count) => (
            <button
              key={count}
              onClick={() => setArticlesPerPage(count)}
              style={count === newsSettings.articlesPerPage ? pillActive : pill}
            >
              {count}
            </button>
          ))}
        </div>
      </SettingsGroup>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared settings sub-components
// ---------------------------------------------------------------------------

function SettingsGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={settingsGroup}>
      <div style={settingsLabel}>{label}</div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 4000,
};

const panel: CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 420,
  maxWidth: '90vw',
  maxHeight: '80vh',
  backgroundColor: d.bgWidget,
  borderRadius: d.radius + 4,
  border: `1px solid ${d.border}`,
  zIndex: 4001,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: `1px solid ${d.border}`,
  flexShrink: 0,
};

const tabBar: CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: `1px solid ${d.border}`,
  flexShrink: 0,
};

const tabButton: CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: d.textSecondary,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${d.transitionFast}`,
};

const tabActive: CSSProperties = {
  ...tabButton,
  color: d.text,
  borderBottomColor: d.accent,
};

const body: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 16,
};

const settingsGroup: CSSProperties = {
  marginBottom: 20,
};

const settingsLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: d.textSecondary,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 8,
};

const checkboxLabel: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  color: d.text,
  cursor: 'pointer',
};

const checkbox: CSSProperties = {
  accentColor: d.accent,
};

const locationRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  marginBottom: 4,
};

const textInput: CSSProperties = {
  flex: 1,
  padding: '6px 12px',
  borderRadius: d.radiusSmall,
  border: `1px solid ${d.border}`,
  backgroundColor: d.bgSurface,
  color: d.text,
  fontSize: 13,
  outline: 'none',
};

const searchResultsList: CSSProperties = {
  marginTop: 4,
  border: `1px solid ${d.border}`,
  borderRadius: d.radiusSmall,
  overflow: 'hidden',
};

const searchResultItem: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  background: 'none',
  border: 'none',
  borderBottom: `1px solid ${d.border}`,
  color: d.text,
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
};
