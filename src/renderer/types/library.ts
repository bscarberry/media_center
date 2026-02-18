// ============================================================================
// Library & search types – unified media browsing across all sources
// ============================================================================

import { MediaSourceType, type MediaTrack } from './media';

// ---------------------------------------------------------------------------
// Content type filter
// ---------------------------------------------------------------------------

export type ContentType = 'track' | 'album' | 'artist' | 'playlist';

// ---------------------------------------------------------------------------
// Unified library entities
// ---------------------------------------------------------------------------

export interface MediaAlbum {
  id: string;
  sourceType: MediaSourceType;
  sourceId: string;
  title: string;
  artist: string;
  artwork: string | null;
  year?: string;
  trackCount?: number;
  totalDuration?: number; // ms
  genres?: string[];
}

export interface MediaArtist {
  id: string;
  sourceType: MediaSourceType;
  sourceId: string;
  name: string;
  artwork: string | null;
  followers?: number;
  genres?: string[];
}

export interface MediaPlaylist {
  id: string;
  sourceType: MediaSourceType;
  sourceId: string;
  title: string;
  description?: string;
  artwork: string | null;
  trackCount?: number;
  owner?: string;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export interface SearchFilters {
  sources: MediaSourceType[];
  contentTypes: ContentType[];
  limit?: number;
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  sources: [MediaSourceType.SPOTIFY, MediaSourceType.YOUTUBE, MediaSourceType.JELLYFIN],
  contentTypes: ['track', 'album', 'artist', 'playlist'],
  limit: 20,
};

export interface SearchResults {
  tracks: MediaTrack[];
  albums: MediaAlbum[];
  artists: MediaArtist[];
  playlists: MediaPlaylist[];
  sourceBreakdown: {
    spotify: number;
    youtube: number;
    jellyfin: number;
  };
  query: string;
  hasMore: boolean;
}

export const EMPTY_SEARCH_RESULTS: SearchResults = {
  tracks: [],
  albums: [],
  artists: [],
  playlists: [],
  sourceBreakdown: { spotify: 0, youtube: 0, jellyfin: 0 },
  query: '',
  hasMore: false,
};

// ---------------------------------------------------------------------------
// Library navigation
// ---------------------------------------------------------------------------

export type LibrarySection =
  | 'liked-songs'
  | 'recently-played'
  | 'playlists'
  | 'albums'
  | 'artists'
  | 'discover'
  | 'trending'
  | 'genres'
  | 'new-releases'
  | 'jellyfin-library'
  | 'jellyfin-recent'
  | 'jellyfin-artists'
  | 'jellyfin-albums'
  | 'jellyfin-genres';

export interface SourceToggleState {
  spotify: boolean;
  youtube: boolean;
  jellyfin: boolean;
}

// ---------------------------------------------------------------------------
// Pagination helpers
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextOffset?: number;
  nextPageToken?: string;
}

// ---------------------------------------------------------------------------
// Recently played
// ---------------------------------------------------------------------------

export interface RecentlyPlayedEntry {
  track: MediaTrack;
  playedAt: number; // epoch ms
}

// ---------------------------------------------------------------------------
// Recommendation group
// ---------------------------------------------------------------------------

export interface RecommendationGroup {
  id: string;
  title: string;
  description?: string;
  sourceType: MediaSourceType;
  tracks: MediaTrack[];
}
