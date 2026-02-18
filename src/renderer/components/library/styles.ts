// ============================================================================
// Shared styles and constants for library components
// ============================================================================

import type { CSSProperties } from 'react';
import { MediaSourceType } from '../../types/media';

// ---------------------------------------------------------------------------
// Theme tokens (dark theme consistent with PlaybackBar)
// ---------------------------------------------------------------------------

export const theme = {
  bg: '#121212',
  bgElevated: '#1a1a1a',
  bgHover: '#282828',
  bgActive: '#333333',
  surface: '#242424',
  surfaceHover: '#2a2a2a',
  text: '#ffffff',
  textSecondary: '#b3b3b3',
  textMuted: '#6a6a6a',
  accent: '#1db954', // Spotify green — works well as primary accent
  border: '#333333',
  error: '#e74c3c',
  radius: 8,
  radiusSmall: 4,
  radiusRound: 9999,
  gap: 16,
  gapSmall: 8,
  transition: 'all 0.2s ease',
} as const;

// ---------------------------------------------------------------------------
// Source colors + icons (text labels used as icons)
// ---------------------------------------------------------------------------

export const sourceColors: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]: '#1db954',
  [MediaSourceType.YOUTUBE]: '#ff0000',
  [MediaSourceType.JELLYFIN]: '#00a4dc',
};

export const sourceLabels: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]: 'Spotify',
  [MediaSourceType.YOUTUBE]: 'YouTube',
  [MediaSourceType.JELLYFIN]: 'Jellyfin',
};

// ---------------------------------------------------------------------------
// Reusable style builders
// ---------------------------------------------------------------------------

export const cardBase: CSSProperties = {
  backgroundColor: theme.surface,
  borderRadius: theme.radius,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: theme.transition,
  position: 'relative',
};

export const truncate: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const pill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 14px',
  borderRadius: theme.radiusRound,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  border: `1px solid ${theme.border}`,
  backgroundColor: 'transparent',
  color: theme.textSecondary,
  transition: theme.transition,
};

export const pillActive: CSSProperties = {
  ...pill,
  backgroundColor: theme.text,
  color: theme.bg,
  borderColor: theme.text,
};

export const skeleton: CSSProperties = {
  backgroundColor: theme.bgHover,
  borderRadius: theme.radiusSmall,
  animation: 'pulse 1.5s ease-in-out infinite',
};

// ---------------------------------------------------------------------------
// Utility: format duration (ms → "m:ss" or "h:mm:ss")
// ---------------------------------------------------------------------------

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

// ---------------------------------------------------------------------------
// Source badge style
// ---------------------------------------------------------------------------

export function sourceBadgeStyle(sourceType: MediaSourceType): CSSProperties {
  return {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: theme.radiusSmall,
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    backgroundColor: sourceColors[sourceType] + '22',
    color: sourceColors[sourceType],
  };
}
