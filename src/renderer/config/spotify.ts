// ============================================================================
// Spotify environment configuration loader
// ============================================================================

import type { SpotifyConfig } from '../types/spotify';

const DEFAULT_REDIRECT_URI_DEV = 'http://localhost:8888/callback';
const DEFAULT_REDIRECT_URI_PROD = 'http://localhost:8888/callback';

/**
 * Load and validate Spotify configuration from environment variables.
 *
 * Expected env vars (set in .env or process.env):
 *   SPOTIFY_CLIENT_ID  – required
 *   SPOTIFY_REDIRECT_URI – optional, defaults to http://localhost:8888/callback
 */
export function loadSpotifyConfig(): SpotifyConfig {
  const clientId = process.env.SPOTIFY_CLIENT_ID;

  if (!clientId || clientId.trim().length === 0) {
    throw new Error(
      'Missing required environment variable SPOTIFY_CLIENT_ID. ' +
        'Create a Spotify app at https://developer.spotify.com/dashboard and ' +
        'copy the Client ID into your .env file.',
    );
  }

  const isDev =
    process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;

  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ??
    (isDev ? DEFAULT_REDIRECT_URI_DEV : DEFAULT_REDIRECT_URI_PROD);

  return {
    clientId: clientId.trim(),
    redirectUri: redirectUri.trim(),
  };
}
