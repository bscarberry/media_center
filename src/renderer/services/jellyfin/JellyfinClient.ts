// ============================================================================
// JellyfinClient – authentication, library browsing, and favorites
// ============================================================================

import Store from 'electron-store';
import type {
  JellyfinConfig,
  JellyfinAuthResult,
  JellyfinBaseItem,
  JellyfinQueryResult,
  JellyfinItem,
  JellyfinPlayerEvents,
  JellyfinPlayerEventName,
} from '../../types/jellyfin';

// ---------------------------------------------------------------------------
// Persistent session storage
// ---------------------------------------------------------------------------

interface SessionSchema {
  jellyfinSession: {
    accessToken: string;
    userId: string;
    serverId: string;
  } | null;
}

const SESSION_DEFAULTS: SessionSchema = { jellyfinSession: null };

type Listener<K extends JellyfinPlayerEventName> = (
  payload: JellyfinPlayerEvents[K],
) => void;

// Client identification headers required by Jellyfin
const CLIENT_NAME = "Brandon's Media Hub";
const CLIENT_VERSION = '1.0.0';
const DEVICE_NAME = 'Media Center Desktop';
const DEVICE_ID = 'brandons-media-hub-electron';

// Reconnect settings
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_BACKOFF_MS = 2_000;
const PING_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// JellyfinClient
// ---------------------------------------------------------------------------

export class JellyfinClient {
  private config: JellyfinConfig;
  private store: Store<SessionSchema>;
  private accessToken: string | null = null;
  private userId: string | null = null;
  private listeners = new Map<JellyfinPlayerEventName, Set<Listener<any>>>();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connected = false;

  constructor(config: JellyfinConfig) {
    this.config = config;
    this.store = new Store<SessionSchema>({
      name: 'jellyfin-session',
      defaults: SESSION_DEFAULTS,
      encryptionKey: 'brandons-media-hub-jf-v1',
    });

    // Restore persisted session
    const session = this.store.get('jellyfinSession');
    if (session) {
      this.accessToken = session.accessToken;
      this.userId = session.userId;
    }
  }

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  /** Authenticate with username/password and persist the session. */
  async authenticate(
    username?: string,
    password?: string,
  ): Promise<void> {
    const user = username ?? this.config.username;
    const pass = password ?? this.config.password;

    if (this.config.apiKey) {
      // API key auth — just validate connectivity
      this.accessToken = this.config.apiKey;
      await this.validateConnection();
      return;
    }

    if (!user || !pass) {
      throw new Error(
        'Jellyfin username and password required. Set JELLYFIN_USERNAME ' +
          'and JELLYFIN_PASSWORD in .env or pass them directly.',
      );
    }

    const res = await this.rawFetch('/Users/AuthenticateByName', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emby-Authorization': this.buildAuthHeader(),
      },
      body: JSON.stringify({ Username: user, Pw: pass }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 401) {
        this.emit('auth_error', { message: 'Invalid username or password' });
        throw new Error('Invalid Jellyfin credentials');
      }
      throw new JellyfinApiError(res.status, body);
    }

    const data: JellyfinAuthResult = await res.json();
    this.accessToken = data.AccessToken;
    this.userId = data.User.Id;

    this.store.set('jellyfinSession', {
      accessToken: data.AccessToken,
      userId: data.User.Id,
      serverId: data.ServerId,
    });

    this.connected = true;
    this.reconnectAttempts = 0;
    this.startPingLoop();

    this.emit('auth_success', {
      userId: data.User.Id,
      serverName: data.ServerId,
    });
  }

  /** Check if we have a stored session (may be expired). */
  isAuthenticated(): boolean {
    return this.accessToken !== null && this.userId !== null;
  }

  /** Inject a pre-existing session (e.g. retrieved from the main process). */
  setSession(accessToken: string, userId: string): void {
    this.accessToken = accessToken;
    this.userId = userId;
  }

  /** Clear the stored session. */
  logout(): void {
    this.stopPingLoop();
    this.clearReconnectTimer();
    this.accessToken = null;
    this.userId = null;
    this.connected = false;
    this.store.set('jellyfinSession', null);
  }

  getUserId(): string | null {
    return this.userId;
  }

  getServerUrl(): string {
    return this.config.serverUrl;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  // -----------------------------------------------------------------------
  // Library browsing
  // -----------------------------------------------------------------------

  /** Get all media libraries (Music, Movies, etc.). */
  async getLibraries(): Promise<JellyfinBaseItem[]> {
    const data = await this.get<{ Items: JellyfinBaseItem[] }>(
      `/Users/${this.userId}/Views`,
    );
    return data.Items;
  }

  /** Get music library items. Finds the first library with CollectionType "music". */
  async getMusicLibrary(
    limit = 100,
    startIndex = 0,
  ): Promise<JellyfinQueryResult> {
    const libraries = await this.getLibraries();
    const musicLib = libraries.find(
      (l) => l.CollectionType === 'music',
    );

    if (!musicLib) {
      throw new Error('No music library found on this Jellyfin server.');
    }

    return this.get<JellyfinQueryResult>(
      `/Users/${this.userId}/Items`,
      {
        ParentId: musicLib.Id,
        IncludeItemTypes: 'Audio',
        Recursive: 'true',
        SortBy: 'SortName',
        SortOrder: 'Ascending',
        Limit: String(limit),
        StartIndex: String(startIndex),
        Fields: 'MediaSources,Genres,Overview,UserData',
      },
    );
  }

  /** Get all artists in the music library. */
  async getArtists(limit = 200, startIndex = 0): Promise<JellyfinQueryResult> {
    return this.get<JellyfinQueryResult>(
      `/Artists`,
      {
        UserId: this.userId!,
        Recursive: 'true',
        SortBy: 'SortName',
        SortOrder: 'Ascending',
        Limit: String(limit),
        StartIndex: String(startIndex),
        Fields: 'Genres,Overview,UserData',
      },
    );
  }

  /** Get albums, optionally filtered by artist ID. */
  async getAlbums(
    artistId?: string,
    limit = 100,
    startIndex = 0,
  ): Promise<JellyfinQueryResult> {
    const params: Record<string, string> = {
      UserId: this.userId!,
      IncludeItemTypes: 'MusicAlbum',
      Recursive: 'true',
      SortBy: 'ProductionYear,SortName',
      SortOrder: 'Descending',
      Limit: String(limit),
      StartIndex: String(startIndex),
      Fields: 'Genres,Overview,UserData,ChildCount',
    };

    if (artistId) {
      params.ArtistIds = artistId;
    }

    return this.get<JellyfinQueryResult>(
      `/Users/${this.userId}/Items`,
      params,
    );
  }

  /** Get tracks in an album. */
  async getTracks(albumId: string): Promise<JellyfinQueryResult> {
    return this.get<JellyfinQueryResult>(
      `/Users/${this.userId}/Items`,
      {
        ParentId: albumId,
        IncludeItemTypes: 'Audio',
        SortBy: 'ParentIndexNumber,IndexNumber,SortName',
        SortOrder: 'Ascending',
        Fields: 'MediaSources,Genres,UserData',
      },
    );
  }

  /** Search across the entire library. */
  async search(query: string, limit = 30): Promise<JellyfinQueryResult> {
    return this.get<JellyfinQueryResult>(
      `/Users/${this.userId}/Items`,
      {
        SearchTerm: query,
        IncludeItemTypes: 'Audio,MusicAlbum,MusicArtist',
        Recursive: 'true',
        Limit: String(limit),
        Fields: 'MediaSources,Genres,Overview,UserData',
      },
    );
  }

  /** Get recently added music items. */
  async getRecentlyAdded(limit = 30): Promise<JellyfinQueryResult> {
    return this.get<JellyfinQueryResult>(
      `/Users/${this.userId}/Items/Latest`,
      {
        IncludeItemTypes: 'Audio',
        Limit: String(limit),
        Fields: 'MediaSources,Genres,UserData',
      },
    );
  }

  /** Get user's favorite music items. */
  async getFavorites(limit = 100): Promise<JellyfinQueryResult> {
    return this.get<JellyfinQueryResult>(
      `/Users/${this.userId}/Items`,
      {
        IsFavorite: 'true',
        IncludeItemTypes: 'Audio,MusicAlbum,MusicArtist',
        Recursive: 'true',
        SortBy: 'SortName',
        SortOrder: 'Ascending',
        Limit: String(limit),
        Fields: 'MediaSources,Genres,UserData',
      },
    );
  }

  // -----------------------------------------------------------------------
  // Favorites / user data
  // -----------------------------------------------------------------------

  /** Mark an item as favorite. */
  async markFavorite(itemId: string): Promise<void> {
    await this.post(`/Users/${this.userId}/FavoriteItems/${itemId}`);
  }

  /** Remove an item from favorites. */
  async unmarkFavorite(itemId: string): Promise<void> {
    await this.delete(`/Users/${this.userId}/FavoriteItems/${itemId}`);
  }

  /** Report playback progress to Jellyfin. */
  async reportProgress(
    itemId: string,
    positionTicks: number,
    isPaused: boolean,
  ): Promise<void> {
    await this.post('/Sessions/Playing/Progress', {
      ItemId: itemId,
      PositionTicks: positionTicks,
      IsPaused: isPaused,
      PlayMethod: 'DirectPlay',
    });
  }

  /** Report that playback has started. */
  async reportPlaybackStart(itemId: string): Promise<void> {
    await this.post('/Sessions/Playing', {
      ItemId: itemId,
      PlayMethod: 'DirectPlay',
    });
  }

  /** Report that playback has stopped. */
  async reportPlaybackStopped(
    itemId: string,
    positionTicks: number,
  ): Promise<void> {
    await this.post('/Sessions/Playing/Stopped', {
      ItemId: itemId,
      PositionTicks: positionTicks,
    });
  }

  // -----------------------------------------------------------------------
  // Image URLs
  // -----------------------------------------------------------------------

  /** Get the primary image URL for an item. */
  getImageUrl(
    itemId: string,
    imageType: 'Primary' | 'Backdrop' | 'Art' = 'Primary',
    maxWidth = 500,
  ): string {
    return (
      `${this.config.serverUrl}/Items/${itemId}/Images/${imageType}` +
      `?maxWidth=${maxWidth}&quality=90`
    );
  }

  // -----------------------------------------------------------------------
  // Normalization
  // -----------------------------------------------------------------------

  /** Convert a Jellyfin BaseItem to our normalized JellyfinItem. */
  toItem(item: JellyfinBaseItem): JellyfinItem {
    const audioStream = item.MediaSources?.[0]?.MediaStreams?.find(
      (s) => s.Type === 'Audio',
    );

    return {
      id: item.Id,
      title: item.Name,
      artist:
        item.Artists?.join(', ') ??
        item.AlbumArtist ??
        '',
      album: item.Album ?? '',
      duration: item.RunTimeTicks
        ? Math.round(item.RunTimeTicks / 10_000) // ticks → ms
        : 0,
      artwork: item.ImageTags?.Primary
        ? this.getImageUrl(item.Id)
        : item.AlbumId
          ? this.getImageUrl(item.AlbumId)
          : null,
      year: item.ProductionYear ?? null,
      genre: item.Genres ?? [],
      bitrate: audioStream?.BitRate
        ? Math.round(audioStream.BitRate / 1000)
        : item.MediaSources?.[0]?.Bitrate
          ? Math.round(item.MediaSources[0].Bitrate / 1000)
          : null,
      codec: audioStream?.Codec ?? null,
    };
  }

  // -----------------------------------------------------------------------
  // Event emitter
  // -----------------------------------------------------------------------

  on<K extends JellyfinPlayerEventName>(event: K, listener: Listener<K>): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  off<K extends JellyfinPlayerEventName>(
    event: K,
    listener: Listener<K>,
  ): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<K extends JellyfinPlayerEventName>(
    event: K,
    payload: JellyfinPlayerEvents[K],
  ): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }

  // -----------------------------------------------------------------------
  // Internal HTTP
  // -----------------------------------------------------------------------

  private buildAuthHeader(token?: string): string {
    const parts = [
      `MediaBrowser Client="${CLIENT_NAME}"`,
      `Device="${DEVICE_NAME}"`,
      `DeviceId="${DEVICE_ID}"`,
      `Version="${CLIENT_VERSION}"`,
    ];
    const t = token ?? this.accessToken;
    if (t) parts.push(`Token="${t}"`);
    return parts.join(', ');
  }

  private async get<T>(
    path: string,
    params?: Record<string, string>,
  ): Promise<T> {
    this.assertAuthenticated();

    const url = new URL(`${this.config.serverUrl}${path}`);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const res = await this.fetchWithReconnect(url.toString(), {
      headers: {
        'X-Emby-Authorization': this.buildAuthHeader(),
      },
    });

    if (!res.ok) {
      throw new JellyfinApiError(res.status, await res.text());
    }

    return res.json() as Promise<T>;
  }

  private async post(path: string, body?: unknown): Promise<void> {
    this.assertAuthenticated();

    const res = await this.fetchWithReconnect(
      `${this.config.serverUrl}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Authorization': this.buildAuthHeader(),
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    );

    if (!res.ok && res.status !== 204) {
      throw new JellyfinApiError(res.status, await res.text());
    }
  }

  private async delete(path: string): Promise<void> {
    this.assertAuthenticated();

    const res = await this.fetchWithReconnect(
      `${this.config.serverUrl}${path}`,
      {
        method: 'DELETE',
        headers: {
          'X-Emby-Authorization': this.buildAuthHeader(),
        },
      },
    );

    if (!res.ok && res.status !== 204) {
      throw new JellyfinApiError(res.status, await res.text());
    }
  }

  /** fetch() with network error handling — triggers reconnect on failure. */
  private async fetchWithReconnect(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    try {
      const res = await this.rawFetch(url, init);
      if (!this.connected) {
        this.connected = true;
        this.reconnectAttempts = 0;
        this.emit('connection_restored', undefined as never);
        this.startPingLoop();
      }
      return res;
    } catch (err) {
      if (this.connected) {
        this.connected = false;
        this.emit('connection_lost', undefined as never);
        this.scheduleReconnect();
      }
      throw err;
    }
  }

  private rawFetch(url: string, init: RequestInit): Promise<Response> {
    const fullUrl = url.startsWith('http')
      ? url
      : `${this.config.serverUrl}${url}`;

    return fetch(fullUrl, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
  }

  private assertAuthenticated(): void {
    if (!this.accessToken || !this.userId) {
      throw new Error(
        'Not authenticated. Call authenticate() first.',
      );
    }
  }

  // -----------------------------------------------------------------------
  // Connection monitoring / reconnect
  // -----------------------------------------------------------------------

  private async validateConnection(): Promise<void> {
    const res = await this.rawFetch('/System/Ping', {});
    if (!res.ok) {
      throw new Error(`Jellyfin server unreachable (${res.status})`);
    }
    this.connected = true;

    // If using API key, fetch user info
    if (this.config.apiKey && !this.userId) {
      const me = await this.rawFetch('/Users/Me', {
        headers: {
          'X-Emby-Authorization': this.buildAuthHeader(),
        },
      });
      if (me.ok) {
        const user = (await me.json()) as { Id: string };
        this.userId = user.Id;
      }
    }

    this.startPingLoop();
  }

  private startPingLoop(): void {
    this.stopPingLoop();
    this.pingTimer = setInterval(async () => {
      try {
        await this.rawFetch('/System/Ping', {});
        if (!this.connected) {
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connection_restored', undefined as never);
        }
      } catch {
        if (this.connected) {
          this.connected = false;
          this.emit('connection_lost', undefined as never);
          this.scheduleReconnect();
        }
      }
    }, PING_INTERVAL_MS);
  }

  private stopPingLoop(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.emit('error', {
        message: `Unable to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`,
      });
      return;
    }

    const delay = INITIAL_BACKOFF_MS * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.validateConnection();
      } catch {
        this.scheduleReconnect();
      }
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Custom error
// ---------------------------------------------------------------------------

export class JellyfinApiError extends Error {
  public readonly status: number;

  constructor(status: number, body: string) {
    super(`Jellyfin API error ${status}: ${body}`);
    this.name = 'JellyfinApiError';
    this.status = status;
  }
}
