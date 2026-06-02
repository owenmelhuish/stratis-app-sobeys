"use client";
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { generateAllData, aggregateMetrics, type MockDataStore } from '@/lib/mock-data';
import type { DivisionId, ProductLineId, AgencyId, AudienceId, GeoId, ChannelId, AggregatedKPIs, Campaign, DailyMetrics, Anomaly, Insight, ViewLevel } from '@/types';
import { STATE_NAMES } from '@/lib/geo';
import { divisionLabel, PRODUCT_LINE_LABELS, AUDIENCE_LABELS, AGENCY_LABELS, CHANNEL_LABELS } from '@/types';
import { subDays, format, differenceInDays, parseISO } from 'date-fns';

// Geo region → Canadian province codes
const GEO_TO_PROVINCES: Record<GeoId, string[]> = {
  'national': ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL'],
  'bc':       ['BC'],
  'alberta':  ['AB'],
  'ontario':  ['ON'],
  'quebec':   ['QC'],
  'atlantic': ['NB', 'NS', 'PE', 'NL'],
};

// Ford dealer-weighted province distribution (~554 dealers)
const PROVINCE_BRANCH_WEIGHT: Record<string, number> = {
  'ON': 0.380, 'QC': 0.220, 'AB': 0.140, 'BC': 0.130,
  'NS': 0.040, 'NB': 0.035, 'MB': 0.025, 'SK': 0.020,
  'NL': 0.007, 'PE': 0.003,
};

export interface StateDatum {
  stateCode: string;
  stateName: string;
  campaignCount: number;
  spend: number;
  impressions: number;
  conversions: number;
  revenue: number;
  roas: number;
  cpa: number;
  cpm: number;
}

export interface DashboardData {
  viewLevel: ViewLevel;
  currentKPIs: AggregatedKPIs;
  previousKPIs: AggregatedKPIs | null;
  timeSeries: Array<Record<string, number | string>>;
  divisionData: Array<{
    division: DivisionId;
    divisionLabel: string;
    kpis: AggregatedKPIs;
    previousKpis?: AggregatedKPIs;
    campaignCount: number;
    productCount: number;
  }>;
  productData: Array<{
    productLine: ProductLineId;
    productLabel: string;
    kpis: AggregatedKPIs;
    previousKpis?: AggregatedKPIs;
    campaignCount: number;
  }>;
  campaignData: Array<{
    campaign: Campaign;
    kpis: AggregatedKPIs;
    previousKpis?: AggregatedKPIs;
  }>;
  channelData: Record<string, AggregatedKPIs>;
  stateData: StateDatum[];
  topImproving: Array<{ label: string; division: DivisionId; roasDelta: number; cpaDelta: number }>;
  topDeclining: Array<{ label: string; division: DivisionId; roasDelta: number; cpaDelta: number }>;
  anomalies: Anomaly[];
  scopedInsights: Insight[];
  filteredGeos: GeoId[];
  allCampaigns: Campaign[];
  selectedCampaignObj?: Campaign;
  store: MockDataStore;
  funnelData: {
    stages: Array<{ id: string; label: string; volume: number; topChannels: string[] }>;
    gates: Array<{ from: string; to: string; conversionRate: number; previousRate: number | null }>;
  };
  audienceData: Array<{
    id: AudienceId; label: string; shareOfSpend: number; roas: number;
    marginalReturn: 'rising' | 'flat' | 'declining'; saturation: number;
    health: 'healthy' | 'watch' | 'over-saturated' | 'under-invested';
    action: 'scale' | 'hold' | 'reduce' | 'grow';
  }>;
  investmentDistData: {
    audiences: AudienceId[];
    channels: ChannelId[];
    matrix: Record<string, Record<string, number>>;
    totals: Record<string, number>;
    channelTotals: Record<string, number>;
    diversification: Record<string, 'concentrated' | 'balanced' | 'fragmented'>;
  };
  agencyData: Array<{
    id: AgencyId; label: string; managedSpend: number; campaignCount: number;
    blendedRoas: number; avgCpa: number; budgetPacing: number;
    objectiveMix: Record<string, number>; efficiencyScore: number; previousScore: number | null;
  }>;
  sankeyData: {
    divisions: Array<{ id: string; label: string; spend: number }>;
    agencies: Array<{ id: string; label: string; spend: number }>;
    products: Array<{ id: string; label: string; spend: number; divisionId: string; agencyId: string }>;
    channels: Array<{ id: string; label: string; spend: number }>;
    revenue: number;
    estimatedWaste: number;
    flows: Array<{ source: string; target: string; value: number }>;
  };
  conversionValueData: Array<{
    productLine: ProductLineId; label: string; conversions: number; revenue: number;
    revenuePerConversion: number; previousRevenuePerConversion: number | null;
    trend: number; signal: 'high-value' | 'improving' | 'stable' | 'watch' | 'declining';
    sparkline: number[];
  }>;
}

function filterDailyByDate(days: DailyMetrics[], start: string, end: string): DailyMetrics[] {
  return days.filter(d => d.date >= start && d.date <= end);
}

function mergeDailyArrays(arrays: DailyMetrics[][]): DailyMetrics[] {
  const byDate: Record<string, DailyMetrics> = {};
  for (const arr of arrays) {
    for (const d of arr) {
      if (!byDate[d.date]) {
        byDate[d.date] = { ...d };
      } else {
        const existing = byDate[d.date];
        existing.spend += d.spend;
        existing.impressions += d.impressions;
        existing.reach += d.reach;
        existing.clicks += d.clicks;
        existing.landingPageViews += d.landingPageViews;
        existing.leads += d.leads;
        existing.conversions += d.conversions;
        existing.revenue += d.revenue;
        existing.videoViews3s += d.videoViews3s;
        existing.videoViewsThruplay += d.videoViewsThruplay;
        existing.engagements += d.engagements;
        existing.assistedConversions += d.assistedConversions;
      }
    }
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

export function useDashboardData(): DashboardData {
  const {
    dateRange, compareEnabled, selectedDivisions, selectedAgencies, selectedProductLines,
    selectedAudiences, selectedGeos, selectedChannels,
    selectedCampaigns,
    selectedObjectives, selectedCampaignStatuses, attributionModel,
    selectedDivision, selectedProductLine, selectedCampaign,
    selectedEnterprise, selectedDealer,
  } = useAppStore();
  const store = useMemo(() => generateAllData(selectedEnterprise ?? 'ford-canada'), [selectedEnterprise]);

  return useMemo(() => {
    const { start, end } = dateRange;
    const dayCount = differenceInDays(parseISO(end), parseISO(start)) || 1;
    const prevEnd = format(subDays(parseISO(start), 1), 'yyyy-MM-dd');
    const prevStart = format(subDays(parseISO(start), dayCount), 'yyyy-MM-dd');

    // Attribution multiplier
    const attrMult: Record<string, number> = { 'last-click': 1, 'first-click': 0.85, 'linear': 0.92, 'data-driven': 1.05 };
    const convMult = attrMult[attributionModel] || 1;

    // Filter campaigns
    let campaigns = store.campaigns;
    if (selectedDivisions.length > 0) campaigns = campaigns.filter(c => selectedDivisions.includes(c.division));
    if (selectedAgencies.length > 0) campaigns = campaigns.filter(c => selectedAgencies.includes(c.agency));
    if (selectedProductLines.length > 0) campaigns = campaigns.filter(c => selectedProductLines.includes(c.productLine));
    if (selectedAudiences.length > 0) campaigns = campaigns.filter(c => c.audiences.some(a => selectedAudiences.includes(a)));
    if (selectedGeos.length > 0) campaigns = campaigns.filter(c => c.geos.some(g => selectedGeos.includes(g)));
    if (selectedObjectives.length > 0) campaigns = campaigns.filter(c => selectedObjectives.includes(c.objective));
    if (selectedCampaignStatuses.length > 0) campaigns = campaigns.filter(c => selectedCampaignStatuses.includes(c.status));
    if (selectedCampaigns.length > 0) campaigns = campaigns.filter(c => selectedCampaigns.includes(c.id));

    // Dealer-level scoping (Dealership Network enterprise only)
    // Identify the dealer's regional rollup campaign + scale factor for their share of regional spend
    let dealerScopeScale = 1;
    if (selectedEnterprise === 'dealership-network' && selectedDealer) {
      // Lazy require to avoid SSR/initialization-order issues in test environments
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getDealerById } = require('@/lib/dealers') as typeof import('@/lib/dealers');
      const dealer = getDealerById(selectedDealer);
      if (dealer) {
        // Map molecular region (encoded in dealer.id) → product line in dealership-network campaigns
        const molecularRegionMatch = dealer.id.match(/^dealer-([a-z]+)-/);
        const molecularRegion = molecularRegionMatch?.[1];
        const REGION_TO_PRODUCT_LINE: Record<string, ProductLineId> = {
          'ontario': 'dn-ontario-rollup',
          'quebec': 'dn-quebec-rollup',
          'bc': 'dn-bc-rollup',
          'alberta': 'dn-alberta-rollup',
          'prairies': 'dn-prairies-rollup',
          'atlantic': 'dn-atlantic-rollup',
        };
        const productLine = molecularRegion ? REGION_TO_PRODUCT_LINE[molecularRegion] : null;
        if (productLine) {
          dealerScopeScale = dealer.share;
          // Scope campaigns to the dealer's regional rollup
          campaigns = campaigns.filter((c) => c.productLine === productLine);
        }
      }
    }

    // Determine view level
    const viewLevel: ViewLevel = selectedCampaign ? 'campaign' : selectedProductLine ? 'product' : selectedDivision ? 'division' : 'brand';

    // Get relevant campaigns for current view
    let viewCampaigns = campaigns;
    if (selectedDivision) viewCampaigns = campaigns.filter(c => c.division === selectedDivision);
    if (selectedProductLine) viewCampaigns = viewCampaigns.filter(c => c.productLine === selectedProductLine);
    if (selectedCampaign) viewCampaigns = campaigns.filter(c => c.id === selectedCampaign);

    // Collect daily data for current/previous period
    function collectDays(camps: Campaign[], periodStart: string, periodEnd: string, channels?: ChannelId[]): DailyMetrics[] {
      const allDays: DailyMetrics[][] = [];
      for (const camp of camps) {
        const campData = store.dailyData[camp.id];
        if (!campData) continue;
        for (const ch of camp.channels) {
          if (channels && channels.length > 0 && !channels.includes(ch)) continue;
          const chData = campData[ch];
          if (!chData) continue;
          const filtered = filterDailyByDate(chData, periodStart, periodEnd);
          // Apply attribution multiplier + dealer-share scope (1.0 unless a dealer is selected in DN)
          const adjusted = filtered.map(d => ({
            ...d,
            spend: d.spend * dealerScopeScale,
            impressions: Math.round(d.impressions * dealerScopeScale),
            reach: Math.round(d.reach * dealerScopeScale),
            clicks: Math.round(d.clicks * dealerScopeScale),
            landingPageViews: Math.round(d.landingPageViews * dealerScopeScale),
            leads: Math.round(d.leads * dealerScopeScale),
            conversions: Math.round(d.conversions * convMult * dealerScopeScale),
            revenue: d.revenue * convMult * dealerScopeScale,
            videoViews3s: Math.round(d.videoViews3s * dealerScopeScale),
            videoViewsThruplay: Math.round(d.videoViewsThruplay * dealerScopeScale),
            engagements: Math.round(d.engagements * dealerScopeScale),
            assistedConversions: Math.round(d.assistedConversions * convMult * dealerScopeScale),
          }));
          allDays.push(adjusted);
        }
      }
      return mergeDailyArrays(allDays);
    }

    const channelFilter = selectedChannels.length > 0 ? selectedChannels : undefined;
    const currentDays = collectDays(viewCampaigns, start, end, channelFilter);
    const previousDays = compareEnabled ? collectDays(viewCampaigns, prevStart, prevEnd, channelFilter) : [];

    const currentKPIs = aggregateMetrics(currentDays);
    const previousKPIs = compareEnabled ? aggregateMetrics(previousDays) : null;

    // Time series
    const timeSeries = currentDays.map(d => {
      const imp = d.impressions || 1;
      const clicks = d.clicks || 1;
      return {
        date: d.date,
        spend: d.spend,
        impressions: d.impressions,
        reach: d.reach,
        clicks: d.clicks,
        conversions: d.conversions,
        revenue: d.revenue,
        leads: d.leads,
        engagements: d.engagements,
        assistedConversions: d.assistedConversions,
        landingPageViews: d.landingPageViews,
        videoViews3s: d.videoViews3s,
        videoViewsThruplay: d.videoViewsThruplay,
        roas: d.spend > 0 ? d.revenue / d.spend : 0,
        ctr: (d.clicks / imp) * 100,
        cpc: d.spend / clicks,
        cpm: (d.spend / imp) * 1000,
        cpa: d.conversions > 0 ? d.spend / d.conversions : 0,
        cpl: d.leads > 0 ? d.spend / d.leads : 0,
        lpvRate: d.clicks > 0 ? (d.landingPageViews / d.clicks) * 100 : 0,
        engagementRate: (d.engagements / imp) * 100,
        threeSecondViewRate: imp > 0 ? (d.videoViews3s / imp) * 100 : 0,
        videoCompletionRate: d.videoViews3s > 0 ? (d.videoViewsThruplay / d.videoViews3s) * 100 : 0,
        frequency: d.reach > 0 ? d.impressions / d.reach : 0,
        brandSearchLift: 40 + Math.random() * 30,
        shareOfVoice: 25 + Math.random() * 20,
        budgetPacing: 80 + Math.random() * 30,
        creativeFatigueIndex: 30 + Math.random() * 40,
      };
    });

    // Division data
    const allDivisions: DivisionId[] = ['tier-1', 'tier-2', 'tier-3'];
    const divisionData = allDivisions.map(division => {
      const divCamps = campaigns.filter(c => c.division === division);
      const dDays = collectDays(divCamps, start, end, channelFilter);
      const dPrevDays = compareEnabled ? collectDays(divCamps, prevStart, prevEnd, channelFilter) : [];
      const uniqueProducts = new Set(divCamps.map(c => c.productLine));
      return {
        division,
        divisionLabel: divisionLabel(division, selectedEnterprise),
        kpis: aggregateMetrics(dDays),
        previousKpis: compareEnabled ? aggregateMetrics(dPrevDays) : undefined,
        campaignCount: divCamps.length,
        productCount: uniqueProducts.size,
      };
    });

    // Product data (when a division is selected)
    const productData = selectedDivision
      ? [...new Set(viewCampaigns.map(c => c.productLine))].map(productLine => {
          const pCamps = viewCampaigns.filter(c => c.productLine === productLine);
          const pDays = collectDays(pCamps, start, end, channelFilter);
          const pPrevDays = compareEnabled ? collectDays(pCamps, prevStart, prevEnd, channelFilter) : [];
          return {
            productLine,
            productLabel: PRODUCT_LINE_LABELS[productLine],
            kpis: aggregateMetrics(pDays),
            previousKpis: compareEnabled ? aggregateMetrics(pPrevDays) : undefined,
            campaignCount: pCamps.length,
          };
        })
      : [];

    // Campaign data (for division/product view)
    const campaignData = viewCampaigns.map(camp => {
      const cDays = collectDays([camp], start, end, channelFilter);
      const cPrevDays = compareEnabled ? collectDays([camp], prevStart, prevEnd, channelFilter) : [];
      return {
        campaign: camp,
        kpis: aggregateMetrics(cDays),
        previousKpis: compareEnabled ? aggregateMetrics(cPrevDays) : undefined,
      };
    });

    // Channel data
    const channelDataMap: Record<string, AggregatedKPIs> = {};
    const allChannels: ChannelId[] = ['instagram', 'facebook', 'tiktok', 'google-search', 'ttd', 'ctv', 'spotify', 'linkedin', 'ooh'];
    for (const ch of allChannels) {
      const chDays: DailyMetrics[][] = [];
      for (const camp of viewCampaigns) {
        if (!camp.channels.includes(ch)) continue;
        const chData = store.dailyData[camp.id]?.[ch];
        if (!chData) continue;
        const filtered = filterDailyByDate(chData, start, end).map(d => ({
          ...d, conversions: Math.round(d.conversions * convMult), revenue: d.revenue * convMult,
          assistedConversions: Math.round(d.assistedConversions * convMult),
        }));
        chDays.push(filtered);
      }
      channelDataMap[ch] = aggregateMetrics(mergeDailyArrays(chDays));
    }

    // Top movers (need compare)
    let topImproving: DashboardData['topImproving'] = [];
    let topDeclining: DashboardData['topDeclining'] = [];
    if (compareEnabled) {
      const movers = divisionData.map(d => {
        const roasDelta = d.previousKpis && d.previousKpis.roas > 0
          ? ((d.kpis.roas - d.previousKpis.roas) / d.previousKpis.roas) * 100 : 0;
        const cpaDelta = d.previousKpis && d.previousKpis.cpa > 0
          ? ((d.kpis.cpa - d.previousKpis.cpa) / d.previousKpis.cpa) * 100 : 0;
        return { label: d.divisionLabel, division: d.division, roasDelta, cpaDelta };
      });
      topImproving = movers.filter(m => m.roasDelta > 0).sort((a, b) => b.roasDelta - a.roasDelta).slice(0, 3);
      topDeclining = movers.filter(m => m.roasDelta < 0).sort((a, b) => a.roasDelta - b.roasDelta).slice(0, 3);
    }

    // Anomalies — respect both multi-select filters and drill-down
    let anomalies = store.anomalies.filter(a => a.date >= start && a.date <= end);
    if (selectedGeos.length > 0) anomalies = anomalies.filter(a => selectedGeos.includes(a.geo));
    if (selectedDivisions.length > 0) anomalies = anomalies.filter(a => !a.division || selectedDivisions.includes(a.division));
    if (selectedCampaigns.length > 0) anomalies = anomalies.filter(a => !a.campaign || selectedCampaigns.includes(a.campaign));
    if (selectedChannels.length > 0) anomalies = anomalies.filter(a => !a.channel || selectedChannels.includes(a.channel));
    if (selectedDivision) anomalies = anomalies.filter(a => a.division === selectedDivision);
    if (selectedProductLine) anomalies = anomalies.filter(a => a.productLine === selectedProductLine);
    if (selectedCampaign) anomalies = anomalies.filter(a => a.campaign === selectedCampaign);

    // Scoped insights — respect both multi-select filters and drill-down
    let scopedInsights = store.insights.filter(i => i.createdAt >= start && i.createdAt <= end);
    if (selectedDivisions.length > 0) scopedInsights = scopedInsights.filter(i => !i.division || selectedDivisions.includes(i.division));
    if (selectedCampaigns.length > 0) scopedInsights = scopedInsights.filter(i => !i.campaign || selectedCampaigns.includes(i.campaign));
    if (selectedChannels.length > 0) scopedInsights = scopedInsights.filter(i => i.channels.length === 0 || i.channels.some(ch => selectedChannels.includes(ch)));
    if (selectedDivision) scopedInsights = scopedInsights.filter(i => !i.division || i.division === selectedDivision);
    if (selectedProductLine) scopedInsights = scopedInsights.filter(i => !i.productLine || i.productLine === selectedProductLine);
    if (selectedCampaign) scopedInsights = scopedInsights.filter(i => !i.campaign || i.campaign === selectedCampaign);

    const selectedCampaignObj = selectedCampaign ? store.campaigns.find(c => c.id === selectedCampaign) : undefined;

    // Province-level data: distribute each campaign's metrics weighted by branch footprint
    const stateAccum: Record<string, { spend: number; impressions: number; conversions: number; revenue: number; campaignCount: number }> = {};
    for (const cd of campaignData) {
      // Expand geos to province codes
      const provinces: string[] = [];
      for (const geo of cd.campaign.geos) {
        const geoProv = GEO_TO_PROVINCES[geo];
        if (geoProv) {
          for (const p of geoProv) {
            if (!provinces.includes(p)) provinces.push(p);
          }
        }
      }
      if (provinces.length === 0) continue;
      // Calculate total weight for provinces in this campaign
      const totalWeight = provinces.reduce((sum, code) => sum + (PROVINCE_BRANCH_WEIGHT[code] || 0.003), 0);
      for (const code of provinces) {
        const weight = (PROVINCE_BRANCH_WEIGHT[code] || 0.003) / totalWeight;
        if (!stateAccum[code]) stateAccum[code] = { spend: 0, impressions: 0, conversions: 0, revenue: 0, campaignCount: 0 };
        stateAccum[code].spend += cd.kpis.spend * weight;
        stateAccum[code].impressions += cd.kpis.impressions * weight;
        stateAccum[code].conversions += cd.kpis.conversions * weight;
        stateAccum[code].revenue += cd.kpis.revenue * weight;
        stateAccum[code].campaignCount += 1;
      }
    }
    const stateData: StateDatum[] = Object.entries(stateAccum).map(([code, val]) => ({
      stateCode: code,
      stateName: STATE_NAMES[code] || code,
      campaignCount: val.campaignCount,
      spend: val.spend,
      impressions: Math.round(val.impressions),
      conversions: Math.round(val.conversions),
      revenue: val.revenue,
      roas: val.spend > 0 ? val.revenue / val.spend : 0,
      cpa: val.conversions > 0 ? val.spend / val.conversions : 0,
      cpm: val.impressions > 0 ? (val.spend / val.impressions) * 1000 : 0,
    }));

    // ===== Funnel Velocity Data =====
    const FUNNEL_STAGES = [
      { id: 'awareness', label: 'Awareness', objectives: ['awareness'] as string[], metric: 'impressions' as const },
      { id: 'consideration', label: 'Consideration', objectives: ['consideration'] as string[], metric: 'clicks' as const },
      { id: 'application', label: 'Application', objectives: ['conversion'] as string[], metric: 'leads' as const },
      { id: 'conversion', label: 'Conversion', objectives: ['conversion', 'retention'] as string[], metric: 'conversions' as const },
      { id: 'activation', label: 'Activation', objectives: [] as string[], metric: 'conversions' as const },
    ];
    const funnelStages = FUNNEL_STAGES.map(stage => {
      let volume = 0;
      const channelContrib: Record<string, number> = {};
      if (stage.id === 'activation') {
        const convStage = FUNNEL_STAGES.find(s => s.id === 'conversion');
        const convCamps = campaigns.filter(c => convStage!.objectives.includes(c.objective));
        const convDays = collectDays(convCamps, start, end, channelFilter);
        const convAgg = aggregateMetrics(convDays);
        volume = Math.round(convAgg.conversions * 0.73);
      } else {
        const stageCamps = campaigns.filter(c => stage.objectives.includes(c.objective));
        const sDays = collectDays(stageCamps, start, end, channelFilter);
        const sAgg = aggregateMetrics(sDays);
        volume = sAgg[stage.metric] as number;
        for (const camp of stageCamps) {
          for (const ch of camp.channels) {
            const chData = store.dailyData[camp.id]?.[ch];
            if (!chData) continue;
            const filt = filterDailyByDate(chData, start, end);
            const total = filt.reduce((s, d) => s + (d[stage.metric] as number), 0);
            channelContrib[ch] = (channelContrib[ch] || 0) + total;
          }
        }
      }
      const topChannels = Object.entries(channelContrib)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([ch]) => CHANNEL_LABELS[ch as ChannelId] || ch);
      return { id: stage.id, label: stage.label, volume, topChannels };
    });
    const funnelGates = [];
    for (let i = 0; i < funnelStages.length - 1; i++) {
      const from = funnelStages[i];
      const to = funnelStages[i + 1];
      const rate = from.volume > 0 ? (to.volume / from.volume) * 100 : 0;
      let previousRate: number | null = null;
      if (compareEnabled) {
        const fromPrev = FUNNEL_STAGES[i];
        const toPrev = FUNNEL_STAGES[i + 1];
        let fromVol = 0, toVol = 0;
        if (toPrev.id === 'activation') {
          const convCamps = campaigns.filter(c => ['conversion', 'retention'].includes(c.objective));
          const d = collectDays(convCamps, prevStart, prevEnd, channelFilter);
          toVol = Math.round(aggregateMetrics(d).conversions * 0.73);
        } else {
          const toCamps = campaigns.filter(c => toPrev.objectives.includes(c.objective));
          toVol = aggregateMetrics(collectDays(toCamps, prevStart, prevEnd, channelFilter))[toPrev.metric] as number;
        }
        if (fromPrev.id === 'activation') {
          fromVol = toVol;
        } else {
          const fromCamps = campaigns.filter(c => fromPrev.objectives.includes(c.objective));
          fromVol = aggregateMetrics(collectDays(fromCamps, prevStart, prevEnd, channelFilter))[fromPrev.metric] as number;
        }
        previousRate = fromVol > 0 ? (toVol / fromVol) * 100 : 0;
      }
      funnelGates.push({ from: from.id, to: to.id, conversionRate: rate, previousRate });
    }
    const funnelData = { stages: funnelStages, gates: funnelGates };

    // ===== Audience Portfolio Data =====
    // Derived from active enterprise campaigns so this works for Ford, Lincoln, and Dealership Network alike
    const allAudienceIds: AudienceId[] = Array.from(
      new Set(viewCampaigns.flatMap((c) => c.audiences))
    );
    const avgRoas = currentKPIs.spend > 0 ? currentKPIs.revenue / currentKPIs.spend : 0;
    const totalSpend = currentKPIs.spend;
    const audienceData = allAudienceIds.map(audId => {
      let audSpend = 0, audRevenue = 0, audImpressions = 0, audReach = 0;
      let recentSpend = 0, recentRevenue = 0, priorSpend = 0, priorRevenue = 0;
      const midDate = format(subDays(parseISO(end), 7), 'yyyy-MM-dd');
      const priorStart = format(subDays(parseISO(midDate), 7), 'yyyy-MM-dd');
      const priorEnd = format(subDays(parseISO(midDate), 1), 'yyyy-MM-dd');

      for (const camp of viewCampaigns) {
        if (!camp.audiences.includes(audId)) continue;
        const splitFactor = 1 / camp.audiences.length;
        for (const ch of camp.channels) {
          if (channelFilter && !channelFilter.includes(ch)) continue;
          const chData = store.dailyData[camp.id]?.[ch];
          if (!chData) continue;
          const days = filterDailyByDate(chData, start, end);
          for (const d of days) {
            audSpend += d.spend * splitFactor;
            audRevenue += d.revenue * splitFactor;
            audImpressions += d.impressions * splitFactor;
            audReach += d.reach * splitFactor;
          }
          // Marginal return sub-periods
          const recentD = filterDailyByDate(chData, midDate, end);
          for (const d of recentD) { recentSpend += d.spend * splitFactor; recentRevenue += d.revenue * splitFactor; }
          const priorD = filterDailyByDate(chData, priorStart, priorEnd);
          for (const d of priorD) { priorSpend += d.spend * splitFactor; priorRevenue += d.revenue * splitFactor; }
        }
      }

      const roas = audSpend > 0 ? audRevenue / audSpend : 0;
      const shareOfSpend = totalSpend > 0 ? (audSpend / totalSpend) * 100 : 0;
      const freq = audReach > 0 ? audImpressions / audReach : 0;
      const saturation = Math.min(100, (freq / 15) * 100);
      const recentRoas = recentSpend > 0 ? recentRevenue / recentSpend : 0;
      const priorRoas = priorSpend > 0 ? priorRevenue / priorSpend : 0;
      const marginalReturn: 'rising' | 'flat' | 'declining' = recentRoas > priorRoas * 1.05 ? 'rising' : recentRoas < priorRoas * 0.95 ? 'declining' : 'flat';

      const aboveAvg = roas >= avgRoas * 0.9;
      const belowAvg = roas < avgRoas * 0.9;
      const lowShare = shareOfSpend < (100 / allAudienceIds.length) * 0.6;
      let health: 'healthy' | 'watch' | 'over-saturated' | 'under-invested' = 'healthy';
      let action: 'scale' | 'hold' | 'reduce' | 'grow' = 'hold';
      if (lowShare && aboveAvg && saturation < 40) { health = 'under-invested'; action = 'grow'; }
      else if (aboveAvg && saturation < 50) { health = 'healthy'; action = 'scale'; }
      else if (aboveAvg && saturation < 70) { health = 'watch'; action = 'hold'; }
      else if (belowAvg && saturation > 60) { health = 'over-saturated'; action = 'reduce'; }
      else if (belowAvg) { health = 'watch'; action = 'reduce'; }
      else { health = 'healthy'; action = 'hold'; }
      return { id: audId, label: AUDIENCE_LABELS[audId], shareOfSpend, roas, marginalReturn, saturation, health, action };
    });

    // ===== Audience Investment Distribution =====
    const investAudiences = allAudienceIds;
    const investChannels: ChannelId[] = ['instagram', 'facebook', 'tiktok', 'google-search', 'ttd', 'ctv', 'spotify', 'linkedin', 'ooh'];
    const investMatrix: Record<string, Record<string, number>> = {};
    const investTotals: Record<string, number> = {};
    const investChannelTotals: Record<string, number> = {};
    const investDiversification: Record<string, 'concentrated' | 'balanced' | 'fragmented'> = {};

    // Step 1: Compute raw spend per audience × channel
    const audChanSpend: Record<string, Record<string, number>> = {};
    for (const aud of investAudiences) {
      audChanSpend[aud] = {};
      for (const ch of investChannels) { audChanSpend[aud][ch] = 0; }
    }
    for (const camp of viewCampaigns) {
      const audienceSplit = 1 / camp.audiences.length;
      for (const ch of camp.channels) {
        if (channelFilter && !channelFilter.includes(ch)) continue;
        if (!investChannels.includes(ch)) continue;
        const chData = store.dailyData[camp.id]?.[ch];
        if (!chData) continue;
        const days = filterDailyByDate(chData, start, end);
        const chSpend = days.reduce((s, d) => s + d.spend, 0);
        for (const aud of camp.audiences) {
          audChanSpend[aud][ch] += chSpend * audienceSplit;
        }
      }
    }

    // Step 2: Convert to percentages (each row sums to 100%)
    for (const aud of investAudiences) {
      const audTotal = Object.values(audChanSpend[aud]).reduce((s, v) => s + v, 0);
      investTotals[aud] = audTotal;
      investMatrix[aud] = {};
      for (const ch of investChannels) {
        investMatrix[aud][ch] = audTotal > 0 ? Math.round((audChanSpend[aud][ch] / audTotal) * 1000) / 10 : 0;
      }
      // Step 3: Diversification assessment
      const shares = Object.values(investMatrix[aud]).filter(v => v > 0).sort((a, b) => b - a);
      const topTwo = (shares[0] || 0) + (shares[1] || 0);
      const topOne = shares[0] || 0;
      if (topTwo > 70) { investDiversification[aud] = 'concentrated'; }
      else if (topOne < 20) { investDiversification[aud] = 'fragmented'; }
      else { investDiversification[aud] = 'balanced'; }
    }

    // Step 4: Channel totals
    for (const ch of investChannels) {
      investChannelTotals[ch] = Object.values(audChanSpend).reduce((s, audMap) => s + (audMap[ch] || 0), 0);
    }
    const investmentDistData = { audiences: investAudiences, channels: investChannels, matrix: investMatrix, totals: investTotals, channelTotals: investChannelTotals, diversification: investDiversification };

    // ===== Agency Benchmarking Data =====
    // Derived from the active enterprise's campaigns so this works for every
    // client (Ford, Lincoln, DN, and the cross-industry roster) — not a fixed list.
    const allAgencyIds: AgencyId[] = Array.from(new Set(store.campaigns.map(c => c.agency)));
    const agencyData = allAgencyIds.map(agId => {
      const agCamps = campaigns.filter(c => c.agency === agId);
      if (agCamps.length === 0) return null;
      const aDays = collectDays(agCamps, start, end, channelFilter);
      const aKpis = aggregateMetrics(aDays);
      const blendedRoas = aKpis.spend > 0 ? aKpis.revenue / aKpis.spend : 0;
      const avgCpa = aKpis.conversions > 0 ? aKpis.spend / aKpis.conversions : 0;
      const budgetPacing = aKpis.budgetPacing;
      // Objective mix
      const objCounts: Record<string, number> = {};
      for (const c of agCamps) { objCounts[c.objective] = (objCounts[c.objective] || 0) + 1; }
      const objTotal = agCamps.length;
      const objectiveMix: Record<string, number> = {};
      for (const [obj, cnt] of Object.entries(objCounts)) { objectiveMix[obj] = Math.round((cnt / objTotal) * 100); }
      // Efficiency score
      const avgAllRoas = avgRoas || 1;
      const avgAllCpa = currentKPIs.conversions > 0 ? currentKPIs.spend / currentKPIs.conversions : 1;
      const baseScore = (blendedRoas / avgAllRoas) * 50 + (1 - avgCpa / (avgAllCpa * 2)) * 30 + (budgetPacing / 100) * 20;
      const efficiencyScore = Math.max(0, Math.min(100, Math.round(baseScore)));
      // Previous score
      let previousScore: number | null = null;
      if (compareEnabled) {
        const pDays = collectDays(agCamps, prevStart, prevEnd, channelFilter);
        const pKpis = aggregateMetrics(pDays);
        const pRoas = pKpis.spend > 0 ? pKpis.revenue / pKpis.spend : 0;
        const pCpa = pKpis.conversions > 0 ? pKpis.spend / pKpis.conversions : 0;
        const pBase = (pRoas / avgAllRoas) * 50 + (1 - pCpa / (avgAllCpa * 2)) * 30 + (pKpis.budgetPacing / 100) * 20;
        previousScore = Math.max(0, Math.min(100, Math.round(pBase)));
      }
      return {
        id: agId, label: AGENCY_LABELS[agId], managedSpend: aKpis.spend,
        campaignCount: agCamps.length, blendedRoas, avgCpa, budgetPacing,
        objectiveMix, efficiencyScore, previousScore,
      };
    }).filter(Boolean) as DashboardData['agencyData'];

    // ===== Sankey Data (5 columns) =====
    const sankeyDivMap: Record<string, number> = {};
    const sankeyAgencyMap: Record<string, number> = {};
    const sankeyProdMap: Record<string, { spend: number; divisionId: string; agencyId: string }> = {};
    const sankeyChanMap: Record<string, { spend: number; revenue: number }> = {};
    const sankeyFlowMap: Record<string, number> = {};

    for (const camp of viewCampaigns) {
      let campTotal = 0;
      for (const ch of camp.channels) {
        if (channelFilter && !channelFilter.includes(ch)) continue;
        const chData = store.dailyData[camp.id]?.[ch];
        if (!chData) continue;
        const days = filterDailyByDate(chData, start, end);
        const chSpend = days.reduce((s, d) => s + d.spend, 0);
        const chRev = days.reduce((s, d) => s + d.revenue, 0);
        campTotal += chSpend;
        if (!sankeyChanMap[ch]) sankeyChanMap[ch] = { spend: 0, revenue: 0 };
        sankeyChanMap[ch].spend += chSpend;
        sankeyChanMap[ch].revenue += chRev;
        // Layer 3: Product → Channel
        const pcKey = `prod-${camp.productLine}|ch-${ch}`;
        sankeyFlowMap[pcKey] = (sankeyFlowMap[pcKey] || 0) + chSpend;
      }
      if (campTotal === 0) continue;
      sankeyDivMap[camp.division] = (sankeyDivMap[camp.division] || 0) + campTotal;
      sankeyAgencyMap[camp.agency] = (sankeyAgencyMap[camp.agency] || 0) + campTotal;
      if (!sankeyProdMap[camp.productLine]) sankeyProdMap[camp.productLine] = { spend: 0, divisionId: camp.division, agencyId: camp.agency };
      sankeyProdMap[camp.productLine].spend += campTotal;
      // Layer 1: Division → Agency
      const daKey = `div-${camp.division}|agency-${camp.agency}`;
      sankeyFlowMap[daKey] = (sankeyFlowMap[daKey] || 0) + campTotal;
      // Layer 2: Agency → Product
      const apKey = `agency-${camp.agency}|prod-${camp.productLine}`;
      sankeyFlowMap[apKey] = (sankeyFlowMap[apKey] || 0) + campTotal;
    }

    let sankeyRevenue = 0;
    let sankeyWaste = 0;
    for (const [ch, { spend: chSpend, revenue: chRev }] of Object.entries(sankeyChanMap)) {
      const roas = chSpend > 0 ? chRev / chSpend : 0;
      const wasteRatio = roas < 1.0 ? 0.50 : roas < 1.5 ? 0.30 : roas < 2.5 ? 0.15 : 0.05;
      const wasteAmt = chSpend * wasteRatio;
      const revFlow = chSpend - wasteAmt;
      sankeyFlowMap[`ch-${ch}|revenue`] = (sankeyFlowMap[`ch-${ch}|revenue`] || 0) + revFlow;
      sankeyFlowMap[`ch-${ch}|waste`] = (sankeyFlowMap[`ch-${ch}|waste`] || 0) + wasteAmt;
      sankeyRevenue += chRev;
      sankeyWaste += wasteAmt;
    }

    const sankeyFlows = Object.entries(sankeyFlowMap)
      .filter(([, v]) => v > 0)
      .map(([key, value]) => { const [source, target] = key.split('|'); return { source, target, value }; });

    const sankeyData: DashboardData['sankeyData'] = {
      divisions: Object.entries(sankeyDivMap).map(([id, spend]) => ({ id: `div-${id}`, label: divisionLabel(id as DivisionId, selectedEnterprise) || id, spend })),
      agencies: Object.entries(sankeyAgencyMap).map(([id, spend]) => ({ id: `agency-${id}`, label: AGENCY_LABELS[id as AgencyId] || id, spend })),
      products: Object.entries(sankeyProdMap).map(([id, { spend, divisionId, agencyId }]) => ({ id: `prod-${id}`, label: PRODUCT_LINE_LABELS[id as ProductLineId] || id, spend, divisionId, agencyId })),
      channels: Object.entries(sankeyChanMap).map(([id, { spend }]) => ({ id: `ch-${id}`, label: CHANNEL_LABELS[id as ChannelId] || id, spend })),
      revenue: sankeyRevenue,
      estimatedWaste: sankeyWaste,
      flows: sankeyFlows,
    };

    // ===== Conversion Value Data =====
    const cvProdMap: Record<string, { conversions: number; revenue: number; dailyBuckets: Record<string, { conversions: number; revenue: number }> }> = {};
    for (const camp of viewCampaigns) {
      const pl = camp.productLine;
      if (!cvProdMap[pl]) cvProdMap[pl] = { conversions: 0, revenue: 0, dailyBuckets: {} };
      for (const ch of camp.channels) {
        const chData = store.dailyData[camp.id]?.[ch];
        if (!chData) continue;
        const days = filterDailyByDate(chData, start, end);
        for (const d of days) {
          cvProdMap[pl].conversions += d.conversions;
          cvProdMap[pl].revenue += d.revenue;
          if (!cvProdMap[pl].dailyBuckets[d.date]) cvProdMap[pl].dailyBuckets[d.date] = { conversions: 0, revenue: 0 };
          cvProdMap[pl].dailyBuckets[d.date].conversions += d.conversions;
          cvProdMap[pl].dailyBuckets[d.date].revenue += d.revenue;
        }
      }
    }
    // Always compute previous period for conversion value trends
    const cvPrevMap: Record<string, { conversions: number; revenue: number }> = {};
    for (const camp of viewCampaigns) {
      const pl = camp.productLine;
      if (!cvPrevMap[pl]) cvPrevMap[pl] = { conversions: 0, revenue: 0 };
      for (const ch of camp.channels) {
        const chData = store.dailyData[camp.id]?.[ch];
        if (!chData) continue;
        const days = filterDailyByDate(chData, prevStart, prevEnd);
        for (const d of days) {
          cvPrevMap[pl].conversions += d.conversions;
          cvPrevMap[pl].revenue += d.revenue;
        }
      }
    }
    // Build result
    const cvEntries = Object.entries(cvProdMap)
      .filter(([, v]) => v.conversions > 0)
      .map(([pl, data]) => {
        const rpc = data.revenue / data.conversions;
        const prev = cvPrevMap[pl];
        const prevRpc = prev && prev.conversions > 0 ? prev.revenue / prev.conversions : null;
        const trend = prevRpc !== null && prevRpc > 0 ? ((rpc - prevRpc) / prevRpc) * 100 : 0;
        // Sparkline
        const sortedDates = Object.keys(data.dailyBuckets).sort();
        const totalDays = sortedDates.length;
        const bucketSize = Math.max(1, Math.floor(totalDays / 10));
        const sparkline: number[] = [];
        for (let i = 0; i < 10; i++) {
          const bStart = i * bucketSize;
          const bEnd = Math.min((i + 1) * bucketSize, totalDays);
          const slice = sortedDates.slice(bStart, bEnd);
          let bConv = 0, bRev = 0;
          for (const dt of slice) { bConv += data.dailyBuckets[dt].conversions; bRev += data.dailyBuckets[dt].revenue; }
          sparkline.push(bConv > 0 ? bRev / bConv : 0);
        }
        return { productLine: pl as ProductLineId, label: PRODUCT_LINE_LABELS[pl as ProductLineId] || pl, conversions: data.conversions, revenue: data.revenue, revenuePerConversion: rpc, previousRevenuePerConversion: prevRpc, trend, signal: 'stable' as const, sparkline };
      })
      .sort((a, b) => b.revenuePerConversion - a.revenuePerConversion);
    // Assign signals
    const rpcValues = cvEntries.map(e => e.revenuePerConversion).sort((a, b) => b - a);
    const top25 = rpcValues[Math.floor(rpcValues.length * 0.25)] || rpcValues[0] || 0;
    const conversionValueData: DashboardData['conversionValueData'] = cvEntries.map(e => {
      let signal: DashboardData['conversionValueData'][0]['signal'] = 'stable';
      if (e.revenuePerConversion >= top25 && e.trend > 5) signal = 'high-value';
      else if (e.trend > 15) signal = 'improving';
      else if (e.trend >= -5 && e.trend <= 5) signal = 'stable';
      else if (e.trend >= -15 && e.trend < -5) signal = 'watch';
      else if (e.trend < -15) signal = 'declining';
      return { ...e, signal };
    });

    return {
      viewLevel, currentKPIs, previousKPIs, timeSeries, divisionData, productData, campaignData,
      channelData: channelDataMap, stateData, topImproving, topDeclining, anomalies, scopedInsights,
      filteredGeos: selectedGeos,
      allCampaigns: store.campaigns, selectedCampaignObj, store,
      funnelData, audienceData, investmentDistData, agencyData, sankeyData, conversionValueData,
    };
  }, [store, dateRange, compareEnabled, selectedDivisions, selectedAgencies, selectedProductLines, selectedAudiences, selectedGeos, selectedChannels, selectedCampaigns, selectedObjectives, selectedCampaignStatuses, attributionModel, selectedDivision, selectedProductLine, selectedCampaign, selectedEnterprise, selectedDealer]);
}
