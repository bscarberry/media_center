// ============================================================================
// ProgressBar – seekable progress with RAF animation, tooltip, and buffering
// ============================================================================

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  type CSSProperties,
} from 'react';
import { p, formatTime } from './theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ProgressBarProps {
  /** Current position in milliseconds */
  position: number;
  /** Total duration in milliseconds */
  duration: number;
  /** Buffered amount in milliseconds (0 if unknown) */
  buffered?: number;
  /** Called when the user seeks to a new position (ms) */
  onSeek?: (positionMs: number) => void;
  /** Disable seeking (non-seekable content) */
  disabled?: boolean;
  /** Show buffering animation */
  buffering?: boolean;
  /** Size variant */
  size?: 'small' | 'large';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProgressBar({
  position,
  duration,
  buffered = 0,
  onSeek,
  disabled = false,
  buffering = false,
  size = 'small',
}: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [hoverX, setHoverX] = useState(0);
  const [dragPosition, setDragPosition] = useState(0);

  const barHeight = size === 'large' ? 6 : 4;
  const thumbSize = size === 'large' ? 16 : 12;
  const showThumb = hovered || dragging;

  // Fraction helpers
  const fraction = duration > 0 ? Math.min(1, (dragging ? dragPosition : position) / duration) : 0;
  const bufferedFraction = duration > 0 ? Math.min(1, buffered / duration) : 0;
  const hoverFraction = duration > 0 ? Math.min(1, Math.max(0, hoverX)) : 0;
  const hoverTimeMs = hoverFraction * duration;

  // -- Mouse/touch position to fraction ------------------------------------
  const getFractionFromEvent = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return 0;
      const rect = trackRef.current.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [],
  );

  // -- Pointer events for dragging -----------------------------------------
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const frac = getFractionFromEvent(e.clientX);
      setDragging(true);
      setDragPosition(frac * duration);
    },
    [disabled, duration, getFractionFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const frac = getFractionFromEvent(e.clientX);
      setHoverX(frac);
      if (dragging) {
        setDragPosition(frac * duration);
      }
    },
    [dragging, duration, getFractionFromEvent],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (dragging) {
        const frac = getFractionFromEvent(e.clientX);
        onSeek?.(frac * duration);
        setDragging(false);
      }
    },
    [dragging, duration, getFractionFromEvent, onSeek],
  );

  // -- Keyboard seeking ----------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled || duration === 0) return;
      let seekTo: number | null = null;
      if (e.key === 'ArrowRight') seekTo = Math.min(duration, position + 5000);
      if (e.key === 'ArrowLeft') seekTo = Math.max(0, position - 5000);
      if (e.key === 'Home') seekTo = 0;
      if (e.key === 'End') seekTo = duration;

      if (seekTo !== null) {
        e.preventDefault();
        onSeek?.(seekTo);
      }
    },
    [disabled, duration, position, onSeek],
  );

  const activeColor = (hovered || dragging) ? p.progressHover : p.progressFill;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        userSelect: 'none',
      }}
    >
      {/* Current time */}
      <span
        style={{
          fontSize: 11,
          color: p.textMuted,
          minWidth: 36,
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(dragging ? dragPosition : position)}
      </span>

      {/* Track area */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Playback progress"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${formatTime(position)} of ${formatTime(duration)}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => { setHovered(false); if (!dragging) setDragging(false); }}
        onPointerEnter={() => setHovered(true)}
        onKeyDown={handleKeyDown}
        style={{
          position: 'relative',
          flex: 1,
          height: thumbSize + 8,
          display: 'flex',
          alignItems: 'center',
          cursor: disabled ? 'default' : 'pointer',
          outline: 'none',
        }}
      >
        {/* Background track */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: barHeight,
            borderRadius: barHeight / 2,
            backgroundColor: p.progressBg,
            overflow: 'hidden',
          }}
        >
          {/* Buffered region */}
          {buffered > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${bufferedFraction * 100}%`,
                backgroundColor: p.progressBuffer,
                borderRadius: barHeight / 2,
              }}
            />
          )}

          {/* Filled region */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${fraction * 100}%`,
              backgroundColor: activeColor,
              borderRadius: barHeight / 2,
              transition: dragging ? 'none' : `width 100ms linear`,
            }}
          />

          {/* Buffering animation */}
          {buffering && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(90deg, transparent 0%, ${p.accent}40 50%, transparent 100%)`,
                animation: 'progressPulse 1.5s ease-in-out infinite',
                borderRadius: barHeight / 2,
              }}
            />
          )}
        </div>

        {/* Hover time tooltip */}
        {hovered && !dragging && duration > 0 && (
          <div
            style={{
              position: 'absolute',
              left: `${hoverFraction * 100}%`,
              top: -28,
              transform: 'translateX(-50%)',
              padding: '2px 6px',
              borderRadius: p.radiusSmall,
              backgroundColor: p.bgSurface,
              color: p.text,
              fontSize: 11,
              fontVariantNumeric: 'tabular-nums',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {formatTime(hoverTimeMs)}
          </div>
        )}

        {/* Thumb */}
        {showThumb && !disabled && (
          <div
            style={{
              position: 'absolute',
              left: `${fraction * 100}%`,
              top: '50%',
              width: thumbSize,
              height: thumbSize,
              borderRadius: '50%',
              backgroundColor: p.text,
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              transition: dragging ? 'none' : `left 100ms linear`,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* Duration */}
      <span
        style={{
          fontSize: 11,
          color: p.textMuted,
          minWidth: 36,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatTime(duration)}
      </span>
    </div>
  );
}
