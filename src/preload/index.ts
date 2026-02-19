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

  // Auth status
  auth: {
    getStatus: () => ipcRenderer.invoke('auth:get-status') as Promise<{ spotify: boolean; youtube: boolean; jellyfin: boolean }>,
    clearTokens: (service: string) => ipcRenderer.invoke('auth:clear-tokens', service) as Promise<boolean>,
  },

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
