// ============================================================================
// Recommendations – smart recommendations from multiple sources
// ============================================================================

import React, { useCallback, type CSSProperties } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SpotifyAPI } from '../../services/spotify/SpotifyAPI';
import { YouTubeMusicService } from '../../services/youtube/YouTubeMusicService';
import { JellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { RecommendationGroup } from '../../types/library';
import {
  spotifyTrackToMediaTrack,
  youtubeItemToMediaTrack,
  jellyfinBaseItemToMediaTrack,
} from '../../services/search/SearchService';
import { ContentGrid, GridSkeleton } from './ContentGrid';
import { theme, sourceLabels, sourceBadgeStyle } from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecommendationsProps {
  spotifyApi?: SpotifyAPI;
  youtubeMusicService?: YouTubeMusicService;
  jellyfinClient?: JellyfinClient;
  /** Currently playing track (used for "similar to" recommendations) */
  currentTrack?: MediaTrack | null;
  onPlayTrack?: (track: MediaTrack) => void;
  onPlayAll?: (tracks: MediaTrack[], startIndex?: number) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Recommendations({
  spotifyApi,
  youtubeMusicService,
  jellyfinClient,
  currentTrack,
  onPlayTrack,
  onPlayAll,
  onAddToQueue,
}: RecommendationsProps) {
  const queryClient = useQueryClient();

  // -- Fetch recommendation groups ------------------------------------------
  const { data: groups, isLoading } = useQuery({
    queryKey: ['recommendations', currentTrack?.id ?? 'none'],
    queryFn: async (): Promise<RecommendationGroup[]> => {
      const result: RecommendationGroup[] = [];
      const promises: Promise<void>[] = [];

      // Spotify recommendations
      if (spotifyApi) {
        promises.push(
          (async () => {
            try {
              // Discover: based on user's saved tracks
              const saved = await spotifyApi.getUserSavedTracks(5);
              if (saved.items.length > 0) {
                const seeds = saved.items.map((i) => i.track.id).slice(0, 5);
                const recs = await spotifyApi.getRecommendations(seeds, 20);
                result.push({
                  id: 'spotify-discover',
                  title: 'Discover Weekly',
                  description: 'Based on your saved tracks',
                  sourceType: MediaSourceType.SPOTIFY,
                  tracks: recs.tracks.map(spotifyTrackToMediaTrack),
                });
              }
            } catch { /* source unavailable */ }
          })(),
        );
      }

      // "Similar to currently playing"
      if (currentTrack) {
        if (currentTrack.sourceType === MediaSourceType.SPOTIFY && spotifyApi) {
          promises.push(
            (async () => {
              try {
                const trackId = currentTrack.sourceId.replace('spotify:track:', '');
                const recs = await spotifyApi.getRecommendations([trackId], 15);
                result.push({
                  id: 'similar-current',
                  title: `Similar to "${currentTrack.title}"`,
                  description: `Because you're listening to ${currentTrack.artist}`,
                  sourceType: MediaSourceType.SPOTIFY,
                  tracks: recs.tracks.map(spotifyTrackToMediaTrack),
                });
              } catch { /* ignore */ }
            })(),
          );
        }

        if (currentTrack.sourceType === MediaSourceType.YOUTUBE && youtubeMusicService) {
          promises.push(
            (async () => {
              try {
                const recs = await youtubeMusicService.getRecommendations(currentTrack.sourceId, 15);
                result.push({
                  id: 'yt-similar-current',
                  title: `Similar to "${currentTrack.title}"`,
                  description: `Because you're listening to ${currentTrack.artist}`,
                  sourceType: MediaSourceType.YOUTUBE,
                  tracks: recs.map(youtubeItemToMediaTrack),
                });
              } catch { /* ignore */ }
            })(),
          );
        }
      }

      // YouTube Music recommendations
      if (youtubeMusicService) {
        promises.push(
          (async () => {
            try {
              const liked = await youtubeMusicService.getLikedMusic(5);
              if (liked.length > 0) {
                const recs = await youtubeMusicService.getRecommendations(liked[0].videoId, 20);
                result.push({
                  id: 'yt-mix',
                  title: 'Your YouTube Mix',
                  description: 'Based on your liked music',
                  sourceType: MediaSourceType.YOUTUBE,
                  tracks: recs.map(youtubeItemToMediaTrack),
                });
              }
            } catch { /* source unavailable */ }
          })(),
        );
      }

      // Jellyfin recently added (as a form of discovery)
      if (jellyfinClient?.isAuthenticated()) {
        promises.push(
          (async () => {
            try {
              const recent = await jellyfinClient.getRecentlyAdded(20);
              if (recent.Items.length > 0) {
                result.push({
                  id: 'jellyfin-recent',
                  title: 'Recently Added to Library',
                  description: 'New additions to your Jellyfin library',
                  sourceType: MediaSourceType.JELLYFIN,
                  tracks: recent.Items
                    .filter((i) => i.Type === 'Audio')
                    .map((i) => jellyfinBaseItemToMediaTrack(i, jellyfinClient)),
                });
              }
            } catch { /* source unavailable */ }
          })(),
        );

        // Favorites
        promises.push(
          (async () => {
            try {
              const favs = await jellyfinClient.getFavorites(20);
              if (favs.Items.length > 0) {
                result.push({
                  id: 'jellyfin-favorites',
                  title: 'Your Favorites',
                  description: 'Tracks you love from your library',
                  sourceType: MediaSourceType.JELLYFIN,
                  tracks: favs.Items
                    .filter((i) => i.Type === 'Audio')
                    .map((i) => jellyfinBaseItemToMediaTrack(i, jellyfinClient)),
                });
              }
            } catch { /* ignore */ }
          })(),
        );
      }

      await Promise.allSettled(promises);
      return result.filter((g) => g.tracks.length > 0);
    },
    staleTime: 10 * 60 * 1000, // 10 min
  });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['recommendations'] });
  }, [queryClient]);

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h2 style={{ fontSize: 24, fontWeight: 700, color: theme.text, margin: 0 }}>Discover</h2>
        </div>
        <GridSkeleton count={12} />
      </div>
    );
  }

  const allGroups = groups ?? [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, color: theme.text, margin: 0 }}>Discover</h2>
        <button onClick={handleRefresh} style={refreshButton}>
          Refresh
        </button>
      </div>

      {allGroups.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: theme.textSecondary }}>
          <div style={{ fontSize: 18, marginBottom: 8 }}>No recommendations available</div>
          <div style={{ fontSize: 14, color: theme.textMuted }}>
            Play some music or connect more sources to get personalized recommendations
          </div>
        </div>
      )}

      {allGroups.map((group) => (
        <div key={group.id} style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: theme.text, margin: 0 }}>
              {group.title}
            </h3>
            <span style={sourceBadgeStyle(group.sourceType)}>
              {sourceLabels[group.sourceType]}
            </span>
          </div>
          {group.description && (
            <p style={{ fontSize: 13, color: theme.textSecondary, margin: '0 0 12px' }}>
              {group.description}
            </p>
          )}

          <ContentGrid
            tracks={group.tracks}
            onPlayTrack={(track) => {
              const idx = group.tracks.indexOf(track);
              onPlayAll ? onPlayAll(group.tracks, idx >= 0 ? idx : 0) : onPlayTrack?.(track);
            }}
            onAddToQueue={onAddToQueue}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const refreshButton: CSSProperties = {
  padding: '8px 20px',
  borderRadius: 9999,
  backgroundColor: 'transparent',
  border: `1px solid ${theme.border}`,
  color: theme.text,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: theme.transition,
};
