// ============================================================================
// Dashboard theme – design tokens for dashboard widget components
// ============================================================================

import type { CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Color tokens (matches main app dark theme)
// ---------------------------------------------------------------------------

export const d = {
  // Backgrounds
  bg: '#0a0a0a',
  bgWidget: '#181818',
  bgSurface: '#242424',
  bgHover: '#2a2a2a',
  bgActive: '#333333',
  bgOverlay: 'rgba(0, 0, 0, 0.85)',
  bgSidebar: '#121212',

  // Text
  text: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#6a6a6a',

  // Accent
  accent: '#1db954',
  accentHover: '#1ed760',

  // Weather-specific
  tempHigh: '#ff6b6b',
  tempLow: '#74b9ff',
  precipBar: '#4fc3f7',
  alertMinor: '#ffd93d',
  alertModerate: '#ff9800',
  alertSevere: '#f44336',
  alertExtreme: '#d32f2f',

  // News-specific
  unread: '#ffffff',
  read: '#888888',
  bookmark: '#ffd700',

  // Borders
  border: '#282828',
  borderLight: '#333333',

  // Sizing
  sidebarMinWidth: 300,
  sidebarMaxWidth: 500,
  widgetPadding: 16,
  widgetRadius: 12,
  headerHeight: 44,

  // Radius
  radius: 8,
  radiusSmall: 4,
  radiusRound: 9999,

  // Timing
  transition: '200ms ease-in-out',
  transitionFast: '100ms ease-in-out',
} as const;

// ---------------------------------------------------------------------------
// Alert severity colors
// ---------------------------------------------------------------------------

export const alertColor: Record<string, string> = {
  minor: d.alertMinor,
  moderate: d.alertModerate,
  severe: d.alertSevere,
  extreme: d.alertExtreme,
};

// ---------------------------------------------------------------------------
// Reusable style fragments
// ---------------------------------------------------------------------------

export const truncateText: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const truncateMultiline = (lines: number): CSSProperties => ({
  overflow: 'hidden',
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
});

export const widgetCard: CSSProperties = {
  backgroundColor: d.bgWidget,
  borderRadius: d.widgetRadius,
  border: `1px solid ${d.border}`,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};

export const widgetHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '12px 16px',
  borderBottom: `1px solid ${d.border}`,
  flexShrink: 0,
};

export const widgetTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: d.text,
  margin: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

export const widgetBody: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: d.widgetPadding,
};

export const iconButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  color: d.textSecondary,
  cursor: 'pointer',
  padding: 0,
  borderRadius: d.radiusRound,
  transition: `color ${d.transition}`,
  width: 28,
  height: 28,
};

export const pill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '4px 12px',
  borderRadius: d.radiusRound,
  fontSize: 12,
  fontWeight: 500,
  border: `1px solid ${d.border}`,
  backgroundColor: 'transparent',
  color: d.textSecondary,
  cursor: 'pointer',
  transition: `all ${d.transitionFast}`,
};

export const pillActive: CSSProperties = {
  ...pill,
  backgroundColor: d.accent,
  borderColor: d.accent,
  color: d.text,
};

export const skeleton: CSSProperties = {
  backgroundColor: d.bgSurface,
  borderRadius: d.radiusSmall,
  animation: 'pulse 1.5s ease-in-out infinite',
};

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function formatTimeShort(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function formatDayShort(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], { weekday: 'short' });
}

export function formatDayLong(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}
