// ============================================================================
// NewsService – fetches news articles from NewsAPI
// ============================================================================
//
// Supports headline fetching by category, keyword search, trending topics,
// and multiple sources. Results are cached with 1-hour TTL. Read/bookmark
// status is tracked locally.
// ============================================================================

import type { NewsArticle, NewsCategory } from '../../types/dashboard';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface NewsServiceConfig {
  apiKey: string;
  cacheTtlMs?: number;
  defaultPageSize?: number;
}

interface CacheEntry {
  articles: NewsArticle[];
  timestamp: number;
  totalResults: number;
}

// NewsAPI response shapes
interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
}

// ---------------------------------------------------------------------------
// Category → NewsAPI mapping
// ---------------------------------------------------------------------------

const CATEGORY_MAP: Record<NewsCategory, string | null> = {
  all: null,
  technology: 'technology',
  world: 'general',
  business: 'business',
  entertainment: 'entertainment',
  sports: 'sports',
  science: 'science',
  health: 'health',
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const DEFAULT_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const BASE_URL = 'https://newsapi.org/v2';

export class NewsService {
  private apiKey: string;
  private cacheTtlMs: number;
  private defaultPageSize: number;
  private cache = new Map<string, CacheEntry>();
  private readIds = new Set<string>();
  private bookmarkedIds = new Set<string>();

  constructor(config: NewsServiceConfig) {
    this.apiKey = config.apiKey;
    this.cacheTtlMs = config.cacheTtlMs ?? DEFAULT_CACHE_TTL;
    this.defaultPageSize = config.defaultPageSize ?? 20;
    this.loadPersistedState();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /** Fetch top headlines by category */
  async getHeadlines(
    category: NewsCategory = 'all',
    page = 1,
    pageSize?: number,
  ): Promise<{ articles: NewsArticle[]; totalResults: number }> {
    const size = pageSize ?? this.defaultPageSize;
    const cacheKey = `headlines:${category}:${page}:${size}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return { articles: this.applyLocalState(cached.articles), totalResults: cached.totalResults };
    }

    let url = `${BASE_URL}/top-headlines?country=us&pageSize=${size}&page=${page}`;
    const apiCategory = CATEGORY_MAP[category];
    if (apiCategory) {
      url += `&category=${apiCategory}`;
    }

    const articles = await this.fetchArticles(url, category);
    return { articles: this.applyLocalState(articles.articles), totalResults: articles.totalResults };
  }

  /** Search news by keyword */
  async searchNews(
    query: string,
    page = 1,
    pageSize?: number,
  ): Promise<{ articles: NewsArticle[]; totalResults: number }> {
    const size = pageSize ?? this.defaultPageSize;
    const cacheKey = `search:${query}:${page}:${size}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return { articles: this.applyLocalState(cached.articles), totalResults: cached.totalResults };
    }

    const url = `${BASE_URL}/everything?q=${encodeURIComponent(query)}&pageSize=${size}&page=${page}&sortBy=publishedAt&language=en`;
    const articles = await this.fetchArticles(url, 'all');
    return { articles: this.applyLocalState(articles.articles), totalResults: articles.totalResults };
  }

  /** Get trending topics (aggregates top headlines from multiple categories) */
  async getTrending(): Promise<NewsArticle[]> {
    const cacheKey = 'trending';
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTtlMs) {
      return this.applyLocalState(cached.articles);
    }

    const categories: NewsCategory[] = ['technology', 'world', 'business', 'science'];
    const fetches = categories.map((cat) =>
      this.getHeadlines(cat, 1, 5).catch(() => ({ articles: [] as NewsArticle[], totalResults: 0 })),
    );

    const results = await Promise.allSettled(fetches);
    const articles: NewsArticle[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        articles.push(...r.value.articles);
      }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = articles.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    // Sort by publish date
    unique.sort((a, b) => b.publishedAt - a.publishedAt);
    const top = unique.slice(0, 20);

    this.cache.set(cacheKey, { articles: top, timestamp: Date.now(), totalResults: top.length });
    return this.applyLocalState(top);
  }

  // -------------------------------------------------------------------------
  // Read / Bookmark management
  // -------------------------------------------------------------------------

  markAsRead(articleId: string): void {
    this.readIds.add(articleId);
    this.persistState();
  }

  markAsUnread(articleId: string): void {
    this.readIds.delete(articleId);
    this.persistState();
  }

  toggleBookmark(articleId: string): boolean {
    if (this.bookmarkedIds.has(articleId)) {
      this.bookmarkedIds.delete(articleId);
      this.persistState();
      return false;
    }
    this.bookmarkedIds.add(articleId);
    this.persistState();
    return true;
  }

  isRead(articleId: string): boolean {
    return this.readIds.has(articleId);
  }

  isBookmarked(articleId: string): boolean {
    return this.bookmarkedIds.has(articleId);
  }

  getBookmarkedIds(): string[] {
    return [...this.bookmarkedIds];
  }

  // -------------------------------------------------------------------------
  // Cache
  // -------------------------------------------------------------------------

  clearCache(): void {
    this.cache.clear();
  }

  dispose(): void {
    this.cache.clear();
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private async fetchArticles(
    url: string,
    category: NewsCategory,
  ): Promise<{ articles: NewsArticle[]; totalResults: number }> {
    const res = await fetch(url, {
      headers: { 'X-Api-Key': this.apiKey },
    });
    if (!res.ok) {
      throw new Error(`News API error: ${res.status} ${res.statusText}`);
    }

    const data: NewsAPIResponse = await res.json();
    const articles = data.articles
      .filter((a) => a.title && a.title !== '[Removed]')
      .map((a) => this.mapArticle(a, category));

    const cacheKey = url;
    this.cache.set(cacheKey, { articles, timestamp: Date.now(), totalResults: data.totalResults });

    return { articles, totalResults: data.totalResults };
  }

  private mapArticle(raw: NewsAPIArticle, category: NewsCategory): NewsArticle {
    const id = this.articleId(raw);
    return {
      id,
      title: raw.title,
      description: raw.description ?? '',
      url: raw.url,
      imageUrl: raw.urlToImage,
      source: raw.source.name,
      author: raw.author,
      publishedAt: new Date(raw.publishedAt).getTime(),
      category,
      content: raw.content,
      isRead: this.readIds.has(id),
      isBookmarked: this.bookmarkedIds.has(id),
    };
  }

  private articleId(raw: NewsAPIArticle): string {
    // Stable ID from URL hash
    let hash = 0;
    const str = raw.url;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `news-${Math.abs(hash).toString(36)}`;
  }

  private applyLocalState(articles: NewsArticle[]): NewsArticle[] {
    return articles.map((a) => ({
      ...a,
      isRead: this.readIds.has(a.id),
      isBookmarked: this.bookmarkedIds.has(a.id),
    }));
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private persistState(): void {
    try {
      localStorage.setItem('media-hub:news-read', JSON.stringify([...this.readIds]));
      localStorage.setItem('media-hub:news-bookmarks', JSON.stringify([...this.bookmarkedIds]));
    } catch {
      // Storage unavailable
    }
  }

  private loadPersistedState(): void {
    try {
      const read = localStorage.getItem('media-hub:news-read');
      if (read) {
        const ids: string[] = JSON.parse(read);
        ids.forEach((id) => this.readIds.add(id));
      }
      const bookmarks = localStorage.getItem('media-hub:news-bookmarks');
      if (bookmarks) {
        const ids: string[] = JSON.parse(bookmarks);
        ids.forEach((id) => this.bookmarkedIds.add(id));
      }
    } catch {
      // Corrupted data – start fresh
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function categoryLabel(category: NewsCategory): string {
  if (category === 'all') return 'All';
  return category.charAt(0).toUpperCase() + category.slice(1);
}
