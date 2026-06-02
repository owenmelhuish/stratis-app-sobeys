"use client";
import React, { useState } from 'react';
import { useDashboardData, type StateDatum } from '@/hooks/use-dashboard-data';
import { useAppStore } from '@/lib/store';
import { MissionControlRail } from '@/components/dashboard/mission-control-rail';
import { TrendChart } from '@/components/shared/trend-chart';
import { ChannelMixChart } from '@/components/shared/channel-mix-chart';
import { CampaignOverviewChart } from '@/components/shared/campaign-overview-chart';
import { WorldMapChart } from '@/components/shared/world-map-chart';
import { FunnelVelocity, BudgetSankey, AudiencePortfolio, ChannelFrequency, AgencyBenchmarking, ConversionValue } from './widgets';
import { DataTableWrapper, type Column } from '@/components/shared/data-table-wrapper';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertTriangle, Zap, Target, DollarSign, BarChart3, Activity, Eye, ChevronLeft, ChevronRight, Image, Layers } from 'lucide-react';
import { CHANNEL_LABELS, type ChannelId, type DivisionId, type AggregatedKPIs } from '@/types';
import { formatCurrency, formatKPIValue, formatPercent } from '@/lib/format';
import { ComparisonDelta } from '@/components/shared/comparison-delta';

// ─── Creative / Ad Set Data ─────────────────────────────────────────────────

interface AdSet {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  channel: ChannelId;
  format: string;
  asset: string;
  kpis: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpa: number;
    roas: number;
    cpm: number;
    creativeFatigue: number;
  };
  kpiDeltas: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    conversions: number;
    cpa: number;
    roas: number;
    cpm: number;
    creativeFatigue: number;
  };
}

const AD_SETS: AdSet[] = [
  {
    id: 'as-lightning-launch-ctv', name: 'F-150 Lightning Launch — CTV :30', campaignId: 'ford-lightning-launch-hero', campaignName: 'F-150 Lightning Launch — National Hero',
    channel: 'ctv', format: 'CTV :30', asset: 'lightning-hero-ctv-30s',
    kpis: { spend: 412000, impressions: 9200000, clicks: 92000, ctr: 1.0, conversions: 4080, cpa: 100.98, roas: 5.4, cpm: 44.78, creativeFatigue: 12 },
    kpiDeltas: { spend: 14, impressions: 18, clicks: 22, ctr: 4, conversions: 28, cpa: -10, roas: 16, cpm: -2, creativeFatigue: 3 },
  },
  {
    id: 'as-f150-built-tough-ooh', name: 'Built Ford Tough — National OOH', campaignId: 'ford-f150-built-tough', campaignName: 'F-150 Built Ford Tough — Spring',
    channel: 'ooh', format: 'Billboard', asset: 'f150-built-tough-ooh-national',
    kpis: { spend: 184200, impressions: 5800000, clicks: 116000, ctr: 2.0, conversions: 2320, cpa: 79.40, roas: 6.2, cpm: 31.76, creativeFatigue: 8 },
    kpiDeltas: { spend: 4, impressions: 6, clicks: 8, ctr: 2, conversions: 6, cpa: -2, roas: 4, cpm: -1, creativeFatigue: 0 },
  },
  {
    id: 'as-mach-e-search-defense', name: 'Mach-E vs Equinox — Search Defense', campaignId: 'ford-mach-e-defense', campaignName: 'Mach-E vs Equinox Defense',
    channel: 'google-search', format: 'Responsive Search Ad', asset: 'mach-e-vs-equinox-rsa',
    kpis: { spend: 96800, impressions: 2200000, clicks: 132000, ctr: 6.0, conversions: 3960, cpa: 24.44, roas: 4.8, cpm: 44.00, creativeFatigue: 14 },
    kpiDeltas: { spend: 8, impressions: 12, clicks: 16, ctr: 4, conversions: 14, cpa: -6, roas: 8, cpm: -3, creativeFatigue: 2 },
  },
  {
    id: 'as-bronco-tiktok-ugc', name: 'Bronco Adventure — TikTok Creator UGC', campaignId: 'ford-bronco-adventure-national', campaignName: 'Bronco Adventure — National',
    channel: 'tiktok', format: 'Short-Form Video', asset: 'bronco-creator-pack-q2',
    kpis: { spend: 88600, impressions: 14200000, clicks: 568000, ctr: 4.0, conversions: 1700, cpa: 52.12, roas: 5.0, cpm: 6.24, creativeFatigue: 6 },
    kpiDeltas: { spend: 12, impressions: 28, clicks: 36, ctr: 8, conversions: 32, cpa: -18, roas: 24, cpm: -8, creativeFatigue: -2 },
  },
  {
    id: 'as-explorer-family-search', name: 'Explorer Family — Conquest Search', campaignId: 'ford-explorer-family', campaignName: 'Explorer Family — Conquest from RAV4',
    channel: 'google-search', format: 'Search', asset: 'explorer-rav4-conquest-rsa',
    kpis: { spend: 142500, impressions: 3200000, clicks: 192000, ctr: 6.0, conversions: 5760, cpa: 24.74, roas: 4.6, cpm: 44.53, creativeFatigue: 10 },
    kpiDeltas: { spend: 5, impressions: 8, clicks: 10, ctr: 3, conversions: 7, cpa: -3, roas: 4, cpm: -2, creativeFatigue: 1 },
  },
  {
    id: 'as-escape-phev-izev-reel', name: 'Escape PHEV iZEV — Reels', campaignId: 'ford-escape-phev-izev', campaignName: 'Escape PHEV — iZEV Opportunity',
    channel: 'instagram', format: 'Reels', asset: 'escape-phev-izev-explainer',
    kpis: { spend: 68400, impressions: 5600000, clicks: 196000, ctr: 3.5, conversions: 2350, cpa: 29.11, roas: 4.2, cpm: 12.21, creativeFatigue: 22 },
    kpiDeltas: { spend: 8, impressions: 14, clicks: 12, ctr: 2, conversions: 18, cpa: -8, roas: 12, cpm: 1, creativeFatigue: 4 },
  },
  {
    id: 'as-transit-linkedin-fleet', name: 'Transit Fleet — LinkedIn Sponsored', campaignId: 'ford-transit-fleet', campaignName: 'Transit Fleet & Commercial',
    channel: 'linkedin', format: 'Sponsored Content', asset: 'transit-fleet-leadgen-v3',
    kpis: { spend: 88200, impressions: 4400000, clicks: 176000, ctr: 4.0, conversions: 4400, cpa: 20.05, roas: 7.4, cpm: 20.05, creativeFatigue: 12 },
    kpiDeltas: { spend: 6, impressions: 10, clicks: 14, ctr: 4, conversions: 18, cpa: -7, roas: 12, cpm: -3, creativeFatigue: 0 },
  },
  {
    id: 'as-lightning-bc-search', name: 'Lightning BC — Search & Meta', campaignId: 'ford-lightning-bc-regional', campaignName: 'Lightning Regional — BC',
    channel: 'google-search', format: 'Search', asset: 'lightning-bc-rsa-v2',
    kpis: { spend: 96400, impressions: 2400000, clicks: 168000, ctr: 7.0, conversions: 5040, cpa: 19.13, roas: 6.4, cpm: 40.17, creativeFatigue: 6 },
    kpiDeltas: { spend: 4, impressions: 8, clicks: 12, ctr: 5, conversions: 18, cpa: -10, roas: 14, cpm: -3, creativeFatigue: -1 },
  },
  {
    id: 'as-lightning-on-search', name: 'Lightning Ontario — Search (anomaly)', campaignId: 'ford-lightning-on-regional', campaignName: 'Lightning Regional — Ontario',
    channel: 'google-search', format: 'Search', asset: 'lightning-on-rsa-v1',
    kpis: { spend: 124800, impressions: 1800000, clicks: 90000, ctr: 5.0, conversions: 1800, cpa: 69.33, roas: 3.2, cpm: 69.33, creativeFatigue: 28 },
    kpiDeltas: { spend: 10, impressions: -4, clicks: -8, ctr: -4, conversions: -16, cpa: 28, roas: -18, cpm: 14, creativeFatigue: 12 },
  },
  {
    id: 'as-brand-q2-ctv', name: 'Built Ford Tough Master Brand — CTV', campaignId: 'ford-brand-q2', campaignName: 'Built Ford Tough — Master Brand Q2',
    channel: 'ctv', format: 'CTV :15', asset: 'brand-q2-ctv-15s',
    kpis: { spend: 248900, impressions: 5600000, clicks: 56000, ctr: 1.0, conversions: 1680, cpa: 148.15, roas: 3.4, cpm: 44.45, creativeFatigue: 4 },
    kpiDeltas: { spend: 4, impressions: 6, clicks: 5, ctr: 2, conversions: 6, cpa: -2, roas: 3, cpm: -1, creativeFatigue: 0 },
  },
];

const AD_SET_KPI_KEYS = ['spend', 'impressions', 'clicks', 'ctr', 'conversions', 'cpa', 'roas', 'cpm'] as const;
const AD_SET_KPI_LABELS: Record<string, string> = {
  spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', ctr: 'CTR',
  conversions: 'Conversions', cpa: 'CPA', roas: 'ROAS', cpm: 'CPM',
};

function formatAdSetKPI(key: string, val: number): string {
  if (key === 'spend' || key === 'cpa' || key === 'cpm') return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (key === 'impressions' || key === 'clicks' || key === 'conversions') return val.toLocaleString();
  if (key === 'ctr') return `${val.toFixed(1)}%`;
  if (key === 'roas') return `${val.toFixed(1)}x`;
  return String(val);
}

function CreativeExplorer() {
  const [activeIndex, setActiveIndex] = useState(0);
  const adSet = AD_SETS[activeIndex];

  const prev = () => setActiveIndex((i) => (i - 1 + AD_SETS.length) % AD_SETS.length);
  const next = () => setActiveIndex((i) => (i + 1) % AD_SETS.length);

  return (
    <Card className="p-6 bg-card border-border/40">
      <div className="flex items-center gap-2 mb-5">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Creative Performance</h3>
        <Badge className="bg-muted/40 text-muted-foreground text-xs border-0">{AD_SETS.length} ad sets</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: Ad set list */}
        <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
          {AD_SETS.map((as, i) => (
            <button
              key={as.id}
              onClick={() => setActiveIndex(i)}
              className={`flex items-start gap-3 text-left rounded-lg px-3 py-2.5 transition-colors ${
                i === activeIndex ? 'bg-muted/50 border border-border/40' : 'hover:bg-muted/30 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted/40 shrink-0 mt-0.5">
                <Image className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium truncate ${i === activeIndex ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {as.name}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">{as.campaignName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{CHANNEL_LABELS[as.channel]}</span>
                  <span className="text-[10px] text-muted-foreground/50">|</span>
                  <span className="text-[10px] text-muted-foreground">{as.format}</span>
                </div>
              </div>
              <span className="text-[11px] font-bold tabular-nums shrink-0 text-emerald-400">{as.kpis.roas.toFixed(1)}x</span>
            </button>
          ))}
        </div>

        {/* Right: KPI detail for active ad set */}
        <div className="flex flex-col min-w-0">
          {/* Header with nav */}
          <div className="flex items-center justify-between mb-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-semibold truncate">{adSet.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] h-5">{CHANNEL_LABELS[adSet.channel]}</Badge>
                <Badge variant="outline" className="text-[10px] h-5">{adSet.format}</Badge>
                <span className="text-[10px] text-muted-foreground">{adSet.campaignName}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 ml-3">
              <button onClick={prev} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[10px] text-muted-foreground tabular-nums">{activeIndex + 1}/{AD_SETS.length}</span>
              <button onClick={next} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {AD_SET_KPI_KEYS.map((key) => {
              const value = adSet.kpis[key];
              const delta = adSet.kpiDeltas[key];
              const isGood = key === 'cpa' || key === 'cpm' ? delta < 0 : delta > 0;

              return (
                <div key={key} className="rounded-lg bg-muted/30 p-3 flex flex-col gap-1">
                  <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    {AD_SET_KPI_LABELS[key]}
                  </span>
                  <span className="text-base font-bold tabular-nums">{formatAdSetKPI(key, value)}</span>
                  <span className={`text-[10px] font-semibold tabular-nums ${isGood ? 'text-emerald-400' : 'text-red-400'}`}>
                    {delta > 0 ? '+' : ''}{delta}%
                  </span>
                </div>
              );
            })}
          </div>

          {/* Asset reference */}
          <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Image className="h-3 w-3" />
            <span>Asset: {adSet.asset}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

const stateColumns: Column<StateDatum>[] = [
  { key: 'state', label: 'Province', sortable: true, getValue: (r) => r.stateName,
    render: (r) => (
      <div className="flex items-center gap-2">
        <span className="font-medium">{r.stateName}</span>
        <Badge variant="outline" className="text-[10px]">{r.campaignCount} {r.campaignCount === 1 ? 'campaign' : 'campaigns'}</Badge>
      </div>
    ),
  },
  { key: 'spend', label: 'Spend', sortable: true, align: 'right', getValue: (r) => r.spend,
    render: (r) => formatCurrency(r.spend),
  },
  { key: 'impressions', label: 'Impr.', sortable: true, align: 'right', getValue: (r) => r.impressions,
    render: (r) => formatKPIValue(r.impressions, 'number'),
  },
  { key: 'conversions', label: 'Conv.', sortable: true, align: 'right', getValue: (r) => r.conversions,
    render: (r) => formatKPIValue(r.conversions, 'number'),
  },
  { key: 'revenue', label: 'Revenue', sortable: true, align: 'right', getValue: (r) => r.revenue,
    render: (r) => formatCurrency(r.revenue),
  },
  { key: 'roas', label: 'ROAS', sortable: true, align: 'right', getValue: (r) => r.roas,
    render: (r) => formatKPIValue(r.roas, 'decimal'),
  },
  { key: 'cpm', label: 'CPM', sortable: true, align: 'right', getValue: (r) => r.cpm,
    render: (r) => formatCurrency(r.cpm),
  },
];

export function BrandView() {
  const data = useDashboardData();
  const { compareEnabled } = useAppStore();
  const drillToDivision = useAppStore(s => s.drillToDivision);

  const sortedStateData = [...data.stateData].sort((a, b) => b.spend - a.spend);

  return (
    <div className="space-y-8">
      {/* Mission Control KPI Rail */}
      <MissionControlRail data={data} compareEnabled={compareEnabled} />

      {/* 2. Full-Funnel Velocity Pipeline */}
      <FunnelVelocity data={data} compareEnabled={compareEnabled} />

      {/* 3. Budget Allocation Flow / Sankey */}
      <BudgetSankey data={data} />

      {/* 4. Tier Cards */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {data.divisionData.map(d => (
            <Card
              key={d.division}
              className="p-5 bg-card border-border/40 hover:border-teal/40 cursor-pointer transition-colors group"
              onClick={() => drillToDivision(d.division)}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold group-hover:text-teal transition-colors">{d.divisionLabel}</h3>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-teal transition-colors" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Spend</span>
                  <span className="font-medium tabular-nums">{formatCurrency(d.kpis.spend)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">ROAS</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium tabular-nums">{formatKPIValue(d.kpis.roas, 'decimal')}</span>
                    {compareEnabled && d.previousKpis && d.previousKpis.roas > 0 && (
                      <ComparisonDelta deltaPercent={((d.kpis.roas - d.previousKpis.roas) / d.previousKpis.roas) * 100} higherIsBetter={true} />
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">CPA</span>
                  <div className="flex items-center gap-1">
                    <span className="font-medium tabular-nums">{formatCurrency(d.kpis.cpa)}</span>
                    {compareEnabled && d.previousKpis && d.previousKpis.cpa > 0 && (
                      <ComparisonDelta deltaPercent={((d.kpis.cpa - d.previousKpis.cpa) / d.previousKpis.cpa) * 100} higherIsBetter={false} />
                    )}
                  </div>
                </div>
                <div className="flex justify-between text-xs pt-1 border-t border-border/20">
                  <span className="text-muted-foreground">{d.campaignCount} campaigns</span>
                  <span className="text-muted-foreground">{d.productCount} products</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 4. Audience Portfolio Health */}
      <AudiencePortfolio data={data} />

      {/* 5. Channel Frequency Intelligence */}
      <ChannelFrequency data={data} />

      {/* 6. Agency Performance Benchmarking */}
      <AgencyBenchmarking data={data} compareEnabled={compareEnabled} />

      {/* 7. Conversion Value Intelligence */}
      <ConversionValue data={data} compareEnabled={compareEnabled} />

      {/* 8. Trend Chart + Channel Mix */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-stretch">
        <div className="xl:col-span-3">
          <TrendChart data={data.timeSeries} title="KPI Relationship Mapping" defaultMetrics={['spend', 'conversions', 'roas']} className="h-full" />
        </div>
        <div className="xl:col-span-2">
          <ChannelMixChart data={data.channelData} title="Channel Mix" />
        </div>
      </div>

      {/* 8. United States Heat Map */}
      <WorldMapChart stateData={data.stateData} title="Canada — Spend & Anomaly Heat Map" />

      {/* 9. Campaign Overview Chart */}
      <CampaignOverviewChart campaignData={data.campaignData} />

      {/* 10. Province Performance Table */}
      <Card className="p-6 bg-card border-border/40">
        <h3 className="text-sm font-semibold mb-4">Province Performance</h3>
        <DataTableWrapper<StateDatum>
          data={sortedStateData}
          columns={stateColumns}
          searchable searchPlaceholder="Search provinces..." searchKey={(row) => row.stateName}
        />
      </Card>

      <CreativeExplorer />
    </div>
  );
}
