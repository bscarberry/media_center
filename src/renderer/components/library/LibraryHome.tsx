// ============================================================================
// LibraryHome – default landing page for /library
// ============================================================================

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { SpotifyAPI } from '../../services/spotify/SpotifyAPI';
import { JellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { MediaPlaylist, MediaAlbum, RecentlyPlayedEntry } from '../../types/library';
import { spotifyTrackToMediaTrack, jellyfinBaseItemToMediaAlbum } from '../../services/search/SearchService';
import { ContentGrid, GridSkeleton } from './ContentGrid';
import { RecentlyPlayed, loadRecentlyPlayed, clearRecentlyPlayed } from './RecentlyPlayed';
import { theme } from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LibraryHomeProps {
  spotifyApi?: SpotifyAPI;
  jellyfinClient?: JellyfinClient;
  onPlayTrack?: (track: MediaTrack) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LibraryHome({
  spotifyApi,
  jellyfinClient,
  onPlayTrack,
  onAddToQueue,
}: LibraryHomeProps) {
  // -- Recently played from localStorage -----------------------------------
  const { data: recentEntries, refetch: refetchRecent } = useQuery({
    queryKey: ['recently-played-local'],
    queryFn: () => loadRecentlyPlayed(),
    staleTime: 30_000,
  });

  // -- Spotify playlists ---------------------------------------------------
  const { data: spotifyPlaylists, isLoading: loadingPlaylists } = useQuery({
    queryKey: ['spotify-playlists'],
    queryFn: async () => {
      if (!spotifyApi) return [];
      const data = await spotifyApi.getUserPlaylists(20);
      return data.items.map((pl): MediaPlaylist => ({
        id: `spotify:playlist:${pl.id}`,
        sourceType: MediaSourceType.SPOTIFY,
        sourceId: pl.id,
        title: pl.name,
        description: pl.description ?? undefined,
        artwork: pl.images?.[0]?.url ?? null,
        trackCount: pl.tracks.total,
        owner: pl.owner.display_name ?? undefined,
      }));
    },
    enabled: !!spotifyApi,
    staleTime: 5 * 60 * 1000,
  });

  // -- Jellyfin recent albums ----------------------------------------------
  const { data: jellyfinAlbums, isLoading: loadingJellyfin } = useQuery({
    queryKey: ['jellyfin-recent-albums'],
    queryFn: async () => {
      if (!jellyfinClient?.isAuthenticated()) return [];
      const data = await jellyfinClient.getRecentlyAdded(12);
      return data.Items
        .filter((i) => i.Type === 'MusicAlbum')
        .map((i) => jellyfinBaseItemToMediaAlbum(i, jellyfinClient));
    },
    enabled: !!jellyfinClient,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: theme.text, marginBottom: 24 }}>
        Your Library
      </h1>

      {/* Recently Played */}
      {(recentEntries?.length ?? 0) > 0 && (
        <div style={{ marginBottom: 36 }}>
          <RecentlyPlayed
            entries={recentEntries!}
            onPlay={onPlayTrack}
            onClear={() => { clearRecentlyPlayed(); refetchRecent(); }}
          />
        </div>
      )}

      {/* Spotify Playlists */}
      {spotifyApi && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={sectionTitle}>Your Playlists</h2>
          {loadingPlaylists ? (
            <GridSkeleton count={6} />
          ) : (
            <ContentGrid playlists={spotifyPlaylists ?? []} />
          )}
        </div>
      )}

      {/* Jellyfin Recent Albums */}
      {jellyfinClient && (
        <div style={{ marginBottom: 36 }}>
          <h2 style={sectionTitle}>Recently Added</h2>
          {loadingJellyfin ? (
            <GridSkeleton count={6} />
          ) : (
            <ContentGrid albums={jellyfinAlbums ?? []} />
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionTitle = {
  fontSize: 20,
  fontWeight: 700,
  color: theme.text,
  marginBottom: 12,
} as const;
