// ============================================================================
// SpotifyWebPlayback – wraps the Spotify Web Playback SDK for Electron
// ============================================================================

import { TokenManager } from './TokenManager';
import type {
  UnifiedPlaybackState,
  UnifiedTrack,
  SpotifyPlayerEvents,
  SpotifyPlayerEventName,
} from '../../types/spotify';

// The SDK injects a global `Spotify` namespace. The ambient types from
// @types/spotify-web-playback-sdk augment Window with `Spotify` and
// `onSpotifyWebPlaybackSDKReady` – no extra declaration needed here.

type Listener<K extends SpotifyPlayerEventName> = (
  payload: SpotifyPlayerEvents[K],
) => void;

const DEVICE_NAME = "Brandon's Media Hub";
const INITIAL_VOLUME = 0.5;
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Reconnect backoff settings
const MAX_RECONNECT_ATTEMPTS = 8;
const INITIAL_BACKOFF_MS = 1_000;

export class SpotifyWebPlayback {
  private player: Spotify.Player | null = null;
  private deviceId: string | null = null;
  private tokenManager: TokenManager;
  private listeners = new Map<SpotifyPlayerEventName, Set<Listener<any>>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connected = false;
  private sdkReady = false;

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
  }

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Load the SDK script (if needed), create the player and connect. */
  async initialize(): Promise<void> {
    await this.ensureSdkLoaded();
    this.createPlayer();
    await this.connectPlayer();
  }

  /** Cleanly tear down the player and listeners. */
  disconnect(): void {
    this.clearReconnectTimer();

    if (this.player) {
      this.player.disconnect();
      this.player = null;
    }

    this.deviceId = null;
    this.connected = false;
    this.listeners.clear();
  }

  // -------------------------------------------------------------------------
  // Playback controls
  // -------------------------------------------------------------------------

  /** Play a Spotify URI (track, album, playlist, etc.). */
  async play(spotifyUri: string): Promise<void> {
    this.assertConnected();

    const token = await this.tokenManager.getAccessToken();

    const body: Record<string, unknown> = {};
    if (spotifyUri.includes(':track:')) {
      body.uris = [spotifyUri];
    } else {
      body.context_uri = spotifyUri;
    }

    const res = await fetch(
      `${SPOTIFY_API_BASE}/me/player/play?device_id=${this.deviceId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      throw new Error(`Spotify play failed: ${res.status} ${await res.text()}`);
    }
  }

  async pause(): Promise<void> {
    this.assertConnected();
    await this.player!.pause();
  }

  async resume(): Promise<void> {
    this.assertConnected();
    await this.player!.resume();
  }

  async seek(positionMs: number): Promise<void> {
    this.assertConnected();
    await this.player!.seek(positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    this.assertConnected();
    const clamped = Math.max(0, Math.min(1, volume));
    await this.player!.setVolume(clamped);
  }

  async skipNext(): Promise<void> {
    this.assertConnected();
    await this.player!.nextTrack();
  }

  async skipPrevious(): Promise<void> {
    this.assertConnected();
    await this.player!.previousTrack();
  }

  /** Get the current playback state in unified format, or null. */
  async getCurrentState(): Promise<UnifiedPlaybackState | null> {
    if (!this.player) return null;
    const state = await this.player.getCurrentState();
    if (!state) return null;
    return SpotifyWebPlayback.toUnifiedState(state);
  }

  /** Return the Spotify Connect device ID (available after 'ready'). */
  getDeviceId(): string | null {
    return this.deviceId;
  }

  // -------------------------------------------------------------------------
  // Event emitter
  // -------------------------------------------------------------------------

  on<K extends SpotifyPlayerEventName>(
    event: K,
    listener: Listener<K>,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends SpotifyPlayerEventName>(
    event: K,
    listener: Listener<K>,
  ): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends SpotifyPlayerEventName>(
    event: K,
    payload: SpotifyPlayerEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // -------------------------------------------------------------------------
  // SDK bootstrapping
  // -------------------------------------------------------------------------

  private ensureSdkLoaded(): Promise<void> {
    if (this.sdkReady && window.Spotify) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      // If the script tag already exists, just wait for the callback.
      if (document.querySelector('script[src*="spotify-player"]')) {
        if (window.Spotify) {
          this.sdkReady = true;
          resolve();
          return;
        }
        window.onSpotifyWebPlaybackSDKReady = () => {
          this.sdkReady = true;
          resolve();
        };
        return;
      }

      window.onSpotifyWebPlaybackSDKReady = () => {
        this.sdkReady = true;
        resolve();
      };

      const script = document.createElement('script');
      script.src = 'https://sdk.scdn.co/spotify-player.js';
      script.async = true;
      script.onerror = () =>
        reject(new Error('Failed to load Spotify Web Playback SDK script'));
      document.body.appendChild(script);
    });
  }

  // -------------------------------------------------------------------------
  // Player creation & connection
  // -------------------------------------------------------------------------

  private createPlayer(): void {
    if (!window.Spotify) {
      throw new Error('Spotify SDK not loaded');
    }

    this.player = new window.Spotify.Player({
      name: DEVICE_NAME,
      getOAuthToken: (cb) => {
        this.tokenManager
          .getAccessToken()
          .then(cb)
          .catch(() => {
            this.emit('authentication_error', {
              message: 'Failed to retrieve access token',
            });
          });
      },
      volume: INITIAL_VOLUME,
    });

    this.attachListeners();
  }

  private connectPlayer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.player) {
        reject(new Error('Player not created'));
        return;
      }

      this.player.connect().then((success) => {
        if (success) {
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve();
        } else {
          reject(new Error('Spotify player connect() returned false'));
        }
      });
    });
  }

  private attachListeners(): void {
    const p = this.player!;

    p.addListener('ready', ({ device_id }) => {
      this.deviceId = device_id;
      this.emit('ready', { device_id });
    });

    p.addListener('not_ready', ({ device_id }) => {
      this.deviceId = null;
      this.emit('not_ready', { device_id });
    });

    p.addListener('player_state_changed', (state) => {
      const unified = state
        ? SpotifyWebPlayback.toUnifiedState(state)
        : null;
      this.emit('player_state_changed', unified);
    });

    p.addListener('initialization_error', ({ message }) => {
      this.emit('initialization_error', { message });
    });

    p.addListener('authentication_error', ({ message }) => {
      this.emit('authentication_error', { message });
      this.handleAuthError();
    });

    p.addListener('account_error', ({ message }) => {
      this.emit('account_error', {
        message: message || 'Spotify Premium is required for playback',
      });
    });

    p.addListener('playback_error', ({ message }) => {
      this.emit('playback_error', { message });
    });
  }

  // -------------------------------------------------------------------------
  // Error recovery
  // -------------------------------------------------------------------------

  private async handleAuthError(): Promise<void> {
    try {
      await this.tokenManager.refresh();
      // The SDK will call getOAuthToken again on next action, which will
      // now return the refreshed token.
    } catch {
      this.emit('authentication_error', {
        message:
          'Token refresh failed. Please re-authenticate with Spotify.',
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('playback_error', {
        message: `Unable to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`,
      });
      return;
    }

    const delay =
      INITIAL_BACKOFF_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      try {
        this.createPlayer();
        await this.connectPlayer();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private assertConnected(): void {
    if (!this.player || !this.connected) {
      throw new Error(
        'Player is not connected. Call initialize() first.',
      );
    }
  }

  /** Map the SDK's Spotify.PlaybackState to our UnifiedPlaybackState. */
  static toUnifiedState(state: Spotify.PlaybackState): UnifiedPlaybackState {
    const current = state.track_window.current_track;
    const track: UnifiedTrack = {
      id: current.id ?? '',
      title: current.name,
      artist: current.artists.map((a) => a.name).join(', '),
      album: current.album.name,
      artwork:
        current.album.images.length > 0
          ? current.album.images[0].url
          : null,
      uri: current.uri,
    };

    return {
      isPlaying: !state.paused,
      position: state.position,
      duration: state.duration,
      track,
      canSkipNext: !state.disallows?.skipping_next,
      canSkipPrevious: !state.disallows?.skipping_prev,
      canSeek: !state.disallows?.seeking,
    };
  }
}
