// ============================================================================
// WidgetFrame – generic container for dashboard widgets with header chrome
// ============================================================================

import React, { type CSSProperties } from 'react';
import { d, iconButton } from './theme';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WidgetFrameProps {
  id: string;
  title: string;
  icon: string;
  children: React.ReactNode;
  onSettings?: () => void;
  onRemove?: () => void;
}

// ---------------------------------------------------------------------------
// Widget Registration Framework
// ---------------------------------------------------------------------------

export interface WidgetRegistration {
  id: string;
  title: string;
  icon: string;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
  removable: boolean;
  component: React.ComponentType<Record<string, unknown>>;
}

const registry = new Map<string, WidgetRegistration>();

export function registerWidget(widget: WidgetRegistration): void {
  registry.set(widget.id, widget);
}

export function getWidget(id: string): WidgetRegistration | undefined {
  return registry.get(id);
}

export function getAllWidgets(): WidgetRegistration[] {
  return [...registry.values()];
}

export function unregisterWidget(id: string): void {
  registry.delete(id);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WidgetFrame({ title, icon, children, onSettings, onRemove }: WidgetFrameProps) {
  return (
    <div style={frame}>
      <div style={header}>
        <span style={titleStyle}>
          <span>{icon}</span> {title}
        </span>
        <div style={{ display: 'flex', gap: 2 }}>
          {onSettings && (
            <button onClick={onSettings} style={iconButton} aria-label={`${title} settings`} title="Settings">
              {'\u2699\uFE0F'}
            </button>
          )}
          {onRemove && (
            <button onClick={onRemove} style={iconButton} aria-label={`Remove ${title}`} title="Remove widget">
              {'\u2715'}
            </button>
          )}
        </div>
      </div>
      <div style={body}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const frame: CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const header: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 4px 0 8px',
  height: 36,
  flexShrink: 0,
  cursor: 'grab',
};

const titleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: d.textSecondary,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const body: CSSProperties = {
  flex: 1,
  overflow: 'hidden',
};
