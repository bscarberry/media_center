// ============================================================================
// ArtistView – artist detail page with tabs: Overview, Discography, Related
// ============================================================================

import React, { useState, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SpotifyAPI } from '../../services/spotify/SpotifyAPI';
import { YouTubeMusicService } from '../../services/youtube/YouTubeMusicService';
import { JellyfinClient } from '../../services/jellyfin/JellyfinClient';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { MediaAlbum, MediaArtist } from '../../types/library';
import {
  spotifyTrackToMediaTrack,
  youtubeItemToMediaTrack,
  jellyfinBaseItemToMediaTrack,
  jellyfinBaseItemToMediaAlbum,
} from '../../services/search/SearchService';
import { TrackCard, AlbumCard, GridSkeleton } from './ContentGrid';
import { theme, sourceBadgeStyle, sourceLabels } from './styles';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArtistViewProps {
  spotifyApi?: SpotifyAPI;
  youtubeMusicService?: YouTubeMusicService;
  jellyfinClient?: JellyfinClient;
  onPlayTrack?: (track: MediaTrack) => void;
  onPlayAll?: (tracks: MediaTrack[], startIndex?: number) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

interface ArtistData {
  artist: MediaArtist;
  topTracks: MediaTrack[];
  albums: MediaAlbum[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Tab = 'overview' | 'discography' | 'related';

export function ArtistView({
  spotifyApi,
  youtubeMusicService,
  jellyfinClient,
  onPlayTrack,
  onPlayAll,
  onAddToQueue,
}: ArtistViewProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [sourceType, ...sourceIdParts] = (id ?? '').split(':');
  const sourceId = sourceIdParts.join(':');

  const { data, isLoading } = useQuery({
    queryKey: ['artist', sourceType, sourceId],
    queryFn: async (): Promise<ArtistData> => {
      if (sourceType === MediaSourceType.SPOTIFY && spotifyApi) {
        // Spotify: search for the artist's tracks and albums
        const [trackResults, albumResults] = await Promise.all([
          spotifyApi.search(sourceId, 'track', 20),
          spotifyApi.search(sourceId, 'album', 20),
        ]);

        const topTracks = trackResults.tracks?.items.map(spotifyTrackToMediaTrack) ?? [];
        const albums: MediaAlbum[] = albumResults.albums?.items.map((a) => ({
          id: `spotify:album:${a.id}`,
          sourceType: MediaSourceType.SPOTIFY,
          sourceId: a.id,
          title: a.name,
          artist: sourceId,
          artwork: a.images?.[0]?.url ?? null,
        })) ?? [];

        return {
          artist: {
            id: `spotify:artist:${sourceId}`,
            sourceType: MediaSourceType.SPOTIFY,
            sourceId,
            name: sourceId, // We use the artist name as the sourceId for search-based lookup
            artwork: topTracks[0]?.artwork ?? null,
          },
          topTracks,
          albums,
        };
      }

      if (sourceType === MediaSourceType.YOUTUBE && youtubeMusicService) {
        const topTracks = (await youtubeMusicService.getArtistTopTracks(sourceId, 20))
          .map(youtubeItemToMediaTrack);

        return {
          artist: {
            id: `youtube:artist:${sourceId}`,
            sourceType: MediaSourceType.YOUTUBE,
            sourceId,
            name: sourceId,
            artwork: topTracks[0]?.artwork ?? null,
          },
          topTracks,
          albums: [],
        };
      }

      if (sourceType === MediaSourceType.JELLYFIN && jellyfinClient) {
        const albumResult = await jellyfinClient.getAlbums(sourceId, 100);
        const albums = albumResult.Items.map((item) => jellyfinBaseItemToMediaAlbum(item, jellyfinClient));

        // Get tracks from all albums (first few)
        const firstAlbumTracks = albumResult.Items.length > 0
          ? await jellyfinClient.getTracks(albumResult.Items[0].Id)
          : { Items: [] };
        const topTracks = firstAlbumTracks.Items.map((item) =>
          jellyfinBaseItemToMediaTrack(item, jellyfinClient),
        );

        const firstItem = albumResult.Items[0];
        return {
          artist: {
            id: `jellyfin:artist:${sourceId}`,
            sourceType: MediaSourceType.JELLYFIN,
            sourceId,
            name: firstItem?.AlbumArtist ?? firstItem?.Artists?.[0] ?? decodeURIComponent(sourceId),
            artwork: firstItem?.ImageTags?.Primary
              ? jellyfinClient.getImageUrl(sourceId)
              : null,
          },
          topTracks,
          albums,
        };
      }

      return {
        artist: {
          id: `${sourceType}:artist:${sourceId}`,
          sourceType: sourceType as MediaSourceType,
          sourceId,
          name: decodeURIComponent(sourceId),
          artwork: null,
        },
        topTracks: [],
        albums: [],
      };
    },
    enabled: !!sourceId,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ height: 200, backgroundColor: theme.bgHover, borderRadius: theme.radius, marginBottom: 24 }} />
        <GridSkeleton count={8} />
      </div>
    );
  }

  if (!data) return null;
  const { artist, topTracks, albums } = data;

  return (
    <div>
      {/* ---- Banner ---------------------------------------------------- */}
      <div style={bannerStyle}>
        {artist.artwork && (
          <img
            src={artist.artwork}
            alt={artist.name}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              filter: 'blur(40px) brightness(0.4)',
            }}
          />
        )}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span style={sourceBadgeStyle(artist.sourceType)}>
            {sourceLabels[artist.sourceType]}
          </span>
          <h1 style={{ fontSize: 48, fontWeight: 900, color: theme.text, margin: '8px 0' }}>
            {artist.name}
          </h1>
          {artist.followers !== undefined && (
            <div style={{ fontSize: 14, color: theme.textSecondary }}>
              {artist.followers.toLocaleString()} followers
            </div>
          )}
          <button
            onClick={() => onPlayAll?.(topTracks, 0)}
            style={{ ...playButton, marginTop: 16 }}
            disabled={topTracks.length === 0}
          >
            {'\u25B6'} Play
          </button>
        </div>
      </div>

      {/* ---- Tabs ------------------------------------------------------ */}
      <div style={{ display: 'flex', gap: 0, marginTop: 24, borderBottom: `1px solid ${theme.border}` }}>
        {(['overview', 'discography', 'related'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? `2px solid ${theme.accent}` : '2px solid transparent',
              color: activeTab === tab ? theme.text : theme.textSecondary,
              fontSize: 14,
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ---- Tab content ------------------------------------------------ */}
      <div style={{ marginTop: 20 }}>
        {activeTab === 'overview' && (
          <>
            {topTracks.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <h3 style={sectionTitle}>Top Tracks</h3>
                {topTracks.slice(0, 10).map((track, i) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    index={i}
                    onPlay={(t) => onPlayAll ? onPlayAll(topTracks, i) : onPlayTrack?.(t)}
                    onAddToQueue={onAddToQueue}
                  />
                ))}
              </div>
            )}

            {albums.length > 0 && (
              <div>
                <h3 style={sectionTitle}>Albums</h3>
                <div style={gridStyle}>
                  {albums.slice(0, 6).map((album) => (
                    <AlbumCard key={album.id} album={album} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'discography' && (
          <div>
            {albums.length > 0 ? (
              <div style={gridStyle}>
                {albums.map((album) => (
                  <AlbumCard key={album.id} album={album} />
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: theme.textSecondary, padding: 40 }}>
                No albums found
              </div>
            )}
          </div>
        )}

        {activeTab === 'related' && (
          <div style={{ textAlign: 'center', color: theme.textSecondary, padding: 40 }}>
            Related artists coming soon
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const bannerStyle: CSSProperties = {
  position: 'relative',
  padding: '60px 32px 32px',
  borderRadius: theme.radius,
  overflow: 'hidden',
  backgroundColor: theme.bgHover,
  marginBottom: 0,
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

const sectionTitle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: theme.text,
  marginBottom: 12,
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: theme.gap,
};
