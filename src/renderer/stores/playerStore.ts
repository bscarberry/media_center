// ============================================================================
// playerStore – Zustand store backed by UnifiedMediaRouter
// ============================================================================

import { createStore } from 'zustand/vanilla';
import { UnifiedMediaRouter } from '../services/player/MediaRouter';
import {
  EMPTY_PLAYBACK_STATE,
  type MediaTrack,
  type PlaybackState,
  type RepeatMode,
  type MediaRouterConfig,
  type MediaSourceType,
} from '../types/media';

// ---------------------------------------------------------------------------
// Store state + actions
// ---------------------------------------------------------------------------

export interface PlayerState {
  // Playback
  currentTrack: MediaTrack | null;
  playbackState: PlaybackState;
  queue: MediaTrack[];
  currentIndex: number;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;

  // Status
  isReady: boolean;
  error: string | null;
}

export interface PlayerActions {
  // Playback
  playTrack: (track: MediaTrack) => Promise<void>;
  playQueue: (tracks: MediaTrack[], startIndex?: number) => Promise<void>;
  togglePlayPause: () => Promise<void>;
  skipNext: () => Promise<void>;
  skipPrevious: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;

  // Queue
  addToQueue: (tracks: MediaTrack[]) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  clearQueue: () => void;

  // Modes
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;

  // Crossfade
  setCrossfadeDuration: (seconds: number) => void;

  // Lifecycle
  dispose: () => Promise<void>;
}

export type PlayerStore = PlayerState & PlayerActions;

// ---------------------------------------------------------------------------
// Factory: creates a store bound to a router instance
// ---------------------------------------------------------------------------

export function createPlayerStore(router: UnifiedMediaRouter) {
  const store = createStore<PlayerStore>((set, get) => {
    // --- Wire up router events to update the store --------------------------

    router.on('state_changed', (state: PlaybackState) => {
      set({ playbackState: state, currentTrack: state.track });
    });

    router.on('track_changed', (track: MediaTrack | null) => {
      set({ currentTrack: track, error: null });
    });

    router.on('queue_changed', ({ queue, currentIndex }) => {
      set({ queue, currentIndex });
    });

    router.on('error', ({ message }) => {
      set({ error: message });
    });

    // --- Initial state ------------------------------------------------------

    return {
      currentTrack: null,
      playbackState: { ...EMPTY_PLAYBACK_STATE },
      queue: [],
      currentIndex: -1,
      shuffleEnabled: false,
      repeatMode: 'off' as RepeatMode,
      isReady: true,
      error: null,

      // -- Playback actions --------------------------------------------------

      playTrack: async (track: MediaTrack) => {
        set({ error: null });
        try {
          // Set as single-item queue
          await router.playQueue([track], 0);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      playQueue: async (tracks: MediaTrack[], startIndex = 0) => {
        set({ error: null });
        try {
          await router.playQueue(tracks, startIndex);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      togglePlayPause: async () => {
        try {
          await router.togglePlayPause();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      skipNext: async () => {
        const { repeatMode, queue, currentIndex } = get();

        // Repeat-one: restart current track
        if (repeatMode === 'one') {
          await router.seek(0);
          return;
        }

        // Repeat-all: wrap around
        if (repeatMode === 'all' && currentIndex >= queue.length - 1 && queue.length > 0) {
          await router.playQueue(queue, 0);
          return;
        }

        try {
          await router.skipNext();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      skipPrevious: async () => {
        const { repeatMode } = get();

        if (repeatMode === 'one') {
          await router.seek(0);
          return;
        }

        try {
          await router.skipPrevious();
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      seek: async (positionMs: number) => {
        try {
          await router.seek(positionMs);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      setVolume: async (volume: number) => {
        try {
          await router.setVolume(volume);
        } catch (err) {
          set({ error: err instanceof Error ? err.message : String(err) });
        }
      },

      // -- Queue actions -----------------------------------------------------

      addToQueue: (tracks: MediaTrack[]) => {
        router.addToQueue(tracks);
      },

      removeFromQueue: (index: number) => {
        router.removeFromQueue(index);
      },

      reorderQueue: (fromIndex: number, toIndex: number) => {
        router.reorderQueue(fromIndex, toIndex);
      },

      clearQueue: () => {
        router.clearQueue();
      },

      // -- Mode actions ------------------------------------------------------

      toggleShuffle: () => {
        const next = !get().shuffleEnabled;
        router.setShuffleEnabled(next);
        set({ shuffleEnabled: next });
      },

      cycleRepeatMode: () => {
        const modes: RepeatMode[] = ['off', 'all', 'one'];
        const current = get().repeatMode;
        const idx = modes.indexOf(current);
        const next = modes[(idx + 1) % modes.length];
        set({ repeatMode: next });
      },

      // -- Crossfade ---------------------------------------------------------

      setCrossfadeDuration: (seconds: number) => {
        router.enableCrossfade(seconds);
      },

      // -- Lifecycle ---------------------------------------------------------

      dispose: async () => {
        await router.dispose();
        set({
          currentTrack: null,
          playbackState: { ...EMPTY_PLAYBACK_STATE },
          queue: [],
          currentIndex: -1,
          error: null,
        });
      },
    };
  });

  return store;
}
