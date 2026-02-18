// ============================================================================
// SearchService – unified search coordinator across Spotify, YouTube, Jellyfin
// ============================================================================

import { SpotifyAPI } from '../spotify/SpotifyAPI';
import { YouTubeService } from '../youtube/YouTubeService';
import { YouTubeMusicService } from '../youtube/YouTubeMusicService';
import { JellyfinClient } from '../jellyfin/JellyfinClient';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type {
  SearchResults,
  SearchFilters,
  MediaAlbum,
  MediaArtist,
  MediaPlaylist,
  ContentType,
} from '../../types/library';
import { EMPTY_SEARCH_RESULTS } from '../../types/library';
import type { SpotifyTrack, SpotifySearchType } from '../../types/spotify';
import type { YouTubeItem, YouTubeMusicArtist } from '../../types/youtube';
import type { JellyfinBaseItem } from '../../types/jellyfin';

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  results: SearchResults;
  timestamp: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// SearchService
// ---------------------------------------------------------------------------

export interface SearchServiceDeps {
  spotifyApi?: SpotifyAPI;
  youtubeService?: YouTubeService;
  youtubeMusicService?: YouTubeMusicService;
  jellyfinClient?: JellyfinClient;
}

export class SearchService {
  private spotifyApi: SpotifyAPI | null;
  private youtubeService: YouTubeService | null;
  private youtubeMusicService: YouTubeMusicService | null;
  private jellyfinClient: JellyfinClient | null;
  private cache = new Map<string, CacheEntry>();

  constructor(deps: SearchServiceDeps) {
    this.spotifyApi = deps.spotifyApi ?? null;
    this.youtubeService = deps.youtubeService ?? null;
    this.youtubeMusicService = deps.youtubeMusicService ?? null;
    this.jellyfinClient = deps.jellyfinClient ?? null;
  }

  // -----------------------------------------------------------------------
  // Main search – coordinates parallel searches across all enabled sources
  // -----------------------------------------------------------------------

  async search(query: string, filters: SearchFilters): Promise<SearchResults> {
    if (!query.trim()) return { ...EMPTY_SEARCH_RESULTS, query };

    const cacheKey = this.buildCacheKey(query, filters);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.results;
    }

    const limit = filters.limit ?? 20;
    const promises: Promise<SourceSearchResult>[] = [];

    if (filters.sources.includes(MediaSourceType.SPOTIFY) && this.spotifyApi) {
      promises.push(this.searchSpotify(query, filters.contentTypes, limit));
    }
    if (filters.sources.includes(MediaSourceType.YOUTUBE) && (this.youtubeService || this.youtubeMusicService)) {
      promises.push(this.searchYouTube(query, filters.contentTypes, limit));
    }
    if (filters.sources.includes(MediaSourceType.JELLYFIN) && this.jellyfinClient) {
      promises.push(this.searchJellyfin(query, filters.contentTypes, limit));
    }

    const settled = await Promise.allSettled(promises);

    const combined: SearchResults = {
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
      sourceBreakdown: { spotify: 0, youtube: 0, jellyfin: 0 },
      query,
      hasMore: false,
    };

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        const r = result.value;
        combined.tracks.push(...r.tracks);
        combined.albums.push(...r.albums);
        combined.artists.push(...r.artists);
        combined.playlists.push(...r.playlists);
        combined.sourceBreakdown[r.source] += r.totalCount;
        if (r.hasMore) combined.hasMore = true;
      }
      // Rejected promises are silently skipped (source unavailable)
    }

    // Deduplicate tracks (same title + artist across sources)
    combined.tracks = this.deduplicateTracks(combined.tracks);

    // Sort by relevance (exact title match first, then starts-with, then contains)
    combined.tracks = this.sortByRelevance(combined.tracks, query);
    combined.albums = this.sortAlbumsByRelevance(combined.albums, query);
    combined.artists = this.sortArtistsByRelevance(combined.artists, query);

    this.cache.set(cacheKey, { results: combined, timestamp: Date.now() });
    return combined;
  }

  // -----------------------------------------------------------------------
  // Search individual source
  // -----------------------------------------------------------------------

  async searchSource(
    source: MediaSourceType,
    query: string,
    contentTypes: ContentType[],
    limit = 20,
  ): Promise<SearchResults> {
    const filters: SearchFilters = { sources: [source], contentTypes, limit };
    return this.search(query, filters);
  }

  // -----------------------------------------------------------------------
  // Clear cache
  // -----------------------------------------------------------------------

  clearCache(): void {
    this.cache.clear();
  }

  // =======================================================================
  // Private: per-source search implementations
  // =======================================================================

  private async searchSpotify(
    query: string,
    contentTypes: ContentType[],
    limit: number,
  ): Promise<SourceSearchResult> {
    const result: SourceSearchResult = {
      source: 'spotify',
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
      totalCount: 0,
      hasMore: false,
    };

    if (!this.spotifyApi) return result;

    const types: SpotifySearchType[] = [];
    if (contentTypes.includes('track')) types.push('track');
    if (contentTypes.includes('album')) types.push('album');
    if (contentTypes.includes('artist')) types.push('artist');
    if (types.length === 0 && contentTypes.includes('playlist')) {
      // Spotify search API doesn't have a playlist type in our wrapper,
      // so we search tracks by default
      types.push('track');
    }
    if (types.length === 0) types.push('track');

    try {
      const data = await this.spotifyApi.search(query, types, limit);

      if (data.tracks?.items) {
        result.tracks = data.tracks.items.map(spotifyTrackToMediaTrack);
        result.totalCount += data.tracks.items.length;
      }

      if (data.albums?.items) {
        result.albums = data.albums.items.map((a): MediaAlbum => ({
          id: `spotify:album:${a.id}`,
          sourceType: MediaSourceType.SPOTIFY,
          sourceId: a.id,
          title: a.name,
          artist: '', // SpotifyAlbumBrief doesn't have artists
          artwork: a.images?.[0]?.url ?? null,
        }));
        result.totalCount += data.albums.items.length;
      }

      if (data.artists?.items) {
        result.artists = data.artists.items.map((a): MediaArtist => ({
          id: `spotify:artist:${a.id}`,
          sourceType: MediaSourceType.SPOTIFY,
          sourceId: a.id,
          name: a.name,
          artwork: null,
        }));
        result.totalCount += data.artists.items.length;
      }

      result.hasMore = (data.tracks?.items.length ?? 0) >= limit;
    } catch {
      // Source unavailable — return empty
    }

    return result;
  }

  private async searchYouTube(
    query: string,
    contentTypes: ContentType[],
    limit: number,
  ): Promise<SourceSearchResult> {
    const result: SourceSearchResult = {
      source: 'youtube',
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
      totalCount: 0,
      hasMore: false,
    };

    try {
      // Search tracks via YouTube Music if available, else standard YouTube
      if (contentTypes.includes('track')) {
        let items: YouTubeItem[];
        if (this.youtubeMusicService) {
          items = await this.youtubeMusicService.searchSongs(query, limit);
        } else if (this.youtubeService) {
          items = await this.youtubeService.search(query, 'music', limit);
        } else {
          items = [];
        }

        result.tracks = items.map(youtubeItemToMediaTrack);
        result.totalCount += items.length;
        result.hasMore = items.length >= limit;
      }

      // Search artists
      if (contentTypes.includes('artist') && this.youtubeMusicService) {
        const artists = await this.youtubeMusicService.searchArtists(query, Math.min(limit, 10));
        result.artists = artists.map(youtubeArtistToMediaArtist);
        result.totalCount += artists.length;
      }

      // Search albums
      if (contentTypes.includes('album') && this.youtubeService) {
        // YouTube doesn't have a native album search, but we can search playlists
        // that look like albums (OLAK prefix)
        const items = await this.youtubeService.search(query + ' album', 'music', Math.min(limit, 10));
        result.albums = items.map((item): MediaAlbum => ({
          id: `youtube:album:${item.videoId}`,
          sourceType: MediaSourceType.YOUTUBE,
          sourceId: item.videoId,
          title: item.title,
          artist: item.artist,
          artwork: item.thumbnail,
        }));
        result.totalCount += items.length;
      }
    } catch {
      // Source unavailable
    }

    return result;
  }

  private async searchJellyfin(
    query: string,
    contentTypes: ContentType[],
    limit: number,
  ): Promise<SourceSearchResult> {
    const result: SourceSearchResult = {
      source: 'jellyfin',
      tracks: [],
      albums: [],
      artists: [],
      playlists: [],
      totalCount: 0,
      hasMore: false,
    };

    if (!this.jellyfinClient?.isAuthenticated()) return result;

    try {
      const data = await this.jellyfinClient.search(query, limit);

      for (const item of data.Items) {
        switch (item.Type) {
          case 'Audio': {
            if (!contentTypes.includes('track')) break;
            result.tracks.push(jellyfinBaseItemToMediaTrack(item, this.jellyfinClient));
            result.totalCount++;
            break;
          }
          case 'MusicAlbum': {
            if (!contentTypes.includes('album')) break;
            result.albums.push(jellyfinBaseItemToMediaAlbum(item, this.jellyfinClient));
            result.totalCount++;
            break;
          }
          case 'MusicArtist': {
            if (!contentTypes.includes('artist')) break;
            result.artists.push(jellyfinBaseItemToMediaArtist(item, this.jellyfinClient));
            result.totalCount++;
            break;
          }
          case 'Playlist': {
            if (!contentTypes.includes('playlist')) break;
            result.playlists.push(jellyfinBaseItemToMediaPlaylist(item, this.jellyfinClient));
            result.totalCount++;
            break;
          }
        }
      }

      result.hasMore = data.TotalRecordCount > data.StartIndex + data.Items.length;
    } catch {
      // Source unavailable
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Deduplication & relevance sorting
  // -----------------------------------------------------------------------

  private deduplicateTracks(tracks: MediaTrack[]): MediaTrack[] {
    const seen = new Map<string, MediaTrack>();

    for (const track of tracks) {
      const key = `${track.title.toLowerCase()}::${track.artist.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.set(key, track);
      }
      // Keep the first occurrence (preserves source priority order)
    }

    return Array.from(seen.values());
  }

  private sortByRelevance(tracks: MediaTrack[], query: string): MediaTrack[] {
    const q = query.toLowerCase();
    return tracks.sort((a, b) => this.relevanceScore(b, q) - this.relevanceScore(a, q));
  }

  private relevanceScore(track: MediaTrack, query: string): number {
    const title = track.title.toLowerCase();
    const artist = track.artist.toLowerCase();
    let score = 0;

    if (title === query) score += 100;
    else if (title.startsWith(query)) score += 75;
    else if (title.includes(query)) score += 50;

    if (artist === query) score += 40;
    else if (artist.startsWith(query)) score += 30;
    else if (artist.includes(query)) score += 20;

    return score;
  }

  private sortAlbumsByRelevance(albums: MediaAlbum[], query: string): MediaAlbum[] {
    const q = query.toLowerCase();
    return albums.sort((a, b) => {
      const scoreA = a.title.toLowerCase() === q ? 100 : a.title.toLowerCase().includes(q) ? 50 : 0;
      const scoreB = b.title.toLowerCase() === q ? 100 : b.title.toLowerCase().includes(q) ? 50 : 0;
      return scoreB - scoreA;
    });
  }

  private sortArtistsByRelevance(artists: MediaArtist[], query: string): MediaArtist[] {
    const q = query.toLowerCase();
    return artists.sort((a, b) => {
      const scoreA = a.name.toLowerCase() === q ? 100 : a.name.toLowerCase().includes(q) ? 50 : 0;
      const scoreB = b.name.toLowerCase() === q ? 100 : b.name.toLowerCase().includes(q) ? 50 : 0;
      return scoreB - scoreA;
    });
  }

  // -----------------------------------------------------------------------
  // Cache key
  // -----------------------------------------------------------------------

  private buildCacheKey(query: string, filters: SearchFilters): string {
    return `${query.toLowerCase()}|${filters.sources.sort().join(',')}|${filters.contentTypes.sort().join(',')}|${filters.limit ?? 20}`;
  }
}

// =========================================================================
// Internal result type
// =========================================================================

interface SourceSearchResult {
  source: 'spotify' | 'youtube' | 'jellyfin';
  tracks: MediaTrack[];
  albums: MediaAlbum[];
  artists: MediaArtist[];
  playlists: MediaPlaylist[];
  totalCount: number;
  hasMore: boolean;
}

// =========================================================================
// Mapping helpers (source types → unified types)
// =========================================================================

export function spotifyTrackToMediaTrack(track: SpotifyTrack): MediaTrack {
  return {
    id: `spotify:${track.id}`,
    sourceType: MediaSourceType.SPOTIFY,
    sourceId: track.uri,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(', '),
    album: track.album.name,
    duration: track.duration_ms,
    artwork: track.album.images?.[0]?.url ?? null,
    isPlayable: true,
    requiresAuth: true,
  };
}

export function youtubeItemToMediaTrack(item: YouTubeItem): MediaTrack {
  return {
    id: `youtube:${item.videoId}`,
    sourceType: MediaSourceType.YOUTUBE,
    sourceId: item.videoId,
    title: item.title,
    artist: item.artist,
    duration: item.duration * 1000, // seconds → ms
    artwork: item.thumbnail,
    isPlayable: true,
    requiresAuth: false,
  };
}

export function youtubeArtistToMediaArtist(artist: YouTubeMusicArtist): MediaArtist {
  return {
    id: `youtube:artist:${artist.id}`,
    sourceType: MediaSourceType.YOUTUBE,
    sourceId: artist.id,
    name: artist.name,
    artwork: artist.thumbnail,
  };
}

export function jellyfinBaseItemToMediaTrack(
  item: JellyfinBaseItem,
  client: JellyfinClient,
): MediaTrack {
  return {
    id: `jellyfin:${item.Id}`,
    sourceType: MediaSourceType.JELLYFIN,
    sourceId: item.Id,
    title: item.Name,
    artist: item.Artists?.join(', ') ?? item.AlbumArtist ?? '',
    album: item.Album,
    duration: item.RunTimeTicks ? item.RunTimeTicks / 10_000 : 0,
    artwork: item.ImageTags?.Primary
      ? client.getImageUrl(item.AlbumId ?? item.Id)
      : null,
    isPlayable: true,
    requiresAuth: true,
    genres: item.Genres,
  };
}

export function jellyfinBaseItemToMediaAlbum(
  item: JellyfinBaseItem,
  client: JellyfinClient,
): MediaAlbum {
  return {
    id: `jellyfin:album:${item.Id}`,
    sourceType: MediaSourceType.JELLYFIN,
    sourceId: item.Id,
    title: item.Name,
    artist: item.AlbumArtist ?? item.Artists?.join(', ') ?? '',
    artwork: item.ImageTags?.Primary ? client.getImageUrl(item.Id) : null,
    year: item.ProductionYear?.toString(),
    trackCount: item.ChildCount,
    genres: item.Genres,
  };
}

export function jellyfinBaseItemToMediaArtist(
  item: JellyfinBaseItem,
  client: JellyfinClient,
): MediaArtist {
  return {
    id: `jellyfin:artist:${item.Id}`,
    sourceType: MediaSourceType.JELLYFIN,
    sourceId: item.Id,
    name: item.Name,
    artwork: item.ImageTags?.Primary ? client.getImageUrl(item.Id) : null,
    genres: item.Genres,
  };
}

export function jellyfinBaseItemToMediaPlaylist(
  item: JellyfinBaseItem,
  client: JellyfinClient,
): MediaPlaylist {
  return {
    id: `jellyfin:playlist:${item.Id}`,
    sourceType: MediaSourceType.JELLYFIN,
    sourceId: item.Id,
    title: item.Name,
    description: item.Overview,
    artwork: item.ImageTags?.Primary ? client.getImageUrl(item.Id) : null,
    trackCount: item.ChildCount,
  };
}
