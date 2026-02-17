// ============================================================================
// SpotifyAuth – OAuth2 PKCE authentication for Electron
// ============================================================================
//
// Flow:
//   1. Generate PKCE code_verifier + code_challenge
//   2. Start a temporary Express server on port 8888 to capture the callback
//   3. Open the system browser to Spotify's /authorize endpoint
//   4. Exchange the returned authorization code for tokens via /api/token
//   5. Persist tokens through TokenManager
// ============================================================================

import { createHash, randomBytes } from 'crypto';
import express from 'express';
import open from 'open';
import { TokenManager } from './TokenManager';
import type {
  SpotifyConfig,
  SpotifyTokenResponse,
  SpotifyAuthEvents,
  SpotifyAuthEventName,
} from '../../types/spotify';

// ---------------------------------------------------------------------------
// Scopes requested during authorization
// ---------------------------------------------------------------------------

const SCOPES = [
  // Web Playback SDK
  'streaming',
  // User profile
  'user-read-email',
  'user-read-private',
  // Playback state
  'user-read-playback-state',
  'user-modify-playback-state',
  // Library
  'user-library-read',
  'user-library-modify',
  // Playlists
  'playlist-read-private',
  'playlist-read-collaborative',
  'playlist-modify-public',
  'playlist-modify-private',
] as const;

const SPOTIFY_AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

/** How long to wait for the user to complete the browser flow. */
const AUTH_TIMEOUT_MS = 5 * 60_000; // 5 minutes

type Listener<K extends SpotifyAuthEventName> = (
  payload: SpotifyAuthEvents[K],
) => void;

// ---------------------------------------------------------------------------
// SpotifyAuth
// ---------------------------------------------------------------------------

export class SpotifyAuth {
  private config: SpotifyConfig;
  private tokenManager: TokenManager;
  private callbackServer: ReturnType<ReturnType<typeof express>['listen']> | null = null;
  private listeners = new Map<SpotifyAuthEventName, Set<Listener<any>>>();

  constructor(config: SpotifyConfig, tokenManager: TokenManager) {
    this.config = config;
    this.tokenManager = tokenManager;
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /**
   * Launch the full PKCE login flow.
   *
   * 1. Starts a one-shot local server to capture the redirect.
   * 2. Opens the system browser for Spotify consent.
   * 3. Exchanges the authorization code for tokens.
   * 4. Saves tokens to encrypted storage and starts auto-refresh.
   *
   * Resolves once tokens are persisted. Rejects on denial, timeout, or error.
   */
  async login(): Promise<void> {
    this.emit('auth_started', undefined as never);

    const { verifier, challenge } = SpotifyAuth.generatePkce();
    const state = SpotifyAuth.generateState();
    const authorizeUrl = this.buildAuthorizeUrl(challenge, state);

    try {
      // Step 1 – start callback server, then open the browser
      const code = await this.waitForCallback(state, authorizeUrl);

      // Step 2 – exchange code for tokens
      const tokens = await this.exchangeCode(code, verifier);

      // Step 3 – persist and schedule refresh
      this.tokenManager.saveTokens(tokens);
      this.tokenManager.startAutoRefresh();

      this.emit('auth_success', { accessToken: tokens.access_token });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Authentication failed';

      if (message.includes('denied') || message.includes('access_denied')) {
        this.emit('auth_denied', { error: message });
      } else {
        this.emit('auth_error', { error: message });
      }

      throw err;
    } finally {
      this.shutdownCallbackServer();
    }
  }

  /** Whether the user already has stored (possibly expired) tokens. */
  isAuthenticated(): boolean {
    return this.tokenManager.hasTokens();
  }

  /** Remove stored tokens and require re-authentication. */
  logout(): void {
    this.tokenManager.clearTokens();
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  on<K extends SpotifyAuthEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends SpotifyAuthEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends SpotifyAuthEventName>(
    event: K,
    payload: SpotifyAuthEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // -----------------------------------------------------------------------
  // PKCE helpers
  // -----------------------------------------------------------------------

  /** Generate a cryptographic code verifier and its S256 challenge. */
  static generatePkce(): { verifier: string; challenge: string } {
    // 32 random bytes → base64url string (per RFC 7636, 43-128 chars)
    const verifier = randomBytes(32)
      .toString('base64url')
      .slice(0, 128);

    const challenge = createHash('sha256')
      .update(verifier)
      .digest('base64url');

    return { verifier, challenge };
  }

  /** Generate a random state parameter to guard against CSRF. */
  static generateState(): string {
    return randomBytes(16).toString('hex');
  }

  // -----------------------------------------------------------------------
  // Authorization URL
  // -----------------------------------------------------------------------

  private buildAuthorizeUrl(challenge: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      scope: SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });

    return `${SPOTIFY_AUTHORIZE_URL}?${params.toString()}`;
  }

  // -----------------------------------------------------------------------
  // Callback server + browser open
  // -----------------------------------------------------------------------

  /**
   * Spin up a temporary Express server, open the browser to Spotify's
   * authorize page, and resolve with the authorization code from the
   * redirect callback.
   */
  private waitForCallback(
    expectedState: string,
    authorizeUrl: string,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const app = express();
      let settled = false;

      const settle = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };

      // Timeout safety net
      const timeout = setTimeout(() => {
        settle(() =>
          reject(new Error('Authentication timed out. Please try again.')),
        );
        this.shutdownCallbackServer();
      }, AUTH_TIMEOUT_MS);

      // ── Callback route ──────────────────────────────────────────────
      app.get('/callback', (req, res) => {
        // User denied access
        const error = req.query['error'] as string | undefined;
        if (error) {
          res.send(
            '<html><body><h2>Authentication denied</h2>' +
              '<p>You can close this window.</p></body></html>',
          );
          settle(() =>
            reject(new Error(`Spotify authorization denied: ${error}`)),
          );
          return;
        }

        const code = req.query['code'] as string | undefined;
        const state = req.query['state'] as string | undefined;

        if (!code) {
          res.status(400).send('Missing authorization code.');
          settle(() =>
            reject(new Error('Callback missing authorization code')),
          );
          return;
        }

        if (state !== expectedState) {
          res.status(400).send('State mismatch – possible CSRF attack.');
          settle(() => reject(new Error('OAuth state mismatch')));
          return;
        }

        res.send(
          '<html><body>' +
            '<h2>Authentication successful!</h2>' +
            "<p>You can close this window and return to Brandon's Media Hub.</p>" +
            '</body></html>',
        );

        settle(() => resolve(code));
      });

      // ── Start server ────────────────────────────────────────────────
      const url = new URL(this.config.redirectUri);
      const port = parseInt(url.port, 10) || 8888;

      this.callbackServer = app.listen(port, () => {
        // Server is ready – open the system browser
        open(authorizeUrl).catch((err) => {
          settle(() =>
            reject(
              new Error(
                `Failed to open browser: ${err instanceof Error ? err.message : String(err)}`,
              ),
            ),
          );
        });
      });

      this.callbackServer.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          settle(() =>
            reject(
              new Error(
                `Port ${port} is already in use. Close the other process and try again.`,
              ),
            ),
          );
        } else {
          settle(() =>
            reject(new Error(`Callback server error: ${err.message}`)),
          );
        }
      });
    });
  }

  private shutdownCallbackServer(): void {
    if (this.callbackServer) {
      this.callbackServer.close();
      this.callbackServer = null;
    }
  }

  // -----------------------------------------------------------------------
  // Token exchange
  // -----------------------------------------------------------------------

  /** Exchange an authorization code + PKCE verifier for tokens. */
  private async exchangeCode(
    code: string,
    codeVerifier: string,
  ): Promise<SpotifyTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      code_verifier: codeVerifier,
    });

    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(
        `Token exchange failed (${res.status}): ${errBody}`,
      );
    }

    return (await res.json()) as SpotifyTokenResponse;
  }
}
