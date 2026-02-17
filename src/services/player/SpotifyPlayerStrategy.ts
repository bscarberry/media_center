// ============================================================================
// SpotifyPlayerStrategy – wraps SpotifyWebPlayback for the unified router
// ============================================================================

import { MediaPlayerStrategy } from './MediaPlayer';
import { SpotifyWebPlayback } from '../spotify/SpotifyWebPlayback';
import { TokenManager } from '../spotify/TokenManager';
import {
  MediaSourceType,
  EMPTY_PLAYBACK_STATE,
  type MediaTrack,
  type PlaybackState,
} from '../../types/media';
import type { UnifiedPlaybackState } from '../../types/spotify';

export interface SpotifyStrategyDeps {
  tokenManager: TokenManager;
}

export class SpotifyPlayerStrategy extends MediaPlayerStrategy {
  readonly sourceType = MediaSourceType.SPOTIFY;

  private player: SpotifyWebPlayback;
  private lastState: PlaybackState | null = null;
  private currentTrack: MediaTrack | null = null;

  constructor(deps: SpotifyStrategyDeps) {
    super();
    this.player = new SpotifyWebPlayback(deps.tokenManager);
  }

  // -- Lifecycle -----------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.player.on('ready', () => {
      this.initialized = true;
      this.emit('ready', undefined as never);
    });

    this.player.on('player_state_changed', (state) => {
      this.lastState = state ? this.toPlaybackState(state) : null;
      if (this.lastState) {
        this.emit('state_changed', this.lastState);
      }
      // Detect track end: state goes to paused at position 0 with no change pending
      if (state && state.position === 0 && !state.isPlaying && this.currentTrack) {
        this.emit('track_ended', undefined as never);
      }
    });

    this.player.on('authentication_error', ({ message }) => {
      this.emit('auth_required', { sourceType: MediaSourceType.SPOTIFY });
      this.emit('error', { message, recoverable: true });
    });

    this.player.on('playback_error', ({ message }) => {
      this.emit('error', { message, recoverable: true });
    });

    this.player.on('account_error', ({ message }) => {
      this.emit('error', { message, recoverable: false });
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
    // sourceId is a Spotify URI (e.g. "spotify:track:xxx")
    await this.player.play(track.sourceId);
  }

  async pause(): Promise<void> {
    await this.player.pause();
  }

  async resume(): Promise<void> {
    await this.player.resume();
  }

  async seek(positionMs: number): Promise<void> {
    await this.player.seek(positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    this.volume = Math.max(0, Math.min(1, volume));
    await this.player.setVolume(this.volume);
  }

  getState(): PlaybackState | null {
    return this.lastState;
  }

  /** Expose the underlying player for direct access when needed. */
  getPlayer(): SpotifyWebPlayback {
    return this.player;
  }

  // -- Helpers -------------------------------------------------------------

  private toPlaybackState(unified: UnifiedPlaybackState): PlaybackState {
    const track: MediaTrack = this.currentTrack ?? {
      id: `spotify:${unified.track.id}`,
      sourceType: MediaSourceType.SPOTIFY,
      sourceId: unified.track.uri,
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
