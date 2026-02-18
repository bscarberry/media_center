// ============================================================================
// PlaybackBar – fixed bottom bar with track info, controls, and volume
// ============================================================================

import React, { useState, useCallback, useEffect, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from './usePlayerStore';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import {
  p,
  truncateText,
  iconButton,
  iconButtonDisabled,
  iconButtonActive,
  formatTime,
  sourceBadge,
  sourceAccent,
  sourceName,
} from './theme';
import { MediaSourceType, type MediaTrack, type RepeatMode } from '../../types/media';

// ---------------------------------------------------------------------------
// SVG icons (inline to avoid external deps)
// ---------------------------------------------------------------------------

const ShuffleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.151 8.003l1.849 1.85-1.849 1.848v-1.181H11.82a3.1 3.1 0 01-2.2-.91L8.108 8.097l1.513-1.513 1.693 1.693a1.1 1.1 0 00.778.322h1.06V7.418l-.001.585zm0-4.656l1.849 1.85-1.849 1.848V5.864H11.82a1.1 1.1 0 00-.778.322L7.892 9.335a3.1 3.1 0 01-2.2.91H2v-2h3.692a1.1 1.1 0 00.778-.322l3.15-3.149a3.1 3.1 0 012.2-.91h1.331V3.347zM2 5.245h3.692a3.1 3.1 0 012.2.91l.513.512-1.513 1.513-.513-.513a1.1 1.1 0 00-.778-.322H2v-2.1z" />
  </svg>
);

const PrevIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.149V14.3a.7.7 0 01-.7.7H2.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h.6z" />
  </svg>
);

const NextIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.149V14.3a.7.7 0 00.7.7h.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-.6z" />
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z" />
  </svg>
);

const RepeatIcon = ({ mode }: { mode: RepeatMode }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H13v1.5l-3-2 3-2v1.5h-.75A2.25 2.25 0 0014.5 9.75v-5A2.25 2.25 0 0012.25 2.5h-8.5A2.25 2.25 0 001.5 4.75v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z" />
    {mode === 'one' && (
      <text x="5.5" y="10.5" fontSize="7" fontWeight="bold" fill="currentColor">1</text>
    )}
  </svg>
);

const QueueIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A2.5 2.5 0 013.5 1h9a2.5 2.5 0 010 5h-9A2.5 2.5 0 011 3.5zm2.5-1a1 1 0 000 2h9a1 1 0 100-2h-9z" />
  </svg>
);

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
    <path d="M8 14s-5.5-3.5-5.5-7.5C2.5 4 4 2.5 5.5 2.5S8 4.5 8 4.5 9 2.5 10.5 2.5 13.5 4 13.5 6.5C13.5 10.5 8 14 8 14z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PlaybackBarProps {
  /** Open the NowPlaying view when artwork is clicked */
  onOpenNowPlaying?: () => void;
  /** Toggle queue drawer */
  onToggleQueue?: () => void;
  /** Like/heart callback */
  onToggleLike?: (track: MediaTrack) => void;
  /** Whether the current track is liked */
  isLiked?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlaybackBar({
  onOpenNowPlaying,
  onToggleQueue,
  onToggleLike,
  isLiked = false,
}: PlaybackBarProps) {
  const {
    currentTrack,
    playbackState,
    shuffleEnabled,
    repeatMode,
    togglePlayPause,
    skipNext,
    skipPrevious,
    seek,
    setVolume,
    toggleShuffle,
    cycleRepeatMode,
  } = usePlayerStore();

  const {
    isPlaying,
    buffering,
    position,
    duration,
    volume,
    canSkipNext,
    canSkipPrevious,
    canSeek,
  } = playbackState;

  // -- Keyboard shortcuts ---------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'ArrowRight':
          if (e.shiftKey) { e.preventDefault(); skipNext(); }
          break;
        case 'ArrowLeft':
          if (e.shiftKey) { e.preventDefault(); skipPrevious(); }
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlayPause, skipNext, skipPrevious]);

  const sourceType = currentTrack?.sourceType;
  const accentColor = sourceType ? sourceAccent[sourceType] : p.accent;

  // -----------------------------------------------------------------------
  // No track state
  // -----------------------------------------------------------------------
  if (!currentTrack) {
    return (
      <nav style={barContainer} aria-label="Playback controls">
        <div style={{ ...barInner, justifyContent: 'center' }}>
          <span style={{ color: p.textMuted, fontSize: 14 }}>
            Select something to play
          </span>
        </div>
      </nav>
    );
  }

  return (
    <nav style={barContainer} aria-label="Playback controls">
      <div style={barInner}>
        {/* ============================================================= */}
        {/* LEFT SECTION – track info (30%)                               */}
        {/* ============================================================= */}
        <section style={leftSection} aria-label="Now playing">
          {/* Artwork */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            onClick={onOpenNowPlaying}
            style={{
              width: p.artworkSize,
              height: p.artworkSize,
              borderRadius: p.radiusSmall,
              overflow: 'hidden',
              flexShrink: 0,
              cursor: 'pointer',
              backgroundColor: p.bgSurface,
            }}
          >
            {currentTrack.artwork ? (
              <img
                src={currentTrack.artwork}
                alt={currentTrack.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                color: p.textMuted,
              }}>
                {'\u{266B}'}
              </div>
            )}
          </motion.div>

          {/* Track info */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...truncateText, fontSize: 14, fontWeight: 500, color: p.text }}>
              {currentTrack.title}
            </div>
            <div style={{ ...truncateText, fontSize: 12, color: p.textSecondary, marginTop: 2 }}>
              {currentTrack.artist}
            </div>
          </div>

          {/* Like button */}
          <button
            onClick={() => onToggleLike?.(currentTrack)}
            style={{
              ...iconButton,
              width: 28,
              height: 28,
              color: isLiked ? p.accent : p.textSecondary,
            }}
            aria-label={isLiked ? 'Remove from liked songs' : 'Add to liked songs'}
          >
            <HeartIcon filled={isLiked} />
          </button>

          {/* Source badge */}
          {sourceType && (
            <span style={{ ...sourceBadge(sourceType), fontSize: 10 }}>
              {sourceName[sourceType]}
            </span>
          )}
        </section>

        {/* ============================================================= */}
        {/* CENTER SECTION – controls + progress (40%)                    */}
        {/* ============================================================= */}
        <section style={centerSection} aria-label="Player controls">
          {/* Control buttons */}
          <div style={controlsRow}>
            {/* Shuffle */}
            <button
              onClick={toggleShuffle}
              style={{
                ...iconButton,
                width: p.controlSize,
                height: p.controlSize,
                color: shuffleEnabled ? p.accent : p.textSecondary,
              }}
              aria-label={`Shuffle ${shuffleEnabled ? 'on' : 'off'}`}
              aria-pressed={shuffleEnabled}
            >
              <ShuffleIcon />
            </button>

            {/* Previous */}
            <button
              onClick={skipPrevious}
              disabled={!canSkipPrevious}
              style={{
                ...iconButton,
                ...(canSkipPrevious ? {} : iconButtonDisabled),
                width: p.controlSize,
                height: p.controlSize,
              }}
              aria-label="Previous track"
            >
              <PrevIcon />
            </button>

            {/* Play/Pause */}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => togglePlayPause()}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: p.controlSizeLarge,
                height: p.controlSizeLarge,
                borderRadius: '50%',
                backgroundColor: p.text,
                border: 'none',
                color: p.bg,
                cursor: 'pointer',
                position: 'relative',
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {buffering ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  style={{
                    width: 20,
                    height: 20,
                    border: `2px solid ${p.bg}`,
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                  }}
                />
              ) : isPlaying ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
            </motion.button>

            {/* Next */}
            <button
              onClick={skipNext}
              disabled={!canSkipNext}
              style={{
                ...iconButton,
                ...(canSkipNext ? {} : iconButtonDisabled),
                width: p.controlSize,
                height: p.controlSize,
              }}
              aria-label="Next track"
            >
              <NextIcon />
            </button>

            {/* Repeat */}
            <button
              onClick={cycleRepeatMode}
              style={{
                ...iconButton,
                width: p.controlSize,
                height: p.controlSize,
                color: repeatMode !== 'off' ? p.accent : p.textSecondary,
              }}
              aria-label={`Repeat: ${repeatMode}`}
            >
              <RepeatIcon mode={repeatMode} />
            </button>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
            <ProgressBar
              position={position}
              duration={duration}
              onSeek={seek}
              disabled={!canSeek}
              buffering={buffering}
              size="small"
            />
          </div>
        </section>

        {/* ============================================================= */}
        {/* RIGHT SECTION – queue, volume, extras (30%)                   */}
        {/* ============================================================= */}
        <section style={rightSection} aria-label="Additional controls">
          {/* Queue */}
          <button
            onClick={onToggleQueue}
            style={{
              ...iconButton,
              width: p.controlSize,
              height: p.controlSize,
            }}
            aria-label="Toggle queue"
          >
            <QueueIcon />
          </button>

          {/* Volume */}
          <VolumeControl
            volume={volume}
            onVolumeChange={setVolume}
            orientation="horizontal"
          />
        </section>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const barContainer: CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: p.barHeight,
  backgroundColor: p.bgBar,
  borderTop: `1px solid ${p.border}`,
  zIndex: 1000,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const barInner: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  padding: '0 16px',
  maxWidth: 1800,
  margin: '0 auto',
};

const leftSection: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '30%',
  minWidth: 180,
};

const centerSection: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  width: '40%',
  maxWidth: 700,
  padding: '0 16px',
};

const controlsRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
};

const rightSection: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 12,
  width: '30%',
  minWidth: 180,
};
