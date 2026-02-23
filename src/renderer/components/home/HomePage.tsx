// ============================================================================
// HomePage – rich dashboard with weather, news, now-playing, and quick access
// ============================================================================

import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Unsplash photo type
// ---------------------------------------------------------------------------

interface UnsplashPhoto {
  urls: { regular: string };
  user: { name: string; links: { html: string } };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickAccessItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HomePage() {
  const navigate = useNavigate();
  const [bgPhoto, setBgPhoto] = useState<UnsplashPhoto | null>(null);

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Fetch a random nature photo from Unsplash for the dashboard background.
  // Results are cached in sessionStorage so we only hit the API once per session.
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getConfig) return;

    const cached = sessionStorage.getItem('unsplash-bg');
    if (cached) {
      try { setBgPhoto(JSON.parse(cached)); return; } catch { /* ignore */ }
    }

    api.getConfig().then(async (cfg: Record<string, string>) => {
      if (!cfg.UNSPLASH_ACCESS_KEY) return;
      try {
        const res = await fetch(
          `https://api.unsplash.com/photos/random?query=nature+landscape&orientation=landscape&client_id=${cfg.UNSPLASH_ACCESS_KEY}`,
        );
        if (!res.ok) return;
        const photo = await res.json();
        const data: UnsplashPhoto = {
          urls: { regular: photo.urls.regular },
          user: { name: photo.user.name, links: { html: photo.user.links.html } },
        };
        setBgPhoto(data);
        sessionStorage.setItem('unsplash-bg', JSON.stringify(data));
      } catch { /* silent – background is optional */ }
    }).catch(() => {});
  }, []);

  // Apply the photo as the document body background. Using document.body directly
  // is the only reliable approach — position:fixed with negative z-index is invisible
  // because body has overflow:hidden which creates a stacking context that buries it.
  // Cleanup runs when navigating away so other pages see the plain dark background.
  useEffect(() => {
    if (!bgPhoto) return;
    document.body.style.backgroundImage = `url(${bgPhoto.urls.regular})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    return () => {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundSize = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundAttachment = '';
    };
  }, [bgPhoto]);

  const quickAccess: QuickAccessItem[] = [
    { id: 'spotify', title: 'Spotify', subtitle: 'Music streaming', icon: '\uD83C\uDFB5', color: '#1db954', route: '/spotify' },
    { id: 'youtube', title: 'YouTube', subtitle: 'Videos & music', icon: '\u25B6\uFE0F', color: '#ff0000', route: '/youtube' },
    { id: 'library', title: 'Library', subtitle: 'Your collection', icon: '\uD83D\uDCDA', color: '#7c3aed', route: '/library' },
    { id: 'search', title: 'Search', subtitle: 'Find anything', icon: '\uD83D\uDD0D', color: '#f59e0b', route: '/search' },
  ];

  return (
    <div style={pageWrapper}>
      {/* Page content */}
      <div style={container}>
        {/* Header / Greeting */}
        <header style={headerSection}>
          <h1 style={greetingStyle}>{greeting}</h1>
          <p style={greetingSubtext}>Welcome to Media Hub</p>
        </header>

        {/* Quick Access Cards */}
        <section style={quickAccessSection}>
          {quickAccess.map((item) => (
            <QuickAccessCard
              key={item.id}
              item={item}
              onClick={() => navigate(item.route)}
            />
          ))}
        </section>

        {/* Main Dashboard Grid */}
        <div style={dashboardGrid}>
          <NowPlayingCard />
          <WeatherCard />
          <NewsCard />
          <DiscoverCard onNavigate={(route) => navigate(route)} />
        </div>

        {/* Section Links */}
        <section style={sectionLinksRow}>
          <SectionLink
            title="Weather"
            icon={'\u2601\uFE0F'}
            description="Forecast & alerts"
            color="#4fc3f7"
            onClick={() => navigate('/weather')}
          />
          <SectionLink
            title="News"
            icon={'\uD83D\uDCF0'}
            description="Headlines & trending"
            color="#ff9800"
            onClick={() => navigate('/news')}
          />
          <SectionLink
            title="Settings"
            icon={'\u2699\uFE0F'}
            description="Configure services"
            color="#6a6a6a"
            onClick={() => navigate('/settings')}
          />
        </section>
      </div>

      {/* ================================================================= */}
      {/* Unsplash attribution (required by Unsplash API guidelines)        */}
      {/* ================================================================= */}
      {bgPhoto && (
        <div style={attributionBadge}>
          Photo by{' '}
          <a
            href={`${bgPhoto.user.links.html}?utm_source=media_hub&utm_medium=referral`}
            target="_blank"
            rel="noopener noreferrer"
            style={attrLink}
          >
            {bgPhoto.user.name}
          </a>
          {' '}on{' '}
          <a
            href="https://unsplash.com/?utm_source=media_hub&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            style={attrLink}
          >
            Unsplash
          </a>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Access Card
// ---------------------------------------------------------------------------

function QuickAccessCard({ item, onClick }: { item: QuickAccessItem; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...quickCard,
        backgroundColor: hovered ? 'rgba(28, 28, 28, 0.90)' : 'rgba(12, 12, 12, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: hovered ? item.color + '80' : 'rgba(255, 255, 255, 0.10)',
        transform: hovered ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ ...quickCardIcon, backgroundColor: item.color + '20' }}>
        <span style={{ fontSize: 20 }}>{item.icon}</span>
      </div>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{item.title}</div>
        <div style={{ fontSize: 11, color: '#6a6a6a', marginTop: 2 }}>{item.subtitle}</div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Now Playing Card
// ---------------------------------------------------------------------------

function NowPlayingCard() {
  // Try to read recently played from localStorage
  const recentTracks = useMemo(() => {
    try {
      const raw = localStorage.getItem('media-hub:recently-played');
      if (raw) {
        const entries = JSON.parse(raw);
        return Array.isArray(entries) ? entries.slice(0, 6) : [];
      }
    } catch { /* ignore */ }
    return [];
  }, []);

  return (
    <div style={widgetCard}>
      <div style={widgetHeader}>
        <span style={{ fontSize: 14 }}>{'\uD83C\uDFB5'}</span>
        <h3 style={widgetTitleText}>Now Playing</h3>
      </div>
      <div style={widgetBody}>
        {recentTracks.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentTracks.map((track: any, i: number) => (
              <div key={i} style={trackRow}>
                <div style={trackArtwork}>
                  {track.artwork ? (
                    <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: 16, color: '#6a6a6a' }}>{'\u266B'}</span>
                  )}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={trackTitle}>{track.title || 'Unknown Track'}</div>
                  <div style={trackArtist}>{track.artist || 'Unknown Artist'}</div>
                </div>
                <div style={trackSource}>{track.sourceType || ''}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyState}>
            <span style={{ fontSize: 32, marginBottom: 8 }}>{'\uD83C\uDFB6'}</span>
            <div style={{ fontSize: 13, color: '#6a6a6a' }}>No recent tracks</div>
            <div style={{ fontSize: 11, color: '#4a4a4a', marginTop: 4 }}>Play something to see it here</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weather Card (embedded mini widget)
// ---------------------------------------------------------------------------

interface DashboardWeather {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  locationName: string;
}

function WeatherCard() {
  const [weather, setWeather] = useState<DashboardWeather | null>(null);
  const [noConfig, setNoConfig] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getConfig) return;
    api.getConfig().then(async (cfg: Record<string, string>) => {
      if (!cfg.WEATHER_API_KEY || !cfg.WEATHER_DEFAULT_LAT || !cfg.WEATHER_DEFAULT_LON) {
        setNoConfig(true);
        return;
      }
      const units = cfg.WEATHER_UNIT?.toLowerCase().startsWith('c') ? 'metric' : 'imperial';
      const base = 'https://api.openweathermap.org/data/2.5';
      const coords = `lat=${cfg.WEATHER_DEFAULT_LAT}&lon=${cfg.WEATHER_DEFAULT_LON}&units=${units}&appid=${cfg.WEATHER_API_KEY}`;
      try {
        const res = await fetch(`${base}/weather?${coords}`);
        if (!res.ok) return;
        const d = await res.json();
        setWeather({
          temp: Math.round(d.main.temp),
          feelsLike: Math.round(d.main.feels_like),
          humidity: d.main.humidity,
          windSpeed: Math.round(d.wind?.speed ?? 0),
          description: d.weather?.[0]?.description ?? '',
          icon: d.weather?.[0]?.icon ?? '01d',
          locationName: d.name ?? '',
        });
      } catch { /* silent */ }
    }).catch(() => {});
  }, []);

  const speedUnit = 'mph';

  return (
    <div style={widgetCard}>
      <div style={widgetHeader}>
        <span style={{ fontSize: 14 }}>{'\u2601\uFE0F'}</span>
        <h3 style={widgetTitleText}>Weather{weather ? ` — ${weather.locationName}` : ''}</h3>
      </div>
      <div style={widgetBody}>
        {weather ? (
          <div style={weatherPreview}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img
                src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
                alt={weather.description}
                style={{ width: 56, height: 56 }}
              />
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>{weather.temp}°</div>
                <div style={{ fontSize: 12, color: '#b3b3b3', marginTop: 4, textTransform: 'capitalize' }}>{weather.description}</div>
              </div>
            </div>
            <div style={weatherDetails}>
              <div style={weatherDetailItem}>
                <span style={{ color: '#6a6a6a' }}>Humidity</span>
                <span style={{ color: '#b3b3b3' }}>{weather.humidity}%</span>
              </div>
              <div style={weatherDetailItem}>
                <span style={{ color: '#6a6a6a' }}>Wind</span>
                <span style={{ color: '#b3b3b3' }}>{weather.windSpeed} {speedUnit}</span>
              </div>
              <div style={weatherDetailItem}>
                <span style={{ color: '#6a6a6a' }}>Feels like</span>
                <span style={{ color: '#b3b3b3' }}>{weather.feelsLike}°</span>
              </div>
            </div>
          </div>
        ) : (
          <div style={weatherPreview}>
            <div style={{ fontSize: 11, color: '#4a4a4a', textAlign: 'center', marginTop: 16 }}>
              {noConfig
                ? 'Set WEATHER_API_KEY + WEATHER_DEFAULT_LAT/LON in .env for dashboard weather'
                : 'Loading...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// News Card (embedded mini widget)
// ---------------------------------------------------------------------------

interface DashboardHeadline {
  title: string;
  url: string;
  source: { name: string };
  publishedAt: string;
}

function NewsCard() {
  const [headlines, setHeadlines] = useState<DashboardHeadline[]>([]);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getConfig || !api?.newsGetHeadlines) return;
    api.getConfig().then((cfg: Record<string, string>) => {
      if (!cfg.NEWS_API_KEY) { setNoKey(true); return; }
      api.newsGetHeadlines({ apiKey: cfg.NEWS_API_KEY, pageSize: 5 })
        .then((data: any) => setHeadlines(data.articles ?? []))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  const openArticle = (url: string) => {
    const api = (window as any).electronAPI;
    if (api?.openExternal) api.openExternal(url);
  };

  return (
    <div style={widgetCard}>
      <div style={widgetHeader}>
        <span style={{ fontSize: 14 }}>{'\uD83D\uDCF0'}</span>
        <h3 style={widgetTitleText}>News</h3>
      </div>
      <div style={widgetBody}>
        {headlines.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {headlines.map((article, i) => (
              <button
                key={i}
                onClick={() => openArticle(article.url)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '6px 8px', borderRadius: 6,
                  background: 'none', border: 'none', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 500, color: '#ffffff', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {article.title}
                </div>
                <div style={{ fontSize: 10, color: '#6a6a6a' }}>{article.source.name}</div>
              </button>
            ))}
          </div>
        ) : (
          <div style={emptyState}>
            <span style={{ fontSize: 32, marginBottom: 8 }}>{'\uD83D\uDCF0'}</span>
            <div style={{ fontSize: 13, color: '#6a6a6a' }}>
              {noKey ? 'Add NEWS_API_KEY to .env' : 'Loading headlines...'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discover Card
// ---------------------------------------------------------------------------

function DiscoverCard({ onNavigate }: { onNavigate: (route: string) => void }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const items = [
    { title: 'Browse Spotify', icon: '\uD83C\uDFB5', color: '#1db954', route: '/spotify' },
    { title: 'YouTube Music', icon: '\u25B6\uFE0F', color: '#ff0000', route: '/youtube' },
    { title: 'Jellyfin Library', icon: '\uD83C\uDFA5', color: '#aa5cc3', route: '/library' },
  ];

  return (
    <div style={widgetCard}>
      <div style={widgetHeader}>
        <span style={{ fontSize: 14 }}>{'\uD83D\uDD0D'}</span>
        <h3 style={widgetTitleText}>Discover</h3>
      </div>
      <div style={widgetBody}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => onNavigate(item.route)}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
                ...discoverRow,
                backgroundColor: hoveredIdx === i ? 'rgba(255, 255, 255, 0.09)' : 'transparent',
              }}
            >
              <div style={{ ...discoverIcon, backgroundColor: item.color + '20' }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#ffffff' }}>{item.title}</span>
              <span style={{ fontSize: 12, color: '#6a6a6a', marginLeft: 'auto' }}>{'\u203A'}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section Link
// ---------------------------------------------------------------------------

function SectionLink({
  title,
  icon,
  description,
  color,
  onClick,
}: {
  title: string;
  icon: string;
  description: string;
  color: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...sectionLinkBtn,
        backgroundColor: hovered ? 'rgba(28, 28, 28, 0.90)' : 'rgba(12, 12, 12, 0.82)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderColor: hovered ? color + '80' : 'rgba(255, 255, 255, 0.10)',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>{title}</div>
        <div style={{ fontSize: 11, color: '#6a6a6a' }}>{description}</div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const pageWrapper: CSSProperties = {
  position: 'relative',
  minHeight: '100%',
};


const attributionBadge: CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  fontSize: 10,
  color: 'rgba(255, 255, 255, 0.40)',
  zIndex: 10,
  pointerEvents: 'none',
};

const attrLink: CSSProperties = {
  color: 'rgba(255, 255, 255, 0.55)',
  textDecoration: 'none',
  pointerEvents: 'auto',
};

const container: CSSProperties = {
  padding: '24px 32px 120px',
  maxWidth: 1200,
  margin: '0 auto',
  position: 'relative',
  zIndex: 1,
};

const headerSection: CSSProperties = {
  marginBottom: 24,
};

const greetingStyle: CSSProperties = {
  fontSize: 32,
  fontWeight: 800,
  color: '#ffffff',
  margin: 0,
  letterSpacing: '-0.5px',
  textShadow: '0 2px 12px rgba(0,0,0,0.85)',
};

const greetingSubtext: CSSProperties = {
  fontSize: 14,
  color: 'rgba(255,255,255,0.55)',
  marginTop: 4,
  textShadow: '0 1px 6px rgba(0,0,0,0.80)',
};

const quickAccessSection: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: 12,
  marginBottom: 24,
};

const quickCard: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 16px',
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  cursor: 'pointer',
  transition: 'all 200ms ease',
  background: 'none',
  textAlign: 'left',
};

const quickCardIcon: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const dashboardGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 16,
  marginBottom: 24,
};

const widgetCard: CSSProperties = {
  backgroundColor: 'rgba(12, 12, 12, 0.82)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.10)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 240,
};

const widgetHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  flexShrink: 0,
};

const widgetTitleText: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#ffffff',
  margin: 0,
};

const widgetBody: CSSProperties = {
  flex: 1,
  padding: 16,
  overflow: 'auto',
};

const emptyState: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  minHeight: 120,
  textAlign: 'center',
};

const trackRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 8px',
  borderRadius: 6,
  transition: 'background-color 100ms ease',
};

const trackArtwork: CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 4,
  overflow: 'hidden',
  backgroundColor: 'rgba(255, 255, 255, 0.07)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const trackTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: '#ffffff',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const trackArtist: CSSProperties = {
  fontSize: 11,
  color: '#6a6a6a',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const trackSource: CSSProperties = {
  fontSize: 10,
  color: '#4a4a4a',
  textTransform: 'uppercase',
  flexShrink: 0,
};

const weatherPreview: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const weatherDetails: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  marginTop: 16,
};

const weatherDetailItem: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  fontSize: 12,
  padding: '8px',
  backgroundColor: 'rgba(255, 255, 255, 0.07)',
  borderRadius: 6,
};

const discoverRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 6,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  transition: 'background-color 100ms ease',
  width: '100%',
  textAlign: 'left',
};

const discoverIcon: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const sectionLinksRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
};

const sectionLinkBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '16px',
  borderRadius: 8,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  cursor: 'pointer',
  transition: 'all 200ms ease',
  background: 'none',
  textAlign: 'left',
};
