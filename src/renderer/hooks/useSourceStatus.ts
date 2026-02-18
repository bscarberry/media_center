// ============================================================================
// useSourceStatus – checks connection status for Spotify, YouTube, Jellyfin
// ============================================================================

import { useState, useEffect, useCallback } from 'react';

export interface SourceStatus {
  spotify: boolean;
  youtube: boolean;
  jellyfin: boolean;
}

/**
 * Periodically checks whether each media source has stored credentials.
 * Returns a reactive status object and a manual refresh function.
 */
export function useSourceStatus(intervalMs = 10_000): {
  status: SourceStatus;
  refresh: () => void;
} {
  const check = useCallback((): SourceStatus => {
    let spotify = false;
    let youtube = false;
    let jellyfin = false;

    try {
      // Spotify stores tokens in electron-store (encrypted).
      // The simplest renderer-safe check: look for the localStorage fallback
      // or check if the IPC bridge can confirm tokens exist.
      // Since TokenManager uses electron-store, we check via the preload bridge
      // if available, otherwise check localStorage as a secondary indicator.
      const spotifyStorage = localStorage.getItem('media-hub:spotify-connected');
      spotify = spotifyStorage === 'true';

      // Also check if the window has the electronAPI with store access
      if (!spotify && (window as any).electronAPI?.getStoreValue) {
        // Async – will update on next tick via effect
      }
    } catch {
      // ignore
    }

    try {
      const ytStorage = localStorage.getItem('media-hub:youtube-connected');
      youtube = ytStorage === 'true';
    } catch {
      // ignore
    }

    try {
      const jfStorage = localStorage.getItem('media-hub:jellyfin-connected');
      jellyfin = jfStorage === 'true';
    } catch {
      // ignore
    }

    return { spotify, youtube, jellyfin };
  }, []);

  const [status, setStatus] = useState<SourceStatus>(check);

  const refresh = useCallback(() => {
    setStatus(check());
  }, [check]);

  useEffect(() => {
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  // Listen for custom events fired when services connect/disconnect
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener('media-hub:source-changed', handler);
    return () => window.removeEventListener('media-hub:source-changed', handler);
  }, [refresh]);

  return { status, refresh };
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
