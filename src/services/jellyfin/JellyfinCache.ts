// ============================================================================
// JellyfinCache – offline download and cache management
// ============================================================================

import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { JellyfinPlayer } from './JellyfinPlayer';
import { JellyfinClient } from './JellyfinClient';
import type {
  JellyfinConfig,
  CachedTrack,
  CacheStats,
  JellyfinItem,
} from '../../types/jellyfin';

// ---------------------------------------------------------------------------
// Persistent cache index
// ---------------------------------------------------------------------------

interface CacheStoreSchema {
  cachedTracks: Record<string, CachedTrack>;
}

const CACHE_DEFAULTS: CacheStoreSchema = { cachedTracks: {} };

// ---------------------------------------------------------------------------
// JellyfinCache
// ---------------------------------------------------------------------------

export class JellyfinCache {
  private config: JellyfinConfig;
  private client: JellyfinClient;
  private player: JellyfinPlayer;
  private store: Store<CacheStoreSchema>;
  private downloadQueue: JellyfinItem[] = [];
  private isDownloading = false;

  constructor(
    client: JellyfinClient,
    config: JellyfinConfig,
  ) {
    this.config = config;
    this.client = client;
    this.player = new JellyfinPlayer(client, config);
    this.store = new Store<CacheStoreSchema>({
      name: 'jellyfin-cache-index',
      defaults: CACHE_DEFAULTS,
      encryptionKey: 'brandons-media-hub-jf-cache-v1',
    });

    // Ensure cache directory exists
    this.ensureCacheDir();
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------

  /** Check whether a track is cached locally. */
  isCached(itemId: string): boolean {
    const tracks = this.store.get('cachedTracks');
    const entry = tracks[itemId];
    if (!entry) return false;

    // Verify the file still exists on disk
    if (!fs.existsSync(entry.filePath)) {
      this.removeCacheEntry(itemId);
      return false;
    }
    return true;
  }

  /** Get the local file path for a cached track, or null. */
  getCachedPath(itemId: string): string | null {
    if (!this.isCached(itemId)) return null;
    return this.store.get('cachedTracks')[itemId].filePath;
  }

  /**
   * Download a track to the local cache.
   * Returns the local file path on success.
   */
  async downloadTrack(item: JellyfinItem): Promise<string> {
    if (this.isCached(item.id)) {
      return this.store.get('cachedTracks')[item.id].filePath;
    }

    // Ensure we have room
    await this.ensureSpace(0); // just clean up expired; actual size check below

    const url = this.player.getDirectPlayUrl(item.id);
    const ext = item.codec ?? 'mp3';
    const fileName = `${item.id}.${ext}`;
    const filePath = path.join(this.config.cacheDirectory, fileName);

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(
        `Failed to download track ${item.id}: ${res.status}`,
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Check if adding this file exceeds the cache limit
    const stats = this.getStats();
    if (stats.totalSize + buffer.length > this.config.maxCacheSize) {
      await this.ensureSpace(buffer.length);
      // Re-check after cleanup
      const updated = this.getStats();
      if (updated.totalSize + buffer.length > this.config.maxCacheSize) {
        throw new Error(
          'Cache is full. Increase JELLYFIN_MAX_CACHE_SIZE or clear the cache.',
        );
      }
    }

    fs.writeFileSync(filePath, buffer);

    const entry: CachedTrack = {
      itemId: item.id,
      filePath,
      fileSize: buffer.length,
      cachedAt: Date.now(),
      title: item.title,
      artist: item.artist,
    };

    const tracks = this.store.get('cachedTracks');
    tracks[item.id] = entry;
    this.store.set('cachedTracks', tracks);

    return filePath;
  }

  /** Add items to the download queue and start processing. */
  enqueueDownloads(items: JellyfinItem[]): void {
    for (const item of items) {
      if (!this.isCached(item.id)) {
        this.downloadQueue.push(item);
      }
    }
    this.processQueue();
  }

  /** Remove a cached track. */
  removeTrack(itemId: string): void {
    const tracks = this.store.get('cachedTracks');
    const entry = tracks[itemId];
    if (entry) {
      try {
        fs.unlinkSync(entry.filePath);
      } catch {
        // File may already be deleted
      }
      this.removeCacheEntry(itemId);
    }
  }

  /** Clear the entire cache. */
  clearCache(): void {
    const tracks = this.store.get('cachedTracks');
    for (const entry of Object.values(tracks)) {
      try {
        fs.unlinkSync(entry.filePath);
      } catch {
        // continue
      }
    }
    this.store.set('cachedTracks', {});
  }

  /** Get cache size stats. */
  getStats(): CacheStats {
    const tracks = this.store.get('cachedTracks');
    let totalSize = 0;
    let trackCount = 0;

    for (const entry of Object.values(tracks)) {
      totalSize += entry.fileSize;
      trackCount++;
    }

    return {
      totalSize,
      trackCount,
      maxSize: this.config.maxCacheSize,
    };
  }

  /** Get all cached track entries. */
  getCachedTracks(): CachedTrack[] {
    return Object.values(this.store.get('cachedTracks'));
  }

  // -----------------------------------------------------------------------
  // Internal
  // -----------------------------------------------------------------------

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.config.cacheDirectory)) {
      fs.mkdirSync(this.config.cacheDirectory, { recursive: true });
    }
  }

  private removeCacheEntry(itemId: string): void {
    const tracks = this.store.get('cachedTracks');
    delete tracks[itemId];
    this.store.set('cachedTracks', tracks);
  }

  /**
   * Evict oldest cached tracks until `bytesNeeded` can fit.
   */
  private async ensureSpace(bytesNeeded: number): Promise<void> {
    const stats = this.getStats();
    let toFree = stats.totalSize + bytesNeeded - this.config.maxCacheSize;

    if (toFree <= 0) return;

    // Sort by cachedAt ascending (oldest first)
    const entries = this.getCachedTracks().sort(
      (a, b) => a.cachedAt - b.cachedAt,
    );

    for (const entry of entries) {
      if (toFree <= 0) break;
      this.removeTrack(entry.itemId);
      toFree -= entry.fileSize;
    }
  }

  /** Process the download queue one item at a time. */
  private async processQueue(): Promise<void> {
    if (this.isDownloading) return;
    this.isDownloading = true;

    while (this.downloadQueue.length > 0) {
      const item = this.downloadQueue.shift()!;
      try {
        await this.downloadTrack(item);
      } catch {
        // Skip failed downloads; don't block the queue
      }
    }

    this.isDownloading = false;
  }
}
