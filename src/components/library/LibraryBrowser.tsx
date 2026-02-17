// ============================================================================
// LibraryBrowser – main library navigation with sidebar
// ============================================================================

import React, {
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
} from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { MediaSourceType } from '../../types/media';
import type { LibrarySection, SourceToggleState } from '../../types/library';
import { theme, sourceColors, sourceLabels } from './styles';

// ---------------------------------------------------------------------------
// Sidebar section configuration
// ---------------------------------------------------------------------------

interface SidebarItem {
  key: LibrarySection;
  label: string;
  route: string;
  requiredSource?: MediaSourceType;
}

const YOUR_LIBRARY: SidebarItem[] = [
  { key: 'liked-songs', label: 'Liked Songs', route: '/library/liked' },
  { key: 'recently-played', label: 'Recently Played', route: '/recently-played' },
  { key: 'playlists', label: 'Playlists', route: '/library/playlists' },
  { key: 'albums', label: 'Albums', route: '/library/albums' },
  { key: 'artists', label: 'Artists', route: '/library/artists' },
];

const BROWSE: SidebarItem[] = [
  { key: 'discover', label: 'Discover', route: '/discover', requiredSource: MediaSourceType.SPOTIFY },
  { key: 'trending', label: 'Trending', route: '/library/trending', requiredSource: MediaSourceType.YOUTUBE },
  { key: 'new-releases', label: 'New Releases', route: '/library/new-releases' },
  { key: 'genres', label: 'Genres', route: '/library/genres' },
];

const JELLYFIN_SECTIONS: SidebarItem[] = [
  { key: 'jellyfin-library', label: 'Music Library', route: '/library/jellyfin', requiredSource: MediaSourceType.JELLYFIN },
  { key: 'jellyfin-recent', label: 'Recently Added', route: '/library/jellyfin/recent', requiredSource: MediaSourceType.JELLYFIN },
  { key: 'jellyfin-artists', label: 'By Artist', route: '/library/jellyfin/artists', requiredSource: MediaSourceType.JELLYFIN },
  { key: 'jellyfin-albums', label: 'By Album', route: '/library/jellyfin/albums', requiredSource: MediaSourceType.JELLYFIN },
  { key: 'jellyfin-genres', label: 'By Genre', route: '/library/jellyfin/genres', requiredSource: MediaSourceType.JELLYFIN },
];

// ---------------------------------------------------------------------------
// Source toggle persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'media-hub:source-toggles';

function loadToggles(): SourceToggleState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as SourceToggleState;
  } catch { /* ignore */ }
  return { spotify: true, youtube: true, jellyfin: true };
}

function saveToggles(state: SourceToggleState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LibraryBrowserProps {
  /** Called when source toggles change, so parent can pass them to services. */
  onSourceToggle?: (sources: SourceToggleState) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryBrowser({ onSourceToggle }: LibraryBrowserProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sources, setSources] = useState<SourceToggleState>(loadToggles);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    saveToggles(sources);
    onSourceToggle?.(sources);
  }, [sources, onSourceToggle]);

  const toggleSource = useCallback((key: keyof SourceToggleState) => {
    setSources((prev) => {
      // Don't allow disabling all sources
      const next = { ...prev, [key]: !prev[key] };
      if (!next.spotify && !next.youtube && !next.jellyfin) return prev;
      return next;
    });
  }, []);

  const isActive = (route: string) => location.pathname.startsWith(route);

  const isSourceEnabled = (item: SidebarItem) => {
    if (!item.requiredSource) return true;
    return sources[item.requiredSource];
  };

  const renderItem = (item: SidebarItem) => {
    if (!isSourceEnabled(item)) return null;
    const active = isActive(item.route);
    return (
      <button
        key={item.key}
        onClick={() => navigate(item.route)}
        style={{
          ...sidebarButton,
          backgroundColor: active ? theme.bgActive : 'transparent',
          color: active ? theme.text : theme.textSecondary,
          fontWeight: active ? 600 : 400,
        }}
        onMouseEnter={(e) => {
          if (!active) (e.target as HTMLElement).style.backgroundColor = theme.bgHover;
        }}
        onMouseLeave={(e) => {
          if (!active) (e.target as HTMLElement).style.backgroundColor = 'transparent';
        }}
      >
        {item.label}
      </button>
    );
  };

  return (
    <div style={container}>
      {/* ---- Sidebar --------------------------------------------------- */}
      <aside
        style={{
          ...sidebar,
          width: sidebarCollapsed ? 0 : 240,
          padding: sidebarCollapsed ? 0 : '16px 12px',
          overflow: sidebarCollapsed ? 'hidden' : 'auto',
        }}
      >
        {/* Search link */}
        <button
          onClick={() => navigate('/search')}
          style={{
            ...sidebarButton,
            fontWeight: 600,
            marginBottom: 8,
            backgroundColor: isActive('/search') ? theme.bgActive : 'transparent',
            color: isActive('/search') ? theme.text : theme.textSecondary,
          }}
        >
          Search
        </button>

        {/* Your Library */}
        <SidebarGroup title="Your Library">
          {YOUR_LIBRARY.map(renderItem)}
        </SidebarGroup>

        {/* Browse */}
        <SidebarGroup title="Browse">
          {BROWSE.map(renderItem)}
        </SidebarGroup>

        {/* Your Media (Jellyfin) */}
        {sources.jellyfin && (
          <SidebarGroup title="Your Media">
            {JELLYFIN_SECTIONS.map(renderItem)}
          </SidebarGroup>
        )}

        {/* Source toggles */}
        <div style={{ marginTop: 24, padding: '12px 0', borderTop: `1px solid ${theme.border}` }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 8 }}>
            Sources
          </div>
          {(Object.keys(sources) as Array<keyof SourceToggleState>).map((key) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: 13,
                color: sources[key] ? theme.text : theme.textMuted,
              }}
            >
              <input
                type="checkbox"
                checked={sources[key]}
                onChange={() => toggleSource(key)}
                style={{ accentColor: sourceColors[key as MediaSourceType] }}
              />
              {sourceLabels[key as MediaSourceType]}
            </label>
          ))}
        </div>
      </aside>

      {/* ---- Main content area ------------------------------------------ */}
      <main style={mainContent}>
        {/* Breadcrumb + sidebar toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <button
            onClick={() => setSidebarCollapsed((p) => !p)}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textSecondary,
              cursor: 'pointer',
              fontSize: 18,
              padding: 4,
            }}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          >
            {sidebarCollapsed ? '\u{2630}' : '\u{2715}'}
          </button>

          <Breadcrumbs />
        </div>

        {/* Routed content */}
        <Outlet />
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarGroup
// ---------------------------------------------------------------------------

function SidebarGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: theme.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 4,
        paddingLeft: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Breadcrumbs
// ---------------------------------------------------------------------------

function Breadcrumbs() {
  const location = useLocation();
  const navigate = useNavigate();

  const segments = location.pathname.split('/').filter(Boolean);

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
      {segments.map((segment, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = decodeURIComponent(segment).replace(/-/g, ' ');

        return (
          <React.Fragment key={path}>
            {i > 0 && <span style={{ color: theme.textMuted }}>/</span>}
            {isLast ? (
              <span style={{ color: theme.text, fontWeight: 500, textTransform: 'capitalize' }}>{label}</span>
            ) : (
              <button
                onClick={() => navigate(path)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: 0,
                  fontSize: 13,
                  textTransform: 'capitalize',
                }}
              >
                {label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const container: CSSProperties = {
  display: 'flex',
  height: '100%',
  backgroundColor: theme.bg,
  color: theme.text,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const sidebar: CSSProperties = {
  backgroundColor: theme.bgElevated,
  borderRight: `1px solid ${theme.border}`,
  flexShrink: 0,
  transition: 'width 0.2s ease, padding 0.2s ease',
  overflowY: 'auto',
};

const mainContent: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: 24,
  minWidth: 0,
};

const sidebarButton: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  background: 'none',
  border: 'none',
  padding: '8px 8px',
  borderRadius: theme.radiusSmall,
  fontSize: 14,
  cursor: 'pointer',
  transition: theme.transition,
};
