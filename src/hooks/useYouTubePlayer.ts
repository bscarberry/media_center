// ============================================================================
// useYouTubePlayer – React hook for YouTube playback
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { YouTubePlayer } from '../services/youtube/YouTubePlayer';
import type { YouTubePlaybackMode } from '../types/youtube';
import type { UnifiedPlaybackState } from '../types/spotify';

export interface UseYouTubePlayerOptions {
  /** Playback mode: 'iframe' (official embed) or 'extract' (yt-dlp audio). */
  mode?: YouTubePlaybackMode;
  /** Auto-initialize on mount (default: true). */
  autoConnect?: boolean;
}

export interface UseYouTubePlayerReturn {
  state: UnifiedPlaybackState | null;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  mode: YouTubePlaybackMode;

  // Controls
  play: (videoId: string, title?: string, artist?: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  seek: (positionMs: number) => void;
  setVolume: (volume: number) => void;
  setMode: (mode: YouTubePlaybackMode) => Promise<void>;

  /** Manually initialize the player. */
  initialize: () => Promise<void>;
  /** Disconnect and clean up. */
  disconnect: () => void;
}

export function useYouTubePlayer(
  options: UseYouTubePlayerOptions = {},
): UseYouTubePlayerReturn {
  const { mode: initialMode = 'iframe', autoConnect = true } = options;

  const playerRef = useRef<YouTubePlayer | null>(null);

  const [state, setState] = useState<UnifiedPlaybackState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setModeState] = useState<YouTubePlaybackMode>(initialMode);

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  const getOrCreatePlayer = useCallback((): YouTubePlayer => {
    if (!playerRef.current) {
      playerRef.current = new YouTubePlayer(mode);
    }
    return playerRef.current;
  // We intentionally want `mode` at creation time only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const attachListeners = useCallback((player: YouTubePlayer) => {
    player.on('ready', () => {
      setIsReady(true);
      setIsLoading(false);
      setError(null);
    });

    player.on('state_changed', (unified) => {
      setState(unified);
    });

    player.on('error', ({ message }) => {
      setError(message);
    });

    player.on('mode_changed', ({ mode: newMode }) => {
      setModeState(newMode);
    });

    player.on('url_expired', () => {
      // The player auto-refreshes; just note it for the user.
      setError('Stream URL expired — refreshing...');
      setTimeout(() => setError(null), 3000);
    });
  }, []);

  const initialize = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const player = getOrCreatePlayer();
    attachListeners(player);

    try {
      await player.initialize();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to initialize YouTube player',
      );
      setIsLoading(false);
    }
  }, [getOrCreatePlayer, attachListeners]);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    setState(null);
    setIsReady(false);
    setIsLoading(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (autoConnect) {
      initialize();
    }
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Controls
  // -----------------------------------------------------------------------

  const withErrorHandling = useCallback(
    (fn: () => Promise<void>): Promise<void> =>
      fn().catch((err) => {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      }),
    [],
  );

  const play = useCallback(
    (videoId: string, title?: string, artist?: string) =>
      withErrorHandling(async () => {
        if (!playerRef.current) throw new Error('Player not initialized');
        await playerRef.current.play(videoId, title, artist);
      }),
    [withErrorHandling],
  );

  const pause = useCallback(() => {
    playerRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    playerRef.current?.resume();
  }, []);

  const seek = useCallback((positionMs: number) => {
    playerRef.current?.seek(positionMs);
  }, []);

  const setVolume = useCallback((volume: number) => {
    playerRef.current?.setVolume(volume);
  }, []);

  const setMode = useCallback(
    (newMode: YouTubePlaybackMode) =>
      withErrorHandling(async () => {
        if (!playerRef.current) throw new Error('Player not initialized');
        await playerRef.current.setMode(newMode);
      }),
    [withErrorHandling],
  );

  return {
    state,
    isLoading,
    isReady,
    error,
    mode,
    play,
    pause,
    resume,
    seek,
    setVolume,
    setMode,
    initialize,
    disconnect,
  };
}
