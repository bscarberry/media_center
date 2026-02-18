// ============================================================================
// Dashboard – resizable sidebar with draggable widget grid
// ============================================================================

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  type CSSProperties,
} from 'react';
import {
  GridLayout,
  useContainerWidth,
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import { useDashboardStore } from './useDashboardStore';
import { WeatherWidget, type WeatherWidgetProps } from './WeatherWidget';
import { NewsWidget, type NewsWidgetProps } from './NewsWidget';
import { ArticleReader } from './ArticleReader';
import { WidgetSettings } from './WidgetSettings';
import { WidgetFrame } from './WidgetFrame';
import { d, iconButton } from './theme';
import type { WidgetLayoutItem, NewsArticle, WeatherLocation } from '../../types/dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DashboardProps {
  /** Weather data and handlers */
  weather: Omit<WeatherWidgetProps, 'onRefresh'> & { onRefresh: () => void };
  /** News data and handlers */
  news: Omit<NewsWidgetProps, 'onArticleClick' | 'onBookmark' | 'onDismiss'>;
  /** Called when user wants to open article URL in system browser */
  onOpenInBrowser?: (url: string) => void;
  /** Location search handler for weather settings */
  onSearchLocation?: (query: string) => Promise<WeatherLocation[]>;
  /** Children content (e.g., main media player area) */
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Dashboard({
  weather,
  news,
  onOpenInBrowser,
  onSearchLocation,
  children,
}: DashboardProps) {
  const {
    layout,
    widgetVisibility,
    setSidebarWidth,
    toggleSidebar,
    updateWidgetLayout,
    setWidgetVisible,
    toggleArticleBookmark,
  } = useDashboardStore();

  const sidebarRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // react-grid-layout v2: useContainerWidth for responsive grid width
  const { width: gridWidth, containerRef: gridContainerRef, mounted: gridMounted } = useContainerWidth();

  // Article reader state
  const [activeArticle, setActiveArticle] = useState<NewsArticle | null>(null);
  const [activeArticleIndex, setActiveArticleIndex] = useState(-1);

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'weather' | 'news'>('weather');

  // -----------------------------------------------------------------------
  // Sidebar resize via drag handle
  // -----------------------------------------------------------------------

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: layout.sidebarWidth };

      const handleMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const delta = dragRef.current.startX - ev.clientX;
        const newWidth = Math.max(d.sidebarMinWidth, Math.min(d.sidebarMaxWidth, dragRef.current.startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const handleUp = () => {
        dragRef.current = null;
        document.removeEventListener('pointermove', handleMove);
        document.removeEventListener('pointerup', handleUp);
      };

      document.addEventListener('pointermove', handleMove);
      document.addEventListener('pointerup', handleUp);
    },
    [layout.sidebarWidth, setSidebarWidth],
  );

  // -----------------------------------------------------------------------
  // Grid layout changes
  // -----------------------------------------------------------------------

  const handleLayoutChange = useCallback(
    (newLayout: Layout) => {
      const mapped: WidgetLayoutItem[] = newLayout.map((item: LayoutItem) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
      }));
      updateWidgetLayout(mapped);
    },
    [updateWidgetLayout],
  );

  // -----------------------------------------------------------------------
  // Article reader navigation
  // -----------------------------------------------------------------------

  const handleArticleClick = useCallback(
    (article: NewsArticle) => {
      const idx = news.articles.findIndex((a) => a.id === article.id);
      setActiveArticle(article);
      setActiveArticleIndex(idx);
    },
    [news.articles],
  );

  const handleArticlePrev = useCallback(() => {
    if (activeArticleIndex > 0) {
      const prev = news.articles[activeArticleIndex - 1];
      setActiveArticle(prev);
      setActiveArticleIndex(activeArticleIndex - 1);
    }
  }, [activeArticleIndex, news.articles]);

  const handleArticleNext = useCallback(() => {
    if (activeArticleIndex < news.articles.length - 1) {
      const next = news.articles[activeArticleIndex + 1];
      setActiveArticle(next);
      setActiveArticleIndex(activeArticleIndex + 1);
    }
  }, [activeArticleIndex, news.articles]);

  const handleOpenInBrowser = useCallback(
    (url: string) => {
      if (onOpenInBrowser) {
        onOpenInBrowser(url);
      } else {
        window.open(url, '_blank', 'noopener');
      }
    },
    [onOpenInBrowser],
  );

  // -----------------------------------------------------------------------
  // Settings
  // -----------------------------------------------------------------------

  const openSettings = useCallback(
    (tab: 'weather' | 'news') => {
      setSettingsTab(tab);
      setSettingsOpen(true);
    },
    [],
  );

  // -----------------------------------------------------------------------
  // Dismissed articles (local state only)
  // -----------------------------------------------------------------------

  const [, setDismissedArticles] = useState<Set<string>>(new Set());
  const handleDismissArticle = useCallback((id: string) => {
    setDismissedArticles((prev) => new Set(prev).add(id));
  }, []);

  // -----------------------------------------------------------------------
  // Build grid layout (Layout = readonly LayoutItem[])
  // -----------------------------------------------------------------------

  const gridLayout: Layout = useMemo(() => {
    return layout.widgets
      .filter((w) => widgetVisibility[w.i] !== false)
      .map((w) => ({
        i: w.i,
        x: w.x,
        y: w.y,
        w: w.w,
        h: w.h,
        minW: w.minW,
        minH: w.minH,
        static: false,
      }));
  }, [layout.widgets, widgetVisibility]);

  // Sidebar effective width
  const sidebarWidth = layout.sidebarCollapsed ? 0 : layout.sidebarWidth;

  return (
    <div style={container}>
      {/* Main content area */}
      <div
        style={{
          ...mainContent,
          marginRight: sidebarWidth > 0 ? sidebarWidth + 8 : 0,
        }}
      >
        {children}
      </div>

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        style={{
          ...sidebar,
          width: layout.sidebarCollapsed ? 0 : layout.sidebarWidth,
          transform: layout.sidebarCollapsed ? 'translateX(100%)' : 'translateX(0)',
          opacity: layout.sidebarCollapsed ? 0 : 1,
          pointerEvents: layout.sidebarCollapsed ? 'none' : 'auto',
        }}
      >
        {/* Drag handle */}
        <div
          onPointerDown={handleDragStart}
          style={dragHandle}
          title="Drag to resize"
        >
          <div style={dragLine} />
        </div>

        {/* Sidebar header */}
        <div style={sidebarHeader}>
          <span style={{ fontSize: 13, fontWeight: 600, color: d.text }}>Dashboard</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              onClick={() => openSettings('weather')}
              style={iconButton}
              aria-label="Dashboard settings"
              title="Settings"
            >
              {'\u2699\uFE0F'}
            </button>
          </div>
        </div>

        {/* Grid layout area */}
        <div ref={gridContainerRef as React.RefObject<HTMLDivElement>} style={gridContainerStyle}>
          {gridMounted && (
            <GridLayout
              width={gridWidth}
              layout={gridLayout}
              onLayoutChange={handleLayoutChange}
              gridConfig={{
                cols: 2,
                rowHeight: 80,
                margin: [8, 8] as const,
                containerPadding: [8, 8] as const,
                maxRows: Infinity,
              }}
              dragConfig={{
                enabled: true,
                handle: '.widget-drag-handle',
              }}
              resizeConfig={{
                enabled: true,
              }}
              autoSize
            >
              {/* Weather widget */}
              {widgetVisibility.weather !== false && (
                <div key="weather">
                  <WidgetFrame
                    id="weather"
                    title="Weather"
                    icon={'\u2601\uFE0F'}
                    onSettings={() => openSettings('weather')}
                    onRemove={() => setWidgetVisible('weather', false)}
                  >
                    <div className="widget-drag-handle" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 36, cursor: 'grab', zIndex: 1 }} />
                    <WeatherWidget {...weather} />
                  </WidgetFrame>
                </div>
              )}

              {/* News widget */}
              {widgetVisibility.news !== false && (
                <div key="news">
                  <WidgetFrame
                    id="news"
                    title="News"
                    icon={'\uD83D\uDCF0'}
                    onSettings={() => openSettings('news')}
                    onRemove={() => setWidgetVisible('news', false)}
                  >
                    <div className="widget-drag-handle" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 36, cursor: 'grab', zIndex: 1 }} />
                    <NewsWidget
                      {...news}
                      onArticleClick={handleArticleClick}
                      onBookmark={toggleArticleBookmark}
                      onDismiss={handleDismissArticle}
                    />
                  </WidgetFrame>
                </div>
              )}
            </GridLayout>
          )}
        </div>

        {/* Widget toggles if any widget is hidden */}
        {(widgetVisibility.weather === false || widgetVisibility.news === false) && (
          <div style={widgetTogglesBar}>
            {widgetVisibility.weather === false && (
              <button
                onClick={() => setWidgetVisible('weather', true)}
                style={showWidgetButton}
              >
                {'\u2601\uFE0F'} Show Weather
              </button>
            )}
            {widgetVisibility.news === false && (
              <button
                onClick={() => setWidgetVisible('news', true)}
                style={showWidgetButton}
              >
                {'\uD83D\uDCF0'} Show News
              </button>
            )}
          </div>
        )}
      </div>

      {/* Collapse/expand button (always visible) */}
      <button
        onClick={toggleSidebar}
        style={{
          ...collapseButton,
          right: layout.sidebarCollapsed ? 8 : layout.sidebarWidth + 12,
        }}
        aria-label={layout.sidebarCollapsed ? 'Show dashboard' : 'Hide dashboard'}
        title={layout.sidebarCollapsed ? 'Show dashboard' : 'Hide dashboard'}
      >
        {layout.sidebarCollapsed ? '\u25C0' : '\u25B6'}
      </button>

      {/* Article Reader Modal */}
      <ArticleReader
        article={activeArticle}
        isOpen={activeArticle !== null}
        onClose={() => setActiveArticle(null)}
        onPrevious={handleArticlePrev}
        onNext={handleArticleNext}
        onOpenInBrowser={handleOpenInBrowser}
        hasPrevious={activeArticleIndex > 0}
        hasNext={activeArticleIndex < news.articles.length - 1}
      />

      {/* Widget Settings */}
      <WidgetSettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeTab={settingsTab}
        onSearchLocation={onSearchLocation}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const container: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const mainContent: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  transition: `margin-right ${d.transition}`,
  overflow: 'auto',
};

const sidebar: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  backgroundColor: d.bgSidebar,
  borderLeft: `1px solid ${d.border}`,
  display: 'flex',
  flexDirection: 'column',
  transition: `transform ${d.transition}, opacity ${d.transition}, width ${d.transition}`,
  zIndex: 100,
  overflow: 'hidden',
};

const dragHandle: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: -4,
  bottom: 0,
  width: 8,
  cursor: 'col-resize',
  zIndex: 10,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dragLine: CSSProperties = {
  width: 2,
  height: 40,
  borderRadius: 1,
  backgroundColor: d.border,
  transition: `background-color ${d.transitionFast}`,
};

const sidebarHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  borderBottom: `1px solid ${d.border}`,
  flexShrink: 0,
};

const gridContainerStyle: CSSProperties = {
  flex: 1,
  overflow: 'auto',
};

const collapseButton: CSSProperties = {
  position: 'fixed',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 24,
  height: 48,
  backgroundColor: d.bgWidget,
  border: `1px solid ${d.border}`,
  borderRadius: `${d.radiusSmall}px 0 0 ${d.radiusSmall}px`,
  color: d.textSecondary,
  fontSize: 10,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 101,
  transition: `right ${d.transition}`,
};

const widgetTogglesBar: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: 8,
  borderTop: `1px solid ${d.border}`,
  flexShrink: 0,
};

const showWidgetButton: CSSProperties = {
  flex: 1,
  padding: '6px 8px',
  borderRadius: d.radiusSmall,
  border: `1px solid ${d.border}`,
  backgroundColor: 'transparent',
  color: d.textSecondary,
  fontSize: 11,
  cursor: 'pointer',
  transition: `all ${d.transitionFast}`,
};
