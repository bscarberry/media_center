// ============================================================================
// useSpotifyPlayer – React hook for Spotify Web Playback SDK
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { SpotifyWebPlayback } from '../services/spotify/SpotifyWebPlayback';
import { TokenManager } from '../services/spotify/TokenManager';
import type { UnifiedPlaybackState } from '../types/spotify';

export interface UseSpotifyPlayerOptions {
  tokenManager: TokenManager;
  /** Auto-initialize on mount (default: true). */
  autoConnect?: boolean;
}

export interface UseSpotifyPlayerReturn {
  /** Current playback state (null when nothing is playing). */
  state: UnifiedPlaybackState | null;
  /** Spotify Connect device ID (available after ready). */
  deviceId: string | null;
  /** True while the player is connecting for the first time. */
  isLoading: boolean;
  /** True once the player is connected and ready. */
  isReady: boolean;
  /** Last error message, if any. */
  error: string | null;

  // Controls
  play: (uri: string) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;

  /** Manually (re-)initialize the player. */
  initialize: () => Promise<void>;
  /** Disconnect and clean up. */
  disconnect: () => void;
}

export function useSpotifyPlayer(
  options: UseSpotifyPlayerOptions,
): UseSpotifyPlayerReturn {
  const { tokenManager, autoConnect = true } = options;

  const playerRef = useRef<SpotifyWebPlayback | null>(null);

  const [state, setState] = useState<UnifiedPlaybackState | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable reference to tokenManager across renders.
  const tokenManagerRef = useRef(tokenManager);
  tokenManagerRef.current = tokenManager;

  // -----------------------------------------------------------------------
  // Player lifecycle
  // -----------------------------------------------------------------------

  const getOrCreatePlayer = useCallback((): SpotifyWebPlayback => {
    if (!playerRef.current) {
      playerRef.current = new SpotifyWebPlayback(tokenManagerRef.current);
    }
    return playerRef.current;
  }, []);

  const attachListeners = useCallback((player: SpotifyWebPlayback) => {
    player.on('ready', ({ device_id }) => {
      setDeviceId(device_id);
      setIsReady(true);
      setIsLoading(false);
      setError(null);
    });

    player.on('not_ready', () => {
      setDeviceId(null);
      setIsReady(false);
    });

    player.on('player_state_changed', (unified) => {
      setState(unified);
    });

    player.on('initialization_error', ({ message }) => {
      setError(`Initialization error: ${message}`);
      setIsLoading(false);
    });

    player.on('authentication_error', ({ message }) => {
      setError(`Authentication error: ${message}`);
      setIsLoading(false);
    });

    player.on('account_error', ({ message }) => {
      setError(message);
      setIsLoading(false);
    });

    player.on('playback_error', ({ message }) => {
      setError(`Playback error: ${message}`);
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
      const msg =
        err instanceof Error ? err.message : 'Failed to initialize player';
      setError(msg);
      setIsLoading(false);
    }
  }, [getOrCreatePlayer, attachListeners]);

  const disconnect = useCallback(() => {
    playerRef.current?.disconnect();
    playerRef.current = null;
    setState(null);
    setDeviceId(null);
    setIsReady(false);
    setIsLoading(false);
    setError(null);
  }, []);

  // Auto-connect on mount, clean up on unmount
  useEffect(() => {
    if (autoConnect) {
      initialize();
    }
    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
    // Run only on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Wrapped controls (with error handling)
  // -----------------------------------------------------------------------

  const withErrorHandling = useCallback(
    (fn: () => Promise<void>): Promise<void> =>
      fn().catch((err) => {
        setError(
          err instanceof Error ? err.message : 'An unknown error occurred',
        );
      }),
    [],
  );

  const play = useCallback(
    (uri: string) =>
      withErrorHandling(() => {
        if (!playerRef.current) throw new Error('Player not initialized');
        return playerRef.current.play(uri);
      }),
    [withErrorHandling],
  );

  const pause = useCallback(
    () =>
      withErrorHandling(() => {
        if (!playerRef.current) throw new Error('Player not initialized');
        return playerRef.current.pause();
      }),
    [withErrorHandling],
  );

  const resume = useCallback(
    () =>
      withErrorHandling(() => {
        if (!playerRef.current) throw new Error('Player not initialized');
        return playerRef.current.resume();
      }),
    [withErrorHandling],
  );

  const seek = useCallback(
    (positionMs: number) =>
      withErrorHandling(() => {
        if (!playerRef.current) throw new Error('Player not initialized');
        return playerRef.current.seek(positionMs);
      }),
    [withErrorHandling],
  );

  const setVolumeCtrl = useCallback(
    (volume: number) =>
      withErrorHandling(() => {
        if (!playerRef.current) throw new Error('Player not initialized');
        return playerRef.current.setVolume(volume);
      }),
    [withErrorHandling],
  );

  const skipNext = useCallback(
    () =>
      withErrorHandling(() => {
        if (!playerRef.current) throw new Error('Player not initialized');
        return playerRef.current.skipNext();
      }),
    [withErrorHandling],
  );

  const skipPrevious = useCallback(
    () =>
      withErrorHandling(() => {
        if (!playerRef.current) throw new Error('Player not initialized');
        return playerRef.current.skipPrevious();
      }),
    [withErrorHandling],
  );

  return {
    state,
    deviceId,
    isLoading,
    isReady,
    error,
    play,
    pause,
    resume,
    seek,
    setVolume: setVolumeCtrl,
    skipNext,
    skipPrevious,
    initialize,
    disconnect,
  };
}
