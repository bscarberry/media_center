// ============================================================================
// Dashboard components – barrel exports
// ============================================================================

export { Dashboard } from './Dashboard';
export type { DashboardProps } from './Dashboard';

export { WeatherWidget } from './WeatherWidget';
export type { WeatherWidgetProps } from './WeatherWidget';

export { NewsWidget } from './NewsWidget';
export type { NewsWidgetProps } from './NewsWidget';

export { ArticleReader } from './ArticleReader';
export type { ArticleReaderProps } from './ArticleReader';

export { WidgetSettings } from './WidgetSettings';
export type { WidgetSettingsProps } from './WidgetSettings';

export { WidgetFrame, registerWidget, getWidget, getAllWidgets, unregisterWidget } from './WidgetFrame';
export type { WidgetFrameProps, WidgetRegistration } from './WidgetFrame';

export { DashboardStoreContext, useDashboardStore } from './useDashboardStore';

export { d as dashboardTheme } from './theme';
