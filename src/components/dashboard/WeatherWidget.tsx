// ============================================================================
// WeatherWidget – current conditions, hourly chart, 7-day forecast, alerts
// ============================================================================

import React, { useState, useMemo, useCallback, type CSSProperties } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useDashboardStore } from './useDashboardStore';
import {
  d,
  widgetCard,
  widgetHeader,
  widgetTitle,
  widgetBody,
  iconButton,
  truncateText,
  formatTimeShort,
  formatDayShort,
  formatDayLong,
} from './theme';
import { weatherConditionIcon, formatTemp } from '../../services/weather/WeatherService';
import type {
  WeatherData,
  WeatherDaily,
  TemperatureUnit,
} from '../../types/dashboard';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WeatherWidgetProps {
  data: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeatherWidget({ data, isLoading, error, onRefresh }: WeatherWidgetProps) {
  const { weatherSettings, toggleWeatherSection } = useDashboardStore();
  const unit = weatherSettings.unit;

  if (isLoading && !data) {
    return (
      <div style={widgetCard}>
        <div style={widgetHeader}>
          <h3 style={widgetTitle}>Weather</h3>
        </div>
        <div style={widgetBody}>
          <WeatherSkeleton />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={widgetCard}>
        <div style={widgetHeader}>
          <h3 style={widgetTitle}>Weather</h3>
        </div>
        <div style={{ ...widgetBody, textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>{'\u26A0\uFE0F'}</div>
          <div style={{ color: d.textSecondary, fontSize: 13, marginBottom: 12 }}>{error}</div>
          <button onClick={onRefresh} style={retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={widgetCard}>
      {/* Header */}
      <div style={widgetHeader}>
        <h3 style={widgetTitle}>
          {'\u2601\uFE0F'} Weather
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isLoading && <Spinner />}
          <button onClick={onRefresh} style={iconButton} aria-label="Refresh weather" title="Refresh">
            {'\u21BB'}
          </button>
        </div>
      </div>

      <div style={{ ...widgetBody, padding: 0, overflow: 'auto' }}>
        {/* Alerts */}
        {weatherSettings.showAlerts && data.alerts.length > 0 && (
          <AlertBanner alerts={data.alerts} />
        )}

        {/* Current conditions */}
        <CurrentConditions
          data={data}
          unit={unit}
        />

        {/* Hourly forecast chart */}
        {weatherSettings.showHourly && (
          <div style={sectionContainer}>
            <SectionHeader
              title="Next 24 Hours"
              onToggle={() => toggleWeatherSection('showHourly')}
            />
            <HourlyChart hourly={data.hourly.slice(0, 24)} unit={unit} />
          </div>
        )}

        {/* 7-day forecast */}
        {weatherSettings.showDaily && (
          <div style={sectionContainer}>
            <SectionHeader
              title="7-Day Forecast"
              onToggle={() => toggleWeatherSection('showDaily')}
            />
            <DailyForecast daily={data.daily} unit={unit} />
          </div>
        )}

        {/* Last updated */}
        <div style={lastUpdated}>
          Updated {formatTimeShort(data.current.updatedAt)}
          {data.location && (
            <span> — {data.location.name}, {data.location.country}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Current Conditions
// ---------------------------------------------------------------------------

function CurrentConditions({
  data,
  unit,
}: {
  data: WeatherData;
  unit: TemperatureUnit;
}) {
  const { current } = data;

  return (
    <div style={currentSection}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {/* Left: temp + icon */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={weatherIcon}>
            {weatherConditionIcon(current.condition)}
          </span>
          <div>
            <div style={tempLarge}>
              {formatTemp(current.temp, unit)}
            </div>
            <div style={{ fontSize: 13, color: d.textSecondary, textTransform: 'capitalize' }}>
              {current.description}
            </div>
          </div>
        </div>

        {/* Right: feels like + details */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 12, color: d.textMuted, marginBottom: 4 }}>
            Feels like {formatTemp(current.feelsLike, unit)}
          </div>
          <div style={detailsGrid}>
            <DetailItem label="Humidity" value={`${current.humidity}%`} />
            <DetailItem label="Wind" value={`${current.windSpeed} ${unit === 'F' ? 'mph' : 'm/s'}`} />
            <DetailItem label="Visibility" value={`${current.visibility} km`} />
            <DetailItem label="UV" value={`${current.uvIndex}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, fontSize: 11, color: d.textMuted }}>
      <span>{label}:</span>
      <span style={{ color: d.textSecondary }}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hourly Chart (Recharts)
// ---------------------------------------------------------------------------

function HourlyChart({
  hourly,
  unit,
}: {
  hourly: WeatherData['hourly'];
  unit: TemperatureUnit;
}) {
  const chartData = useMemo(
    () =>
      hourly.map((h) => ({
        time: formatTimeShort(h.time),
        temp: h.temp,
        precip: h.precipProbability,
      })),
    [hourly],
  );

  const CustomTooltipContent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ active, payload, label }: any) => {
      if (!active || !payload?.length) return null;
      const temp = payload.find((p: { dataKey: string }) => p.dataKey === 'temp');
      const precip = payload.find((p: { dataKey: string }) => p.dataKey === 'precip');
      return (
        <div style={tooltipBox}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
          {temp && <div>Temp: {formatTemp(temp.value, unit)}</div>}
          {precip && <div>Rain: {precip.value}%</div>}
        </div>
      );
    },
    [unit],
  );

  return (
    <div style={{ width: '100%', height: 160, overflowX: 'auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={d.border} vertical={false} />
          <XAxis
            dataKey="time"
            tick={{ fontSize: 10, fill: d.textMuted }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="temp"
            tick={{ fontSize: 10, fill: d.textMuted }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <YAxis
            yAxisId="precip"
            orientation="right"
            tick={false}
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            hide
          />
          <Tooltip content={<CustomTooltipContent />} />
          <Bar
            yAxisId="precip"
            dataKey="precip"
            fill={d.precipBar}
            fillOpacity={0.3}
            radius={[2, 2, 0, 0]}
            barSize={12}
          />
          <Line
            yAxisId="temp"
            type="monotone"
            dataKey="temp"
            stroke={d.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: d.accent }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 7-Day Forecast
// ---------------------------------------------------------------------------

function DailyForecast({
  daily,
  unit,
}: {
  daily: WeatherDaily[];
  unit: TemperatureUnit;
}) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  // Find temp range across all days for the bar chart
  const allTemps = daily.flatMap((d) => [d.high, d.low]);
  const minTemp = Math.min(...allTemps);
  const maxTemp = Math.max(...allTemps);
  const range = maxTemp - minTemp || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {daily.map((day, i) => {
        const isExpanded = expandedDay === i;
        const lowPct = ((day.low - minTemp) / range) * 100;
        const highPct = ((day.high - minTemp) / range) * 100;

        return (
          <div key={day.date}>
            <div
              onClick={() => setExpandedDay(isExpanded ? null : i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 16px',
                cursor: 'pointer',
                backgroundColor: isExpanded ? d.bgHover : 'transparent',
                transition: `background-color ${d.transitionFast}`,
              }}
            >
              {/* Day name */}
              <span style={{ width: 36, fontSize: 12, color: i === 0 ? d.accent : d.textSecondary, fontWeight: i === 0 ? 600 : 400 }}>
                {i === 0 ? 'Today' : formatDayShort(day.date)}
              </span>

              {/* Icon */}
              <span style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
                {weatherConditionIcon(day.condition)}
              </span>

              {/* Precip */}
              {day.precipProbability > 0 && (
                <span style={{ fontSize: 10, color: d.precipBar, width: 28 }}>
                  {day.precipProbability}%
                </span>
              )}
              {day.precipProbability === 0 && <span style={{ width: 28 }} />}

              {/* Low */}
              <span style={{ fontSize: 12, color: d.textMuted, width: 28, textAlign: 'right' }}>
                {Math.round(day.low)}{'\u00B0'}
              </span>

              {/* Temp bar */}
              <div style={tempBarContainer}>
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: `${lowPct}%`,
                    right: `${100 - highPct}%`,
                    borderRadius: 3,
                    background: `linear-gradient(90deg, ${d.tempLow}, ${d.accent}, ${d.tempHigh})`,
                  }}
                />
              </div>

              {/* High */}
              <span style={{ fontSize: 12, color: d.text, width: 28, fontWeight: 500 }}>
                {Math.round(day.high)}{'\u00B0'}
              </span>

              {/* Expand indicator */}
              <span style={{ fontSize: 10, color: d.textMuted, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: `transform ${d.transitionFast}` }}>
                {'\u25BC'}
              </span>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div style={expandedDetails}>
                <div style={{ fontSize: 12, color: d.textSecondary, marginBottom: 4 }}>
                  {formatDayLong(day.date)} — {day.description}
                </div>
                <div style={{ display: 'flex', gap: 16, fontSize: 11, color: d.textMuted }}>
                  <span>Sunrise: {formatTimeShort(day.sunrise)}</span>
                  <span>Sunset: {formatTimeShort(day.sunset)}</span>
                  <span>Precip: {day.precipProbability}%</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alert Banner
// ---------------------------------------------------------------------------

function AlertBanner({ alerts }: { alerts: WeatherData['alerts'] }) {
  const [expanded, setExpanded] = useState(false);
  const severityColor: Record<string, string> = {
    minor: d.alertMinor,
    moderate: d.alertModerate,
    severe: d.alertSevere,
    extreme: d.alertExtreme,
  };

  return (
    <div>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          style={{
            padding: '8px 16px',
            backgroundColor: (severityColor[alert.severity] ?? d.alertMinor) + '20',
            borderLeft: `3px solid ${severityColor[alert.severity] ?? d.alertMinor}`,
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(!expanded)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14 }}>{'\u26A0\uFE0F'}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: severityColor[alert.severity] ?? d.alertMinor }}>
              {alert.title}
            </span>
            <span style={{ fontSize: 10, color: d.textMuted, marginLeft: 'auto' }}>
              Expires {formatTimeShort(alert.expires)}
            </span>
          </div>
          {expanded && (
            <div style={{ fontSize: 11, color: d.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
              {alert.description.slice(0, 300)}
              {alert.description.length > 300 && '...'}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ title, onToggle }: { title: string; onToggle: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 4px' }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: d.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {title}
      </span>
      <button onClick={onToggle} style={{ ...iconButton, fontSize: 10 }} aria-label={`Hide ${title}`} title="Hide">
        {'\u2715'}
      </button>
    </div>
  );
}

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

function WeatherSkeleton() {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ ...skeletonBlock, width: '60%', height: 40, marginBottom: 12 }} />
      <div style={{ ...skeletonBlock, width: '40%', height: 16, marginBottom: 20 }} />
      <div style={{ ...skeletonBlock, width: '100%', height: 120, marginBottom: 16 }} />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ ...skeletonBlock, width: '100%', height: 32, marginBottom: 4 }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const currentSection: CSSProperties = {
  padding: 16,
  borderBottom: `1px solid ${d.border}`,
};

const weatherIcon: CSSProperties = {
  fontSize: 48,
  lineHeight: 1,
};

const tempLarge: CSSProperties = {
  fontSize: 36,
  fontWeight: 700,
  color: d.text,
  lineHeight: 1.1,
  fontVariantNumeric: 'tabular-nums',
};

const detailsGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto auto',
  gap: '2px 12px',
};

const sectionContainer: CSSProperties = {
  borderBottom: `1px solid ${d.border}`,
  paddingBottom: 8,
};

const tempBarContainer: CSSProperties = {
  flex: 1,
  height: 6,
  borderRadius: 3,
  backgroundColor: d.bgSurface,
  position: 'relative',
  minWidth: 40,
};

const expandedDetails: CSSProperties = {
  padding: '4px 16px 12px 82px',
  backgroundColor: d.bgHover,
};

const lastUpdated: CSSProperties = {
  padding: '8px 16px',
  fontSize: 10,
  color: d.textMuted,
  textAlign: 'center',
};

const tooltipBox: CSSProperties = {
  backgroundColor: d.bgWidget,
  border: `1px solid ${d.border}`,
  borderRadius: d.radius,
  padding: '8px 12px',
  fontSize: 12,
  color: d.text,
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
