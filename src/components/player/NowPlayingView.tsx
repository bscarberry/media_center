// ============================================================================
// NowPlayingView – full-screen overlay with large artwork and controls
// ============================================================================

import React, { useEffect, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from './usePlayerStore';
import { ProgressBar } from './ProgressBar';
import { VolumeControl } from './VolumeControl';
import {
  p,
  truncateText,
  iconButton,
  iconButtonDisabled,
  formatTime,
  sourceBadge,
  sourceAccent,
  sourceLabel,
} from './theme';
import type { RepeatMode } from '../../types/media';

// ---------------------------------------------------------------------------
// SVG Icons (matching PlaybackBar but larger)
// ---------------------------------------------------------------------------

const ShuffleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
    <path d="M13.151 8.003l1.849 1.85-1.849 1.848v-1.181H11.82a3.1 3.1 0 01-2.2-.91L8.108 8.097l1.513-1.513 1.693 1.693a1.1 1.1 0 00.778.322h1.06V7.418l-.001.585zm0-4.656l1.849 1.85-1.849 1.848V5.864H11.82a1.1 1.1 0 00-.778.322L7.892 9.335a3.1 3.1 0 01-2.2.91H2v-2h3.692a1.1 1.1 0 00.778-.322l3.15-3.149a3.1 3.1 0 012.2-.91h1.331V3.347zM2 5.245h3.692a3.1 3.1 0 012.2.91l.513.512-1.513 1.513-.513-.513a1.1 1.1 0 00-.778-.322H2v-2.1z" />
  </svg>
);

const PrevIcon = () => (
  <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.149V14.3a.7.7 0 01-.7.7H2.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h.6z" />
  </svg>
);

const NextIcon = () => (
  <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
    <path d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.149V14.3a.7.7 0 00.7.7h.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-.6z" />
  </svg>
);

const PlayIcon = () => (
  <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor">
    <path d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z" />
  </svg>
);

const PauseIcon = () => (
  <svg width="28" height="28" viewBox="0 0 16 16" fill="currentColor">
    <path d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z" />
  </svg>
);

const RepeatIcon = ({ mode }: { mode: RepeatMode }) => (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
    <path d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H13v1.5l-3-2 3-2v1.5h-.75A2.25 2.25 0 0014.5 9.75v-5A2.25 2.25 0 0012.25 2.5h-8.5A2.25 2.25 0 001.5 4.75v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z" />
    {mode === 'one' && (
      <text x="5.5" y="10.5" fontSize="7" fontWeight="bold" fill="currentColor">1</text>
    )}
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NowPlayingViewProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NowPlayingView({ isOpen, onClose }: NowPlayingViewProps) {
  const {
    currentTrack,
    playbackState,
    queue,
    currentIndex,
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

  // -- Escape to close -----------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const sourceType = currentTrack?.sourceType;
  const accentColor = sourceType ? sourceAccent[sourceType] : p.accent;

  // Up Next preview (next 5 tracks)
  const upNextTracks = queue.slice(currentIndex + 1, currentIndex + 6);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={overlay}
          role="dialog"
          aria-label="Now Playing"
        >
          {/* Background: blurred artwork */}
          {currentTrack?.artwork && (
            <div style={bgArtwork}>
              <img
                src={currentTrack.artwork}
                alt=""
                aria-hidden
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: 'blur(80px) brightness(0.3) saturate(1.5)',
                  transform: 'scale(1.2)',
                }}
              />
            </div>
          )}

          <div style={contentContainer}>
            {/* ---- Top bar ------------------------------------------------ */}
            <header style={topBar}>
              <button
                onClick={onClose}
                style={{ ...iconButton, color: p.text, width: 40, height: 40 }}
                aria-label="Minimize now playing"
              >
                <ChevronDownIcon />
              </button>

              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 11, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Now Playing
                </div>
              </div>

              {sourceType && (
                <span style={sourceBadge(sourceType)}>
                  {sourceLabel[sourceType]}
                </span>
              )}
            </header>

            {/* ---- Center: artwork ---------------------------------------- */}
            <main style={centerArea}>
              {currentTrack ? (
                <motion.div
                  animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
                  transition={isPlaying ? { repeat: Infinity, duration: 30, ease: 'linear' } : { duration: 0.5 }}
                  style={artworkContainer}
                >
                  {currentTrack.artwork ? (
                    <img
                      src={currentTrack.artwork}
                      alt={currentTrack.title}
                      style={artworkImg}
                    />
                  ) : (
                    <div style={{
                      ...artworkImg,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: p.bgSurface,
                      fontSize: 80,
                      color: p.textMuted,
                    }}>
                      {'\u{266B}'}
                    </div>
                  )}
                </motion.div>
              ) : null}

              {/* Track info */}
              {currentTrack && (
                <div style={{ textAlign: 'center', marginTop: 32, maxWidth: 500 }}>
                  <div style={{ ...truncateText, fontSize: 24, fontWeight: 700, color: p.text }}>
                    {currentTrack.title}
                  </div>
                  <div style={{ ...truncateText, fontSize: 16, color: p.textSecondary, marginTop: 8 }}>
                    {currentTrack.artist}
                    {currentTrack.album && ` \u2014 ${currentTrack.album}`}
                  </div>
                </div>
              )}
            </main>

            {/* ---- Bottom: controls --------------------------------------- */}
            <footer style={bottomArea}>
              {/* Progress */}
              <div style={{ width: '100%', maxWidth: 600, margin: '0 auto' }}>
                <ProgressBar
                  position={position}
                  duration={duration}
                  onSeek={seek}
                  disabled={!canSeek}
                  buffering={buffering}
                  size="large"
                />
              </div>

              {/* Controls row */}
              <div style={controlsRow}>
                <button
                  onClick={toggleShuffle}
                  style={{
                    ...iconButton,
                    width: 40,
                    height: 40,
                    color: shuffleEnabled ? p.accent : p.textSecondary,
                  }}
                  aria-label={`Shuffle ${shuffleEnabled ? 'on' : 'off'}`}
                >
                  <ShuffleIcon />
                </button>

                <button
                  onClick={skipPrevious}
                  disabled={!canSkipPrevious}
                  style={{
                    ...iconButton,
                    ...(canSkipPrevious ? {} : iconButtonDisabled),
                    width: 40,
                    height: 40,
                  }}
                  aria-label="Previous"
                >
                  <PrevIcon />
                </button>

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => togglePlayPause()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    backgroundColor: p.text,
                    border: 'none',
                    color: p.bg,
                    cursor: 'pointer',
                  }}
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {buffering ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      style={{
                        width: 24,
                        height: 24,
                        border: `3px solid ${p.bg}`,
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

                <button
                  onClick={skipNext}
                  disabled={!canSkipNext}
                  style={{
                    ...iconButton,
                    ...(canSkipNext ? {} : iconButtonDisabled),
                    width: 40,
                    height: 40,
                  }}
                  aria-label="Next"
                >
                  <NextIcon />
                </button>

                <button
                  onClick={cycleRepeatMode}
                  style={{
                    ...iconButton,
                    width: 40,
                    height: 40,
                    color: repeatMode !== 'off' ? p.accent : p.textSecondary,
                  }}
                  aria-label={`Repeat: ${repeatMode}`}
                >
                  <RepeatIcon mode={repeatMode} />
                </button>
              </div>

              {/* Volume */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                <VolumeControl
                  volume={volume}
                  onVolumeChange={setVolume}
                  orientation="horizontal"
                />
              </div>

              {/* Up Next preview */}
              {upNextTracks.length > 0 && (
                <div style={upNextSection}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    Up Next
                  </div>
                  {upNextTracks.map((track) => (
                    <div key={track.id} style={upNextItem}>
                      <div style={{
                        width: 36,
                        height: 36,
                        borderRadius: p.radiusSmall,
                        overflow: 'hidden',
                        flexShrink: 0,
                        backgroundColor: p.bgSurface,
                      }}>
                        {track.artwork && (
                          <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ ...truncateText, fontSize: 13, color: p.text }}>{track.title}</div>
                        <div style={{ ...truncateText, fontSize: 11, color: p.textMuted }}>{track.artist}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2000,
  backgroundColor: p.bg,
  overflow: 'hidden',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const bgArtwork: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const contentContainer: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  padding: '16px 24px',
};

const topBar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
};

const centerArea: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 0,
};

const artworkContainer: CSSProperties = {
  width: '100%',
  maxWidth: 500,
  aspectRatio: '1',
  borderRadius: 12,
  overflow: 'hidden',
  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
};

const artworkImg: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const bottomArea: CSSProperties = {
  flexShrink: 0,
  paddingBottom: 24,
};

const controlsRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 24,
  marginTop: 16,
};

const upNextSection: CSSProperties = {
  marginTop: 20,
  maxWidth: 400,
  marginLeft: 'auto',
  marginRight: 'auto',
};

const upNextItem: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 0',
};
