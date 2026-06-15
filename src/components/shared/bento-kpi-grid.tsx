"use client";
import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Pin,
  Maximize2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Users,
  ShoppingCart,
  DollarSign,
  Target,
  Repeat,
  Heart,
} from "lucide-react";
import {
  KPI_CONFIGS,
  CHANNEL_LABELS,
  CHANNEL_COLORS,
  type KPIKey,
  type ChannelId,
  type AggregatedKPIs,
  type Campaign,
  type FunnelStage,
} from "@/types";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDecimal,
  formatKPIValue,
} from "@/lib/format";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface BentoKPIGridProps {
  data: {
    currentKPIs: AggregatedKPIs;
    previousKPIs: AggregatedKPIs | null;
    timeSeries: Array<Record<string, number | string>>;
    channelData: Record<string, AggregatedKPIs>;
    campaignData: Array<{
      campaign: Campaign;
      kpis: AggregatedKPIs;
      previousKpis?: AggregatedKPIs;
    }>;
  };
  compareEnabled: boolean;
  funnelStage?: FunnelStage;
}

// Funnel-specific grid layout mappings
interface GridLayout {
  dualMetric1: KPIKey;
  dualMetric2: KPIKey;
  row1Col3: KPIKey;
  row1Col4: KPIKey;
  row2Col1: KPIKey;
  row2Col2: KPIKey;
  row2Wide: KPIKey;
  row3Col1: KPIKey;
  row3Col2: KPIKey;
  row3Col3: KPIKey;
  row3Col4: KPIKey;
}

const FUNNEL_GRID_LAYOUTS: Record<FunnelStage, GridLayout> = {
  all: {
    dualMetric1: 'impressions', dualMetric2: 'reach',
    row1Col3: 'cpm', row1Col4: 'roas',
    row2Col1: 'spend', row2Col2: 'reach', row2Wide: 'clicks',
    row3Col1: 'frequency', row3Col2: 'videoViews3s', row3Col3: 'engagementRate', row3Col4: 'budgetPacing',
  },
  upper: {
    dualMetric1: 'impressions', dualMetric2: 'reach',
    row1Col3: 'cpm', row1Col4: 'threeSecondViewRate',
    row2Col1: 'spend', row2Col2: 'frequency', row2Wide: 'videoViews3s',
    row3Col1: 'brandSearchLift', row3Col2: 'videoViewsThruplay', row3Col3: 'budgetPacing', row3Col4: 'cpm',
  },
  mid: {
    dualMetric1: 'clicks', dualMetric2: 'landingPageViews',
    row1Col3: 'ctr', row1Col4: 'engagementRate',
    row2Col1: 'spend', row2Col2: 'cpc', row2Wide: 'engagements',
    row3Col1: 'videoCompletionRate', row3Col2: 'lpvRate', row3Col3: 'videoViewsThruplay', row3Col4: 'budgetPacing',
  },
  lower: {
    dualMetric1: 'conversions', dualMetric2: 'leads',
    row1Col3: 'cpa', row1Col4: 'roas',
    row2Col1: 'spend', row2Col2: 'revenue', row2Wide: 'assistedConversions',
    row3Col1: 'budgetPacing', row3Col2: 'roas', row3Col3: 'revenue', row3Col4: 'conversions',
  },
  retention: {
    dualMetric1: 'conversions', dualMetric2: 'leads',
    row1Col3: 'cpa', row1Col4: 'roas',
    row2Col1: 'spend', row2Col2: 'revenue', row2Wide: 'assistedConversions',
    row3Col1: 'budgetPacing', row3Col2: 'roas', row3Col3: 'revenue', row3Col4: 'conversions',
  },
};

// ─── Constants ───────────────────────────────────────────────────────────────

const METRIC_COLORS: Record<string, string> = {
  spend: "#e07060",
  impressions: "#50b89a",
  clicks: "#50b89a",
  conversions: "#50b89a",
  revenue: "#50b89a",
  roas: "#50b89a",
  reach: "#50b89a",
  cpc: "#e07060",
  cpm: "#e07060",
  cpa: "#e07060",
  cpl: "#e07060",
  ctr: "#6b8aad",
  frequency: "#8b7ec8",
  videoViews3s: "#50b89a",
  videoViewsThruplay: "#50b89a",
  videoCompletionRate: "#50b89a",
  threeSecondViewRate: "#50b89a",
  engagementRate: "#8b7ec8",
  engagements: "#8b7ec8",
  budgetPacing: "#50b89a",
  leads: "#50b89a",
  landingPageViews: "#50b89a",
  lpvRate: "#6b8aad",
  assistedConversions: "#50b89a",
  brandSearchLift: "#8b7ec8",
  shareOfVoice: "#8b7ec8",
};

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(20, 24, 28, 0.95)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#e0e0e0",
  padding: "10px 14px",
  backdropFilter: "blur(12px)",
};

const CHANNEL_IDS: ChannelId[] = [
  "instagram",
  "facebook",
  "tiktok",
  "google-search",
  "ttd",
  "ctv",
  "spotify",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getKPIConfig(key: KPIKey) {
  return KPI_CONFIGS.find((c) => c.key === key);
}

function getDelta(
  current: number,
  previous: number | undefined
): { delta: number; percent: number } | null {
  if (previous === undefined || previous === 0) return null;
  const delta = current - previous;
  return { delta, percent: (delta / previous) * 100 };
}

function formatAbbrevDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortChannelName(ch: ChannelId): string {
  return CHANNEL_LABELS[ch]
    .replace("Google Search", "Google")
    .replace("The Trade Desk", "TTD");
}

// ─── Card Wrapper ────────────────────────────────────────────────────────────

function BentoCard({
  kpiKey,
  value,
  deltaInfo,
  compareEnabled,
  colSpan = 1,
  children,
  className,
}: {
  kpiKey: KPIKey;
  value: number;
  deltaInfo: { delta: number; percent: number } | null;
  compareEnabled: boolean;
  colSpan?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const config = getKPIConfig(kpiKey);
  if (!config) return null;
  const formattedValue = formatKPIValue(value, config.format);
  const isPositive = deltaInfo ? deltaInfo.delta > 0 : null;
  const isBetter = deltaInfo
    ? config.higherIsBetter
      ? deltaInfo.delta > 0
      : deltaInfo.delta < 0
    : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/40 bg-card p-5 flex flex-col min-w-0",
        colSpan === 2 && "col-span-2",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
            {config.label}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold truncate">{formattedValue}</span>
            {compareEnabled && deltaInfo && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium",
                  isBetter ? "text-emerald-400" : "text-red-400"
                )}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {deltaInfo.percent > 0 ? "+" : ""}
                {deltaInfo.percent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Pin className="h-3 w-3" />
          </button>
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Maximize2 className="h-3 w-3" />
          </button>
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </div>
      </div>
      {/* Visualization */}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// ─── A. Area/Line Mini Chart ─────────────────────────────────────────────────

function AreaMiniChart({
  data,
  metricKey,
}: {
  data: Array<Record<string, number | string>>;
  metricKey: string;
}) {
  const color = METRIC_COLORS[metricKey] || "#50b89a";
  const gradientId = `bento-area-${metricKey}`;

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart
        data={data}
        margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="rgba(255,255,255,0.04)"
          horizontal
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
          tickFormatter={formatAbbrevDate}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) =>
            new Date(v).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          }
          formatter={(value) => {
            const config = getKPIConfig(metricKey as KPIKey);
            return [
              config
                ? formatKPIValue(value as number, config.format)
                : String(value),
              config?.label || metricKey,
            ];
          }}
          cursor={{ stroke: "rgba(255,255,255,0.08)", strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey={metricKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
          dot={false}
          activeDot={{ r: 3, strokeWidth: 0, fill: color }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── B. Vertical Bar Chart ───────────────────────────────────────────────────

function BarMiniChart({
  data,
  metricKey,
}: {
  data: Array<Record<string, number | string>>;
  metricKey: string;
}) {
  const color = METRIC_COLORS[metricKey] || "#50b89a";

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 0, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="4 4"
          stroke="rgba(255,255,255,0.04)"
          horizontal
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
          tickFormatter={formatAbbrevDate}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "rgba(255,255,255,0.25)" }}
          tickFormatter={(v) => formatNumber(v)}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelFormatter={(v) =>
            new Date(v).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          }
          formatter={(value) => {
            const config = getKPIConfig(metricKey as KPIKey);
            return [
              config
                ? formatKPIValue(value as number, config.format)
                : String(value),
              config?.label || metricKey,
            ];
          }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Bar
          dataKey={metricKey}
          fill={color}
          radius={[3, 3, 0, 0]}
          maxBarSize={12}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── C. Donut with Side Legend (like "Viewers Age") ─────────────────────────

function DonutWithSideLegend({
  channelData,
  metricKey,
}: {
  channelData: Record<string, AggregatedKPIs>;
  metricKey: KPIKey;
}) {
  const config = getKPIConfig(metricKey);
  const entries = CHANNEL_IDS.filter(
    (ch) => channelData[ch] && (channelData[ch][metricKey] as number) > 0
  ).map((ch) => ({
    name: shortChannelName(ch),
    value: channelData[ch][metricKey] as number,
    color: CHANNEL_COLORS[ch],
  }));

  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const top =
    entries.length > 0
      ? [...entries].sort((a, b) => b.value - a.value)[0]
      : null;
  const topPct =
    top && total > 0 ? ((top.value / total) * 100).toFixed(0) : "0";

  return (
    <div className="flex items-center gap-3">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: 100, height: 100 }}>
        <ResponsiveContainer width={100} height={100}>
          <PieChart>
            <Pie
              data={entries}
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={44}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {entries.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm font-bold">{topPct}%</span>
          <span className="text-[8px] text-muted-foreground leading-tight text-center">
            {top?.name}
          </span>
        </div>
      </div>
      {/* Side legend */}
      <div className="flex flex-col gap-1.5 min-w-0 flex-1">
        {entries.map((e) => {
          const pct =
            total > 0 ? ((e.value / total) * 100).toFixed(0) : "0";
          return (
            <div key={e.name} className="flex items-center gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: e.color }}
              />
              <span className="text-[10px] text-muted-foreground truncate flex-1">
                {e.name}
              </span>
              <span className="text-[10px] font-semibold tabular-nums shrink-0">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── D. Channel Scatter Plot (like "Streaming Platform Engagement") ─────────

function ChannelScatterPlot({
  channelData,
  campaignData,
  metricKey,
}: {
  channelData: Record<string, AggregatedKPIs>;
  campaignData: Array<{ campaign: Campaign; kpis: AggregatedKPIs }>;
  metricKey: KPIKey;
}) {
  // Generate scatter dots: campaign × channel
  const dots: Array<{
    x: number;
    y: number;
    color: string;
    channel: string;
  }> = [];

  const allChannelVals = CHANNEL_IDS.filter((ch) => channelData[ch]).map(
    (ch) => channelData[ch][metricKey] as number
  );
  const globalMax = Math.max(...allChannelVals, 1);

  campaignData.forEach((cd, ci) => {
    cd.campaign.channels.forEach((ch, chIdx) => {
      const chVal = channelData[ch]
        ? (channelData[ch][metricKey] as number)
        : 0;
      // Deterministic jitter from indices
      const seed1 = ((ci * 7 + chIdx * 13 + 5) * 2654435761) >>> 0;
      const seed2 = ((ci * 11 + chIdx * 3 + 7) * 2654435761) >>> 0;
      const jx = ((seed1 % 1000) / 1000 - 0.5) * 14;
      const jy = ((seed2 % 1000) / 1000 - 0.5) * 12;

      const baseX =
        8 +
        (ci / Math.max(campaignData.length - 1, 1)) * 84;
      const baseY = globalMax > 0 ? (chVal / globalMax) * 70 + 10 : 50;

      dots.push({
        x: Math.max(4, Math.min(96, baseX + jx)),
        y: Math.max(4, Math.min(96, baseY + jy)),
        color: CHANNEL_COLORS[ch] || "#888",
        channel: shortChannelName(ch),
      });
    });
  });

  return (
    <div>
      <svg viewBox="0 0 100 100" className="w-full" style={{ height: 130 }}>
        {/* Grid lines */}
        <line
          x1="5"
          y1="15"
          x2="95"
          y2="15"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.3"
        />
        <line
          x1="5"
          y1="50"
          x2="95"
          y2="50"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.3"
        />
        <line
          x1="5"
          y1="85"
          x2="95"
          y2="85"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="0.3"
        />
        {/* Y labels */}
        <text
          x="2"
          y="17"
          fill="rgba(255,255,255,0.2)"
          fontSize="3"
          fontFamily="sans-serif"
        >
          100%
        </text>
        <text
          x="2"
          y="52"
          fill="rgba(255,255,255,0.2)"
          fontSize="3"
          fontFamily="sans-serif"
        >
          50%
        </text>
        <text
          x="2"
          y="87"
          fill="rgba(255,255,255,0.2)"
          fontSize="3"
          fontFamily="sans-serif"
        >
          0%
        </text>
        {/* Dots */}
        {dots.map((dot, i) => (
          <rect
            key={i}
            x={dot.x - 1.3}
            y={100 - dot.y - 1.3}
            width={2.6}
            height={2.6}
            rx={0.5}
            fill={dot.color}
            opacity={0.75}
          />
        ))}
      </svg>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 justify-center">
        {CHANNEL_IDS.filter((ch) => channelData[ch]).map((ch) => (
          <div key={ch} className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-sm"
              style={{ backgroundColor: CHANNEL_COLORS[ch] }}
            />
            <span className="text-[8px] text-muted-foreground">
              {shortChannelName(ch)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── E. Campaign Delta Bars (like "Viewer Interest Per Age Group") ──────────

function CampaignDeltaBars({
  campaignData,
  metricKey,
}: {
  campaignData: Array<{
    campaign: Campaign;
    kpis: AggregatedKPIs;
    previousKpis?: AggregatedKPIs;
  }>;
  metricKey: KPIKey;
}) {
  const config = getKPIConfig(metricKey);
  const sorted = [...campaignData]
    .sort(
      (a, b) => (b.kpis[metricKey] as number) - (a.kpis[metricKey] as number)
    )
    .slice(0, 6);
  const maxVal =
    sorted.length > 0
      ? Math.max(...sorted.map((s) => s.kpis[metricKey] as number))
      : 1;

  return (
    <div className="flex items-end gap-1.5" style={{ height: 150 }}>
      {sorted.map((item, i) => {
        const val = item.kpis[metricKey] as number;
        const prevVal = item.previousKpis
          ? (item.previousKpis[metricKey] as number)
          : 0;
        const barPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const deltaP =
          prevVal > 0 ? ((val - prevVal) / prevVal) * 100 : 0;
        const words = item.campaign.name.split(" ");
        const shortName =
          words.length > 2 ? words.slice(0, 2).join(" ") : item.campaign.name;
        const barH = Math.max(barPct * 0.9, 8);

        return (
          <div
            key={item.campaign.id}
            className="flex-1 flex flex-col items-center min-w-0"
            style={{ height: "100%" }}
          >
            {/* Delta label */}
            <span
              className={cn(
                "text-[9px] font-semibold tabular-nums mb-1 h-3",
                deltaP > 0
                  ? "text-emerald-400"
                  : deltaP < 0
                    ? "text-red-400"
                    : "text-transparent"
              )}
            >
              {deltaP > 0 ? "+" : ""}
              {deltaP !== 0 ? `${deltaP.toFixed(0)}%` : "·"}
            </span>
            {/* Bar area */}
            <div className="flex-1 w-full flex items-end justify-center">
              <div
                className="rounded-t-sm"
                style={{
                  width: "70%",
                  height: `${barH}%`,
                  backgroundColor: `rgba(80, 184, 154, ${0.7 - i * 0.07})`,
                }}
              />
            </div>
            {/* Value */}
            <span className="text-[9px] font-semibold tabular-nums mt-1">
              {config
                ? formatKPIValue(val, config.format)
                : formatNumber(val)}
            </span>
            {/* Label */}
            <span className="text-[7px] text-muted-foreground text-center leading-tight w-full truncate">
              {shortName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── F. Channel Trending Scale (like "Stream Platform Interest") ────────────

function ChannelTrendingScale({
  channelData,
  timeSeries,
  metricKey,
}: {
  channelData: Record<string, AggregatedKPIs>;
  timeSeries: Array<Record<string, number | string>>;
  metricKey: KPIKey;
}) {
  const config = getKPIConfig(metricKey);
  const total = CHANNEL_IDS.filter((ch) => channelData[ch]).reduce(
    (sum, ch) => sum + (channelData[ch][metricKey] as number),
    0
  );

  const entries = CHANNEL_IDS.filter((ch) => channelData[ch]).map((ch) => {
    const share =
      total > 0 ? (channelData[ch][metricKey] as number) / total : 0.2;
    const values = timeSeries.map(
      (d) => (d[metricKey] as number) * share
    );
    const third = Math.max(1, Math.floor(values.length / 3));
    const early =
      values.slice(0, third).reduce((s, v) => s + v, 0) / third;
    const late =
      values.slice(-third).reduce((s, v) => s + v, 0) / third;
    const trendScore = early > 0 ? (late - early) / early : 0;

    return {
      id: ch,
      label: shortChannelName(ch),
      color: CHANNEL_COLORS[ch],
      value: channelData[ch][metricKey] as number,
      trendScore: Math.max(-1, Math.min(1, trendScore)),
      sparkline: values,
    };
  });

  return (
    <div className="space-y-3">
      {/* Fading / Trending scale */}
      <div className="relative">
        <div className="flex justify-between text-[9px] text-muted-foreground mb-2">
          <span className="flex items-center gap-1">
            <span className="w-px h-2.5 bg-muted-foreground/30 inline-block" />
            fading
          </span>
          <span className="flex items-center gap-1">
            trending
            <span className="w-px h-2.5 bg-muted-foreground/30 inline-block" />
          </span>
        </div>
        <div className="h-1 bg-white/[0.04] rounded-full relative">
          {entries.map((entry) => {
            const pos = ((entry.trendScore + 1) / 2) * 100;
            return (
              <div
                key={entry.id}
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${Math.max(4, Math.min(96, pos))}%` }}
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-background shadow-sm"
                  style={{ backgroundColor: entry.color }}
                />
              </div>
            );
          })}
        </div>
      </div>
      {/* Channel rows with sparklines */}
      <div className="space-y-1.5">
        {entries.map((entry) => {
          const vals = entry.sparkline;
          const maxV = Math.max(...vals, 1);
          const minV = Math.min(...vals, 0);
          const range = maxV - minV || 1;
          const w = 44;
          const h = 14;
          const points = vals
            .map((v, i) => {
              const x =
                vals.length > 1
                  ? (i / (vals.length - 1)) * w
                  : w / 2;
              const y = h - ((v - minV) / range) * h;
              return `${x},${y}`;
            })
            .join(" ");

          return (
            <div key={entry.id} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[9px] font-medium w-11 truncate shrink-0">
                {entry.label}
              </span>
              <svg
                width={w}
                height={h}
                className="shrink-0 opacity-50"
              >
                <polyline
                  points={points}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-[9px] font-semibold tabular-nums ml-auto shrink-0">
                {config
                  ? formatKPIValue(entry.value, config.format)
                  : String(Math.round(entry.value))}
              </span>
              <span
                className={cn(
                  "text-[8px] font-semibold shrink-0 w-8 text-right",
                  entry.trendScore > 0.02
                    ? "text-emerald-400"
                    : entry.trendScore < -0.02
                      ? "text-red-400"
                      : "text-muted-foreground"
                )}
              >
                {entry.trendScore > 0.02
                  ? `+${(entry.trendScore * 100).toFixed(0)}%`
                  : entry.trendScore < -0.02
                    ? `${(entry.trendScore * 100).toFixed(0)}%`
                    : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── G. Dual Metric Barcode Card (like "Viewers" – two big numbers) ─────────

function DualMetricBentoCard({
  metric1Key,
  metric1Value,
  metric1Label,
  metric2Key,
  metric2Value,
  metric2Label,
  timeSeries,
}: {
  metric1Key: KPIKey;
  metric1Value: number;
  metric1Label: string;
  metric2Key: KPIKey;
  metric2Value: number;
  metric2Label: string;
  timeSeries: Array<Record<string, number | string>>;
}) {
  const config1 = getKPIConfig(metric1Key);
  const config2 = getKPIConfig(metric2Key);

  const values1 = timeSeries.map((d) => d[metric1Key] as number);
  const values2 = timeSeries.map((d) => d[metric2Key] as number);
  // Normalize both to the same scale so bars are comparable
  const globalMax = Math.max(...values1, ...values2, 1);
  const barCount = timeSeries.length;

  return (
    <div className="col-span-2 rounded-xl border border-border/40 bg-card p-5 flex flex-col min-w-0">
      {/* Header with two metrics */}
      <div className="flex items-start gap-8 mb-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-bold">
            {config1
              ? formatKPIValue(metric1Value, config1.format)
              : formatNumber(metric1Value)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {metric1Label}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-bold text-muted-foreground">
            {config2
              ? formatKPIValue(metric2Value, config2.format)
              : formatNumber(metric2Value)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {metric2Label}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-auto shrink-0">
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Pin className="h-3 w-3" />
          </button>
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {/* Paired vertical bars */}
      <div className="flex-1 min-h-0 flex items-end gap-px" style={{ height: 110 }}>
        {timeSeries.map((_d, i) => {
          const h1 = (values1[i] / globalMax) * 100;
          const h2 = (values2[i] / globalMax) * 100;
          return (
            <div
              key={i}
              className="flex-1 flex items-end gap-px"
              style={{ height: "100%" }}
            >
              {/* Metric 1 bar (Impressions – teal) */}
              <div
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${Math.max(h1, 2)}%`,
                  backgroundColor: "rgba(80, 184, 154, 0.7)",
                }}
              />
              {/* Metric 2 bar (Reach – white/grey) */}
              <div
                className="flex-1 rounded-t-sm"
                style={{
                  height: `${Math.max(h2, 2)}%`,
                  backgroundColor: "rgba(255, 255, 255, 0.12)",
                }}
              />
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-5 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-[#50b89a]/70" />
          <span className="text-[10px] text-muted-foreground">
            {metric1Label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-white/[0.12]" />
          <span className="text-[10px] text-muted-foreground">
            {metric2Label}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── H. Channel Horizontal Bars (like "Viewer Languages") ───────────────────

function ChannelHorizontalBars({
  channelData,
  metricKey,
}: {
  channelData: Record<string, AggregatedKPIs>;
  metricKey: KPIKey;
}) {
  const config = getKPIConfig(metricKey);
  const entries = CHANNEL_IDS.filter(
    (ch) => channelData[ch] && (channelData[ch][metricKey] as number) > 0
  ).map((ch) => ({
    id: ch,
    label: CHANNEL_LABELS[ch],
    value: channelData[ch][metricKey] as number,
    color: CHANNEL_COLORS[ch],
  }));

  const total = entries.reduce((sum, e) => sum + e.value, 0);
  const maxVal =
    entries.length > 0 ? Math.max(...entries.map((e) => e.value)) : 1;

  return (
    <div className="space-y-2.5">
      {entries.map((entry) => {
        const pct = total > 0 ? (entry.value / total) * 100 : 0;
        const barWidth = maxVal > 0 ? (entry.value / maxVal) * 100 : 0;
        return (
          <div key={entry.id} className="flex items-center gap-2.5">
            <span className="text-[10px] font-medium text-muted-foreground w-[72px] truncate shrink-0">
              {entry.label}
            </span>
            <div className="flex-1 min-w-0 h-2 rounded-full bg-white/[0.04] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.max(barWidth, 4)}%`,
                  backgroundColor: entry.color,
                }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums w-12 text-right shrink-0">
              {config
                ? formatKPIValue(entry.value, config.format)
                : String(Math.round(entry.value))}
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right shrink-0">
              {pct.toFixed(0)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── I. Campaign Ranking Bars ───────────────────────────────────────────────

function CampaignRankingBars({
  campaignData,
  metricKey,
}: {
  campaignData: Array<{ campaign: Campaign; kpis: AggregatedKPIs }>;
  metricKey: KPIKey;
}) {
  const config = getKPIConfig(metricKey);
  const sorted = [...campaignData]
    .sort(
      (a, b) =>
        (b.kpis[metricKey] as number) - (a.kpis[metricKey] as number)
    )
    .slice(0, 5);
  const maxVal =
    sorted.length > 0 ? (sorted[0].kpis[metricKey] as number) : 1;

  return (
    <div className="space-y-2">
      {sorted.map((item, i) => {
        const val = item.kpis[metricKey] as number;
        const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
        const opacity = 1 - i * 0.15;
        return (
          <div key={item.campaign.id} className="flex items-center gap-2">
            <span className="text-[11px] font-medium w-14 text-right shrink-0">
              {config
                ? formatKPIValue(val, config.format)
                : String(Math.round(val))}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div
                  className="h-5 rounded-sm"
                  style={{
                    width: `${Math.max(pct, 4)}%`,
                    backgroundColor: `rgba(80, 184, 154, ${opacity})`,
                  }}
                />
                <span className="text-[10px] text-muted-foreground truncate">
                  {item.campaign.name}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      {sorted.length === 0 && (
        <p className="text-xs text-muted-foreground">No campaign data</p>
      )}
    </div>
  );
}

// ─── J. Channel Pie ─────────────────────────────────────────────────────────

function ChannelPie({
  channelData,
  metricKey,
}: {
  channelData: Record<string, AggregatedKPIs>;
  metricKey: KPIKey;
}) {
  const entries = CHANNEL_IDS.filter(
    (ch) => channelData[ch] && (channelData[ch][metricKey] as number) > 0
  ).map((ch) => ({
    name: CHANNEL_LABELS[ch],
    value: channelData[ch][metricKey] as number,
    color: CHANNEL_COLORS[ch],
  }));

  const config = getKPIConfig(metricKey);

  return (
    <div>
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie
            data={entries}
            cx="50%"
            cy="50%"
            outerRadius={50}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {entries.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value) => [
              config
                ? formatKPIValue(value as number, config.format)
                : String(value),
              config?.label || metricKey,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
        {entries.map((e) => (
          <div key={e.name} className="flex items-center gap-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: e.color }}
            />
            <span className="text-[9px] text-muted-foreground">{e.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── K. Budget Pacing Gauge ─────────────────────────────────────────────────

function BudgetGauge({ pacing }: { pacing: number }) {
  const clampedPacing = Math.min(Math.max(pacing, 0), 120);
  const filled = (clampedPacing / 120) * 100;
  const remaining = 100 - filled;

  let gaugeColor = "#50b89a";
  if (pacing < 70) gaugeColor = "#e07060";
  else if (pacing < 85) gaugeColor = "#d4a55a";

  const gaugeData = [
    { name: "filled", value: filled },
    { name: "empty", value: remaining },
  ];

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={130}>
        <PieChart>
          <Pie
            data={gaugeData}
            cx="50%"
            cy="75%"
            startAngle={180}
            endAngle={0}
            innerRadius={50}
            outerRadius={70}
            paddingAngle={0}
            dataKey="value"
            stroke="none"
          >
            <Cell fill={gaugeColor} />
            <Cell fill="rgba(255,255,255,0.06)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-4 pointer-events-none">
        <span className="text-lg font-bold">{formatPercent(pacing)}</span>
        <span className="text-[10px] text-muted-foreground">on pace</span>
      </div>
    </div>
  );
}

// ─── Persona Data ───────────────────────────────────────────────────────────

interface Persona {
  id: string;
  name: string;
  shortName: string;
  reachShare: number;
  engagementIdx: number;
  deltaPercent: number;
  color: string;
  kpis: {
    cvr: number;
    cvrDelta: number;
    cpa: number;
    cpaDelta: number;
    aov: number;
    aovDelta: number;
    roas: number;
    roasDelta: number;
    ltv: number;
    ltvDelta: number;
    frequency: number;
    frequencyDelta: number;
  };
  topChannels: { name: string; share: number }[];
  topCategories: { name: string; share: number }[];
}

const PERSONAS: Persona[] = [
  {
    id: "value-families", name: "Value-Seeking Families", shortName: "Value Fam.",
    reachShare: 34, engagementIdx: 92, deltaPercent: 16, color: "#50b89a",
    kpis: { cvr: 3.8, cvrDelta: 12, cpa: 22, cpaDelta: -10, aov: 88, aovDelta: 4, roas: 6.4, roasDelta: 18, ltv: 3600, ltvDelta: 8, frequency: 2.4, frequencyDelta: 5 },
    topChannels: [{ name: "Google Search", share: 38 }, { name: "CTV", share: 26 }, { name: "Meta", share: 22 }],
    topCategories: [{ name: "Weekly Flyer", share: 48 }, { name: "Centre-Store", share: 32 }, { name: "Meat & Seafood", share: 20 }],
  },
  {
    id: "scene-members", name: "Scene+ Members", shortName: "Scene+ Mbrs",
    reachShare: 26, engagementIdx: 88, deltaPercent: 22, color: "#3d8c76",
    kpis: { cvr: 3.2, cvrDelta: 18, cpa: 19, cpaDelta: -12, aov: 102, aovDelta: 6, roas: 5.4, roasDelta: 24, ltv: 4200, ltvDelta: 14, frequency: 1.8, frequencyDelta: 4 },
    topChannels: [{ name: "Google Search", share: 32 }, { name: "TTD", share: 26 }, { name: "Instagram", share: 22 }],
    topCategories: [{ name: "Scene+ Loyalty", share: 46 }, { name: "Voilà E-Commerce", share: 32 }, { name: "Compliments", share: 22 }],
  },
  {
    id: "weekly-families", name: "Weekly Family Shoppers", shortName: "Weekly Fam.",
    reachShare: 22, engagementIdx: 84, deltaPercent: 6, color: "#2d6658",
    kpis: { cvr: 2.9, cvrDelta: 4, cpa: 26, cpaDelta: -3, aov: 76, aovDelta: 2, roas: 4.6, roasDelta: 8, ltv: 2800, ltvDelta: 4, frequency: 1.6, frequencyDelta: 1 },
    topChannels: [{ name: "Google Search", share: 36 }, { name: "Meta", share: 28 }, { name: "CTV", share: 18 }],
    topCategories: [{ name: "Meat & Seafood", share: 42 }, { name: "Centre-Store", share: 30 }, { name: "Seasonal & BBQ", share: 28 }],
  },
  {
    id: "bulk-shoppers", name: "Bulk / Stock-Up Shoppers", shortName: "Bulk/Stock",
    reachShare: 18, engagementIdx: 81, deltaPercent: 14, color: "#1e453b",
    kpis: { cvr: 4.6, cvrDelta: 22, cpa: 14, cpaDelta: -18, aov: 164, aovDelta: 8, roas: 7.2, roasDelta: 28, ltv: 5200, ltvDelta: 16, frequency: 2.2, frequencyDelta: 6 },
    topChannels: [{ name: "LinkedIn", share: 48 }, { name: "Google Search", share: 28 }, { name: "TTD", share: 16 }],
    topCategories: [{ name: "Centre-Store", share: 56 }, { name: "Weekly Flyer", share: 32 }, { name: "Compliments", share: 12 }],
  },
];

// ─── L. Persona Donut (compact, for left column) ────────────────────────────

function PersonaDonut({ activeIndex, onSelect }: { activeIndex: number; onSelect: (i: number) => void }) {
  const active = PERSONAS[activeIndex];
  const data = PERSONAS.map((p) => ({ name: p.name, value: p.reachShare, color: p.color }));

  return (
    <div className="flex items-center gap-4">
      <div className="relative shrink-0" style={{ width: 110, height: 110 }}>
        <ResponsiveContainer width={110} height={110}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={34}
              outerRadius={50}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} opacity={i === activeIndex ? 1 : 0.35} className="cursor-pointer" onClick={() => onSelect(i)} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold">{active.reachShare}%</span>
          <span className="text-[8px] text-muted-foreground leading-tight text-center max-w-[60px]">
            reach
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2 min-w-0 flex-1">
        {PERSONAS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onSelect(i)}
            className={cn(
              "flex items-center gap-2 text-left rounded-md px-1.5 py-0.5 transition-colors",
              i === activeIndex ? "bg-muted/60" : "hover:bg-muted/30"
            )}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <span className={cn("text-[11px] truncate flex-1", i === activeIndex ? "text-foreground font-medium" : "text-muted-foreground")}>
              {p.shortName}
            </span>
            <span className="text-[11px] font-semibold tabular-nums shrink-0">{p.reachShare}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── M. Persona KPI Detail Card ─────────────────────────────────────────────

const KPI_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  cvr: Target,
  cpa: DollarSign,
  aov: ShoppingCart,
  roas: TrendingUp,
  ltv: Heart,
  frequency: Repeat,
};

const KPI_LABEL_MAP: Record<string, string> = {
  cvr: "CVR",
  cpa: "CPA",
  aov: "AOV",
  roas: "ROAS",
  ltv: "LTV",
  frequency: "Frequency",
};

function formatPersonaKPI(key: string, val: number): string {
  if (key === "cpa" || key === "aov") return `$${val.toFixed(2)}`;
  if (key === "ltv") return `$${val}`;
  if (key === "cvr") return `${val}%`;
  if (key === "roas") return `${val.toFixed(1)}x`;
  if (key === "frequency") return `${val.toFixed(1)}x`;
  return String(val);
}

function PersonaKPIDetail({ persona }: { persona: Persona }) {
  const kpiKeys = ["cvr", "cpa", "aov", "roas", "ltv", "frequency"] as const;

  return (
    <div className="space-y-4">
      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-3">
        {kpiKeys.map((key) => {
          const Icon = KPI_ICON_MAP[key];
          const value = persona.kpis[key];
          const delta = persona.kpis[`${key}Delta` as keyof typeof persona.kpis] as number;
          const isGood = key === "cpa" ? delta < 0 : delta > 0;

          return (
            <div key={key} className="rounded-lg bg-muted/30 p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  {KPI_LABEL_MAP[key]}
                </span>
              </div>
              <span className="text-base font-bold tabular-nums">{formatPersonaKPI(key, value)}</span>
              <span className={cn("text-[10px] font-semibold tabular-nums", isGood ? "text-emerald-400" : "text-red-400")}>
                {delta > 0 ? "+" : ""}{delta}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom row: Top Channels + Top Categories */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Top Channels</span>
          <div className="space-y-1.5">
            {persona.topChannels.map((ch) => (
              <div key={ch.name} className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${ch.share}%`, backgroundColor: persona.color }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-16 truncate">{ch.name}</span>
                <span className="text-[10px] font-semibold tabular-nums w-7 text-right">{ch.share}%</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Top Categories</span>
          <div className="space-y-1.5">
            {persona.topCategories.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${cat.share}%`, backgroundColor: persona.color, opacity: 0.7 }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-24 truncate">{cat.name}</span>
                <span className="text-[10px] font-semibold tabular-nums w-7 text-right">{cat.share}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── N. Interactive Persona Explorer ─────────────────────────────────────────

function PersonaExplorer() {
  const [activeIndex, setActiveIndex] = React.useState(0);
  const persona = PERSONAS[activeIndex];

  const prev = () => setActiveIndex((i) => (i - 1 + PERSONAS.length) % PERSONAS.length);
  const next = () => setActiveIndex((i) => (i + 1) % PERSONAS.length);

  return (
    <div className="grid grid-cols-[280px_1fr] gap-5">
      {/* Left: Donut + persona selector */}
      <div className="flex flex-col gap-4">
        <PersonaDonut activeIndex={activeIndex} onSelect={setActiveIndex} />
        {/* Engagement index bar for selected persona */}
        <div className="rounded-lg bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Engagement Index</span>
            <span className={cn("text-[10px] font-semibold tabular-nums", persona.deltaPercent > 0 ? "text-emerald-400" : "text-red-400")}>
              {persona.deltaPercent > 0 ? "+" : ""}{persona.deltaPercent}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${persona.engagementIdx}%`, backgroundColor: persona.color }}
            />
          </div>
          <span className="text-[11px] font-bold tabular-nums mt-1 block">{persona.engagementIdx}/100</span>
        </div>
      </div>

      {/* Right: KPI detail for active persona */}
      <div className="flex flex-col min-w-0">
        {/* Persona name header with nav */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" style={{ color: persona.color }} />
            <span className="text-sm font-semibold">{persona.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={prev} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">{activeIndex + 1}/{PERSONAS.length}</span>
            <button onClick={next} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <PersonaKPIDetail persona={persona} />
      </div>
    </div>
  );
}

// ─── Main Grid ───────────────────────────────────────────────────────────────

export function BentoKPIGrid({ data, compareEnabled, funnelStage = 'all' }: BentoKPIGridProps) {
  const { currentKPIs, previousKPIs, timeSeries, channelData, campaignData } =
    data;
  const layout = FUNNEL_GRID_LAYOUTS[funnelStage];

  function delta(key: KPIKey) {
    return getDelta(
      currentKPIs[key] as number,
      previousKPIs ? (previousKPIs[key] as number) : undefined
    );
  }

  function getLabel(key: KPIKey): string {
    return getKPIConfig(key)?.label || key;
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        KPI Deep Dive
      </h2>
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        {/* ── Row 1 ─────────────────────────────────────────── */}
        <DualMetricBentoCard
          metric1Key={layout.dualMetric1}
          metric1Value={currentKPIs[layout.dualMetric1] as number}
          metric1Label={getLabel(layout.dualMetric1)}
          metric2Key={layout.dualMetric2}
          metric2Value={currentKPIs[layout.dualMetric2] as number}
          metric2Label={getLabel(layout.dualMetric2)}
          timeSeries={timeSeries}
        />

        <BentoCard
          kpiKey={layout.row1Col3}
          value={currentKPIs[layout.row1Col3] as number}
          deltaInfo={delta(layout.row1Col3)}
          compareEnabled={compareEnabled}
        >
          <ChannelHorizontalBars channelData={channelData} metricKey={layout.row1Col3} />
        </BentoCard>

        <BentoCard
          kpiKey={layout.row1Col4}
          value={currentKPIs[layout.row1Col4] as number}
          deltaInfo={delta(layout.row1Col4)}
          compareEnabled={compareEnabled}
        >
          <AreaMiniChart data={timeSeries} metricKey={layout.row1Col4} />
        </BentoCard>

        {/* ── Row 2 ─────────────────────────────────────────── */}
        <BentoCard
          kpiKey={layout.row2Col1}
          value={currentKPIs[layout.row2Col1] as number}
          deltaInfo={delta(layout.row2Col1)}
          compareEnabled={compareEnabled}
        >
          <DonutWithSideLegend channelData={channelData} metricKey={layout.row2Col1} />
        </BentoCard>

        <BentoCard
          kpiKey={layout.row2Col2}
          value={currentKPIs[layout.row2Col2] as number}
          deltaInfo={delta(layout.row2Col2)}
          compareEnabled={compareEnabled}
        >
          <CampaignDeltaBars
            campaignData={campaignData}
            metricKey={layout.row2Col2}
          />
        </BentoCard>

        <BentoCard
          kpiKey={layout.row2Wide}
          value={currentKPIs[layout.row2Wide] as number}
          deltaInfo={delta(layout.row2Wide)}
          compareEnabled={compareEnabled}
          colSpan={2}
        >
          <BarMiniChart data={timeSeries} metricKey={layout.row2Wide} />
        </BentoCard>

        {/* ── Row 3 ─────────────────────────────────────────── */}
        <BentoCard
          kpiKey={layout.row3Col1}
          value={currentKPIs[layout.row3Col1] as number}
          deltaInfo={delta(layout.row3Col1)}
          compareEnabled={compareEnabled}
        >
          <ChannelTrendingScale
            channelData={channelData}
            timeSeries={timeSeries}
            metricKey={layout.row3Col1}
          />
        </BentoCard>

        <BentoCard
          kpiKey={layout.row3Col2}
          value={currentKPIs[layout.row3Col2] as number}
          deltaInfo={delta(layout.row3Col2)}
          compareEnabled={compareEnabled}
        >
          <AreaMiniChart data={timeSeries} metricKey={layout.row3Col2} />
        </BentoCard>

        <BentoCard
          kpiKey={layout.row3Col3}
          value={currentKPIs[layout.row3Col3] as number}
          deltaInfo={delta(layout.row3Col3)}
          compareEnabled={compareEnabled}
        >
          <ChannelPie channelData={channelData} metricKey={layout.row3Col3} />
        </BentoCard>

        <BentoCard
          kpiKey={layout.row3Col4}
          value={currentKPIs[layout.row3Col4] as number}
          deltaInfo={delta(layout.row3Col4)}
          compareEnabled={compareEnabled}
        >
          {layout.row3Col4 === 'budgetPacing' ? (
            <BudgetGauge pacing={currentKPIs.budgetPacing} />
          ) : (
            <ChannelHorizontalBars channelData={channelData} metricKey={layout.row3Col4} />
          )}
        </BentoCard>
      </div>

      {/* ── Audience Personas ─────────────────────────────────── */}
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mt-6">
        Audience Personas
      </h2>
      <div className="rounded-xl border border-border/40 bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.12em]">
            Persona Explorer
          </span>
          <button className="p-1 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>
        <PersonaExplorer />
      </div>
    </div>
  );
}
