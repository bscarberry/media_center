// ============================================================================
// electron-store stub for the renderer build
//
// electron-store requires Node.js APIs (path, fs, crypto) that are not
// available in the Vite-built renderer bundle. This stub replaces it so
// that service classes (TokenManager, JellyfinClient, etc.) can be imported
// without crashing. All real token/session persistence is handled by the
// main process and accessed via IPC — the renderer never needs actual storage.
// ============================================================================

export default class Store<T extends Record<string, unknown> = Record<string, unknown>> {
  private data: Partial<T> = {};

  constructor(_options?: Record<string, unknown>) {
    // no-op: storage is managed by the main process
  }

  get<K extends keyof T>(key: K): T[K] | undefined {
    return this.data[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.data[key] = value;
  }

  delete<K extends keyof T>(key: K): void {
    delete this.data[key];
  }

  has<K extends keyof T>(key: K): boolean {
    return key in this.data;
  }

  clear(): void {
    this.data = {};
  }
}
