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
      { tier: 'Dealer', freq: 7, fill: MUTED },
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

  // CPL by regional partner vs Tier 1 baseline
  'ins-natreg-02-playbook-cascade': {
    kind: 'bar',
    xKey: 'partner',
    series: ['cpl'],
    perBarColor: true,
    config: { cpl: { label: 'Cost per lead ($)' } },
    data: [
      { partner: 'BC', cpl: 148, fill: TEAL },
      { partner: 'AB', cpl: 210, fill: MUTED },
      { partner: 'QC', cpl: 218, fill: MUTED },
      { partner: 'AT', cpl: 232, fill: MUTED },
      { partner: 'ON', cpl: 298, fill: RED },
    ],
    refLines: [{ axis: 'y', value: 218, label: 'Tier 1 baseline $218', color: GRID }],
    caption: 'Only BC runs the proven playbook ($148) — the other four trail it',
  },

  // ──────────────────────────────────────────────────────────────
  // MEDIA EFFICIENCY & ALLOCATION
  // ──────────────────────────────────────────────────────────────

  // YouTube best qualified-view rate but smallest video budget share
  'ins-tactical-001-lightning-channel-mix': {
    kind: 'bar',
    xKey: 'channel',
    series: ['qvr', 'budget'],
    yTitle: 'Index · budget share %',
    config: {
      qvr: { label: 'Qualified-view rate (idx)', color: TEAL },
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
    xName: 'Agency overlap (%)',
    yName: 'CPM ($)',
    perBarColor: true,
    config: { cpm: { label: 'CPM ($)' } },
    legend: [
      { label: 'Contested truck audience', color: RED },
      { label: 'Comparable audiences', color: MUTED },
    ],
    data: [
      { overlap: 6, cpm: 17, fill: MUTED, name: 'Comparable audience' },
      { overlap: 11, cpm: 18, fill: MUTED, name: 'Comparable audience' },
      { overlap: 19, cpm: 19, fill: MUTED, name: 'Comparable audience' },
      { overlap: 28, cpm: 21, fill: MUTED, name: 'Comparable audience' },
      { overlap: 44, cpm: 24, fill: MUTED, name: 'Comparable audience' },
      { overlap: 63, cpm: 27, fill: RED, name: 'Contested truck audience', tag: 'Contested' },
    ],
    caption: 'Each dot is a Meta audience: more Mindshare↔Regional overlap tracks higher CPM',
  },

  // VLA / PMax ROAS vs generic Search
  'ins-tactical-002-vla-search': {
    kind: 'bar',
    xKey: 'format',
    series: ['roas'],
    perBarColor: true,
    config: { roas: { label: 'ROAS' } },
    data: [
      { format: 'VLA', roas: 5.8, fill: TEAL },
      { format: 'PMax', roas: 5.1, fill: TEAL },
      { format: 'GS Brand', roas: 3.2, fill: MUTED },
      { format: 'GS Nameplate', roas: 2.6, fill: MUTED },
      { format: 'GS Generic', roas: 2.2, fill: RED },
    ],
    caption: 'VLA converts ~2.6× the ROAS of generic Search — yet generic holds the budget',
  },

  // Lightning conquest creative peaked ~11 days ago, frequency rising
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

  // Mach-E winning variant gets a minority of impressions — donut
  'ins-tac-10-mache-delivery': {
    kind: 'pie',
    nameKey: 'segment',
    valueKey: 'share',
    series: ['share'],
    config: {
      high: { label: 'High-intent EV (winning variant)', color: TEAL },
      broad: { label: 'Broad, lower-converting', color: MUTED },
    },
    legend: [
      { label: 'High-intent EV (winning variant)', color: TEAL },
      { label: 'Broad, lower-converting', color: MUTED },
    ],
    data: [
      { segment: 'high', share: 28, fill: TEAL },
      { segment: 'broad', share: 72, fill: MUTED },
    ],
    caption: 'Impression share — the best-converting variant gets the minority',
  },

  // No scheduled refresh — CPL climbs, then a late reactive refresh
  'ins-tac-11-scheduled-refresh': {
    kind: 'line',
    xKey: 'week',
    series: ['cpl'],
    config: { cpl: { label: 'Cost per lead ($)', color: RED } },
    data: [
      { week: 'W1', cpl: 188 },
      { week: 'W3', cpl: 201 },
      { week: 'W5', cpl: 224 },
      { week: 'W7', cpl: 252 },
      { week: 'W9', cpl: 281 },
      { week: 'W10', cpl: 196 },
    ],
    refLines: [{ axis: 'x', value: 'W10', label: 'Reactive refresh', color: GRID }],
    caption: 'CPL is allowed to climb for weeks before creative is finally replaced',
  },

  // ──────────────────────────────────────────────────────────────
  // AUDIENCE & FREQUENCY
  // ──────────────────────────────────────────────────────────────

  // Three nameplates pile onto the same Tesla-conquest audience
  'ins-tac-12-tesla-conquest-overlap': {
    kind: 'bar',
    xKey: 'source',
    series: ['freq'],
    perBarColor: true,
    config: { freq: { label: 'Weekly frequency' } },
    data: [
      { source: 'Lightning', freq: 14, fill: MUTED },
      { source: 'Mach-E', freq: 16, fill: MUTED },
      { source: 'F-150', freq: 12, fill: MUTED },
      { source: 'Combined', freq: 42, fill: RED },
    ],
    refLines: [{ axis: 'y', value: 8, label: 'Cap 8×', color: TEAL }],
    caption: 'One prospect, three nameplates — combined frequency 42× vs an 8× cap',
  },

  // PHEV vs Mach-E convert different readiness tiers
  'ins-tac-13-ev-considerer-overlap': {
    kind: 'bar',
    xKey: 'readiness',
    series: ['phev', 'mache'],
    yTitle: 'Conversion index',
    config: {
      phev: { label: 'Escape PHEV', color: GOLD },
      mache: { label: 'Mach-E', color: TEAL },
    },
    data: [
      { readiness: 'EV-curious', phev: 124, mache: 82 },
      { readiness: 'Committed intenders', phev: 78, mache: 131 },
    ],
    caption: 'Conversion index by readiness — they win different buyers, so sequence them',
  },

  // ──────────────────────────────────────────────────────────────
  // COMPETITIVE & MARKET SIGNALS
  // ──────────────────────────────────────────────────────────────

  // Comparison search rises after Tesla Cybertruck price cut
  'ins-011-tesla-cybertruck-response': {
    kind: 'line',
    xKey: 'day',
    series: ['comparison'],
    config: { comparison: { label: 'Lightning-vs-Cybertruck search', color: RED } },
    data: [
      { day: '-4d', comparison: 100 },
      { day: '-2d', comparison: 102 },
      { day: 'Cut', comparison: 104 },
      { day: '+2d', comparison: 121 },
      { day: '+4d', comparison: 134 },
      { day: '+6d', comparison: 138 },
    ],
    refLines: [{ axis: 'x', value: 'Cut', label: 'Price cut', color: GRID }],
    caption: 'Comparison-shopping search rises in the days after the price cut (correlation)',
  },

  // Gas price above threshold coincides with PHEV organic search
  'ins-010-gas-price-phev-tailwind': {
    kind: 'line',
    xKey: 'day',
    series: ['gas', 'search'],
    yTitle: 'Gas ¢/L · search index',
    config: {
      gas: { label: 'Gas price ($/L, ×100)', color: GOLD },
      search: { label: 'Escape Hybrid/PHEV search', color: TEAL },
    },
    data: [
      { day: 'D1', gas: 162, search: 100 },
      { day: 'D5', gas: 166, search: 108 },
      { day: 'D9', gas: 169, search: 121 },
      { day: 'D13', gas: 170, search: 133 },
      { day: 'D17', gas: 171, search: 139 },
    ],
    refLines: [{ axis: 'y', value: 165, label: '$1.65 threshold', color: GRID }],
    caption: 'Sustained gas above $1.65/L coincides with rising electrified-Escape search',
  },

  // ══════════════════════════════════════════════════════════════
  // LINCOLN (luxury division)
  // ══════════════════════════════════════════════════════════════

  // Nautilus conquest: RX no longer converting; pivot to GLE / Q7
  'ins-lincoln-001-nautilus-rx-pivot': {
    kind: 'bar', xKey: 'segment', series: ['val'], perBarColor: true,
    xTitle: 'Conquest segment',
    config: { val: { label: 'Conversion index' } },
    refLines: [{ axis: 'y', value: 100, label: 'Breakeven', color: GRID }],
    data: [
      { segment: 'Lexus RX', val: 62, fill: RED },
      { segment: 'Mercedes GLE', val: 128, fill: TEAL },
      { segment: 'Audi Q7', val: 119, fill: TEAL },
    ],
    caption: 'RX conquest has stopped converting; GLE and Q7 are where the demand is',
  },

  // BMW X5 2027 opens below Aviator Reserve
  'ins-lincoln-002-aviator-x5-pricing': {
    kind: 'bar', xKey: 'model', series: ['price'], perBarColor: true,
    xTitle: 'Mid-size luxury SUV', yTitle: 'Starting price ($)',
    config: { price: { label: 'Starting price ($)' } },
    data: [
      { model: 'Aviator Reserve', price: 79100, fill: TEAL },
      { model: 'BMW X5 2027', price: 74900, fill: RED },
    ],
    caption: 'The X5 2027 opens ~$4,200 below Aviator Reserve — premium gap compressed',
  },

  // Cossette QC French Corsair creative beats Hudson Rouge adaptation
  'ins-lincoln-003-corsair-quebec-french': {
    kind: 'bar', xKey: 'agency', series: ['val'], perBarColor: true,
    xTitle: 'Quebec French creative', yTitle: 'ThruPlay rate (index)',
    config: { val: { label: 'ThruPlay rate (idx)' } },
    data: [
      { agency: 'Cossette Luxury', val: 230, fill: TEAL },
      { agency: 'Hudson Rouge', val: 100, fill: MUTED },
    ],
    caption: "Cossette's Quebec French Corsair creative delivers ~2.3× the ThruPlay",
  },

  // Luxury-tax threshold lift removes friction on top trims
  'ins-lincoln-004-luxury-tax-window': {
    kind: 'bar', xKey: 'trim', series: ['val'], perBarColor: true,
    xTitle: 'Eligible trim', yTitle: 'Tax friction removed ($)',
    config: { val: { label: 'Friction removed ($)' } },
    data: [
      { trim: 'Aviator Black Label', val: 6000, fill: TEAL },
      { trim: 'Navigator Reserve', val: 8000, fill: TEAL },
    ],
    caption: 'July 1 luxury-tax threshold lift removes $4K–$8K of friction on these trims',
  },

  // Navigator vs Aviator on the BMW-conquest audience
  'ins-lincoln-005-navigator-conquest-bmw': {
    kind: 'bar', xKey: 'nameplate', series: ['val'], perBarColor: true,
    xTitle: 'Nameplate on Conquest — BMW', yTitle: 'Conversion index',
    config: { val: { label: 'BMW-conquest conversion' } },
    data: [
      { nameplate: 'Navigator', val: 134, fill: TEAL },
      { nameplate: 'Aviator', val: 96, fill: MUTED },
    ],
    caption: 'Navigator converts the BMW-conquest audience better — it should own the segment',
  },

  // Aviator launch SOV below competitive set
  'ins-lincoln-006-aviator-launch-q3-prep': {
    kind: 'bar', xKey: 'entrant', series: ['val'], perBarColor: true,
    xTitle: 'Launch share of voice', yTitle: 'Tier 1 SOV (×)',
    config: { val: { label: 'Tier 1 SOV (×)' } },
    refLines: [{ axis: 'y', value: 1, label: 'Parity 1.0×', color: GRID }],
    data: [
      { entrant: 'Aviator (planned)', val: 0.7, fill: RED },
      { entrant: 'Competitive avg', val: 1.0, fill: MUTED },
    ],
    caption: 'Aviator launches in 84 days at 0.7× the competitive Tier 1 weight',
  },

  // ══════════════════════════════════════════════════════════════
  // DEALERSHIP NETWORK
  // ══════════════════════════════════════════════════════════════

  // Pioneer cohort outperforms the network 2.5x
  'ins-dn-001-pioneer-cohort': {
    kind: 'bar', xKey: 'group', series: ['val'], perBarColor: true,
    xTitle: 'Dealer cohort', yTitle: 'Performance index',
    config: { val: { label: 'Performance index' } },
    data: [
      { group: '32 pioneers', val: 250, fill: TEAL },
      { group: 'Rest of network', val: 100, fill: MUTED },
    ],
    caption: '32 vertical-video-first dealers are outperforming the rest ~2.5×',
  },

  // Flagship halo lift on satellite dealers
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
    caption: 'Satellite dealers within 50km gain ~14% organic lift during flagship flights',
  },

  // Top-performer playbook: 3 levers, top vs network
  'ins-dn-003-top-performer-decoded': {
    kind: 'bar', xKey: 'lever', series: ['top', 'network'],
    xTitle: 'Playbook lever', yTitle: 'Adoption %',
    config: {
      top: { label: 'Top 89 dealers', color: TEAL },
      network: { label: 'Network avg', color: MUTED },
    },
    data: [
      { lever: 'Feed health', top: 94, network: 51 },
      { lever: 'Vertical video', top: 88, network: 43 },
      { lever: 'Lead reply <5min', top: 91, network: 38 },
    ],
    caption: 'Three invisible levers separate the top 89 dealers from the network',
  },

  // Service→Sales cross-sell motion
  'ins-dn-004-service-sales-bridge': {
    kind: 'bar', xKey: 'group', series: ['val'], perBarColor: true,
    xTitle: 'Dealer cohort', yTitle: 'Service→sales conversion (idx)',
    config: { val: { label: 'Service→sales conversion' } },
    data: [
      { group: '18 dealers', val: 340, fill: TEAL },
      { group: 'Network avg', val: 100, fill: MUTED },
    ],
    caption: '18 dealers convert service customers to buyers at ~3.4× the network rate',
  },

  // QEW corridor cross-shop composition
  'ins-dn-005-qew-corridor-cluster': {
    kind: 'pie', nameKey: 'seg', valueKey: 'share', series: ['share'],
    config: {
      highlander: { label: 'Cross-shop Toyota Highlander', color: RED },
      other: { label: 'Other shopping', color: MUTED },
    },
    legend: [
      { label: 'Cross-shop Toyota Highlander', color: RED },
      { label: 'Other shopping behaviour', color: MUTED },
    ],
    data: [
      { seg: 'highlander', share: 47, fill: RED },
      { seg: 'other', share: 53, fill: MUTED },
    ],
    caption: '47% of QEW-corridor buyers cross-shop the Highlander — coordinate the conquest',
  },

  // Co-op funds left stranded
  'ins-dn-006-coop-stranded': {
    kind: 'pie', nameKey: 'seg', valueKey: 'share', series: ['share'],
    config: {
      stranded: { label: 'Stranded co-op', color: RED },
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
    caption: '142 dealers left 54% of Q1 co-op unclaimed — an 8-step process strands $4.8M',
  },

  // Toronto DMA dealer-vs-dealer auction self-tax
  'ins-dn-007-toronto-dma-auction': {
    kind: 'bar', xKey: 'type', series: ['cpc'], perBarColor: true,
    xTitle: 'Toronto-DMA Search auctions', yTitle: 'Average CPC ($)',
    config: { cpc: { label: 'Average CPC ($)' } },
    data: [
      { type: 'Non-contested', cpc: 3.1, fill: MUTED },
      { type: 'Dealer-vs-dealer', cpc: 4.95, fill: RED },
    ],
    caption: '47 dealers bid against each other in 4,200 weekly auctions — a ~$4.4M self-tax',
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
    caption: '27 cottage-region dealers peak in summer — opposite the spring network calendar',
  },

  // Quebec OQLF compliance cost: scramble vs coordinated
  'ins-dn-009-quebec-french-compliance': {
    kind: 'bar', xKey: 'approach', series: ['cost'], perBarColor: true,
    xTitle: 'Compliance approach', yTitle: 'Cost ($K)',
    config: { cost: { label: 'Cost ($K)' } },
    data: [
      { approach: 'Dealer-by-dealer', cost: 1100, fill: RED },
      { approach: 'Cossette template', cost: 332, fill: TEAL },
    ],
    caption: 'A coordinated French-creative template saves ~$768K vs 64 dealers scrambling',
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
    caption: '142 dealer creatives still run the 2023 brand-mark — drift invisible without STRATIS',
  },
};

// Ford/Lincoln/DN visuals (above) plus the self-contained per-client maps.
const ALL_VISUALS: Record<string, InsightVisual> = {
  ...VISUALS,
  ...RBC_VISUALS,
  ...MOLSON_COORS_VISUALS,
  ...LULULEMON_VISUALS,
  ...TIM_HORTONS_VISUALS,
};

// Fallback for any unmapped insight (Lincoln, dealership network, market radar):
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
