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
