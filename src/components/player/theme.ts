// ============================================================================
// Player theme – design tokens for playback control components
// ============================================================================

import type { CSSProperties } from 'react';
import { MediaSourceType } from '../../types/media';

// ---------------------------------------------------------------------------
// Color tokens (dark theme, streaming-service inspired)
// ---------------------------------------------------------------------------

export const p = {
  // Backgrounds
  bg: '#0a0a0a',
  bgBar: '#181818',
  bgSurface: '#242424',
  bgHover: '#2a2a2a',
  bgActive: '#333333',
  bgOverlay: 'rgba(0, 0, 0, 0.85)',

  // Text
  text: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#6a6a6a',

  // Accent
  accent: '#1db954',
  accentHover: '#1ed760',

  // Progress
  progressBg: '#4d4d4d',
  progressBuffer: '#5e5e5e',
  progressFill: '#ffffff',
  progressHover: '#1db954',

  // Borders
  border: '#282828',

  // Sizing
  barHeight: 90,
  artworkSize: 64,
  artworkSizeSmall: 48,
  controlSize: 32,
  controlSizeLarge: 48,

  // Radius
  radius: 8,
  radiusSmall: 4,
  radiusRound: 9999,

  // Timing
  transition: '200ms ease-in-out',
  transitionFast: '100ms ease-in-out',
} as const;

// ---------------------------------------------------------------------------
// Source-specific accent colors
// ---------------------------------------------------------------------------

export const sourceAccent: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]: '#1db954',
  [MediaSourceType.YOUTUBE]: '#ff0000',
  [MediaSourceType.JELLYFIN]: '#aa5cc3',
};

export const sourceLabel: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]: 'Listening on Spotify',
  [MediaSourceType.YOUTUBE]: 'Playing from YouTube',
  [MediaSourceType.JELLYFIN]: 'Playing from Library',
};

export const sourceName: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]: 'Spotify',
  [MediaSourceType.YOUTUBE]: 'YouTube',
  [MediaSourceType.JELLYFIN]: 'Jellyfin',
};

// ---------------------------------------------------------------------------
// Reusable style fragments
// ---------------------------------------------------------------------------

export const truncateText: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const iconButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'none',
  border: 'none',
  color: p.textSecondary,
  cursor: 'pointer',
  padding: 0,
  borderRadius: p.radiusRound,
  transition: `color ${p.transition}`,
};

export const iconButtonHover: CSSProperties = {
  color: p.text,
};

export const iconButtonDisabled: CSSProperties = {
  color: p.textMuted,
  cursor: 'default',
  opacity: 0.5,
};

export const iconButtonActive: CSSProperties = {
  color: p.accent,
};

// ---------------------------------------------------------------------------
// Utility: format seconds/ms to MM:SS
// ---------------------------------------------------------------------------

export function formatTime(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Source badge styles
// ---------------------------------------------------------------------------

export function sourceBadge(sourceType: MediaSourceType): CSSProperties {
  const color = sourceAccent[sourceType];
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: p.radiusRound,
    fontSize: 11,
    fontWeight: 600,
    backgroundColor: color + '20',
    color,
    letterSpacing: '0.3px',
  };
}
