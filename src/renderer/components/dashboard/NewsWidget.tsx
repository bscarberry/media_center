// ============================================================================
// NewsWidget – news headlines with category filters and infinite scroll
// ============================================================================

import React, { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import { useDashboardStore } from './useDashboardStore';
import {
  d,
  widgetCard,
  widgetHeader,
  widgetTitle,
  widgetBody,
  iconButton,
  pill,
  pillActive,
  truncateText,
  truncateMultiline,
} from './theme';
import { timeAgo, categoryLabel } from '../../services/news/NewsService';
import type { NewsArticle, NewsCategory } from '../../types/dashboard';
import { NEWS_CATEGORIES } from '../../types/dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NewsWidgetProps {
  articles: NewsArticle[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  activeCategory: NewsCategory;
  onCategoryChange: (category: NewsCategory) => void;
  onLoadMore: () => void;
  onRefresh: () => void;
  onArticleClick: (article: NewsArticle) => void;
  onBookmark: (articleId: string) => void;
  onDismiss: (articleId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewsWidget({
  articles,
  isLoading,
  error,
  hasMore,
  activeCategory,
  onCategoryChange,
  onLoadMore,
  onRefresh,
  onArticleClick,
  onBookmark,
  onDismiss,
}: NewsWidgetProps) {
  const { markArticleRead } = useDashboardStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Infinite scroll observer
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore || isLoading) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            onLoadMore();
          }
        },
        { threshold: 0.1 },
      );
      observerRef.current.observe(node);
    },
    [hasMore, isLoading, onLoadMore],
  );

  const handleArticleClick = useCallback(
    (article: NewsArticle) => {
      markArticleRead(article.id);
      onArticleClick(article);
    },
    [markArticleRead, onArticleClick],
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent, articleId: string) => {
      e.stopPropagation();
      setDismissedIds((prev) => new Set(prev).add(articleId));
      onDismiss(articleId);
    },
    [onDismiss],
  );

  const visibleArticles = articles.filter((a) => !dismissedIds.has(a.id));

  return (
    <div style={widgetCard}>
      {/* Header */}
      <div style={widgetHeader}>
        <h3 style={widgetTitle}>
          {'\uD83D\uDCF0'} News
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isLoading && <Spinner />}
          <button onClick={onRefresh} style={iconButton} aria-label="Refresh news" title="Refresh">
            {'\u21BB'}
          </button>
        </div>
      </div>

      {/* Category filter pills */}
      <div style={categoryBar}>
        <div style={categoryScroll}>
          {NEWS_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              style={cat === activeCategory ? pillActive : pill}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Articles list */}
      <div ref={scrollRef} style={{ ...widgetBody, padding: 0 }}>
        {error && !articles.length ? (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u26A0\uFE0F'}</div>
            <div style={{ color: d.textSecondary, fontSize: 13, marginBottom: 12 }}>{error}</div>
            <button onClick={onRefresh} style={retryButton}>
              Retry
            </button>
          </div>
        ) : visibleArticles.length === 0 && !isLoading ? (
          <div style={{ textAlign: 'center', padding: 32, color: d.textMuted }}>
            <div style={{ fontSize: 14, marginBottom: 4 }}>No articles found</div>
            <div style={{ fontSize: 12 }}>Try a different category</div>
          </div>
        ) : (
          <>
            {visibleArticles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => handleArticleClick(article)}
                onBookmark={() => onBookmark(article.id)}
                onDismiss={(e) => handleDismiss(e, article.id)}
              />
            ))}

            {/* Loading more */}
            {isLoading && (
              <div style={{ padding: 16 }}>
                {[1, 2, 3].map((i) => (
                  <ArticleSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            {hasMore && <div ref={sentinelRef} style={{ height: 1 }} />}

            {!hasMore && visibleArticles.length > 0 && (
              <div style={{ textAlign: 'center', padding: 12, fontSize: 11, color: d.textMuted }}>
                No more articles
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Article Card
// ---------------------------------------------------------------------------

function ArticleCard({
  article,
  onClick,
  onBookmark,
  onDismiss,
}: {
  article: NewsArticle;
  onClick: () => void;
  onBookmark: () => void;
  onDismiss: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        cursor: 'pointer',
        backgroundColor: hovered ? d.bgHover : 'transparent',
        borderBottom: `1px solid ${d.border}`,
        transition: `background-color ${d.transitionFast}`,
        position: 'relative',
      }}
    >
      {/* Thumbnail */}
      {article.imageUrl && (
        <div style={thumbnailContainer}>
          <img
            src={article.imageUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Read indicator */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          {!article.isRead && (
            <div style={unreadDot} />
          )}
          <div style={{
            ...truncateMultiline(2),
            fontSize: 13,
            fontWeight: article.isRead ? 400 : 600,
            color: article.isRead ? d.read : d.unread,
            lineHeight: 1.4,
          }}>
            {article.title}
          </div>
        </div>

        {/* Meta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: d.accent, fontWeight: 500, ...truncateText, maxWidth: 100 }}>
            {article.source}
          </span>
          <span style={{ fontSize: 10, color: d.textMuted }}>{'\u2022'}</span>
          <span style={{ fontSize: 11, color: d.textMuted }}>
            {timeAgo(article.publishedAt)}
          </span>
        </div>
      </div>

      {/* Actions (on hover) */}
      {hovered && (
        <div style={actionButtons}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark();
            }}
            style={{ ...iconButton, fontSize: 14 }}
            title={article.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
          >
            {article.isBookmarked ? '\u2605' : '\u2606'}
          </button>
          <button
            onClick={onDismiss}
            style={{ ...iconButton, fontSize: 12 }}
            title="Dismiss"
          >
            {'\u2715'}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Spinner() {
  return (
    <div
      style={{
        width: 14,
        height: 14,
        border: `2px solid ${d.border}`,
        borderTopColor: d.accent,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  );
}

function ArticleSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 16px' }}>
      <div style={{ ...skeletonBlock, width: 72, height: 56, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ ...skeletonBlock, width: '90%', height: 14, marginBottom: 6 }} />
        <div style={{ ...skeletonBlock, width: '70%', height: 14, marginBottom: 6 }} />
        <div style={{ ...skeletonBlock, width: '40%', height: 10 }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const categoryBar: CSSProperties = {
  padding: '8px 12px',
  borderBottom: `1px solid ${d.border}`,
  flexShrink: 0,
};

const categoryScroll: CSSProperties = {
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  scrollbarWidth: 'none',
};

const thumbnailContainer: CSSProperties = {
  width: 72,
  height: 56,
  borderRadius: d.radiusSmall,
  overflow: 'hidden',
  flexShrink: 0,
  backgroundColor: d.bgSurface,
};

const unreadDot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: '50%',
  backgroundColor: d.accent,
  flexShrink: 0,
  marginTop: 5,
};

const actionButtons: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flexShrink: 0,
  position: 'absolute',
  right: 8,
  top: 8,
};

const retryButton: CSSProperties = {
  padding: '6px 16px',
  borderRadius: d.radiusRound,
  border: `1px solid ${d.border}`,
  backgroundColor: 'transparent',
  color: d.text,
  fontSize: 12,
  cursor: 'pointer',
};

const skeletonBlock: CSSProperties = {
  backgroundColor: d.bgSurface,
  borderRadius: d.radiusSmall,
};
