// Deterministic chart data generator seeded by insight ID

import { format, subDays, addDays } from 'date-fns';

const TODAY_DATE = new Date();

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ChartPoint {
  day: number;
  label: string;
  primary: number;
  secondary: number;
  improved?: number;
}

export interface AdSetData {
  name: string;
  current: number;
  recommended: number;
}

export interface ChannelAllocation {
  channel: string;
  channelLabel: string;
  engagementRate: number;
  spend: number;
  recommendedEngagementRate: number;
  recommendedSpend: number;
  direction: 'increased' | 'reduced';
}

export type MetricsHint = 'roas-frequency' | 'budget-spend' | 'engagement-frequency' | 'engagement-spend' | 'viewrate-impressions'
  | 'cpm-overlap' | 'frequency-waste' | 'attribution-lift' | 'cpc-competition' | 'awareness-conversion'
  | 'cpa-geo' | 'conversions-market' | 'roas-saturation' | 'convrate-volume';

export interface InsightChartData {
  historical: ChartPoint[];
  predicted: ChartPoint[];
  improved: ChartPoint[];
  todayIndex: number;
  adSets: AdSetData[];
  channelAllocations: ChannelAllocation[];
  avgEngagementRate: number;
  avgSpend: number;
  primaryLabel: string;
  secondaryLabel: string;
  metricTabs: string[];
  // Efficiency-metric framing for the channel-allocation bar chart.
  // Defaults to engagement rate; tactical insights may swap to ROAS, CPL etc.
  efficiencyLabel: string;
  efficiencyFormat: 'decimal-4' | 'decimal-2';
}

interface MetricConfig {
  primaryLabel: string;
  secondaryLabel: string;
  metricTabs: string[];
  basePMin: number;
  basePMax: number;
  baseSMin: number;
  baseSMax: number;
  noiseP: number;
  noiseS: number;
  trendMin: number;
  trendMax: number;
  improveDeltaMin: number;
  improveDeltaMax: number;
  roundP: number;
  roundS: number;
  minP: number;
  minS: number;
}

const METRIC_CONFIGS: Record<MetricsHint, MetricConfig> = {
  'roas-frequency': {
    primaryLabel: 'ROAS',
    secondaryLabel: 'FREQUENCY',
    metricTabs: ['Comparison', 'ROAS', 'Frequency'],
    basePMin: 1.5, basePMax: 2.7,
    baseSMin: 1.0, baseSMax: 2.5,
    noiseP: 0.12, noiseS: 0.1,
    trendMin: -0.03, trendMax: 0.03,
    improveDeltaMin: 0.3, improveDeltaMax: 0.9,
    roundP: 2, roundS: 2,
    minP: 0.2, minS: 0.2,
  },
  'budget-spend': {
    primaryLabel: 'BUDGET TARGET',
    secondaryLabel: 'ACTUAL SPEND',
    metricTabs: ['Spend Pacing', 'Budget', 'Forecast'],
    basePMin: 400, basePMax: 1000,
    baseSMin: 280, baseSMax: 850,
    noiseP: 30, noiseS: 50,
    trendMin: 8, trendMax: 23,
    improveDeltaMin: 80, improveDeltaMax: 280,
    roundP: 0, roundS: 0,
    minP: 50, minS: 30,
  },
  'engagement-frequency': {
    primaryLabel: 'ENGAGEMENT',
    secondaryLabel: 'FREQUENCY',
    metricTabs: ['Comparison', 'Engagement', 'Frequency'],
    basePMin: 0.08, basePMax: 0.22,
    baseSMin: 0.5, baseSMax: 1.1,
    noiseP: 0.025, noiseS: 0.06,
    trendMin: -0.004, trendMax: 0.001,
    improveDeltaMin: 0.04, improveDeltaMax: 0.12,
    roundP: 4, roundS: 2,
    minP: 0.01, minS: 0.1,
  },
  'engagement-spend': {
    primaryLabel: 'ENGAGEMENT',
    secondaryLabel: 'SPEND',
    metricTabs: ['Comparison', 'Engagement', 'Spend'],
    basePMin: 0.001, basePMax: 0.004,
    baseSMin: 2, baseSMax: 7,
    noiseP: 0.0004, noiseS: 0.4,
    trendMin: -0.0002, trendMax: 0.0001,
    improveDeltaMin: 0.0008, improveDeltaMax: 0.002,
    roundP: 4, roundS: 1,
    minP: 0.0002, minS: 0.5,
  },
  'viewrate-impressions': {
    primaryLabel: '3S VIEW RATE',
    secondaryLabel: 'IMPRESSIONS',
    metricTabs: ['Comparison', '3s View Rate', 'Impressions'],
    basePMin: 0.04, basePMax: 0.08,
    baseSMin: 8000, baseSMax: 18000,
    noiseP: 0.008, noiseS: 1500,
    trendMin: -0.002, trendMax: 0.001,
    improveDeltaMin: 0.015, improveDeltaMax: 0.04,
    roundP: 4, roundS: 0,
    minP: 0.005, minS: 2000,
  },
  'cpm-overlap': {
    primaryLabel: 'CPM ($)', secondaryLabel: 'AGENCY OVERLAP',
    metricTabs: ['Comparison', 'CPM Trend', 'Overlap'],
    basePMin: 16, basePMax: 28, baseSMin: 10, baseSMax: 30,
    noiseP: 2.5, noiseS: 4, trendMin: 0.3, trendMax: 0.8,
    improveDeltaMin: -4, improveDeltaMax: -8, roundP: 1, roundS: 0, minP: 8, minS: 0,
  },
  'frequency-waste': {
    primaryLabel: 'WEEKLY FREQUENCY', secondaryLabel: 'EST. WASTE ($K)',
    metricTabs: ['Comparison', 'Frequency', 'Waste'],
    basePMin: 8, basePMax: 16, baseSMin: 20, baseSMax: 60,
    noiseP: 1.2, noiseS: 6, trendMin: 0.15, trendMax: 0.4,
    improveDeltaMin: -3, improveDeltaMax: -6, roundP: 1, roundS: 0, minP: 2, minS: 5,
  },
  'attribution-lift': {
    primaryLabel: 'DIRECT ROAS', secondaryLabel: 'ASSISTED CONV. RATIO',
    metricTabs: ['Comparison', 'Direct ROAS', 'Assisted Ratio'],
    basePMin: 0.3, basePMax: 0.8, baseSMin: 1.5, baseSMax: 3.5,
    noiseP: 0.08, noiseS: 0.3, trendMin: -0.01, trendMax: 0.01,
    improveDeltaMin: 0.5, improveDeltaMax: 1.2, roundP: 2, roundS: 1, minP: 0.1, minS: 0.5,
  },
  'cpc-competition': {
    primaryLabel: 'CPC ($)', secondaryLabel: 'AUCTION OVERLAP',
    metricTabs: ['Comparison', 'CPC Trend', 'Overlap'],
    basePMin: 3.5, basePMax: 6.0, baseSMin: 15, baseSMax: 40,
    noiseP: 0.6, noiseS: 5, trendMin: 0.08, trendMax: 0.2,
    improveDeltaMin: -1.0, improveDeltaMax: -2.0, roundP: 2, roundS: 0, minP: 1, minS: 0,
  },
  'awareness-conversion': {
    primaryLabel: 'AWARENESS SPEND ($K)', secondaryLabel: 'CONV. CAMPAIGN ROAS',
    metricTabs: ['Comparison', 'Awareness Spend', 'Conv. ROAS'],
    basePMin: 150, basePMax: 350, baseSMin: 2.2, baseSMax: 3.8,
    noiseP: 25, noiseS: 0.25, trendMin: 3, trendMax: 8,
    improveDeltaMin: 0.3, improveDeltaMax: 0.8, roundP: 0, roundS: 2, minP: 50, minS: 1.0,
  },
  'cpa-geo': {
    primaryLabel: 'CPA ($)', secondaryLabel: 'BUDGET SHARE (%)',
    metricTabs: ['Comparison', 'CPA by Geo', 'Budget'],
    basePMin: 80, basePMax: 180, baseSMin: 15, baseSMax: 45,
    noiseP: 12, noiseS: 3, trendMin: 1.5, trendMax: 4,
    improveDeltaMin: -20, improveDeltaMax: -40, roundP: 0, roundS: 0, minP: 30, minS: 5,
  },
  'conversions-market': {
    primaryLabel: 'CONVERSIONS', secondaryLabel: 'SPEND ($K)',
    metricTabs: ['Comparison', 'Conversions', 'Spend'],
    basePMin: 80, basePMax: 200, baseSMin: 15, baseSMax: 40,
    noiseP: 18, noiseS: 4, trendMin: -2, trendMax: 3,
    improveDeltaMin: 30, improveDeltaMax: 80, roundP: 0, roundS: 0, minP: 20, minS: 5,
  },
  'roas-saturation': {
    primaryLabel: 'ROAS', secondaryLabel: 'SATURATION (%)',
    metricTabs: ['Comparison', 'ROAS', 'Saturation'],
    basePMin: 1.5, basePMax: 4.5, baseSMin: 30, baseSMax: 85,
    noiseP: 0.3, noiseS: 5, trendMin: -0.02, trendMax: 0.02,
    improveDeltaMin: 0.3, improveDeltaMax: 0.8, roundP: 1, roundS: 0, minP: 0.5, minS: 10,
  },
  'convrate-volume': {
    primaryLabel: 'GATE CONV. RATE (%)', secondaryLabel: 'APPLICATION VOLUME',
    metricTabs: ['Comparison', 'Conv. Rate', 'Volume'],
    basePMin: 16, basePMax: 24, baseSMin: 200, baseSMax: 500,
    noiseP: 1.2, noiseS: 30, trendMin: -0.3, trendMax: -0.1,
    improveDeltaMin: 2, improveDeltaMax: 5, roundP: 1, roundS: 0, minP: 8, minS: 50,
  },
};

// Default channel set rendered in slider-driven channel-reallocation insights.
const DEFAULT_CHANNEL_DEFS: { channel: string; channelLabel: string }[] = [
  { channel: 'TT',  channelLabel: 'TikTok' },
  { channel: 'IG',  channelLabel: 'Instagram' },
  { channel: 'FB',  channelLabel: 'Facebook' },
  { channel: 'GS',  channelLabel: 'Google Search' },
  { channel: 'TTD', channelLabel: 'The Trade Desk' },
  { channel: 'CTV', channelLabel: 'CTV' },
  { channel: 'SP',  channelLabel: 'Spotify' },
];

// Per-insight format-level breakdowns (e.g. Google ad-product variants).
const INSIGHT_CHANNEL_OVERRIDES: Record<string, { channel: string; channelLabel: string }[]> = {
  // Ford Tier 3 dealer co-op Google budget — Vehicle Listing Ads vs Search variants
  'ins-tactical-002-vla-search': [
    { channel: 'GS-G',  channelLabel: 'GS Generic' },
    { channel: 'GS-NP', channelLabel: 'GS Nameplate' },
    { channel: 'BRAND', channelLabel: 'GS Brand' },
    { channel: 'VLA',   channelLabel: 'Vehicle Listing' },
    { channel: 'PMAX',  channelLabel: 'Performance Max' },
    { channel: 'YT-A',  channelLabel: 'YouTube Action' },
    { channel: 'DV360', channelLabel: 'Display' },
  ],
  // Lightning Q2 video pool — YouTube vs CTV vs Meta video, on qualified-view efficiency
  'ins-tactical-001-lightning-channel-mix': [
    { channel: 'YT',   channelLabel: 'YouTube' },
    { channel: 'CTV',  channelLabel: 'CTV' },
    { channel: 'META', channelLabel: 'Meta Video' },
    { channel: 'IG',   channelLabel: 'IG Reels' },
    { channel: 'TT',   channelLabel: 'TikTok' },
    { channel: 'SPV',  channelLabel: 'Spotify Video' },
  ],
};

// Per-insight efficiency-metric framing for the channel-allocation bar chart.
// Default is engagement rate (0.005–0.045 range, 4-decimal display).
interface EfficiencyConfig {
  label: string;
  min: number;
  max: number;
  format: 'decimal-4' | 'decimal-2';
}
const DEFAULT_EFFICIENCY: EfficiencyConfig = {
  label: 'ENGAGEMENT RATE',
  min: 0.005,
  max: 0.045,
  format: 'decimal-4',
};
const INSIGHT_EFFICIENCY_OVERRIDES: Record<string, EfficiencyConfig> = {
  // VLA / Performance Max / Search variants are evaluated on ROAS
  'ins-tactical-002-vla-search': {
    label: 'ROAS',
    min: 1.5,
    max: 6.0,
    format: 'decimal-2',
  },
  // Lightning video pool is evaluated on qualified-view rate (higher = better)
  'ins-tactical-001-lightning-channel-mix': {
    label: 'QUALIFIED VIEW RATE',
    min: 0.02,
    max: 0.14,
    format: 'decimal-4',
  },
};

function roundTo(val: number, decimals: number): number {
  if (decimals === 0) return Math.round(val);
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function formatDateLabel(dayOffset: number, todayIndex: number): string {
  const daysFromToday = dayOffset - todayIndex;
  const date = daysFromToday === 0 ? TODAY_DATE : (daysFromToday < 0 ? subDays(TODAY_DATE, -daysFromToday) : addDays(TODAY_DATE, daysFromToday));
  return format(date, 'MMM d');
}

export function generateInsightChartData(
  insightId: string,
  metricsHint: MetricsHint = 'roas-frequency',
): InsightChartData {
  const seed = hashString(insightId);
  const rng = mulberry32(seed);

  const totalDays = 42;
  const todayIndex = 28;

  const config = METRIC_CONFIGS[metricsHint];
  const { primaryLabel, secondaryLabel, metricTabs } = config;

  const baseP = config.basePMin + rng() * (config.basePMax - config.basePMin);
  const baseS = config.baseSMin + rng() * (config.baseSMax - config.baseSMin);
  const trend = config.trendMin + rng() * (config.trendMax - config.trendMin);
  const improveDelta = config.improveDeltaMin + rng() * (config.improveDeltaMax - config.improveDeltaMin);

  const historical: ChartPoint[] = [];
  const predicted: ChartPoint[] = [];
  const improved: ChartPoint[] = [];

  let pVal = baseP;
  let sVal = baseS;

  // Which days get labels (first, ~1/3, TODAY, last)
  const labelDays = new Set([0, Math.round(totalDays * 0.33), todayIndex, totalDays - 1]);

  for (let d = 0; d < totalDays; d++) {
    const noise1 = (rng() - 0.5) * config.noiseP * 2;
    const noise2 = (rng() - 0.5) * config.noiseS * 2;
    pVal = Math.max(config.minP, pVal + trend + noise1);
    sVal = Math.max(config.minS, sVal + trend * 0.6 + noise2);

    const dayLabel = d === todayIndex ? 'TODAY' : (labelDays.has(d) ? formatDateLabel(d, todayIndex) : '');

    const point: ChartPoint = {
      day: d,
      label: dayLabel,
      primary: roundTo(pVal, config.roundP),
      secondary: roundTo(sVal, config.roundS),
    };

    if (d <= todayIndex) {
      historical.push(point);
    } else {
      predicted.push(point);
      const impVal = roundTo(pVal + improveDelta * (0.5 + rng() * 0.5), config.roundP);
      improved.push({ ...point, improved: impVal });
    }
  }

  // Generate ad set data for budget action steps
  const adSetNames = ['Lookalike \u2013 US HNW', 'Interest \u2013 Financial Planners', 'Retarget \u2013 Site Visitors', 'Broad \u2013 Affluent 25-54', 'Custom \u2013 Client CRM Match'];
  const numSets = 3 + (seed % 3);
  const adSets: AdSetData[] = [];
  for (let i = 0; i < numSets; i++) {
    const current = Math.round((1000 + rng() * 4000) * 100) / 100;
    const shift = (rng() - 0.3) * 0.4;
    adSets.push({
      name: adSetNames[i % adSetNames.length],
      current,
      recommended: Math.round(current * (1 + shift) * 100) / 100,
    });
  }

  // Generate channel allocation data for budget optimization.
  // Default is the full Ford channel set; specific tactical insights override
  // to render format-level breakdowns (e.g. VLA vs Search variants).
  const channelDefs = INSIGHT_CHANNEL_OVERRIDES[insightId] ?? DEFAULT_CHANNEL_DEFS;
  const efficiency = INSIGHT_EFFICIENCY_OVERRIDES[insightId] ?? DEFAULT_EFFICIENCY;
  const effDecimals = efficiency.format === 'decimal-4' ? 4 : 2;
  const channelAllocations: ChannelAllocation[] = channelDefs.map((ch, i) => {
    const engRate = roundTo(efficiency.min + rng() * (efficiency.max - efficiency.min), effDecimals);
    const spend = Math.round(200 + rng() * 1600);
    const direction: 'increased' | 'reduced' = (i + seed) % 2 === 0 ? 'reduced' : 'increased';
    const spendDelta = direction === 'increased' ? spend * (0.1 + rng() * 0.3) : -(spend * (0.05 + rng() * 0.15));
    const engDelta = direction === 'increased' ? engRate * (0.1 + rng() * 0.2) : -(engRate * (0.05 + rng() * 0.1));
    return {
      ...ch,
      engagementRate: engRate,
      spend,
      recommendedEngagementRate: roundTo(engRate + engDelta, effDecimals),
      recommendedSpend: Math.round(spend + spendDelta),
      direction,
    };
  });

  const avgEngagementRate = roundTo(
    channelAllocations.reduce((s, c) => s + c.engagementRate, 0) / channelAllocations.length,
    effDecimals
  );
  const avgSpend = Math.round(
    channelAllocations.reduce((s, c) => s + c.spend, 0) / channelAllocations.length
  );

  return {
    historical,
    predicted,
    improved,
    todayIndex,
    adSets,
    channelAllocations,
    avgEngagementRate,
    avgSpend,
    primaryLabel,
    secondaryLabel,
    metricTabs,
    efficiencyLabel: efficiency.label,
    efficiencyFormat: efficiency.format,
  };
}

/**
 * Interpolate the "improved" line based on a 0-1 intensity factor.
 * At intensity=0 the improved line equals the predicted line (no action).
 * At intensity=1 the improved line is the full optimistic projection.
 */
export function interpolateImproved(
  predicted: ChartPoint[],
  improved: ChartPoint[],
  intensity: number,
): ChartPoint[] {
  const t = Math.max(0, Math.min(1, intensity));
  return improved.map((imp, i) => {
    const pred = predicted[i];
    if (!pred || imp.improved == null) return imp;
    const base = pred.primary;
    const target = imp.improved;
    return {
      ...imp,
      improved: Math.round((base + (target - base) * t) * 10) / 10,
    };
  });
}

/**
 * Interpolate ad-set budget allocations by intensity.
 * At 0 = current allocation, at 1 = full recommended.
 */
export function interpolateAdSets(
  adSets: AdSetData[],
  intensity: number,
): AdSetData[] {
  const t = Math.max(0, Math.min(1, intensity));
  return adSets.map((a) => ({
    ...a,
    recommended: Math.round((a.current + (a.recommended - a.current) * t) * 100) / 100,
  }));
}

/**
 * Interpolate channel allocations by intensity.
 */
export function interpolateChannels(
  channels: ChannelAllocation[],
  intensity: number,
): ChannelAllocation[] {
  const t = Math.max(0, Math.min(1, intensity));
  return channels.map((ch) => ({
    ...ch,
    recommendedSpend: Math.round(ch.spend + (ch.recommendedSpend - ch.spend) * t),
    recommendedEngagementRate: +(ch.engagementRate + (ch.recommendedEngagementRate - ch.engagementRate) * t).toFixed(4),
  }));
}
