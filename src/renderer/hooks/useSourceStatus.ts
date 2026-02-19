// ============================================================================
// useSourceStatus – checks connection status for Spotify, YouTube, Jellyfin
// ============================================================================
//
// Queries the main process via IPC to check whether encrypted token stores
// contain valid credentials for each media service.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';

export interface SourceStatus {
  spotify: boolean;
  youtube: boolean;
  jellyfin: boolean;
}

// Type-safe access to the electron bridge
interface ElectronAuthAPI {
  auth: {
    getStatus: () => Promise<SourceStatus>;
    clearTokens: (service: string) => Promise<boolean>;
  };
}

function getElectronAPI(): ElectronAuthAPI | null {
  const api = (window as any).electronAPI;
  if (api?.auth?.getStatus) return api as ElectronAuthAPI;
  return null;
}

const DEFAULT_STATUS: SourceStatus = { spotify: false, youtube: false, jellyfin: false };

/**
 * Periodically checks whether each media source has stored credentials
 * by querying the main process encrypted token stores via IPC.
 */
export function useSourceStatus(intervalMs = 5_000): {
  status: SourceStatus;
  loading: boolean;
  refresh: () => void;
} {
  const [status, setStatus] = useState<SourceStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const api = getElectronAPI();
    if (!api) {
      // Not running in Electron – fall back to localStorage
      const result = { ...DEFAULT_STATUS };
      try {
        result.spotify = localStorage.getItem('media-hub:spotify-connected') === 'true';
        result.youtube = localStorage.getItem('media-hub:youtube-connected') === 'true';
        result.jellyfin = localStorage.getItem('media-hub:jellyfin-connected') === 'true';
      } catch { /* ignore */ }
      if (mountedRef.current) {
        setStatus(result);
        setLoading(false);
      }
      return;
    }

    try {
      const result = await api.auth.getStatus();
      if (mountedRef.current) {
        setStatus(result);
        setLoading(false);
      }
    } catch (err) {
      console.warn('[useSourceStatus] Failed to check auth status:', err);
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Initial check + periodic polling
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [refresh, intervalMs]);

  // Listen for custom events fired when services connect/disconnect
  useEffect(() => {
    const handler = () => { refresh(); };
    window.addEventListener('media-hub:source-changed', handler);
    return () => window.removeEventListener('media-hub:source-changed', handler);
  }, [refresh]);

  return { status, loading, refresh };
}

/**
 * Call this from auth services when connection status changes.
 * Sets localStorage flag and dispatches an event for the hook to pick up.
 */
export function setSourceConnected(source: 'spotify' | 'youtube' | 'jellyfin', connected: boolean): void {
  try {
    localStorage.setItem(`media-hub:${source}-connected`, String(connected));
    window.dispatchEvent(new CustomEvent('media-hub:source-changed', { detail: { source, connected } }));
  } catch {
    // Storage unavailable
  }
}

/**
 * Disconnect a service by clearing its tokens from the encrypted store.
 */
export async function disconnectSource(source: 'spotify' | 'youtube' | 'jellyfin'): Promise<boolean> {
  const api = getElectronAPI();
  if (api) {
    const result = await api.auth.clearTokens(source);
    setSourceConnected(source, false);
    return result;
  }
  setSourceConnected(source, false);
  return true;
}
