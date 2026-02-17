// ============================================================================
// JellyfinAudioPlayer – Howler.js playback with gapless preload
// ============================================================================

import { Howl } from 'howler';
import { JellyfinClient } from './JellyfinClient';
import { JellyfinPlayer } from './JellyfinPlayer';
import type {
  JellyfinConfig,
  JellyfinItem,
  JellyfinPlayerEvents,
  JellyfinPlayerEventName,
} from '../../types/jellyfin';
import type { UnifiedPlaybackState, UnifiedTrack } from '../../types/spotify';

type Listener<K extends JellyfinPlayerEventName> = (
  payload: JellyfinPlayerEvents[K],
) => void;

const POSITION_POLL_MS = 500;
const PRELOAD_THRESHOLD_MS = 15_000; // preload next track 15s before end

// ---------------------------------------------------------------------------
// JellyfinAudioPlayer
// ---------------------------------------------------------------------------

export class JellyfinAudioPlayer {
  private client: JellyfinClient;
  private player: JellyfinPlayer;
  private listeners = new Map<JellyfinPlayerEventName, Set<Listener<any>>>();

  private currentHowl: Howl | null = null;
  private preloadedHowl: Howl | null = null;
  private preloadedItemId: string | null = null;
  private currentItem: JellyfinItem | null = null;
  private positionTimer: ReturnType<typeof setInterval> | null = null;
  private volume = 0.5; // 0-1
  private queue: JellyfinItem[] = [];
  private queueIndex = -1;

  constructor(client: JellyfinClient, config: JellyfinConfig) {
    this.client = client;
    this.player = new JellyfinPlayer(client, config);
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  disconnect(): void {
    this.stopPositionPolling();
    this.player.stopProgressReporting();

    if (this.currentHowl) {
      this.currentHowl.unload();
      this.currentHowl = null;
    }
    if (this.preloadedHowl) {
      this.preloadedHowl.unload();
      this.preloadedHowl = null;
      this.preloadedItemId = null;
    }
    this.currentItem = null;
    this.queue = [];
    this.queueIndex = -1;
    this.listeners.clear();
  }

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  /** Play a single item by its JellyfinItem. */
  play(item: JellyfinItem): void {
    this.stopCurrent();
    this.currentItem = item;

    // Check if this item was preloaded
    if (this.preloadedHowl && this.preloadedItemId === item.id) {
      this.currentHowl = this.preloadedHowl;
      this.preloadedHowl = null;
      this.preloadedItemId = null;
      this.currentHowl.play();
    } else {
      const url = this.player.getPlaybackUrl(item.id);
      this.currentHowl = this.createHowl(url);
      this.currentHowl.play();
    }

    this.startPositionPolling();
    this.player.startProgressReporting(
      item.id,
      () => this.getPositionMs(),
      () => this.isPaused(),
    );
    this.emitState();
  }

  /** Set a queue and start playing from the given index. */
  playQueue(items: JellyfinItem[], startIndex = 0): void {
    this.queue = [...items];
    this.queueIndex = startIndex;
    if (items.length > 0 && startIndex < items.length) {
      this.play(items[startIndex]);
    }
  }

  pause(): void {
    this.currentHowl?.pause();
    this.emitState();
  }

  resume(): void {
    this.currentHowl?.play();
    this.emitState();
  }

  seek(positionMs: number): void {
    if (this.currentHowl) {
      this.currentHowl.seek(positionMs / 1000);
      this.emitState();
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.currentHowl) {
      this.currentHowl.volume(this.volume);
    }
  }

  skipNext(): void {
    if (this.queueIndex < this.queue.length - 1) {
      this.queueIndex++;
      this.play(this.queue[this.queueIndex]);
    }
  }

  skipPrevious(): void {
    // If more than 3s into the track, restart; otherwise go to previous
    if (this.getPositionMs() > 3000 && this.currentHowl) {
      this.currentHowl.seek(0);
      this.emitState();
    } else if (this.queueIndex > 0) {
      this.queueIndex--;
      this.play(this.queue[this.queueIndex]);
    }
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------

  getCurrentState(): UnifiedPlaybackState | null {
    if (!this.currentHowl || !this.currentItem) return null;

    const track: UnifiedTrack = {
      id: this.currentItem.id,
      title: this.currentItem.title,
      artist: this.currentItem.artist,
      album: this.currentItem.album,
      artwork: this.currentItem.artwork,
      uri: `jellyfin:track:${this.currentItem.id}`,
    };

    return {
      isPlaying: this.currentHowl.playing(),
      position: this.getPositionMs(),
      duration: this.currentItem.duration,
      track,
      canSkipNext: this.queueIndex < this.queue.length - 1,
      canSkipPrevious: this.queueIndex > 0 || this.getPositionMs() > 3000,
      canSeek: true,
    };
  }

  getQueue(): JellyfinItem[] {
    return [...this.queue];
  }

  getQueueIndex(): number {
    return this.queueIndex;
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  on<K extends JellyfinPlayerEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off<K extends JellyfinPlayerEventName>(
    event: K,
    listener: Listener<K>,
  ): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends JellyfinPlayerEventName>(
    event: K,
    payload: JellyfinPlayerEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  private emitState(): void {
    this.emit('state_changed', this.getCurrentState());
  }

  // -----------------------------------------------------------------------
  // Howler internals
  // -----------------------------------------------------------------------

  private createHowl(url: string): Howl {
    const howl = new Howl({
      src: [url],
      html5: true, // streaming — don't load entire file into memory
      volume: this.volume,
      format: ['mp3', 'aac', 'ogg', 'flac', 'wav', 'webm', 'opus'],

      onplay: () => this.emitState(),
      onpause: () => this.emitState(),
      onstop: () => this.emitState(),
      onseek: () => this.emitState(),

      onend: () => {
        this.emit('track_ended', undefined as never);
        this.player.stopProgressReporting();

        // Auto-advance to next track in queue
        if (this.queueIndex < this.queue.length - 1) {
          this.queueIndex++;
          this.play(this.queue[this.queueIndex]);
        } else {
          this.stopPositionPolling();
          this.emitState();
        }
      },

      onloaderror: (_id, err) => {
        this.emit('error', {
          message: `Failed to load audio: ${String(err)}`,
        });
      },

      onplayerror: (_id, err) => {
        this.emit('error', {
          message: `Playback error: ${String(err)}`,
        });
        // Try to recover by restarting
        this.currentHowl?.once('unlock', () => {
          this.currentHowl?.play();
        });
      },
    });

    return howl;
  }

  /** Preload the next track in the queue for gapless playback. */
  private preloadNext(): void {
    const nextIndex = this.queueIndex + 1;
    if (nextIndex >= this.queue.length) return;

    const nextItem = this.queue[nextIndex];
    if (this.preloadedItemId === nextItem.id) return; // already preloaded

    // Unload any previous preload
    if (this.preloadedHowl) {
      this.preloadedHowl.unload();
    }

    const url = this.player.getPlaybackUrl(nextItem.id);
    this.preloadedHowl = new Howl({
      src: [url],
      html5: true,
      volume: this.volume,
      preload: true,
      format: ['mp3', 'aac', 'ogg', 'flac', 'wav', 'webm', 'opus'],
    });
    this.preloadedItemId = nextItem.id;
  }

  // -----------------------------------------------------------------------
  // Position polling + preload trigger
  // -----------------------------------------------------------------------

  private startPositionPolling(): void {
    this.stopPositionPolling();
    this.positionTimer = setInterval(() => {
      this.emitState();

      // Trigger preload when approaching end of track
      if (this.currentItem && this.currentHowl) {
        const remaining = this.currentItem.duration - this.getPositionMs();
        if (remaining > 0 && remaining <= PRELOAD_THRESHOLD_MS) {
          this.preloadNext();
        }
      }
    }, POSITION_POLL_MS);
  }

  private stopPositionPolling(): void {
    if (this.positionTimer !== null) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
  }

  private getPositionMs(): number {
    if (!this.currentHowl) return 0;
    const pos = this.currentHowl.seek();
    return typeof pos === 'number' ? Math.round(pos * 1000) : 0;
  }

  private isPaused(): boolean {
    return this.currentHowl ? !this.currentHowl.playing() : true;
  }

  private stopCurrent(): void {
    this.stopPositionPolling();
    this.player.stopProgressReporting();
    if (this.currentHowl) {
      this.currentHowl.unload();
      this.currentHowl = null;
    }
  }
}
