// ============================================================================
// YouTubeAuth – Google OAuth2 for YouTube Data API personal access
// ============================================================================
//
// Uses the standard Google OAuth2 flow (NOT PKCE — Google requires
// client_secret for installed/desktop apps). The callback runs on port 8889
// to avoid conflict with Spotify on 8888.
// ============================================================================

import { randomBytes } from 'crypto';
import express from 'express';
import open from 'open';
import Store from 'electron-store';
import type {
  YouTubeConfig,
  YouTubeTokenResponse,
  YouTubePersistedTokenData,
  YouTubeAuthEvents,
  YouTubeAuthEventName,
} from '../../types/youtube';

// ---------------------------------------------------------------------------
// Scopes
// ---------------------------------------------------------------------------

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube',
] as const;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const AUTH_TIMEOUT_MS = 5 * 60_000;

// ---------------------------------------------------------------------------
// Encrypted token store
// ---------------------------------------------------------------------------

interface StoreSchema {
  youtubeTokens: YouTubePersistedTokenData | null;
}

const STORE_DEFAULTS: StoreSchema = { youtubeTokens: null };

type Listener<K extends YouTubeAuthEventName> = (
  payload: YouTubeAuthEvents[K],
) => void;

// ---------------------------------------------------------------------------
// YouTubeAuth
// ---------------------------------------------------------------------------

export class YouTubeAuth {
  private config: YouTubeConfig;
  private store: Store<StoreSchema>;
  private callbackServer: ReturnType<ReturnType<typeof express>['listen']> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private refreshPromise: Promise<string> | null = null;
  private listeners = new Map<YouTubeAuthEventName, Set<Listener<any>>>();

  private static readonly EXPIRY_BUFFER_MS = 5 * 60_000;

  constructor(config: YouTubeConfig) {
    this.config = config;
    this.store = new Store<StoreSchema>({
      name: 'youtube-tokens',
      defaults: STORE_DEFAULTS,
      encryptionKey: 'brandons-media-hub-yt-v1',
    });
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Whether OAuth credentials are configured. */
  get oauthConfigured(): boolean {
    return !!this.config.oauth;
  }

  /** Launch the Google OAuth2 login flow in the system browser. */
  async login(): Promise<void> {
    if (!this.config.oauth) {
      throw new Error(
        'YouTube OAuth not configured. Add YOUTUBE_OAUTH_CLIENT_ID and ' +
          'YOUTUBE_OAUTH_CLIENT_SECRET to your .env file.',
      );
    }

    this.emit('auth_started', undefined as never);
    const state = randomBytes(16).toString('hex');
    const authorizeUrl = this.buildAuthorizeUrl(state);

    try {
      const code = await this.waitForCallback(state, authorizeUrl);
      const tokens = await this.exchangeCode(code);
      this.saveTokens(tokens);
      this.startAutoRefresh();
      this.emit('auth_success', { accessToken: tokens.access_token });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'YouTube authentication failed';
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

  /** Get a valid access token, refreshing if expired. */
  async getAccessToken(): Promise<string> {
    const tokens = this.getTokens();
    if (!tokens) {
      throw new Error('No YouTube tokens stored. Please authenticate first.');
    }
    if (Date.now() < tokens.expiresAt - YouTubeAuth.EXPIRY_BUFFER_MS) {
      return tokens.accessToken;
    }
    return this.refresh();
  }

  /** Force-refresh the token. Coalesces concurrent calls. */
  async refresh(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = this.performRefresh();
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  isAuthenticated(): boolean {
    return this.getTokens() !== null;
  }

  logout(): void {
    this.cancelAutoRefresh();
    this.store.set('youtubeTokens', null);
  }

  getTokens(): YouTubePersistedTokenData | null {
    return this.store.get('youtubeTokens');
  }

  startAutoRefresh(): void {
    const tokens = this.getTokens();
    if (tokens) this.scheduleAutoRefresh(tokens);
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  on<K extends YouTubeAuthEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off<K extends YouTubeAuthEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends YouTubeAuthEventName>(
    event: K,
    payload: YouTubeAuthEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // -----------------------------------------------------------------------
  // OAuth helpers
  // -----------------------------------------------------------------------

  private buildAuthorizeUrl(state: string): string {
    const oauth = this.config.oauth!;
    const params = new URLSearchParams({
      client_id: oauth.clientId,
      redirect_uri: oauth.redirectUri,
      response_type: 'code',
      scope: SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

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

      const timeout = setTimeout(() => {
        settle(() => reject(new Error('YouTube authentication timed out.')));
        this.shutdownCallbackServer();
      }, AUTH_TIMEOUT_MS);

      app.get('/callback', (req, res) => {
        const error = req.query['error'] as string | undefined;
        if (error) {
          res.send(
            '<html><body><h2>Authentication denied</h2>' +
              '<p>You can close this window.</p></body></html>',
          );
          settle(() => reject(new Error(`YouTube auth denied: ${error}`)));
          return;
        }

        const code = req.query['code'] as string | undefined;
        const state = req.query['state'] as string | undefined;

        if (!code) {
          res.status(400).send('Missing authorization code.');
          settle(() => reject(new Error('Callback missing code')));
          return;
        }

        if (state !== expectedState) {
          res.status(400).send('State mismatch.');
          settle(() => reject(new Error('OAuth state mismatch')));
          return;
        }

        res.send(
          '<html><body><h2>YouTube authenticated!</h2>' +
            "<p>Return to Brandon's Media Hub.</p></body></html>",
        );
        settle(() => resolve(code));
      });

      const url = new URL(this.config.oauth!.redirectUri);
      const port = parseInt(url.port, 10) || 8889;

      this.callbackServer = app.listen(port, () => {
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
          settle(() => reject(new Error(`Port ${port} in use.`)));
        } else {
          settle(() => reject(new Error(`Server error: ${err.message}`)));
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

  private async exchangeCode(code: string): Promise<YouTubeTokenResponse> {
    const oauth = this.config.oauth!;
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: oauth.redirectUri,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
    }

    return (await res.json()) as YouTubeTokenResponse;
  }

  private saveTokens(response: YouTubeTokenResponse): void {
    const existing = this.getTokens();
    const data: YouTubePersistedTokenData = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token ?? existing?.refreshToken ?? '',
      expiresAt: Date.now() + response.expires_in * 1000,
      scope: response.scope,
    };
    this.store.set('youtubeTokens', data);
  }

  private async performRefresh(): Promise<string> {
    const tokens = this.getTokens();
    if (!tokens?.refreshToken) {
      throw new Error('No refresh token available.');
    }

    const oauth = this.config.oauth!;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
    });

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(`Token refresh failed (${res.status}): ${await res.text()}`);
    }

    const data: YouTubeTokenResponse = await res.json();
    this.saveTokens(data);
    return data.access_token;
  }

  private scheduleAutoRefresh(tokens: YouTubePersistedTokenData): void {
    this.cancelAutoRefresh();
    const delay = Math.max(
      tokens.expiresAt - Date.now() - YouTubeAuth.EXPIRY_BUFFER_MS,
      10_000,
    );
    this.refreshTimer = setTimeout(() => {
      this.refresh().catch(() => {});
    }, delay);
  }

  private cancelAutoRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
