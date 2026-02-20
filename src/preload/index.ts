// ============================================================================
// Electron Preload Script – secure bridge between main and renderer
// ============================================================================

import { contextBridge, ipcRenderer } from 'electron';

// ---------------------------------------------------------------------------
// API exposed to renderer via window.electronAPI
// ---------------------------------------------------------------------------

const electronAPI = {
  // Shell
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),

  // App info
  getAppPath: (name: string) => ipcRenderer.invoke('app:get-path', name),
  getVersion: () => ipcRenderer.invoke('app:get-version'),

  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // Persistent key-value store
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },

  // OAuth helpers
  startOAuthServer: (port: number) => ipcRenderer.invoke('oauth:start-server', port),

  // Auth status and login flows
  auth: {
    getStatus: () => ipcRenderer.invoke('auth:get-status') as Promise<{ spotify: boolean; youtube: boolean; jellyfin: boolean }>,
    clearTokens: (service: string) => ipcRenderer.invoke('auth:clear-tokens', service) as Promise<boolean>,
    spotifyLogin: () => ipcRenderer.invoke('auth:spotify-login') as Promise<{ success: boolean; error?: string }>,
    youtubeLogin: () => ipcRenderer.invoke('auth:youtube-login') as Promise<{ success: boolean; error?: string }>,
    jellyfinLogin: () => ipcRenderer.invoke('auth:jellyfin-login') as Promise<{ success: boolean; error?: string }>,
  },

  // Environment config (from main process .env)
  getConfig: () => ipcRenderer.invoke('config:get-env') as Promise<Record<string, string>>,

  // News – proxied through main process to bypass origin restrictions
  newsGetHeadlines: (params: { apiKey: string; category?: string; page?: number; pageSize?: number }) =>
    ipcRenderer.invoke('news:get-headlines', params) as Promise<{ status: string; totalResults: number; articles: unknown[] }>,

  // YouTube – open a video in a standalone pop-out window
  openYouTubeWindow: (videoId: string) => ipcRenderer.invoke('youtube:open-window', videoId),

  // Spotify – fetch playlists + top tracks for the Spotify content page
  spotifyGetContent: () => ipcRenderer.invoke('spotify:get-content') as Promise<{
    playlists: any[];
    topTracks: any[];
    profile: any;
  }>,

  // Jellyfin – fetch recently added + resume items for the Jellyfin content page
  jellyfinGetContent: () => ipcRenderer.invoke('jellyfin:get-content') as Promise<{
    recentItems: any[];
    resumeItems: any[];
    serverUrl: string;
    accessToken: string;
  }>,

  // Twitter / X – fetch recent tweets for a user (proxied through main)
  twitterGetUserTweets: (params: { bearerToken: string; username: string; maxResults?: number }) =>
    ipcRenderer.invoke('twitter:get-user-tweets', params) as Promise<{
      user: { id: string; name: string; username: string };
      tweets: Array<{
        id: string;
        text: string;
        created_at: string;
        public_metrics: { like_count: number; retweet_count: number };
        in_reply_to_user_id?: string;
        referenced_tweets?: Array<{ type: string; id: string }>;
      }>;
      includes: { tweets?: Array<{ id: string; text: string }> };
    }>,

  // Events from main process (tray controls, etc.)
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = [
      'tray:toggle-playback',
      'tray:next-track',
      'tray:prev-track',
    ];
    if (validChannels.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
    return () => {};
  },

  // Platform info
  platform: process.platform,
};

// ---------------------------------------------------------------------------
// Expose to renderer
// ---------------------------------------------------------------------------

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for renderer-side usage
export type ElectronAPI = typeof electronAPI;
