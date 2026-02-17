// ============================================================================
// UnifiedSearch – search across Spotify, YouTube, and Jellyfin
// ============================================================================

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchService } from '../../services/search/SearchService';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { ContentType, SearchFilters, SearchResults } from '../../types/library';
import { DEFAULT_SEARCH_FILTERS, EMPTY_SEARCH_RESULTS } from '../../types/library';
import {
  ContentGrid,
  GridSkeleton,
} from './ContentGrid';
import {
  theme,
  pill,
  pillActive,
  truncate,
  sourceLabels,
} from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface UnifiedSearchProps {
  searchService: SearchService;
  onPlayTrack?: (track: MediaTrack) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

type ResultTab = 'all' | 'tracks' | 'albums' | 'artists' | 'playlists';

const TAB_LABELS: { key: ResultTab; label: string }[] = [
  { key: 'all', label: 'All Results' },
  { key: 'tracks', label: 'Tracks' },
  { key: 'albums', label: 'Albums' },
  { key: 'artists', label: 'Artists' },
  { key: 'playlists', label: 'Playlists' },
];

// ---------------------------------------------------------------------------
// Source and type filters
// ---------------------------------------------------------------------------

const SOURCE_OPTIONS: { value: MediaSourceType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: MediaSourceType.SPOTIFY, label: 'Spotify' },
  { value: MediaSourceType.YOUTUBE, label: 'YouTube' },
  { value: MediaSourceType.JELLYFIN, label: 'Jellyfin' },
];

const TYPE_OPTIONS: { value: ContentType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'track', label: 'Tracks' },
  { value: 'album', label: 'Albums' },
  { value: 'artist', label: 'Artists' },
  { value: 'playlist', label: 'Playlists' },
];

// ---------------------------------------------------------------------------
// Hook: debounced value
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UnifiedSearch({ searchService, onPlayTrack, onAddToQueue }: UnifiedSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<ResultTab>('all');
  const [sourcesFilter, setSourcesFilter] = useState<(MediaSourceType | 'all')[]>(['all']);
  const [typesFilter, setTypesFilter] = useState<(ContentType | 'all')[]>(['all']);

  const debouncedQuery = useDebouncedValue(query, 300);

  // -- Keyboard shortcut: Cmd+K / Ctrl+K focuses input --------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // -- Build filters -------------------------------------------------------
  const filters: SearchFilters = useMemo(() => {
    const sources = sourcesFilter.includes('all')
      ? DEFAULT_SEARCH_FILTERS.sources
      : sourcesFilter.filter((s): s is MediaSourceType => s !== 'all');

    const contentTypes = typesFilter.includes('all')
      ? DEFAULT_SEARCH_FILTERS.contentTypes
      : typesFilter.filter((t): t is ContentType => t !== 'all');

    return { sources, contentTypes, limit: 30 };
  }, [sourcesFilter, typesFilter]);

  // -- Search query via TanStack Query ------------------------------------
  const { data: results, isLoading, isFetching } = useQuery<SearchResults>({
    queryKey: ['search', debouncedQuery, filters],
    queryFn: () => searchService.search(debouncedQuery, filters),
    enabled: debouncedQuery.trim().length > 0,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  const searchResults = results ?? EMPTY_SEARCH_RESULTS;
  const hasResults =
    searchResults.tracks.length > 0 ||
    searchResults.albums.length > 0 ||
    searchResults.artists.length > 0 ||
    searchResults.playlists.length > 0;

  // -- Filter toggling -----------------------------------------------------
  const toggleSource = useCallback((value: MediaSourceType | 'all') => {
    if (value === 'all') {
      setSourcesFilter(['all']);
      return;
    }
    setSourcesFilter((prev) => {
      const without = prev.filter((s) => s !== 'all' && s !== value);
      if (prev.includes(value)) {
        return without.length === 0 ? ['all'] : without;
      }
      const next = [...without, value];
      return next.length === 3 ? ['all'] : next;
    });
  }, []);

  const toggleType = useCallback((value: ContentType | 'all') => {
    if (value === 'all') {
      setTypesFilter(['all']);
      return;
    }
    setTypesFilter((prev) => {
      const without = prev.filter((t) => t !== 'all' && t !== value);
      if (prev.includes(value)) {
        return without.length === 0 ? ['all'] : without;
      }
      const next = [...without, value];
      return next.length === 4 ? ['all'] : next;
    });
  }, []);

  // -- Infinite scroll sentinel ref ----------------------------------------
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting && searchResults.hasMore) {
          // In a full implementation, this would trigger loading the next page.
          // For now, the data layer returns `hasMore` but we don't paginate yet.
        }
      });
      observer.observe(node);
      return () => observer.disconnect();
    },
    [searchResults.hasMore],
  );

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* ---- Search bar ------------------------------------------------- */}
      <div style={searchBarContainer}>
        <span style={{ color: theme.textMuted, fontSize: 18, flexShrink: 0 }}>{'\u{1F50D}'}</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search across Spotify, YouTube, and your library..."
          style={searchInput}
        />
        {(isLoading || isFetching) && query.trim() && (
          <span style={{ color: theme.textMuted, fontSize: 12, flexShrink: 0 }}>Loading...</span>
        )}
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{
              background: 'none',
              border: 'none',
              color: theme.textMuted,
              cursor: 'pointer',
              fontSize: 18,
              padding: '0 4px',
              flexShrink: 0,
            }}
          >
            {'\u2715'}
          </button>
        )}
        <span style={{ color: theme.textMuted, fontSize: 11, flexShrink: 0 }}>
          {navigator.platform?.includes('Mac') ? '\u2318K' : 'Ctrl+K'}
        </span>
      </div>

      {/* ---- Filter pills ------------------------------------------------ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
        {SOURCE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleSource(opt.value)}
            style={sourcesFilter.includes(opt.value) ? pillActive : pill}
          >
            {opt.label}
          </button>
        ))}

        <span style={{ width: 1, backgroundColor: theme.border, margin: '0 4px' }} />

        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => toggleType(opt.value)}
            style={typesFilter.includes(opt.value) ? pillActive : pill}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ---- Result tabs ------------------------------------------------- */}
      {debouncedQuery.trim() && (
        <div style={{ display: 'flex', gap: 0, marginTop: 24, borderBottom: `1px solid ${theme.border}` }}>
          {TAB_LABELS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 20px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${theme.accent}` : '2px solid transparent',
                color: activeTab === tab.key ? theme.text : theme.textSecondary,
                fontSize: 14,
                fontWeight: activeTab === tab.key ? 600 : 400,
                cursor: 'pointer',
                transition: theme.transition,
              }}
            >
              {tab.label}
              {tab.key !== 'all' && searchResults[`${tab.key}` as keyof SearchResults] && (
                <span style={{ marginLeft: 6, fontSize: 11, color: theme.textMuted }}>
                  {(searchResults[`${tab.key}` as 'tracks' | 'albums' | 'artists' | 'playlists'] as unknown[]).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ---- Results ----------------------------------------------------- */}
      <div style={{ marginTop: 16 }}>
        {isLoading && !results && <GridSkeleton count={12} />}

        {!isLoading && debouncedQuery.trim() && !hasResults && (
          <div style={{ textAlign: 'center', padding: 60, color: theme.textSecondary }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>No results found</div>
            <div style={{ fontSize: 14, color: theme.textMuted }}>
              Try different keywords, check your spelling, or adjust your filters
            </div>
          </div>
        )}

        {hasResults && (
          <>
            {(activeTab === 'all' || activeTab === 'tracks') && searchResults.tracks.length > 0 && (
              <Section title="Tracks" show={activeTab === 'all'}>
                <ContentGrid
                  tracks={activeTab === 'all' ? searchResults.tracks.slice(0, 6) : searchResults.tracks}
                  trackListMode
                  onPlayTrack={onPlayTrack}
                  onAddToQueue={onAddToQueue}
                />
              </Section>
            )}

            {(activeTab === 'all' || activeTab === 'albums') && searchResults.albums.length > 0 && (
              <Section title="Albums" show={activeTab === 'all'}>
                <ContentGrid
                  albums={activeTab === 'all' ? searchResults.albums.slice(0, 6) : searchResults.albums}
                />
              </Section>
            )}

            {(activeTab === 'all' || activeTab === 'artists') && searchResults.artists.length > 0 && (
              <Section title="Artists" show={activeTab === 'all'}>
                <ContentGrid
                  artists={activeTab === 'all' ? searchResults.artists.slice(0, 6) : searchResults.artists}
                />
              </Section>
            )}

            {(activeTab === 'all' || activeTab === 'playlists') && searchResults.playlists.length > 0 && (
              <Section title="Playlists" show={activeTab === 'all'}>
                <ContentGrid
                  playlists={activeTab === 'all' ? searchResults.playlists.slice(0, 6) : searchResults.playlists}
                />
              </Section>
            )}

            <div ref={sentinelRef} style={{ height: 1 }} />
          </>
        )}

        {/* Source breakdown */}
        {hasResults && debouncedQuery.trim() && (
          <div style={{ display: 'flex', gap: 16, marginTop: 24, justifyContent: 'center' }}>
            {Object.entries(searchResults.sourceBreakdown).map(([source, count]) =>
              count > 0 ? (
                <span key={source} style={{ fontSize: 12, color: theme.textMuted }}>
                  {sourceLabels[source as MediaSourceType]}: {count} result{count !== 1 ? 's' : ''}
                </span>
              ) : null,
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header (only shows title when in "all" tab)
// ---------------------------------------------------------------------------

function Section({
  title,
  show,
  children,
}: {
  title: string;
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      {show && (
        <h3 style={{ fontSize: 18, fontWeight: 700, color: theme.text, marginBottom: 12 }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const searchBarContainer: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  backgroundColor: theme.surface,
  borderRadius: theme.radiusRound,
  padding: '12px 20px',
  border: `1px solid ${theme.border}`,
};

const searchInput: CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  outline: 'none',
  color: theme.text,
  fontSize: 16,
  fontFamily: 'inherit',
};
