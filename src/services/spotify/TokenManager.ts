// ============================================================================
// TokenManager – manages Spotify OAuth access tokens with auto-refresh
// ============================================================================

export interface TokenStore {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

type TokenRefreshFn = (refreshToken: string) => Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}>;

export class TokenManager {
  private store: TokenStore;
  private refreshFn: TokenRefreshFn;
  private refreshPromise: Promise<string> | null = null;

  /** Buffer (ms) before actual expiry to trigger proactive refresh. */
  private static readonly EXPIRY_BUFFER_MS = 60_000;

  constructor(initialStore: TokenStore, refreshFn: TokenRefreshFn) {
    this.store = { ...initialStore };
    this.refreshFn = refreshFn;
  }

  /** Returns a valid access token, refreshing first if needed. */
  async getAccessToken(): Promise<string> {
    if (!this.isExpired()) {
      return this.store.accessToken;
    }
    return this.refresh();
  }

  /** Force-refresh the token regardless of expiry. */
  async refresh(): Promise<string> {
    // Coalesce concurrent refresh attempts into a single request.
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

  /** Replace the stored tokens (e.g. after a fresh login flow). */
  updateTokens(store: TokenStore): void {
    this.store = { ...store };
  }

  /** Check whether the current access token has expired (or is about to). */
  private isExpired(): boolean {
    return Date.now() >= this.store.expiresAt - TokenManager.EXPIRY_BUFFER_MS;
  }

  private async performRefresh(): Promise<string> {
    const result = await this.refreshFn(this.store.refreshToken);

    this.store = {
      accessToken: result.access_token,
      refreshToken: result.refresh_token ?? this.store.refreshToken,
      expiresAt: Date.now() + result.expires_in * 1000,
    };

    return this.store.accessToken;
  }
}
