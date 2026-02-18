// ============================================================================
// YouTubeService – YouTube Data API v3 wrapper
// ============================================================================
//
// Uses API key for public data and OAuth (via YouTubeAuth) for personal data
// like liked videos and private playlists. Includes quota-aware caching.
// ============================================================================

import { YouTubeAuth } from './YouTubeAuth';
import type {
  YouTubeConfig,
  YouTubeItem,
  YouTubeVideoResource,
  YouTubeSearchResult,
  YouTubePlaylistItem,
  YouTubePlaylistResource,
  YouTubeListResponse,
} from '../../types/youtube';

const BASE = 'https://www.googleapis.com/youtube/v3';

// Quota costs (YouTube allocates 10,000 units/day):
//   search.list  = 100 units
//   videos.list  = 1 unit
//   playlists.list = 1 unit
//   playlistItems.list = 1 unit

/** Simple in-memory TTL cache to reduce redundant API calls. */
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60_000; // 5 min

export class YouTubeService {
  private config: YouTubeConfig;
  private auth: YouTubeAuth | null;
  private cache = new Map<string, CacheEntry<unknown>>();

  constructor(config: YouTubeConfig, auth?: YouTubeAuth) {
    this.config = config;
    this.auth = auth ?? null;
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  /**
   * Search YouTube. `type` can be `'video'` for general videos or `'music'`
   * to filter to the music category (categoryId 10).
   */
  async search(
    query: string,
    type: 'video' | 'music' = 'video',
    maxResults = 20,
  ): Promise<YouTubeItem[]> {
    const params: Record<string, string> = {
      part: 'snippet',
      q: query,
      type: 'video',
      maxResults: String(maxResults),
    };

    if (type === 'music') {
      params.videoCategoryId = '10'; // Music category
    }

    const searchRes =
      await this.get<YouTubeListResponse<YouTubeSearchResult>>(
        '/search',
        params,
      );

    if (searchRes.items.length === 0) return [];

    // search.list doesn't return duration — fetch via videos.list
    const videoIds = searchRes.items
      .map((r) => r.id.videoId)
      .filter((id): id is string => !!id);

    const videosRes = await this.getVideoDetails(videoIds);
    const detailMap = new Map(videosRes.map((v) => [v.id, v]));

    return searchRes.items
      .filter((r) => r.id.videoId)
      .map((r) => {
        const detail = detailMap.get(r.id.videoId!);
        return YouTubeService.toItem(r.snippet, r.id.videoId!, detail, type === 'music');
      });
  }

  // -----------------------------------------------------------------------
  // Videos
  // -----------------------------------------------------------------------

  /** Get full details for a single video. */
  async getVideo(videoId: string): Promise<YouTubeItem | null> {
    const res = await this.get<YouTubeListResponse<YouTubeVideoResource>>(
      '/videos',
      { part: 'snippet,contentDetails', id: videoId },
    );
    if (res.items.length === 0) return null;
    const v = res.items[0];
    return YouTubeService.toItem(v.snippet, v.id, v, false);
  }

  /** Batch-fetch video details (snippet + contentDetails). */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideoResource[]> {
    if (videoIds.length === 0) return [];

    // YouTube allows up to 50 IDs per request
    const chunks: string[][] = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50));
    }

    const results: YouTubeVideoResource[] = [];
    for (const chunk of chunks) {
      const res = await this.get<YouTubeListResponse<YouTubeVideoResource>>(
        '/videos',
        { part: 'snippet,contentDetails', id: chunk.join(',') },
      );
      results.push(...res.items);
    }
    return results;
  }

  // -----------------------------------------------------------------------
  // Playlists
  // -----------------------------------------------------------------------

  /** Fetch the authenticated user's playlists (requires OAuth). */
  async getUserPlaylists(maxResults = 50): Promise<YouTubePlaylistResource[]> {
    const res = await this.get<YouTubeListResponse<YouTubePlaylistResource>>(
      '/playlists',
      { part: 'snippet,contentDetails', mine: 'true', maxResults: String(maxResults) },
      true, // requires OAuth
    );
    return res.items;
  }

  /** Get videos in a playlist. */
  async getPlaylist(
    playlistId: string,
    maxResults = 50,
  ): Promise<YouTubeItem[]> {
    const res = await this.get<YouTubeListResponse<YouTubePlaylistItem>>(
      '/playlistItems',
      {
        part: 'snippet,contentDetails',
        playlistId,
        maxResults: String(maxResults),
      },
    );

    const videoIds = res.items
      .map((item) => item.contentDetails?.videoId ?? item.snippet.resourceId.videoId)
      .filter(Boolean);

    const details = await this.getVideoDetails(videoIds);
    const detailMap = new Map(details.map((v) => [v.id, v]));

    return res.items.map((item) => {
      const vid =
        item.contentDetails?.videoId ?? item.snippet.resourceId.videoId;
      const detail = detailMap.get(vid);
      return YouTubeService.toItem(item.snippet, vid, detail, false);
    });
  }

  // -----------------------------------------------------------------------
  // Related / Recommendations
  // -----------------------------------------------------------------------

  /** Get related videos for a given video ID. */
  async getRecommendations(
    videoId: string,
    maxResults = 15,
  ): Promise<YouTubeItem[]> {
    // The relatedToVideoId parameter was removed from v3 in Aug 2023.
    // Workaround: fetch the video title and search for similar content.
    const video = await this.getVideo(videoId);
    if (!video) return [];

    return this.search(video.title, 'video', maxResults);
  }

  // -----------------------------------------------------------------------
  // Library (requires OAuth)
  // -----------------------------------------------------------------------

  /** Get the user's liked videos (requires OAuth). */
  async getLikedVideos(maxResults = 50): Promise<YouTubeItem[]> {
    // "Liked videos" is a special playlist with id "LL"
    return this.getPlaylist('LL', maxResults);
  }

  // -----------------------------------------------------------------------
  // Internal HTTP
  // -----------------------------------------------------------------------

  private async get<T>(
    path: string,
    params: Record<string, string>,
    requiresOAuth = false,
  ): Promise<T> {
    const cacheKey = `${path}?${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data as T;
    }

    const url = new URL(`${BASE}${path}`);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const headers: Record<string, string> = {};

    if (requiresOAuth || params.mine) {
      if (!this.auth) {
        throw new Error('YouTube OAuth required but not configured.');
      }
      const token = await this.auth.getAccessToken();
      headers['Authorization'] = `Bearer ${token}`;
    } else {
      url.searchParams.set('key', this.config.apiKey);
    }

    const res = await fetch(url.toString(), { headers });

    if (res.status === 401 && this.auth) {
      // Token expired — refresh and retry once
      const freshToken = await this.auth.refresh();
      headers['Authorization'] = `Bearer ${freshToken}`;
      const retry = await fetch(url.toString(), { headers });
      if (!retry.ok) {
        throw new YouTubeApiError(retry.status, await retry.text());
      }
      const data = (await retry.json()) as T;
      this.cache.set(cacheKey, { data, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS });
      return data;
    }

    if (res.status === 403) {
      const body = await res.text();
      if (body.includes('quotaExceeded')) {
        throw new YouTubeApiError(
          403,
          'YouTube API daily quota exceeded (10,000 units). Try again tomorrow.',
        );
      }
      throw new YouTubeApiError(403, body);
    }

    if (!res.ok) {
      throw new YouTubeApiError(res.status, await res.text());
    }

    const data = (await res.json()) as T;
    this.cache.set(cacheKey, { data, expiresAt: Date.now() + DEFAULT_CACHE_TTL_MS });
    return data;
  }

  // -----------------------------------------------------------------------
  // Normalization
  // -----------------------------------------------------------------------

  /** Convert API shapes into our normalized YouTubeItem. */
  static toItem(
    snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string } | undefined> },
    videoId: string,
    videoResource?: { contentDetails?: { duration: string } } | null,
    isMusic = false,
  ): YouTubeItem {
    const thumb =
      snippet.thumbnails.high?.url ??
      snippet.thumbnails.medium?.url ??
      snippet.thumbnails.default?.url ??
      null;

    return {
      id: videoId,
      title: snippet.title,
      artist: snippet.channelTitle,
      duration: videoResource?.contentDetails
        ? YouTubeService.parseDuration(videoResource.contentDetails.duration)
        : 0,
      thumbnail: thumb,
      videoId,
      isMusic,
    };
  }

  /** Parse ISO 8601 duration (e.g. "PT4M33S") to seconds. */
  static parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class YouTubeApiError extends Error {
  public readonly status: number;

  constructor(status: number, body: string) {
    super(`YouTube API error ${status}: ${body}`);
    this.name = 'YouTubeApiError';
    this.status = status;
  }
}
