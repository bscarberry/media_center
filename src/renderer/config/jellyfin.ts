// ============================================================================
// Jellyfin environment configuration loader
// ============================================================================

import { app } from 'electron';
import path from 'path';
import type { JellyfinConfig, TranscodeQuality } from '../types/jellyfin';

const VALID_QUALITIES: TranscodeQuality[] = [
  'original',
  'high',
  'medium',
  'low',
];

const DEFAULT_MAX_CACHE_SIZE = 5 * 1024 * 1024 * 1024; // 5 GB

/**
 * Load and validate Jellyfin configuration from environment variables.
 *
 * Required:
 *   JELLYFIN_SERVER_URL – e.g. http://192.168.1.100:8096
 *
 * Optional:
 *   JELLYFIN_USERNAME / JELLYFIN_PASSWORD – for username/password auth
 *   JELLYFIN_API_KEY – alternative to username/password
 *   JELLYFIN_TRANSCODE_QUALITY – original | high | medium | low
 *   JELLYFIN_ENABLE_TRANSCODING – true | false
 *   JELLYFIN_CACHE_DIR – directory for offline cache
 *   JELLYFIN_MAX_CACHE_SIZE – max cache size in bytes
 */
export function loadJellyfinConfig(): JellyfinConfig {
  const serverUrl = process.env.JELLYFIN_SERVER_URL;

  if (!serverUrl || serverUrl.trim().length === 0) {
    throw new Error(
      'Missing required environment variable JELLYFIN_SERVER_URL. ' +
        'Set it to your Jellyfin server address (e.g. http://192.168.1.100:8096).',
    );
  }

  const rawQuality = process.env.JELLYFIN_TRANSCODE_QUALITY ?? 'original';
  const transcodeQuality: TranscodeQuality = VALID_QUALITIES.includes(
    rawQuality as TranscodeQuality,
  )
    ? (rawQuality as TranscodeQuality)
    : 'original';

  const enableTranscoding =
    process.env.JELLYFIN_ENABLE_TRANSCODING !== 'false';

  // Default cache directory: <userData>/jellyfin-cache
  let cacheDirectory =
    process.env.JELLYFIN_CACHE_DIR ??
    '';
  if (!cacheDirectory) {
    try {
      cacheDirectory = path.join(app.getPath('userData'), 'jellyfin-cache');
    } catch {
      // app.getPath may throw if called before app is ready
      cacheDirectory = path.join(
        process.env.HOME ?? process.env.USERPROFILE ?? '/tmp',
        '.media-center',
        'jellyfin-cache',
      );
    }
  }

  const maxCacheSize = parseInt(
    process.env.JELLYFIN_MAX_CACHE_SIZE ?? '',
    10,
  ) || DEFAULT_MAX_CACHE_SIZE;

  return {
    serverUrl: serverUrl.trim().replace(/\/+$/, ''), // strip trailing slash
    username: process.env.JELLYFIN_USERNAME,
    password: process.env.JELLYFIN_PASSWORD,
    apiKey: process.env.JELLYFIN_API_KEY,
    transcodeQuality,
    enableTranscoding,
    cacheDirectory,
    maxCacheSize,
  };
}
