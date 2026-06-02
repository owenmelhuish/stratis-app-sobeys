// Shared chart-spec types + palette for per-insight visuals.
// Lives in its own module so client data modules (src/lib/clients/*) can author
// their own visuals without importing insight-visuals.ts (which would be circular).
import type { ChartConfig } from '@/components/ui/chart';

export type InsightChartKind = 'line' | 'bar' | 'pie' | 'scatter';

export interface InsightRefLine {
  axis: 'x' | 'y';
  value: number | string;
  label?: string;
  color?: string;
}

export interface InsightVisual {
  kind: InsightChartKind;
  data: Array<Record<string, string | number>>;
  config: ChartConfig;
  /** category / x-axis key for line, bar, scatter */
  xKey?: string;
  /** dataKeys to plot (grouped series). Single-series bars may color per-row via a `fill` field. */
  series: string[];
  stacked?: boolean;
  /** true when a single-series bar colors each bar individually from a per-row `fill` field */
  perBarColor?: boolean;
  refLines?: InsightRefLine[];
  caption?: string;
  /** axis titles (rendered on the detail + card frame). Single-series/scatter derive theirs. */
  xTitle?: string;
  yTitle?: string;
  /** scatter axes */
  xName?: string;
  yName?: string;
  /** small color key rendered under the chart (esp. scatter / per-bar colored charts) */
  legend?: Array<{ label: string; color: string }>;
  /** pie keys */
  nameKey?: string;
  valueKey?: string;
}

// STRATIS brand chart palette — matches the main dashboard (trend-chart / bento grid).
// The renderer turns each of these into an electric vertical gradient + soft glow.
export const TEAL = '#50b89a';   // primary / "good" / brand
export const RED = '#e07060';    // "over" / problem / competitor / cost
export const BLUE = '#6b8aad';   // secondary series
export const PURPLE = '#8b7ec8'; // accent
export const GOLD = '#d4a55a';   // accent 2
export const MUTED = '#566373';  // de-emphasized
export const GRID = 'rgba(148,163,184,0.5)';
