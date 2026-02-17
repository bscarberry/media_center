// ============================================================================
// YouTube / YouTube Music types
// ============================================================================

import type { UnifiedPlaybackState } from './spotify';

// ---------------------------------------------------------------------------
// Normalized video/track item (source-agnostic within YouTube)
// ---------------------------------------------------------------------------

export interface YouTubeItem {
  id: string;
  title: string;
  artist: string; // channel name
  duration: number; // seconds
  thumbnail: string | null;
  videoId: string;
  isMusic: boolean;
}

// ---------------------------------------------------------------------------
// YouTube Data API v3 response shapes
// ---------------------------------------------------------------------------

export interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

export interface YouTubeThumbnails {
  [key: string]: YouTubeThumbnail | undefined;
  default?: YouTubeThumbnail;
  medium?: YouTubeThumbnail;
  high?: YouTubeThumbnail;
  standard?: YouTubeThumbnail;
  maxres?: YouTubeThumbnail;
}

export interface YouTubeVideoSnippet {
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnails: YouTubeThumbnails;
  publishedAt: string;
  categoryId?: string;
}

export interface YouTubeVideoContentDetails {
  duration: string; // ISO 8601 e.g. "PT4M33S"
}

export interface YouTubeVideoResource {
  kind: string;
  etag: string;
  id: string;
  snippet: YouTubeVideoSnippet;
  contentDetails?: YouTubeVideoContentDetails;
}

export interface YouTubeSearchResultId {
  kind: string;
  videoId?: string;
  channelId?: string;
  playlistId?: string;
}

export interface YouTubeSearchResult {
  kind: string;
  etag: string;
  id: YouTubeSearchResultId;
  snippet: YouTubeVideoSnippet;
}

export interface YouTubePlaylistItemSnippet {
  title: string;
  description: string;
  channelTitle: string;
  thumbnails: YouTubeThumbnails;
  position: number;
  resourceId: {
    kind: string;
    videoId: string;
  };
}

export interface YouTubePlaylistItem {
  kind: string;
  etag: string;
  id: string;
  snippet: YouTubePlaylistItemSnippet;
  contentDetails?: { videoId: string };
}

export interface YouTubePlaylistSnippet {
  title: string;
  description: string;
  channelTitle: string;
  thumbnails: YouTubeThumbnails;
}

export interface YouTubePlaylistResource {
  kind: string;
  etag: string;
  id: string;
  snippet: YouTubePlaylistSnippet;
  contentDetails?: { itemCount: number };
}

export interface YouTubePageInfo {
  totalResults: number;
  resultsPerPage: number;
}

export interface YouTubeListResponse<T> {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: YouTubePageInfo;
  items: T[];
}

// ---------------------------------------------------------------------------
// Audio extraction (Option B)
// ---------------------------------------------------------------------------

export interface AudioStream {
  url: string;
  expiresAt: number; // epoch ms
  quality: string; // e.g. "128k", "256k"
  format: string; // e.g. "opus", "m4a"
}

// ---------------------------------------------------------------------------
// Playback mode
// ---------------------------------------------------------------------------

export type YouTubePlaybackMode = 'iframe' | 'extract';

// ---------------------------------------------------------------------------
// IFrame Player API types
// ---------------------------------------------------------------------------

/** States reported by the YouTube IFrame Player. */
export enum YTPlayerState {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

/** Minimal shape of the YT.Player constructor options. */
export interface YTPlayerOptions {
  width?: number | string;
  height?: number | string;
  videoId?: string;
  playerVars?: Record<string, unknown>;
  events?: {
    onReady?: (event: { target: YTPlayerInstance }) => void;
    onStateChange?: (event: { data: YTPlayerState; target: YTPlayerInstance }) => void;
    onError?: (event: { data: number; target: YTPlayerInstance }) => void;
  };
}

/** Minimal shape of a YT.Player instance. */
export interface YTPlayerInstance {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(volume: number): void;
  getVolume(): number;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): YTPlayerState;
  getCurrentTime(): number;
  getDuration(): number;
  getVideoData(): { video_id: string; title: string; author: string };
  loadVideoById(videoId: string, startSeconds?: number): void;
  cueVideoById(videoId: string, startSeconds?: number): void;
  destroy(): void;
}

/** Global YT namespace injected by the IFrame API script. */
declare global {
  interface Window {
    YT?: {
      Player: new (elementId: string, options: YTPlayerOptions) => YTPlayerInstance;
      PlayerState: typeof YTPlayerState;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

// ---------------------------------------------------------------------------
// Player event map
// ---------------------------------------------------------------------------

export interface YouTubePlayerEvents {
  ready: void;
  state_changed: UnifiedPlaybackState | null;
  error: { code: number; message: string };
  mode_changed: { mode: YouTubePlaybackMode };
  url_expired: { videoId: string };
}

export type YouTubePlayerEventName = keyof YouTubePlayerEvents;

// ---------------------------------------------------------------------------
// YouTube Music specific types
// ---------------------------------------------------------------------------

export interface YouTubeMusicAlbum {
  id: string;
  title: string;
  artist: string;
  thumbnail: string | null;
  year: string;
  tracks: YouTubeItem[];
}

export interface YouTubeMusicArtist {
  id: string;
  name: string;
  thumbnail: string | null;
  subscriberCount: string | null;
}

export interface YouTubeMusicPlaylist {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  trackCount: number;
}

// ---------------------------------------------------------------------------
// OAuth types for YouTube
// ---------------------------------------------------------------------------

export interface YouTubeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface YouTubePersistedTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

export interface YouTubeAuthEvents {
  auth_started: void;
  auth_success: { accessToken: string };
  auth_error: { error: string };
  auth_denied: { error: string };
}

export type YouTubeAuthEventName = keyof YouTubeAuthEvents;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface YouTubeConfig {
  apiKey: string;
  oauth?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
  playbackMode: YouTubePlaybackMode;
}
