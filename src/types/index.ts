export type {
  // Playback
  SpotifyPlayerInit,
  UnifiedTrack,
  UnifiedPlaybackState,
  // REST API responses
  SpotifyImage,
  SpotifyArtistBrief,
  SpotifyAlbumBrief,
  SpotifyTrack,
  SpotifyPlaylistTrackItem,
  SpotifyPlaylist,
  SpotifyAlbum,
  SpotifySearchResults,
  SpotifyPaginated,
  SpotifyRecommendations,
  // Player events
  SpotifyPlayerEvents,
  SpotifyPlayerEventName,
  SpotifySearchType,
  // OAuth / Auth
  SpotifyTokenResponse,
  PersistedTokenData,
  TokenManagerEvents,
  TokenManagerEventName,
  SpotifyAuthEvents,
  SpotifyAuthEventName,
  SpotifyConfig,
} from './spotify';

export type {
  // YouTube core
  YouTubeItem,
  YouTubePlaybackMode,
  AudioStream,
  // YouTube Data API
  YouTubeThumbnail,
  YouTubeThumbnails,
  YouTubeVideoSnippet,
  YouTubeVideoContentDetails,
  YouTubeVideoResource,
  YouTubeSearchResult,
  YouTubePlaylistItem,
  YouTubePlaylistResource,
  YouTubeListResponse,
  YouTubePageInfo,
  // YouTube IFrame Player
  YTPlayerOptions,
  YTPlayerInstance,
  YouTubePlayerEvents,
  YouTubePlayerEventName,
  // YouTube Music
  YouTubeMusicAlbum,
  YouTubeMusicArtist,
  YouTubeMusicPlaylist,
  // YouTube Auth
  YouTubeTokenResponse,
  YouTubePersistedTokenData,
  YouTubeAuthEvents,
  YouTubeAuthEventName,
  YouTubeConfig,
} from './youtube';

export { YTPlayerState } from './youtube';

export type {
  // Jellyfin core
  JellyfinItem,
  JellyfinAuthResult,
  JellyfinUser,
  JellyfinImageTags,
  JellyfinMediaStream,
  JellyfinMediaSource,
  JellyfinBaseItem,
  JellyfinUserData,
  JellyfinItemType,
  JellyfinQueryResult,
  // Streaming / transcoding
  TranscodeQuality,
  TranscodeOptions,
  // Player events
  JellyfinPlayerEvents,
  JellyfinPlayerEventName,
  // Download / cache
  CachedTrack,
  CacheStats,
  // Configuration
  JellyfinConfig,
} from './jellyfin';

export { QUALITY_PRESETS } from './jellyfin';

export {
  MediaSourceType,
  EMPTY_PLAYBACK_STATE,
  DEFAULT_ROUTER_CONFIG,
} from './media';

export type {
  MediaTrack,
  PlaybackState,
  MediaPlayerEvents,
  MediaPlayerEventName,
  MediaRouterEvents,
  MediaRouterEventName,
  RepeatMode,
  MediaRouterConfig,
} from './media';

export {
  DEFAULT_SEARCH_FILTERS,
  EMPTY_SEARCH_RESULTS,
} from './library';

export type {
  ContentType,
  MediaAlbum,
  MediaArtist,
  MediaPlaylist,
  SearchFilters,
  SearchResults,
  LibrarySection,
  SourceToggleState,
  PaginatedResult,
  RecentlyPlayedEntry,
  RecommendationGroup,
} from './library';
