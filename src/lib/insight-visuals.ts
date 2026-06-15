// Per-insight chart specs. Each insight gets a chart whose TYPE and SHAPE
// illustrate the specific finding in its headline — not a generic trend line.
// Consumed by <InsightChart /> (card grid + detail modal).

import {
  type InsightVisual, TEAL, RED, BLUE, PURPLE, GOLD, MUTED, GRID,
} from './insight-visual-types';
// Per-client visual maps live with their data modules so each client is self-contained.
import { RBC_VISUALS } from './clients/rbc';
import { MOLSON_COORS_VISUALS } from './clients/molson-coors';
import { LULULEMON_VISUALS } from './clients/lululemon';
import { TIM_HORTONS_VISUALS } from './clients/tim-hortons';

// Re-export the chart types so existing importers (insight-chart.tsx) keep working.
export type { InsightChartKind, InsightRefLine, InsightVisual } from './insight-visual-types';

const VISUALS: Record<string, InsightVisual> = {
  // ──────────────────────────────────────────────────────────────
  // BRAND & PORTFOLIO STRATEGY
  // ──────────────────────────────────────────────────────────────

  // 31x/week combined frequency vs ~8–12 effective ceiling
  'ins-strat-01-brand-promises': {
    kind: 'bar',
    xKey: 'tier',
    series: ['freq'],
    perBarColor: true,
    config: { freq: { label: 'Weekly frequency' } },
    data: [
      { tier: 'Tier 1', freq: 13, fill: MUTED },
      { tier: 'Tier 2', freq: 11, fill: MUTED },
      { tier: 'Store', freq: 7, fill: MUTED },
      { tier: 'Combined', freq: 31, fill: RED },
    ],
    refLines: [{ axis: 'y', value: 12, label: 'Effective max ~12', color: TEAL }],
    caption: 'No single tier breaches the cap — combined exposure hits 31×/week',
  },

  // Brand impressions +12% while branded search −4% (indexed to 100)
  'ins-strat-02-f150-halo': {
    kind: 'line',
    xKey: 'week',
    series: ['impressions', 'search'],
    yTitle: 'Indexed to 100',
    config: {
      impressions: { label: 'Brand impressions', color: BLUE },
      search: { label: 'Branded search', color: RED },
    },
    data: [
      { week: 'W1', impressions: 100, search: 100 },
      { week: 'W2', impressions: 103, search: 99 },
      { week: 'W3', impressions: 106, search: 99 },
      { week: 'W4', impressions: 108, search: 97 },
      { week: 'W5', impressions: 110, search: 97 },
      { week: 'W6', impressions: 112, search: 96 },
    ],
    caption: 'Indexed to 100 — paid up, brand pull down (the divergence)',
  },

  // One message theme outperforming across the live portfolio
  'ins-strat-03-bronco-earned': {
    kind: 'bar',
    xKey: 'theme',
    series: ['index'],
    perBarColor: true,
    config: { index: { label: 'Performance index' } },
    data: [
      { theme: 'Theme A', index: 142, fill: TEAL },
      { theme: 'Theme B', index: 108, fill: MUTED },
      { theme: 'Theme C', index: 96, fill: MUTED },
      { theme: 'Theme D', index: 88, fill: MUTED },
      { theme: 'Theme E', index: 79, fill: MUTED },
    ],
    refLines: [{ axis: 'y', value: 100, label: 'Portfolio avg', color: GRID }],
    caption: 'Engagement + consideration index by message theme — one clear winner',
  },

  // ──────────────────────────────────────────────────────────────
  // NATIONAL-TO-REGIONAL ORCHESTRATION
  // ──────────────────────────────────────────────────────────────

  // National consideration lift vs regional budget share, by region
  'ins-natreg-01-demand-vs-budget': {
    kind: 'bar',
    xKey: 'region',
    series: ['lift', 'budget'],
    yTitle: 'Index · budget share %',
    config: {
      lift: { label: 'National lift (index)', color: TEAL },
      budget: { label: 'Regional budget share', color: PURPLE },
    },
    data: [
      { region: 'ON', lift: 132, budget: 24 },
      { region: 'AB', lift: 124, budget: 14 },
      { region: 'BC', lift: 119, budget: 16 },
      { region: 'QC', lift: 92, budget: 28 },
      { region: 'AT', lift: 86, budget: 18 },
    ],
    caption: 'Biggest national lift (ON/AB/BC) is not where regional budget sits',
  },

  // ROAS by region vs national benchmark — West best, Ontario worst
  'ins-natreg-02-playbook-cascade': {
    kind: 'bar',
    xKey: 'region',
    series: ['roas'],
    perBarColor: true,
    yTitle: 'ROAS (×)',
    config: { roas: { label: 'ROAS (×)' } },
    data: [
      { region: 'West', roas: 4.1, fill: TEAL },
      { region: 'Alberta', roas: 3.6, fill: MUTED },
      { region: 'Québec', roas: 3.4, fill: MUTED },
      { region: 'Atlantic', roas: 3.1, fill: MUTED },
      { region: 'Ontario', roas: 2.4, fill: RED },
    ],
    refLines: [{ axis: 'y', value: 3.4, label: 'National benchmark 3.4×', color: GRID }],
    caption: 'Only the West runs the proven playbook (4.1×) — Ontario trails at 2.4×, ~30% below national',
  },

  // ──────────────────────────────────────────────────────────────
  // MEDIA EFFICIENCY & ALLOCATION
  // ──────────────────────────────────────────────────────────────

  // YouTube best cost-per-view efficiency but smallest video budget share
  'ins-tactical-001-lightning-channel-mix': {
    kind: 'bar',
    xKey: 'channel',
    series: ['qvr', 'budget'],
    yTitle: 'Index · budget share %',
    config: {
      qvr: { label: 'Cost-per-view efficiency (idx)', color: TEAL },
      budget: { label: 'Video budget share', color: PURPLE },
    },
    data: [
      { channel: 'YouTube', qvr: 138, budget: 12 },
      { channel: 'CTV', qvr: 104, budget: 31 },
      { channel: 'Meta', qvr: 86, budget: 34 },
      { channel: 'TikTok', qvr: 97, budget: 13 },
      { channel: 'Spotify', qvr: 79, budget: 10 },
    ],
    caption: 'YouTube leads on efficiency, holds the smallest share of video budget',
  },

  // Instagram CPM rising while cost-per-result flat
  'ins-tac-05-instagram-cpm': {
    kind: 'line',
    xKey: 'week',
    series: ['cpm', 'cpr'],
    yTitle: 'Dollars ($)',
    config: {
      cpm: { label: 'Instagram CPM ($)', color: RED },
      cpr: { label: 'Cost per result ($)', color: BLUE },
    },
    data: [
      { week: 'W1', cpm: 14.2, cpr: 41 },
      { week: 'W2', cpm: 15.6, cpr: 41 },
      { week: 'W3', cpm: 17.1, cpr: 42 },
      { week: 'W4', cpm: 18.9, cpr: 41 },
    ],
    caption: 'CPM up 3 weeks straight; cost-per-result flat — paying more for the same',
  },

  // Contested Meta audience CPM premium (overlap drives CPM) — scatter
  'ins-tac-06-meta-audience-overlap': {
    kind: 'scatter',
    xKey: 'overlap',
    series: ['cpm'],
    xName: 'Team overlap (%)',
    yName: 'CPM ($)',
    perBarColor: true,
    config: { cpm: { label: 'CPM ($)' } },
    legend: [
      { label: 'Contested value-families audience', color: RED },
      { label: 'Comparable audiences', color: MUTED },
    ],
    data: [
      { overlap: 6, cpm: 17, fill: MUTED, name: 'Comparable audience' },
      { overlap: 11, cpm: 18, fill: MUTED, name: 'Comparable audience' },
      { overlap: 19, cpm: 19, fill: MUTED, name: 'Comparable audience' },
      { overlap: 28, cpm: 21, fill: MUTED, name: 'Comparable audience' },
      { overlap: 44, cpm: 24, fill: MUTED, name: 'Comparable audience' },
      { overlap: 63, cpm: 27, fill: RED, name: 'Contested value-families audience', tag: 'Contested' },
    ],
    caption: 'Each dot is a Meta audience: more National↔Regional overlap tracks higher CPM',
  },

  // Product-listing / PMax ROAS vs generic Search
  'ins-tactical-002-vla-search': {
    kind: 'bar',
    xKey: 'format',
    series: ['roas'],
    perBarColor: true,
    config: { roas: { label: 'ROAS' } },
    data: [
      { format: 'Product Listing', roas: 5.8, fill: TEAL },
      { format: 'PMax', roas: 5.1, fill: TEAL },
      { format: 'GS Brand', roas: 3.2, fill: MUTED },
      { format: 'GS Category', roas: 2.6, fill: MUTED },
      { format: 'GS Generic', roas: 2.2, fill: RED },
    ],
    caption: 'Product-listing ads convert ~2.6× the ROAS of generic Search — yet generic holds the budget',
  },

  // Scene+ conquest creative peaked ~11 days ago, frequency rising
  'ins-tac-08-lightning-creative-fatigue': {
    kind: 'line',
    xKey: 'day',
    series: ['effectiveness', 'frequency'],
    yTitle: 'Index (peak = 100)',
    config: {
      effectiveness: { label: 'Creative effectiveness', color: TEAL },
      frequency: { label: 'Frequency', color: RED },
    },
    data: [
      { day: '-18d', effectiveness: 78, frequency: 3 },
      { day: '-15d', effectiveness: 92, frequency: 4 },
      { day: '-11d', effectiveness: 100, frequency: 5 },
      { day: '-8d', effectiveness: 94, frequency: 7 },
      { day: '-4d', effectiveness: 83, frequency: 9 },
      { day: 'Today', effectiveness: 71, frequency: 11 },
    ],
    refLines: [{ axis: 'x', value: '-11d', label: 'Peak', color: GRID }],
    caption: 'Effectiveness peaked 11 days ago and falls as frequency builds on Meta',
  },

  // ──────────────────────────────────────────────────────────────
  // CREATIVE PERFORMANCE
  // ──────────────────────────────────────────────────────────────

  // Creative A vs B by metro — clean geographic split
  'ins-tac-09-creative-geo-split': {
    kind: 'bar',
    xKey: 'metro',
    series: ['creativeA', 'creativeB'],
    yTitle: 'Performance index',
    config: {
      creativeA: { label: 'Creative A', color: TEAL },
      creativeB: { label: 'Creative B', color: PURPLE },
    },
    data: [
      { metro: 'Toronto', creativeA: 118, creativeB: 92 },
      { metro: 'Calgary', creativeA: 121, creativeB: 89 },
      { metro: 'Vancouver', creativeA: 114, creativeB: 95 },
      { metro: 'Montreal', creativeA: 88, creativeB: 123 },
      { metro: 'Atlantic', creativeA: 91, creativeB: 116 },
    ],
    caption: 'A wins ON/AB/BC metros; B wins QC/Atlantic — both still run everywhere',
  },

  // Compliments winning variant gets a minority of impressions — donut
  'ins-tac-10-mache-delivery': {
    kind: 'pie',
    nameKey: 'segment',
    valueKey: 'share',
    series: ['share'],
    config: {
      high: { label: 'Premium-fresh foodies (winning variant)', color: TEAL },
      broad: { label: 'Broad, lower-converting', color: MUTED },
    },
    legend: [
      { label: 'Premium-fresh foodies (winning variant)', color: TEAL },
      { label: 'Broad, lower-converting', color: MUTED },
    ],
    data: [
      { segment: 'high', share: 28, fill: TEAL },
      { segment: 'broad', share: 72, fill: MUTED },
    ],
    caption: 'Impression share — the best-converting variant gets the minority',
  },

  // No scheduled refresh — cost-per-result climbs, then a late reactive refresh
  'ins-tac-11-scheduled-refresh': {
    kind: 'line',
    xKey: 'week',
    series: ['cpl'],
    config: { cpl: { label: 'Cost per result ($)', color: RED } },
    data: [
      { week: 'W1', cpl: 188 },
      { week: 'W3', cpl: 201 },
      { week: 'W5', cpl: 224 },
      { week: 'W7', cpl: 252 },
      { week: 'W9', cpl: 281 },
      { week: 'W10', cpl: 196 },
    ],
    refLines: [{ axis: 'x', value: 'W10', label: 'Reactive refresh', color: GRID }],
    caption: 'Cost-per-result is allowed to climb for weeks before creative is finally replaced',
  },

  // ──────────────────────────────────────────────────────────────
  // AUDIENCE & FREQUENCY
  // ──────────────────────────────────────────────────────────────

  // Three categories pile onto the same No Frills–conquest audience
  'ins-tac-12-tesla-conquest-overlap': {
    kind: 'bar',
    xKey: 'source',
    series: ['freq'],
    perBarColor: true,
    config: { freq: { label: 'Weekly frequency' } },
    data: [
      { source: 'Scene+', freq: 14, fill: MUTED },
      { source: 'Weekly Flyer', freq: 16, fill: MUTED },
      { source: 'Compliments', freq: 12, fill: MUTED },
      { source: 'Combined', freq: 42, fill: RED },
    ],
    refLines: [{ axis: 'y', value: 8, label: 'Cap 8×', color: TEAL }],
    caption: 'One shopper, three categories — combined frequency 42× vs an 8× cap',
  },

  // Weekly Flyer vs Voilà convert different readiness tiers
  'ins-tac-13-ev-considerer-overlap': {
    kind: 'bar',
    xKey: 'readiness',
    series: ['phev', 'mache'],
    yTitle: 'Conversion index',
    config: {
      phev: { label: 'Weekly Flyer', color: GOLD },
      mache: { label: 'Voilà', color: TEAL },
    },
    data: [
      { readiness: 'In-store planners', phev: 124, mache: 82 },
      { readiness: 'Delivery-ready', phev: 78, mache: 131 },
    ],
    caption: 'Conversion index by readiness — they win different shoppers, so sequence them',
  },

  // ──────────────────────────────────────────────────────────────
  // COMPETITIVE & MARKET SIGNALS
  // ──────────────────────────────────────────────────────────────

  // Value-comparison search rises after No Frills "Hauler Hotline" price event
  'ins-011-tesla-cybertruck-response': {
    kind: 'line',
    xKey: 'day',
    series: ['comparison'],
    config: { comparison: { label: 'Sobeys-vs-No Frills value search', color: RED } },
    data: [
      { day: '-4d', comparison: 100 },
      { day: '-2d', comparison: 102 },
      { day: 'Event', comparison: 104 },
      { day: '+2d', comparison: 121 },
      { day: '+4d', comparison: 134 },
      { day: '+6d', comparison: 138 },
    ],
    refLines: [{ axis: 'x', value: 'Event', label: 'Hauler Hotline', color: GRID }],
    caption: 'Value-comparison search rises in the days after the No Frills price event (correlation)',
  },

  // Food inflation above threshold coincides with Compliments/value organic search
  'ins-010-gas-price-phev-tailwind': {
    kind: 'line',
    xKey: 'day',
    series: ['gas', 'search'],
    yTitle: 'Food CPI (YoY %) · search index',
    config: {
      gas: { label: 'Food CPI (YoY %, ×10)', color: GOLD },
      search: { label: 'Compliments / value search', color: TEAL },
    },
    data: [
      { day: 'D1', gas: 38, search: 100 },
      { day: 'D5', gas: 41, search: 108 },
      { day: 'D9', gas: 44, search: 121 },
      { day: 'D13', gas: 46, search: 133 },
      { day: 'D17', gas: 47, search: 139 },
    ],
    refLines: [{ axis: 'y', value: 40, label: '4% threshold', color: GRID }],
    caption: 'Sustained food inflation above 4% coincides with rising Compliments/value search',
  },

  // ══════════════════════════════════════════════════════════════
  // FARM BOY (fresh-market banner)
  // ══════════════════════════════════════════════════════════════

  // Prepared Foods conquest: Whole Foods no longer converting; pivot to Metro / organic
  'ins-lincoln-001-nautilus-rx-pivot': {
    kind: 'bar', xKey: 'segment', series: ['val'], perBarColor: true,
    xTitle: 'Conquest segment',
    config: { val: { label: 'Conversion index' } },
    refLines: [{ axis: 'y', value: 100, label: 'Breakeven', color: GRID }],
    data: [
      { segment: 'Whole Foods', val: 62, fill: RED },
      { segment: 'Metro', val: 128, fill: TEAL },
      { segment: 'Organic & Natural', val: 119, fill: TEAL },
    ],
    caption: 'Whole Foods conquest has stopped converting; Metro and organic are where the demand is',
  },

  // Whole Foods cuts produce prices below Farm Boy's premium-fresh line
  'ins-lincoln-002-aviator-x5-pricing': {
    kind: 'bar', xKey: 'model', series: ['price'], perBarColor: true,
    xTitle: 'Core produce basket', yTitle: 'Indexed price (×100)',
    config: { price: { label: 'Indexed price' } },
    data: [
      { model: 'Farm Boy premium-fresh', price: 100, fill: TEAL },
      { model: 'Whole Foods (post-cut)', price: 94, fill: RED },
    ],
    caption: 'Whole Foods cuts core produce ~6% below Farm Boy — the premium-fresh gap is compressed',
  },

  // Farm Boy Regional original-French bakery creative beats Studio adaptation
  'ins-lincoln-003-corsair-quebec-french': {
    kind: 'bar', xKey: 'agency', series: ['val'], perBarColor: true,
    xTitle: 'French-market bakery creative', yTitle: 'ThruPlay rate (index)',
    config: { val: { label: 'ThruPlay rate (idx)' } },
    data: [
      { agency: 'Farm Boy Regional', val: 230, fill: TEAL },
      { agency: 'Farm Boy Studio', val: 100, fill: MUTED },
    ],
    caption: "Farm Boy Regional's original-French bakery creative delivers ~2.3× the ThruPlay",
  },

  // GST/HST holiday removes tax friction on prepared-foods baskets
  'ins-lincoln-004-luxury-tax-window': {
    kind: 'bar', xKey: 'trim', series: ['val'], perBarColor: true,
    xTitle: 'Eligible department', yTitle: 'Tax friction removed (%)',
    config: { val: { label: 'Friction removed (%)' } },
    data: [
      { trim: 'Prepared Foods & Deli', val: 13, fill: TEAL },
      { trim: 'Bakery', val: 5, fill: TEAL },
    ],
    caption: 'July 1 GST/HST holiday removes 5–13% of tax friction on these prepared-foods baskets',
  },

  // Butcher & Seafood vs Fresh Produce on the Whole Foods-conquest audience
  'ins-lincoln-005-navigator-conquest-bmw': {
    kind: 'bar', xKey: 'nameplate', series: ['val'], perBarColor: true,
    xTitle: 'Department on Conquest — Whole Foods', yTitle: 'Conversion index',
    config: { val: { label: 'Whole Foods-conquest conversion' } },
    data: [
      { nameplate: 'Butcher & Seafood', val: 134, fill: TEAL },
      { nameplate: 'Fresh Produce', val: 96, fill: MUTED },
    ],
    caption: 'Butcher & Seafood converts the Whole Foods-conquest audience better — it should own the segment',
  },

  // Local-harvest seasonal SOV below competitive set
  'ins-lincoln-006-aviator-launch-q3-prep': {
    kind: 'bar', xKey: 'entrant', series: ['val'], perBarColor: true,
    xTitle: 'Seasonal share of voice', yTitle: 'Tier 1 SOV (×)',
    config: { val: { label: 'Tier 1 SOV (×)' } },
    refLines: [{ axis: 'y', value: 1, label: 'Parity 1.0×', color: GRID }],
    data: [
      { entrant: 'Farm Boy (planned)', val: 0.7, fill: RED },
      { entrant: 'Competitive avg', val: 1.0, fill: MUTED },
    ],
    caption: 'Local-harvest season opens in 84 days at 0.7× the competitive Tier 1 weight',
  },

  // ══════════════════════════════════════════════════════════════
  // LONGO'S STORE NETWORK
  // ══════════════════════════════════════════════════════════════

  // Pioneer cohort outperforms the network 2.5x
  'ins-dn-001-pioneer-cohort': {
    kind: 'bar', xKey: 'group', series: ['val'], perBarColor: true,
    xTitle: 'Store cohort', yTitle: 'Performance index',
    config: { val: { label: 'Performance index' } },
    data: [
      { group: '32 pioneers', val: 250, fill: TEAL },
      { group: 'Rest of network', val: 100, fill: MUTED },
    ],
    caption: '32 vertical-video-first stores are outperforming the rest ~2.5×',
  },

  // Flagship halo lift on satellite stores
  'ins-dn-002-flagship-halo': {
    kind: 'line', xKey: 'day', series: ['traffic'],
    xTitle: 'Days around flagship flight', yTitle: 'Satellite organic traffic (idx)',
    config: { traffic: { label: 'Satellite organic traffic', color: TEAL } },
    refLines: [{ axis: 'x', value: 'Flagship', label: 'Flagship flight', color: GRID }],
    data: [
      { day: '-6d', traffic: 100 },
      { day: '-3d', traffic: 101 },
      { day: 'Flagship', traffic: 103 },
      { day: '+3d', traffic: 114 },
      { day: '+6d', traffic: 112 },
      { day: '+9d', traffic: 104 },
    ],
    caption: 'Satellite stores within 50km gain ~14% organic lift during flagship flights',
  },

  // Top-performer playbook: 3 levers, top vs network
  'ins-dn-003-top-performer-decoded': {
    kind: 'bar', xKey: 'lever', series: ['top', 'network'],
    xTitle: 'Playbook lever', yTitle: 'Adoption %',
    config: {
      top: { label: 'Top 89 stores', color: TEAL },
      network: { label: 'Network avg', color: MUTED },
    },
    data: [
      { lever: 'Flyer-feed health', top: 94, network: 51 },
      { lever: 'Vertical video', top: 88, network: 43 },
      { lever: 'Scene+ email 4wk', top: 91, network: 38 },
    ],
    caption: 'Three invisible levers separate the top 89 stores from the network',
  },

  // In-store→Online cross-sell motion
  'ins-dn-004-service-sales-bridge': {
    kind: 'bar', xKey: 'group', series: ['val'], perBarColor: true,
    xTitle: 'Store cohort', yTitle: 'In-store→online conversion (idx)',
    config: { val: { label: 'In-store→online conversion' } },
    data: [
      { group: '18 stores', val: 340, fill: TEAL },
      { group: 'Network avg', val: 100, fill: MUTED },
    ],
    caption: '18 stores convert in-store shoppers to Grocery Gateway online at ~3.4× the network rate',
  },

  // QEW corridor cross-shop composition
  'ins-dn-005-qew-corridor-cluster': {
    kind: 'pie', nameKey: 'seg', valueKey: 'share', series: ['share'],
    config: {
      highlander: { label: 'Cross-shop Costco', color: RED },
      other: { label: 'Other shopping', color: MUTED },
    },
    legend: [
      { label: 'Cross-shop Costco', color: RED },
      { label: 'Other shopping behaviour', color: MUTED },
    ],
    data: [
      { seg: 'highlander', share: 47, fill: RED },
      { seg: 'other', share: 53, fill: MUTED },
    ],
    caption: '47% of QEW-corridor shoppers cross-shop Costco — coordinate the conquest',
  },

  // Local-marketing funds left stranded
  'ins-dn-006-coop-stranded': {
    kind: 'pie', nameKey: 'seg', valueKey: 'share', series: ['share'],
    config: {
      stranded: { label: 'Stranded fund', color: RED },
      claimed: { label: 'Claimed', color: TEAL },
    },
    legend: [
      { label: 'Stranded (unclaimed)', color: RED },
      { label: 'Claimed', color: TEAL },
    ],
    data: [
      { seg: 'stranded', share: 54, fill: RED },
      { seg: 'claimed', share: 46, fill: TEAL },
    ],
    caption: '142 stores left 54% of Q1 local-marketing fund unclaimed — an 8-step process strands $4.8M',
  },

  // Toronto DMA store-vs-store auction self-tax
  'ins-dn-007-toronto-dma-auction': {
    kind: 'bar', xKey: 'type', series: ['cpc'], perBarColor: true,
    xTitle: 'Toronto-DMA Search auctions', yTitle: 'Average CPC ($)',
    config: { cpc: { label: 'Average CPC ($)' } },
    data: [
      { type: 'Non-contested', cpc: 3.1, fill: MUTED },
      { type: 'Store-vs-store', cpc: 4.95, fill: RED },
    ],
    caption: '47 stores bid against each other in 4,200 weekly auctions — a ~$4.4M self-tax',
  },

  // Cottage-region inverted seasonality
  'ins-dn-008-cottage-seasonality': {
    kind: 'line', xKey: 'month', series: ['network', 'cottage'],
    xTitle: 'Month', yTitle: 'Demand index',
    config: {
      network: { label: 'Network demand', color: BLUE },
      cottage: { label: 'Cottage-region demand', color: TEAL },
    },
    data: [
      { month: 'Mar', network: 120, cottage: 72 },
      { month: 'May', network: 128, cottage: 96 },
      { month: 'Jul', network: 96, cottage: 140 },
      { month: 'Sep', network: 86, cottage: 121 },
      { month: 'Nov', network: 78, cottage: 64 },
    ],
    caption: '27 cottage-region stores peak in summer — opposite the spring network calendar',
  },

  // Quebec OQLF compliance cost: scramble vs coordinated
  'ins-dn-009-quebec-french-compliance': {
    kind: 'bar', xKey: 'approach', series: ['cost'], perBarColor: true,
    xTitle: 'Compliance approach', yTitle: 'Cost ($K)',
    config: { cost: { label: 'Cost ($K)' } },
    data: [
      { approach: 'Store-by-store', cost: 1100, fill: RED },
      { approach: 'Central template', cost: 332, fill: TEAL },
    ],
    caption: 'A coordinated French-creative template saves ~$768K vs 64 stores scrambling',
  },

  // Brand-mark drift across network creatives
  'ins-dn-010-brand-mark-drift': {
    kind: 'pie', nameKey: 'seg', valueKey: 'share', series: ['share'],
    config: {
      outdated: { label: 'Outdated 2023 mark', color: RED },
      compliant: { label: 'Compliant', color: TEAL },
    },
    legend: [
      { label: 'Outdated 2023 brand-mark', color: RED },
      { label: 'Compliant', color: TEAL },
    ],
    data: [
      { seg: 'outdated', share: 16, fill: RED },
      { seg: 'compliant', share: 84, fill: TEAL },
    ],
    caption: '142 store creatives still run the 2023 brand-mark — drift invisible without STRATIS',
  },
};

// Sobeys/Farm Boy/Longo's visuals (above) plus the self-contained per-client maps.
const ALL_VISUALS: Record<string, InsightVisual> = {
  ...VISUALS,
  ...RBC_VISUALS,
  ...MOLSON_COORS_VISUALS,
  ...LULULEMON_VISUALS,
  ...TIM_HORTONS_VISUALS,
};

// Fallback for any unmapped insight (Farm Boy, Longo's store network, market radar):
// a clean single-series trend rather than the old noisy composed chart.
export function getInsightVisual(insightId: string): InsightVisual {
  const v = ALL_VISUALS[insightId];
  if (v) return v;

  // Deterministic-ish gentle upward trend so fallbacks look intentional, not random.
  const seed = insightId.length;
  const base = 60 + (seed % 12);
  const data = Array.from({ length: 6 }, (_, i) => ({
    week: `W${i + 1}`,
    value: Math.round(base + i * (4 + (seed % 3)) + (i % 2 === 0 ? 2 : -1)),
  }));
  return {
    kind: 'line',
    xKey: 'week',
    series: ['value'],
    config: { value: { label: 'Performance index', color: TEAL } },
    data,
    caption: 'Trailing performance trend',
  };
}
