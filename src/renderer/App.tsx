// ============================================================================
// App – root component with layout, routing, providers, and error boundary
// ============================================================================

import React, {
  useState,
  useCallback,
  useMemo,
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
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
// Placeholder pages (to be wired to existing components)
// ---------------------------------------------------------------------------

function HomePage() {
  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>Home</h1>
      <p style={pageSubtitle}>Welcome to Media Hub. Your music, videos, and more — all in one place.</p>
      <div style={placeholderGrid}>
        <PlaceholderCard title="Recently Played" icon="🎵" />
        <PlaceholderCard title="Your Library" icon="📚" />
        <PlaceholderCard title="Discover" icon="🔍" />
        <PlaceholderCard title="Dashboard" icon="📊" />
      </div>
    </div>
  );
}

function SearchPage() {
  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>Search</h1>
      <p style={pageSubtitle}>Search across Spotify, YouTube, and Jellyfin simultaneously.</p>
      <div style={searchInputContainer}>
        <input
          type="text"
          placeholder="What do you want to listen to?"
          style={searchInputStyle}
          readOnly
        />
      </div>
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

function SettingsPage() {
  return (
    <div style={pageStyle}>
      <h1 style={pageTitle}>Settings</h1>
      <div style={{ maxWidth: 600 }}>
        <SettingsSection title="Connected Services">
          <SettingsRow label="Spotify" value="Not connected" action="Connect" />
          <SettingsRow label="YouTube" value="Not connected" action="Connect" />
          <SettingsRow label="Jellyfin" value="Not connected" action="Connect" />
        </SettingsSection>
        <SettingsSection title="Appearance">
          <SettingsRow label="Theme" value="Dark" />
          <SettingsRow label="Temperature Unit" value="°F" />
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

function SettingsRow({ label, value, action }: { label: string; value: string; action?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #282828' }}>
      <span style={{ fontSize: 14, color: '#ffffff' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: '#6a6a6a' }}>{value}</span>
        {action && (
          <button style={{ padding: '4px 12px', borderRadius: 9999, border: '1px solid #282828', background: 'none', color: '#b3b3b3', fontSize: 12, cursor: 'pointer' }}>
            {action}
          </button>
        )}
      </div>
    </div>
  );
}

function PlaceholderCard({ title, icon }: { title: string; icon: string }) {
  return (
    <div style={cardStyle}>
      <span style={{ fontSize: 32, marginBottom: 8 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#b3b3b3' }}>{title}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar Navigation
// ---------------------------------------------------------------------------

const NAV_ITEMS = [
  { path: '/home', label: 'Home', icon: '\u{1F3E0}' },
  { path: '/search', label: 'Search', icon: '\u{1F50D}' },
  { path: '/library', label: 'Library', icon: '\u{1F4DA}' },
  { path: '/settings', label: 'Settings', icon: '\u2699\uFE0F' },
] as const;

function Sidebar() {
  const location = useLocation();

  return (
    <nav style={sidebarStyle}>
      {/* macOS drag region */}
      <div style={dragRegion} className="drag-region" />

      {/* Logo / Title */}
      <div style={logoContainer}>
        <span style={{ fontSize: 18 }}>{'\u{1F3B5}'}</span>
        <span style={logoText}>Media Hub</span>
      </div>

      {/* Navigation links */}
      <div style={navSection}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
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
        })}
      </div>

      {/* Source indicators */}
      <div style={sourceSection}>
        <div style={sourceSectionTitle}>Sources</div>
        <SourceIndicator name="Spotify" color="#1db954" connected={false} />
        <SourceIndicator name="YouTube" color="#ff0000" connected={false} />
        <SourceIndicator name="Jellyfin" color="#aa5cc3" connected={false} />
      </div>
    </nav>
  );
}

function SourceIndicator({ name, color, connected }: { name: string; color: string; connected: boolean }) {
  return (
    <div style={sourceRow}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: connected ? color : '#4a4a4a' }} />
      <span style={{ fontSize: 12, color: connected ? '#b3b3b3' : '#6a6a6a' }}>{name}</span>
      <span style={{ fontSize: 10, color: '#6a6a6a', marginLeft: 'auto' }}>
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
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          </React.Suspense>
        </ErrorBoundary>
      </main>

      {/* Dashboard panel (right) – placeholder, wired in next step */}
      {/* <DashboardPanel /> */}

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

const sourceSection: CSSProperties = {
  marginTop: 'auto',
  padding: '16px 20px',
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

const placeholderGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
  borderRadius: 12,
  backgroundColor: '#181818',
  border: '1px solid #282828',
  cursor: 'pointer',
  transition: 'background-color 200ms ease',
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
