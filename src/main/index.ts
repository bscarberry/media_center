// ============================================================================
// Electron Main Process – Brandon's Media Hub
// ============================================================================

import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  Tray,
  Menu,
  nativeImage,
  type Rectangle,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { createHash, randomBytes } from 'crypto';
import Store from 'electron-store';

// ---------------------------------------------------------------------------
// Load .env file (before anything else needs env vars)
// ---------------------------------------------------------------------------

function loadDotEnv(): void {
  // Check multiple locations where .env might live
  const candidates = [
    path.join(path.dirname(app.getPath('exe')), '.env'),        // directory containing the executable (packaged)
    path.join(process.cwd(), '.env'),                           // current working directory
    path.join(app.getAppPath(), '.env'),                        // app path (dev mode)
    path.join(path.dirname(app.getAppPath()), '.env'),          // parent of app.asar (packaged)
    path.join(app.getPath('userData'), '.env'),                 // user data dir (e.g. ~/.config/media-hub)
    path.join(process.resourcesPath ?? app.getAppPath(), '.env'), // resources dir (packaged)
  ];

  console.log('[main] Searching for .env in:', candidates);

  for (const envPath of candidates) {
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx === -1) continue;
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          // Strip surrounding quotes
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined) {
            process.env[key] = val;
          }
        }
        const loadedKeys = content.split('\n')
          .map(l => l.trim())
          .filter(l => l && !l.startsWith('#') && l.includes('='))
          .map(l => l.slice(0, l.indexOf('=')).trim());
        console.log('[main] Loaded .env from', envPath);
        console.log('[main] .env keys found:', loadedKeys.join(', '));
        return;
      }
    } catch (err) {
      console.warn('[main] Failed to read .env at', envPath, err);
    }
  }

  console.log('[main] No .env file found in any of the searched locations');
}

loadDotEnv();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IS_DEV = !app.isPackaged;
const DEV_SERVER_URL = 'http://localhost:5173';

// Disable GPU hardware acceleration on ARM to prevent blank screens
if (process.arch === 'arm64' || process.arch === 'arm') {
  app.disableHardwareAcceleration();
}

// Persist window bounds between sessions
const store = new Store<{
  windowBounds?: Rectangle;
  windowMaximized?: boolean;
}>({
  name: 'window-state',
  defaults: {},
});

// ---------------------------------------------------------------------------
// Auth token stores (lazy-created singletons)
// ---------------------------------------------------------------------------

let spotifyTokenStore: Store<{ spotifyTokens: any }> | null = null;
let youtubeTokenStore: Store<{ youtubeTokens: any }> | null = null;
let jellyfinSessionStore: Store<{ jellyfinSession: any }> | null = null;

function getSpotifyStore() {
  if (!spotifyTokenStore) {
    spotifyTokenStore = new Store({
      name: 'spotify-tokens',
      encryptionKey: 'brandons-media-hub-v1',
      defaults: { spotifyTokens: null },
    });
  }
  return spotifyTokenStore;
}

function getYouTubeStore() {
  if (!youtubeTokenStore) {
    youtubeTokenStore = new Store({
      name: 'youtube-tokens',
      encryptionKey: 'brandons-media-hub-yt-v1',
      defaults: { youtubeTokens: null },
    });
  }
  return youtubeTokenStore;
}

function getJellyfinStore() {
  if (!jellyfinSessionStore) {
    jellyfinSessionStore = new Store({
      name: 'jellyfin-session',
      encryptionKey: 'brandons-media-hub-jf-v1',
      defaults: { jellyfinSession: null },
    });
  }
  return jellyfinSessionStore;
}

// ---------------------------------------------------------------------------
// Globals
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createWindow(): void {
  const savedBounds = store.get('windowBounds');
  const wasMaximized = store.get('windowMaximized', false);

  mainWindow = new BrowserWindow({
    width: savedBounds?.width ?? 1400,
    height: savedBounds?.height ?? 900,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0a0a0a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    frame: process.platform !== 'darwin',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: true, // Required so renderer can require() externalized Node modules (electron-store, path, fs, crypto)
      sandbox: false,
      webSecurity: !IS_DEV,
    },
  });

  // Override user-agent to standard Chrome so YouTube iframes work (Electron UA is blocked)
  const chromeUA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  mainWindow.webContents.session.setUserAgent(chromeUA);

  // Also intercept request headers for YouTube domains — iframes may fire before
  // the session UA propagates, so this guarantees Chrome UA on every YouTube request.
  mainWindow.webContents.session.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*', '*://*.ytimg.com/*', '*://*.googlevideo.com/*'] },
    (details, callback) => {
      details.requestHeaders['User-Agent'] = chromeUA;
      callback({ requestHeaders: details.requestHeaders });
    },
  );

  // Gracefully show window when ready
  mainWindow.once('ready-to-show', () => {
    if (wasMaximized) {
      mainWindow?.maximize();
    }
    mainWindow?.show();
  });

  // Load content
  if (IS_DEV) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  // Save window state on changes
  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);
  mainWindow.on('maximize', () => store.set('windowMaximized', true));
  mainWindow.on('unmaximize', () => store.set('windowMaximized', false));

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function saveWindowBounds(): void {
  if (!mainWindow || mainWindow.isMaximized()) return;
  store.set('windowBounds', mainWindow.getBounds());
}

// ---------------------------------------------------------------------------
// System tray
// ---------------------------------------------------------------------------

function createTray(): void {
  // Use a placeholder 16x16 icon – in production, replace with app icon
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Media Hub',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Play/Pause',
      click: () => mainWindow?.webContents.send('tray:toggle-playback'),
    },
    {
      label: 'Next Track',
      click: () => mainWindow?.webContents.send('tray:next-track'),
    },
    {
      label: 'Previous Track',
      click: () => mainWindow?.webContents.send('tray:prev-track'),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit(),
    },
  ]);

  tray.setToolTip('Media Hub');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Spotify PKCE helpers (run in main process since renderer has no Node)
// ---------------------------------------------------------------------------

function generatePKCE() {
  const verifier = randomBytes(32).toString('base64url').slice(0, 128);
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

const SPOTIFY_SCOPES = [
  'streaming', 'user-read-email', 'user-read-private',
  'user-read-playback-state', 'user-modify-playback-state',
  'user-library-read', 'user-library-modify',
  'playlist-read-private', 'playlist-read-collaborative',
  'playlist-modify-public', 'playlist-modify-private',
];

let spotifyAuthPending: { verifier: string; state: string } | null = null;

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function setupIPC(): void {
  // Open URL in default system browser
  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  // Get app paths
  ipcMain.handle('app:get-path', (_event, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0]);
  });

  // App version
  ipcMain.handle('app:get-version', () => {
    return app.getVersion();
  });

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

  // Electron store (secure key-value persistence)
  ipcMain.handle('store:get', (_event, key: string) => {
    return store.get(key);
  });
  ipcMain.handle('store:set', (_event, key: string, value: unknown) => {
    store.set(key, value);
  });
  ipcMain.handle('store:delete', (_event, key: string) => {
    store.delete(key as keyof typeof store.store);
  });

  // OAuth callback server management
  ipcMain.handle('oauth:start-server', async (_event, port: number) => {
    return { port };
  });

  // -------------------------------------------------------------------------
  // Environment config – expose env vars to renderer safely
  // -------------------------------------------------------------------------

  ipcMain.handle('config:get-env', () => {
    return {
      SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
      SPOTIFY_REDIRECT_URI: 'http://127.0.0.1:8888/callback',
      YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY || '',
      YOUTUBE_PLAYBACK_MODE: process.env.YOUTUBE_PLAYBACK_MODE || 'iframe',
      YOUTUBE_OAUTH_CLIENT_ID: process.env.YOUTUBE_OAUTH_CLIENT_ID || '',
      JELLYFIN_SERVER_URL: process.env.JELLYFIN_SERVER_URL || '',
      JELLYFIN_USERNAME: process.env.JELLYFIN_USERNAME || '',
      WEATHER_API_KEY: process.env.WEATHER_API_KEY || '',
      WEATHER_DEFAULT_LAT: process.env.WEATHER_DEFAULT_LAT || '',
      WEATHER_DEFAULT_LON: process.env.WEATHER_DEFAULT_LON || '',
      WEATHER_UNIT: process.env.WEATHER_UNIT || 'fahrenheit',
      NEWS_API_KEY: process.env.NEWS_API_KEY || '',
      TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN || '',
    };
  });

  // -------------------------------------------------------------------------
  // Auth status – check encrypted token stores for each service
  // -------------------------------------------------------------------------

  ipcMain.handle('auth:get-status', () => {
    const result = { spotify: false, youtube: false, jellyfin: false };

    try {
      const tokens = getSpotifyStore().get('spotifyTokens');
      result.spotify = tokens !== null && tokens !== undefined;
    } catch { /* store not created yet */ }

    try {
      const tokens = getYouTubeStore().get('youtubeTokens');
      result.youtube = tokens !== null && tokens !== undefined;
    } catch { /* store not created yet */ }

    try {
      const session = getJellyfinStore().get('jellyfinSession');
      result.jellyfin = session !== null && session !== undefined;
    } catch { /* store not created yet */ }

    return result;
  });

  ipcMain.handle('auth:clear-tokens', (_event, service: string) => {
    try {
      if (service === 'spotify') {
        getSpotifyStore().set('spotifyTokens', null);
      } else if (service === 'youtube') {
        getYouTubeStore().set('youtubeTokens', null);
      } else if (service === 'jellyfin') {
        getJellyfinStore().set('jellyfinSession', null);
      }
    } catch { /* ignore */ }
    return true;
  });

  // -------------------------------------------------------------------------
  // Spotify OAuth PKCE – main process handles the full flow
  // -------------------------------------------------------------------------

  ipcMain.handle('auth:spotify-login', async () => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const redirectUri = 'http://127.0.0.1:8888/callback';

    if (!clientId) {
      return { success: false, error: 'SPOTIFY_CLIENT_ID not set in .env' };
    }

    const { verifier, challenge } = generatePKCE();
    const state = randomBytes(16).toString('hex');
    spotifyAuthPending = { verifier, state };

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: SPOTIFY_SCOPES.join(' '),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
    });

    const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`;

    // Open a BrowserWindow for the OAuth flow (keeps user in-app)
    return new Promise((resolve) => {
      const authWin = new BrowserWindow({
        width: 500,
        height: 700,
        parent: mainWindow ?? undefined,
        modal: true,
        show: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      authWin.loadURL(authUrl);

      // Watch for the redirect with the auth code
      authWin.webContents.on('will-redirect', async (_event, url) => {
        if (!url.startsWith(redirectUri)) return;

        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        const returnedState = parsed.searchParams.get('state');
        const error = parsed.searchParams.get('error');

        authWin.close();

        if (error) {
          spotifyAuthPending = null;
          resolve({ success: false, error: `Spotify denied: ${error}` });
          return;
        }

        if (!code || returnedState !== spotifyAuthPending?.state) {
          spotifyAuthPending = null;
          resolve({ success: false, error: 'Invalid OAuth response' });
          return;
        }

        // Exchange code for tokens
        try {
          const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: spotifyAuthPending.verifier,
          });

          const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });

          if (!res.ok) {
            const errBody = await res.text();
            spotifyAuthPending = null;
            resolve({ success: false, error: `Token exchange failed: ${errBody}` });
            return;
          }

          const data = (await res.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            scope: string;
          };
          getSpotifyStore().set('spotifyTokens', {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            scope: data.scope,
          });

          spotifyAuthPending = null;
          resolve({ success: true });
        } catch (err: any) {
          spotifyAuthPending = null;
          resolve({ success: false, error: err.message });
        }
      });

      // Also handle URL changes via will-navigate
      authWin.webContents.on('will-navigate', async (_event, url) => {
        if (!url.startsWith(redirectUri)) return;

        const parsed = new URL(url);
        const code = parsed.searchParams.get('code');
        const returnedState = parsed.searchParams.get('state');
        const error = parsed.searchParams.get('error');

        authWin.close();

        if (error || !code || returnedState !== spotifyAuthPending?.state) {
          spotifyAuthPending = null;
          resolve({ success: false, error: error || 'Invalid OAuth response' });
          return;
        }

        try {
          const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: clientId,
            code_verifier: spotifyAuthPending!.verifier,
          });

          const res = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });

          if (!res.ok) {
            const errBody = await res.text();
            spotifyAuthPending = null;
            resolve({ success: false, error: `Token exchange failed: ${errBody}` });
            return;
          }

          const data = (await res.json()) as {
            access_token: string;
            refresh_token: string;
            expires_in: number;
            scope: string;
          };
          getSpotifyStore().set('spotifyTokens', {
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: Date.now() + data.expires_in * 1000,
            scope: data.scope,
          });

          spotifyAuthPending = null;
          resolve({ success: true });
        } catch (err: any) {
          spotifyAuthPending = null;
          resolve({ success: false, error: err.message });
        }
      });

      authWin.on('closed', () => {
        if (spotifyAuthPending) {
          spotifyAuthPending = null;
          resolve({ success: false, error: 'Auth window closed' });
        }
      });
    });
  });

  // -------------------------------------------------------------------------
  // Jellyfin auth – authenticate with username/password from .env
  // -------------------------------------------------------------------------

  ipcMain.handle('auth:jellyfin-login', async () => {
    const serverUrl = process.env.JELLYFIN_SERVER_URL;
    if (!serverUrl) {
      return { success: false, error: 'JELLYFIN_SERVER_URL not set in .env' };
    }

    const apiKey = process.env.JELLYFIN_API_KEY;
    const username = process.env.JELLYFIN_USERNAME;
    const password = process.env.JELLYFIN_PASSWORD;
    const base = serverUrl.replace(/\/$/, ''); // strip trailing slash to avoid double-slash URLs

    // API key auth
    if (apiKey) {
      try {
        const res = await fetch(`${base}/System/Ping`, {
          headers: { 'X-Emby-Token': apiKey },
        });
        if (res.ok) {
          getJellyfinStore().set('jellyfinSession', {
            accessToken: apiKey,
            userId: 'apikey-user',
            serverId: base,
          });
          return { success: true };
        }
        return { success: false, error: `Jellyfin ping failed: ${res.status}` };
      } catch (err: any) {
        return { success: false, error: `Cannot reach Jellyfin: ${err.message}` };
      }
    }

    // Username/password auth
    if (!username || !password) {
      return { success: false, error: 'Set JELLYFIN_USERNAME + JELLYFIN_PASSWORD or JELLYFIN_API_KEY in .env' };
    }

    try {
      const authHeader =
        `MediaBrowser Client="Brandon's Media Hub", Device="Desktop", DeviceId="brandons-media-hub-electron", Version="1.0.0"`;
      const res = await fetch(`${base}/Users/AuthenticateByName`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Emby-Authorization': authHeader,
        },
        body: JSON.stringify({ Username: username, Pw: password }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `Jellyfin auth failed (${res.status}): ${text}` };
      }

      const data = (await res.json()) as {
        AccessToken: string;
        User: { Id: string };
        ServerId: string;
      };
      getJellyfinStore().set('jellyfinSession', {
        accessToken: data.AccessToken,
        userId: data.User.Id,
        serverId: data.ServerId,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Cannot reach Jellyfin: ${err.message}` };
    }
  });

  // -------------------------------------------------------------------------
  // Spotify – fetch library content (playlists + top tracks) for the content page
  // -------------------------------------------------------------------------

  ipcMain.handle('spotify:get-content', async () => {
    const tokens = getSpotifyStore().get('spotifyTokens') as {
      accessToken: string; refreshToken: string; expiresAt: number;
    } | null;
    if (!tokens?.accessToken) throw new Error('Not authenticated with Spotify');
    const headers = { Authorization: `Bearer ${tokens.accessToken}` };
    const [playlistsRes, topTracksRes, profileRes] = await Promise.all([
      fetch('https://api.spotify.com/v1/me/playlists?limit=20', { headers }),
      fetch('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=10', { headers }),
      fetch('https://api.spotify.com/v1/me', { headers }),
    ]);
    const playlists = playlistsRes.ok ? ((await playlistsRes.json()) as any).items ?? [] : [];
    const topTracks = topTracksRes.ok ? ((await topTracksRes.json()) as any).items ?? [] : [];
    const profile = profileRes.ok ? (await profileRes.json()) as any : null;
    return { playlists, topTracks, profile };
  });

  // -------------------------------------------------------------------------
  // Jellyfin – fetch library content (recently added + resume) for the content page
  // -------------------------------------------------------------------------

  ipcMain.handle('jellyfin:get-content', async () => {
    const session = getJellyfinStore().get('jellyfinSession') as {
      accessToken: string; userId: string; serverId: string;
    } | null;
    if (!session?.accessToken) throw new Error('Not authenticated with Jellyfin');
    const base = (process.env.JELLYFIN_SERVER_URL || session.serverId).replace(/\/$/, '');
    const headers = { 'X-Emby-Token': session.accessToken };
    const [recentRes, resumeRes] = await Promise.all([
      fetch(
        `${base}/Users/${session.userId}/Items/Latest?Limit=20&ImageTypeLimit=1` +
        `&EnableImageTypes=Primary&IncludeItemTypes=Movie,Series,Episode`,
        { headers },
      ),
      fetch(
        `${base}/Users/${session.userId}/Items?Recursive=true&SortBy=DatePlayed` +
        `&SortOrder=Descending&Filters=IsResumable&Limit=10` +
        `&ImageTypeLimit=1&EnableImageTypes=Primary`,
        { headers },
      ),
    ]);
    const recentItems = recentRes.ok ? (await recentRes.json()) as any[] : [];
    const resumeData = resumeRes.ok ? (await resumeRes.json()) as any : { Items: [] };
    return {
      recentItems: Array.isArray(recentItems) ? recentItems : [],
      resumeItems: resumeData.Items ?? [],
      serverUrl: base,
      accessToken: session.accessToken,
    };
  });

  // -------------------------------------------------------------------------
  // YouTube – validate API key works
  // -------------------------------------------------------------------------

  ipcMain.handle('auth:youtube-login', async () => {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      return { success: false, error: 'YOUTUBE_API_KEY not set in .env' };
    }

    try {
      // Test the API key with a simple request
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=id&chart=mostPopular&maxResults=1&key=${apiKey}`,
      );

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `YouTube API key invalid (${res.status}): ${text}` };
      }

      // Store the key as "tokens" so auth:get-status sees it
      getYouTubeStore().set('youtubeTokens', {
        apiKey,
        validatedAt: Date.now(),
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `YouTube API check failed: ${err.message}` };
    }
  });

  // -------------------------------------------------------------------------
  // News – fetch via main process to bypass NewsAPI free-plan origin check
  // -------------------------------------------------------------------------

  const NEWS_CAT_MAP: Record<string, string | null> = {
    all: null, technology: 'technology', world: 'general', business: 'business',
    entertainment: 'entertainment', sports: 'sports', science: 'science', health: 'health',
  };

  ipcMain.handle('news:get-headlines', async (_event, { apiKey, category = 'all', page = 1, pageSize = 20 }: {
    apiKey: string; category?: string; page?: number; pageSize?: number;
  }) => {
    let url = `https://newsapi.org/v2/top-headlines?country=us&pageSize=${pageSize}&page=${page}`;
    const cat = NEWS_CAT_MAP[category];
    if (cat) url += `&category=${cat}`;
    const res = await fetch(url, { headers: { 'X-Api-Key': apiKey } });
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`News API error ${res.status}: ${text}`);
    }
    return res.json();
  });

  // -------------------------------------------------------------------------
  // YouTube – open a video in a dedicated pop-out BrowserWindow
  // -------------------------------------------------------------------------

  ipcMain.handle('youtube:open-window', (_event, videoId: string) => {
    const win = new BrowserWindow({
      width: 960,
      height: 560,
      title: 'YouTube',
      backgroundColor: '#000000',
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    win.loadURL(`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`);
    win.setMenu(null);
  });

  // -------------------------------------------------------------------------
  // Twitter / X – proxy API calls through main process (v2 API)
  // -------------------------------------------------------------------------

  ipcMain.handle('twitter:get-user-tweets', async (_event, {
    bearerToken, username, maxResults = 50,
  }: { bearerToken: string; username: string; maxResults?: number }) => {
    // Step 1: resolve username → numeric user ID
    const userRes = await fetch(
      `https://api.twitter.com/2/users/by/username/${encodeURIComponent(username)}`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    if (!userRes.ok) {
      const text = await userRes.text().catch(() => userRes.statusText);
      throw new Error(`Twitter user lookup failed (${userRes.status}): ${text}`);
    }
    const userData = (await userRes.json()) as { data?: { id: string; name: string; username: string } };
    if (!userData.data) throw new Error(`User @${username} not found`);

    // Step 2: fetch recent tweets for that user (including replies)
    const tweetsRes = await fetch(
      `https://api.twitter.com/2/users/${userData.data.id}/tweets` +
      `?max_results=${maxResults}` +
      `&tweet.fields=created_at,public_metrics,text,in_reply_to_user_id,referenced_tweets` +
      `&expansions=author_id,referenced_tweets.id` +
      `&user.fields=name,username,profile_image_url`,
      { headers: { Authorization: `Bearer ${bearerToken}` } },
    );
    if (!tweetsRes.ok) {
      const text = await tweetsRes.text().catch(() => tweetsRes.statusText);
      throw new Error(`Twitter timeline fetch failed (${tweetsRes.status}): ${text}`);
    }
    const tweetsData = (await tweetsRes.json()) as {
      data?: Array<Record<string, unknown>>;
      includes?: { tweets?: Array<Record<string, unknown>> };
    };
    return {
      user: userData.data,
      tweets: tweetsData.data ?? [],
      includes: tweetsData.includes ?? {},
    };
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();
  createTray();
  setupIPC();

  // macOS: re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Cleanup
app.on('before-quit', () => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
});
