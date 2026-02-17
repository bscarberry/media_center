// ============================================================================
// JellyfinPlayerStrategy – wraps JellyfinAudioPlayer for the unified router
// ============================================================================

import { MediaPlayerStrategy } from './MediaPlayer';
import { JellyfinClient } from '../jellyfin/JellyfinClient';
import { JellyfinAudioPlayer } from '../jellyfin/JellyfinAudioPlayer';
import {
  MediaSourceType,
  type MediaTrack,
  type PlaybackState,
} from '../../types/media';
import type { JellyfinConfig, JellyfinItem } from '../../types/jellyfin';
import type { UnifiedPlaybackState } from '../../types/spotify';

export interface JellyfinStrategyDeps {
  client: JellyfinClient;
  config: JellyfinConfig;
}

export class JellyfinPlayerStrategy extends MediaPlayerStrategy {
  readonly sourceType = MediaSourceType.JELLYFIN;

  private player: JellyfinAudioPlayer;
  private client: JellyfinClient;
  private lastState: PlaybackState | null = null;
  private currentTrack: MediaTrack | null = null;

  /** Cache sourceId → JellyfinItem so the router doesn't need to know about JellyfinItem. */
  private itemCache = new Map<string, JellyfinItem>();

  constructor(deps: JellyfinStrategyDeps) {
    super();
    this.client = deps.client;
    this.player = new JellyfinAudioPlayer(deps.client, deps.config);
  }

  // -- Lifecycle -----------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.player.on('state_changed', (state) => {
      this.lastState = state ? this.toPlaybackState(state) : null;
      if (this.lastState) {
        this.emit('state_changed', this.lastState);
      }
    });

    this.player.on('track_ended', () => {
      this.emit('track_ended', undefined as never);
    });

    this.player.on('error', ({ message }) => {
      this.emit('error', { message, recoverable: true });
    });

    this.player.on('auth_error', ({ message }) => {
      this.emit('auth_required', { sourceType: MediaSourceType.JELLYFIN });
      this.emit('error', { message, recoverable: true });
    });

    this.player.on('connection_lost', () => {
      this.emit('error', {
        message: 'Connection to Jellyfin server lost',
        recoverable: true,
      });
    });

    this.initialized = true;
    this.emit('ready', undefined as never);
  }

  async dispose(): Promise<void> {
    this.player.disconnect();
    this.initialized = false;
    this.lastState = null;
    this.currentTrack = null;
    this.itemCache.clear();
  }

  // -- Playback ------------------------------------------------------------

  async play(track: MediaTrack): Promise<void> {
    if (!this.initialized) await this.initialize();
    this.currentTrack = track;

    const item = this.resolveItem(track);
    this.player.play(item);
  }

  async pause(): Promise<void> {
    this.player.pause();
  }

  async resume(): Promise<void> {
    this.player.resume();
  }

  async seek(positionMs: number): Promise<void> {
    this.player.seek(positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(1, volume));
    this.player.setVolume(this.volume);
  }

  getState(): PlaybackState | null {
    const unified = this.player.getCurrentState();
    if (!unified) return this.lastState;
    return this.toPlaybackState(unified);
  }

  /** Expose the underlying player for direct access when needed. */
  getPlayer(): JellyfinAudioPlayer {
    return this.player;
  }

  /** Cache a JellyfinItem so it can be resolved from a MediaTrack. */
  cacheItem(item: JellyfinItem): void {
    this.itemCache.set(item.id, item);
  }

  // -- Helpers -------------------------------------------------------------

  private resolveItem(track: MediaTrack): JellyfinItem {
    const cached = this.itemCache.get(track.sourceId);
    if (cached) return cached;

    // Construct a minimal JellyfinItem from the MediaTrack
    return {
      id: track.sourceId,
      title: track.title,
      artist: track.artist,
      album: track.album ?? '',
      duration: track.duration,
      artwork: track.artwork,
      year: null,
      genre: track.genres ?? [],
      bitrate: null,
      codec: null,
    };
  }

  private toPlaybackState(unified: UnifiedPlaybackState): PlaybackState {
    const track: MediaTrack = this.currentTrack ?? {
      id: `jellyfin:${unified.track.id}`,
      sourceType: MediaSourceType.JELLYFIN,
      sourceId: unified.track.id,
      title: unified.track.title,
      artist: unified.track.artist,
      album: unified.track.album,
      duration: unified.duration,
      artwork: unified.track.artwork,
      isPlayable: true,
      requiresAuth: true,
    };

    return {
      track,
      isPlaying: unified.isPlaying,
      buffering: false,
      position: unified.position,
      duration: unified.duration,
      volume: this.volume,
      canSkipNext: unified.canSkipNext,
      canSkipPrevious: unified.canSkipPrevious,
      canSeek: unified.canSeek,
    };
  }
}
