// ============================================================================
// HomePage – rich dashboard with weather, news, now-playing, and quick access
// ============================================================================

import React, { useState, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

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

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const quickAccess: QuickAccessItem[] = [
    { id: 'spotify', title: 'Spotify', subtitle: 'Music streaming', icon: '\uD83C\uDFB5', color: '#1db954', route: '/spotify' },
    { id: 'youtube', title: 'YouTube', subtitle: 'Videos & music', icon: '\u25B6\uFE0F', color: '#ff0000', route: '/youtube' },
    { id: 'library', title: 'Library', subtitle: 'Your collection', icon: '\uD83D\uDCDA', color: '#7c3aed', route: '/library' },
    { id: 'search', title: 'Search', subtitle: 'Find anything', icon: '\uD83D\uDD0D', color: '#f59e0b', route: '/search' },
  ];

  return (
    <div style={container}>
      {/* ================================================================= */}
      {/* Header / Greeting                                                 */}
      {/* ================================================================= */}
      <header style={headerSection}>
        <h1 style={greetingStyle}>{greeting}</h1>
        <p style={greetingSubtext}>Welcome to Media Hub</p>
      </header>

      {/* ================================================================= */}
      {/* Quick Access Cards                                                */}
      {/* ================================================================= */}
      <section style={quickAccessSection}>
        {quickAccess.map((item) => (
          <QuickAccessCard
            key={item.id}
            item={item}
            onClick={() => navigate(item.route)}
          />
        ))}
      </section>

      {/* ================================================================= */}
      {/* Main Dashboard Grid                                               */}
      {/* ================================================================= */}
      <div style={dashboardGrid}>
        {/* Now Playing / Recently Played */}
        <NowPlayingCard />

        {/* Weather Widget */}
        <WeatherCard />

        {/* News Widget */}
        <NewsCard />

        {/* Discover / Browse Section */}
        <DiscoverCard onNavigate={(route) => navigate(route)} />
      </div>

      {/* ================================================================= */}
      {/* Section Links                                                     */}
      {/* ================================================================= */}
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
        backgroundColor: hovered ? '#2a2a2a' : '#181818',
        borderColor: hovered ? item.color + '60' : '#282828',
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

function WeatherCard() {
  // Show a compact weather preview
  // In a full implementation, this would pull from WeatherService
  return (
    <div style={widgetCard}>
      <div style={widgetHeader}>
        <span style={{ fontSize: 14 }}>{'\u2601\uFE0F'}</span>
        <h3 style={widgetTitleText}>Weather</h3>
      </div>
      <div style={widgetBody}>
        <div style={weatherPreview}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 48 }}>{'\u2600\uFE0F'}</span>
            <div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#ffffff', lineHeight: 1 }}>--°F</div>
              <div style={{ fontSize: 13, color: '#b3b3b3', marginTop: 4 }}>No weather data</div>
            </div>
          </div>
          <div style={weatherDetails}>
            <div style={weatherDetailItem}>
              <span style={{ color: '#6a6a6a' }}>Humidity</span>
              <span style={{ color: '#b3b3b3' }}>--%</span>
            </div>
            <div style={weatherDetailItem}>
              <span style={{ color: '#6a6a6a' }}>Wind</span>
              <span style={{ color: '#b3b3b3' }}>-- mph</span>
            </div>
            <div style={weatherDetailItem}>
              <span style={{ color: '#6a6a6a' }}>Feels like</span>
              <span style={{ color: '#b3b3b3' }}>--°F</span>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#4a4a4a', marginTop: 12, textAlign: 'center' }}>
            Configure weather API key in Settings
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// News Card (embedded mini widget)
// ---------------------------------------------------------------------------

function NewsCard() {
  return (
    <div style={widgetCard}>
      <div style={widgetHeader}>
        <span style={{ fontSize: 14 }}>{'\uD83D\uDCF0'}</span>
        <h3 style={widgetTitleText}>News</h3>
      </div>
      <div style={widgetBody}>
        <div style={emptyState}>
          <span style={{ fontSize: 32, marginBottom: 8 }}>{'\uD83D\uDCF0'}</span>
          <div style={{ fontSize: 13, color: '#6a6a6a' }}>No news articles</div>
          <div style={{ fontSize: 11, color: '#4a4a4a', marginTop: 4 }}>Configure News API key in Settings</div>
        </div>
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
                backgroundColor: hoveredIdx === i ? '#2a2a2a' : 'transparent',
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
        backgroundColor: hovered ? '#2a2a2a' : '#181818',
        borderColor: hovered ? color + '40' : '#282828',
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

const container: CSSProperties = {
  padding: '24px 32px 120px',
  maxWidth: 1200,
  margin: '0 auto',
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
};

const greetingSubtext: CSSProperties = {
  fontSize: 14,
  color: '#6a6a6a',
  marginTop: 4,
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
  border: '1px solid #282828',
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
  backgroundColor: '#181818',
  borderRadius: 12,
  border: '1px solid #282828',
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
  borderBottom: '1px solid #282828',
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
  backgroundColor: '#282828',
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
  backgroundColor: '#242424',
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
  border: '1px solid #282828',
  cursor: 'pointer',
  transition: 'all 200ms ease',
  background: 'none',
  textAlign: 'left',
};
