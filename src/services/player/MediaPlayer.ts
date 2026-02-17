// ============================================================================
// MediaPlayerStrategy – abstract base class for unified player control
// ============================================================================

import type {
  MediaPlayerEvents,
  MediaPlayerEventName,
  MediaSourceType,
  MediaTrack,
  PlaybackState,
} from '../../types/media';

type Listener<K extends MediaPlayerEventName> = (
  payload: MediaPlayerEvents[K],
) => void;

// ---------------------------------------------------------------------------
// Abstract base
// ---------------------------------------------------------------------------

export abstract class MediaPlayerStrategy {
  abstract readonly sourceType: MediaSourceType;

  protected listeners = new Map<MediaPlayerEventName, Set<Listener<any>>>();
  protected initialized = false;
  protected volume = 1;

  // -- Lifecycle -----------------------------------------------------------

  abstract initialize(): Promise<void>;
  abstract dispose(): Promise<void>;

  isInitialized(): boolean {
    return this.initialized;
  }

  // -- Playback ------------------------------------------------------------

  abstract play(track: MediaTrack): Promise<void>;
  abstract pause(): Promise<void>;
  abstract resume(): Promise<void>;
  abstract seek(positionMs: number): Promise<void>;
  abstract setVolume(volume: number): Promise<void>;
  abstract getState(): PlaybackState | null;

  /** Fade volume from current to target over durationMs. */
  async fadeVolume(target: number, durationMs: number): Promise<void> {
    if (durationMs <= 0) {
      await this.setVolume(target);
      return;
    }

    const start = this.volume;
    const steps = Math.max(1, Math.floor(durationMs / 50));
    const stepDuration = durationMs / steps;
    const delta = (target - start) / steps;

    for (let i = 1; i <= steps; i++) {
      await new Promise<void>((r) => setTimeout(r, stepDuration));
      await this.setVolume(start + delta * i);
    }
  }

  // -- Events --------------------------------------------------------------

  on<K extends MediaPlayerEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off<K extends MediaPlayerEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  protected emit<K extends MediaPlayerEventName>(
    event: K,
    payload: MediaPlayerEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }
}
