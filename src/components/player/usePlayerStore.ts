// ============================================================================
// usePlayerStore – React bridge for the vanilla Zustand player store
// ============================================================================
//
// The playerStore is created with zustand/vanilla (createStore) so it can
// work outside of React.  This hook wraps it for React components using
// zustand's `useStore`.
//
// Usage:
//   const store = createPlayerStore(router);
//   <PlayerStoreContext.Provider value={store}> ... </PlayerStoreContext.Provider>
//
//   // In any child component:
//   const { playbackState, togglePlayPause } = usePlayerStore();
// ============================================================================

import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { PlayerStore } from '../../stores/playerStore';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const PlayerStoreContext = createContext<StoreApi<PlayerStore> | null>(null);

// ---------------------------------------------------------------------------
// Hook – full store
// ---------------------------------------------------------------------------

export function usePlayerStore(): PlayerStore;
export function usePlayerStore<T>(selector: (state: PlayerStore) => T): T;
export function usePlayerStore<T>(selector?: (state: PlayerStore) => T) {
  const store = useContext(PlayerStoreContext);
  if (!store) {
    throw new Error('usePlayerStore must be used within a <PlayerStoreContext.Provider>');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useStore(store, selector as any);
}
