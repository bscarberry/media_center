// ============================================================================
// Jellyfin API types and normalized media item interfaces
// ============================================================================

import type { UnifiedPlaybackState } from './spotify';

// ---------------------------------------------------------------------------
// Normalized media item (source-agnostic within Jellyfin)
// ---------------------------------------------------------------------------

export interface JellyfinItem {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // ms
  artwork: string | null;
  year: number | null;
  genre: string[];
  bitrate: number | null; // kbps
  codec: string | null;
}

// ---------------------------------------------------------------------------
// Jellyfin API response types
// ---------------------------------------------------------------------------

export interface JellyfinAuthResult {
  User: JellyfinUser;
  AccessToken: string;
  ServerId: string;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId: string;
  HasPassword: boolean;
}

export interface JellyfinImageTags {
  Primary?: string;
  Art?: string;
  Banner?: string;
  Logo?: string;
  Thumb?: string;
  Backdrop?: string;
}

export interface JellyfinMediaStream {
  Codec: string;
  Type: 'Audio' | 'Video' | 'Subtitle';
  BitRate?: number;
  Channels?: number;
  SampleRate?: number;
  BitDepth?: number;
  IsDefault: boolean;
}

export interface JellyfinMediaSource {
  Id: string;
  Name: string;
  Path: string;
  Container: string;
  Size: number;
  Bitrate?: number;
  MediaStreams: JellyfinMediaStream[];
  SupportsDirectPlay: boolean;
  SupportsDirectStream: boolean;
  SupportsTranscoding: boolean;
}

export interface JellyfinBaseItem {
  Id: string;
  Name: string;
  ServerId: string;
  Type: JellyfinItemType;
  CollectionType?: string;
  SortName?: string;
  Overview?: string;
  RunTimeTicks?: number; // 1 tick = 100 nanoseconds (10,000 ticks = 1 ms)
  ProductionYear?: number;
  Genres?: string[];
  ImageTags?: JellyfinImageTags;
  BackdropImageTags?: string[];
  ParentId?: string;
  AlbumId?: string;
  AlbumArtist?: string;
  AlbumArtists?: Array<{ Id: string; Name: string }>;
  Artists?: string[];
  ArtistItems?: Array<{ Id: string; Name: string }>;
  Album?: string;
  IndexNumber?: number; // track number
  DiscNumber?: number;
  MediaSources?: JellyfinMediaSource[];
  UserData?: JellyfinUserData;
  ChildCount?: number;
}

export interface JellyfinUserData {
  PlaybackPositionTicks: number;
  PlayCount: number;
  IsFavorite: boolean;
  Played: boolean;
  LastPlayedDate?: string;
}

export type JellyfinItemType =
  | 'Audio'
  | 'MusicAlbum'
  | 'MusicArtist'
  | 'MusicGenre'
  | 'Playlist'
  | 'CollectionFolder'
  | 'Folder'
  | 'MusicVideo'
  | 'Video';

export interface JellyfinQueryResult {
  Items: JellyfinBaseItem[];
  TotalRecordCount: number;
  StartIndex: number;
}

// ---------------------------------------------------------------------------
// Streaming / transcoding
// ---------------------------------------------------------------------------

export type TranscodeQuality = 'original' | 'high' | 'medium' | 'low';

export interface TranscodeOptions {
  maxBitrate?: number; // kbps
  audioCodec?: 'aac' | 'mp3' | 'opus' | 'flac';
  container?: 'mp3' | 'aac' | 'ogg' | 'flac' | 'ts';
}

export const QUALITY_PRESETS: Record<TranscodeQuality, TranscodeOptions | null> = {
  original: null, // direct play
  high: { maxBitrate: 320, audioCodec: 'aac', container: 'aac' },
  medium: { maxBitrate: 192, audioCodec: 'mp3', container: 'mp3' },
  low: { maxBitrate: 128, audioCodec: 'mp3', container: 'mp3' },
};

// ---------------------------------------------------------------------------
// Player event map
// ---------------------------------------------------------------------------

export interface JellyfinPlayerEvents {
  ready: void;
  state_changed: UnifiedPlaybackState | null;
  track_ended: void;
  error: { message: string };
  auth_success: { userId: string; serverName: string };
  auth_error: { message: string };
  connection_lost: void;
  connection_restored: void;
}

export type JellyfinPlayerEventName = keyof JellyfinPlayerEvents;

// ---------------------------------------------------------------------------
// Download / cache
// ---------------------------------------------------------------------------

export interface CachedTrack {
  itemId: string;
  filePath: string;
  fileSize: number; // bytes
  cachedAt: number; // epoch ms
  title: string;
  artist: string;
}

export interface CacheStats {
  totalSize: number; // bytes
  trackCount: number;
  maxSize: number; // bytes
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface JellyfinConfig {
  serverUrl: string;
  username?: string;
  password?: string;
  apiKey?: string;
  transcodeQuality: TranscodeQuality;
  enableTranscoding: boolean;
  cacheDirectory: string;
  maxCacheSize: number; // bytes
}
