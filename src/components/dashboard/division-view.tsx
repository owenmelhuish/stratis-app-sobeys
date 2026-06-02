"use client";
import React from 'react';
import { useDashboardData } from '@/hooks/use-dashboard-data';
import { useAppStore } from '@/lib/store';
import { KPIGrid } from '@/components/shared/kpi-grid';
import { HeroKPICard } from '@/components/shared/hero-kpi-card';
import { TrendChart } from '@/components/shared/trend-chart';
import { ChannelMixChart } from '@/components/shared/channel-mix-chart';
import { WorldMapChart } from '@/components/shared/world-map-chart';
import { DataTableWrapper, type Column } from '@/components/shared/data-table-wrapper';
import { ComparisonDelta } from '@/components/shared/comparison-delta';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { divisionLabel as resolveDivisionLabel, PRODUCT_LINE_LABELS, KPI_CONFIGS, FUNNEL_HERO_KPIS, type KPIKey, type ProductLineId, type Campaign, type AggregatedKPIs } from '@/types';
import { formatCurrency, formatKPIValue, formatPercent } from '@/lib/format';
import { ArrowRight, Lightbulb, ChevronRight } from 'lucide-react';
import Link from 'next/link';

const HERO_COLORS: Record<string, string> = {
  spend: '#e07060', conversions: '#50b89a', roas: '#50b89a',
  impressions: '#50b89a', reach: '#8b7ec8', cpm: '#6b8aad',
  clicks: '#50b89a', ctr: '#6b8aad', engagementRate: '#8b7ec8',
  cpa: '#e07060',
};

interface CampaignRow { campaign: Campaign; kpis: AggregatedKPIs; previousKpis?: AggregatedKPIs; }

export function DivisionView() {
  const data = useDashboardData();
  const { customKpis, selectedDivision, compareEnabled, selectedFunnel, selectedEnterprise } = useAppStore();
  const heroKpis = FUNNEL_HERO_KPIS[selectedFunnel];
  const drillToProduct = useAppStore(s => s.drillToProduct);
  const drillToCampaign = useAppStore(s => s.drillToCampaign);
  const divisionLabel = selectedDivision ? resolveDivisionLabel(selectedDivision, selectedEnterprise) : '';

  const secondaryKpis = customKpis.filter(k => !heroKpis.includes(k));

  const campaignColumns: Column<CampaignRow>[] = [
    { key: 'name', label: 'Campaign', sortable: true, getValue: (r) => r.campaign.name,
      render: (r) => (<div><span className="font-medium">{r.campaign.name}</span><Badge variant={r.campaign.status === 'live' ? 'default' : 'secondary'} className="ml-2 text-[10px]">{r.campaign.status}</Badge></div>),
    },
    { key: 'objective', label: 'Objective', sortable: true, getValue: (r) => r.campaign.objective,
      render: (r) => <Badge variant="outline" className="text-[10px] capitalize">{r.campaign.objective}</Badge>,
    },
    { key: 'spend', label: 'Spend', sortable: true, align: 'right', getValue: (r) => r.kpis.spend, render: (r) => formatCurrency(r.kpis.spend) },
    { key: 'conversions', label: 'Conv.', sortable: true, align: 'right', getValue: (r) => r.kpis.conversions, render: (r) => formatKPIValue(r.kpis.conversions, 'number') },
    { key: 'cpa', label: 'CPA', sortable: true, align: 'right', getValue: (r) => r.kpis.cpa,
      render: (r) => (<div>{formatCurrency(r.kpis.cpa)}{compareEnabled && r.previousKpis && r.previousKpis.cpa > 0 && <ComparisonDelta deltaPercent={((r.kpis.cpa - r.previousKpis.cpa) / r.previousKpis.cpa) * 100} higherIsBetter={false} className="ml-1" />}</div>),
    },
    { key: 'roas', label: 'ROAS', sortable: true, align: 'right', getValue: (r) => r.kpis.roas,
      render: (r) => (<div>{formatKPIValue(r.kpis.roas, 'decimal')}{compareEnabled && r.previousKpis && r.previousKpis.roas > 0 && <ComparisonDelta deltaPercent={((r.kpis.roas - r.previousKpis.roas) / r.previousKpis.roas) * 100} higherIsBetter={true} className="ml-1" />}</div>),
    },
    { key: 'ctr', label: 'CTR', sortable: true, align: 'right', getValue: (r) => r.kpis.ctr, render: (r) => formatPercent(r.kpis.ctr) },
    { key: 'cpm', label: 'CPM', sortable: true, align: 'right', getValue: (r) => r.kpis.cpm, render: (r) => formatCurrency(r.kpis.cpm) },
    { key: 'fatigue', label: 'Fatigue', sortable: true, align: 'center', getValue: (r) => r.kpis.creativeFatigueIndex,
      render: (r) => { const v = r.kpis.creativeFatigueIndex; return (<div className="flex items-center justify-center gap-1"><div className={`w-2 h-2 rounded-full ${v > 70 ? 'bg-red-400' : v > 40 ? 'bg-yellow-400' : 'bg-emerald-400'}`} /><span className="text-xs">{v.toFixed(0)}</span></div>); },
    },
    { key: 'pacing', label: 'Pacing', sortable: true, align: 'right', getValue: (r) => r.kpis.budgetPacing,
      render: (r) => { const v = r.kpis.budgetPacing; return <span className={`text-xs ${v > 110 ? 'text-red-400' : v < 90 ? 'text-yellow-400' : 'text-emerald-400'}`}>{formatPercent(v)}</span>; },
    },
    { key: 'action', label: '', render: () => <ArrowRight className="h-4 w-4 text-muted-foreground" /> },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{divisionLabel} — Key Metrics</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {heroKpis.map((key) => {
            const config = KPI_CONFIGS.find(c => c.key === key);
            if (!config) return null;
            const value = data.currentKPIs[key] as number;
            const prev = data.previousKPIs ? data.previousKPIs[key] as number : undefined;
            const delta = prev !== undefined ? value - prev : undefined;
            const deltaPercent = prev !== undefined && prev !== 0 ? ((value - prev) / prev) * 100 : undefined;
            const sparklineData = data.timeSeries.slice(-14).map(d => ({ value: d[key] as number }));

            return (
              <HeroKPICard
                key={key}
                config={config}
                value={value}
                delta={compareEnabled ? delta : undefined}
                deltaPercent={compareEnabled ? deltaPercent : undefined}
                sparklineData={sparklineData}
                accentColor={HERO_COLORS[key] || '#f97316'}
              />
            );
          })}
        </div>

        {secondaryKpis.length > 0 && (
          <KPIGrid kpis={secondaryKpis} current={data.currentKPIs} previous={data.previousKPIs || undefined} />
        )}
      </div>

      <WorldMapChart stateData={data.stateData} />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <div className="xl:col-span-3">
          <TrendChart data={data.timeSeries} title={`${divisionLabel} Performance Trend`} defaultMetrics={['spend', 'conversions', 'roas']} />
        </div>
        <div className="xl:col-span-2">
          <ChannelMixChart data={data.channelData} title={`${divisionLabel} — Channel Mix`} />
        </div>
      </div>

      {/* Product Lines in this Division */}
      {data.productData.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Product Lines</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.productData.map(p => (
              <Card
                key={p.productLine}
                className="p-5 bg-card border-border/40 hover:border-teal/40 cursor-pointer transition-colors group"
                onClick={() => drillToProduct(p.productLine)}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold group-hover:text-teal transition-colors">{p.productLabel}</h3>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-teal transition-colors" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Spend</span>
                    <span className="font-medium tabular-nums">{formatCurrency(p.kpis.spend)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">ROAS</span>
                    <span className="font-medium tabular-nums">{formatKPIValue(p.kpis.roas, 'decimal')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">CPA</span>
                    <span className="font-medium tabular-nums">{formatCurrency(p.kpis.cpa)}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/20">
                    {p.campaignCount} campaigns
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="p-6 bg-card border-border/40">
        <h3 className="text-sm font-semibold mb-4">Campaigns in {divisionLabel}</h3>
        <DataTableWrapper<CampaignRow>
          data={data.campaignData}
          columns={campaignColumns}
          onRowClick={(row) => drillToCampaign(row.campaign.id)}
          searchable searchPlaceholder="Search campaigns..." searchKey={(row) => row.campaign.name}
        />
      </Card>

      <Card className="p-6 bg-card border-border/40">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-orange" />
          <h3 className="text-sm font-semibold">Top Insights for {divisionLabel}</h3>
        </div>
        <div className="space-y-2">
          {data.scopedInsights.slice(0, 5).map(insight => (
            <Link href="/insights" key={insight.id}>
              <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer border border-border/50">
                <Badge variant="outline" className="text-[10px] capitalize shrink-0 mt-0.5">{insight.category}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{insight.summary}</p>
                </div>
                <Badge className="text-[10px] bg-orange/20 text-orange shrink-0">{insight.confidence}%</Badge>
              </div>
            </Link>
          ))}
          {data.scopedInsights.length === 0 && <p className="text-xs text-muted-foreground">No insights for this division</p>}
        </div>
      </Card>
    </div>
  );
}
