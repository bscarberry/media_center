// ============================================================================
// Type declarations for the Electron API bridge (preload → renderer)
// ============================================================================

export interface ElectronAPI {
  // Shell
  openExternal: (url: string) => Promise<void>;

  // App info
  getAppPath: (name: string) => Promise<string>;
  getVersion: () => Promise<string>;

  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // Persistent key-value store
  store: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
    delete: (key: string) => Promise<void>;
  };

  // OAuth helpers
  startOAuthServer: (port: number) => Promise<{ port: number }>;

  // Events from main process
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void;

  // Platform info
  platform: NodeJS.Platform;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
