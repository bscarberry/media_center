// ============================================================================
// ContentGrid – responsive grid with TrackCard, AlbumCard, ArtistCard,
// PlaylistCard, lazy loading, skeleton states, and context menus
// ============================================================================

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type CSSProperties,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { MediaSourceType, type MediaTrack } from '../../types/media';
import type { MediaAlbum, MediaArtist, MediaPlaylist } from '../../types/library';
import {
  theme,
  cardBase,
  truncate,
  formatDuration,
  sourceBadgeStyle,
  sourceLabels,
} from './styles';

// ---------------------------------------------------------------------------
// ContextMenu
// ---------------------------------------------------------------------------

interface ContextMenuOption {
  label: string;
  action: () => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  options: ContextMenuOption[];
}

function ContextMenu({ x, y, options, onClose }: ContextMenuState & { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: y,
        left: x,
        zIndex: 9999,
        backgroundColor: theme.bgElevated,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius,
        padding: 4,
        minWidth: 180,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
      }}
    >
      {options.map((opt, i) => (
        <button
          key={i}
          onClick={() => { opt.action(); onClose(); }}
          style={{
            display: 'block',
            width: '100%',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            color: theme.text,
            fontSize: 13,
            textAlign: 'left',
            cursor: 'pointer',
            borderRadius: theme.radiusSmall,
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = theme.bgHover; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function CardSkeleton({ square }: { square?: boolean }) {
  return (
    <div style={{ ...cardBase, padding: 12 }}>
      <div style={{
        width: '100%',
        paddingBottom: square ? '100%' : '60%',
        backgroundColor: theme.bgHover,
        borderRadius: theme.radius,
      }} />
      <div style={{ marginTop: 10 }}>
        <div style={{ height: 14, width: '70%', backgroundColor: theme.bgHover, borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 12, width: '50%', backgroundColor: theme.bgHover, borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div style={gridStyle}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} square />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LazyImage – loads with Intersection Observer
// ---------------------------------------------------------------------------

function LazyImage({ src, alt, style }: { src: string | null; alt: string; style?: CSSProperties }) {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } },
      { rootMargin: '200px' },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      {!loaded && (
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: theme.bgHover,
          borderRadius: theme.radius,
        }} />
      )}
      {inView && src && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: theme.radius,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrackCard – compact horizontal layout
// ---------------------------------------------------------------------------

export interface TrackCardProps {
  track: MediaTrack;
  index?: number;
  onPlay?: (track: MediaTrack) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}

export function TrackCard({ track, index, onPlay, onAddToQueue }: TrackCardProps) {
  const [hovered, setHovered] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const navigate = useNavigate();

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const options: ContextMenuOption[] = [
      { label: 'Play now', action: () => onPlay?.(track) },
      { label: 'Add to queue', action: () => onAddToQueue?.(track) },
    ];
    if (track.album) {
      options.push({
        label: `Go to album`,
        action: () => navigate(`/library/albums/${track.sourceType}:${encodeURIComponent(track.sourceId)}`),
      });
    }
    setCtxMenu({ x: e.clientX, y: e.clientY, options });
  }, [track, onPlay, onAddToQueue, navigate]);

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={handleContextMenu}
        onClick={() => onPlay?.(track)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 12px',
          borderRadius: theme.radiusSmall,
          backgroundColor: hovered ? theme.bgHover : 'transparent',
          cursor: 'pointer',
          transition: theme.transition,
        }}
      >
        {index !== undefined && (
          <span style={{ width: 24, textAlign: 'right', color: theme.textMuted, fontSize: 14 }}>
            {hovered ? '\u25B6' : index + 1}
          </span>
        )}

        <LazyImage
          src={track.artwork}
          alt={track.title}
          style={{ width: 40, height: 40, flexShrink: 0, borderRadius: theme.radiusSmall }}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ ...truncate, fontSize: 14, color: theme.text, fontWeight: 500 }}>
            {track.title}
          </div>
          <div style={{ ...truncate, fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            {track.artist}
          </div>
        </div>

        <span style={sourceBadgeStyle(track.sourceType)}>
          {sourceLabels[track.sourceType]}
        </span>

        <span style={{ color: theme.textMuted, fontSize: 13, minWidth: 40, textAlign: 'right' }}>
          {formatDuration(track.duration)}
        </span>

        {hovered && onAddToQueue && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToQueue(track); }}
            title="Add to queue"
            style={{
              background: 'none',
              border: 'none',
              color: theme.textSecondary,
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 4px',
            }}
          >
            +
          </button>
        )}
      </div>

      {ctxMenu && <ContextMenu {...ctxMenu} onClose={() => setCtxMenu(null)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// AlbumCard – square artwork, title below
// ---------------------------------------------------------------------------

export interface AlbumCardProps {
  album: MediaAlbum;
  onPlay?: (album: MediaAlbum) => void;
}

export function AlbumCard({ album, onPlay }: AlbumCardProps) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/library/albums/${album.sourceType}:${encodeURIComponent(album.sourceId)}`)}
      style={{
        ...cardBase,
        padding: 12,
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <LazyImage
          src={album.artwork}
          alt={album.title}
          style={{ width: '100%', paddingBottom: '100%' }}
        />
        {hovered && onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(album); }}
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: theme.accent,
              border: 'none',
              color: theme.bg,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {'\u25B6'}
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ ...truncate, fontSize: 14, fontWeight: 600, color: theme.text }}>{album.title}</div>
        <div style={{ ...truncate, fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
          {album.artist}
          {album.year && ` \u00B7 ${album.year}`}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={sourceBadgeStyle(album.sourceType)}>{sourceLabels[album.sourceType]}</span>
          {album.trackCount !== undefined && (
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              {album.trackCount} track{album.trackCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArtistCard – circular photo, name below
// ---------------------------------------------------------------------------

export interface ArtistCardProps {
  artist: MediaArtist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/library/artists/${artist.sourceType}:${encodeURIComponent(artist.sourceId)}`)}
      style={{
        ...cardBase,
        padding: 16,
        textAlign: 'center',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <LazyImage
        src={artist.artwork}
        alt={artist.name}
        style={{ width: '70%', paddingBottom: '70%', margin: '0 auto', borderRadius: '50%', overflow: 'hidden' }}
      />

      <div style={{ marginTop: 12 }}>
        <div style={{ ...truncate, fontSize: 14, fontWeight: 600, color: theme.text }}>{artist.name}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
          {artist.followers !== undefined && `${artist.followers.toLocaleString()} followers`}
        </div>
        <span style={{ ...sourceBadgeStyle(artist.sourceType), marginTop: 6 }}>
          {sourceLabels[artist.sourceType]}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaylistCard – square cover, title + description
// ---------------------------------------------------------------------------

export interface PlaylistCardProps {
  playlist: MediaPlaylist;
  onPlay?: (playlist: MediaPlaylist) => void;
}

export function PlaylistCard({ playlist, onPlay }: PlaylistCardProps) {
  const [hovered, setHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => navigate(`/library/playlists/${playlist.sourceType}:${encodeURIComponent(playlist.sourceId)}`)}
      style={{
        ...cardBase,
        padding: 12,
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <LazyImage
          src={playlist.artwork}
          alt={playlist.title}
          style={{ width: '100%', paddingBottom: '100%' }}
        />
        {hovered && onPlay && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay(playlist); }}
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: theme.accent,
              border: 'none',
              color: theme.bg,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {'\u25B6'}
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ ...truncate, fontSize: 14, fontWeight: 600, color: theme.text }}>{playlist.title}</div>
        {playlist.description && (
          <div style={{ ...truncate, fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>
            {playlist.description}
          </div>
        )}
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={sourceBadgeStyle(playlist.sourceType)}>{sourceLabels[playlist.sourceType]}</span>
          {playlist.trackCount !== undefined && (
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              {playlist.trackCount} track{playlist.trackCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContentGrid – responsive grid container
// ---------------------------------------------------------------------------

export interface ContentGridProps {
  tracks?: MediaTrack[];
  albums?: MediaAlbum[];
  artists?: MediaArtist[];
  playlists?: MediaPlaylist[];
  loading?: boolean;
  skeletonCount?: number;
  onPlayTrack?: (track: MediaTrack) => void;
  onAddToQueue?: (track: MediaTrack) => void;
  onPlayAlbum?: (album: MediaAlbum) => void;
  onPlayPlaylist?: (playlist: MediaPlaylist) => void;
  /** If true, use list layout for tracks instead of grid */
  trackListMode?: boolean;
  /** Ref callback for infinite scroll sentinel */
  loadMoreRef?: (node: HTMLDivElement | null) => void;
}

export function ContentGrid({
  tracks,
  albums,
  artists,
  playlists,
  loading,
  skeletonCount = 12,
  onPlayTrack,
  onAddToQueue,
  onPlayAlbum,
  onPlayPlaylist,
  trackListMode,
  loadMoreRef,
}: ContentGridProps) {
  return (
    <div>
      {/* Tracks */}
      {tracks && tracks.length > 0 && (
        trackListMode ? (
          <div>
            {tracks.map((track, i) => (
              <TrackCard
                key={track.id}
                track={track}
                index={i}
                onPlay={onPlayTrack}
                onAddToQueue={onAddToQueue}
              />
            ))}
          </div>
        ) : (
          <div style={gridStyle}>
            {tracks.map((track) => (
              <TrackCardGrid
                key={track.id}
                track={track}
                onPlay={onPlayTrack}
                onAddToQueue={onAddToQueue}
              />
            ))}
          </div>
        )
      )}

      {/* Albums */}
      {albums && albums.length > 0 && (
        <div style={gridStyle}>
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} onPlay={onPlayAlbum} />
          ))}
        </div>
      )}

      {/* Artists */}
      {artists && artists.length > 0 && (
        <div style={gridStyle}>
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}

      {/* Playlists */}
      {playlists && playlists.length > 0 && (
        <div style={gridStyle}>
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} onPlay={onPlayPlaylist} />
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <GridSkeleton count={skeletonCount} />}

      {/* Infinite scroll sentinel */}
      {loadMoreRef && <div ref={loadMoreRef} style={{ height: 1 }} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TrackCardGrid – grid variant of TrackCard (square artwork card)
// ---------------------------------------------------------------------------

function TrackCardGrid({
  track,
  onPlay,
  onAddToQueue,
}: {
  track: MediaTrack;
  onPlay?: (track: MediaTrack) => void;
  onAddToQueue?: (track: MediaTrack) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onPlay?.(track)}
      style={{
        ...cardBase,
        padding: 12,
        transform: hovered ? 'scale(1.03)' : 'scale(1)',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <LazyImage
          src={track.artwork}
          alt={track.title}
          style={{ width: '100%', paddingBottom: '100%' }}
        />
        {hovered && (
          <button
            onClick={(e) => { e.stopPropagation(); onPlay?.(track); }}
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              width: 40,
              height: 40,
              borderRadius: '50%',
              backgroundColor: theme.accent,
              border: 'none',
              color: theme.bg,
              fontSize: 18,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            }}
          >
            {'\u25B6'}
          </button>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ ...truncate, fontSize: 14, fontWeight: 600, color: theme.text }}>{track.title}</div>
        <div style={{ ...truncate, fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>{track.artist}</div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={sourceBadgeStyle(track.sourceType)}>{sourceLabels[track.sourceType]}</span>
          <span style={{ fontSize: 11, color: theme.textMuted }}>{formatDuration(track.duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grid layout CSS
// ---------------------------------------------------------------------------

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: theme.gap,
  padding: '8px 0',
};
