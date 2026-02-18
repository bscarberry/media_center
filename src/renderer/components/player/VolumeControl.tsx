// ============================================================================
// VolumeControl – mute/unmute icon + vertical slider with scroll support
// ============================================================================

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { p, iconButton } from './theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VolumeControlProps {
  /** Current volume 0-1 */
  volume: number;
  /** Called when the user changes volume */
  onVolumeChange: (volume: number) => void;
  /** Orientation: horizontal fits in a bar, vertical pops up */
  orientation?: 'horizontal' | 'vertical';
}

// ---------------------------------------------------------------------------
// Volume icon based on level
// ---------------------------------------------------------------------------

function VolumeIcon({ volume, muted }: { volume: number; muted: boolean }) {
  if (muted || volume === 0) return <>{'\u{1F507}'}</>;      // muted
  if (volume < 0.33) return <>{'\u{1F508}'}</>;              // low
  if (volume < 0.66) return <>{'\u{1F509}'}</>;              // medium
  return <>{'\u{1F50A}'}</>;                                 // high
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VolumeControl({
  volume,
  onVolumeChange,
  orientation = 'horizontal',
}: VolumeControlProps) {
  const [muted, setMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(volume || 0.5);
  const [showPopover, setShowPopover] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const popoverTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Track external volume changes
  useEffect(() => {
    if (volume > 0 && !muted) setLastVolume(volume);
  }, [volume, muted]);

  // -- Toggle mute ----------------------------------------------------------
  const toggleMute = useCallback(() => {
    if (muted) {
      setMuted(false);
      onVolumeChange(lastVolume);
    } else {
      setMuted(true);
      setLastVolume(volume || 0.5);
      onVolumeChange(0);
    }
  }, [muted, volume, lastVolume, onVolumeChange]);

  // -- Scroll to adjust volume ----------------------------------------------
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = -e.deltaY / 500;
      const newVol = Math.max(0, Math.min(1, volume + delta));
      if (muted && newVol > 0) setMuted(false);
      onVolumeChange(newVol);
    },
    [volume, muted, onVolumeChange],
  );

  // -- Slider interaction ---------------------------------------------------
  const getValueFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      if (!sliderRef.current) return volume;
      const rect = sliderRef.current.getBoundingClientRect();
      if (orientation === 'vertical') {
        // Bottom = 0, top = 1
        return Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
      }
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [orientation, volume],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(true);
      const val = getValueFromEvent(e.clientX, e.clientY);
      if (muted && val > 0) setMuted(false);
      onVolumeChange(val);
    },
    [getValueFromEvent, muted, onVolumeChange],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const val = getValueFromEvent(e.clientX, e.clientY);
      onVolumeChange(val);
    },
    [dragging, getValueFromEvent, onVolumeChange],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // -- Popover hover management (vertical mode) ----------------------------
  const openPopover = useCallback(() => {
    if (popoverTimeout.current) clearTimeout(popoverTimeout.current);
    setShowPopover(true);
  }, []);

  const closePopover = useCallback(() => {
    popoverTimeout.current = setTimeout(() => {
      if (!dragging) setShowPopover(false);
    }, 300);
  }, [dragging]);

  const displayVolume = muted ? 0 : volume;
  const percent = Math.round(displayVolume * 100);

  // -----------------------------------------------------------------------
  // Horizontal layout (inline slider, used in PlaybackBar)
  // -----------------------------------------------------------------------
  if (orientation === 'horizontal') {
    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        onWheel={handleWheel}
      >
        <button
          onClick={toggleMute}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            ...iconButton,
            width: 28,
            height: 28,
            fontSize: 16,
            color: hovered ? p.text : p.textSecondary,
          }}
          aria-label={muted ? 'Unmute' : 'Mute'}
          title={`Volume: ${percent}%`}
        >
          <VolumeIcon volume={displayVolume} muted={muted} />
        </button>

        <div
          ref={sliderRef}
          role="slider"
          tabIndex={0}
          aria-label="Volume"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${percent}%`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            position: 'relative',
            width: 90,
            height: 16,
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {/* Track */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              backgroundColor: p.progressBg,
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${percent}%`,
                borderRadius: 2,
                backgroundColor: hovered || dragging ? p.accent : p.progressFill,
                transition: dragging ? 'none' : `width ${p.transitionFast}`,
              }}
            />
          </div>
          {/* Thumb */}
          {(hovered || dragging) && (
            <div
              style={{
                position: 'absolute',
                left: `${percent}%`,
                top: '50%',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: p.text,
                transform: 'translate(-50%, -50%)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Vertical layout (popover, used in NowPlayingView)
  // -----------------------------------------------------------------------
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={openPopover}
      onMouseLeave={closePopover}
      onWheel={handleWheel}
    >
      <button
        onClick={toggleMute}
        style={{
          ...iconButton,
          width: 32,
          height: 32,
          fontSize: 18,
          color: hovered ? p.text : p.textSecondary,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={muted ? 'Unmute' : 'Mute'}
        title={`Volume: ${percent}%`}
      >
        <VolumeIcon volume={displayVolume} muted={muted} />
      </button>

      <AnimatePresence>
        {showPopover && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: 40,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '12px 8px',
              borderRadius: p.radius,
              backgroundColor: p.bgSurface,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              zIndex: 100,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ fontSize: 11, color: p.textSecondary, fontVariantNumeric: 'tabular-nums' }}>
              {percent}%
            </span>
            <div
              ref={sliderRef}
              role="slider"
              tabIndex={0}
              aria-label="Volume"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{
                position: 'relative',
                width: 4,
                height: 100,
                borderRadius: 2,
                backgroundColor: p.progressBg,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: `${percent}%`,
                  borderRadius: 2,
                  backgroundColor: p.accent,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: `${percent}%`,
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: p.text,
                  transform: 'translate(-50%, 50%)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
