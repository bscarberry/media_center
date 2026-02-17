// ============================================================================
// Spotify Web Playback SDK type augmentations and unified playback types
// ============================================================================

// Re-export SDK types from @types/spotify-web-playback-sdk for convenience.
// The ambient Spotify namespace is globally available once that package is
// installed, but we declare the bits we rely on explicitly so the code
// compiles even before `npm install` is run.

/** Minimal shape of the global Spotify.Player constructor options. */
export interface SpotifyPlayerInit {
  name: string;
  getOAuthToken: (cb: (token: string) => void) => void;
  volume?: number;
}

// ---------------------------------------------------------------------------
// Unified playback state (source-agnostic)
// ---------------------------------------------------------------------------

export interface UnifiedTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  artwork: string | null;
  uri: string;
}

export interface UnifiedPlaybackState {
  isPlaying: boolean;
  position: number;
  duration: number;
  track: UnifiedTrack;
  canSkipNext: boolean;
  canSkipPrevious: boolean;
  canSeek: boolean;
}

// ---------------------------------------------------------------------------
// Spotify REST API response types
// ---------------------------------------------------------------------------

export interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

export interface SpotifyArtistBrief {
  id: string;
  name: string;
  uri: string;
}

export interface SpotifyAlbumBrief {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: SpotifyArtistBrief[];
  album: SpotifyAlbumBrief;
}

export interface SpotifyPlaylistTrackItem {
  track: SpotifyTrack;
  added_at: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string | null;
  uri: string;
  images: SpotifyImage[];
  tracks: {
    total: number;
    items?: SpotifyPlaylistTrackItem[];
  };
  owner: { id: string; display_name: string | null };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[];
  artists: SpotifyArtistBrief[];
  tracks: {
    total: number;
    items: Omit<SpotifyTrack, 'album'>[];
  };
  release_date: string;
  total_tracks: number;
}

export interface SpotifySearchResults {
  tracks?: { items: SpotifyTrack[] };
  albums?: { items: SpotifyAlbumBrief[] };
  artists?: { items: SpotifyArtistBrief[] };
}

export interface SpotifyPaginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  next: string | null;
  previous: string | null;
}

export interface SpotifyRecommendations {
  tracks: SpotifyTrack[];
  seeds: Array<{ id: string; type: string }>;
}

// ---------------------------------------------------------------------------
// Service event map
// ---------------------------------------------------------------------------

export interface SpotifyPlayerEvents {
  ready: { device_id: string };
  not_ready: { device_id: string };
  player_state_changed: UnifiedPlaybackState | null;
  initialization_error: { message: string };
  authentication_error: { message: string };
  playback_error: { message: string };
  account_error: { message: string };
}

export type SpotifyPlayerEventName = keyof SpotifyPlayerEvents;

// ---------------------------------------------------------------------------
// Search type parameter
// ---------------------------------------------------------------------------

export type SpotifySearchType = 'track' | 'album' | 'artist';

// ---------------------------------------------------------------------------
// OAuth2 / PKCE types
// ---------------------------------------------------------------------------

/** Tokens as returned by the Spotify /api/token endpoint. */
export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/** Shape persisted by TokenManager in electron-store. */
export interface PersistedTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

/** Events emitted by TokenManager. */
export interface TokenManagerEvents {
  token_refreshed: { accessToken: string; expiresAt: number };
  token_refresh_failed: { error: string };
  tokens_cleared: void;
}

export type TokenManagerEventName = keyof TokenManagerEvents;

/** Events emitted by SpotifyAuth. */
export interface SpotifyAuthEvents {
  auth_started: void;
  auth_success: { accessToken: string };
  auth_error: { error: string };
  auth_denied: { error: string };
}

export type SpotifyAuthEventName = keyof SpotifyAuthEvents;

/** Application-level Spotify configuration. */
export interface SpotifyConfig {
  clientId: string;
  redirectUri: string;
}
