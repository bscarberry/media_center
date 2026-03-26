// ============================================================================
// Player theme – design tokens for playback control components
// ============================================================================

import type { CSSProperties } from 'react';
import { MediaSourceType } from '../../types/media';

// ---------------------------------------------------------------------------
// Color tokens – Roon-inspired dark theme
// ---------------------------------------------------------------------------

export const p = {
  // Backgrounds
  bg:        '#0B0B0E',
  bgBar:     'rgba(10,10,14,0.88)',   // glass base
  bgSurface: '#1A1A1F',
  bgHover:   'rgba(255,255,255,0.05)',
  bgActive:  'rgba(255,255,255,0.09)',
  bgOverlay: 'rgba(0,0,0,0.9)',

  // Text
  text:          '#F0F0F5',
  textSecondary: 'rgba(240,240,245,0.55)',
  textMuted:     'rgba(240,240,245,0.28)',

  // Accent
  accent:      '#7B7CF8',
  accentHover: '#9394FA',

  // Progress
  progressBg:     'rgba(255,255,255,0.12)',
  progressBuffer: 'rgba(255,255,255,0.2)',
  progressFill:   '#ffffff',
  progressHover:  '#7B7CF8',

  // Borders
  border: 'rgba(255,255,255,0.07)',

  // Sizing
  barHeight:         88,
  artworkSize:       68,
  artworkSizeSmall:  48,
  controlSize:       32,
  controlSizeLarge:  46,

  // Radius
  radius:      10,
  radiusSmall:  6,
  radiusRound: 9999,

  // Timing
  transition:     '200ms cubic-bezier(0.4,0,0.2,1)',
  transitionFast: '120ms cubic-bezier(0.4,0,0.2,1)',
} as const;

// ---------------------------------------------------------------------------
// Source-specific accent colors
// ---------------------------------------------------------------------------

export const sourceAccent: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]:  '#1DB954',
  [MediaSourceType.YOUTUBE]:  '#FF4444',
  [MediaSourceType.JELLYFIN]: '#AA5CC3',
};

export const sourceLabel: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]:  'Listening on Spotify',
  [MediaSourceType.YOUTUBE]:  'Playing from YouTube',
  [MediaSourceType.JELLYFIN]: 'Playing from Library',
};

export const sourceName: Record<MediaSourceType, string> = {
  [MediaSourceType.SPOTIFY]:  'Spotify',
  [MediaSourceType.YOUTUBE]:  'YouTube',
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

export const iconButtonHover: CSSProperties = { color: p.text };

export const iconButtonDisabled: CSSProperties = {
  color: p.textMuted,
  cursor: 'default',
  opacity: 0.4,
};

export const iconButtonActive: CSSProperties = { color: p.accent };

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
    backgroundColor: color + '18',
    color,
    letterSpacing: '0.2px',
  };
}

