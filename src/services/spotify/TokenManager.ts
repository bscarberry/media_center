// ============================================================================
// TokenManager – encrypted Spotify token persistence with auto-refresh
// ============================================================================

import Store from 'electron-store';
import type {
  PersistedTokenData,
  SpotifyTokenResponse,
  TokenManagerEvents,
  TokenManagerEventName,
} from '../../types/spotify';

// ---------------------------------------------------------------------------
// electron-store schema (encrypted at rest)
// ---------------------------------------------------------------------------

interface StoreSchema {
  spotifyTokens: PersistedTokenData | null;
}

const STORE_DEFAULTS: StoreSchema = { spotifyTokens: null };

type Listener<K extends TokenManagerEventName> = (
  payload: TokenManagerEvents[K],
) => void;

// ---------------------------------------------------------------------------
// TokenManager
// ---------------------------------------------------------------------------

export class TokenManager {
  private store: Store<StoreSchema>;
  private clientId: string;
  private refreshPromise: Promise<string> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Map<TokenManagerEventName, Set<Listener<any>>>();

  /** Refresh 5 minutes before actual expiry to guarantee headroom. */
  private static readonly EXPIRY_BUFFER_MS = 5 * 60_000;

  constructor(clientId: string) {
    this.clientId = clientId;
    this.store = new Store<StoreSchema>({
      name: 'spotify-tokens',
      defaults: STORE_DEFAULTS,
      encryptionKey: 'brandons-media-hub-v1',
    });
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Returns a valid access token, refreshing proactively if needed. */
  async getAccessToken(): Promise<string> {
    const tokens = this.getTokens();
    if (!tokens) {
      throw new Error(
        'No Spotify tokens stored. Please authenticate first.',
      );
    }

    if (!this.isExpired(tokens)) {
      return tokens.accessToken;
    }

    return this.refresh();
  }

  /** Alias kept for backward-compat with SpotifyWebPlayback / SpotifyAPI. */
  async getToken(): Promise<string> {
    return this.getAccessToken();
  }

  /** Force-refresh the access token using the stored refresh token. */
  async refresh(): Promise<string> {
    return this.refreshToken();
  }

  /** Force-refresh – coalesces concurrent calls into one request. */
  async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  /** Persist a fresh set of tokens (e.g. from the initial PKCE exchange). */
  saveTokens(response: SpotifyTokenResponse): void {
    const data: PersistedTokenData = {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt: Date.now() + response.expires_in * 1000,
      scope: response.scope,
    };

    this.store.set('spotifyTokens', data);
    this.scheduleAutoRefresh(data);
  }

  /**
   * Replace tokens from a raw data object (e.g. migrating from the old
   * in-memory TokenStore shape).
   */
  updateTokens(data: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scope?: string;
  }): void {
    const persisted: PersistedTokenData = {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: data.expiresAt,
      scope: data.scope ?? '',
    };
    this.store.set('spotifyTokens', persisted);
    this.scheduleAutoRefresh(persisted);
  }

  /** Delete all stored tokens and cancel pending refreshes. */
  clearTokens(): void {
    this.cancelAutoRefresh();
    this.store.set('spotifyTokens', null);
    this.emit('tokens_cleared', undefined as never);
  }

  /** Check whether we hold any tokens at all. */
  hasTokens(): boolean {
    return this.getTokens() !== null;
  }

  /** Return raw persisted data (or null). */
  getTokens(): PersistedTokenData | null {
    return this.store.get('spotifyTokens');
  }

  /**
   * Start the automatic refresh timer based on the currently-stored tokens.
   * Call once at app startup if tokens already exist.
   */
  startAutoRefresh(): void {
    const tokens = this.getTokens();
    if (tokens) {
      this.scheduleAutoRefresh(tokens);
    }
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  on<K extends TokenManagerEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off<K extends TokenManagerEventName>(event: K, listener: Listener<K>): void {
    this.listeners.get(event)?.delete(listener);
  }

  private emit<K extends TokenManagerEventName>(
    event: K,
    payload: TokenManagerEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private isExpired(tokens: PersistedTokenData): boolean {
    return Date.now() >= tokens.expiresAt - TokenManager.EXPIRY_BUFFER_MS;
  }

  private async performRefresh(): Promise<string> {
    const tokens = this.getTokens();
    if (!tokens) {
      throw new Error('Cannot refresh – no stored tokens.');
    }

    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: this.clientId,
      });

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Token refresh failed (${res.status}): ${errText}`);
      }

      const data: SpotifyTokenResponse = await res.json();
      this.saveTokens(data);

      this.emit('token_refreshed', {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
      });

      return data.access_token;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown refresh error';
      this.emit('token_refresh_failed', { error: message });
      throw err;
    }
  }

  private scheduleAutoRefresh(tokens: PersistedTokenData): void {
    this.cancelAutoRefresh();

    const msUntilExpiry = tokens.expiresAt - Date.now();
    // Refresh 5 minutes before expiry, but at least 10 s from now.
    const delay = Math.max(
      msUntilExpiry - TokenManager.EXPIRY_BUFFER_MS,
      10_000,
    );

    this.refreshTimer = setTimeout(() => {
      this.refreshToken().catch(() => {
        // Error already emitted via event; nothing else to do.
      });
    }, delay);
  }

  private cancelAutoRefresh(): void {
    if (this.refreshTimer !== null) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}
