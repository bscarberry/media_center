// ============================================================================
// JellyfinPlayer – streaming URL generation, transcoding, progress reporting
// ============================================================================

import { JellyfinClient } from './JellyfinClient';
import type {
  JellyfinConfig,
  TranscodeOptions,
  TranscodeQuality,
  QUALITY_PRESETS as QualityPresetsType,
} from '../../types/jellyfin';
import { QUALITY_PRESETS } from '../../types/jellyfin';

// ---------------------------------------------------------------------------
// JellyfinPlayer
// ---------------------------------------------------------------------------

export class JellyfinPlayer {
  private client: JellyfinClient;
  private config: JellyfinConfig;
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private currentItemId: string | null = null;
  private currentPositionTicks = 0;
  private isPaused = false;

  constructor(client: JellyfinClient, config: JellyfinConfig) {
    this.client = client;
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Streaming URLs
  // -----------------------------------------------------------------------

  /**
   * Get a streaming URL for an item. Uses direct play when transcoding is
   * disabled or quality is 'original'; otherwise transcodes.
   */
  getPlaybackUrl(itemId: string, options?: TranscodeOptions): string {
    const token = this.client.getAccessToken();
    const serverUrl = this.client.getServerUrl();

    if (!token) {
      throw new Error('Not authenticated with Jellyfin.');
    }

    const qualityOpts = options ?? this.getQualityOptions();

    if (!qualityOpts || !this.config.enableTranscoding) {
      return this.getDirectPlayUrl(itemId, serverUrl, token);
    }

    return this.getTranscodeUrl(itemId, serverUrl, token, qualityOpts);
  }

  /**
   * Get a direct-play URL. No transcoding — streams the original file.
   * Best quality, lowest server load, but requires client codec support.
   */
  getDirectPlayUrl(
    itemId: string,
    serverUrl?: string,
    token?: string,
  ): string {
    const base = serverUrl ?? this.client.getServerUrl();
    const t = token ?? this.client.getAccessToken();
    return `${base}/Audio/${itemId}/universal?UserId=${this.client.getUserId()}&api_key=${t}&MaxStreamingBitrate=999999999&Container=opus,webm|opus,mp3,aac,m4a|aac,m4b|aac,flac,webma,webm|webma,wav,ogg&TranscodingContainer=ts&TranscodingProtocol=hls&AudioCodec=aac&static=true`;
  }

  /** Get a transcoded stream URL with the given options. */
  getTranscodeUrl(
    itemId: string,
    serverUrl: string,
    token: string,
    options: TranscodeOptions,
  ): string {
    const params = new URLSearchParams({
      UserId: this.client.getUserId() ?? '',
      api_key: token,
      MaxStreamingBitrate: String((options.maxBitrate ?? 320) * 1000),
      AudioCodec: options.audioCodec ?? 'aac',
      TranscodingContainer: options.container ?? 'aac',
      TranscodingProtocol: 'http',
      static: 'false',
    });

    return `${serverUrl}/Audio/${itemId}/universal?${params.toString()}`;
  }

  /** Get transcode options based on the configured quality preset. */
  private getQualityOptions(): TranscodeOptions | null {
    return QUALITY_PRESETS[this.config.transcodeQuality];
  }

  // -----------------------------------------------------------------------
  // Progress reporting
  // -----------------------------------------------------------------------

  /** Start reporting playback progress to Jellyfin at regular intervals. */
  startProgressReporting(
    itemId: string,
    getPositionMs: () => number,
    getIsPaused: () => boolean,
  ): void {
    this.stopProgressReporting();
    this.currentItemId = itemId;

    // Report playback start
    this.client.reportPlaybackStart(itemId).catch(() => {});

    this.progressTimer = setInterval(() => {
      const posMs = getPositionMs();
      const paused = getIsPaused();
      const ticks = posMs * 10_000; // ms → ticks

      this.currentPositionTicks = ticks;
      this.isPaused = paused;

      this.client.reportProgress(itemId, ticks, paused).catch(() => {});
    }, 10_000); // report every 10 seconds
  }

  /** Stop progress reporting and send a final "stopped" report. */
  stopProgressReporting(): void {
    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (this.currentItemId) {
      this.client
        .reportPlaybackStopped(this.currentItemId, this.currentPositionTicks)
        .catch(() => {});
      this.currentItemId = null;
    }
  }

  /** Check whether a format is likely supported for direct play. */
  static isDirectPlaySupported(codec: string | null): boolean {
    if (!codec) return false;
    const supported = ['mp3', 'aac', 'ogg', 'opus', 'flac', 'wav', 'webm'];
    return supported.includes(codec.toLowerCase());
  }
}
