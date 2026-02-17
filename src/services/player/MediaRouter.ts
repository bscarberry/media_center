// ============================================================================
// UnifiedMediaRouter – seamless playback routing across Spotify, YouTube,
// and Jellyfin sources with queue management and crossfade support
// ============================================================================

import { MediaPlayerStrategy } from './MediaPlayer';
import {
  MediaSourceType,
  EMPTY_PLAYBACK_STATE,
  DEFAULT_ROUTER_CONFIG,
  type MediaTrack,
  type PlaybackState,
  type MediaRouterEvents,
  type MediaRouterEventName,
  type MediaRouterConfig,
} from '../../types/media';

type Listener<K extends MediaRouterEventName> = (
  payload: MediaRouterEvents[K],
) => void;

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

function log(level: 'info' | 'warn' | 'error', message: string, ctx?: Record<string, unknown>): void {
  const prefix = `[MediaRouter]`;
  const extra = ctx ? ` ${JSON.stringify(ctx)}` : '';
  if (level === 'error') {
    console.error(`${prefix} ${message}${extra}`);
  } else if (level === 'warn') {
    console.warn(`${prefix} ${message}${extra}`);
  } else {
    console.log(`${prefix} ${message}${extra}`);
  }
}

// ---------------------------------------------------------------------------
// UnifiedMediaRouter
// ---------------------------------------------------------------------------

export class UnifiedMediaRouter {
  private strategies = new Map<MediaSourceType, MediaPlayerStrategy>();
  private currentStrategy: MediaPlayerStrategy | null = null;
  private currentSourceType: MediaSourceType | null = null;

  private queue: MediaTrack[] = [];
  private currentIndex = -1;
  private shuffleEnabled = false;
  private shuffleOrder: number[] = [];

  private config: MediaRouterConfig;
  private listeners = new Map<MediaRouterEventName, Set<Listener<any>>>();

  // Crossfade state
  private crossfadeActive = false;
  private preloadTimer: ReturnType<typeof setTimeout> | null = null;

  // Warm-player disposal timers (keep players alive briefly after switching)
  private warmTimers = new Map<MediaSourceType, ReturnType<typeof setTimeout>>();

  // Track-ended listener references per strategy (for cleanup)
  private trackEndedHandlers = new Map<MediaSourceType, () => void>();

  constructor(config?: Partial<MediaRouterConfig>) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  // -----------------------------------------------------------------------
  // Strategy registration (lazy — call before first use of that source)
  // -----------------------------------------------------------------------

  registerStrategy(strategy: MediaPlayerStrategy): void {
    const type = strategy.sourceType;
    this.strategies.set(type, strategy);

    // Wire up the track_ended event so we can auto-advance
    const handler = () => this.handleTrackEnded();
    this.trackEndedHandlers.set(type, handler);
    strategy.on('track_ended', handler);

    // Forward state_changed
    strategy.on('state_changed', (state) => {
      if (strategy === this.currentStrategy) {
        this.emit('state_changed', state);
      }
    });

    // Forward errors
    strategy.on('error', ({ message, recoverable }) => {
      log('error', message, { sourceType: type, recoverable });
      this.emit('error', { message, sourceType: type });
      if (!recoverable) {
        this.handleUnrecoverableError(type);
      }
    });

    // Forward auth_required
    strategy.on('auth_required', (payload) => {
      this.emit('error', {
        message: `Authentication required for ${payload.sourceType}`,
        sourceType: payload.sourceType,
      });
    });

    log('info', `Strategy registered: ${type}`);
  }

  // -----------------------------------------------------------------------
  // Core playback
  // -----------------------------------------------------------------------

  /** Play a single track, switching source if needed. */
  async playTrack(track: MediaTrack): Promise<void> {
    const strategy = this.getStrategy(track.sourceType);

    // Source switch
    if (this.currentStrategy && this.currentStrategy !== strategy) {
      await this.switchSource(strategy, track);
    } else {
      await this.activateAndPlay(strategy, track);
    }

    this.currentStrategy = strategy;
    const prevSource = this.currentSourceType;
    this.currentSourceType = track.sourceType;

    if (prevSource !== null && prevSource !== track.sourceType) {
      this.emit('source_switched', { from: prevSource, to: track.sourceType });
    }

    this.emit('track_changed', track);
    this.schedulePreload();
  }

  /** Set a queue and start playing from the given index. */
  async playQueue(tracks: MediaTrack[], startIndex = 0): Promise<void> {
    if (tracks.length === 0) return;
    this.queue = [...tracks];
    this.currentIndex = Math.min(startIndex, tracks.length - 1);
    if (this.shuffleEnabled) this.generateShuffleOrder();
    this.emitQueueChanged();
    await this.playTrack(this.currentQueueTrack()!);
  }

  async togglePlayPause(): Promise<void> {
    if (!this.currentStrategy) return;
    const state = this.currentStrategy.getState();
    if (state?.isPlaying) {
      await this.currentStrategy.pause();
    } else {
      await this.currentStrategy.resume();
    }
  }

  async skipNext(): Promise<void> {
    const nextIndex = this.getNextIndex();
    if (nextIndex === null) return;
    this.currentIndex = nextIndex;
    this.emitQueueChanged();
    await this.playTrack(this.currentQueueTrack()!);
  }

  async skipPrevious(): Promise<void> {
    // If past 3s, restart current track
    const state = this.currentStrategy?.getState();
    if (state && state.position > 3000) {
      await this.currentStrategy!.seek(0);
      return;
    }

    const prevIndex = this.getPreviousIndex();
    if (prevIndex === null) return;
    this.currentIndex = prevIndex;
    this.emitQueueChanged();
    await this.playTrack(this.currentQueueTrack()!);
  }

  async seek(positionMs: number): Promise<void> {
    await this.currentStrategy?.seek(positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    const clamped = Math.max(0, Math.min(1, volume));
    // Set on the active strategy
    await this.currentStrategy?.setVolume(clamped);
  }

  // -----------------------------------------------------------------------
  // Queue management
  // -----------------------------------------------------------------------

  addToQueue(tracks: MediaTrack[]): void {
    this.queue.push(...tracks);
    if (this.shuffleEnabled) this.generateShuffleOrder();
    this.emitQueueChanged();
  }

  removeFromQueue(index: number): void {
    if (index < 0 || index >= this.queue.length) return;

    this.queue.splice(index, 1);
    // Adjust currentIndex if needed
    if (index < this.currentIndex) {
      this.currentIndex--;
    } else if (index === this.currentIndex) {
      // Currently playing track was removed — play next if available
      if (this.currentIndex >= this.queue.length) {
        this.currentIndex = this.queue.length - 1;
      }
    }

    if (this.shuffleEnabled) this.generateShuffleOrder();
    this.emitQueueChanged();
  }

  reorderQueue(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 || fromIndex >= this.queue.length ||
      toIndex < 0 || toIndex >= this.queue.length ||
      fromIndex === toIndex
    ) return;

    const [item] = this.queue.splice(fromIndex, 1);
    this.queue.splice(toIndex, 0, item);

    // Adjust currentIndex
    if (fromIndex === this.currentIndex) {
      this.currentIndex = toIndex;
    } else if (fromIndex < this.currentIndex && toIndex >= this.currentIndex) {
      this.currentIndex--;
    } else if (fromIndex > this.currentIndex && toIndex <= this.currentIndex) {
      this.currentIndex++;
    }

    this.emitQueueChanged();
  }

  clearQueue(): void {
    this.queue = [];
    this.currentIndex = -1;
    this.shuffleOrder = [];
    this.emitQueueChanged();
  }

  getQueue(): MediaTrack[] {
    return [...this.queue];
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getCurrentTrack(): MediaTrack | null {
    return this.currentQueueTrack();
  }

  getPlaybackState(): PlaybackState {
    return this.currentStrategy?.getState() ?? { ...EMPTY_PLAYBACK_STATE };
  }

  // -----------------------------------------------------------------------
  // Shuffle
  // -----------------------------------------------------------------------

  setShuffleEnabled(enabled: boolean): void {
    this.shuffleEnabled = enabled;
    if (enabled) {
      this.generateShuffleOrder();
    } else {
      this.shuffleOrder = [];
    }
  }

  isShuffleEnabled(): boolean {
    return this.shuffleEnabled;
  }

  // -----------------------------------------------------------------------
  // Crossfade
  // -----------------------------------------------------------------------

  enableCrossfade(durationSeconds: number): void {
    this.config.crossfadeDuration = Math.max(0, Math.min(12, durationSeconds));
    log('info', `Crossfade set to ${this.config.crossfadeDuration}s`);
  }

  getCrossfadeDuration(): number {
    return this.config.crossfadeDuration;
  }

  // -----------------------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------------------

  getConfig(): Readonly<MediaRouterConfig> {
    return { ...this.config };
  }

  updateConfig(partial: Partial<MediaRouterConfig>): void {
    Object.assign(this.config, partial);
  }

  // -----------------------------------------------------------------------
  // Disposal
  // -----------------------------------------------------------------------

  async dispose(): Promise<void> {
    this.cancelPreload();
    this.warmTimers.forEach((t) => clearTimeout(t));
    this.warmTimers.clear();

    for (const [type, strategy] of this.strategies) {
      const handler = this.trackEndedHandlers.get(type);
      if (handler) strategy.off('track_ended', handler);
      await strategy.dispose();
    }

    this.strategies.clear();
    this.trackEndedHandlers.clear();
    this.listeners.clear();
    this.queue = [];
    this.currentIndex = -1;
    this.currentStrategy = null;
    this.currentSourceType = null;
  }

  // -----------------------------------------------------------------------
  // Events
  // -----------------------------------------------------------------------

  on<K extends MediaRouterEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off<K extends MediaRouterEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends MediaRouterEventName>(
    event: K,
    payload: MediaRouterEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // =======================================================================
  // Private internals
  // =======================================================================

  private getStrategy(type: MediaSourceType): MediaPlayerStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      throw new Error(
        `No strategy registered for source type "${type}". ` +
        `Register one with router.registerStrategy() before playback.`,
      );
    }
    return strategy;
  }

  /** Initialize and play on a strategy (no source-switch logic). */
  private async activateAndPlay(strategy: MediaPlayerStrategy, track: MediaTrack): Promise<void> {
    // Cancel any pending warm-disposal for this source
    const warmTimer = this.warmTimers.get(strategy.sourceType);
    if (warmTimer) {
      clearTimeout(warmTimer);
      this.warmTimers.delete(strategy.sourceType);
    }

    if (!strategy.isInitialized()) {
      await strategy.initialize();
    }

    await this.playWithRetry(strategy, track);
  }

  /** Switch from the current source to a new one, with optional crossfade. */
  private async switchSource(nextStrategy: MediaPlayerStrategy, track: MediaTrack): Promise<void> {
    const prevStrategy = this.currentStrategy!;
    const prevSource = prevStrategy.sourceType;
    const crossfadeDuration = this.config.crossfadeDuration * 1000;

    // Cancel any pending warm-disposal for the next source
    const warmTimer = this.warmTimers.get(nextStrategy.sourceType);
    if (warmTimer) {
      clearTimeout(warmTimer);
      this.warmTimers.delete(nextStrategy.sourceType);
    }

    if (!nextStrategy.isInitialized()) {
      await nextStrategy.initialize();
    }

    if (crossfadeDuration > 0 && prevStrategy.getState()?.isPlaying) {
      // Cross-source crossfade
      this.crossfadeActive = true;
      this.emit('crossfade_start', {
        outgoing: prevStrategy.getState()!.track!,
        incoming: track,
      });

      // Start the next track at volume 0
      await nextStrategy.setVolume(0);
      await this.playWithRetry(nextStrategy, track);

      // Fade both simultaneously
      await Promise.all([
        prevStrategy.fadeVolume(0, crossfadeDuration),
        nextStrategy.fadeVolume(this.currentStrategy?.getState()?.volume ?? 1, crossfadeDuration),
      ]);

      await prevStrategy.pause();
      this.crossfadeActive = false;
    } else {
      // No crossfade — just pause old, start new
      await prevStrategy.pause();
      await this.playWithRetry(nextStrategy, track);
    }

    // Schedule warm disposal of the previous strategy
    this.scheduleWarmDisposal(prevSource);
  }

  /** Play with exponential-backoff retry. */
  private async playWithRetry(strategy: MediaPlayerStrategy, track: MediaTrack): Promise<void> {
    let attempt = 0;
    while (attempt <= this.config.maxRetries) {
      try {
        await strategy.play(track);
        return;
      } catch (err) {
        attempt++;
        const message = err instanceof Error ? err.message : String(err);
        log('warn', `Play attempt ${attempt} failed: ${message}`, {
          trackId: track.id,
          sourceType: track.sourceType,
        });

        if (attempt > this.config.maxRetries) {
          log('error', `All ${this.config.maxRetries} retries exhausted`, { trackId: track.id });
          this.emit('error', {
            message: `Failed to play "${track.title}": ${message}`,
            sourceType: track.sourceType,
          });
          // Try skipping to next track
          this.trySkipOnError();
          return;
        }

        const delay = this.config.retryBaseDelay * Math.pow(2, attempt - 1);
        await new Promise<void>((r) => setTimeout(r, delay));
      }
    }
  }

  /** After a playback failure, try advancing the queue. */
  private trySkipOnError(): void {
    const nextIndex = this.getNextIndex();
    if (nextIndex !== null) {
      log('info', 'Skipping to next track after playback failure');
      this.currentIndex = nextIndex;
      this.emitQueueChanged();
      const track = this.currentQueueTrack();
      if (track) {
        this.playTrack(track).catch(() => {});
      }
    }
  }

  // -----------------------------------------------------------------------
  // Track-ended handler
  // -----------------------------------------------------------------------

  private handleTrackEnded(): void {
    // Don't auto-advance if crossfade is in progress (it manages its own flow)
    if (this.crossfadeActive) return;

    const nextIndex = this.getNextIndex();
    if (nextIndex === null) {
      // Queue exhausted
      log('info', 'Queue ended');
      return;
    }

    this.currentIndex = nextIndex;
    this.emitQueueChanged();
    const track = this.currentQueueTrack();
    if (track) {
      this.playTrack(track).catch((err) => {
        log('error', 'Failed to auto-advance', { error: String(err) });
      });
    }
  }

  // -----------------------------------------------------------------------
  // Preloading
  // -----------------------------------------------------------------------

  /** Schedule preload of the next track N seconds before current ends. */
  private schedulePreload(): void {
    this.cancelPreload();

    const state = this.currentStrategy?.getState();
    if (!state || state.duration === 0) return;

    const remaining = state.duration - state.position;
    const preloadAt = remaining - this.config.preloadAheadSeconds * 1000;

    if (preloadAt <= 0) {
      // Already close to end — preload immediately
      this.preloadNext();
      return;
    }

    this.preloadTimer = setTimeout(() => this.preloadNext(), preloadAt);
  }

  private preloadNext(): void {
    const nextIndex = this.getNextIndex();
    if (nextIndex === null) return;

    const nextTrack = this.queue[nextIndex];
    if (!nextTrack) return;

    const nextStrategy = this.strategies.get(nextTrack.sourceType);
    if (nextStrategy && !nextStrategy.isInitialized()) {
      // Eagerly initialize the next strategy so it's ready
      nextStrategy.initialize().catch((err) => {
        log('warn', `Preload init failed for ${nextTrack.sourceType}`, { error: String(err) });
      });
    }
  }

  private cancelPreload(): void {
    if (this.preloadTimer) {
      clearTimeout(this.preloadTimer);
      this.preloadTimer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Warm disposal
  // -----------------------------------------------------------------------

  private scheduleWarmDisposal(sourceType: MediaSourceType): void {
    // Clear any existing timer
    const existing = this.warmTimers.get(sourceType);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.warmTimers.delete(sourceType);
      // Don't dispose if this is now the current strategy again
      if (this.currentSourceType !== sourceType) {
        const strategy = this.strategies.get(sourceType);
        if (strategy?.isInitialized()) {
          log('info', `Warm-disposing ${sourceType} player`);
          strategy.dispose().catch(() => {});
        }
      }
    }, this.config.playerWarmTimeout);

    this.warmTimers.set(sourceType, timer);
  }

  // -----------------------------------------------------------------------
  // Unrecoverable errors
  // -----------------------------------------------------------------------

  private handleUnrecoverableError(sourceType: MediaSourceType): void {
    log('error', `Unrecoverable error from ${sourceType} — disabling source`);
    // Don't dispose the strategy (user might re-auth), but skip the current
    // track if it's from this source
    const current = this.currentQueueTrack();
    if (current?.sourceType === sourceType) {
      this.trySkipOnError();
    }
  }

  // -----------------------------------------------------------------------
  // Queue index helpers
  // -----------------------------------------------------------------------

  private currentQueueTrack(): MediaTrack | null {
    if (this.currentIndex < 0 || this.currentIndex >= this.queue.length) return null;
    return this.queue[this.currentIndex];
  }

  private getNextIndex(): number | null {
    if (this.queue.length === 0) return null;

    if (this.shuffleEnabled && this.shuffleOrder.length > 0) {
      const shufflePos = this.shuffleOrder.indexOf(this.currentIndex);
      const nextShufflePos = shufflePos + 1;
      if (nextShufflePos < this.shuffleOrder.length) {
        return this.shuffleOrder[nextShufflePos];
      }
      return null; // end of shuffled queue
    }

    const next = this.currentIndex + 1;
    return next < this.queue.length ? next : null;
  }

  private getPreviousIndex(): number | null {
    if (this.queue.length === 0) return null;

    if (this.shuffleEnabled && this.shuffleOrder.length > 0) {
      const shufflePos = this.shuffleOrder.indexOf(this.currentIndex);
      const prevShufflePos = shufflePos - 1;
      if (prevShufflePos >= 0) {
        return this.shuffleOrder[prevShufflePos];
      }
      return null;
    }

    const prev = this.currentIndex - 1;
    return prev >= 0 ? prev : null;
  }

  private generateShuffleOrder(): void {
    const indices = Array.from({ length: this.queue.length }, (_, i) => i);
    // Fisher–Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    // Move currentIndex to front so current track stays first
    if (this.currentIndex >= 0) {
      const pos = indices.indexOf(this.currentIndex);
      if (pos > 0) {
        [indices[0], indices[pos]] = [indices[pos], indices[0]];
      }
    }
    this.shuffleOrder = indices;
  }

  private emitQueueChanged(): void {
    this.emit('queue_changed', {
      queue: [...this.queue],
      currentIndex: this.currentIndex,
    });
  }
}
