"use client";

import React, { useId, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, ScatterChart, Scatter, ZAxis,
  Cell, XAxis, YAxis, CartesianGrid, ReferenceLine, LabelList,
} from 'recharts';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';
import type { InsightVisual, InsightRefLine } from '@/lib/insight-visuals';

interface InsightChartProps {
  visual: InsightVisual;
  variant?: 'card' | 'detail';
  className?: string;
}

// ── color helpers (brand hexes → gradients / glow) ───────────────────────────
function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
function isHex(c: string) { return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c); }
function rgba(c: string, a: number): string {
  if (!isHex(c)) return c;
  const [r, g, b] = parseHex(c);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function lighten(c: string, amt: number): string {
  if (!isHex(c)) return c;
  const [r, g, b] = parseHex(c);
  const f = (v: number) => Math.round(v + (255 - v) * amt);
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

// Human-readable x-axis titles by data key
const X_TITLES: Record<string, string> = {
  tier: 'Live campaigns by tier',
  partner: 'Regional partner',
  theme: 'Message theme',
  format: 'Google ad format',
  week: 'Week',
  source: 'Conquest source',
  day: 'Timeline',
  region: 'Region',
  channel: 'Video channel',
  metro: 'Metro',
  readiness: 'Readiness tier',
};
function cap(s?: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }

const GRID_STROKE = 'rgba(148,163,184,0.14)';

// Reference line label rendered as a solid pill so it stays readable over bars/areas.
function makeRefLabel(text: string, color: string, axis: 'x' | 'y') {
  const RefLabel = (props: { viewBox?: { x?: number; y?: number; width?: number; height?: number } }) => {
    const vb = props.viewBox ?? {};
    const x = vb.x ?? 0, y = vb.y ?? 0;
    const h = 16;
    const w = Math.max(30, text.length * 5.4 + 12);
    const lx = axis === 'y' ? x + 4 : Math.max(2, x - w - 4);
    const ly = axis === 'y' ? y - h / 2 : y + 2;
    return (
      <g style={{ pointerEvents: 'none' }}>
        <rect x={lx} y={ly} width={w} height={h} rx={4}
          fill="var(--card)" fillOpacity={0.92} stroke={color} strokeOpacity={0.45} strokeWidth={1} />
        <text x={lx + w / 2} y={ly + h / 2 + 0.5} textAnchor="middle" dominantBaseline="central"
          fontSize={9} fontWeight={600} fill={color}>{text}</text>
      </g>
    );
  };
  RefLabel.displayName = 'RefLabel';
  return <RefLabel />;
}

function renderRefLines(refLines: InsightRefLine[] | undefined) {
  if (!refLines) return null;
  return refLines.map((r, i) => {
    const color = r.color ?? 'rgba(148,163,184,0.7)';
    const label = r.label ? makeRefLabel(r.label, color, r.axis) : undefined;
    return r.axis === 'y' ? (
      <ReferenceLine key={`ref-${i}`} y={r.value as number} stroke={color}
        strokeDasharray="5 4" strokeWidth={1.25} label={label} />
    ) : (
      <ReferenceLine key={`ref-${i}`} x={r.value} stroke={color}
        strokeDasharray="5 4" strokeWidth={1.25} label={label} />
    );
  });
}

export function InsightChart({ visual, variant = 'card', className }: InsightChartProps) {
  const compact = variant === 'card';
  const { kind, data, config, xKey, series, refLines, perBarColor } = visual;
  const heightClass = compact ? 'h-[150px]' : 'h-[196px]';
  const axisTick = { fontSize: compact ? 9 : 10, fill: 'var(--chart-text)' };
  const uid = useId().replace(/:/g, '');

  // Axis titles
  const seriesLabel = (k: string) => {
    const l = config[k]?.label;
    return typeof l === 'string' ? l : undefined;
  };
  const yTitle = visual.yTitle
    ?? (kind === 'scatter' ? visual.yName : (series.length === 1 ? seriesLabel(series[0]) : undefined));
  const xTitle = visual.xTitle
    ?? (kind === 'scatter' ? visual.xName : (xKey ? (X_TITLES[xKey] ?? cap(xKey)) : undefined));

  // Colors in use
  const usedColors = useMemo(() => {
    const set = new Set<string>();
    if (perBarColor || kind === 'pie' || kind === 'scatter') {
      data.forEach((d) => d.fill && set.add(String(d.fill)));
    }
    series.forEach((s) => { const c = config[s]?.color; if (c) set.add(c); });
    return Array.from(set);
  }, [data, series, config, perBarColor, kind]);

  const gid = (c: string) => `ig-${uid}-${usedColors.indexOf(c)}`;
  const glow = useMemo(() => {
    const standout = usedColors.find((c) => c !== '#566373');
    return rgba(standout ?? usedColors[0] ?? '#50b89a', 0.45);
  }, [usedColors]);

  const defs = (
    <defs>
      {usedColors.map((c) => (
        <linearGradient key={`bar-${c}`} id={`${gid(c)}-bar`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(c, 0.5)} stopOpacity={0.98} />
          <stop offset="55%" stopColor={c} stopOpacity={0.95} />
          <stop offset="100%" stopColor={c} stopOpacity={0.55} />
        </linearGradient>
      ))}
      {usedColors.map((c) => (
        <linearGradient key={`area-${c}`} id={`${gid(c)}-area`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(c, 0.25)} stopOpacity={0.32} />
          <stop offset="100%" stopColor={c} stopOpacity={0.02} />
        </linearGradient>
      ))}
      {usedColors.map((c) => (
        <linearGradient key={`stroke-${c}`} id={`${gid(c)}-stroke`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={lighten(c, 0.45)} />
          <stop offset="100%" stopColor={c} />
        </linearGradient>
      ))}
    </defs>
  );

  // Explicit legend, else auto-derive one for multi-series (grouped/dual) charts.
  const autoLegend = (!visual.legend && series.length > 1 && kind !== 'pie')
    ? series
        .map((s) => ({ label: seriesLabel(s) ?? s, color: config[s]?.color ?? '#50b89a' }))
        .filter((l) => !!l.color)
    : null;
  const legendItems = visual.legend ?? autoLegend ?? null;
  const legendRow = legendItems ? (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-1.5">
      {legendItems.map((l) => (
        <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  ) : null;

  const glowClass = cn(
    "[&_.recharts-area-curve]:[filter:drop-shadow(0_0_5px_var(--glow))]",
    "[&_.recharts-bar-rectangle]:[filter:drop-shadow(0_2px_5px_var(--glow))]",
    "[&_.recharts-scatter-symbol]:[filter:drop-shadow(0_0_4px_var(--glow))]",
    "[&_.recharts-pie-sector]:[filter:drop-shadow(0_1px_4px_rgba(0,0,0,0.45))]",
  );
  const grid = <CartesianGrid horizontal vertical={false} stroke={GRID_STROKE} strokeDasharray="4 4" />;

  // ── PIE (own layout, no axes) ──────────────────────────────────────────────
  if (kind === 'pie') {
    const total = data.reduce((s, d) => s + Number(d[visual.valueKey ?? series[0]] ?? 0), 0);
    const standout = data.find((d) => d.fill && d.fill !== '#566373');
    const headlinePct = standout
      ? Math.round((Number(standout[visual.valueKey ?? series[0]]) / total) * 100) : 0;
    return (
      <div className={cn('w-full', className)}>
        <div className="relative">
          <ChartContainer config={config} className={cn(heightClass, 'w-full', glowClass)}
            style={{ '--glow': glow } as React.CSSProperties}>
            <PieChart margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              {defs}
              <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey={visual.nameKey} hideLabel />} />
              <Pie data={data} dataKey={visual.valueKey ?? series[0]} nameKey={visual.nameKey}
                cx="50%" cy="50%" innerRadius={compact ? 38 : 52} outerRadius={compact ? 62 : 80}
                paddingAngle={3} cornerRadius={4} strokeWidth={2} stroke="var(--card)" isAnimationActive={false}>
                {data.map((d, i) => (
                  <Cell key={i} fill={`url(#${gid((d.fill as string) ?? '#50b89a')}-bar)`} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-lg font-bold tabular-nums leading-none">{headlinePct}%</span>
            <span className="text-[8px] text-muted-foreground uppercase tracking-wider mt-0.5">share</span>
          </div>
        </div>
        {legendRow}
        {visual.caption && (
          <p className={cn('text-muted-foreground mt-1.5 leading-snug', compact ? 'text-[10px] line-clamp-2' : 'text-[11px]')}>
            {visual.caption}
          </p>
        )}
      </div>
    );
  }

  // ── LINE / BAR / SCATTER chart element ─────────────────────────────────────
  let chart: React.ReactElement;
  if (kind === 'line') {
    chart = (
      <AreaChart data={data} margin={{ top: 14, right: 14, left: compact ? -10 : 0, bottom: 0 }}>
        {defs}{grid}
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={6}
          tick={axisTick} interval="preserveStartEnd" minTickGap={10} />
        <YAxis hide={compact} width={36} tickLine={false} axisLine={false} tick={axisTick} />
        <ChartTooltip cursor={{ stroke: 'rgba(148,163,184,0.25)', strokeDasharray: '4 4' }}
          content={<ChartTooltipContent />} />
        {renderRefLines(refLines)}
        {series.map((s) => {
          const c = config[s]?.color ?? '#50b89a';
          return (
            <Area key={s} type="monotone" dataKey={s} stroke={`url(#${gid(c)}-stroke)`} strokeWidth={2.5}
              fill={`url(#${gid(c)}-area)`} fillOpacity={1} dot={false}
              activeDot={{ r: 3.5, strokeWidth: 0, fill: lighten(c, 0.2) }} isAnimationActive={false} />
          );
        })}
      </AreaChart>
    );
  } else if (kind === 'bar') {
    chart = (
      <BarChart data={data} margin={{ top: 18, right: 14, left: compact ? -10 : 0, bottom: 0 }}
        barCategoryGap={compact ? '16%' : '22%'}>
        {defs}{grid}
        <XAxis dataKey={xKey} tickLine={false} axisLine={false} tickMargin={6} tick={axisTick} interval={0} />
        <YAxis hide={compact} width={36} tickLine={false} axisLine={false} tick={axisTick} />
        <ChartTooltip cursor={{ fill: 'rgba(148,163,184,0.07)' }} content={<ChartTooltipContent />} />
        {renderRefLines(refLines)}
        {perBarColor ? (
          <Bar dataKey={series[0]} radius={[4, 4, 0, 0]} maxBarSize={compact ? 30 : 46} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={`url(#${gid((d.fill as string) ?? '#50b89a')}-bar)`} />
            ))}
          </Bar>
        ) : (
          series.map((s) => {
            const c = config[s]?.color ?? '#50b89a';
            return (
              <Bar key={s} dataKey={s} fill={`url(#${gid(c)}-bar)`} radius={[4, 4, 0, 0]}
                maxBarSize={compact ? 22 : 34} stackId={visual.stacked ? 'a' : undefined} isAnimationActive={false} />
            );
          })
        )}
      </BarChart>
    );
  } else {
    chart = (
      <ScatterChart margin={{ top: 16, right: 18, left: compact ? -8 : 0, bottom: 0 }}>
        {defs}{grid}
        <XAxis type="number" dataKey={xKey} name={visual.xName} tick={axisTick}
          tickLine={false} axisLine={false} tickMargin={6} />
        <YAxis type="number" dataKey={series[0]} name={visual.yName} tick={axisTick}
          width={compact ? 26 : 36} tickLine={false} axisLine={false} />
        <ZAxis range={compact ? [110, 110] : [150, 150]} />
        <ChartTooltip cursor={{ strokeDasharray: '4 4', stroke: 'rgba(148,163,184,0.3)' }}
          content={<ChartTooltipContent nameKey="name" />} />
        {renderRefLines(refLines)}
        <Scatter data={data} isAnimationActive={false}>
          {data.map((d, i) => {
            const c = (d.fill as string) ?? '#50b89a';
            return <Cell key={i} fill={`url(#${gid(c)}-bar)`} stroke={rgba(c, 0.9)} strokeWidth={1} />;
          })}
          <LabelList dataKey="tag" position="top" offset={8}
            style={{ fontSize: compact ? 8 : 10, fontWeight: 700, fill: 'var(--foreground)' }} />
        </Scatter>
      </ScatterChart>
    );
  }

  const titleClass = cn('text-muted-foreground uppercase tracking-[0.1em] font-medium',
    compact ? 'text-[8px]' : 'text-[9px]');

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-stretch">
        {yTitle && (
          <div className="flex items-center justify-center shrink-0" style={{ width: compact ? 12 : 15 }}>
            <span className={titleClass} style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
              {yTitle}
            </span>
          </div>
        )}
        <ChartContainer config={config} className={cn(heightClass, 'flex-1 min-w-0', glowClass)}
          style={{ '--glow': glow } as React.CSSProperties}>
          {chart}
        </ChartContainer>
      </div>
      {xTitle && (
        <p className={cn(titleClass, 'text-center mt-1', yTitle && (compact ? 'pl-3' : 'pl-4'))}>{xTitle}</p>
      )}
      {legendRow}
      {visual.caption && (
        <p className={cn('text-muted-foreground mt-1 leading-snug', compact ? 'text-[10px] line-clamp-2' : 'text-[11px]')}>
          {visual.caption}
        </p>
      )}
    </div>
  );
}
