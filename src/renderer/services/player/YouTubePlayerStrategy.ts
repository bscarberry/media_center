// ============================================================================
// YouTubePlayerStrategy – wraps YouTubePlayer for the unified router
// ============================================================================

import { MediaPlayerStrategy } from './MediaPlayer';
import { YouTubePlayer } from '../youtube/YouTubePlayer';
import {
  MediaSourceType,
  type MediaTrack,
  type PlaybackState,
} from '../../types/media';
import type { UnifiedPlaybackState } from '../../types/spotify';
import type { YouTubePlaybackMode } from '../../types/youtube';

export interface YouTubeStrategyDeps {
  mode?: YouTubePlaybackMode;
}

export class YouTubePlayerStrategy extends MediaPlayerStrategy {
  readonly sourceType = MediaSourceType.YOUTUBE;

  private player: YouTubePlayer;
  private lastState: PlaybackState | null = null;
  private currentTrack: MediaTrack | null = null;

  constructor(deps?: YouTubeStrategyDeps) {
    super();
    this.player = new YouTubePlayer(deps?.mode ?? 'iframe');
  }

  // -- Lifecycle -----------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.player.on('ready', () => {
      this.initialized = true;
      this.emit('ready', undefined as never);
    });

    this.player.on('state_changed', (state) => {
      this.lastState = state ? this.toPlaybackState(state) : null;
      if (this.lastState) {
        this.emit('state_changed', this.lastState);
      }
      // Detect track end: position ≈ duration and not playing
      if (state && !state.isPlaying && state.duration > 0 && state.position >= state.duration - 500) {
        this.emit('track_ended', undefined as never);
      }
    });

    this.player.on('error', ({ message }) => {
      this.emit('error', { message, recoverable: true });
    });

    await this.player.initialize();
  }

  async dispose(): Promise<void> {
    this.player.disconnect();
    this.initialized = false;
    this.lastState = null;
    this.currentTrack = null;
  }

  // -- Playback ------------------------------------------------------------

  async play(track: MediaTrack): Promise<void> {
    if (!this.initialized) await this.initialize();
    this.currentTrack = track;
    // sourceId is a YouTube video ID
    await this.player.play(track.sourceId, track.title, track.artist);
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
  getPlayer(): YouTubePlayer {
    return this.player;
  }

  // -- Helpers -------------------------------------------------------------

  private toPlaybackState(unified: UnifiedPlaybackState): PlaybackState {
    const track: MediaTrack = this.currentTrack ?? {
      id: `youtube:${unified.track.id}`,
      sourceType: MediaSourceType.YOUTUBE,
      sourceId: unified.track.id,
      title: unified.track.title,
      artist: unified.track.artist,
      album: unified.track.album,
      duration: unified.duration,
      artwork: unified.track.artwork,
      isPlayable: true,
      requiresAuth: false,
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
