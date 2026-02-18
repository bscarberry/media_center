// ============================================================================
// SpotifyAPI – REST API wrapper for metadata, search, and browsing
// ============================================================================

import { TokenManager } from './TokenManager';
import type {
  SpotifyPlaylist,
  SpotifyAlbum,
  SpotifyTrack,
  SpotifySearchResults,
  SpotifyPaginated,
  SpotifyPlaylistTrackItem,
  SpotifyRecommendations,
  SpotifySearchType,
} from '../../types/spotify';

const BASE = 'https://api.spotify.com/v1';

export class SpotifyAPI {
  private tokenManager: TokenManager;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  // -------------------------------------------------------------------------
  // Playlists
  // -------------------------------------------------------------------------

  /** Fetch the authenticated user's playlists (paginated). */
  async getUserPlaylists(
    limit = 50,
    offset = 0,
  ): Promise<SpotifyPaginated<SpotifyPlaylist>> {
    return this.get<SpotifyPaginated<SpotifyPlaylist>>(
      `/me/playlists?limit=${limit}&offset=${offset}`,
    );
  }

  /** Fetch a single playlist including its tracks. */
  async getPlaylist(id: string): Promise<SpotifyPlaylist> {
    return this.get<SpotifyPlaylist>(`/playlists/${encodeURIComponent(id)}`);
  }

  /** Fetch all tracks for a playlist (handles pagination internally). */
  async getPlaylistTracks(
    id: string,
    limit = 100,
    offset = 0,
  ): Promise<SpotifyPaginated<SpotifyPlaylistTrackItem>> {
    return this.get<SpotifyPaginated<SpotifyPlaylistTrackItem>>(
      `/playlists/${encodeURIComponent(id)}/tracks?limit=${limit}&offset=${offset}`,
    );
  }

  // -------------------------------------------------------------------------
  // Albums
  // -------------------------------------------------------------------------

  /** Fetch album details including tracks. */
  async getAlbum(id: string): Promise<SpotifyAlbum> {
    return this.get<SpotifyAlbum>(`/albums/${encodeURIComponent(id)}`);
  }

  // -------------------------------------------------------------------------
  // Search
  // -------------------------------------------------------------------------

  /** Search Spotify across one or more types. */
  async search(
    query: string,
    types: SpotifySearchType | SpotifySearchType[] = 'track',
    limit = 20,
  ): Promise<SpotifySearchResults> {
    const typeStr = Array.isArray(types) ? types.join(',') : types;
    return this.get<SpotifySearchResults>(
      `/search?q=${encodeURIComponent(query)}&type=${typeStr}&limit=${limit}`,
    );
  }

  // -------------------------------------------------------------------------
  // Library
  // -------------------------------------------------------------------------

  /** Fetch the user's "Liked Songs". */
  async getUserSavedTracks(
    limit = 50,
    offset = 0,
  ): Promise<SpotifyPaginated<{ track: SpotifyTrack; added_at: string }>> {
    return this.get(
      `/me/tracks?limit=${limit}&offset=${offset}`,
    );
  }

  // -------------------------------------------------------------------------
  // Recommendations
  // -------------------------------------------------------------------------

  /** Get recommended tracks based on seed track IDs (max 5). */
  async getRecommendations(
    seedTracks: string[],
    limit = 20,
  ): Promise<SpotifyRecommendations> {
    const seeds = seedTracks.slice(0, 5).join(',');
    return this.get<SpotifyRecommendations>(
      `/recommendations?seed_tracks=${encodeURIComponent(seeds)}&limit=${limit}`,
    );
  }

  // -------------------------------------------------------------------------
  // Internal HTTP helpers
  // -------------------------------------------------------------------------

  private async get<T>(path: string): Promise<T> {
    const token = await this.tokenManager.getAccessToken();
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Token may have expired between the check and the request – refresh
      // and retry once.
      const freshToken = await this.tokenManager.refresh();
      const retry = await fetch(`${BASE}${path}`, {
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      if (!retry.ok) {
        throw new SpotifyApiError(retry.status, await retry.text());
      }
      return retry.json() as Promise<T>;
    }

    if (!res.ok) {
      throw new SpotifyApiError(res.status, await res.text());
    }

    return res.json() as Promise<T>;
  }
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class SpotifyApiError extends Error {
  public readonly status: number;

  constructor(status: number, body: string) {
    super(`Spotify API error ${status}: ${body}`);
    this.name = 'SpotifyApiError';
    this.status = status;
  }
}
