// ============================================================================
// RecentlyPlayed – horizontal carousel of listening history
// ============================================================================

import React, { useRef, useCallback, type CSSProperties } from 'react';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { RecentlyPlayedEntry } from '../../types/library';
import {
  theme,
  truncate,
  formatDuration,
  sourceBadgeStyle,
  sourceLabels,
} from './styles';

// ---------------------------------------------------------------------------
// localStorage persistence
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'media-hub:recently-played';
const MAX_ENTRIES = 50;

export function loadRecentlyPlayed(): RecentlyPlayedEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentlyPlayedEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveRecentlyPlayed(entries: RecentlyPlayedEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addToRecentlyPlayed(track: MediaTrack): void {
  const entries = loadRecentlyPlayed();
  // Remove duplicate if exists
  const filtered = entries.filter((e) => e.track.id !== track.id);
  filtered.unshift({ track, playedAt: Date.now() });
  saveRecentlyPlayed(filtered);
}

export function clearRecentlyPlayed(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecentlyPlayedProps {
  entries: RecentlyPlayedEntry[];
  onPlay?: (track: MediaTrack) => void;
  onClear?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RecentlyPlayed({ entries, onPlay, onClear }: RecentlyPlayedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = useCallback((direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = 300;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }, []);

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: theme.textSecondary }}>
        <div style={{ fontSize: 16, marginBottom: 8 }}>No listening history yet</div>
        <div style={{ fontSize: 13, color: theme.textMuted }}>
          Tracks you play will appear here
        </div>
      </div>
    );
  }

  // Group consecutive entries from the same album
  const groups = groupBySession(entries);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: theme.text, margin: 0 }}>
          Recently Played
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={() => scroll('left')} style={scrollButton}>{'\u2039'}</button>
          <button onClick={() => scroll('right')} style={scrollButton}>{'\u203A'}</button>
          {onClear && (
            <button onClick={onClear} style={clearButton}>
              Clear history
            </button>
          )}
        </div>
      </div>

      {/* Horizontal scrolling carousel */}
      <div ref={scrollRef} style={carouselStyle}>
        {groups.map((group, gi) => (
          <div key={gi} style={{ flexShrink: 0, width: 160 }}>
            <div
              onClick={() => onPlay?.(group.entries[0].track)}
              style={{
                cursor: 'pointer',
                transition: theme.transition,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              <div style={{
                position: 'relative',
                width: 160,
                height: 160,
                borderRadius: theme.radius,
                overflow: 'hidden',
                backgroundColor: theme.bgHover,
              }}>
                {group.entries[0].track.artwork ? (
                  <img
                    src={group.entries[0].track.artwork}
                    alt={group.entries[0].track.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 32,
                    color: theme.textMuted,
                  }}>
                    {'\u{266B}'}
                  </div>
                )}

                {group.entries.length > 1 && (
                  <div style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    padding: '2px 6px',
                    borderRadius: 10,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    color: theme.text,
                    fontSize: 10,
                    fontWeight: 600,
                  }}>
                    {group.entries.length} tracks
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ ...truncate, fontSize: 13, fontWeight: 600, color: theme.text, maxWidth: 160 }}>
                  {group.entries.length > 1 ? group.albumName : group.entries[0].track.title}
                </div>
                <div style={{ ...truncate, fontSize: 12, color: theme.textSecondary, maxWidth: 160, marginTop: 2 }}>
                  {group.entries[0].track.artist}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <span style={sourceBadgeStyle(group.entries[0].track.sourceType)}>
                    {sourceLabels[group.entries[0].track.sourceType]}
                  </span>
                  <span style={{ fontSize: 10, color: theme.textMuted }}>
                    {formatTimeAgo(group.entries[0].playedAt)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group consecutive entries from the same album
// ---------------------------------------------------------------------------

interface SessionGroup {
  albumName: string;
  entries: RecentlyPlayedEntry[];
}

function groupBySession(entries: RecentlyPlayedEntry[]): SessionGroup[] {
  const groups: SessionGroup[] = [];
  let currentGroup: SessionGroup | null = null;

  for (const entry of entries) {
    const albumKey = entry.track.album ?? entry.track.title;
    if (currentGroup && currentGroup.albumName === albumKey) {
      currentGroup.entries.push(entry);
    } else {
      currentGroup = { albumName: albumKey, entries: [entry] };
      groups.push(currentGroup);
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Time-ago formatter
// ---------------------------------------------------------------------------

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const carouselStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 8,
  scrollbarWidth: 'thin',
  scrollbarColor: `${theme.bgHover} transparent`,
};

const scrollButton: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  backgroundColor: theme.surface,
  border: `1px solid ${theme.border}`,
  color: theme.text,
  fontSize: 18,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const clearButton: CSSProperties = {
  background: 'none',
  border: 'none',
  color: theme.textMuted,
  fontSize: 12,
  cursor: 'pointer',
  padding: '4px 8px',
};
