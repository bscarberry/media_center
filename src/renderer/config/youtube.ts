// ============================================================================
// YouTube environment configuration loader
// ============================================================================

import type { YouTubeConfig, YouTubePlaybackMode } from '../types/youtube';

const DEFAULT_REDIRECT_URI = 'http://localhost:8889/callback';

/**
 * Load and validate YouTube configuration from environment variables.
 *
 * Required:
 *   YOUTUBE_API_KEY – YouTube Data API v3 key
 *
 * Optional (for OAuth personal data access):
 *   YOUTUBE_OAUTH_CLIENT_ID
 *   YOUTUBE_OAUTH_CLIENT_SECRET
 *   YOUTUBE_OAUTH_REDIRECT_URI  (defaults to http://localhost:8889/callback)
 *
 * Optional:
 *   YOUTUBE_PLAYBACK_MODE – 'iframe' (default) or 'extract'
 */
export function loadYouTubeConfig(): YouTubeConfig {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error(
      'Missing required environment variable YOUTUBE_API_KEY. ' +
        'Create a project at https://console.cloud.google.com and enable ' +
        'the YouTube Data API v3, then create an API key.',
    );
  }

  const playbackMode =
    (process.env.YOUTUBE_PLAYBACK_MODE as YouTubePlaybackMode) ?? 'iframe';

  if (playbackMode !== 'iframe' && playbackMode !== 'extract') {
    throw new Error(
      `Invalid YOUTUBE_PLAYBACK_MODE "${playbackMode}". Must be "iframe" or "extract".`,
    );
  }

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const redirectUri =
    process.env.YOUTUBE_OAUTH_REDIRECT_URI ?? DEFAULT_REDIRECT_URI;

  const config: YouTubeConfig = {
    apiKey: apiKey.trim(),
    playbackMode,
  };

  if (clientId && clientSecret) {
    config.oauth = {
      clientId: clientId.trim(),
      clientSecret: clientSecret.trim(),
      redirectUri: redirectUri.trim(),
    };
  }

  return config;
}
