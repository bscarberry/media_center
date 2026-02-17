// ============================================================================
// useJellyfinPlayer – React hook for Jellyfin playback and library browsing
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { JellyfinClient } from '../services/jellyfin/JellyfinClient';
import { JellyfinAudioPlayer } from '../services/jellyfin/JellyfinAudioPlayer';
import type {
  JellyfinConfig,
  JellyfinItem,
  JellyfinBaseItem,
  JellyfinQueryResult,
} from '../types/jellyfin';
import type { UnifiedPlaybackState } from '../types/spotify';

export interface UseJellyfinPlayerOptions {
  config: JellyfinConfig;
  /** Auto-authenticate on mount if credentials are in config (default: true). */
  autoConnect?: boolean;
}

export interface UseJellyfinPlayerReturn {
  // Player state
  state: UnifiedPlaybackState | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isConnected: boolean;
  error: string | null;

  // Auth
  authenticate: (username?: string, password?: string) => Promise<void>;
  logout: () => void;

  // Playback controls
  play: (item: JellyfinItem) => void;
  playQueue: (items: JellyfinItem[], startIndex?: number) => void;
  pause: () => void;
  resume: () => void;
  seek: (positionMs: number) => void;
  setVolume: (volume: number) => void;
  skipNext: () => void;
  skipPrevious: () => void;

  // Library browsing
  getLibraries: () => Promise<JellyfinBaseItem[]>;
  getArtists: () => Promise<JellyfinQueryResult>;
  getAlbums: (artistId?: string) => Promise<JellyfinQueryResult>;
  getTracks: (albumId: string) => Promise<JellyfinQueryResult>;
  search: (query: string) => Promise<JellyfinQueryResult>;
  getRecentlyAdded: (limit?: number) => Promise<JellyfinQueryResult>;
  getFavorites: () => Promise<JellyfinQueryResult>;

  // Favorites
  markFavorite: (itemId: string) => Promise<void>;
  unmarkFavorite: (itemId: string) => Promise<void>;

  // Utilities
  toItem: (baseItem: JellyfinBaseItem) => JellyfinItem;
  getImageUrl: (itemId: string) => string;

  /** Disconnect and clean up. */
  disconnect: () => void;
}

export function useJellyfinPlayer(
  options: UseJellyfinPlayerOptions,
): UseJellyfinPlayerReturn {
  const { config, autoConnect = true } = options;

  const clientRef = useRef<JellyfinClient | null>(null);
  const audioRef = useRef<JellyfinAudioPlayer | null>(null);

  const [state, setState] = useState<UnifiedPlaybackState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  const getOrCreateClient = useCallback((): JellyfinClient => {
    if (!clientRef.current) {
      clientRef.current = new JellyfinClient(configRef.current);
    }
    return clientRef.current;
  }, []);

  const getOrCreateAudio = useCallback((): JellyfinAudioPlayer => {
    if (!audioRef.current) {
      const client = getOrCreateClient();
      audioRef.current = new JellyfinAudioPlayer(client, configRef.current);
    }
    return audioRef.current;
  }, [getOrCreateClient]);

  const attachListeners = useCallback(
    (client: JellyfinClient, audio: JellyfinAudioPlayer) => {
      client.on('auth_success', () => {
        setIsAuthenticated(true);
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
      });

      client.on('auth_error', ({ message }) => {
        setError(`Authentication error: ${message}`);
        setIsLoading(false);
      });

      client.on('connection_lost', () => {
        setIsConnected(false);
        setError('Connection to Jellyfin server lost. Reconnecting...');
      });

      client.on('connection_restored', () => {
        setIsConnected(true);
        setError(null);
      });

      client.on('error', ({ message }) => {
        setError(message);
      });

      audio.on('state_changed', (unified) => {
        setState(unified);
      });

      audio.on('error', ({ message }) => {
        setError(`Playback error: ${message}`);
      });
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------

  const authenticate = useCallback(
    async (username?: string, password?: string) => {
      setIsLoading(true);
      setError(null);

      const client = getOrCreateClient();
      const audio = getOrCreateAudio();
      attachListeners(client, audio);

      try {
        await client.authenticate(username, password);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Authentication failed';
        setError(msg);
        setIsLoading(false);
      }
    },
    [getOrCreateClient, getOrCreateAudio, attachListeners],
  );

  const logout = useCallback(() => {
    audioRef.current?.disconnect();
    audioRef.current = null;
    clientRef.current?.logout();
    clientRef.current = null;
    setState(null);
    setIsAuthenticated(false);
    setIsConnected(false);
    setError(null);
  }, []);

  const disconnect = useCallback(() => {
    audioRef.current?.disconnect();
    audioRef.current = null;
    clientRef.current = null;
    setState(null);
    setIsAuthenticated(false);
    setIsConnected(false);
    setIsLoading(false);
    setError(null);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    const client = getOrCreateClient();
    if (autoConnect && client.isAuthenticated()) {
      // Restore existing session
      const audio = getOrCreateAudio();
      attachListeners(client, audio);
      setIsAuthenticated(true);
      setIsConnected(true);
    } else if (autoConnect && (config.username || config.apiKey)) {
      authenticate();
    }
    return () => {
      audioRef.current?.disconnect();
      audioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------------------------------------------------------
  // Playback controls
  // -----------------------------------------------------------------------

  const play = useCallback((item: JellyfinItem) => {
    getOrCreateAudio().play(item);
  }, [getOrCreateAudio]);

  const playQueue = useCallback(
    (items: JellyfinItem[], startIndex = 0) => {
      getOrCreateAudio().playQueue(items, startIndex);
    },
    [getOrCreateAudio],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.resume();
  }, []);

  const seek = useCallback((positionMs: number) => {
    audioRef.current?.seek(positionMs);
  }, []);

  const setVolume = useCallback((volume: number) => {
    audioRef.current?.setVolume(volume);
  }, []);

  const skipNext = useCallback(() => {
    audioRef.current?.skipNext();
  }, []);

  const skipPrevious = useCallback(() => {
    audioRef.current?.skipPrevious();
  }, []);

  // -----------------------------------------------------------------------
  // Library browsing (delegate to client)
  // -----------------------------------------------------------------------

  const withClient = useCallback(
    <T>(fn: (c: JellyfinClient) => Promise<T>): Promise<T> => {
      const client = getOrCreateClient();
      return fn(client).catch((err) => {
        setError(err instanceof Error ? err.message : 'Library error');
        throw err;
      });
    },
    [getOrCreateClient],
  );

  const getLibraries = useCallback(
    () => withClient((c) => c.getLibraries()),
    [withClient],
  );

  const getArtists = useCallback(
    () => withClient((c) => c.getArtists()),
    [withClient],
  );

  const getAlbums = useCallback(
    (artistId?: string) => withClient((c) => c.getAlbums(artistId)),
    [withClient],
  );

  const getTracks = useCallback(
    (albumId: string) => withClient((c) => c.getTracks(albumId)),
    [withClient],
  );

  const searchFn = useCallback(
    (query: string) => withClient((c) => c.search(query)),
    [withClient],
  );

  const getRecentlyAdded = useCallback(
    (limit = 30) => withClient((c) => c.getRecentlyAdded(limit)),
    [withClient],
  );

  const getFavorites = useCallback(
    () => withClient((c) => c.getFavorites()),
    [withClient],
  );

  const markFavorite = useCallback(
    (itemId: string) => withClient((c) => c.markFavorite(itemId)),
    [withClient],
  );

  const unmarkFavorite = useCallback(
    (itemId: string) => withClient((c) => c.unmarkFavorite(itemId)),
    [withClient],
  );

  const toItem = useCallback(
    (baseItem: JellyfinBaseItem) => getOrCreateClient().toItem(baseItem),
    [getOrCreateClient],
  );

  const getImageUrl = useCallback(
    (itemId: string) => getOrCreateClient().getImageUrl(itemId),
    [getOrCreateClient],
  );

  return {
    state,
    isLoading,
    isAuthenticated,
    isConnected,
    error,
    authenticate,
    logout,
    play,
    playQueue,
    pause,
    resume,
    seek,
    setVolume,
    skipNext,
    skipPrevious,
    getLibraries,
    getArtists,
    getAlbums,
    getTracks,
    search: searchFn,
    getRecentlyAdded,
    getFavorites,
    markFavorite,
    unmarkFavorite,
    toItem,
    getImageUrl,
    disconnect,
  };
}
