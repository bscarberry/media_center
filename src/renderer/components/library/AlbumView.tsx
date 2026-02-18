// ============================================================================
// AlbumView – album detail page with tracklist
// ============================================================================

import React, { useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SpotifyAPI } from '../../services/spotify/SpotifyAPI';
import { JellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { MediaAlbum } from '../../types/library';
import {
  spotifyTrackToMediaTrack,
  jellyfinBaseItemToMediaTrack,
} from '../../services/search/SearchService';
import { TrackCard, GridSkeleton } from './ContentGrid';
import {
  theme,
  formatDuration,
  sourceBadgeStyle,
  sourceLabels,
} from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AlbumViewProps {
  spotifyApi?: SpotifyAPI;
  jellyfinClient?: JellyfinClient;
  onPlayTrack?: (track: MediaTrack) => void;
  onPlayAll?: (tracks: MediaTrack[], startIndex?: number) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlbumView({
  spotifyApi,
  jellyfinClient,
  onPlayTrack,
  onPlayAll,
  onAddToQueue,
}: AlbumViewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Parse "sourceType:sourceId" from route param
  const [sourceType, ...sourceIdParts] = (id ?? '').split(':');
  const sourceId = sourceIdParts.join(':');

  const { data, isLoading } = useQuery({
    queryKey: ['album', sourceType, sourceId],
    queryFn: async (): Promise<{ album: MediaAlbum; tracks: MediaTrack[] }> => {
      if (sourceType === MediaSourceType.SPOTIFY && spotifyApi) {
        const albumData = await spotifyApi.getAlbum(sourceId);
        const album: MediaAlbum = {
          id: `spotify:album:${albumData.id}`,
          sourceType: MediaSourceType.SPOTIFY,
          sourceId: albumData.id,
          title: albumData.name,
          artist: albumData.artists.map((a) => a.name).join(', '),
          artwork: albumData.images?.[0]?.url ?? null,
          year: albumData.release_date?.split('-')[0],
          trackCount: albumData.total_tracks,
          genres: [],
        };
        const tracks: MediaTrack[] = albumData.tracks.items.map((t) =>
          spotifyTrackToMediaTrack({
            ...t,
            album: { id: albumData.id, name: albumData.name, uri: albumData.uri, images: albumData.images },
          }),
        );
        return { album, tracks };
      }

      if (sourceType === MediaSourceType.JELLYFIN && jellyfinClient) {
        const result = await jellyfinClient.getTracks(sourceId);
        const firstItem = result.Items[0];
        const album: MediaAlbum = {
          id: `jellyfin:album:${sourceId}`,
          sourceType: MediaSourceType.JELLYFIN,
          sourceId,
          title: firstItem?.Album ?? 'Unknown Album',
          artist: firstItem?.AlbumArtist ?? firstItem?.Artists?.join(', ') ?? '',
          artwork: jellyfinClient.getImageUrl(sourceId),
          year: firstItem?.ProductionYear?.toString(),
          trackCount: result.TotalRecordCount,
          genres: firstItem?.Genres,
        };
        const tracks = result.Items.map((item) => jellyfinBaseItemToMediaTrack(item, jellyfinClient));
        return { album, tracks };
      }

      return { album: emptyAlbum(sourceType, sourceId), tracks: [] };
    },
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          <div style={{ width: 300, height: 300, backgroundColor: theme.bgHover, borderRadius: theme.radius }} />
          <div>
            <div style={{ height: 32, width: 250, backgroundColor: theme.bgHover, borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 20, width: 180, backgroundColor: theme.bgHover, borderRadius: 4 }} />
          </div>
        </div>
        <GridSkeleton count={8} />
      </div>
    );
  }

  if (!data) return null;
  const { album, tracks } = data;

  const totalDuration = tracks.reduce((sum, t) => sum + t.duration, 0);

  return (
    <div>
      {/* ---- Header ---------------------------------------------------- */}
      <div style={headerStyle}>
        {album.artwork && (
          <img
            src={album.artwork}
            alt={album.title}
            style={{ width: 300, height: 300, borderRadius: theme.radius, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        <div style={{ minWidth: 0 }}>
          <span style={sourceBadgeStyle(album.sourceType)}>
            {sourceLabels[album.sourceType]}
          </span>
          <h1 style={{ fontSize: 36, fontWeight: 800, color: theme.text, margin: '8px 0' }}>
            {album.title}
          </h1>
          <div style={{ fontSize: 16, color: theme.textSecondary }}>
            <span
              style={{ cursor: 'pointer', color: theme.text, fontWeight: 600 }}
              onClick={() => {
                // Navigate to artist (best-effort: use first artist name for lookup)
                navigate(`/library/artists/${album.sourceType}:${encodeURIComponent(album.sourceId)}`);
              }}
            >
              {album.artist}
            </span>
          </div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, display: 'flex', gap: 8 }}>
            {album.year && <span>{album.year}</span>}
            {album.trackCount && <span>{album.trackCount} tracks</span>}
            {totalDuration > 0 && <span>{formatDuration(totalDuration)}</span>}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
            <button
              onClick={() => onPlayAll?.(tracks, 0)}
              style={playButton}
            >
              {'\u25B6'} Play
            </button>
            <button
              onClick={() => {
                // Shuffle: randomize order and play
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
        {tracks.map((track, i) => (
          <TrackCard
            key={track.id}
            track={track}
            index={i}
            onPlay={(t) => onPlayAll ? onPlayAll(tracks, i) : onPlayTrack?.(t)}
            onAddToQueue={onAddToQueue}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyAlbum(sourceType: string, sourceId: string): MediaAlbum {
  return {
    id: `${sourceType}:album:${sourceId}`,
    sourceType: sourceType as MediaSourceType,
    sourceId,
    title: 'Unknown Album',
    artist: '',
    artwork: null,
  };
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
  transition: theme.transition,
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
  transition: theme.transition,
};
