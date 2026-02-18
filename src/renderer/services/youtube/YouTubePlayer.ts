// ============================================================================
// YouTubePlayer – unified player with iframe / audio-extract mode switching
// ============================================================================

import { YouTubeIFramePlayer } from './YouTubeIFramePlayer';
import { YouTubeAudioExtractor } from './YouTubeAudioExtractor';
import type {
  YouTubePlaybackMode,
  YouTubePlayerEvents,
  YouTubePlayerEventName,
} from '../../types/youtube';
import type { UnifiedPlaybackState, UnifiedTrack } from '../../types/spotify';

type Listener<K extends YouTubePlayerEventName> = (
  payload: YouTubePlayerEvents[K],
) => void;

export class YouTubePlayer {
  private mode: YouTubePlaybackMode;
  private iframePlayer: YouTubeIFramePlayer;
  private extractor: YouTubeAudioExtractor;
  private listeners = new Map<YouTubePlayerEventName, Set<Listener<any>>>();

  // HTML5 audio element used in extract mode
  private audioEl: HTMLAudioElement | null = null;
  private currentVideoId: string | null = null;
  private currentMeta: { title: string; artist: string } | null = null;
  private positionTimer: ReturnType<typeof setInterval> | null = null;

  constructor(mode: YouTubePlaybackMode = 'iframe') {
    this.mode = mode;
    this.iframePlayer = new YouTubeIFramePlayer();
    this.extractor = new YouTubeAudioExtractor();
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.mode === 'iframe') {
      await this.iframePlayer.initialize();
      // Forward iframe events
      this.iframePlayer.on('ready', () => this.emit('ready', undefined as never));
      this.iframePlayer.on('state_changed', (s) => this.emit('state_changed', s));
      this.iframePlayer.on('error', (e) => this.emit('error', e));
    } else {
      // Extract mode: create an HTML5 audio element
      this.audioEl = new Audio();
      this.audioEl.volume = 0.5;
      this.attachAudioListeners();
      this.emit('ready', undefined as never);
    }
  }

  disconnect(): void {
    this.stopPositionPolling();
    this.iframePlayer.disconnect();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
    this.currentVideoId = null;
    this.currentMeta = null;
    this.listeners.clear();
  }

  // -----------------------------------------------------------------------
  // Mode switching
  // -----------------------------------------------------------------------

  async setMode(newMode: YouTubePlaybackMode): Promise<void> {
    if (newMode === this.mode) return;

    // Tear down current player
    const wasPlaying = this.getCurrentState()?.isPlaying ?? false;
    const position = this.getCurrentState()?.position ?? 0;
    const videoId = this.currentVideoId;

    if (this.mode === 'iframe') {
      this.iframePlayer.disconnect();
    } else {
      this.stopPositionPolling();
      if (this.audioEl) {
        this.audioEl.pause();
        this.audioEl.src = '';
      }
    }

    this.mode = newMode;
    await this.initialize();
    this.emit('mode_changed', { mode: newMode });

    // Resume playback at same position if possible
    if (videoId && wasPlaying) {
      await this.play(videoId, this.currentMeta?.title, this.currentMeta?.artist);
      this.seek(position);
    }
  }

  getMode(): YouTubePlaybackMode {
    return this.mode;
  }

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  async play(videoId: string, title?: string, artist?: string): Promise<void> {
    this.currentVideoId = videoId;
    this.currentMeta = { title: title ?? '', artist: artist ?? '' };

    if (this.mode === 'iframe') {
      this.iframePlayer.play(videoId);
    } else {
      await this.playViaExtractor(videoId);
    }
  }

  pause(): void {
    if (this.mode === 'iframe') {
      this.iframePlayer.pause();
    } else if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  resume(): void {
    if (this.mode === 'iframe') {
      this.iframePlayer.resume();
    } else if (this.audioEl) {
      this.audioEl.play().catch(() => {});
    }
  }

  seek(positionMs: number): void {
    if (this.mode === 'iframe') {
      this.iframePlayer.seek(positionMs);
    } else if (this.audioEl) {
      this.audioEl.currentTime = positionMs / 1000;
    }
  }

  setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    if (this.mode === 'iframe') {
      this.iframePlayer.setVolume(clamped);
    } else if (this.audioEl) {
      this.audioEl.volume = clamped;
    }
  }

  getCurrentState(): UnifiedPlaybackState | null {
    if (this.mode === 'iframe') {
      return this.iframePlayer.getCurrentState();
    }
    return this.getAudioElState();
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
  // Extract-mode internals
  // -----------------------------------------------------------------------

  private async playViaExtractor(videoId: string): Promise<void> {
    if (!this.audioEl) {
      throw new Error('Audio element not initialized.');
    }

    try {
      const stream = await this.extractor.getAudioStream(videoId);
      this.audioEl.src = stream.url;
      await this.audioEl.play();
    } catch (err) {
      // Fallback: try iframe if extraction fails
      const message =
        err instanceof Error ? err.message : 'Extraction failed';
      this.emit('error', { code: -1, message: `Extract failed: ${message}. Falling back to iframe.` });

      await this.setMode('iframe');
      this.iframePlayer.play(videoId);
    }
  }

  private attachAudioListeners(): void {
    if (!this.audioEl) return;
    const a = this.audioEl;

    a.addEventListener('playing', () => {
      this.startPositionPolling();
      this.emit('state_changed', this.getAudioElState());
    });

    a.addEventListener('pause', () => {
      this.stopPositionPolling();
      this.emit('state_changed', this.getAudioElState());
    });

    a.addEventListener('ended', () => {
      this.stopPositionPolling();
      this.emit('state_changed', this.getAudioElState());
    });

    a.addEventListener('error', () => {
      const videoId = this.currentVideoId;
      if (videoId && !this.extractor.isUrlValid(videoId)) {
        this.emit('url_expired', { videoId });
        // Auto-refresh the URL and retry
        this.playViaExtractor(videoId).catch(() => {});
      } else {
        this.emit('error', { code: -1, message: 'Audio playback error' });
      }
    });
  }

  private getAudioElState(): UnifiedPlaybackState | null {
    if (!this.audioEl || !this.currentVideoId) return null;

    const track: UnifiedTrack = {
      id: this.currentVideoId,
      title: this.currentMeta?.title ?? '',
      artist: this.currentMeta?.artist ?? '',
      album: '',
      artwork: `https://i.ytimg.com/vi/${this.currentVideoId}/hqdefault.jpg`,
      uri: `youtube:video:${this.currentVideoId}`,
    };

    return {
      isPlaying: !this.audioEl.paused && !this.audioEl.ended,
      position: Math.round(this.audioEl.currentTime * 1000),
      duration: Math.round((this.audioEl.duration || 0) * 1000),
      track,
      canSkipNext: true,
      canSkipPrevious: true,
      canSeek: true,
    };
  }

  private startPositionPolling(): void {
    this.stopPositionPolling();
    this.positionTimer = setInterval(() => {
      this.emit('state_changed', this.getAudioElState());
    }, 500);
  }

  private stopPositionPolling(): void {
    if (this.positionTimer !== null) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
  }
}
