// ============================================================================
// ArticleReader – full article view in a modal overlay
// ============================================================================

import React, { useEffect, useCallback, type CSSProperties } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  d,
  iconButton,
  truncateText,
} from './theme';
import { timeAgo } from '../../services/news/NewsService';
import type { NewsArticle } from '../../types/dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArticleReaderProps {
  article: NewsArticle | null;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenInBrowser: (url: string) => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArticleReader({
  article,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  onOpenInBrowser,
  hasPrevious,
  hasNext,
}: ArticleReaderProps) {
  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrevious) onPrevious();
          break;
        case 'ArrowRight':
          if (hasNext) onNext();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, onPrevious, onNext, hasPrevious, hasNext]);

  const handleOpenInBrowser = useCallback(() => {
    if (article) onOpenInBrowser(article.url);
  }, [article, onOpenInBrowser]);

  return (
    <AnimatePresence>
      {isOpen && article && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={backdrop}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={modal}
            role="dialog"
            aria-label={`Article: ${article.title}`}
            aria-modal="true"
          >
            {/* Header bar */}
            <div style={header}>
              <button onClick={onClose} style={iconButton} aria-label="Close article">
                {'\u2715'}
              </button>

              <div style={{ flex: 1 }} />

              {/* Navigation */}
              <button
                onClick={onPrevious}
                disabled={!hasPrevious}
                style={{
                  ...iconButton,
                  opacity: hasPrevious ? 1 : 0.3,
                  cursor: hasPrevious ? 'pointer' : 'default',
                }}
                aria-label="Previous article"
                title="Previous (Left Arrow)"
              >
                {'\u2039'}
              </button>
              <button
                onClick={onNext}
                disabled={!hasNext}
                style={{
                  ...iconButton,
                  opacity: hasNext ? 1 : 0.3,
                  cursor: hasNext ? 'pointer' : 'default',
                }}
                aria-label="Next article"
                title="Next (Right Arrow)"
              >
                {'\u203A'}
              </button>

              <div style={{ width: 8 }} />

              <button
                onClick={handleOpenInBrowser}
                style={openInBrowserButton}
                title="Open in browser"
              >
                Open in browser {'\u2197'}
              </button>
            </div>

            {/* Article content */}
            <div style={body}>
              {/* Hero image */}
              {article.imageUrl && (
                <div style={heroContainer}>
                  <img
                    src={article.imageUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              )}

              {/* Title */}
              <h1 style={titleStyle}>{article.title}</h1>

              {/* Meta */}
              <div style={metaRow}>
                <span style={{ color: d.accent, fontWeight: 600 }}>{article.source}</span>
                {article.author && (
                  <>
                    <span style={metaDot}>{'\u2022'}</span>
                    <span style={{ ...truncateText, maxWidth: 200 }}>{article.author}</span>
                  </>
                )}
                <span style={metaDot}>{'\u2022'}</span>
                <span>{timeAgo(article.publishedAt)}</span>
              </div>

              {/* Description */}
              {article.description && (
                <p style={descriptionStyle}>
                  {article.description}
                </p>
              )}

              {/* Content or iframe */}
              {article.content ? (
                <div style={contentStyle}>
                  {article.content}
                </div>
              ) : (
                <div style={iframeContainer}>
                  <iframe
                    src={article.url}
                    title={article.title}
                    style={iframeStyle}
                    sandbox="allow-same-origin allow-scripts allow-popups"
                  />
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  zIndex: 3000,
};

const modal: CSSProperties = {
  position: 'fixed',
  top: '5%',
  left: '10%',
  right: '10%',
  bottom: '5%',
  backgroundColor: d.bgWidget,
  borderRadius: d.radius + 4,
  border: `1px solid ${d.border}`,
  zIndex: 3001,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '10px 16px',
  borderBottom: `1px solid ${d.border}`,
  flexShrink: 0,
};

const openInBrowserButton: CSSProperties = {
  padding: '4px 12px',
  borderRadius: d.radiusRound,
  border: `1px solid ${d.border}`,
  backgroundColor: 'transparent',
  color: d.textSecondary,
  fontSize: 12,
  cursor: 'pointer',
  transition: `all ${d.transitionFast}`,
  whiteSpace: 'nowrap',
};

const body: CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '0 24px 24px',
};

const heroContainer: CSSProperties = {
  width: '100%',
  height: 240,
  margin: '0 -24px',
  overflow: 'hidden',
  marginBottom: 20,
  padding: '0 24px',
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: d.text,
  lineHeight: 1.3,
  margin: '20px 0 12px',
};

const metaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 12,
  color: d.textMuted,
  marginBottom: 16,
};

const metaDot: CSSProperties = {
  color: d.textMuted,
};

const descriptionStyle: CSSProperties = {
  fontSize: 15,
  color: d.textSecondary,
  lineHeight: 1.6,
  marginBottom: 20,
  padding: '16px 0',
  borderTop: `1px solid ${d.border}`,
  borderBottom: `1px solid ${d.border}`,
};

const contentStyle: CSSProperties = {
  fontSize: 14,
  color: d.text,
  lineHeight: 1.7,
};

const iframeContainer: CSSProperties = {
  width: '100%',
  height: 500,
  borderRadius: d.radius,
  overflow: 'hidden',
  border: `1px solid ${d.border}`,
};

const iframeStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  border: 'none',
  backgroundColor: '#fff',
};
