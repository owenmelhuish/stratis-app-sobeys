"use client";
import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Settings2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatKPIValue, formatCurrency } from '@/lib/format';
import { KPI_CONFIGS, type KPIKey } from '@/types';
import { useAppStore } from '@/lib/store';
import type { DashboardData } from '@/hooks/use-dashboard-data';

// ─── Thresholds ───
const KPI_THRESHOLDS: Record<string, { warn: number; good: number; direction: 'higher' | 'lower'; mode: 'absolute' | 'delta' }> = {
  roas:           { warn: 2.8,  good: 4.0,  direction: 'higher', mode: 'absolute' },
  revenue:        { warn: -10,  good: 10,   direction: 'higher', mode: 'delta' },
  cpl:            { warn: 280,  good: 200,  direction: 'lower',  mode: 'absolute' },
  leads:          { warn: -10,  good: 10,   direction: 'higher', mode: 'delta' },
  spend:          { warn: -15,  good: 5,    direction: 'higher', mode: 'delta' },
  conversions:    { warn: -10,  good: 10,   direction: 'higher', mode: 'delta' },
  cpa:            { warn: 250,  good: 150,  direction: 'lower',  mode: 'absolute' },
  budgetPacing:   { warn: 80,   good: 95,   direction: 'higher', mode: 'absolute' },
  reach:          { warn: -15,  good: 10,   direction: 'higher', mode: 'delta' },
  conversionRate: { warn: -20,  good: 10,   direction: 'higher', mode: 'delta' },
};

type ThresholdState = 'neutral' | 'alert' | 'outperforming';

function getThresholdState(key: string, value: number, deltaPercent: number): ThresholdState {
  const t = KPI_THRESHOLDS[key];
  if (!t) return 'neutral';
  const checkValue = t.mode === 'delta' ? deltaPercent : value;
  if (t.direction === 'higher') {
    if (checkValue < t.warn) return 'alert';
    if (checkValue > t.good) return 'outperforming';
  } else {
    if (checkValue > t.warn) return 'alert';
    if (checkValue < t.good) return 'outperforming';
  }
  return 'neutral';
}

// ─── Delta from sparkline data: compare first 7 vs last 7 day averages ───
function sparkDelta(sparkData: number[]): number {
  if (sparkData.length < 6) return 0;
  const window = Math.min(7, Math.floor(sparkData.length / 3));
  const startAvg = sparkData.slice(0, window).reduce((s, v) => s + v, 0) / window;
  const endAvg = sparkData.slice(-window).reduce((s, v) => s + v, 0) / window;
  if (startAvg === 0) return endAvg > 0 ? 100 : 0;
  return ((endAvg - startAvg) / Math.abs(startAvg)) * 100;
}

// ─── Smooth sparkline (catmull-rom cubic bezier) ───
function smoothSparklinePath(
  data: number[], width: number, height: number, padding: number = 4
): { linePath: string; areaPath: string } {
  if (data.length < 2) return { linePath: '', areaPath: '' };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => ({
    x: (i / (data.length - 1)) * width,
    y: padding + ((max - v) / range) * (height - padding * 2),
  }));
  const tension = 0.3;
  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    path += ` C ${p1.x + (p2.x - p0.x) * tension},${p1.y + (p2.y - p0.y) * tension} ${p2.x - (p3.x - p1.x) * tension},${p2.y - (p3.y - p1.y) * tension} ${p2.x},${p2.y}`;
  }
  return { linePath: path, areaPath: `${path} L ${width},${height} L 0,${height} Z` };
}

// ─── Color helpers (use delta direction when threshold state is neutral) ───
function getLineEndColor(state: ThresholdState, deltaPct?: number): string {
  if (state === 'alert') return 'rgba(226,75,74,0.7)';
  if (state === 'outperforming') return 'rgba(93,202,165,0.6)';
  if (deltaPct !== undefined) {
    if (deltaPct > 0.5) return 'rgba(93,202,165,0.5)';
    if (deltaPct < -0.5) return 'rgba(226,75,74,0.5)';
  }
  return 'rgba(255,255,255,0.25)';
}
function getFillColor(state: ThresholdState, deltaPct?: number): string {
  if (state === 'alert') return 'rgba(226,75,74,1)';
  if (state === 'outperforming') return 'rgba(93,202,165,1)';
  if (deltaPct !== undefined) {
    if (deltaPct > 0.5) return 'rgba(93,202,165,1)';
    if (deltaPct < -0.5) return 'rgba(226,75,74,1)';
  }
  return 'rgba(255,255,255,1)';
}
function getDeltaClass(_state: ThresholdState, deltaPct?: number): string {
  if (deltaPct !== undefined) {
    if (deltaPct > 0.5) return 'text-emerald-400';
    if (deltaPct < -0.5) return 'text-red-400';
  }
  return 'text-muted-foreground/60';
}
function getDotColor(state: ThresholdState): string {
  return state === 'alert' ? '#E24B4A' : state === 'outperforming' ? '#5DCAA5' : 'rgba(255,255,255,0.15)';
}

// Short labels for compact pills
const SHORT_LABELS: Record<string, string> = {
  spend: 'SPEND', revenue: 'SALES', roas: 'ROAS', leads: 'SIGN-UPS', cpl: 'CPSU', conversions: 'TXNS',
  cpa: 'CPA', budgetPacing: 'PACING', activeCampaigns: 'CAMPAIGNS',
  conversionRate: 'CVR', reach: 'REACH',
};

// ─── CSS ───
const SPARKLINE_CSS = `
@keyframes sparkDraw {
  to { stroke-dashoffset: 0; }
}
.sparkline-draw {
  stroke-dasharray: 2000;
  stroke-dashoffset: 2000;
  animation: sparkDraw 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
`;

// ─── Metric definition type ───
interface MetricDef {
  label: string;
  key: string;
  value: number;
  format: 'currency' | 'number' | 'percent' | 'decimal' | 'index';
  deltaPct: number;
  prior: number | null;
  spark: number[];
  context?: string;
}

// ─── Hero card ───
function HeroCard({ label, metricKey, value, format, deltaPct, priorValue, sparkData, state, contextLabel, onClick }: {
  label: string; metricKey: string; value: number;
  format: 'currency' | 'number' | 'percent' | 'decimal' | 'index';
  deltaPct: number; priorValue: number | null; sparkData: number[];
  state: ThresholdState; contextLabel?: string; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const threshold = KPI_THRESHOLDS[metricKey];
  const { linePath, areaPath } = smoothSparklinePath(sparkData, 400, 120);
  const lineEndColor = getLineEndColor(state, deltaPct);
  const fillColor = getFillColor(state, deltaPct);
  const deltaClass = getDeltaClass(state, deltaPct);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/40 bg-card cursor-pointer hover:border-border/60 transition-colors",
      )}
      style={{ minHeight: 220 }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="px-5 pt-4 relative z-10">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
          {contextLabel && <span className="text-[9px] text-muted-foreground/60">{contextLabel}</span>}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[28px] font-semibold tracking-tight leading-none" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono, monospace)' }}>
            {formatKPIValue(value, format)}
          </span>
          <span className={cn("text-xs font-medium", deltaClass)}>
            {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0" style={{ height: 120 }}>
        <svg width="100%" height="120" viewBox="0 0 400 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`spark-line-hero-${metricKey}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="100%" stopColor={lineEndColor} />
            </linearGradient>
            <linearGradient id={`spark-fill-hero-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.12} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#spark-fill-hero-${metricKey})`} />
          <path d={linePath} fill="none" stroke={`url(#spark-line-hero-${metricKey})`} strokeWidth="1.5" className="sparkline-draw" />
        </svg>
      </div>

      {hovered && (
        <div className="absolute left-0 right-0 bottom-0 bg-card/95 backdrop-blur-sm border-t border-border/30 p-3 z-20 rounded-b-lg">
          <div className="grid grid-cols-2 gap-y-1.5 text-[11px]">
            <span className="text-muted-foreground">Current</span>
            <span className="text-right font-medium tabular-nums">{formatKPIValue(value, format)}</span>
            {priorValue !== null && (
              <>
                <span className="text-muted-foreground">Prior Period</span>
                <span className="text-right font-medium tabular-nums">{formatKPIValue(priorValue, format)}</span>
              </>
            )}
            {threshold && threshold.mode === 'absolute' && (
              <>
                <span className="text-muted-foreground">Target Range</span>
                <span className="text-right font-medium tabular-nums">
                  {format === 'currency' ? `$${threshold.good}` : `${threshold.good}x`} – {format === 'currency' ? `$${threshold.warn}` : `${threshold.warn}x`}
                </span>
              </>
            )}
            <span className="text-muted-foreground">Trend</span>
            <span className={cn("text-right font-medium", deltaClass)}>
              {deltaPct > 0 ? '▲' : deltaPct < 0 ? '▼' : '—'} {deltaPct > 0 ? 'Improving' : deltaPct < 0 ? 'Declining' : 'Flat'} ({deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Supporting card ───
function SupportCard({ label, metricKey, value, format, deltaPct, sparkData, state, onClick }: {
  label: string; metricKey: string; value: number;
  format: 'currency' | 'number' | 'percent' | 'decimal' | 'index';
  deltaPct: number; sparkData: number[]; state: ThresholdState; onClick: () => void;
}) {
  const { linePath, areaPath } = smoothSparklinePath(sparkData, 300, 75);
  const lineEndColor = getLineEndColor(state, deltaPct);
  const fillColor = getFillColor(state, deltaPct);
  const deltaClass = getDeltaClass(state, deltaPct);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border border-border/40 bg-card cursor-pointer hover:border-border/60 transition-colors",
      )}
      style={{ minHeight: 160 }}
      onClick={onClick}
    >
      <div className="px-4 pt-3 relative z-10">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.12em]">{label}</span>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-xl font-semibold tracking-tight leading-none" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono, monospace)' }}>
            {formatKPIValue(value, format)}
          </span>
          <span className={cn("text-xs font-medium", deltaClass)}>{deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%</span>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0" style={{ height: 75 }}>
        <svg width="100%" height="75" viewBox="0 0 300 75" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`spark-line-sup-${metricKey}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.2)" />
              <stop offset="100%" stopColor={lineEndColor} />
            </linearGradient>
            <linearGradient id={`spark-fill-sup-${metricKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.12} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#spark-fill-sup-${metricKey})`} />
          <path d={linePath} fill="none" stroke={`url(#spark-line-sup-${metricKey})`} strokeWidth="1.5" className="sparkline-draw" />
        </svg>
      </div>

    </div>
  );
}

// ─── Compact pill (shown when a card is expanded) ───
function CompactPill({ metric, isActive, onClick }: { metric: MetricDef; isActive: boolean; onClick: () => void }) {
  const state = getThresholdState(metric.key, metric.value, metric.deltaPct);
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all shrink-0",
        isActive
          ? "bg-muted/50 border border-border/60 text-foreground"
          : "bg-transparent border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
      )}
    >
      <span className="text-[9px] uppercase tracking-wider font-medium">{SHORT_LABELS[metric.key] || metric.label}</span>
      <span className="font-semibold tabular-nums" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
        {formatKPIValue(metric.value, metric.format)}
      </span>
      {state === 'alert' && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
      {state === 'outperforming' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
    </button>
  );
}

// ─── Expanded KPI detail view ───
function ExpandedKPIDetail({ metricKey, metricDef, data, onClose }: {
  metricKey: string; metricDef: MetricDef; data: DashboardData; onClose: () => void;
}) {
  const seriesData = data.timeSeries.slice(-30);

  const dailyValues = seriesData.map(d => {
    const date = d.date as string;
    let value: number;
    switch (metricKey) {
      case 'roas':
        value = (d.spend as number) > 0 ? (d.revenue as number) / (d.spend as number) : 0; break;
      case 'cpa':
        value = (d.conversions as number) > 0 ? (d.spend as number) / (d.conversions as number) : 0; break;
      case 'conversionRate':
        value = (d.clicks as number) > 0 ? ((d.conversions as number) / (d.clicks as number)) * 100 : 0; break;
      case 'budgetPacing':
        value = (d[metricKey] as number) || 0; break;
      case 'activeCampaigns':
        value = data.campaignData.filter(c => c.campaign.status === 'live').length; break;
      default:
        value = (d[metricKey] as number) || 0;
    }
    return { date, value, spend: d.spend as number, revenue: d.revenue as number, conversions: d.conversions as number };
  });

  const sparkValues = dailyValues.map(d => d.value);
  const { linePath, areaPath } = smoothSparklinePath(sparkValues, 900, 200, 8);

  const state = getThresholdState(metricKey, metricDef.value, metricDef.deltaPct);
  const lineEndColor = getLineEndColor(state, metricDef.deltaPct);
  const fillColor = getFillColor(state, metricDef.deltaPct);
  const deltaClass = getDeltaClass(state, metricDef.deltaPct);

  const avg = sparkValues.reduce((s, v) => s + v, 0) / sparkValues.length;
  const min = Math.min(...sparkValues);
  const max = Math.max(...sparkValues);

  const fmt = metricDef.format;

  // Y-axis ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => max - (max - min) * (i / 4));

  // X-axis labels
  const xLabelCount = 6;
  const xStep = Math.max(1, Math.floor(dailyValues.length / (xLabelCount - 1)));

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Card className="p-6 bg-card border-border/40 animate-in fade-in slide-in-from-top-2 duration-300 mt-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-[0.12em]">{metricDef.label}</span>
          <span className="text-2xl font-semibold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono, monospace)' }}>
            {formatKPIValue(metricDef.value, fmt)}
          </span>
          <span className={cn("text-sm font-medium", deltaClass)}>
            {metricDef.deltaPct > 0 ? '+' : ''}{metricDef.deltaPct.toFixed(1)}%
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Large chart */}
      <div className="relative rounded-lg bg-muted/10 border border-border/20 overflow-hidden" style={{ height: 200 }}>
        <div className="absolute left-0 top-0 bottom-0 w-14 flex flex-col justify-between py-2 z-10">
          {yTicks.map((tick, i) => (
            <span key={i} className="text-[9px] text-muted-foreground/50 text-right pr-2 tabular-nums">
              {formatKPIValue(tick, fmt)}
            </span>
          ))}
        </div>
        <svg width="100%" height="200" viewBox="0 0 900 200" preserveAspectRatio="none" className="absolute inset-0" style={{ paddingLeft: 56 }}>
          <defs>
            <linearGradient id="expanded-line-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="100%" stopColor={lineEndColor} />
            </linearGradient>
            <linearGradient id="expanded-fill-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.1} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#expanded-fill-grad)" />
          <path d={linePath} fill="none" stroke="url(#expanded-line-grad)" strokeWidth="2" className="sparkline-draw" />
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-1 px-14">
        {Array.from({ length: xLabelCount }, (_, i) => {
          const idx = Math.min(i * xStep, dailyValues.length - 1);
          return (
            <span key={i} className="text-[9px] text-muted-foreground/40 tabular-nums">
              {formatDate(dailyValues[idx].date)}
            </span>
          );
        })}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-3 mt-4">
        {[
          { label: 'Current', val: metricDef.value },
          { label: 'Period Average', val: avg },
          { label: 'Period High', val: max },
          { label: 'Period Low', val: min },
        ].map(stat => (
          <div key={stat.label} className="rounded-lg bg-muted/20 px-3 py-2">
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            <p className="text-sm font-semibold tabular-nums mt-0.5" style={{ fontFamily: 'var(--font-mono, monospace)' }}>
              {formatKPIValue(stat.val, fmt)}
            </p>
          </div>
        ))}
      </div>

      {/* Daily data table */}
      <div className="mt-4 rounded-lg border border-border/20 overflow-hidden">
        <div className="max-h-[240px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/20 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Date</th>
                <th className="text-right px-3 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{metricDef.label}</th>
                <th className="text-right px-3 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Spend</th>
                <th className="text-right px-3 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Revenue</th>
                <th className="text-right px-3 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Conversions</th>
              </tr>
            </thead>
            <tbody>
              {[...dailyValues].reverse().map(d => (
                <tr key={d.date} className="border-t border-border/10 hover:bg-muted/10">
                  <td className="px-3 py-1.5 text-muted-foreground tabular-nums">{d.date}</td>
                  <td className="px-3 py-1.5 text-right font-medium tabular-nums">{formatKPIValue(d.value, fmt)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{formatCurrency(d.spend)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{formatCurrency(d.revenue)}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground tabular-nums">{Math.round(d.conversions).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

// ─── Main component ───
interface Props {
  data: DashboardData;
  compareEnabled: boolean;
}

export function MissionControlRail({ data }: Props) {
  const [kpiDialogOpen, setKpiDialogOpen] = useState(false);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);
  const customKpis = useAppStore(s => s.customKpis);
  const setCustomKpis = useAppStore(s => s.setCustomKpis);

  const toggleKpi = useCallback((key: KPIKey) => {
    const next = customKpis.includes(key) ? customKpis.filter(k => k !== key) : [...customKpis, key];
    setCustomKpis(next);
  }, [customKpis, setCustomKpis]);

  const toggleExpand = useCallback((key: string) => {
    setExpandedMetric(prev => prev === key ? null : key);
  }, []);

  const metrics = useMemo(() => {
    const cur = data.currentKPIs;
    const ts = data.timeSeries;

    // Build sparkline arrays first
    const spark30 = (key: string) => ts.slice(-30).map(d => (d[key] as number) || 0);
    const spark14 = (key: string) => ts.slice(-14).map(d => (d[key] as number) || 0);

    const spendSpark = spark30('spend');
    const revenueSpark = spark30('revenue');
    const conversionsSpark = spark30('conversions');
    const reachSpark = spark14('reach');

    const roasSpark = ts.slice(-30).map(d => { const sp = (d.spend as number) || 0; const rev = (d.revenue as number) || 0; return sp > 0 ? rev / sp : 0; });
    const cpaSpark = ts.slice(-14).map(d => { const sp = (d.spend as number) || 0; const conv = (d.conversions as number) || 0; return conv > 0 ? sp / conv : 0; });
    const convRateSpark = ts.slice(-14).map(d => { const cl = (d.clicks as number) || 0; const conv = (d.conversions as number) || 0; return cl > 0 ? (conv / cl) * 100 : 0; });
    const budgetSpark = spark14('budgetPacing');

    const activeCampaigns = data.campaignData.filter(c => c.campaign.status === 'live').length;
    const conversionRate = cur.clicks > 0 ? (cur.conversions / cur.clicks) * 100 : 0;
    const campSpark = new Array(14).fill(activeCampaigns);

    // Prior values for hover context
    const spendPrior = ts.slice(-60, -30);
    const priorSpendSum = spendPrior.reduce((s, d) => s + ((d.spend as number) || 0), 0);
    const priorRevSum = spendPrior.reduce((s, d) => s + ((d.revenue as number) || 0), 0);
    const priorConvSum = spendPrior.reduce((s, d) => s + ((d.conversions as number) || 0), 0);
    const priorRoas = priorSpendSum > 0 ? priorRevSum / priorSpendSum : 0;

    const hero: MetricDef[] = [
      { label: 'Media Investment', key: 'spend', value: cur.spend, format: 'currency', deltaPct: 8.4, prior: priorSpendSum, spark: spendSpark, context: 'vs plan' },
      { label: 'Attributed Sales', key: 'revenue', value: cur.revenue, format: 'currency', deltaPct: 11.2, prior: priorRevSum, spark: revenueSpark },
      { label: 'ROAS', key: 'roas', value: cur.roas, format: 'decimal', deltaPct: 6.4, prior: priorRoas, spark: roasSpark, context: '2.8x – 4.0x target' },
      { label: 'Transactions', key: 'conversions', value: cur.conversions, format: 'number', deltaPct: -3.2, prior: priorConvSum, spark: conversionsSpark },
    ];
    const support: MetricDef[] = [
      { label: 'CPA', key: 'cpa', value: cur.cpa, format: 'currency', deltaPct: -8.1, prior: null, spark: cpaSpark },
      { label: 'Budget Pacing', key: 'budgetPacing', value: cur.budgetPacing, format: 'percent', deltaPct: 2.1, prior: null, spark: budgetSpark },
      { label: 'Active Campaigns', key: 'activeCampaigns', value: activeCampaigns, format: 'number', deltaPct: 0, prior: null, spark: campSpark },
      { label: 'Conversion Rate', key: 'conversionRate', value: conversionRate, format: 'percent', deltaPct: -4.7, prior: null, spark: convRateSpark },
      { label: 'Reach', key: 'reach', value: cur.reach, format: 'number', deltaPct: 9.1, prior: null, spark: reachSpark },
    ];

    return { hero, support, all: [...hero, ...support] };
  }, [data]);

  const expandedDef = expandedMetric ? metrics.all.find(m => m.key === expandedMetric) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SPARKLINE_CSS }} />
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Mission Control</h2>
          <Dialog open={kpiDialogOpen} onOpenChange={setKpiDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                <Settings2 className="h-3 w-3 mr-1" /> Customize KPIs
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Customize Dashboard KPIs</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-2 mt-4 max-h-80 overflow-auto">
                {KPI_CONFIGS.map(config => (
                  <div key={config.key} className="flex items-center gap-2 p-2 rounded hover:bg-muted">
                    <Checkbox id={`mc-${config.key}`} checked={customKpis.includes(config.key)} onCheckedChange={() => toggleKpi(config.key)} />
                    <Label htmlFor={`mc-${config.key}`} className="text-sm cursor-pointer">{config.label}</Label>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {expandedMetric && expandedDef ? (
          <>
            {/* Compact pill bar */}
            <div className="flex gap-1.5 flex-wrap animate-in fade-in slide-in-from-top-1 duration-200">
              {metrics.all.map(m => (
                <CompactPill key={m.key} metric={m} isActive={m.key === expandedMetric} onClick={() => toggleExpand(m.key)} />
              ))}
            </div>

            {/* Expanded detail */}
            <ExpandedKPIDetail
              metricKey={expandedMetric}
              metricDef={expandedDef}
              data={data}
              onClose={() => setExpandedMetric(null)}
            />
          </>
        ) : (
          <>
            {/* Hero row */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
              {metrics.hero.map(m => (
                <HeroCard
                  key={m.key}
                  label={m.label}
                  metricKey={m.key}
                  value={m.value}
                  format={m.format}
                  deltaPct={m.deltaPct}
                  priorValue={m.prior}
                  sparkData={m.spark}
                  state={getThresholdState(m.key, m.value, m.deltaPct)}
                  contextLabel={m.context}
                  onClick={() => toggleExpand(m.key)}
                />
              ))}
            </div>

            {/* Supporting row */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 mt-3">
              {metrics.support.map(m => (
                <SupportCard
                  key={m.key}
                  label={m.label}
                  metricKey={m.key}
                  value={m.value}
                  format={m.format}
                  deltaPct={m.deltaPct}
                  sparkData={m.spark}
                  state={getThresholdState(m.key, m.value, m.deltaPct)}
                  onClick={() => toggleExpand(m.key)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
