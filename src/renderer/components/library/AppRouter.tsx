// ============================================================================
// AppRouter – React Router configuration for the media library
// ============================================================================

import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MediaTrack } from '../../types/media';
import type { SpotifyAPI } from '../../services/spotify/SpotifyAPI';
import type { YouTubeService } from '../../services/youtube/YouTubeService';
import type { YouTubeMusicService } from '../../services/youtube/YouTubeMusicService';
import type { JellyfinClient } from '../../services/jellyfin/JellyfinClient';
import type { SearchService } from '../../services/search/SearchService';
import { LibraryBrowser } from './LibraryBrowser';
import { LibraryHome } from './LibraryHome';
import { UnifiedSearch } from './UnifiedSearch';
import { AlbumView } from './AlbumView';
import { ArtistView } from './ArtistView';
import { PlaylistView } from './PlaylistView';
import {
  RecentlyPlayed,
  loadRecentlyPlayed,
  clearRecentlyPlayed,
} from './RecentlyPlayed';
import { Recommendations } from './Recommendations';

// ---------------------------------------------------------------------------
// Query client (shared across the app)
// ---------------------------------------------------------------------------

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 2 * 60 * 1000, // 2 minutes default
      refetchOnWindowFocus: false,
    },
  },
});

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AppRouterProps {
  searchService: SearchService;
  spotifyApi?: SpotifyAPI;
  youtubeService?: YouTubeService;
  youtubeMusicService?: YouTubeMusicService;
  jellyfinClient?: JellyfinClient;
  currentTrack?: MediaTrack | null;
  onPlayTrack?: (track: MediaTrack) => void;
  onPlayAll?: (tracks: MediaTrack[], startIndex?: number) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppRouter({
  searchService,
  spotifyApi,
  youtubeService,
  youtubeMusicService,
  jellyfinClient,
  currentTrack,
  onPlayTrack,
  onPlayAll,
  onAddToQueue,
}: AppRouterProps) {
  // Shared props for detail views
  const detailProps = {
    spotifyApi,
    youtubeService,
    youtubeMusicService,
    jellyfinClient,
    onPlayTrack,
    onPlayAll,
    onAddToQueue,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          {/* -- Layout wrapper with sidebar ------------------------------- */}
          <Route path="/" element={<LibraryBrowser />}>
            {/* Default redirect */}
            <Route index element={<Navigate to="/library" replace />} />

            {/* Search */}
            <Route
              path="search"
              element={
                <UnifiedSearch
                  searchService={searchService}
                  onPlayTrack={onPlayTrack}
                  onAddToQueue={onAddToQueue}
                />
              }
            />

            {/* Library home */}
            <Route
              path="library"
              element={
                <LibraryHome
                  spotifyApi={spotifyApi}
                  jellyfinClient={jellyfinClient}
                  onPlayTrack={onPlayTrack}
                  onAddToQueue={onAddToQueue}
                />
              }
            />

            {/* Library sub-routes */}
            <Route path="library/liked" element={<LikedSongsPage {...detailProps} />} />
            <Route path="library/playlists" element={<PlaylistsPage {...detailProps} />} />
            <Route path="library/albums" element={<AlbumsPage {...detailProps} />} />
            <Route path="library/artists" element={<ArtistsPage {...detailProps} />} />

            {/* Detail views */}
            <Route path="library/albums/:id" element={<AlbumView {...detailProps} />} />
            <Route path="library/artists/:id" element={<ArtistView {...detailProps} />} />
            <Route path="library/playlists/:id" element={<PlaylistView {...detailProps} />} />

            {/* Jellyfin sub-routes */}
            <Route path="library/jellyfin" element={<JellyfinLibraryPage {...detailProps} />} />
            <Route path="library/jellyfin/recent" element={<JellyfinRecentPage {...detailProps} />} />
            <Route path="library/jellyfin/artists" element={<JellyfinArtistsPage {...detailProps} />} />
            <Route path="library/jellyfin/albums" element={<JellyfinAlbumsPage {...detailProps} />} />

            {/* Browsing */}
            <Route path="library/trending" element={<TrendingPage {...detailProps} />} />
            <Route path="library/new-releases" element={<NewReleasesPage {...detailProps} />} />
            <Route path="library/genres" element={<GenresPlaceholder />} />

            {/* Recently played */}
            <Route
              path="recently-played"
              element={<RecentlyPlayedPage onPlayTrack={onPlayTrack} />}
            />

            {/* Discover / Recommendations */}
            <Route
              path="discover"
              element={
                <Recommendations
                  spotifyApi={spotifyApi}
                  youtubeMusicService={youtubeMusicService}
                  jellyfinClient={jellyfinClient}
                  currentTrack={currentTrack}
                  onPlayTrack={onPlayTrack}
                  onPlayAll={onPlayAll}
                  onAddToQueue={onAddToQueue}
                />
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/library" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  );
}

// ===========================================================================
// Lightweight page components (route-level wrappers for existing components)
// ===========================================================================

import { useQuery } from '@tanstack/react-query';
import { MediaSourceType } from '../../types/media';
import type { MediaPlaylist, MediaAlbum, MediaArtist as MediaArtistType } from '../../types/library';
import {
  spotifyTrackToMediaTrack,
  jellyfinBaseItemToMediaTrack,
  jellyfinBaseItemToMediaAlbum,
  jellyfinBaseItemToMediaArtist,
} from '../../services/search/SearchService';
import { ContentGrid, GridSkeleton } from './ContentGrid';
import { theme } from './styles';

// -- Liked Songs page -------------------------------------------------------

function LikedSongsPage({ spotifyApi, jellyfinClient, onPlayTrack, onAddToQueue }: Record<string, any>) {
  const { data: tracks, isLoading } = useQuery({
    queryKey: ['liked-songs'],
    queryFn: async (): Promise<MediaTrack[]> => {
      const results: MediaTrack[] = [];

      if (spotifyApi) {
        try {
          const saved = await (spotifyApi as SpotifyAPI).getUserSavedTracks(50);
          results.push(...saved.items.map((i: any) => spotifyTrackToMediaTrack(i.track)));
        } catch { /* */ }
      }
      if ((jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) {
        try {
          const favs = await (jellyfinClient as JellyfinClient).getFavorites(50);
          results.push(
            ...favs.Items
              .filter((i: any) => i.Type === 'Audio')
              .map((i: any) => jellyfinBaseItemToMediaTrack(i, jellyfinClient as JellyfinClient)),
          );
        } catch { /* */ }
      }

      return results;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Liked Songs</h2>
      {isLoading ? <GridSkeleton /> : (
        <ContentGrid
          tracks={tracks ?? []}
          trackListMode
          onPlayTrack={onPlayTrack}
          onAddToQueue={onAddToQueue}
        />
      )}
    </div>
  );
}

// -- Playlists page ---------------------------------------------------------

function PlaylistsPage({ spotifyApi }: Record<string, any>) {
  const { data: playlists, isLoading } = useQuery({
    queryKey: ['all-playlists'],
    queryFn: async (): Promise<MediaPlaylist[]> => {
      const results: MediaPlaylist[] = [];
      if (spotifyApi) {
        try {
          const data = await (spotifyApi as SpotifyAPI).getUserPlaylists(50);
          results.push(
            ...data.items.map((pl: any): MediaPlaylist => ({
              id: `spotify:playlist:${pl.id}`,
              sourceType: MediaSourceType.SPOTIFY,
              sourceId: pl.id,
              title: pl.name,
              description: pl.description ?? undefined,
              artwork: pl.images?.[0]?.url ?? null,
              trackCount: pl.tracks?.total,
              owner: pl.owner?.display_name ?? undefined,
            })),
          );
        } catch { /* */ }
      }
      return results;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Playlists</h2>
      {isLoading ? <GridSkeleton /> : <ContentGrid playlists={playlists ?? []} />}
    </div>
  );
}

// -- Albums page ------------------------------------------------------------

function AlbumsPage({ jellyfinClient }: Record<string, any>) {
  const { data: albums, isLoading } = useQuery({
    queryKey: ['all-albums'],
    queryFn: async (): Promise<MediaAlbum[]> => {
      if (!(jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) return [];
      const data = await (jellyfinClient as JellyfinClient).getAlbums(undefined, 100);
      return data.Items.map((i) => jellyfinBaseItemToMediaAlbum(i, jellyfinClient as JellyfinClient));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Albums</h2>
      {isLoading ? <GridSkeleton /> : <ContentGrid albums={albums ?? []} />}
    </div>
  );
}

// -- Artists page -----------------------------------------------------------

function ArtistsPage({ jellyfinClient }: Record<string, any>) {
  const { data: artists, isLoading } = useQuery({
    queryKey: ['all-artists'],
    queryFn: async (): Promise<MediaArtistType[]> => {
      if (!(jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) return [];
      const data = await (jellyfinClient as JellyfinClient).getArtists(200);
      return data.Items.map((i) => jellyfinBaseItemToMediaArtist(i, jellyfinClient as JellyfinClient));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Artists</h2>
      {isLoading ? <GridSkeleton /> : <ContentGrid artists={artists ?? []} />}
    </div>
  );
}

// -- Jellyfin Library page --------------------------------------------------

function JellyfinLibraryPage({ jellyfinClient, onPlayTrack, onAddToQueue }: Record<string, any>) {
  const { data: tracks, isLoading } = useQuery({
    queryKey: ['jellyfin-library'],
    queryFn: async (): Promise<MediaTrack[]> => {
      if (!(jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) return [];
      const data = await (jellyfinClient as JellyfinClient).getMusicLibrary(100);
      return data.Items
        .filter((i: any) => i.Type === 'Audio')
        .map((i: any) => jellyfinBaseItemToMediaTrack(i, jellyfinClient as JellyfinClient));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Music Library</h2>
      {isLoading ? <GridSkeleton /> : (
        <ContentGrid tracks={tracks ?? []} trackListMode onPlayTrack={onPlayTrack} onAddToQueue={onAddToQueue} />
      )}
    </div>
  );
}

// -- Jellyfin Recent --------------------------------------------------------

function JellyfinRecentPage({ jellyfinClient, onPlayTrack, onAddToQueue }: Record<string, any>) {
  const { data: tracks, isLoading } = useQuery({
    queryKey: ['jellyfin-recent-tracks'],
    queryFn: async (): Promise<MediaTrack[]> => {
      if (!(jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) return [];
      const data = await (jellyfinClient as JellyfinClient).getRecentlyAdded(50);
      return data.Items
        .filter((i: any) => i.Type === 'Audio')
        .map((i: any) => jellyfinBaseItemToMediaTrack(i, jellyfinClient as JellyfinClient));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Recently Added</h2>
      {isLoading ? <GridSkeleton /> : (
        <ContentGrid tracks={tracks ?? []} trackListMode onPlayTrack={onPlayTrack} onAddToQueue={onAddToQueue} />
      )}
    </div>
  );
}

// -- Jellyfin Artists -------------------------------------------------------

function JellyfinArtistsPage({ jellyfinClient }: Record<string, any>) {
  const { data: artists, isLoading } = useQuery({
    queryKey: ['jellyfin-artists'],
    queryFn: async (): Promise<MediaArtistType[]> => {
      if (!(jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) return [];
      const data = await (jellyfinClient as JellyfinClient).getArtists(200);
      return data.Items.map((i) => jellyfinBaseItemToMediaArtist(i, jellyfinClient as JellyfinClient));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Artists</h2>
      {isLoading ? <GridSkeleton /> : <ContentGrid artists={artists ?? []} />}
    </div>
  );
}

// -- Jellyfin Albums --------------------------------------------------------

function JellyfinAlbumsPage({ jellyfinClient }: Record<string, any>) {
  const { data: albums, isLoading } = useQuery({
    queryKey: ['jellyfin-albums'],
    queryFn: async (): Promise<MediaAlbum[]> => {
      if (!(jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) return [];
      const data = await (jellyfinClient as JellyfinClient).getAlbums(undefined, 100);
      return data.Items.map((i) => jellyfinBaseItemToMediaAlbum(i, jellyfinClient as JellyfinClient));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Albums</h2>
      {isLoading ? <GridSkeleton /> : <ContentGrid albums={albums ?? []} />}
    </div>
  );
}

// -- Trending (YouTube) -----------------------------------------------------

function TrendingPage({ youtubeService, onPlayTrack, onAddToQueue }: Record<string, any>) {
  const { data: tracks, isLoading } = useQuery({
    queryKey: ['trending-youtube'],
    queryFn: async (): Promise<MediaTrack[]> => {
      if (!youtubeService) return [];
      const items = await (youtubeService as YouTubeService).search('trending music', 'music', 30);
      return items.map((i: any) => ({
        id: `youtube:${i.videoId}`,
        sourceType: MediaSourceType.YOUTUBE,
        sourceId: i.videoId,
        title: i.title,
        artist: i.artist,
        duration: i.duration * 1000,
        artwork: i.thumbnail,
        isPlayable: true,
        requiresAuth: false,
      }));
    },
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>Trending</h2>
      {isLoading ? <GridSkeleton /> : (
        <ContentGrid tracks={tracks ?? []} onPlayTrack={onPlayTrack} onAddToQueue={onAddToQueue} />
      )}
    </div>
  );
}

// -- New Releases -----------------------------------------------------------

function NewReleasesPage({ jellyfinClient }: Record<string, any>) {
  const { data: albums, isLoading } = useQuery({
    queryKey: ['new-releases'],
    queryFn: async (): Promise<MediaAlbum[]> => {
      if (!(jellyfinClient as JellyfinClient | undefined)?.isAuthenticated()) return [];
      const data = await (jellyfinClient as JellyfinClient).getRecentlyAdded(30);
      return data.Items
        .filter((i: any) => i.Type === 'MusicAlbum')
        .map((i: any) => jellyfinBaseItemToMediaAlbum(i, jellyfinClient as JellyfinClient));
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div>
      <h2 style={pageTitle}>New Releases</h2>
      {isLoading ? <GridSkeleton /> : <ContentGrid albums={albums ?? []} />}
    </div>
  );
}

// -- Recently Played page ---------------------------------------------------

function RecentlyPlayedPage({ onPlayTrack }: { onPlayTrack?: (track: MediaTrack) => void }) {
  const { data: entries, refetch } = useQuery({
    queryKey: ['recently-played-page'],
    queryFn: () => loadRecentlyPlayed(),
    staleTime: 30_000,
  });

  return (
    <div>
      <RecentlyPlayed
        entries={entries ?? []}
        onPlay={onPlayTrack}
        onClear={() => { clearRecentlyPlayed(); refetch(); }}
      />
    </div>
  );
}

// -- Genres placeholder -----------------------------------------------------

function GenresPlaceholder() {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: theme.textSecondary }}>
      <h2 style={{ fontSize: 20, color: theme.text, marginBottom: 8 }}>Genres</h2>
      <p style={{ color: theme.textMuted }}>Genre browsing coming soon</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const pageTitle = {
  fontSize: 24,
  fontWeight: 700,
  color: theme.text,
  marginBottom: 16,
} as const;
