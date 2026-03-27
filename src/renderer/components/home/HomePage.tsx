// ============================================================================
// HomePage – clean dashboard: stats, now playing, weather, news, quick links
// ============================================================================

import React, { useState, useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePlayerStore } from '../player/usePlayerStore';

// ---------------------------------------------------------------------------
// Types
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

interface DashboardHeadline {
  title: string;
  url: string;
  source: { name: string };
  publishedAt: string;
}

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export function HomePage() {
  const navigate = useNavigate();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <div style={page}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header style={header}>
        <div>
          <h1 style={greetingH1}>{greeting}</h1>
          <p style={greetingSub}>Media Hub</p>
        </div>
        <div style={headerRight}>
          <ClockBadge />
        </div>
      </header>

      {/* ── Quick-launch row ───────────────────────────────────── */}
      <div style={quickRow}>
        {[
          { label: 'Spotify', icon: '🎵', color: '#1db954', route: '/spotify' },
          { label: 'YouTube', icon: '▶️', color: '#FF4444', route: '/youtube' },
          { label: 'Jellyfin', icon: '🎥', color: '#aa5cc3', route: '/jellyfin' },
          { label: 'Library', icon: '📚', color: '#7B7CF8', route: '/library' },
          { label: 'Search', icon: '🔍', color: '#f59e0b', route: '/search' },
          { label: 'Settings', icon: '⚙️', color: '#6b7280', route: '/settings' },
        ].map((item) => (
          <QuickLaunchBtn key={item.route} {...item} onClick={() => navigate(item.route)} />
        ))}
      </div>

      {/* ── Main grid ──────────────────────────────────────────── */}
      <div style={mainGrid}>
        {/* LEFT column */}
        <div style={leftCol}>
          <NowPlayingCard />
          <DiscoverCard onNavigate={(r) => navigate(r)} />
        </div>

        {/* RIGHT column */}
        <div style={rightCol}>
          <WeatherCard />
          <NewsCard />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Clock badge
// ---------------------------------------------------------------------------

function ClockBadge() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const hh = String(time.getHours()).padStart(2, '0');
  const mm = String(time.getMinutes()).padStart(2, '0');
  const day = time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <div style={clockWrap}>
      <span style={clockTime}>{hh}:{mm}</span>
      <span style={clockDate}>{day}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick launch button
// ---------------------------------------------------------------------------

function QuickLaunchBtn({
  label, icon, color, onClick,
}: { label: string; icon: string; color: string; route: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        ...quickBtn,
        borderColor: hov ? color + 'aa' : 'rgba(255,255,255,0.08)',
        backgroundColor: hov ? color + '18' : 'rgba(255,255,255,0.04)',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      <span style={{ fontSize: 18 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: hov ? '#F0F0F5' : 'rgba(240,240,245,0.6)' }}>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Now Playing card
// ---------------------------------------------------------------------------

function NowPlayingCard() {
  const { currentTrack, playbackState } = usePlayerStore();

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
    <Card label="Now Playing" icon="🎵">
      {currentTrack ? (
        <div style={nowPlayingHero}>
          {/* Artwork */}
          <div style={heroArtwork}>
            {currentTrack.artwork ? (
              <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: 28, color: 'rgba(240,240,245,0.3)' }}>♫</span>
            )}
          </div>
          {/* Info */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F0F0F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentTrack.title}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentTrack.artist}
            </div>
            {/* mini progress bar */}
            {playbackState.duration > 0 && (
              <div style={miniProgressTrack}>
                <div style={{
                  ...miniProgressFill,
                  width: `${(playbackState.position / playbackState.duration) * 100}%`,
                }} />
              </div>
            )}
          </div>
          {/* Playing indicator */}
          {playbackState.isPlaying && (
            <div style={playingDot} title="Now playing" />
          )}
        </div>
      ) : recentTracks.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {recentTracks.map((track: any, i: number) => (
            <div key={i} style={recentRow}>
              <div style={recentArt}>
                {track.artwork ? (
                  <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 14, color: 'rgba(240,240,245,0.3)' }}>♫</span>
                )}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F0F5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.title || 'Unknown Track'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {track.artist || 'Unknown Artist'}
                </div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(240,240,245,0.25)', textTransform: 'uppercase', letterSpacing: '0.4px', flexShrink: 0 }}>
                {track.sourceType || ''}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon="🎶" message="Nothing playing" hint="Select something to play" />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Weather card
// ---------------------------------------------------------------------------

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
      const qs = `lat=${cfg.WEATHER_DEFAULT_LAT}&lon=${cfg.WEATHER_DEFAULT_LON}&units=${units}&appid=${cfg.WEATHER_API_KEY}`;
      try {
        const res = await fetch(`${base}/weather?${qs}`);
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

  return (
    <Card label={weather ? `Weather — ${weather.locationName}` : 'Weather'} icon="⛅">
      {weather ? (
        <>
          {/* Hero temp */}
          <div style={weatherHero}>
            <img
              src={`https://openweathermap.org/img/wn/${weather.icon}@2x.png`}
              alt={weather.description}
              style={{ width: 64, height: 64 }}
            />
            <div>
              <div style={weatherTempBig}>{weather.temp}°</div>
              <div style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', textTransform: 'capitalize', marginTop: 2 }}>
                {weather.description}
              </div>
            </div>
          </div>
          {/* Detail row */}
          <div style={weatherStatRow}>
            <StatChip label="Humidity" value={`${weather.humidity}%`} color="#4fc3f7" />
            <StatChip label="Wind" value={`${weather.windSpeed} mph`} color="#81c784" />
            <StatChip label="Feels" value={`${weather.feelsLike}°`} color="#ffb74d" />
          </div>
        </>
      ) : (
        <EmptyState
          icon="⛅"
          message={noConfig ? 'Not configured' : 'Loading...'}
          hint={noConfig ? 'Add WEATHER_API_KEY to .env' : undefined}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// News card
// ---------------------------------------------------------------------------

function NewsCard() {
  const [headlines, setHeadlines] = useState<DashboardHeadline[]>([]);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api?.getConfig || !api?.newsGetHeadlines) return;
    api.getConfig().then((cfg: Record<string, string>) => {
      if (!cfg.NEWS_API_KEY) { setNoKey(true); return; }
      api.newsGetHeadlines({ apiKey: cfg.NEWS_API_KEY, pageSize: 6 })
        .then((data: any) => setHeadlines(data.articles ?? []))
        .catch(() => {});
    }).catch(() => {});
  }, []);

  const openArticle = (url: string) => {
    const api = (window as any).electronAPI;
    if (api?.openExternal) api.openExternal(url);
  };

  return (
    <Card label="Top Headlines" icon="📰">
      {headlines.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {headlines.map((a, i) => (
            <button
              key={i}
              onClick={() => openArticle(a.url)}
              style={newsItem}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: '#F0F0F5', lineHeight: 1.4, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {a.title}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(240,240,245,0.35)', fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                {a.source.name}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📰"
          message={noKey ? 'Not configured' : 'Loading...'}
          hint={noKey ? 'Add NEWS_API_KEY to .env' : undefined}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Discover card
// ---------------------------------------------------------------------------

function DiscoverCard({ onNavigate }: { onNavigate: (route: string) => void }) {
  const items = [
    { title: 'Spotify', sub: 'Browse playlists & top tracks', icon: '🎵', color: '#1db954', route: '/spotify' },
    { title: 'YouTube', sub: 'Search and watch videos', icon: '▶️', color: '#FF4444', route: '/youtube' },
    { title: 'Jellyfin', sub: 'Your local media library', icon: '🎥', color: '#aa5cc3', route: '/jellyfin' },
  ];
  const [hov, setHov] = useState<number | null>(null);

  return (
    <Card label="Go To" icon="🔗">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onNavigate(item.route)}
            onMouseEnter={() => setHov(i)}
            onMouseLeave={() => setHov(null)}
            style={{
              ...discoverBtn,
              backgroundColor: hov === i ? 'rgba(255,255,255,0.07)' : 'transparent',
            }}
          >
            <div style={{ ...discoverIcon, backgroundColor: item.color + '22' }}>
              <span style={{ fontSize: 16 }}>{item.icon}</span>
            </div>
            <div style={{ textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#F0F0F5' }}>{item.title}</div>
              <div style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>
            </div>
            <span style={{ fontSize: 14, color: 'rgba(240,240,245,0.2)', marginLeft: 'auto', flexShrink: 0 }}>›</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared: Card container
// ---------------------------------------------------------------------------

function Card({ label, icon, children }: { label: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={cardWrap}>
      <div style={cardHeader}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span style={cardLabel}>{label}</span>
      </div>
      <div style={cardBody}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Stat chip
// ---------------------------------------------------------------------------

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ ...statChipBase, borderColor: color + '40' }}>
      <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
      <span style={{ fontSize: 10, color: 'rgba(240,240,245,0.4)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared: Empty state
// ---------------------------------------------------------------------------

function EmptyState({ icon, message, hint }: { icon: string; message: string; hint?: string }) {
  return (
    <div style={emptyWrap}>
      <span style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'rgba(240,240,245,0.4)', fontWeight: 500 }}>{message}</span>
      {hint && <span style={{ fontSize: 11, color: 'rgba(240,240,245,0.25)', marginTop: 4 }}>{hint}</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const page: CSSProperties = {
  padding: '24px 28px 100px',
  maxWidth: 1280,
  margin: '0 auto',
  height: '100%',
  overflowY: 'auto',
  boxSizing: 'border-box',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: 24,
};

const headerRight: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
};

const greetingH1: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  color: '#F0F0F5',
  margin: 0,
  letterSpacing: '-0.5px',
};

const greetingSubtext: CSSProperties = {
  fontSize: 12,
  color: 'rgba(240,240,245,0.35)',
  marginTop: 3,
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
};

const greetingSub = greetingSubtext;

const clockWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
};

const clockTime: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: '#F0F0F5',
  letterSpacing: '-0.5px',
  fontVariantNumeric: 'tabular-nums',
};

const clockDate: CSSProperties = {
  fontSize: 11,
  color: 'rgba(240,240,245,0.35)',
  fontWeight: 500,
  marginTop: 2,
};

// Quick row
const quickRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, 1fr)',
  gap: 10,
  marginBottom: 24,
};

const quickBtn: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  padding: '14px 8px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.08)',
  backgroundColor: 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  transition: 'all 150ms ease',
  background: 'none',
};

// Main grid
const mainGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const leftCol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const rightCol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

// Card
const cardWrap: CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 14,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const cardHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '12px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.07)',
  flexShrink: 0,
};

const cardLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'rgba(240,240,245,0.45)',
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
};

const cardBody: CSSProperties = {
  flex: 1,
  padding: '14px 16px',
  overflow: 'hidden',
};

// Now playing
const nowPlayingHero: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
};

const heroArtwork: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: 'rgba(255,255,255,0.07)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const miniProgressTrack: CSSProperties = {
  height: 2,
  backgroundColor: 'rgba(255,255,255,0.1)',
  borderRadius: 1,
  marginTop: 10,
  overflow: 'hidden',
};

const miniProgressFill: CSSProperties = {
  height: '100%',
  backgroundColor: '#7B7CF8',
  borderRadius: 1,
  transition: 'width 1s linear',
};

const playingDot: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: '#7B7CF8',
  flexShrink: 0,
  boxShadow: '0 0 8px #7B7CF8aa',
  animation: 'pulse 2s ease infinite',
};

const recentRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 4px',
  borderRadius: 6,
  transition: 'background 100ms',
};

const recentArt: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 5,
  overflow: 'hidden',
  backgroundColor: 'rgba(255,255,255,0.07)',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

// Weather
const weatherHero: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 16,
};

const weatherTempBig: CSSProperties = {
  fontSize: 40,
  fontWeight: 800,
  color: '#F0F0F5',
  lineHeight: 1,
  letterSpacing: '-1px',
};

const weatherStatRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
};

const statChipBase: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 3,
  padding: '10px 8px',
  borderRadius: 8,
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
};

// News
const newsItem: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 6px',
  borderRadius: 7,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  transition: 'background 100ms',
};

// Discover
const discoverBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '9px 8px',
  borderRadius: 8,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  transition: 'background 100ms',
  width: '100%',
};

const discoverIcon: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

// Empty
const emptyWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 100,
  textAlign: 'center',
  padding: '12px 0',
};
