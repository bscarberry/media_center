// ============================================================================
// App – root component with layout, routing, providers, and error boundary
// ============================================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HomePage } from './components/home/HomePage';
import { useSourceStatus, disconnectSource } from './hooks/useSourceStatus';
import { UnifiedSearch } from './components/library/UnifiedSearch';
import { SearchService } from './services/search/SearchService';
import { YouTubeService } from './services/youtube/YouTubeService';
import { WeatherService, weatherConditionIcon } from './services/weather/WeatherService';
import { timeAgo, categoryLabel } from './services/news/NewsService';
import type { WeatherData, WeatherLocation, NewsCategory } from './types/dashboard';
import { NEWS_CATEGORIES } from './types/dashboard';

// ---------------------------------------------------------------------------
// Providers & Stores
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 2 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Error Boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<
  { children: ReactNode; fallback?: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={errorFallbackStyle}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#b3b3b3', fontSize: 14, marginBottom: 16 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={retryBtnStyle}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const errorFallbackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: 40,
  textAlign: 'center',
  color: '#ffffff',
};

const retryBtnStyle: CSSProperties = {
  padding: '8px 24px',
  borderRadius: 9999,
  border: '1px solid #282828',
  backgroundColor: '#1db954',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div style={{ padding: 32 }}>
      {[280, 200, 240, 160].map((w, i) => (
        <div
          key={i}
          style={{
            width: `${w}px`,
            height: 20,
            borderRadius: 4,
            backgroundColor: '#242424',
            marginBottom: 12,
          }}
        />
      ))}
      <div style={{ display: 'flex', gap: 16, marginTop: 24 }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              width: 180,
              height: 220,
              borderRadius: 8,
              backgroundColor: '#181818',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder pages
// ---------------------------------------------------------------------------

function SearchPage() {
  const [searchService, setSearchService] = useState<SearchService | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const api = (window as any).electronAPI;
    if (!api?.getConfig) {
      setLoading(false);
      return;
    }

    api.getConfig().then((config: Record<string, string>) => {
      if (cancelled) return;
      const deps: { youtubeService?: YouTubeService } = {};
      if (config.YOUTUBE_API_KEY) {
        deps.youtubeService = new YouTubeService({
          apiKey: config.YOUTUBE_API_KEY,
          playbackMode: (config.YOUTUBE_PLAYBACK_MODE as 'iframe' | 'extract') || 'iframe',
        });
      }
      setSearchService(new SearchService(deps));
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={pageStyle}>
        <h1 style={pageTitle}>Search</h1>
        <p style={pageSubtitle}>Loading search services...</p>
      </div>
    );
  }

  if (!searchService) {
    return <SearchPageBasic />;
  }

  return (
    <div style={pageStyle}>
      <UnifiedSearch searchService={searchService} />
    </div>
  );
}

function SearchPageBasic() {
  const [query, setQuery] = useState('');
  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>Search</h1>
      <p style={pageSubtitle}>Search across Spotify, YouTube, and Jellyfin simultaneously.</p>
      <div style={searchInputContainer}>
        <input
          type="text"
          placeholder="What do you want to listen to?"
          style={searchInputStyle}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {query.trim() && (
        <div style={{ marginTop: 24, padding: 32, textAlign: 'center', color: '#6a6a6a' }}>
          <p style={{ fontSize: 14 }}>No search services configured.</p>
          <p style={{ fontSize: 12, marginTop: 8 }}>Add API keys in your .env file and connect services to enable search.</p>
        </div>
      )}
    </div>
  );
}

function LibraryPage() {
  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>Library</h1>
      <p style={pageSubtitle}>Browse your music across all connected sources.</p>
      <PageSkeleton />
    </div>
  );
}

function ServicePage({
  name,
  icon,
  color,
  source,
  description,
  connectText,
}: {
  name: string;
  icon: string;
  color: string;
  source: 'spotify' | 'youtube' | 'jellyfin';
  description: string;
  connectText: string;
}) {
  const { status, loading, refresh } = useSourceStatus();
  const connected = status[source];
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api?.auth) return;

    setConnecting(true);
    setError(null);

    try {
      let result: { success: boolean; error?: string };
      if (source === 'spotify') {
        result = await api.auth.spotifyLogin();
      } else if (source === 'youtube') {
        result = await api.auth.youtubeLogin();
      } else {
        result = await api.auth.jellyfinLogin();
      }

      if (result.success) {
        refresh();
      } else {
        setError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, [source, refresh]);

  const handleDisconnect = useCallback(async () => {
    await disconnectSource(source);
    refresh();
  }, [source, refresh]);

  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>
        <span style={{ color }}>{icon}</span> {name}
      </h1>
      <p style={pageSubtitle}>{description}</p>

      {/* Connection status banner */}
      <div style={{
        ...statusBanner,
        borderColor: connected ? color + '40' : '#282828',
        backgroundColor: connected ? color + '10' : '#181818',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: (loading || connecting) ? '#f59e0b' : connected ? color : '#4a4a4a',
            boxShadow: connected ? `0 0 8px ${color}60` : 'none',
          }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#ffffff' }}>
            {connecting ? 'Connecting...' : loading ? 'Checking...' : connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        {connected ? (
          <button onClick={handleDisconnect} style={{ ...connectBtn, backgroundColor: '#4a4a4a', fontSize: 12, padding: '6px 16px' }}>
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            style={{ ...connectBtn, backgroundColor: connecting ? '#666' : color, fontSize: 12, padding: '6px 16px', opacity: connecting ? 0.7 : 1 }}
          >
            {connecting ? 'Connecting...' : connectText}
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, backgroundColor: '#3a1a1a', border: '1px solid #ff4444', marginBottom: 16, fontSize: 13, color: '#ff8888' }}>
          {error}
        </div>
      )}

      {/* Content area */}
      {!connected && !connecting && (
        <div style={servicePrompt}>
          <span style={{ fontSize: 48 }}>{icon}</span>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', margin: '12px 0 8px' }}>Connect to {name}</h3>
          <p style={{ fontSize: 13, color: '#6a6a6a', marginBottom: 16 }}>
            {source === 'spotify' && 'Set your SPOTIFY_CLIENT_ID in .env and click Connect to sign in via OAuth.'}
            {source === 'youtube' && 'Set your YOUTUBE_API_KEY in .env and click Connect to validate.'}
            {source === 'jellyfin' && 'Set your JELLYFIN_SERVER_URL and credentials in .env and click Connect.'}
          </p>
          <button onClick={handleConnect} style={{ ...connectBtn, backgroundColor: color }}>{connectText}</button>
        </div>
      )}

      {connected && (
        <div style={{ marginTop: 24 }}>
          <div style={{ ...widgetCardInline, borderColor: color + '30' }}>
            <p style={{ fontSize: 14, color: '#b3b3b3' }}>
              {name} is connected. Browse your content using the library or search.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function SpotifyPage() {
  return (
    <ServicePage
      name="Spotify"
      icon={'\uD83C\uDFB5'}
      color="#1db954"
      source="spotify"
      description="Browse and play music from Spotify."
      connectText="Connect Spotify"
    />
  );
}

function YouTubePage() {
  const { status, loading, refresh } = useSourceStatus();
  const connected = status.youtube;
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ytService, setYtService] = useState<YouTubeService | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string; title: string; artist: string; thumbnail: string | null; videoId: string; duration: number;
  }>>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<{ id: string; title: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize YouTubeService when connected
  useEffect(() => {
    if (!connected) { setYtService(null); return; }
    const api = (window as any).electronAPI;
    if (!api?.getConfig) return;
    api.getConfig().then((config: Record<string, string>) => {
      if (config.YOUTUBE_API_KEY) {
        setYtService(new YouTubeService({
          apiKey: config.YOUTUBE_API_KEY,
          playbackMode: (config.YOUTUBE_PLAYBACK_MODE as 'iframe' | 'extract') || 'iframe',
        }));
      }
    }).catch(() => {});
  }, [connected]);

  const handleConnect = useCallback(async () => {
    const api = (window as any).electronAPI;
    if (!api?.auth) return;
    setConnecting(true);
    setError(null);
    try {
      const result = await api.auth.youtubeLogin();
      if (result.success) refresh();
      else setError(result.error || 'Connection failed');
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, [refresh]);

  const handleDisconnect = useCallback(async () => {
    await disconnectSource('youtube');
    refresh();
  }, [refresh]);

  // Debounced YouTube search
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || !ytService) { setSearchResults([]); setSearchError(null); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const results = await ytService.search(value, 'video', 20);
        setSearchResults(results);
      } catch (err: any) {
        setSearchError(err.message || 'Search failed');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [ytService]);

  const handlePlayVideo = useCallback((videoId: string, title: string) => {
    setSelectedVideo({ id: videoId, title });
  }, []);

  const handleOpenWindow = useCallback((videoId: string) => {
    const api = (window as any).electronAPI;
    if (api?.openYouTubeWindow) api.openYouTubeWindow(videoId);
    else if (api?.openExternal) api.openExternal(`https://www.youtube.com/watch?v=${videoId}`);
  }, []);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>
        <span style={{ color: '#ff0000' }}>{'\u25B6\uFE0F'}</span> YouTube
      </h1>
      <p style={pageSubtitle}>Watch videos and listen to music from YouTube.</p>

      {/* Connection status banner */}
      <div style={{
        ...statusBanner,
        borderColor: connected ? '#ff000040' : '#282828',
        backgroundColor: connected ? '#ff000010' : '#181818',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            backgroundColor: (loading || connecting) ? '#f59e0b' : connected ? '#ff0000' : '#4a4a4a',
            boxShadow: connected ? '0 0 8px #ff000060' : 'none',
          }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#ffffff' }}>
            {connecting ? 'Connecting...' : loading ? 'Checking...' : connected ? 'Connected' : 'Not connected'}
          </span>
        </div>
        {connected ? (
          <button onClick={handleDisconnect} style={{ ...connectBtn, backgroundColor: '#4a4a4a', fontSize: 12, padding: '6px 16px' }}>
            Disconnect
          </button>
        ) : (
          <button onClick={handleConnect} disabled={connecting}
            style={{ ...connectBtn, backgroundColor: connecting ? '#666' : '#ff0000', fontSize: 12, padding: '6px 16px', opacity: connecting ? 0.7 : 1 }}>
            {connecting ? 'Connecting...' : 'Connect YouTube'}
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, backgroundColor: '#3a1a1a', border: '1px solid #ff4444', marginBottom: 16, fontSize: 13, color: '#ff8888' }}>
          {error}
        </div>
      )}

      {/* Search and browse when connected */}
      {connected && ytService && (
        <div style={{ marginTop: 16 }}>
          <div style={{ maxWidth: 600, marginBottom: 24 }}>
            <input
              type="text"
              placeholder="Search YouTube videos..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={searchInputStyle}
            />
          </div>

          {/* In-app video player */}
          {selectedVideo && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>
                  {selectedVideo.title}
                </span>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <button
                    onClick={() => handleOpenWindow(selectedVideo.id)}
                    style={{ padding: '4px 12px', borderRadius: 9999, border: '1px solid #282828', background: '#282828', color: '#b3b3b3', fontSize: 11, cursor: 'pointer' }}
                  >
                    Pop out ↗
                  </button>
                  <button
                    onClick={() => setSelectedVideo(null)}
                    style={{ padding: '4px 12px', borderRadius: 9999, border: '1px solid #282828', background: 'none', color: '#6a6a6a', fontSize: 11, cursor: 'pointer' }}
                  >
                    ✕ Close
                  </button>
                </div>
              </div>
              <iframe
                key={selectedVideo.id}
                src={`https://www.youtube.com/embed/${selectedVideo.id}?autoplay=1&rel=0`}
                style={{ width: '100%', height: 360, borderRadius: 8, border: 'none', display: 'block' }}
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
              />
            </div>
          )}

          {searching && <p style={{ fontSize: 13, color: '#b3b3b3', marginBottom: 16 }}>Searching...</p>}
          {searchError && (
            <div style={{ padding: '10px 14px', borderRadius: 6, backgroundColor: '#3a1a1a', border: '1px solid #ff4444', marginBottom: 16, fontSize: 13, color: '#ff8888' }}>
              {searchError}
            </div>
          )}

          {searchResults.length > 0 && (
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', marginBottom: 12 }}>Results</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handlePlayVideo(item.videoId, item.title)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 12px', borderRadius: 8,
                      border: '1px solid #282828', backgroundColor: '#181818',
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                  >
                    {item.thumbnail && (
                      <img src={item.thumbnail} alt="" style={{ width: 120, height: 68, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11, color: '#6a6a6a', marginTop: 2 }}>{item.artist}</div>
                    </div>
                    {item.duration > 0 && (
                      <span style={{ fontSize: 11, color: '#6a6a6a', flexShrink: 0 }}>{formatDuration(item.duration)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!searchQuery.trim() && searchResults.length === 0 && (
            <div style={{ ...widgetCardInline, borderColor: '#ff000030' }}>
              <p style={{ fontSize: 14, color: '#b3b3b3' }}>YouTube is connected. Search for videos above.</p>
            </div>
          )}

          {searchQuery.trim() && !searching && searchResults.length === 0 && !searchError && (
            <div style={{ textAlign: 'center', padding: 32, color: '#6a6a6a' }}>
              <p style={{ fontSize: 14 }}>No results found for &quot;{searchQuery}&quot;</p>
            </div>
          )}
        </div>
      )}

      {!connected && !connecting && (
        <div style={servicePrompt}>
          <span style={{ fontSize: 48 }}>{'\u25B6\uFE0F'}</span>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', margin: '12px 0 8px' }}>Connect to YouTube</h3>
          <p style={{ fontSize: 13, color: '#6a6a6a', marginBottom: 16 }}>
            Set your YOUTUBE_API_KEY in .env and click Connect to validate.
          </p>
          <button onClick={handleConnect} style={{ ...connectBtn, backgroundColor: '#ff0000' }}>Connect YouTube</button>
        </div>
      )}
    </div>
  );
}

function WeatherPage() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [svc, setSvc] = useState<WeatherService | null>(null);
  const [cityQuery, setCityQuery] = useState('');
  const [locationResults, setLocationResults] = useState<WeatherLocation[]>([]);
  const [searchingCity, setSearchingCity] = useState(false);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load config + auto-fetch if default lat/lon are set
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getConfig) return;
    api.getConfig().then(async (cfg: Record<string, string>) => {
      if (!cfg.WEATHER_API_KEY) { setNoKey(true); return; }
      const unit: 'C' | 'F' = cfg.WEATHER_UNIT?.toLowerCase().startsWith('c') ? 'C' : 'F';
      const service = new WeatherService({ apiKey: cfg.WEATHER_API_KEY, unit });
      setSvc(service);
      if (cfg.WEATHER_DEFAULT_LAT && cfg.WEATHER_DEFAULT_LON) {
        const lat = parseFloat(cfg.WEATHER_DEFAULT_LAT);
        const lon = parseFloat(cfg.WEATHER_DEFAULT_LON);
        const loc = (await service.reverseGeocode(lat, lon).catch(() => null))
          ?? { name: 'Your Location', lat, lon, country: '' };
        setLoading(true);
        service.getWeather(loc)
          .then(setWeather)
          .catch((e: any) => setError(e?.message ?? 'Failed to fetch weather'))
          .finally(() => setLoading(false));
      }
    }).catch(() => {});
  }, []);

  const handleCitySearch = useCallback((query: string) => {
    setCityQuery(query);
    setLocationResults([]);
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (!query.trim() || !svc) return;
    cityDebounceRef.current = setTimeout(async () => {
      setSearchingCity(true);
      const results = await svc.searchLocations(query).catch(() => []);
      setLocationResults(results);
      setSearchingCity(false);
    }, 400);
  }, [svc]);

  const handleSelectLocation = useCallback(async (loc: WeatherLocation) => {
    if (!svc) return;
    setLocationResults([]);
    setCityQuery(`${loc.name}${loc.region ? `, ${loc.region}` : ''}, ${loc.country}`);
    setLoading(true);
    setError(null);
    try {
      setWeather(await svc.getWeather(loc));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch weather');
    }
    setLoading(false);
  }, [svc]);

  if (noKey) {
    return (
      <div style={pageStyle}>
        <h1 style={pageTitle}>{'\u2601\uFE0F'} Weather</h1>
        <div style={servicePrompt}>
          <span style={{ fontSize: 48 }}>{'\u2601\uFE0F'}</span>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', margin: '12px 0 8px' }}>Weather Dashboard</h3>
          <p style={{ fontSize: 13, color: '#6a6a6a', marginBottom: 16 }}>Add your OpenWeatherMap API key in Settings to get started.</p>
          <button onClick={() => navigate('/settings')} style={{ ...connectBtn, backgroundColor: '#4fc3f7' }}>Go to Settings</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>{'\u2601\uFE0F'} Weather</h1>
      {weather && (
        <p style={pageSubtitle}>
          {weather.location.name}{weather.location.region ? `, ${weather.location.region}` : ''}{weather.location.country ? `, ${weather.location.country}` : ''}
        </p>
      )}

      {/* City search */}
      {svc && (
        <div style={{ position: 'relative', maxWidth: 400, marginBottom: 24 }}>
          <input
            type="text"
            placeholder="Search for a city..."
            value={cityQuery}
            onChange={(e) => handleCitySearch(e.target.value)}
            style={searchInputStyle}
          />
          {searchingCity && (
            <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#6a6a6a' }}>
              Searching...
            </span>
          )}
          {locationResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, backgroundColor: '#181818', border: '1px solid #282828', borderRadius: 6, overflow: 'hidden', marginTop: 4 }}>
              {locationResults.map((loc, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectLocation(loc)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: i < locationResults.length - 1 ? '1px solid #282828' : 'none', color: '#ffffff', fontSize: 13, cursor: 'pointer' }}
                >
                  {loc.name}{loc.region ? `, ${loc.region}` : ''}, {loc.country}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {loading && <p style={{ color: '#b3b3b3', fontSize: 14 }}>Loading weather data...</p>}

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, backgroundColor: '#3a1a1a', border: '1px solid #ff4444', fontSize: 13, color: '#ff8888', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && !weather && !error && svc && (
        <p style={{ fontSize: 13, color: '#6a6a6a' }}>Search for a city above to see the weather forecast.</p>
      )}

      {weather && !loading && (
        <>
          {/* Current conditions */}
          <div style={{ ...widgetCardInline, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 72, lineHeight: 1 }}>{weatherConditionIcon(weather.current.condition)}</span>
              <div>
                <div style={{ fontSize: 64, fontWeight: 800, color: '#ffffff', lineHeight: 1 }}>{weather.current.temp}°</div>
                <div style={{ fontSize: 14, color: '#b3b3b3', marginTop: 6, textTransform: 'capitalize' }}>{weather.current.description}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 40px', marginLeft: 8 }}>
                {([['Feels like', `${weather.current.feelsLike}°`], ['Humidity', `${weather.current.humidity}%`], ['Wind', `${weather.current.windSpeed} mph`], ['UV Index', String(weather.current.uvIndex)]] as [string, string][]).map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: '#6a6a6a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', marginTop: 2 }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 7-day forecast */}
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#6a6a6a', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>7-Day Forecast</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {weather.daily.map((d, i) => {
              const label = i === 0 ? 'Today' : new Date(d.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
              return (
                <div key={d.date} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderRadius: 6, backgroundColor: '#181818', border: '1px solid #282828' }}>
                  <span style={{ width: 130, fontSize: 13, color: '#b3b3b3', flexShrink: 0 }}>{label}</span>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{weatherConditionIcon(d.condition)}</span>
                  <span style={{ fontSize: 12, color: '#6a6a6a', flex: 1, textTransform: 'capitalize' }}>{d.condition.replace(/_/g, ' ')}</span>
                  {d.precipProbability > 0 && <span style={{ fontSize: 11, color: '#4fc3f7' }}>💧 {d.precipProbability}%</span>}
                  <span style={{ fontSize: 13, color: '#6a6a6a', marginLeft: 8 }}>{d.low}°</span>
                  <span style={{ fontSize: 13, color: '#6a6a6a', margin: '0 4px' }}>/</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>{d.high}°</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

interface RawNewsArticle {
  title: string;
  url: string;
  urlToImage?: string | null;
  source: { name: string };
  publishedAt: string;
}

function NewsPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<RawNewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noKey, setNoKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [category, setCategory] = useState<NewsCategory>('all');

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getConfig) return;
    api.getConfig().then((cfg: Record<string, string>) => {
      if (!cfg.NEWS_API_KEY) { setNoKey(true); return; }
      setApiKey(cfg.NEWS_API_KEY);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    const api = (window as any).electronAPI;
    if (!api?.newsGetHeadlines) return;
    setLoading(true);
    setError(null);
    api.newsGetHeadlines({ apiKey, category })
      .then((data: any) => {
        setArticles(data.articles ?? []);
        setLoading(false);
      })
      .catch((err: any) => {
        setError(err?.message ?? 'Failed to fetch headlines.');
        setLoading(false);
      });
  }, [apiKey, category]);

  const openArticle = useCallback((url: string) => {
    const api = (window as any).electronAPI;
    if (api?.openExternal) api.openExternal(url);
  }, []);

  if (noKey) {
    return (
      <div style={pageStyle}>
        <h1 style={pageTitle}>{'\uD83D\uDCF0'} News</h1>
        <div style={servicePrompt}>
          <span style={{ fontSize: 48 }}>{'\uD83D\uDCF0'}</span>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#ffffff', margin: '12px 0 8px' }}>News Feed</h3>
          <p style={{ fontSize: 13, color: '#6a6a6a', marginBottom: 16 }}>Add your NewsAPI key in Settings to get started.</p>
          <button onClick={() => navigate('/settings')} style={{ ...connectBtn, backgroundColor: '#ff9800' }}>Go to Settings</button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>{'\uD83D\uDCF0'} News</h1>
      <p style={pageSubtitle}>Top headlines, trending stories, and personalized news feed.</p>

      {/* Category pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {NEWS_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: '6px 14px', borderRadius: 9999, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              backgroundColor: cat === category ? '#ff9800' : '#181818',
              color: cat === category ? '#000000' : '#b3b3b3',
              border: `1px solid ${cat === category ? '#ff9800' : '#282828'}`,
            }}
          >
            {categoryLabel(cat)}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, backgroundColor: '#3a1a1a', border: '1px solid #ff4444', fontSize: 13, color: '#ff8888', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && <p style={{ color: '#b3b3b3', fontSize: 14 }}>Loading headlines...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {articles.map((article, i) => (
          <button
            key={article.url + i}
            onClick={() => openArticle(article.url)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderRadius: 6,
              backgroundColor: '#181818', border: '1px solid #282828', cursor: 'pointer', textAlign: 'left', width: '100%',
            }}
          >
            {article.urlToImage && (
              <img src={article.urlToImage} alt="" style={{ width: 80, height: 54, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#ffffff', lineHeight: 1.4, marginBottom: 4 }}>{article.title}</div>
              <div style={{ fontSize: 11, color: '#6a6a6a' }}>
                {article.source.name} · {timeAgo(new Date(article.publishedAt).getTime())}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function JellyfinPage() {
  return (
    <ServicePage
      name="Jellyfin"
      icon={'\uD83C\uDFA5'}
      color="#aa5cc3"
      source="jellyfin"
      description="Stream your personal media library from Jellyfin. Set JELLYFIN_SERVER_URL and credentials in .env to connect."
      connectText="Connect Jellyfin"
    />
  );
}

// ============================================================================
// TwitterPage
// ============================================================================

interface RawTweet {
  id: string;
  text: string;
  created_at: string;
  public_metrics: { like_count: number; retweet_count: number };
  in_reply_to_user_id?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
}

interface TwitterUserData {
  id: string;
  name: string;
  username: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const TWITTER_ACCOUNTS = ['JackPosobiec', 'Cernovich'];

function TwitterPage() {
  const [bearerToken, setBearerToken] = useState('');
  const [results, setResults] = useState<Array<{
    user: TwitterUserData;
    tweets: RawTweet[];
    includes: { tweets?: Array<{ id: string; text: string }> };
  } | null>>(TWITTER_ACCOUNTS.map(() => null));
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<(string | null)[]>(TWITTER_ACCOUNTS.map(() => null));

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getConfig) return;
    api.getConfig().then((cfg: Record<string, string>) => {
      const token = cfg.TWITTER_BEARER_TOKEN || '';
      setBearerToken(token);
      if (!token) return;
      setLoading(true);
      Promise.allSettled(
        TWITTER_ACCOUNTS.map((username) =>
          api.twitterGetUserTweets({ bearerToken: token, username, maxResults: 50 }),
        ),
      ).then((settled) => {
        setResults(settled.map((r) => (r.status === 'fulfilled' ? (r as PromiseFulfilledResult<any>).value : null)));
        setErrors(settled.map((r) => (r.status === 'rejected' ? (r as PromiseRejectedResult).reason?.message ?? 'Error' : null)));
        setLoading(false);
      });
    }).catch(() => {});
  }, []);

  const openTweet = useCallback((username: string, tweetId: string) => {
    (window as any).electronAPI?.openExternal?.(`https://twitter.com/${username}/status/${tweetId}`);
  }, []);

  const pageStyle: CSSProperties = { padding: 24, height: '100%', overflowY: 'auto', boxSizing: 'border-box' };
  const headerStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 };
  const columnGridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: 20,
  };
  const columnStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 16,
    border: '1px solid rgba(255,255,255,0.08)',
  };
  const tweetCardStyle: CSSProperties = {
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 10,
    cursor: 'pointer',
    border: '1px solid transparent',
    transition: 'border-color 0.15s',
  };
  const metaRowStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  };

  if (!bearerToken && !loading) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 28 }}>{'\uD83D\uDC26'}</span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Twitter / X</h2>
        </div>
        <div style={{
          padding: '20px 24px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: 14,
        }}>
          Add{' '}
          <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
            TWITTER_BEARER_TOKEN
          </code>{' '}
          to your{' '}
          <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>
            .env
          </code>{' '}
          to load tweets. Get a Bearer Token from the{' '}
          <span
            style={{ color: '#1DA1F2', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={() => (window as any).electronAPI?.openExternal?.('https://developer.twitter.com/en/portal/dashboard')}
          >
            Twitter Developer Portal
          </span>
          .
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 28 }}>{'\uD83D\uDC26'}</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600 }}>Twitter / X</h2>
        {loading && <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</span>}
      </div>

      <div style={columnGridStyle}>
        {TWITTER_ACCOUNTS.map((username, idx) => {
          const result = results[idx];
          const err = errors[idx];
          return (
            <div key={username} style={columnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                <span style={{ fontSize: 16 }}>{'\uD83D\uDC26'}</span>
                <span style={{ fontWeight: 600, fontSize: 15 }}>
                  {result ? result.user.name : `@${username}`}
                </span>
                {result && (
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                    @{result.user.username}
                  </span>
                )}
              </div>

              {err && (
                <div style={{ fontSize: 12, color: '#ff6b6b', marginBottom: 10 }}>{err}</div>
              )}

              {loading && !result && !err && (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                  Loading tweets…
                </div>
              )}

              {result?.tweets.map((tweet) => {
                const refId = tweet.referenced_tweets?.find((r) => r.type === 'replied_to')?.id;
                const refText = refId
                  ? (result.includes.tweets ?? []).find((t) => t.id === refId)?.text
                  : undefined;
                const isReply = !!tweet.in_reply_to_user_id;
                return (
                  <div
                    key={tweet.id}
                    style={tweetCardStyle}
                    onClick={() => openTweet(result.user.username, tweet.id)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(29,161,242,0.4)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'; }}
                  >
                    {isReply && (
                      <div style={{
                        borderLeft: '2px solid rgba(29,161,242,0.45)',
                        paddingLeft: 8,
                        marginBottom: 8,
                      }}>
                        <div style={{ fontSize: 11, color: 'rgba(29,161,242,0.8)', marginBottom: refText ? 4 : 0 }}>
                          {'\u21A9'} Replying to a tweet
                        </div>
                        {refText && (
                          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4 }}>
                            {refText.length > 140 ? refText.slice(0, 140) + '\u2026' : refText}
                          </div>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.87)' }}>
                      {tweet.text}
                    </div>
                    <div style={metaRowStyle}>
                      <span>{relTime(tweet.created_at)}</span>
                      <span style={{ display: 'flex', gap: 14 }}>
                        <span>{'\u2665'} {tweet.public_metrics.like_count.toLocaleString()}</span>
                        <span>{'\uD83D\uDD01'} {tweet.public_metrics.retweet_count.toLocaleString()}</span>
                      </span>
                    </div>
                  </div>
                );
              })}

              {result?.tweets.length === 0 && !err && (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 20 }}>
                  No tweets available
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPage() {
  const { status, loading, refresh } = useSourceStatus();
  const [config, setConfig] = useState<Record<string, string> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.getConfig) {
      api.getConfig().then((cfg: Record<string, string>) => setConfig(cfg)).catch(() => {});
    }
  }, []);

  const statusLabel = (connected: boolean) =>
    loading ? 'Checking...' : connected ? 'Connected' : 'Not connected';

  const weatherConfigured = config ? !!config.WEATHER_API_KEY : false;
  const newsConfigured = config ? !!config.NEWS_API_KEY : false;
  const widgetLabel = (configured: boolean) =>
    config === null ? 'Checking...' : configured ? 'Configured' : 'Not configured';

  const handleService = useCallback(async (source: 'spotify' | 'youtube' | 'jellyfin', connected: boolean) => {
    const api = (window as any).electronAPI;
    if (!api?.auth) return;
    setActionError(null);
    if (connected) {
      await disconnectSource(source);
      refresh();
    } else {
      let result: { success: boolean; error?: string };
      if (source === 'spotify') result = await api.auth.spotifyLogin();
      else if (source === 'youtube') result = await api.auth.youtubeLogin();
      else result = await api.auth.jellyfinLogin();
      if (result.success) refresh();
      else setActionError(result.error ?? 'Connection failed');
    }
  }, [refresh]);

  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>Settings</h1>
      {actionError && (
        <div style={{ maxWidth: 600, padding: '10px 14px', borderRadius: 6, backgroundColor: '#3a1a1a', border: '1px solid #ff4444', fontSize: 13, color: '#ff8888', marginBottom: 16 }}>
          {actionError}
        </div>
      )}
      <div style={{ maxWidth: 600 }}>
        <SettingsSection title="Connected Services">
          <SettingsRow label="Spotify" value={statusLabel(status.spotify)} action={status.spotify ? 'Disconnect' : 'Connect'} statusColor={status.spotify ? '#1db954' : undefined} onAction={() => handleService('spotify', status.spotify)} />
          <SettingsRow label="Spotify Redirect URI" value={config?.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8888/callback (default)'} />
          <SettingsRow label="YouTube" value={statusLabel(status.youtube)} action={status.youtube ? 'Disconnect' : 'Connect'} statusColor={status.youtube ? '#ff0000' : undefined} onAction={() => handleService('youtube', status.youtube)} />
          <SettingsRow label="Jellyfin" value={statusLabel(status.jellyfin)} action={status.jellyfin ? 'Disconnect' : 'Connect'} statusColor={status.jellyfin ? '#aa5cc3' : undefined} onAction={() => handleService('jellyfin', status.jellyfin)} />
        </SettingsSection>
        <SettingsSection title="Dashboard Widgets">
          <SettingsRow label="Weather API Key" value={widgetLabel(weatherConfigured)} statusColor={weatherConfigured ? '#4fc3f7' : undefined} />
          <SettingsRow label="News API Key" value={widgetLabel(newsConfigured)} statusColor={newsConfigured ? '#ff9800' : undefined} />
        </SettingsSection>
        <SettingsSection title="Appearance">
          <SettingsRow label="Theme" value="Dark" />
          <SettingsRow label="Temperature Unit" value="\u00B0F" />
        </SettingsSection>
        <SettingsSection title="About">
          <SettingsRow label="Version" value="1.0.0" />
        </SettingsSection>
      </div>
    </div>
  );
}

// Settings sub-components
function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#b3b3b3', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h3>
      <div style={{ borderRadius: 8, border: '1px solid #282828', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function SettingsRow({ label, value, action, statusColor, onAction }: { label: string; value: string; action?: string; statusColor?: string; onAction?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #282828' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {statusColor !== undefined && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor || '#4a4a4a' }} />
        )}
        <span style={{ fontSize: 14, color: '#ffffff' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: statusColor || '#6a6a6a' }}>{value}</span>
        {action && (
          <button onClick={onAction} style={{ padding: '4px 12px', borderRadius: 9999, border: '1px solid #282828', background: 'none', color: '#b3b3b3', fontSize: 12, cursor: 'pointer' }}>
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------

const NAV_MAIN = [
  { path: '/home', label: 'Home', icon: '\u{1F3E0}' },
  { path: '/search', label: 'Search', icon: '\u{1F50D}' },
  { path: '/library', label: 'Library', icon: '\u{1F4DA}' },
] as const;

const NAV_MEDIA = [
  { path: '/spotify', label: 'Spotify', icon: '\uD83C\uDFB5', color: '#1db954' },
  { path: '/youtube', label: 'YouTube', icon: '\u25B6\uFE0F', color: '#ff0000' },
  { path: '/jellyfin', label: 'Jellyfin', icon: '\uD83C\uDFA5', color: '#aa5cc3' },
  { path: '/twitter', label: 'Twitter / X', icon: '\uD83D\uDC26', color: '#1DA1F2' },
] as const;

const NAV_WIDGETS = [
  { path: '/weather', label: 'Weather', icon: '\u2601\uFE0F' },
  { path: '/news', label: 'News', icon: '\uD83D\uDCF0' },
] as const;

const NAV_BOTTOM = [
  { path: '/settings', label: 'Settings', icon: '\u2699\uFE0F' },
] as const;

function Sidebar() {
  const location = useLocation();
  const { status } = useSourceStatus();

  const renderNavItem = (item: { path: string; label: string; icon: string; color?: string }, isActive: boolean) => (
    <NavLink
      key={item.path}
      to={item.path}
      style={{
        ...navLink,
        backgroundColor: isActive ? '#282828' : 'transparent',
        color: isActive ? '#ffffff' : '#b3b3b3',
      }}
    >
      <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
        {item.icon}
      </span>
      <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 400 }}>
        {item.label}
      </span>
    </NavLink>
  );

  return (
    <nav style={sidebarStyle}>
      {/* macOS drag region */}
      <div style={dragRegion} className="drag-region" />

      {/* Logo / Title */}
      <div style={logoContainer}>
        <span style={{ fontSize: 18 }}>{'\u{1F3B5}'}</span>
        <span style={logoText}>Media Hub</span>
      </div>

      {/* Main navigation links */}
      <div style={navSection}>
        {NAV_MAIN.map((item) => renderNavItem(item, location.pathname === item.path))}
      </div>

      {/* Media sources section */}
      <div style={navDivider}>
        <span style={navDividerText}>Media</span>
      </div>
      <div style={navSection}>
        {NAV_MEDIA.map((item) => renderNavItem(item, location.pathname === item.path))}
      </div>

      {/* Widgets section */}
      <div style={navDivider}>
        <span style={navDividerText}>Widgets</span>
      </div>
      <div style={navSection}>
        {NAV_WIDGETS.map((item) => renderNavItem(item, location.pathname === item.path))}
      </div>

      {/* Settings at bottom */}
      <div style={{ ...navSection, marginTop: 'auto', paddingBottom: 8 }}>
        {NAV_BOTTOM.map((item) => renderNavItem(item, location.pathname === item.path))}
      </div>

      {/* Source indicators */}
      <div style={sourceSection}>
        <div style={sourceSectionTitle}>Sources</div>
        <SourceIndicator name="Spotify" color="#1db954" connected={status.spotify} />
        <SourceIndicator name="YouTube" color="#ff0000" connected={status.youtube} />
        <SourceIndicator name="Jellyfin" color="#aa5cc3" connected={status.jellyfin} />
      </div>
    </nav>
  );
}

function SourceIndicator({ name, color, connected }: { name: string; color: string; connected: boolean }) {
  return (
    <div style={sourceRow}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: connected ? color : '#4a4a4a',
        boxShadow: connected ? `0 0 6px ${color}60` : 'none',
      }} />
      <span style={{ fontSize: 12, color: connected ? '#b3b3b3' : '#6a6a6a' }}>{name}</span>
      <span style={{ fontSize: 10, color: connected ? color : '#6a6a6a', marginLeft: 'auto', fontWeight: connected ? 500 : 400 }}>
        {connected ? 'Connected' : 'Offline'}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Playback bar placeholder
// ---------------------------------------------------------------------------

function PlaybackBarPlaceholder() {
  return (
    <div style={playbackBarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 56, height: 56, borderRadius: 4, backgroundColor: '#282828' }} />
        <div>
          <div style={{ fontSize: 13, color: '#6a6a6a' }}>No track playing</div>
          <div style={{ fontSize: 11, color: '#4a4a4a' }}>Select something to play</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={controlBtn}>{'\u23EE'}</span>
          <span style={{ ...controlBtn, width: 36, height: 36, borderRadius: '50%', backgroundColor: '#ffffff', color: '#0a0a0a', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{'\u25B6'}</span>
          <span style={controlBtn}>{'\u23ED'}</span>
        </div>
        <div style={{ width: 400, height: 4, borderRadius: 2, backgroundColor: '#4d4d4d' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: '#6a6a6a' }}>{'\u{1F50A}'}</span>
        <div style={{ width: 80, height: 4, borderRadius: 2, backgroundColor: '#4d4d4d' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AppLayout />
        </HashRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

function AppLayout() {
  // Auto-connect services on startup
  const didAutoConnect = useRef(false);
  useEffect(() => {
    if (didAutoConnect.current) return;
    didAutoConnect.current = true;

    const api = (window as any).electronAPI;
    if (!api?.auth) return;

    // Auto-connect non-interactive services (YouTube API key + Jellyfin)
    // Spotify requires interactive OAuth so it's not auto-connected
    (async () => {
      try {
        const status = await api.auth.getStatus();
        if (!status.youtube) api.auth.youtubeLogin().catch(() => {});
        if (!status.jellyfin) api.auth.jellyfinLogin().catch(() => {});
      } catch {
        // Electron API not available
      }
    })();
  }, []);

  return (
    <div style={appContainer}>
      {/* Sidebar */}
      <Sidebar />

      {/* Main content */}
      <main style={mainContent}>
        <ErrorBoundary>
          <React.Suspense fallback={<PageSkeleton />}>
            <Routes>
              <Route path="/home" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/spotify" element={<SpotifyPage />} />
              <Route path="/youtube" element={<YouTubePage />} />
              <Route path="/jellyfin" element={<JellyfinPage />} />
              <Route path="/twitter" element={<TwitterPage />} />
              <Route path="/weather" element={<WeatherPage />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </React.Suspense>
        </ErrorBoundary>
      </main>

      {/* Playback bar (bottom) */}
      <PlaybackBarPlaceholder />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const appContainer: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '240px 1fr',
  gridTemplateRows: '1fr 90px',
  height: '100vh',
  width: '100vw',
  overflow: 'hidden',
  backgroundColor: '#0a0a0a',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const sidebarStyle: CSSProperties = {
  gridRow: '1 / 2',
  gridColumn: '1 / 2',
  backgroundColor: '#000000',
  borderRight: '1px solid #181818',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const dragRegion: CSSProperties = {
  height: 38,
  flexShrink: 0,
};

const logoContainer: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '0 20px 16px',
};

const logoText: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: '#ffffff',
  letterSpacing: '-0.3px',
};

const navSection: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '0 12px',
};

const navLink: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 12px',
  borderRadius: 6,
  textDecoration: 'none',
  transition: 'background-color 150ms ease',
};

const navDivider: CSSProperties = {
  padding: '12px 20px 4px',
};

const navDividerText: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#4a4a4a',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const sourceSection: CSSProperties = {
  padding: '12px 20px 16px',
  borderTop: '1px solid #181818',
};

const sourceSectionTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#6a6a6a',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 10,
};

const sourceRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
};

const mainContent: CSSProperties = {
  gridRow: '1 / 2',
  gridColumn: '2 / 3',
  overflow: 'auto',
  backgroundColor: '#0a0a0a',
};

const playbackBarStyle: CSSProperties = {
  gridRow: '2 / 3',
  gridColumn: '1 / 3',
  height: 90,
  backgroundColor: '#181818',
  borderTop: '1px solid #282828',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
};

const controlBtn: CSSProperties = {
  fontSize: 20,
  color: '#b3b3b3',
  cursor: 'pointer',
};

const pageStyle: CSSProperties = {
  padding: '32px 32px 120px',
};

const pageTitle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  marginBottom: 8,
};

const pageSubtitle: CSSProperties = {
  fontSize: 14,
  color: '#b3b3b3',
  marginBottom: 24,
};

const searchInputContainer: CSSProperties = {
  maxWidth: 600,
};

const searchInputStyle: CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  borderRadius: 9999,
  border: 'none',
  backgroundColor: '#242424',
  color: '#ffffff',
  fontSize: 14,
  outline: 'none',
};

const servicePrompt: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 48,
  textAlign: 'center',
  backgroundColor: '#181818',
  borderRadius: 12,
  border: '1px solid #282828',
  maxWidth: 400,
  margin: '0 auto',
};

const connectBtn: CSSProperties = {
  padding: '10px 24px',
  borderRadius: 9999,
  border: 'none',
  color: '#ffffff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const statusBanner: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid #282828',
  marginBottom: 24,
};

const widgetCardInline: CSSProperties = {
  padding: 20,
  borderRadius: 8,
  border: '1px solid #282828',
  backgroundColor: '#181818',
};
