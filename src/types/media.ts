// ============================================================================
// Unified media routing types
// ============================================================================

// ---------------------------------------------------------------------------
// Source identification
// ---------------------------------------------------------------------------

export enum MediaSourceType {
  SPOTIFY = 'spotify',
  YOUTUBE = 'youtube',
  JELLYFIN = 'jellyfin',
}

// ---------------------------------------------------------------------------
// Unified track (richer than the per-source UnifiedTrack)
// ---------------------------------------------------------------------------

export interface MediaTrack {
  /** Globally unique within the router (e.g. "spotify:4iV5W9uYEdYUVa79Axb7Rh") */
  id: string;
  sourceType: MediaSourceType;
  /** Source-native identifier: Spotify URI, YouTube video ID, Jellyfin item ID */
  sourceId: string;
  title: string;
  artist: string;
  album?: string;
  duration: number; // ms
  artwork: string | null;
  isPlayable: boolean;
  requiresAuth: boolean;
  releaseDate?: string;
  genres?: string[];
  explicit?: boolean;
}

// ---------------------------------------------------------------------------
// Playback state (richer than the per-source UnifiedPlaybackState)
// ---------------------------------------------------------------------------

export interface PlaybackState {
  track: MediaTrack | null;
  isPlaying: boolean;
  buffering: boolean;
  position: number; // ms
  duration: number; // ms
  volume: number; // 0-1
  canSkipNext: boolean;
  canSkipPrevious: boolean;
  canSeek: boolean;
  error?: string;
}

export const EMPTY_PLAYBACK_STATE: PlaybackState = {
  track: null,
  isPlaying: false,
  buffering: false,
  position: 0,
  duration: 0,
  volume: 1,
  canSkipNext: false,
  canSkipPrevious: false,
  canSeek: false,
};

// ---------------------------------------------------------------------------
// Player strategy event map
// ---------------------------------------------------------------------------

export interface MediaPlayerEvents {
  state_changed: PlaybackState;
  track_ended: void;
  error: { message: string; recoverable: boolean };
  ready: void;
  auth_required: { sourceType: MediaSourceType };
}

export type MediaPlayerEventName = keyof MediaPlayerEvents;

// ---------------------------------------------------------------------------
// Router event map
// ---------------------------------------------------------------------------

export interface MediaRouterEvents {
  state_changed: PlaybackState;
  track_changed: MediaTrack | null;
  queue_changed: { queue: MediaTrack[]; currentIndex: number };
  source_switched: { from: MediaSourceType | null; to: MediaSourceType };
  crossfade_start: { outgoing: MediaTrack; incoming: MediaTrack };
  error: { message: string; sourceType?: MediaSourceType };
}

export type MediaRouterEventName = keyof MediaRouterEvents;

// ---------------------------------------------------------------------------
// Repeat mode
// ---------------------------------------------------------------------------

export type RepeatMode = 'off' | 'one' | 'all';

// ---------------------------------------------------------------------------
// Router configuration
// ---------------------------------------------------------------------------

export interface MediaRouterConfig {
  /** Crossfade duration in seconds (0 = disabled, max 12) */
  crossfadeDuration: number;
  /** How many seconds before track end to preload the next track */
  preloadAheadSeconds: number;
  /** Maximum retry attempts for failed playback */
  maxRetries: number;
  /** Base delay (ms) for exponential backoff retries */
  retryBaseDelay: number;
  /** Keep disposed players warm for this many ms before truly disposing */
  playerWarmTimeout: number;
}

export const DEFAULT_ROUTER_CONFIG: MediaRouterConfig = {
  crossfadeDuration: 0,
  preloadAheadSeconds: 10,
  maxRetries: 3,
  retryBaseDelay: 1000,
  playerWarmTimeout: 30_000,
};
