// ============================================================================
// YouTubeAudioExtractor – Option B: extract audio via yt-dlp (personal use)
// ============================================================================
//
// Wraps yt-dlp (via youtube-dl-exec) to extract direct audio stream URLs.
// These URLs expire after ~6 hours, so we cache them with TTL tracking and
// offer background refresh for queued tracks.
//
// Requires yt-dlp binary installed or downloaded via youtube-dl-exec.
// ============================================================================

import youtubeDl from 'youtube-dl-exec';
import type { AudioStream } from '../../types/youtube';

/** How long before expiry we consider a URL "stale" and refresh it. */
const STALE_BUFFER_MS = 30 * 60_000; // 30 min before expiry

/** Default TTL for cached URLs when we can't parse the actual expiry. */
const DEFAULT_TTL_MS = 5 * 3600_000; // 5 hours

interface CacheEntry {
  stream: AudioStream;
  fetchedAt: number;
}

export class YouTubeAudioExtractor {
  private cache = new Map<string, CacheEntry>();
  private inflightRequests = new Map<string, Promise<AudioStream>>();

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Get a direct audio stream URL for the given video ID.
   * Returns from cache if valid, otherwise extracts a fresh URL.
   */
  async getAudioStream(videoId: string): Promise<AudioStream> {
    const cached = this.cache.get(videoId);
    if (cached && !this.isExpired(cached.stream)) {
      return cached.stream;
    }

    return this.extract(videoId);
  }

  /**
   * Pre-fetch audio URLs for a list of video IDs (e.g. queued tracks).
   * Extractions run sequentially to avoid hammering yt-dlp.
   */
  async prefetch(videoIds: string[]): Promise<void> {
    for (const id of videoIds) {
      const cached = this.cache.get(id);
      if (!cached || this.isStale(cached.stream)) {
        try {
          await this.extract(id);
        } catch {
          // Non-critical: we'll retry when the track is actually played.
        }
      }
    }
  }

  /** Check whether a cached URL for the given video is still valid. */
  isUrlValid(videoId: string): boolean {
    const cached = this.cache.get(videoId);
    return cached ? !this.isExpired(cached.stream) : false;
  }

  /** Remove all cached URLs. */
  clearCache(): void {
    this.cache.clear();
  }

  // -----------------------------------------------------------------------
  // Extraction
  // -----------------------------------------------------------------------

  private async extract(videoId: string): Promise<AudioStream> {
    // Coalesce concurrent requests for the same video
    const inflight = this.inflightRequests.get(videoId);
    if (inflight) return inflight;

    const promise = this.performExtraction(videoId);
    this.inflightRequests.set(videoId, promise);

    try {
      return await promise;
    } finally {
      this.inflightRequests.delete(videoId);
    }
  }

  private async performExtraction(videoId: string): Promise<AudioStream> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;

    let result: Record<string, unknown>;
    try {
      result = (await youtubeDl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        extractAudio: true,
        audioFormat: 'opus',
        audioQuality: 0, // best
        format: 'bestaudio[ext=webm]/bestaudio/best',
      })) as Record<string, unknown>;
    } catch (err) {
      throw new Error(
        `Audio extraction failed for ${videoId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const streamUrl = (result.url as string) ?? (result.requested_downloads as Array<{ url: string }>)?.[0]?.url;
    if (!streamUrl) {
      throw new Error(`No audio URL found for ${videoId}`);
    }

    const expiresAt = this.parseExpiry(streamUrl);
    const quality = (result.abr as string) ? `${result.abr}k` : 'unknown';
    const format = (result.acodec as string) ?? (result.ext as string) ?? 'opus';

    const stream: AudioStream = {
      url: streamUrl,
      expiresAt,
      quality,
      format,
    };

    this.cache.set(videoId, { stream, fetchedAt: Date.now() });
    return stream;
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  /**
   * Try to parse the `expire` query parameter from the stream URL.
   * YouTube stream URLs typically include `?expire=<unix_timestamp>`.
   */
  private parseExpiry(streamUrl: string): number {
    try {
      const url = new URL(streamUrl);
      const expire = url.searchParams.get('expire');
      if (expire) {
        return parseInt(expire, 10) * 1000; // convert to ms
      }
    } catch {
      // URL parsing failed
    }
    return Date.now() + DEFAULT_TTL_MS;
  }

  private isExpired(stream: AudioStream): boolean {
    return Date.now() >= stream.expiresAt;
  }

  private isStale(stream: AudioStream): boolean {
    return Date.now() >= stream.expiresAt - STALE_BUFFER_MS;
  }
}
