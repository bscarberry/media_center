// ============================================================================
// YouTubeIFramePlayer – Option A: official YouTube IFrame Player API
// ============================================================================
//
// Embeds the YouTube player in a hidden DOM element and exposes unified
// playback controls. Per YouTube ToS the player element must exist in the
// DOM (even if visually hidden) and branding must remain accessible.
//
// Reference: https://developers.google.com/youtube/iframe_api_reference
// ============================================================================

import type {
  YTPlayerInstance,
  YTPlayerOptions,
  YTPlayerState,
  YouTubePlayerEvents,
  YouTubePlayerEventName,
} from '../../types/youtube';
import type { UnifiedPlaybackState, UnifiedTrack } from '../../types/spotify';

type Listener<K extends YouTubePlayerEventName> = (
  payload: YouTubePlayerEvents[K],
) => void;

const PLAYER_ELEMENT_ID = 'yt-iframe-player';
const POLL_INTERVAL_MS = 500; // position polling

export class YouTubeIFramePlayer {
  private player: YTPlayerInstance | null = null;
  private listeners = new Map<YouTubePlayerEventName, Set<Listener<any>>>();
  private positionTimer: ReturnType<typeof setInterval> | null = null;
  private sdkReady = false;
  private currentVideoId: string | null = null;
  private volume = 50; // 0-100

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  /** Load the IFrame API script and create the player element. */
  async initialize(): Promise<void> {
    this.ensurePlayerElement();
    await this.loadSdk();
    this.createPlayer();
  }

  /** Destroy the player and stop polling. */
  disconnect(): void {
    this.stopPositionPolling();
    if (this.player) {
      this.player.destroy();
      this.player = null;
    }
    this.currentVideoId = null;
    this.listeners.clear();

    const el = document.getElementById(PLAYER_ELEMENT_ID);
    if (el) el.remove();
  }

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  play(videoId: string): void {
    this.assertReady();
    this.currentVideoId = videoId;
    this.player!.loadVideoById(videoId);
  }

  pause(): void {
    this.assertReady();
    this.player!.pauseVideo();
  }

  resume(): void {
    this.assertReady();
    this.player!.playVideo();
  }

  seek(positionMs: number): void {
    this.assertReady();
    this.player!.seekTo(positionMs / 1000, true);
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.volume = Math.round(clamped * 100);
    if (this.player) {
      this.player.setVolume(this.volume);
    }
  }

  /** Get current state in unified format. */
  getCurrentState(): UnifiedPlaybackState | null {
    if (!this.player || !this.currentVideoId) return null;

    const state = this.player.getPlayerState();
    const videoData = this.player.getVideoData();

    const track: UnifiedTrack = {
      id: this.currentVideoId,
      title: videoData.title || '',
      artist: videoData.author || '',
      album: '',
      artwork: `https://i.ytimg.com/vi/${this.currentVideoId}/hqdefault.jpg`,
      uri: `youtube:video:${this.currentVideoId}`,
    };

    const YTState = {
      PLAYING: 1,
      PAUSED: 2,
    };

    return {
      isPlaying: state === YTState.PLAYING,
      position: Math.round(this.player.getCurrentTime() * 1000),
      duration: Math.round(this.player.getDuration() * 1000),
      track,
      canSkipNext: true,
      canSkipPrevious: true,
      canSeek: true,
    };
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  on<K extends YouTubePlayerEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off<K extends YouTubePlayerEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends YouTubePlayerEventName>(
    event: K,
    payload: YouTubePlayerEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // -----------------------------------------------------------------------
  // SDK bootstrap
  // -----------------------------------------------------------------------

  private loadSdk(): Promise<void> {
    if (this.sdkReady && window.YT) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      if (window.YT?.Player) {
        this.sdkReady = true;
        resolve();
        return;
      }

      if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        // Script already loading — just wait for the callback
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = () => {
          prev?.();
          this.sdkReady = true;
          resolve();
        };
        return;
      }

      window.onYouTubeIframeAPIReady = () => {
        this.sdkReady = true;
        resolve();
      };

      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () =>
        reject(new Error('Failed to load YouTube IFrame API'));
      document.head.appendChild(script);
    });
  }

  private ensurePlayerElement(): void {
    if (document.getElementById(PLAYER_ELEMENT_ID)) return;

    const div = document.createElement('div');
    div.id = PLAYER_ELEMENT_ID;
    // Hidden but present in DOM (YouTube ToS requires the player element to exist)
    div.style.cssText =
      'position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(div);
  }

  private createPlayer(): void {
    if (!window.YT) throw new Error('YouTube IFrame API not loaded');

    const options: YTPlayerOptions = {
      width: 1,
      height: 1,
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          this.player!.setVolume(this.volume);
          this.emit('ready', undefined as never);
        },
        onStateChange: (event) => {
          this.handleStateChange(event.data as unknown as number);
        },
        onError: (event) => {
          const code = event.data;
          const messages: Record<number, string> = {
            2: 'Invalid video ID',
            5: 'HTML5 player error',
            100: 'Video not found or removed',
            101: 'Video owner does not allow embedded playback',
            150: 'Video owner does not allow embedded playback',
          };
          this.emit('error', {
            code,
            message: messages[code] ?? `YouTube player error ${code}`,
          });
        },
      },
    };

    this.player = new window.YT.Player(PLAYER_ELEMENT_ID, options);
  }

  // -----------------------------------------------------------------------
  // State handling
  // -----------------------------------------------------------------------

  private handleStateChange(state: number): void {
    const PLAYING = 1;
    const PAUSED = 2;
    const ENDED = 0;

    if (state === PLAYING) {
      this.startPositionPolling();
    } else {
      this.stopPositionPolling();
    }

    if (state === PLAYING || state === PAUSED || state === ENDED) {
      this.emit('state_changed', this.getCurrentState());
    }
  }

  private startPositionPolling(): void {
    this.stopPositionPolling();
    this.positionTimer = setInterval(() => {
      this.emit('state_changed', this.getCurrentState());
    }, POLL_INTERVAL_MS);
  }

  private stopPositionPolling(): void {
    if (this.positionTimer !== null) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
  }

  private assertReady(): void {
    if (!this.player) {
      throw new Error('YouTube IFrame player not initialized.');
    }
  }
}
