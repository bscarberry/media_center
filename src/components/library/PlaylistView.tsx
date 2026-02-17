// ============================================================================
// PlaylistView – playlist detail page with track list and editing
// ============================================================================

import React, { useState, useCallback, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SpotifyAPI } from '../../services/spotify/SpotifyAPI';
import { YouTubeService } from '../../services/youtube/YouTubeService';
import { JellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { MediaPlaylist } from '../../types/library';
import {
  spotifyTrackToMediaTrack,
  youtubeItemToMediaTrack,
  jellyfinBaseItemToMediaTrack,
} from '../../services/search/SearchService';
import { TrackCard, GridSkeleton } from './ContentGrid';
import { theme, formatDuration, sourceBadgeStyle, sourceLabels } from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlaylistViewProps {
  spotifyApi?: SpotifyAPI;
  youtubeService?: YouTubeService;
  jellyfinClient?: JellyfinClient;
  onPlayTrack?: (track: MediaTrack) => void;
  onPlayAll?: (tracks: MediaTrack[], startIndex?: number) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface PlaylistData {
  playlist: MediaPlaylist;
  tracks: MediaTrack[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaylistView({
  spotifyApi,
  youtubeService,
  jellyfinClient,
  onPlayTrack,
  onPlayAll,
  onAddToQueue,
}: PlaylistViewProps) {
  const { id } = useParams<{ id: string }>();

  const [sourceType, ...sourceIdParts] = (id ?? '').split(':');
  const sourceId = sourceIdParts.join(':');

  const { data, isLoading } = useQuery({
    queryKey: ['playlist', sourceType, sourceId],
    queryFn: async (): Promise<PlaylistData> => {
      if (sourceType === MediaSourceType.SPOTIFY && spotifyApi) {
        const [pl, tracksData] = await Promise.all([
          spotifyApi.getPlaylist(sourceId),
          spotifyApi.getPlaylistTracks(sourceId, 100),
        ]);

        const playlist: MediaPlaylist = {
          id: `spotify:playlist:${pl.id}`,
          sourceType: MediaSourceType.SPOTIFY,
          sourceId: pl.id,
          title: pl.name,
          description: pl.description ?? undefined,
          artwork: pl.images?.[0]?.url ?? null,
          trackCount: pl.tracks.total,
          owner: pl.owner.display_name ?? undefined,
        };

        const tracks = tracksData.items.map((i) => spotifyTrackToMediaTrack(i.track));
        return { playlist, tracks };
      }

      if (sourceType === MediaSourceType.YOUTUBE && youtubeService) {
        const items = await youtubeService.getPlaylist(sourceId, 50);
        const tracks = items.map(youtubeItemToMediaTrack);
        const playlist: MediaPlaylist = {
          id: `youtube:playlist:${sourceId}`,
          sourceType: MediaSourceType.YOUTUBE,
          sourceId,
          title: items[0]?.title ?? 'YouTube Playlist',
          artwork: items[0]?.thumbnail ?? null,
          trackCount: items.length,
        };
        return { playlist, tracks };
      }

      if (sourceType === MediaSourceType.JELLYFIN && jellyfinClient) {
        const result = await jellyfinClient.getTracks(sourceId);
        const tracks = result.Items.map((item) => jellyfinBaseItemToMediaTrack(item, jellyfinClient));
        const playlist: MediaPlaylist = {
          id: `jellyfin:playlist:${sourceId}`,
          sourceType: MediaSourceType.JELLYFIN,
          sourceId,
          title: 'Playlist',
          artwork: null,
          trackCount: result.TotalRecordCount,
        };
        return { playlist, tracks };
      }

      return {
        playlist: {
          id: `${sourceType}:playlist:${sourceId}`,
          sourceType: sourceType as MediaSourceType,
          sourceId,
          title: 'Unknown Playlist',
          artwork: null,
        },
        tracks: [],
      };
    },
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
  });

  // -- Drag-to-reorder state (for user playlists) --------------------------
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((_index: number) => {
    // In a full implementation, this would reorder the playlist via the API
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
          <div style={{ width: 240, height: 240, backgroundColor: theme.bgHover, borderRadius: theme.radius }} />
          <div>
            <div style={{ height: 28, width: 200, backgroundColor: theme.bgHover, borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 16, width: 300, backgroundColor: theme.bgHover, borderRadius: 4 }} />
          </div>
        </div>
        <GridSkeleton count={8} />
      </div>
    );
  }

  if (!data) return null;
  const { playlist, tracks } = data;

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <div>
      {/* ---- Header ---------------------------------------------------- */}
      <div style={headerStyle}>
        {playlist.artwork ? (
          <img
            src={playlist.artwork}
            alt={playlist.title}
            style={{ width: 240, height: 240, borderRadius: theme.radius, objectFit: 'cover', flexShrink: 0 }}
          />
        ) : (
          <div style={{
            width: 240,
            height: 240,
            borderRadius: theme.radius,
            backgroundColor: theme.bgHover,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
            color: theme.textMuted,
            flexShrink: 0,
          }}>
            {'\u{266B}'}
          </div>
        )}

        <div style={{ minWidth: 0 }}>
          <span style={sourceBadgeStyle(playlist.sourceType)}>
            {sourceLabels[playlist.sourceType]}
          </span>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: theme.text, margin: '8px 0' }}>
            {playlist.title}
          </h1>
          {playlist.description && (
            <p style={{ fontSize: 14, color: theme.textSecondary, margin: '4px 0' }}>
              {playlist.description}
            </p>
          )}
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, display: 'flex', gap: 8 }}>
            {playlist.owner && <span>by {playlist.owner}</span>}
            {playlist.trackCount !== undefined && (
              <span>{playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}</span>
            )}
            {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button onClick={() => onPlayAll?.(tracks, 0)} style={playButton}>
              {'\u25B6'} Play
            </button>
            <button
              onClick={() => {
                const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                onPlayAll?.(shuffled, 0);
              }}
              style={secondaryButton}
            >
              Shuffle
            </button>
          </div>
        </div>
      </div>

      {/* ---- Track list ------------------------------------------------- */}
      <div style={{ marginTop: 24 }}>
        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          borderBottom: `1px solid ${theme.border}`,
          color: theme.textMuted,
          fontSize: 12,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          <span style={{ width: 24, textAlign: 'right' }}>#</span>
          <span style={{ width: 40 }} />
          <span style={{ flex: 1 }}>Title</span>
          <span style={{ width: 60 }}>Source</span>
          <span style={{ width: 50, textAlign: 'right' }}>Duration</span>
          <span style={{ width: 24 }} />
        </div>

        {tracks.map((track, i) => (
          <div
            key={track.id}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={(e) => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            style={{
              opacity: dragIndex === i ? 0.5 : 1,
              borderTop: dragOverIndex === i ? `2px solid ${theme.accent}` : 'none',
            }}
          >
            <TrackCard
              track={track}
              index={i}
              onPlay={(t) => onPlayAll ? onPlayAll(tracks, i) : onPlayTrack?.(t)}
              onAddToQueue={onAddToQueue}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const headerStyle: CSSProperties = {
  display: 'flex',
  gap: 24,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
};

const playButton: CSSProperties = {
  padding: '12px 32px',
  borderRadius: 9999,
  backgroundColor: theme.accent,
  border: 'none',
  color: theme.bg,
  fontSize: 14,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButton: CSSProperties = {
  padding: '12px 32px',
  borderRadius: 9999,
  backgroundColor: 'transparent',
  border: `1px solid ${theme.textSecondary}`,
  color: theme.text,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
