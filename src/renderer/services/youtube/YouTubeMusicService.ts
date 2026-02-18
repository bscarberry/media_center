// ============================================================================
// YouTubeMusicService – YouTube Music specific features
// ============================================================================
//
// YouTube Music doesn't have an official public API, so this service works
// by querying the YouTube Data API v3 with music-specific filters and
// conventions:
//
//   - Music category (videoCategoryId 10) for music-only search
//   - "Topic" channels (e.g. "Artist - Topic") for auto-generated content
//   - Known YouTube Music playlist prefixes (RDCLAK, OLAK) for albums
//   - YouTube Music browse endpoint patterns
//
// For deeper YouTube Music integration (My Mix, personalized playlists),
// this service relies on the standard YouTube Data API with OAuth access
// to the user's "YouTube Music" activity, which shares the same account.
// ============================================================================

import { YouTubeService, YouTubeApiError } from './YouTubeService';
import { YouTubeAuth } from './YouTubeAuth';
import type {
  YouTubeConfig,
  YouTubeItem,
  YouTubeMusicAlbum,
  YouTubeMusicArtist,
  YouTubeMusicPlaylist,
  YouTubeListResponse,
  YouTubeVideoResource,
  YouTubePlaylistResource,
} from '../../types/youtube';

export class YouTubeMusicService {
  private youtube: YouTubeService;
  private auth: YouTubeAuth | null;
  private config: YouTubeConfig;

  constructor(config: YouTubeConfig, auth?: YouTubeAuth) {
    this.config = config;
    this.auth = auth ?? null;
    this.youtube = new YouTubeService(config, auth);
  }

  // -----------------------------------------------------------------------
  // Music search
  // -----------------------------------------------------------------------

  /** Search specifically for music content (songs). */
  async searchSongs(query: string, maxResults = 20): Promise<YouTubeItem[]> {
    return this.youtube.search(query, 'music', maxResults);
  }

  /** Search for music videos (non-audio, actual music videos). */
  async searchMusicVideos(
    query: string,
    maxResults = 20,
  ): Promise<YouTubeItem[]> {
    return this.youtube.search(`${query} official music video`, 'music', maxResults);
  }

  // -----------------------------------------------------------------------
  // Albums
  // -----------------------------------------------------------------------

  /**
   * Get a YouTube Music "album" by playlist ID.
   *
   * YouTube Music albums are represented as playlists with IDs starting
   * with `OLAK5uy_` (album playlists). Regular playlists also work.
   */
  async getAlbum(playlistId: string): Promise<YouTubeMusicAlbum> {
    const items = await this.youtube.getPlaylist(playlistId);

    // Infer album metadata from the first track
    const firstTrack = items[0];
    const artist = firstTrack?.artist ?? 'Unknown Artist';

    // Try to get playlist metadata for the album title
    let albumTitle = playlistId;
    try {
      const playlists = await this.fetchPlaylistMetadata(playlistId);
      if (playlists.length > 0) {
        albumTitle = playlists[0].snippet.title;
      }
    } catch {
      // Fall back to playlist ID
    }

    return {
      id: playlistId,
      title: albumTitle,
      artist,
      thumbnail: firstTrack?.thumbnail ?? null,
      year: '',
      tracks: items.map((item) => ({ ...item, isMusic: true })),
    };
  }

  // -----------------------------------------------------------------------
  // Artists
  // -----------------------------------------------------------------------

  /** Search for artist channels. */
  async searchArtists(
    query: string,
    maxResults = 10,
  ): Promise<YouTubeMusicArtist[]> {
    const url = new URL('https://www.googleapis.com/youtube/v3/search');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('q', query);
    url.searchParams.set('type', 'channel');
    url.searchParams.set('maxResults', String(maxResults));
    url.searchParams.set('key', this.config.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new YouTubeApiError(res.status, await res.text());
    }

    const data: YouTubeListResponse<{
      id: { channelId: string };
      snippet: {
        title: string;
        thumbnails: Record<string, { url: string } | undefined>;
      };
    }> = await res.json();

    return data.items.map((item) => ({
      id: item.id.channelId,
      name: item.snippet.title,
      thumbnail:
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.default?.url ??
        null,
      subscriberCount: null,
    }));
  }

  /** Get top tracks from an artist's "Topic" channel (auto-generated). */
  async getArtistTopTracks(
    artistName: string,
    maxResults = 20,
  ): Promise<YouTubeItem[]> {
    // YouTube auto-generates "<Artist> - Topic" channels with official audio
    return this.youtube.search(
      `${artistName} topic official audio`,
      'music',
      maxResults,
    );
  }

  // -----------------------------------------------------------------------
  // Personalized playlists (requires OAuth)
  // -----------------------------------------------------------------------

  /** Get the user's YouTube Music playlists. */
  async getMyPlaylists(): Promise<YouTubeMusicPlaylist[]> {
    const playlists = await this.youtube.getUserPlaylists();
    return playlists.map((p) => ({
      id: p.id,
      title: p.snippet.title,
      description: p.snippet.description,
      thumbnail:
        p.snippet.thumbnails.high?.url ??
        p.snippet.thumbnails.default?.url ??
        null,
      trackCount: p.contentDetails?.itemCount ?? 0,
    }));
  }

  /** Get liked music videos. */
  async getLikedMusic(maxResults = 50): Promise<YouTubeItem[]> {
    const items = await this.youtube.getLikedVideos(maxResults);
    return items.map((item) => ({ ...item, isMusic: true }));
  }

  /**
   * Get music recommendations based on a video ID.
   * Uses search with the original track title as a workaround since
   * the relatedToVideoId API parameter was deprecated.
   */
  async getRecommendations(
    videoId: string,
    maxResults = 15,
  ): Promise<YouTubeItem[]> {
    const video = await this.youtube.getVideo(videoId);
    if (!video) return [];

    const results = await this.youtube.search(
      `${video.artist} ${video.title}`,
      'music',
      maxResults + 1,
    );

    // Exclude the seed track itself
    return results.filter((r) => r.videoId !== videoId).slice(0, maxResults);
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private async fetchPlaylistMetadata(
    playlistId: string,
  ): Promise<YouTubePlaylistResource[]> {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlists');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('id', playlistId);
    url.searchParams.set('key', this.config.apiKey);

    const res = await fetch(url.toString());
    if (!res.ok) return [];

    const data: YouTubeListResponse<YouTubePlaylistResource> = await res.json();
    return data.items;
  }
}
