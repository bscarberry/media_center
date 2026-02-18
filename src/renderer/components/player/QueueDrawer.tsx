// ============================================================================
// QueueDrawer – slide-out panel from right with drag-to-reorder queue
// ============================================================================

import React, { useState, useRef, useCallback, useEffect, type CSSProperties, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { List, type ListImperativeAPI } from 'react-window';
import { usePlayerStore } from './usePlayerStore';
import {
  p,
  truncateText,
  iconButton,
  formatTime,
  sourceBadge,
  sourceAccent,
  sourceName,
} from './theme';
import type { MediaTrack, MediaSourceType } from '../../types/media';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: save-as-playlist callback */
  onSaveAsPlaylist?: (tracks: MediaTrack[]) => void;
}

// ---------------------------------------------------------------------------
// Row props passed via List's rowProps
// ---------------------------------------------------------------------------

interface QueueRowProps {
  queue: MediaTrack[];
  currentIndex: number;
  isPlaying: boolean;
  dragIndex: number | null;
  dragOverIndex: number | null;
  onDragStart: (index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (index: number) => void;
  onDragEnd: () => void;
  onPlayAt: (queue: MediaTrack[], index: number) => void;
  onRemove: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Row component (must be a standalone component, not inside useCallback)
// ---------------------------------------------------------------------------

function QueueRow({
  index,
  style,
  queue,
  currentIndex,
  isPlaying,
  dragIndex,
  dragOverIndex,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onPlayAt,
  onRemove,
}: {
  index: number;
  style: CSSProperties;
  ariaAttributes: { 'aria-posinset': number; 'aria-setsize': number; role: 'listitem' };
} & QueueRowProps): ReactElement | null {
  const track = queue[index];
  if (!track) return null;

  const isCurrent = index === currentIndex;
  const isPlayed = index < currentIndex;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      style={{
        ...style,
        opacity: dragIndex === index ? 0.4 : 1,
        borderTop: dragOverIndex === index ? `2px solid ${p.accent}` : 'none',
      }}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={() => onDrop(index)}
      onDragEnd={onDragEnd}
    >
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => {
          if (!isCurrent) onPlayAt(queue, index);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '8px 16px',
          height: '100%',
          cursor: isCurrent ? 'default' : 'pointer',
          backgroundColor: isCurrent ? p.bgActive : hovered ? p.bgHover : 'transparent',
          transition: `background-color ${p.transitionFast}`,
          opacity: isPlayed ? 0.5 : 1,
        }}
      >
        {/* Drag handle */}
        <span
          style={{
            cursor: 'grab',
            color: p.textMuted,
            fontSize: 14,
            flexShrink: 0,
            width: 16,
            textAlign: 'center',
            opacity: hovered ? 1 : 0,
            transition: `opacity ${p.transitionFast}`,
          }}
        >
          {'\u2630'}
        </span>

        {/* Playing indicator or index */}
        <span style={{
          width: 20,
          textAlign: 'center',
          fontSize: 12,
          color: isCurrent ? p.accent : p.textMuted,
          flexShrink: 0,
        }}>
          {isCurrent && isPlaying ? (
            <PlayingBars />
          ) : (
            index + 1
          )}
        </span>

        {/* Thumbnail */}
        <div style={{
          width: p.artworkSizeSmall,
          height: p.artworkSizeSmall,
          borderRadius: p.radiusSmall,
          overflow: 'hidden',
          flexShrink: 0,
          backgroundColor: p.bgSurface,
        }}>
          {track.artwork ? (
            <img src={track.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: p.textMuted }}>
              {'\u{266B}'}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            ...truncateText,
            fontSize: 13,
            fontWeight: isCurrent ? 600 : 400,
            color: isCurrent ? p.accent : p.text,
          }}>
            {track.title}
          </div>
          <div style={{ ...truncateText, fontSize: 11, color: p.textMuted, marginTop: 1 }}>
            {track.artist}
          </div>
        </div>

        {/* Source + duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <SourceDot sourceType={track.sourceType} />
          <span style={{ fontSize: 11, color: p.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(track.duration)}
          </span>
        </div>

        {/* Remove button (on hover) */}
        {hovered && !isCurrent && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            style={{
              ...iconButton,
              width: 24,
              height: 24,
              fontSize: 14,
              color: p.textMuted,
              flexShrink: 0,
            }}
            aria-label={`Remove ${track.title} from queue`}
          >
            {'\u2715'}
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QueueDrawer({ isOpen, onClose, onSaveAsPlaylist }: QueueDrawerProps) {
  const {
    currentTrack,
    queue,
    currentIndex,
    playbackState,
    playQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
  } = usePlayerStore();

  const [confirmClear, setConfirmClear] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const listRef = useRef<ListImperativeAPI>(null);

  // Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Reset confirm when closing
  useEffect(() => {
    if (!isOpen) setConfirmClear(false);
  }, [isOpen]);

  // Scroll to current track when opened
  useEffect(() => {
    if (isOpen && currentIndex >= 0 && listRef.current) {
      listRef.current.scrollToRow({ index: currentIndex, align: 'center' });
    }
  }, [isOpen, currentIndex, listRef]);

  const handleClear = useCallback(() => {
    if (confirmClear) {
      clearQueue();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
    }
  }, [confirmClear, clearQueue]);

  // Drag handlers
  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback(
    (index: number) => {
      if (dragIndex !== null && dragIndex !== index) {
        reorderQueue(dragIndex, index);
      }
      setDragIndex(null);
      setDragOverIndex(null);
    },
    [dragIndex, reorderQueue],
  );

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={backdrop}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={drawer}
            role="complementary"
            aria-label="Play queue"
          >
            {/* Header */}
            <div style={drawerHeader}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: p.text, margin: 0 }}>
                Queue
              </h2>
              <span style={{ fontSize: 12, color: p.textMuted }}>
                {queue.length} track{queue.length !== 1 ? 's' : ''}
              </span>
              <div style={{ flex: 1 }} />
              <button
                onClick={onClose}
                style={{ ...iconButton, width: 32, height: 32, color: p.textSecondary, fontSize: 18 }}
                aria-label="Close queue"
              >
                {'\u2715'}
              </button>
            </div>

            {/* Now playing highlight */}
            {currentTrack && (
              <div style={nowPlayingSection}>
                <div style={{ fontSize: 11, fontWeight: 600, color: p.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Now Playing
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 56,
                    height: 56,
                    borderRadius: p.radiusSmall,
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: p.bgSurface,
                  }}>
                    {currentTrack.artwork ? (
                      <img src={currentTrack.artwork} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: p.textMuted }}>
                        {'\u{266B}'}
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ ...truncateText, fontSize: 14, fontWeight: 600, color: p.accent }}>
                      {currentTrack.title}
                    </div>
                    <div style={{ ...truncateText, fontSize: 12, color: p.textSecondary, marginTop: 2 }}>
                      {currentTrack.artist}
                    </div>
                  </div>
                  {currentTrack.sourceType && (
                    <span style={{ ...sourceBadge(currentTrack.sourceType), fontSize: 9 }}>
                      {sourceName[currentTrack.sourceType]}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Queue list (virtualized) */}
            <div style={{ flex: 1, minHeight: 0 }}>
              {queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: p.textMuted }}>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>Queue is empty</div>
                  <div style={{ fontSize: 12 }}>Add tracks to start playing</div>
                </div>
              ) : (
                <List<QueueRowProps>
                  listRef={listRef}
                  rowComponent={QueueRow}
                  rowCount={queue.length}
                  rowHeight={64}
                  overscanCount={5}
                  style={{ outline: 'none', height: 500 }}
                  rowProps={{
                    queue,
                    currentIndex,
                    isPlaying: playbackState.isPlaying,
                    dragIndex,
                    dragOverIndex,
                    onDragStart: handleDragStart,
                    onDragOver: handleDragOver,
                    onDrop: handleDrop,
                    onDragEnd: handleDragEnd,
                    onPlayAt: playQueue,
                    onRemove: removeFromQueue,
                  }}
                />
              )}
            </div>

            {/* Footer actions */}
            {queue.length > 0 && (
              <div style={drawerFooter}>
                {onSaveAsPlaylist && (
                  <button
                    onClick={() => onSaveAsPlaylist(queue)}
                    style={footerButton}
                  >
                    Save as playlist
                  </button>
                )}
                <button
                  onClick={handleClear}
                  style={{
                    ...footerButton,
                    color: confirmClear ? p.text : p.textSecondary,
                    backgroundColor: confirmClear ? '#e74c3c' : 'transparent',
                    borderColor: confirmClear ? '#e74c3c' : p.border,
                  }}
                >
                  {confirmClear ? 'Confirm clear' : 'Clear queue'}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Mini components
// ---------------------------------------------------------------------------

/** Small coloured dot for source indication */
function SourceDot({ sourceType }: { sourceType: MediaSourceType }) {
  return (
    <div
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: sourceAccent[sourceType],
        flexShrink: 0,
      }}
      title={sourceName[sourceType]}
    />
  );
}

/** Animated "playing" equalizer bars */
function PlayingBars() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14">
      <rect x="1" y="6" width="2" height="8" fill={p.accent} rx="1">
        <animate attributeName="height" values="8;3;8" dur="0.8s" repeatCount="indefinite" />
        <animate attributeName="y" values="6;11;6" dur="0.8s" repeatCount="indefinite" />
      </rect>
      <rect x="5" y="3" width="2" height="11" fill={p.accent} rx="1">
        <animate attributeName="height" values="11;5;11" dur="0.6s" repeatCount="indefinite" />
        <animate attributeName="y" values="3;9;3" dur="0.6s" repeatCount="indefinite" />
      </rect>
      <rect x="9" y="5" width="2" height="9" fill={p.accent} rx="1">
        <animate attributeName="height" values="9;4;9" dur="0.7s" repeatCount="indefinite" />
        <animate attributeName="y" values="5;10;5" dur="0.7s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  zIndex: 1500,
};

const drawer: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 380,
  maxWidth: '100vw',
  backgroundColor: p.bgBar,
  borderLeft: `1px solid ${p.border}`,
  zIndex: 1501,
  display: 'flex',
  flexDirection: 'column',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const drawerHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '16px 16px 12px',
  borderBottom: `1px solid ${p.border}`,
  flexShrink: 0,
};

const nowPlayingSection: CSSProperties = {
  padding: 16,
  borderBottom: `1px solid ${p.border}`,
  flexShrink: 0,
};

const drawerFooter: CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: 12,
  borderTop: `1px solid ${p.border}`,
  flexShrink: 0,
};

const footerButton: CSSProperties = {
  flex: 1,
  padding: '8px 16px',
  borderRadius: p.radiusRound,
  border: `1px solid ${p.border}`,
  backgroundColor: 'transparent',
  color: p.textSecondary,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
  transition: `all ${p.transition}`,
};
