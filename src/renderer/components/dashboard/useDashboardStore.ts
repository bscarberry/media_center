// ============================================================================
// useDashboardStore – React bridge for the vanilla Zustand dashboard store
// ============================================================================

import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { DashboardStore } from '../../stores/dashboardStore';

export const DashboardStoreContext = createContext<StoreApi<DashboardStore> | null>(null);

export function useDashboardStore(): DashboardStore;
export function useDashboardStore<T>(selector: (state: DashboardStore) => T): T;
export function useDashboardStore<T>(selector?: (state: DashboardStore) => T) {
  const store = useContext(DashboardStoreContext);
  if (!store) {
    throw new Error('useDashboardStore must be used within a <DashboardStoreContext.Provider>');
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useStore(store, selector as any);
}
