// Library components
export { AppRouter } from './AppRouter';
export type { AppRouterProps } from './AppRouter';

export { LibraryBrowser } from './LibraryBrowser';
export type { LibraryBrowserProps } from './LibraryBrowser';

export { LibraryHome } from './LibraryHome';
export type { LibraryHomeProps } from './LibraryHome';

export { UnifiedSearch } from './UnifiedSearch';
export type { UnifiedSearchProps } from './UnifiedSearch';

export {
  ContentGrid,
  GridSkeleton,
  TrackCard,
  AlbumCard,
  ArtistCard,
  PlaylistCard,
} from './ContentGrid';
export type {
  ContentGridProps,
  TrackCardProps,
  AlbumCardProps,
  ArtistCardProps,
  PlaylistCardProps,
} from './ContentGrid';

export { AlbumView } from './AlbumView';
export type { AlbumViewProps } from './AlbumView';

export { ArtistView } from './ArtistView';
export type { ArtistViewProps } from './ArtistView';

export { PlaylistView } from './PlaylistView';
export type { PlaylistViewProps } from './PlaylistView';

export {
  RecentlyPlayed,
  loadRecentlyPlayed,
  saveRecentlyPlayed,
  addToRecentlyPlayed,
  clearRecentlyPlayed,
} from './RecentlyPlayed';
export type { RecentlyPlayedProps } from './RecentlyPlayed';

export { Recommendations } from './Recommendations';
export type { RecommendationsProps } from './Recommendations';

// Shared styles and utilities
export { theme, formatDuration, sourceColors, sourceLabels, sourceBadgeStyle } from './styles';
