import { subDays, format } from 'date-fns';
import type {
  ChannelId, Campaign,
  DailyMetrics, AggregatedKPIs, KPIDelta, KPIKey,
  NewsItem, NewsTag, NewsUrgency,
  Insight, InsightActionStep,
  Anomaly,
  GeoId,
  EnterpriseId,
} from '@/types';
import { CHANNEL_LABELS } from '@/types';
import { type CampaignDef } from './clients/_shared';
import { RBC_CAMPAIGN_DEFS, RBC_INSIGHTS, RBC_NEWS, RBC_RADAR_PINS } from './clients/rbc';
import { MOLSON_COORS_CAMPAIGN_DEFS, MOLSON_COORS_INSIGHTS, MOLSON_COORS_NEWS, MOLSON_COORS_RADAR_PINS } from './clients/molson-coors';
import { LULULEMON_CAMPAIGN_DEFS, LULULEMON_INSIGHTS, LULULEMON_NEWS, LULULEMON_RADAR_PINS } from './clients/lululemon';
import { TIM_HORTONS_CAMPAIGN_DEFS, TIM_HORTONS_INSIGHTS, TIM_HORTONS_NEWS, TIM_HORTONS_RADAR_PINS } from './clients/tim-hortons';

// ===== Seedable PRNG (Mulberry32) =====
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);

function randBetween(min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5);
  return shuffled.slice(0, n);
}

function gaussian(): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ===== Constants =====
const END_DATE = new Date('2026-05-08');
const DATA_DAYS = 180;
const START_DATE = subDays(END_DATE, DATA_DAYS - 1);
const ALL_GEOS: GeoId[] = ['national', 'bc', 'alberta', 'ontario', 'quebec', 'atlantic'];
const ALL_CHANNELS: ChannelId[] = ['instagram', 'facebook', 'tiktok', 'google-search', 'ttd', 'ctv', 'spotify', 'linkedin', 'ooh'];

// ===== Channel Profiles =====
// Tuned so Tier 1 campaigns aggregate to roughly $218 CPL (per-campaign cplCalibration adjusts off this baseline).
interface ChannelProfile {
  baseSpend: number;
  cpmRange: [number, number];
  ctrRange: [number, number];
  cvrRange: [number, number];
  cpcRange: [number, number];
  videoViewRate: number;
  videoCompletionRate: number;
  engagementMultiplier: number;
  volatility: number;
}

const CHANNEL_PROFILES: Record<ChannelId, ChannelProfile> = {
  'google-search': { baseSpend: 2085, cpmRange: [18, 38], ctrRange: [3, 7],     cvrRange: [0.36, 0.84], cpcRange: [3, 7],   videoViewRate: 0,   videoCompletionRate: 0,   engagementMultiplier: 0.5, volatility: 0.15 },
  'facebook':      { baseSpend: 1730, cpmRange: [10, 22], ctrRange: [0.9, 2.0], cvrRange: [0.24, 0.56], cpcRange: [1.2, 3.5], videoViewRate: 0.3, videoCompletionRate: 0.25, engagementMultiplier: 1.2, volatility: 0.12 },
  'instagram':     { baseSpend: 1535, cpmRange: [10, 24], ctrRange: [0.8, 1.8], cvrRange: [0.21, 0.49], cpcRange: [1.5, 4],   videoViewRate: 0.4, videoCompletionRate: 0.3,  engagementMultiplier: 1.5, volatility: 0.10 },
  'tiktok':        { baseSpend: 1185, cpmRange: [6, 18],  ctrRange: [0.6, 1.6], cvrRange: [0.15, 0.35], cpcRange: [0.8, 2.5], videoViewRate: 0.8, videoCompletionRate: 0.15, engagementMultiplier: 2.0, volatility: 0.25 },
  'ttd':           { baseSpend: 2570, cpmRange: [6, 18],  ctrRange: [0.2, 0.8], cvrRange: [0.30, 0.70], cpcRange: [1.5, 5],   videoViewRate: 0.2, videoCompletionRate: 0.2,  engagementMultiplier: 0.3, volatility: 0.08 },
  'ctv':           { baseSpend: 3200, cpmRange: [22, 45], ctrRange: [0.15, 0.5],cvrRange: [0.09, 0.21], cpcRange: [4, 10],    videoViewRate: 0.9, videoCompletionRate: 0.7,  engagementMultiplier: 0.2, volatility: 0.06 },
  'spotify':       { baseSpend: 1400, cpmRange: [12, 28], ctrRange: [0.4, 1.2], cvrRange: [0.09, 0.21], cpcRange: [2, 5],     videoViewRate: 0.0, videoCompletionRate: 0.0,  engagementMultiplier: 0.4, volatility: 0.10 },
  'linkedin':      { baseSpend: 1800, cpmRange: [15, 35], ctrRange: [0.5, 1.5], cvrRange: [0.45, 1.05], cpcRange: [3, 8],     videoViewRate: 0.15, videoCompletionRate: 0.2, engagementMultiplier: 0.6, volatility: 0.10 },
  'ooh':           { baseSpend: 2200, cpmRange: [8, 20],  ctrRange: [0.1, 0.3], cvrRange: [0.048, 0.112], cpcRange: [5, 15],  videoViewRate: 0,   videoCompletionRate: 0,   engagementMultiplier: 0.1, volatility: 0.05 },
};

// ===== Geo multipliers (spend weighting per region) =====
const GEO_MULTIPLIERS: Record<GeoId, number> = {
  'national': 1.4,
  'ontario':  1.3,
  'quebec':   1.1,
  'bc':       1.15,
  'alberta':  1.0,
  'atlantic': 0.7,
};

// ===== Province-level distribution (Ford dealers ~554 across Canada) =====
export const PROVINCE_BRANCH_WEIGHT: Record<string, number> = {
  'ON': 0.380, 'QC': 0.220, 'AB': 0.140, 'BC': 0.130,
  'NS': 0.040, 'NB': 0.035, 'MB': 0.025, 'SK': 0.020,
  'NL': 0.007, 'PE': 0.003,
};

// ===== Geo region → Canadian provinces mapping =====
export const GEO_TO_PROVINCES: Record<GeoId, string[]> = {
  'national': ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL'],
  'bc':       ['BC'],
  'alberta':  ['AB'],
  'ontario':  ['ON'],
  'quebec':   ['QC'],
  'atlantic': ['NB', 'NS', 'PE', 'NL'],
};

// ===== Campaign definitions =====
// ~22 hand-authored campaigns with budget targets:
//   Tier 1 ~$61.2M, Tier 2 ~$41.8M, Tier 3 ~$21.4M, total ~$124M
// cplCalibration directly scales final lead count to land specific CPL outcomes.
//   1.0 = Tier 1 baseline (~$218 CPL)
//   <1 = worse CPL (Ontario Regional 0.73 → ~$298)
//   >1 = better CPL (BC Regional 1.47 → ~$148, Transit 2.32 → ~$94)
// CampaignDef is defined in ./clients/_shared and imported above so the
// cross-industry client modules can share the exact shape.

const CAMPAIGN_DEFS: CampaignDef[] = [
  // ── TIER 1 — NATIONAL (Mindshare AOR) — ~$61.2M ──
  // cplCalibration tuned so Tier 1 aggregate ≈ $218 CPL; BC Regional ≈ $148; Ontario Regional ≈ $298; Transit ≈ $94
  { id: 'ford-lightning-launch-hero', name: 'F-150 Lightning Launch — National Hero',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'lightning',
    audiences: ['truck-intenders', 'ev-considerers', 'conquest-tesla'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ttd', 'google-search', 'instagram', 'ooh'],
    geos: ['national'], budgetMultiplier: 1.85, plannedBudget: 12_400_000,
    revPerConvRange: [42_000, 68_000], cvrModifier: 1.05, cplCalibration: 0.40, revTrend: 0.0006 },

  { id: 'ford-f150-built-tough', name: 'F-150 Built Ford Tough — Spring',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'f150',
    audiences: ['truck-intenders', 'fleet-commercial'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ttd', 'google-search', 'ooh'],
    geos: ['national'], budgetMultiplier: 1.55, plannedBudget: 8_800_000,
    revPerConvRange: [38_000, 58_000], cvrModifier: 1.0, cplCalibration: 0.40, revTrend: 0.0003 },

  { id: 'ford-mach-e-defense', name: 'Mach-E vs Equinox Defense',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'mach-e',
    audiences: ['ev-considerers', 'conquest-gm', 'conquest-hyundai-kia'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'tiktok', 'ttd'],
    geos: ['national'], budgetMultiplier: 1.20, plannedBudget: 5_400_000,
    revPerConvRange: [42_000, 58_000], cvrModifier: 0.95, cplCalibration: 0.40, revTrend: -0.0002 },

  { id: 'ford-bronco-adventure-national', name: 'Bronco Adventure — National',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'bronco',
    audiences: ['adventure-lifestyle'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'instagram', 'tiktok', 'ttd'],
    geos: ['national'], budgetMultiplier: 1.35, plannedBudget: 6_800_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 1.05, cplCalibration: 0.40, revTrend: 0.0004 },

  { id: 'ford-explorer-family', name: 'Explorer Family — Conquest from RAV4',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'explorer',
    audiences: ['family-suv-shoppers', 'conquest-toyota'],
    objective: 'consideration', status: 'live',
    channels: ['ctv', 'google-search', 'instagram', 'facebook'],
    geos: ['national'], budgetMultiplier: 1.40, plannedBudget: 7_200_000,
    revPerConvRange: [44_000, 60_000], cvrModifier: 1.0, cplCalibration: 0.40, revTrend: 0.0002 },

  { id: 'ford-escape-phev-izev', name: 'Escape PHEV — iZEV Opportunity',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'escape-phev',
    audiences: ['phev-shoppers', 'family-suv-shoppers', 'conquest-toyota'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'ttd'],
    geos: ['national'], budgetMultiplier: 0.90, plannedBudget: 3_400_000,
    revPerConvRange: [36_000, 48_000], cvrModifier: 1.10, cplCalibration: 0.42, revTrend: 0.0005 },

  { id: 'ford-transit-fleet', name: 'Transit Fleet & Commercial',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'transit',
    audiences: ['fleet-commercial'],
    objective: 'conversion', status: 'live',
    channels: ['linkedin', 'google-search', 'ttd'],
    geos: ['national'], budgetMultiplier: 1.05, plannedBudget: 4_200_000,
    revPerConvRange: [48_000, 72_000], cvrModifier: 1.20, cplCalibration: 0.93, revTrend: 0.0006 },

  { id: 'ford-edge-mature', name: 'Edge — Mature Nameplate Maintenance',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'edge',
    audiences: ['family-suv-shoppers'],
    objective: 'awareness', status: 'live',
    channels: ['google-search', 'facebook', 'ttd'],
    geos: ['national'], budgetMultiplier: 0.80, plannedBudget: 2_800_000,
    revPerConvRange: [34_000, 46_000], cvrModifier: 0.85, cplCalibration: 0.34, revTrend: -0.0004 },

  { id: 'ford-brand-q2', name: 'Built Ford Tough — Master Brand Q2',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'mindshare', productLine: 'f150',
    audiences: ['truck-intenders'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ooh', 'spotify'],
    geos: ['national'], budgetMultiplier: 1.65, plannedBudget: 10_200_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 0.90, cplCalibration: 0.38, revTrend: 0.0001 },

  // ── TIER 2 — REGIONAL — ~$41.8M ──

  // BC Regional — best-in-class CPL ($148) — Scenario 2 hero
  { id: 'ford-lightning-bc-regional', name: 'Lightning Regional — BC',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'bc-regional', productLine: 'lightning',
    audiences: ['truck-intenders', 'ev-considerers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook'],
    geos: ['bc'], budgetMultiplier: 0.85, plannedBudget: 2_400_000,
    revPerConvRange: [42_000, 64_000], cvrModifier: 1.20, cplCalibration: 0.59, revTrend: 0.0006 },

  { id: 'ford-bronco-bc-regional', name: 'Bronco Adventure — BC Regional',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'bc-regional', productLine: 'bronco',
    audiences: ['adventure-lifestyle'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'google-search'],
    geos: ['bc'], budgetMultiplier: 0.75, plannedBudget: 1_800_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 1.15, cplCalibration: 0.59, revTrend: 0.0005 },

  { id: 'ford-f150-bc-regional', name: 'F-150 — BC Regional',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'bc-regional', productLine: 'f150',
    audiences: ['truck-intenders'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['bc'], budgetMultiplier: 0.95, plannedBudget: 3_200_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 1.20, cplCalibration: 0.59, revTrend: 0.0004 },

  // Ontario Regional — anomaly market ($298 CPL) — Scenario 1 + 2
  { id: 'ford-lightning-on-regional', name: 'Lightning Regional — Ontario',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'ontario-regional', productLine: 'lightning',
    audiences: ['truck-intenders', 'ev-considerers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'spotify'],
    geos: ['ontario'], budgetMultiplier: 1.05, plannedBudget: 3_400_000,
    revPerConvRange: [42_000, 64_000], cvrModifier: 0.85, cplCalibration: 0.29, revTrend: -0.0001 },

  { id: 'ford-f150-on-regional', name: 'F-150 — Ontario Regional',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'ontario-regional', productLine: 'f150',
    audiences: ['truck-intenders'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'ttd'],
    geos: ['ontario'], budgetMultiplier: 1.30, plannedBudget: 5_200_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 0.90, cplCalibration: 0.29, revTrend: 0.0001 },

  { id: 'ford-explorer-on-regional', name: 'Explorer — Ontario Regional',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'ontario-regional', productLine: 'explorer',
    audiences: ['family-suv-shoppers'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['ontario'], budgetMultiplier: 0.95, plannedBudget: 2_800_000,
    revPerConvRange: [42_000, 58_000], cvrModifier: 0.85, cplCalibration: 0.29, revTrend: 0 },

  // Alberta Regional — slightly above Tier 1 baseline (~$210)
  { id: 'ford-f150-ab-regional', name: 'F-150 — Alberta Regional',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'alberta-regional', productLine: 'f150',
    audiences: ['truck-intenders', 'fleet-commercial'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['alberta'], budgetMultiplier: 1.00, plannedBudget: 3_600_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 1.05, cplCalibration: 0.42, revTrend: 0.0003 },

  { id: 'ford-bronco-ab-regional', name: 'Bronco — Alberta Regional',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'alberta-regional', productLine: 'bronco',
    audiences: ['adventure-lifestyle'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'facebook'],
    geos: ['alberta'], budgetMultiplier: 0.70, plannedBudget: 1_400_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 1.05, cplCalibration: 0.42, revTrend: 0.0003 },

  // Cossette (Quebec) — at Tier 1 baseline
  { id: 'ford-f150-qc-cossette', name: 'F-150 — Quebec (Cossette)',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'cossette', productLine: 'f150',
    audiences: ['truck-intenders'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'spotify'],
    geos: ['quebec'], budgetMultiplier: 1.05, plannedBudget: 3_800_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 1.0, cplCalibration: 0.40, revTrend: 0.0002 },

  { id: 'ford-escape-qc-cossette', name: 'Escape PHEV — Quebec (Cossette)',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'cossette', productLine: 'escape-phev',
    audiences: ['phev-shoppers'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['quebec'], budgetMultiplier: 0.85, plannedBudget: 2_200_000,
    revPerConvRange: [36_000, 48_000], cvrModifier: 1.05, cplCalibration: 0.42, revTrend: 0.0004 },

  // Atlantic Regional — modestly below Tier 1
  { id: 'ford-f150-at-regional', name: 'F-150 — Atlantic Regional',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'atlantic-regional', productLine: 'f150',
    audiences: ['truck-intenders'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['atlantic'], budgetMultiplier: 0.80, plannedBudget: 1_600_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 0.95, cplCalibration: 0.38, revTrend: 0 },

  // ── TIER 3 — DEALER NETWORK (aggregate) — ~$21.4M ──
  { id: 'ford-dealer-spring-sales', name: 'Dealer Spring Sales Event (Aggregate)',
    enterprise: 'ford-canada', division: 'tier-3', agency: 'dealer-network', productLine: 'f150',
    audiences: ['truck-intenders'],
    objective: 'conversion', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'],
    geos: ['ontario', 'alberta', 'bc', 'quebec', 'atlantic'],
    budgetMultiplier: 1.45, plannedBudget: 12_400_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 0.85, cplCalibration: 0.34, revTrend: 0.0001 },

  { id: 'ford-dealer-lightning-leads', name: 'Dealer Lightning Lead Gen (Aggregate)',
    enterprise: 'ford-canada', division: 'tier-3', agency: 'dealer-network', productLine: 'lightning',
    audiences: ['ev-considerers', 'truck-intenders'],
    objective: 'conversion', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'],
    geos: ['ontario', 'alberta', 'bc', 'quebec'],
    budgetMultiplier: 1.10, plannedBudget: 6_200_000,
    revPerConvRange: [42_000, 64_000], cvrModifier: 0.85, cplCalibration: 0.34, revTrend: 0.0003 },

  { id: 'ford-dealer-suv-shoppers', name: 'Dealer SUV Lead Gen (Aggregate)',
    enterprise: 'ford-canada', division: 'tier-3', agency: 'dealer-network', productLine: 'explorer',
    audiences: ['family-suv-shoppers'],
    objective: 'conversion', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'],
    geos: ['ontario', 'alberta', 'bc'],
    budgetMultiplier: 0.85, plannedBudget: 2_800_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 0.90, cplCalibration: 0.34, revTrend: 0.0002 },

  // ═══════════════════════════════════════════════════════════════════
  // LINCOLN — luxury division (~$34M total) — Hudson Rouge AOR + Cossette Luxury
  // Higher CPL ($340-$580), heavier CTV/OOH/Spotify, conquest from German luxury + Lexus
  // ═══════════════════════════════════════════════════════════════════

  // ── Aviator (mid-size luxury SUV, halo nameplate) ──
  { id: 'lincoln-aviator-quiet-luxury', name: 'Aviator — Quiet Luxury Hero',
    enterprise: 'lincoln', division: 'tier-1', agency: 'hudson-rouge', productLine: 'lincoln-aviator',
    audiences: ['luxury-intenders', 'conquest-bmw', 'conquest-mercedes'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'spotify', 'ooh', 'instagram'],
    geos: ['national'], budgetMultiplier: 1.0, plannedBudget: 5_400_000,
    revPerConvRange: [78_000, 102_000], cvrModifier: 0.88, cplCalibration: 0.18, revTrend: 0.0004 },

  { id: 'lincoln-aviator-conquest-x5', name: 'Aviator vs BMW X5 — Conquest Search',
    enterprise: 'lincoln', division: 'tier-1', agency: 'hudson-rouge', productLine: 'lincoln-aviator',
    audiences: ['conquest-bmw', 'conquest-audi'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'ttd', 'instagram'],
    geos: ['national'], budgetMultiplier: 0.85, plannedBudget: 2_800_000,
    revPerConvRange: [78_000, 102_000], cvrModifier: 0.92, cplCalibration: 0.20, revTrend: 0.0003 },

  // ── Nautilus (volume mid-size luxury SUV) ──
  { id: 'lincoln-nautilus-launch', name: 'Nautilus 2026 — Hybrid Launch',
    enterprise: 'lincoln', division: 'tier-1', agency: 'hudson-rouge', productLine: 'lincoln-nautilus',
    audiences: ['luxury-intenders', 'phev-shoppers', 'conquest-lexus', 'conquest-mercedes'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ttd', 'google-search', 'spotify'],
    geos: ['national'], budgetMultiplier: 1.20, plannedBudget: 6_800_000,
    revPerConvRange: [68_000, 88_000], cvrModifier: 1.0, cplCalibration: 0.22, revTrend: 0.0005 },

  { id: 'lincoln-nautilus-mature', name: 'Nautilus — Mid-funnel Always-On',
    enterprise: 'lincoln', division: 'tier-2', agency: 'cossette-luxury', productLine: 'lincoln-nautilus',
    audiences: ['luxury-intenders', 'lincoln-loyalists'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'facebook'],
    geos: ['ontario', 'quebec', 'bc'], budgetMultiplier: 0.70, plannedBudget: 2_400_000,
    revPerConvRange: [68_000, 88_000], cvrModifier: 1.05, cplCalibration: 0.24, revTrend: 0.0002 },

  // ── Corsair (entry luxury — gateway nameplate) ──
  { id: 'lincoln-corsair-entry-luxury', name: 'Corsair — First-Time Luxury Buyers',
    enterprise: 'lincoln', division: 'tier-1', agency: 'hudson-rouge', productLine: 'lincoln-corsair',
    audiences: ['luxury-intenders', 'conquest-audi', 'conquest-lexus'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'google-search', 'tiktok', 'ttd'],
    geos: ['national'], budgetMultiplier: 0.90, plannedBudget: 3_400_000,
    revPerConvRange: [54_000, 68_000], cvrModifier: 1.10, cplCalibration: 0.28, revTrend: 0.0006 },

  { id: 'lincoln-corsair-quebec-fr', name: 'Corsair — Quebec French-Language',
    enterprise: 'lincoln', division: 'tier-2', agency: 'cossette-luxury', productLine: 'lincoln-corsair',
    audiences: ['luxury-intenders'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'facebook', 'spotify'],
    geos: ['quebec'], budgetMultiplier: 0.65, plannedBudget: 1_800_000,
    revPerConvRange: [54_000, 68_000], cvrModifier: 1.05, cplCalibration: 0.30, revTrend: 0.0004 },

  // ── Navigator (flagship full-size luxury SUV) ──
  { id: 'lincoln-navigator-flagship', name: 'Navigator — Flagship Hero',
    enterprise: 'lincoln', division: 'tier-1', agency: 'hudson-rouge', productLine: 'lincoln-navigator',
    audiences: ['luxury-intenders', 'conquest-mercedes', 'lincoln-loyalists'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ooh', 'spotify', 'instagram'],
    geos: ['national'], budgetMultiplier: 1.30, plannedBudget: 7_200_000,
    revPerConvRange: [108_000, 142_000], cvrModifier: 0.78, cplCalibration: 0.14, revTrend: 0.0003 },

  { id: 'lincoln-navigator-conquest-escalade', name: 'Navigator vs Escalade — Conquest',
    enterprise: 'lincoln', division: 'tier-1', agency: 'hudson-rouge', productLine: 'lincoln-navigator',
    audiences: ['luxury-intenders', 'conquest-bmw'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'ttd', 'linkedin'],
    geos: ['national'], budgetMultiplier: 0.95, plannedBudget: 3_800_000,
    revPerConvRange: [108_000, 142_000], cvrModifier: 0.82, cplCalibration: 0.16, revTrend: 0.0002 },

  // ═══════════════════════════════════════════════════════════════════
  // DEALERSHIP NETWORK — aggregate co-op rollup view (~$42M total)
  // 6 regional rollups representing 890+ dealers' aggregated co-op spend
  // Heavy local Search + Meta retargeting; lower CPL ($95-$180); high local relevance
  // ═══════════════════════════════════════════════════════════════════

  { id: 'dn-bc-coop-aggregate', name: 'BC Dealer Co-op — Aggregate Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-bc-rollup',
    audiences: ['local-shoppers', 'service-loyalists', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['bc'], budgetMultiplier: 1.10, plannedBudget: 6_800_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.25, cplCalibration: 1.40, revTrend: 0.0003 },

  { id: 'dn-ontario-coop-aggregate', name: 'Ontario Dealer Co-op — Aggregate Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-ontario-rollup',
    audiences: ['local-shoppers', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['ontario'], budgetMultiplier: 1.45, plannedBudget: 12_400_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.10, cplCalibration: 0.95, revTrend: 0.0002 },

  { id: 'dn-quebec-coop-aggregate', name: 'Quebec Dealer Co-op — Aggregate Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-quebec-rollup',
    audiences: ['local-shoppers', 'service-loyalists'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['quebec'], budgetMultiplier: 1.15, plannedBudget: 7_400_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.20, cplCalibration: 1.30, revTrend: 0.0004 },

  { id: 'dn-alberta-coop-aggregate', name: 'Alberta Dealer Co-op — Aggregate Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-alberta-rollup',
    audiences: ['local-shoppers', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['alberta'], budgetMultiplier: 1.05, plannedBudget: 5_800_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.15, cplCalibration: 1.10, revTrend: 0.0003 },

  { id: 'dn-atlantic-coop-aggregate', name: 'Atlantic Dealer Co-op — Aggregate Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-atlantic-rollup',
    audiences: ['local-shoppers', 'service-loyalists'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook'],
    geos: ['atlantic'], budgetMultiplier: 0.85, plannedBudget: 3_400_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.05, cplCalibration: 1.00, revTrend: 0.0002 },

  { id: 'dn-prairies-coop-aggregate', name: 'Prairies Dealer Co-op — Aggregate Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-prairies-rollup',
    audiences: ['local-shoppers', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook'],
    geos: ['alberta'], budgetMultiplier: 0.90, plannedBudget: 4_200_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.10, cplCalibration: 1.05, revTrend: 0.0003 },

  // Service & finance overlays (cross-regional)
  { id: 'dn-service-loyalty-national', name: 'Service Loyalty — National Email + Search',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-ontario-rollup',
    audiences: ['service-loyalists'],
    objective: 'retention', status: 'live',
    channels: ['google-search', 'facebook'],
    geos: ['national'], budgetMultiplier: 0.40, plannedBudget: 1_400_000,
    revPerConvRange: [800, 1_400], cvrModifier: 1.80, cplCalibration: 2.20, revTrend: 0.0004 },

  { id: 'dn-finance-rate-deals', name: 'Finance Rate Deals — National Co-op',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'dealer-network', productLine: 'dn-bc-rollup',
    audiences: ['finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['national'], budgetMultiplier: 0.60, plannedBudget: 1_800_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 1.30, cplCalibration: 1.50, revTrend: 0.0002 },

  // ── Cross-industry agency clients (authored in src/lib/clients/*) ──
  ...RBC_CAMPAIGN_DEFS,
  ...MOLSON_COORS_CAMPAIGN_DEFS,
  ...LULULEMON_CAMPAIGN_DEFS,
  ...TIM_HORTONS_CAMPAIGN_DEFS,
];

// ===== Events (anomaly + scenario context) =====
interface DataEvent {
  name: string; dayOffset: number; duration: number;
  geos: GeoId[]; spendMult: number; cvrMult: number; engageMult: number;
}

const DATA_EVENTS: DataEvent[] = [
  { name: 'Spring Truck Buying Season', dayOffset: 80,  duration: 30, geos: ['national'],            spendMult: 1.30, cvrMult: 1.15, engageMult: 1.0 },
  { name: 'GM Silverado EV National Push', dayOffset: 110, duration: 14, geos: ['national'],         spendMult: 1.0,  cvrMult: 0.90, engageMult: 0.85 },
  { name: 'F-150 Lightning Pre-Launch', dayOffset: 130, duration: 30, geos: ['national'],            spendMult: 1.40, cvrMult: 1.20, engageMult: 1.30 },
  { name: 'iZEV Extension Announcement', dayOffset: 165, duration: 7, geos: ['national'],            spendMult: 1.10, cvrMult: 1.15, engageMult: 1.10 },
  { name: 'Tesla Cybertruck Price Cut',  dayOffset: 175, duration: 5, geos: ['national'],            spendMult: 1.0,  cvrMult: 0.85, engageMult: 0.85 },
];

// ===== Data Generation =====
function generateDailyData(campaignDefs: CampaignDef[] = CAMPAIGN_DEFS): Record<string, Record<string, DailyMetrics[]>> {
  const data: Record<string, Record<string, DailyMetrics[]>> = {};

  for (const campaign of campaignDefs) {
    data[campaign.id] = {};
    const geoMult = GEO_MULTIPLIERS[campaign.geos[0]] || 1.0;

    for (const channel of campaign.channels) {
      const profile = CHANNEL_PROFILES[channel];
      const days: DailyMetrics[] = [];

      for (let d = 0; d < DATA_DAYS; d++) {
        const date = format(subDays(END_DATE, DATA_DAYS - 1 - d), 'yyyy-MM-dd');
        const dayOfWeek = new Date(date).getDay();
        const weekendMult = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.75 : 1.0;
        const seasonality = 1 + 0.03 * Math.sin((d / DATA_DAYS) * Math.PI * 4);
        const growthTrend = 0.88 + (d / DATA_DAYS) * 0.24;

        let eventSpendMult = 1, eventCvrMult = 1, eventEngageMult = 1;
        for (const evt of DATA_EVENTS) {
          if (d >= evt.dayOffset && d < evt.dayOffset + evt.duration &&
              evt.geos.some(g => campaign.geos.includes(g) || g === 'national')) {
            eventSpendMult *= evt.spendMult;
            eventCvrMult *= evt.cvrMult;
            eventEngageMult *= evt.engageMult;
          }
        }

        const noise = 1 + gaussian() * profile.volatility;
        const spendBase = profile.baseSpend * campaign.budgetMultiplier * geoMult * weekendMult * seasonality * growthTrend * eventSpendMult * Math.max(0.3, noise);
        const spend = Math.max(10, spendBase);

        const cpm = randBetween(profile.cpmRange[0], profile.cpmRange[1]) * (1 + gaussian() * 0.1);
        const impressions = Math.round((spend / cpm) * 1000);
        const reach = Math.round(impressions * randBetween(0.6, 0.85));

        const ctr = randBetween(profile.ctrRange[0], profile.ctrRange[1]) * Math.max(0.5, 1 + gaussian() * 0.15) / 100;
        const clicks = Math.round(impressions * ctr);

        const lpvRate = randBetween(0.5, 0.8);
        const landingPageViews = Math.round(clicks * lpvRate);

        const cvr = randBetween(profile.cvrRange[0], profile.cvrRange[1]) * campaign.cvrModifier * eventCvrMult * Math.max(0.3, 1 + gaussian() * 0.15) / 100;
        const conversions = Math.max(0, Math.round(clicks * cvr));
        // Apply per-campaign cplCalibration to lead count (higher = better CPL)
        const leadBase = conversions * randBetween(1.5, 3) * campaign.cplCalibration;
        const leads = Math.round(leadBase);

        const dayTrend = 1 + (campaign.revTrend * d);
        const avgOrderValue = randBetween(campaign.revPerConvRange[0], campaign.revPerConvRange[1]);
        const revenue = conversions * avgOrderValue * randBetween(0.85, 1.15) * dayTrend;

        const videoViews3s = Math.round(impressions * profile.videoViewRate * randBetween(0.8, 1.2));
        const videoViewsThruplay = Math.round(videoViews3s * profile.videoCompletionRate * randBetween(0.7, 1.3));

        const engagements = Math.round(impressions * profile.engagementMultiplier * eventEngageMult * randBetween(0.01, 0.04));
        const assistedConversions = Math.round(conversions * randBetween(0.2, 0.5));

        days.push({
          date, spend, impressions, reach, clicks, landingPageViews,
          leads, conversions, revenue, videoViews3s, videoViewsThruplay,
          engagements, assistedConversions,
        });
      }
      data[campaign.id][channel] = days;
    }
  }
  return data;
}

// ===== Aggregation =====
export function aggregateMetrics(dailyData: DailyMetrics[]): AggregatedKPIs {
  if (dailyData.length === 0) {
    return {
      date: '', spend: 0, impressions: 0, reach: 0, clicks: 0, landingPageViews: 0,
      leads: 0, conversions: 0, revenue: 0, videoViews3s: 0, videoViewsThruplay: 0,
      engagements: 0, assistedConversions: 0,
      frequency: 0, ctr: 0, cpc: 0, cpm: 0, lpvRate: 0, cpl: 0, cpa: 0, roas: 0,
      videoCompletionRate: 0, threeSecondViewRate: 0, engagementRate: 0, brandSearchLift: 0, shareOfVoice: 0,
      volatilityScore: 0, anomalyCount: 0, budgetPacing: 0, creativeFatigueIndex: 0,
    };
  }

  const sum = (key: keyof DailyMetrics) => dailyData.reduce((s, d) => s + (d[key] as number), 0);

  const spend = sum('spend');
  const impressions = sum('impressions');
  const reach = sum('reach');
  const clicks = sum('clicks');
  const landingPageViews = sum('landingPageViews');
  const leads = sum('leads');
  const conversions = sum('conversions');
  const revenue = sum('revenue');
  const videoViews3s = sum('videoViews3s');
  const videoViewsThruplay = sum('videoViewsThruplay');
  const engagements = sum('engagements');
  const assistedConversions = sum('assistedConversions');

  const frequency = reach > 0 ? impressions / reach : 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cpc = clicks > 0 ? spend / clicks : 0;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
  const lpvRate = clicks > 0 ? (landingPageViews / clicks) * 100 : 0;
  const cpl = leads > 0 ? spend / leads : 0;
  const cpa = conversions > 0 ? spend / conversions : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  const videoCompletionRate = videoViews3s > 0 ? (videoViewsThruplay / videoViews3s) * 100 : 0;
  const threeSecondViewRate = impressions > 0 ? (videoViews3s / impressions) * 100 : 0;
  const engagementRate = impressions > 0 ? (engagements / impressions) * 100 : 0;

  const spendValues = dailyData.map(d => d.spend);
  const mean = spendValues.reduce((a, b) => a + b, 0) / spendValues.length;
  const stdDev = Math.sqrt(spendValues.reduce((s, v) => s + (v - mean) ** 2, 0) / spendValues.length);
  const volatilityScore = mean > 0 ? (stdDev / mean) * 100 : 0;

  const last7 = dailyData.slice(-7);
  let anomalyCount = 0;
  for (const day of last7) {
    const zScore = mean > 0 ? Math.abs(day.spend - mean) / (stdDev || 1) : 0;
    if (zScore > 2) anomalyCount++;
  }

  const brandSearchLift = 50 + rng() * 50;
  const shareOfVoice = 10 + rng() * 30;
  const budgetPacing = 82 + rng() * 13;
  const creativeFatigueIndex = 20 + rng() * 60;

  return {
    date: dailyData[dailyData.length - 1]?.date ?? '',
    spend, impressions, reach, clicks, landingPageViews, leads, conversions, revenue,
    videoViews3s, videoViewsThruplay, engagements, assistedConversions,
    frequency, ctr, cpc, cpm, lpvRate, cpl, cpa, roas,
    videoCompletionRate, threeSecondViewRate, engagementRate, brandSearchLift, shareOfVoice,
    volatilityScore, anomalyCount, budgetPacing, creativeFatigueIndex,
  };
}

export function computeDeltas(current: AggregatedKPIs, previous: AggregatedKPIs): Record<KPIKey, KPIDelta> {
  const result: Record<string, KPIDelta> = {};
  const keys: KPIKey[] = [
    'spend', 'impressions', 'reach', 'clicks', 'landingPageViews', 'leads', 'conversions', 'revenue',
    'videoViews3s', 'videoViewsThruplay', 'engagements', 'assistedConversions',
    'frequency', 'ctr', 'cpc', 'cpm', 'lpvRate', 'cpl', 'cpa', 'roas',
    'videoCompletionRate', 'threeSecondViewRate', 'engagementRate', 'brandSearchLift', 'shareOfVoice',
    'volatilityScore', 'anomalyCount', 'budgetPacing', 'creativeFatigueIndex',
  ];
  for (const key of keys) {
    const v = current[key] as number;
    const pv = previous[key] as number;
    result[key] = {
      value: v, previousValue: pv,
      delta: v - pv,
      deltaPercent: pv !== 0 ? ((v - pv) / pv) * 100 : 0,
    };
  }
  return result as Record<KPIKey, KPIDelta>;
}

// ===== Anomaly Detection =====
function detectAnomalies(dailyData: Record<string, Record<string, DailyMetrics[]>>, campaignDefs: CampaignDef[] = CAMPAIGN_DEFS): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const metricsToCheck: (keyof DailyMetrics)[] = ['spend', 'clicks', 'conversions', 'leads'];

  for (const campaignDef of campaignDefs) {
    for (const channel of campaignDef.channels) {
      const series = dailyData[campaignDef.id]?.[channel];
      if (!series || series.length < 30) continue;

      for (const metric of metricsToCheck) {
        const values = series.map(d => d[metric] as number);
        const rollingWindow = 30;

        for (let i = rollingWindow; i < values.length; i++) {
          const window = values.slice(i - rollingWindow, i);
          const windowMean = window.reduce((a, b) => a + b, 0) / window.length;
          const windowStd = Math.sqrt(window.reduce((s, v) => s + (v - windowMean) ** 2, 0) / window.length);

          if (windowStd === 0) continue;
          const zScore = Math.abs(values[i] - windowMean) / windowStd;

          if (zScore > 2.5) {
            const severity = zScore > 3.5 ? 'high' : zScore > 3 ? 'medium' : 'low';
            anomalies.push({
              id: `anom-${campaignDef.id}-${channel}-${metric}-${i}`,
              date: series[i].date,
              geo: campaignDef.geos[0],
              division: campaignDef.division,
              productLine: campaignDef.productLine,
              campaign: campaignDef.id,
              channel: channel,
              metric: metric as KPIKey,
              severity,
              zScore: Math.round(zScore * 100) / 100,
              description: `${metric} ${values[i] > windowMean ? 'spike' : 'drop'} in ${campaignDef.name} (${CHANNEL_LABELS[channel]}): z-score ${zScore.toFixed(1)}`,
            });
          }
        }
      }
    }
  }

  return anomalies.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 200);
}

// ===== News Generation =====
const NEWS_SOURCES_BY_TAG: Record<string, string[]> = {
  brand:        ['AdAge', 'Marketing Magazine', 'Strategy Online', 'Globe and Mail', 'BNN Bloomberg'],
  automotive:   ['Automotive News Canada', 'Driving.ca', 'MotorTrend', 'Car and Driver', 'AutoTrader Insights'],
  ev:           ['Electrek', 'InsideEVs', 'Driving.ca EV', 'Reuters', 'Automotive News Canada'],
  launch:       ['Reuters', 'Automotive News Canada', 'Globe and Mail', 'BNN Bloomberg'],
  izev:         ['Transport Canada', 'BNN Bloomberg', 'Globe and Mail', 'CBC News'],
  social:       ['Reddit r/cars', 'Reddit r/electricvehicles', 'TikTok #CarTok', 'X/Twitter Auto', 'Reddit r/Ford'],
  sports:       ['TSN', 'Sportsnet', 'AdAge', 'The Athletic'],
  sponsorships: ['TSN', 'AdAge', 'Marketing Magazine', 'Strategy Online'],
  partnerships: ['Reuters', 'Bloomberg', 'TechCrunch', 'Globe and Mail', 'BNN Bloomberg'],
  competitors:  ['Reuters', 'Automotive News Canada', 'Bloomberg', 'Driving.ca', 'Electrek'],
  macro:        ['Statistics Canada', 'Bank of Canada', 'Globe and Mail', 'BNN Bloomberg'],
};

interface NewsTemplate {
  title: string;
  tags: NewsTag[];
  urgency: NewsUrgency;
  summary: string;
  whyItMatters: string;
  competitor?: string;
}

function generateNews(): NewsItem[] {
  const items: NewsItem[] = [];

  // ── PINNED — top of feed, hand-authored ──
  const pinnedItems: NewsItem[] = [
    {
      id: 'news-tesla-cybertruck-cut',
      title: 'Tesla Cuts Cybertruck Base Pricing by ~$8,400 in Canada — Direct Pressure on F-150 Lightning',
      source: 'Reuters Canada',
      date: '2026-05-08',
      tags: ['competitors', 'ev'],
      urgency: 'high',
      competitor: 'Tesla',
      regions: ['national'],
      summary: 'Tesla announced a CAD $8,400 reduction in Cybertruck base pricing across Canadian markets effective immediately. The move follows similar US pricing actions and is widely interpreted as direct conquest pressure against F-150 Lightning ahead of Ford\'s Q2 launch window.',
      whyItMatters: 'With 23 days remaining in the Lightning launch window, STRATIS detected this pricing move and, in the days after, observed a measurable rise in Lightning-vs-Cybertruck comparison-shopping search — reported as a correlation, not a causal claim. See the linked STRATIS signal for the recommended test-scale response.',
      enterprises: ['ford-canada'],
    },
    {
      id: 'news-izev-extension',
      title: 'Federal iZEV Program Extended Through 2027 — Lightning and Escape PHEV Remain Eligible',
      source: 'Transport Canada',
      date: '2026-05-02',
      tags: ['izev', 'macro', 'ev'],
      urgency: 'high',
      regions: ['national'],
      summary: 'Transport Canada confirmed extension of the federal iZEV consumer incentive program through 2027. F-150 Lightning, Mach-E, and Escape PHEV all remain eligible. Mach-E moved from Tier A to Tier B eligibility, reducing rebate by $1,500.',
      whyItMatters: 'Policy tailwind for Lightning and Escape PHEV launch positioning. Mach-E now faces a CAD $1,500 net price disadvantage vs Ioniq 5 in iZEV-driven purchase calculus.',
      enterprises: ['ford-canada'],
    },
    {
      id: 'news-gm-silverado-fleet',
      title: 'GM Confirms Silverado EV Canadian Fleet Push — National CTV Campaign Active',
      source: 'Automotive News Canada',
      date: '2026-05-05',
      tags: ['competitors', 'ev'],
      urgency: 'high',
      competitor: 'GM',
      regions: ['national'],
      summary: 'GM Canada confirmed an expanded Silverado EV national push with focus on fleet conquest and a national CTV campaign that began this week. Estimated media weight is $12M over 8 weeks.',
      whyItMatters: 'Silverado EV is the most institutional competitive threat to F-150 Lightning. The fleet push targets Transit\'s adjacent audience as well. Watch for SOV compression in CTV and Search.',
      enterprises: ['ford-canada'],
    },
  ];

  items.push(...pinnedItems);

  // ── PROCEDURAL templates — Ford automotive landscape (Ford Canada relevance audited per item) ──
  const templates: NewsTemplate[] = [
    // ════════════════════════════════════════════
    // TESLA WATCH — deep competitive coverage
    // ════════════════════════════════════════════
    { title: 'Tesla Supercharger Network Opens to Lightning and Mach-E in Canada — Ford Charging Network Plus Live',
      tags: ['competitors', 'ev'], urgency: 'high', competitor: 'Tesla',
      summary: 'Tesla confirmed full Supercharger access for F-150 Lightning and Mustang Mach-E owners across 240+ Canadian Supercharger locations effective May 1. Ford Charging Network Plus integration is fully operational with FordPass billing.',
      whyItMatters: 'This neutralizes Tesla\'s most-cited differentiator — charging network — and removes a key barrier for Lightning conquest from Cybertruck and Model Y considerers. Update Lightning launch creative to lead with "now charges at every Supercharger across Canada."' },
    { title: 'Tesla Q1 Earnings Miss — Marketing Pulse Pivots Away From Cybertruck Toward Model Y Refresh',
      tags: ['competitors'], urgency: 'high', competitor: 'Tesla',
      summary: 'Tesla Q1 earnings missed analyst estimates by 8%, with Cybertruck Canadian deliveries below internal targets. Tesla executives signaled marketing reallocation toward Model Y refresh and away from Cybertruck launch programs.',
      whyItMatters: 'Reduced Tesla pressure on Cybertruck creates a 60–90 day window for Lightning to consolidate truck conquest. Increase Lightning Tier 1 CTV weight while Tesla recedes from the truck conversation.' },
    { title: 'Tesla Model Y Refresh Spotted in Canadian Test Markets — Mach-E Q3 Defense Window Tightening',
      tags: ['competitors', 'ev'], urgency: 'medium', competitor: 'Tesla',
      summary: 'Tesla Model Y refresh units have been spotted at Canadian dealer prep facilities, suggesting Q3 launch timing. Marketing teaser activity expected to intensify through summer with focus on Toronto and Vancouver markets.',
      whyItMatters: 'Y refresh will draw consideration share from Mach-E in upper-trim premium audiences. Schedule Mach-E Q3 defense brief with Mindshare ahead of Tesla teaser cycle. Conquest — Tesla overlay essential.' },
    { title: 'Tesla Insurance Canada Launches in BC and Ontario — Direct Ford Motor Credit Concern',
      tags: ['competitors'], urgency: 'medium', competitor: 'Tesla',
      summary: 'Tesla Insurance opened to Canadian customers in BC and Ontario, offering integrated insurance with telematics-linked pricing. Quotes 18–22% below market average for low-mileage drivers.',
      whyItMatters: 'Tesla\'s vertical integration of insurance creates an ownership-cost advantage Ford Motor Credit cannot fully match. Counter with competitive Ford Motor Credit financing rate messaging in BC and Ontario, plus emphasize dealer service network.' },
    { title: 'Elon Musk Canadian Content Backlash — Tesla Brand Sentiment Down 12% in Quebec',
      tags: ['competitors', 'social'], urgency: 'medium', competitor: 'Tesla',
      summary: 'Quebec brand tracking shows Tesla brand consideration down 12% over 60 days following multiple high-profile Musk political statements. Younger French-speaking buyers showing strongest sentiment shifts.',
      whyItMatters: 'Material conquest opportunity in Quebec (Cossette region). Lightning and Mach-E creative should subtly emphasize "Built in North America" / "Canadian-made" positioning vs Tesla in QC media. Conquest — Tesla activation in Cossette plan.' },
    { title: 'Tesla Service Center Wait Times Hit 14 Days in GTA — Ford Dealer Network Advantage Resurfaces',
      tags: ['competitors'], urgency: 'medium', competitor: 'Tesla',
      summary: 'Tesla service center wait times in the Greater Toronto Area have averaged 14 days for the past month, well above the 3–5 day industry standard. Ford\'s 60+ Ontario dealer service network presents a clear contrast.',
      whyItMatters: 'Service network is a moment-of-truth differentiator. Ontario Regional dealer co-op messaging should highlight "service in days, not weeks." Material conquest message vs Tesla — particularly for Lightning prospects considering long-term ownership.' },
    { title: 'Tesla Cuts Canadian Marketing Headcount — Reduced Paid Spend Expected in CTV and Search',
      tags: ['competitors'], urgency: 'high', competitor: 'Tesla',
      summary: 'Tesla\'s Canadian marketing team reduced by ~40% over the past quarter, with major paid media spending paused on CTV and accelerated only on owned/social channels. Expected SOV impact on auto category in Q2.',
      whyItMatters: 'Tesla SOV reduction in CTV is a directly actionable opening — Lightning launch CTV weight should fill the void on Tier 1 inventory. Coordinate with Mindshare on accelerated buy.' },
    { title: 'Tesla Roadster Canadian Pre-Orders Hit $50M — Halo Drives Cybertruck Cross-Shop',
      tags: ['competitors', 'ev'], urgency: 'low', competitor: 'Tesla',
      summary: 'Tesla Roadster reservations from Canadian customers crossed CAD $50M cumulative, with Tesla noting strong cross-shop interest into Cybertruck. Halo effect partially offsets the recent Cybertruck pricing reduction.',
      whyItMatters: 'Tesla halo remains strong despite tactical missteps. Lightning marketing should focus on practical differentiation (towing, fleet, BlueCruise, Charging Network Plus) rather than fight Tesla on aspirational positioning.' },

    // ════════════════════════════════════════════
    // GM WATCH — deep competitive coverage
    // ════════════════════════════════════════════
    { title: 'Cadillac Lyriq Canadian Launch — $69,995 Starting Price Targets Mach-E GT Buyers',
      tags: ['competitors', 'ev', 'launch'], urgency: 'high', competitor: 'Cadillac',
      summary: 'Cadillac Lyriq Canadian launch confirmed at $69,995 starting MSRP, positioned directly against Mustang Mach-E GT ($72,995). Cadillac dealer activations begin May 15 with national CTV campaign of estimated $6M weight.',
      whyItMatters: 'Lyriq targets the same upper-trim Mach-E buyer segment. Mach-E GT defense should activate before Lyriq dealer arrivals — Conquest — GM audience overlay essential. Coordinate with Mindshare on response media plan.' },
    { title: 'GM Ultium Battery Plant in Ingersoll, Ontario Reaches Q1 Production Milestone',
      tags: ['competitors', 'ev', 'automotive'], urgency: 'medium', competitor: 'GM',
      summary: 'GM\'s Ultium Cells joint venture plant in Ingersoll, Ontario produced its 100,000th battery pack, signaling on-track ramp for Silverado EV, Sierra EV, and Equinox EV production. Local battery production strengthens GM CUSMA compliance position.',
      whyItMatters: 'Local Canadian battery production gives GM a domestic content advantage in iZEV/CUSMA discussions. Ford BlueOval Battery Canadian readiness is the counter-narrative — coordinate with corporate comms on Lightning supply messaging.' },
    { title: 'GMC Sierra EV Canadian Reservations Open — Direct Conquest Threat to F-150 Lightning Pro',
      tags: ['competitors', 'ev', 'launch'], urgency: 'high', competitor: 'GM',
      summary: 'GMC Sierra EV (Denali first edition) opened Canadian reservations at $158K starting MSRP. Strong early interest from premium truck buyers and fleet/commercial accounts.',
      whyItMatters: 'Sierra EV is the institutional fleet competitor to Lightning Pro. Brief Ford Pro fleet sales team on Sierra EV positioning ahead of Q3 customer conversations. Lightning Pro creative should emphasize availability now vs Sierra EV waitlist.' },
    { title: 'GM Brightdrop EV600 Canadian Fleet Pilot — DHL Canada First Customer',
      tags: ['competitors', 'ev'], urgency: 'high', competitor: 'GM',
      summary: 'GM\'s Brightdrop EV600 light-commercial vehicle began Canadian fleet pilots with DHL Canada as first major operator. 200 units allocated to GTA delivery operations.',
      whyItMatters: 'Direct competitor to Ford Pro Transit EV. Transit fleet messaging should pre-empt with reliability data, service network density, and Ford Pro Telematics positioning. Brief LinkedIn Transit campaign team.' },
    { title: 'GM Cruise Layoffs Hit Canadian Office — Autonomous Driving Investment Pulled Back',
      tags: ['competitors'], urgency: 'medium', competitor: 'GM',
      summary: 'GM Cruise eliminated its Canadian engineering office as part of broader autonomous vehicle investment cuts. BlueCruise (Ford\'s autonomous tech) gains relative position in Canadian L2+ autonomy market.',
      whyItMatters: 'BlueCruise positioning is relatively strengthened. Lightning, Mach-E, and Mach-E GT should emphasize BlueCruise as the leading Canadian-tested L2+ system in launch creative. Trust-signal opportunity.' },
    { title: 'Chevrolet Bolt EUV Returns to Canada — $32,995 Sub-Compact EV Aggression',
      tags: ['competitors', 'ev'], urgency: 'medium', competitor: 'Chevrolet',
      summary: 'GM confirmed Bolt EUV return to Canadian market at $32,995 starting MSRP, the lowest-priced EV in Canada. Targets entry-level EV buyers and first-time EV households.',
      whyItMatters: 'Bolt EUV creates pricing pressure in entry-EV segment, indirectly impacting Mach-E and Escape PHEV consideration. Escape PHEV iZEV-net pricing messaging should sharpen value comparison.' },

    // ════════════════════════════════════════════
    // STELLANTIS / RAM / JEEP / DODGE / CHRYSLER WATCH
    // ════════════════════════════════════════════
    { title: 'Ram 1500 REV Production Push Confirmed for 2027 — Stellantis Targets Lightning and Silverado Buyers',
      tags: ['competitors', 'ev', 'launch'], urgency: 'medium', competitor: 'Ram',
      summary: 'Stellantis confirmed accelerated Ram 1500 REV production schedule with first Canadian deliveries projected for early 2027. Marketing positioning emphasizes 500-mile range estimate and standalone fleet financing program.',
      whyItMatters: 'Ram REV is the largest medium-term threat to Lightning. While not yet on market, Ram\'s pre-marketing is already drawing Lightning consideration shoppers into wait-and-see mode. Activate "available now" messaging in Lightning creative.' },
    { title: 'Stellantis Windsor Plant EV Transition — Chrysler Halcyon and Jeep Recon EV by 2027',
      tags: ['competitors', 'ev', 'automotive'], urgency: 'medium', competitor: 'Stellantis',
      summary: 'Stellantis Windsor Assembly Plant confirmed full EV transition with Chrysler Halcyon and Jeep Recon EV scheduled for 2027 ramp. Plant transformation cost: $3.6B.',
      whyItMatters: 'Windsor EV ramp creates additional Canadian battery EV competition. Jeep Recon EV is a direct Bronco threat. Brief Bronco team on Recon positioning ahead of 2027.' },
    { title: 'Jeep Wrangler 4xe Canadian Q1 Sales — Strongest PHEV Quarter in Brand History',
      tags: ['competitors', 'ev'], urgency: 'high', competitor: 'Jeep',
      summary: 'Wrangler 4xe Canadian Q1 sales reached 4,200 units, the strongest PHEV quarter in Jeep brand history. Adventure Lifestyle audience strongly drawn to PHEV off-road capability.',
      whyItMatters: 'Direct headwind for Bronco. Bronco Adventure creative should emphasize Bronco Wildtrak / Sasquatch package as PHEV-equivalent off-road capability without PHEV maintenance complexity. Activate Conquest creative against Wrangler 4xe.' },
    { title: 'Dodge Charger Daytona EV Canadian Pricing Released — $63,995 for R/T Trim',
      tags: ['competitors', 'ev', 'launch'], urgency: 'medium', competitor: 'Dodge',
      summary: 'Dodge Charger Daytona EV Canadian pricing revealed at $63,995 for R/T trim. Performance EV positioning targets Mach-E GT and Tesla Model 3 Performance buyers.',
      whyItMatters: 'Adjacent EV performance threat. Mach-E GT performance creative should emphasize all-wheel drive and lower 0-60 times. Cross-shop competitive set expanding.' },
    { title: 'Ram ProMaster EV Canadian Fleet Allocation Doubled — Direct Transit Competition',
      tags: ['competitors', 'ev'], urgency: 'high', competitor: 'Ram',
      summary: 'Stellantis doubled Canadian fleet allocation for Ram ProMaster EV in Q2, citing strong demand from delivery and commercial operators. Aggressive fleet pricing announced.',
      whyItMatters: 'ProMaster EV is now a credible Transit fleet competitor. Transit fleet team should adjust competitive positioning vs Ram ProMaster in Q2 fleet RFPs. LinkedIn campaign should reference ProMaster comparison.' },

    // ════════════════════════════════════════════
    // TOYOTA WATCH
    // ════════════════════════════════════════════
    { title: 'Toyota RAV4 Prime Wins Best PHEV in Canada — Direct Pressure on Escape PHEV and Explorer',
      tags: ['competitors', 'launch'], urgency: 'medium', competitor: 'Toyota',
      summary: 'Driving.ca named Toyota RAV4 Prime its 2026 Best PHEV winner. The award cites real-world all-electric range and resale value. Toyota responded with a $4M paid amplification campaign.',
      whyItMatters: 'RAV4 Prime award amplification will directly compress Explorer family-SUV consideration and Escape PHEV intent. Conquest — Toyota creative should be elevated this quarter across Search and Meta.' },
    { title: 'Toyota Tacoma Hybrid Canadian Launch — Truck Intender Audience at Risk',
      tags: ['competitors', 'launch'], urgency: 'medium', competitor: 'Toyota',
      summary: 'Toyota Tacoma Hybrid launched in Canada with $48,995 starting MSRP. Targets mid-size truck market but pulls consideration from full-size truck buyers seeking efficiency.',
      whyItMatters: 'Tacoma Hybrid creates secondary pressure on F-150 truck intender funnel. F-150 messaging should emphasize full-size capability, payload, and towing differentiation in Tacoma cross-shop creative.' },
    { title: 'Toyota Cambridge Ontario Plant Hybrid Production Reaches 350K Annual Run-Rate',
      tags: ['competitors', 'automotive'], urgency: 'low', competitor: 'Toyota',
      summary: 'Toyota Motor Manufacturing Canada (Cambridge, Ontario) produced its 350,000th vehicle of the fiscal year, including RAV4 Hybrid, Lexus NX, and RAV4 Prime.',
      whyItMatters: 'Local Ontario Toyota production strengthens "made in Ontario" narrative — direct concern for Ford Oakville heritage messaging. Brand Q2 campaign should reinforce Ford\'s deeper Canadian manufacturing footprint and Ontario job count.' },
    { title: 'Toyota Crown Signia Canadian Order Books Open — RAV4 Prime Retention Tool',
      tags: ['competitors', 'launch'], urgency: 'medium', competitor: 'Toyota',
      summary: 'Toyota Crown Signia (premium hybrid wagon) opened Canadian order books, positioned as an upgrade path for RAV4 Prime customers reaching renewal cycle.',
      whyItMatters: 'Toyota retention strategy locks in RAV4 Prime customers — closes one Explorer conquest path. Explorer Family creative should target RAV4 Prime cross-shoppers BEFORE Crown Signia retention activates.' },
    { title: 'Toyota bZ4X Canadian Sales Q1 — Underperforming vs Mach-E and Ioniq 5',
      tags: ['competitors', 'ev'], urgency: 'low', competitor: 'Toyota',
      summary: 'Toyota bZ4X Q1 Canadian registrations of 1,100 units lag Mach-E (3,400) and Ioniq 5 (3,800). Toyota considering pricing repositioning for Q3.',
      whyItMatters: 'bZ4X weakness reduces immediate Toyota EV pressure but expect aggressive Q3 pricing response. Mach-E should consolidate position now while bZ4X is on the back foot.' },

    // ════════════════════════════════════════════
    // HYUNDAI / KIA / GENESIS WATCH
    // ════════════════════════════════════════════
    { title: 'Hyundai Ioniq 5 Outsells Mach-E in Q1 Canadian Market — Aggressive Pricing Cited',
      tags: ['competitors', 'ev'], urgency: 'high', competitor: 'Hyundai',
      summary: 'Q1 Canadian registration data shows Hyundai Ioniq 5 outselling Mustang Mach-E for the first time, with Hyundai citing iZEV-aligned pricing and strong Korean brand momentum.',
      whyItMatters: 'Mach-E SOV compression now showing up in registration data. Defense campaign against Equinox and Ioniq must be activated now, not at quarter end. Mach-E refresh creative needs accelerated rollout.' },
    { title: 'Kia EV9 Canadian Launch — $59,995 Starting Price, 7-Seat Family SUV',
      tags: ['competitors', 'ev', 'launch'], urgency: 'high', competitor: 'Kia',
      summary: 'Kia EV9 Canadian launch at $59,995 starting MSRP positions as a 7-seat family SUV EV. Direct Explorer family-SUV cross-shop threat with national TV launch.',
      whyItMatters: 'EV9 is a major Family SUV cross-shop threat to Explorer. Explorer family creative needs immediate response highlighting Explorer\'s 3rd row, towing rating, and Ford Co-Pilot 360 advantages.' },
    { title: 'Genesis GV60 Canadian Launch — Premium EV Crossover Direct Mach-E GT Threat',
      tags: ['competitors', 'ev', 'launch'], urgency: 'medium', competitor: 'Genesis',
      summary: 'Genesis GV60 Performance trim launched in Canada at $74,995. Hyundai Motor Group\'s premium EV play targets Mach-E GT, Tesla Model Y Performance, and BMW iX1 buyers.',
      whyItMatters: 'Premium EV competitive set expanding. Mach-E GT defense weight needed in luxury EV-considerer audiences. Conquest — Hyundai/Kia activation across Tier 1 Search.' },
    { title: 'Hyundai Santa Cruz Pickup Q1 Canadian Sales — 3,800 Units, Crossover Pickup Niche Confirmed',
      tags: ['competitors', 'automotive'], urgency: 'medium', competitor: 'Hyundai',
      summary: 'Hyundai Santa Cruz Q1 Canadian sales reached 3,800 units, confirming demand for crossover pickup segment. Targets first-time truck buyers without full-size commitment.',
      whyItMatters: 'Santa Cruz creates secondary pressure on F-150 truck intender funnel — particularly first-time truck buyers. F-150 entry-level XLT trim messaging should address this in Truck Intender Search.' },
    { title: 'Kia EV6 GT Canadian Pricing Drop — $9,000 Reduction to $69,995',
      tags: ['competitors', 'ev'], urgency: 'high', competitor: 'Kia',
      summary: 'Kia announced a $9,000 price reduction on EV6 GT to $69,995 in Canada effective immediately. Aggressive move to recapture Q2 EV consideration share.',
      whyItMatters: 'Kia pricing moves directly compress Mach-E GT value position. Conquest — Hyundai/Kia audience activation should accelerate; consider counter-pricing or rebate via Ford Motor Credit on Mach-E GT.' },

    // ════════════════════════════════════════════
    // HONDA WATCH
    // ════════════════════════════════════════════
    { title: 'Honda CR-V Hybrid Strong Loyalty Numbers in Q1 — Edge and Explorer Defection Risk',
      tags: ['competitors'], urgency: 'low', competitor: 'Honda',
      summary: 'Honda CR-V Hybrid posted 87% Canadian loyalty rate in Q1, the highest in family-SUV category. Edge and Explorer cross-shoppers continue to defect to Honda where price-parity is achievable.',
      whyItMatters: 'Edge maintenance budget is already under review. Honda data reinforces the case to redirect investment toward Explorer and Escape PHEV defense.' },
    { title: 'Honda Prologue Canadian Launch — Honda\'s First EV in Canada at $61,995',
      tags: ['competitors', 'ev', 'launch'], urgency: 'high', competitor: 'Honda',
      summary: 'Honda Prologue (Honda\'s first EV, built on GM Ultium platform) launched in Canada at $61,995 starting MSRP. Strong Honda dealer network distribution gives quick scale.',
      whyItMatters: 'Honda\'s brand loyalty (87% CR-V Hybrid) translating into EV consideration is a Mach-E and Escape PHEV concern. Activate Honda conquest audience overlays in Mach-E creative across Search and Meta.' },
    { title: 'Honda Alliston Plant EV Transition Confirmed — CR-V EV and HR-V EV by 2028',
      tags: ['competitors', 'ev', 'automotive'], urgency: 'medium', competitor: 'Honda',
      summary: 'Honda confirmed full EV transition for its Alliston, Ontario plant by 2028, including CR-V EV and HR-V EV production. $15B investment commitment.',
      whyItMatters: 'Honda\'s local Ontario EV ramp will reshape family-SUV competitive set in 2027–2028. Long-term Explorer and Edge strategy must factor in Honda EV positioning. Brief brand strategy team.' },

    // ════════════════════════════════════════════
    // CORPORATE PARTNERSHIPS — Ford strategic alliances
    // ════════════════════════════════════════════
    { title: 'Ford-SK On Joint Venture BlueOval Battery Plant — Canadian Production Milestone',
      tags: ['partnerships', 'brand', 'ev'], urgency: 'high',
      summary: 'BlueOval Battery (Ford-SK On JV) reached 50,000-pack production milestone for North American Lightning supply. Canadian dealer allocation accelerates as a result.',
      whyItMatters: 'Lightning supply constraints easing — pre-order pacing should accelerate. Update Lightning launch creative to address inventory availability and "ships in 8 weeks" timing.' },
    { title: 'Ford-Google Cloud Partnership Expansion — Canadian Dealer Sync 4 AI Rollout',
      tags: ['partnerships', 'brand'], urgency: 'medium',
      summary: 'Ford and Google announced expanded Sync 4 AI rollout to all Canadian Ford dealers by Q3 2026. Includes dealer-floor AI, customer service automation, and CRM integration.',
      whyItMatters: 'Dealer experience modernization advantage vs GM and Stellantis. Dealer co-op brand messaging can now lean on tech sophistication. Brief dealer council on talking points.' },
    { title: 'Ford Pro Charging-Suncor Petro-Canada Partnership — 600 New Charging Stations Across Canada',
      tags: ['partnerships', 'ev', 'launch'], urgency: 'high',
      summary: 'Ford Pro Charging and Suncor Petro-Canada announced expansion partnership for 600 additional fast-charging stations across Canada by end of 2026. Lightning, Mach-E, and Escape PHEV owners get integrated FordPass billing.',
      whyItMatters: 'Charging convenience is the #1 EV adoption barrier. This solves it directly for Ford EVs. Update Lightning launch creative to emphasize "1 in 4 fuel stations is now a Ford charging station." Material conquest message.' },
    { title: 'Ford-Microsoft AI Partnership — Predictive Maintenance for Transit and F-150 Pro',
      tags: ['partnerships', 'brand'], urgency: 'medium',
      summary: 'Ford and Microsoft announced expanded AI partnership for predictive maintenance, fleet optimization, and Ford Pro Telematics. Beta program with 50 Canadian fleet operators begins June 1.',
      whyItMatters: 'Strengthens Ford Pro fleet differentiation vs GM Brightdrop, Tesla Semi, and Ram ProMaster. Brief Transit fleet team on partnership talking points for LinkedIn campaign.' },
    { title: 'Ford-ADT Security Partnership — Vehicle Theft Prevention Integrated Into FordPass',
      tags: ['partnerships'], urgency: 'medium',
      summary: 'Ford announced an integration partnership with ADT Canada for advanced vehicle theft prevention. Bronco, F-150, and Lightning will get integrated ADT alerts via FordPass app.',
      whyItMatters: 'Vehicle theft is a hot-button issue in Canadian media (especially GTA). ADT integration is a credible differentiator for F-150, Bronco, and Lightning theft protection messaging in Ontario Regional creative.' },
    { title: 'Ford Apple CarPlay Ultra Integration — First North American Brand With Full Implementation',
      tags: ['partnerships', 'launch', 'brand'], urgency: 'medium',
      summary: 'Ford confirmed full Apple CarPlay Ultra integration for 2026 model year vehicles. F-150, Lightning, Mustang Mach-E, and Bronco models get the upgrade. Ford is the first North American brand with full CarPlay Ultra.',
      whyItMatters: 'Apple-first audiences (especially in BC and ON) gain a tech-forward reason to choose Ford. Update Mach-E and Lightning creative to lead with CarPlay Ultra in tech-buyer audience targeting.' },

    // ════════════════════════════════════════════
    // EV / Launch — Ford direct
    // ════════════════════════════════════════════
    { title: 'F-150 Lightning Pre-Order Pacing Beats Plan by 28% — Strongest Q2 Indicator Since Mach-E Launch',
      tags: ['launch', 'ev', 'brand'], urgency: 'high',
      summary: 'F-150 Lightning pre-order pacing across Canadian dealer network is running 28% above plan with three weeks remaining to launch window. Strong demand signals across Ontario, BC, and Alberta.',
      whyItMatters: 'Strong pre-order pacing reinforces the Lightning launch-window signals STRATIS is tracking, including the Tesla Cybertruck comparison-search shift. Supports holding Lightning launch weight through the window.' },
    { title: 'Canadian EV Market Share Hits 14% in Q1 — Federal iZEV Spend Up 22%',
      tags: ['ev', 'macro', 'izev'], urgency: 'medium',
      summary: 'StatCan reports Canadian battery-electric vehicle market share reached 14% of new vehicle sales in Q1 2026, up from 11% prior year. Federal iZEV program expenditure grew 22% YoY.',
      whyItMatters: 'EV adoption tailwind validates Lightning launch, Mach-E defense, and Escape PHEV positioning. Use this in CMO narrative as macro context.' },
    { title: 'F-150 Lightning Pro Fleet Edition Reservations Open — 800 Canadian Fleet Inquiries in 48 Hours',
      tags: ['ev', 'launch'], urgency: 'high',
      summary: 'Ford Pro opened reservations for the Lightning Pro Fleet Edition with strong early Canadian fleet response — 800 dealer inquiries in the first 48 hours. Ford Pro forecast: 4,000+ Canadian fleet units in year one.',
      whyItMatters: 'Strong Lightning Pro fleet signal. Transit Fleet team can leverage cross-sell into mixed Lightning Pro + Transit fleets. Brief LinkedIn fleet campaign on Lightning Pro availability.' },
    { title: 'Mustang Mach-E GT Performance Edition Canadian Reveal — 400-Mile Range Estimate',
      tags: ['launch', 'ev'], urgency: 'medium',
      summary: 'Mustang Mach-E GT Performance Edition revealed for Canadian market with estimated 400-mile range and 0-100 km/h in 3.4 seconds. Positioned at $89,995.',
      whyItMatters: 'Direct response to Tesla Model Y Performance and Cadillac Lyriq Performance. Premium performance EV consideration set. Conquest — Tesla and GM activations across upper-trim audiences.' },
    { title: 'F-150 Lightning Towing Capacity Validated — 11,000 lbs Real-World RV Test',
      tags: ['launch', 'ev'], urgency: 'medium',
      summary: 'RV Lifestyle Magazine completed independent towing test with F-150 Lightning Pro reaching 11,000 lbs validated tow capacity over 500-mile routes. Real-world capability exceeds Tesla Cybertruck under load.',
      whyItMatters: 'Towing parity vs Tesla and Ram is a critical Lightning differentiator for truck intenders. Surface in Lightning launch creative for Truck Intenders audience. Trust signal for Conquest — Tesla.' },
    { title: 'Bronco Off-Road Series Wins Adventure Lifestyle Award — Strong Engagement on TikTok',
      tags: ['brand', 'launch'], urgency: 'medium',
      summary: 'The Bronco Off-Road series content secured Adventure Magazine\'s 2026 Branded Content Award. TikTok engagement on Bronco-related Ford content up 48% YoY.',
      whyItMatters: 'Bronco audience momentum is real — consider expanding budget reallocation toward TikTok and Instagram Bronco Adventure investments.' },
    { title: 'Bronco Sport Hybrid Confirmed for 2027 — Strategic Retention Tool',
      tags: ['launch'], urgency: 'low',
      summary: 'Ford internal Bronco Sport hybrid variant confirmed for 2027 launch, with PHEV variant under evaluation. Targets adventure-lifestyle buyers wanting hybrid efficiency.',
      whyItMatters: 'Strategic retention against Toyota RAV4 Prime and Jeep Wrangler 4xe in adventure-lifestyle audience. Long-term roadmap context for Bronco brand strategy.' },
    { title: 'Mustang Mach-E Q2 Refresh Lands in Showrooms — Updated Range and Charging Speed',
      tags: ['launch', 'ev', 'brand'], urgency: 'medium',
      summary: 'The Mach-E Q2 mid-cycle refresh has begun arriving at Canadian Ford dealers with updated range estimates and DC fast-charge improvements. Pricing held flat.',
      whyItMatters: 'Refresh is a defensive move against Equinox EV and Ioniq 5. Use refreshed range numbers in Mach-E creative refresh.' },
    { title: 'Escape PHEV Sales Up 33% Year-over-Year — Fuel Price Spike Driving PHEV Interest',
      tags: ['ev', 'launch', 'macro'], urgency: 'medium',
      summary: 'Escape PHEV registrations up 33% YoY in Q1 2026 according to dealer reporting, alongside the recent $1.65/L national average gasoline price spike. PHEV consideration broadly elevated.',
      whyItMatters: 'Escape PHEV is currently underweighted in mix relative to demand signal. iZEV eligibility plus fuel price momentum creates short-term tailwind — scale media weight.' },
    { title: 'F-150 Lightning Pre-Production Test Mile Hits 50 Million in Canadian Conditions',
      tags: ['launch', 'ev'], urgency: 'medium',
      summary: 'F-150 Lightning pre-production fleet completed 50 million test miles in Canadian winter and rural driving conditions. Reliability data exceeds projections.',
      whyItMatters: 'Reliability is the #1 buyer concern for first-time EV buyers in Canadian winter. Update Lightning launch creative with "50M test miles in Canadian conditions" trust signal across Ontario and Alberta media.' },
    { title: 'Transit Most Efficient Lead Generation Channel for Ford Canada in Q1',
      tags: ['brand', 'automotive'], urgency: 'low',
      summary: 'Internal Q1 review identifies Transit as Ford Canada\'s most efficient nameplate by cost-per-lead, driven primarily by LinkedIn fleet/commercial targeting.',
      whyItMatters: 'Transit is structurally efficient and currently underweighted in budget allocation. Consider rebalancing 5–8% of total Tier 1 spend toward Transit fleet.' },

    // ════════════════════════════════════════════
    // iZEV / FEDERAL & PROVINCIAL POLICY
    // ════════════════════════════════════════════
    { title: 'Quebec Roulez Vert EV Subsidy Increased to $7,500 — Mach-E and Escape PHEV Net Price Improvement',
      tags: ['izev', 'macro', 'ev'], urgency: 'high',
      summary: 'Quebec confirmed Roulez Vert provincial EV subsidy increase to $7,500 (from $5,000) effective immediately. Combined with $5,000 federal iZEV, Quebec Mach-E and Escape PHEV buyers see $12,500 in stacked rebates.',
      whyItMatters: 'Massive Quebec Mach-E and Escape PHEV opportunity. Cossette Quebec campaigns must amplify Roulez Vert messaging in Mach-E and Escape PHEV creative immediately.' },
    { title: 'BC ZEV Sales Mandate 2026 Enforcement Begins — 26% New Vehicle Sales Must Be ZEV',
      tags: ['izev', 'macro', 'ev'], urgency: 'high',
      summary: 'BC ZEV mandate enforcement begins June 1, 2026 — 26% of new vehicle sales in BC must be ZEV. Manufacturers face fines for non-compliance.',
      whyItMatters: 'BC dealers under pressure to sell EVs. Lightning and Mach-E BC dealer allocation should accelerate. BC Regional CPL of $148 makes this an efficient market for additional EV media weight.' },
    { title: 'Ontario Provincial EV Subsidy Discussion Gains Traction — May Reinstate by Q4',
      tags: ['izev', 'macro', 'ev'], urgency: 'medium',
      summary: 'Ontario provincial government discussions around reinstating EV subsidies have gained traction in legislature. Implementation possible by Q4 2026.',
      whyItMatters: 'If reinstated, would amplify Lightning and Mach-E positioning in Ontario. Track for Q4 Ontario Regional planning.' },
    { title: 'Federal Critical Minerals Strategy — $4.5B Canadian Battery Supply Chain Investment',
      tags: ['izev', 'macro', 'ev'], urgency: 'medium',
      summary: 'Federal Critical Minerals Strategy announced $4.5B investment in Canadian battery supply chain, including processing and recycling. Ford BlueOval Battery JV cited as benefiting partner.',
      whyItMatters: 'Long-term Lightning supply chain advantage vs Tesla (which sources globally). Brand campaigns can lean into "Canadian-built batteries powering Canadian-built Ford" messaging in Q3.' },

    // ════════════════════════════════════════════
    // MACRO CONSUMER & ECONOMIC
    // ════════════════════════════════════════════
    { title: 'Bank of Canada Holds Rate at 3.75% — Auto Financing Activity Stable',
      tags: ['macro'], urgency: 'low',
      summary: 'The Bank of Canada held its overnight rate at 3.75%, citing balanced inflation and employment data. Auto financing activity remains stable across major lenders.',
      whyItMatters: 'Rate stability is neutral for auto sector — neither tailwind nor headwind. Ford Motor Credit messaging stays consistent.' },
    { title: 'Canadian Gas Prices Hold Above $1.65/L Average — PHEV Consideration Up Across Categories',
      tags: ['macro', 'ev'], urgency: 'medium',
      summary: 'Canadian retail gasoline prices remain above $1.65/L national average for the third consecutive month. PHEV vehicle consideration up across all OEMs.',
      whyItMatters: 'PHEV tailwind reinforces Escape PHEV opportunity. Use fuel price data in Escape PHEV Search and Meta creative.' },
    { title: 'Canadian Auto Loan Delinquency Rates Stable at 1.4% — No Credit Stress Signal',
      tags: ['macro'], urgency: 'low',
      summary: 'Q1 Canadian auto loan delinquency rates held at 1.4%, in line with historical norms. No credit stress signal across Ford Motor Credit, RBC Auto, TD Auto, or other major lenders.',
      whyItMatters: 'Credit environment is healthy — supports Lightning, Mach-E, and Mach-E GT premium pricing. No need to soften pricing in Tier 1 creative.' },
    { title: 'Canadian Used Vehicle Wholesale Index Down 8% YoY — Trade-In Equity Compressed',
      tags: ['macro'], urgency: 'medium',
      summary: 'Canadian used vehicle wholesale index down 8% YoY, with truck and SUV residuals compressing. Trade-in equity for new vehicle buyers is reduced.',
      whyItMatters: 'Lower trade-in equity may slow new vehicle pace but creates Ford Motor Credit lease opportunity as buyers shift from purchase to lease. Update lease-forward messaging in dealer co-op creative.' },
    { title: 'Canadian Vehicle Theft Crisis — F-Series Among Top Targets in Ontario',
      tags: ['automotive', 'macro'], urgency: 'high',
      summary: 'Canadian vehicle theft crisis continues with F-Series trucks among top theft targets in Ontario. Insurance premiums for F-150 in GTA up 18% YoY.',
      whyItMatters: 'Theft is a top-of-mind concern for Ontario truck buyers. F-150 dealer co-op messaging should integrate ADT theft prevention prominently — also surface in Ontario Regional creative.' },

    // ════════════════════════════════════════════
    // BRAND & CORPORATE NARRATIVE
    // ════════════════════════════════════════════
    { title: 'Ford Canada Q1 Financial Results — Record Revenue, Lightning Pre-Order Demand Cited',
      tags: ['brand'], urgency: 'medium',
      summary: 'Ford Canada reported record Q1 revenue of $4.2B, with Q1 vehicle sales up 4.7% YoY. Lightning pre-order demand and Bronco growth cited as key drivers.',
      whyItMatters: 'Strong financial signal supports premium positioning across Ford lineup. Brand campaigns can lean into "Canada\'s #1 selling truck brand" with quantified validation.' },
    { title: 'F-150 Surpasses 47-Year Sales Leadership Mark — Anniversary Campaign in Development',
      tags: ['brand', 'launch'], urgency: 'low',
      summary: 'F-150 confirmed Canada\'s best-selling truck for the 47th consecutive year. Master brand team developing anniversary campaign concepts for Q4.',
      whyItMatters: 'F-150 leadership story is the brand\'s most durable equity asset. Q4 anniversary campaign should integrate with Lightning launch storytelling for unified F-Series narrative.' },
    { title: 'F-150 Lightning Wins 2026 Canadian Black Book Truck of the Year — 12% Brand Search Lift',
      tags: ['brand', 'launch'], urgency: 'high',
      summary: 'F-150 Lightning won the 2026 Canadian Black Book Truck of the Year award. Brand search volume for "F-150 Lightning Canada" up 12% in week following announcement.',
      whyItMatters: 'Authoritative third-party validation. Update Lightning launch creative with award badge across all CTV and Search creative immediately.' },
    { title: 'Ford CEO Canadian Visit — Toronto and Montreal Dealer Council Meetings',
      tags: ['brand'], urgency: 'low',
      summary: 'Ford CEO confirmed Canadian visit including Toronto and Montreal dealer council meetings. Lightning launch and Bronco strategy on agenda.',
      whyItMatters: 'Executive engagement signals corporate priority on Canadian market. Dealer-tier campaigns can leverage CEO-led narrative for Lightning launch activation.' },
    { title: 'Ford Pro Commercial Brand Launch — National Fleet Customer Awareness Campaign',
      tags: ['brand', 'launch'], urgency: 'medium',
      summary: 'Ford Pro standalone commercial brand launch began in Canada with national CTV campaign targeting fleet decision-makers. Total media weight: $8.4M.',
      whyItMatters: 'Ford Pro brand visibility advantage vs GM Pro. Transit Fleet should align messaging with Ford Pro umbrella branding in LinkedIn creative.' },

    // ════════════════════════════════════════════
    // SPORTS & SPONSORSHIPS — Ford partnerships
    // ════════════════════════════════════════════
    { title: 'Ford Canada Renews CFL Title Sponsorship — Multi-Year Extension Through 2028',
      tags: ['sponsorships', 'sports', 'brand'], urgency: 'low',
      summary: 'Ford Canada confirmed multi-year CFL title sponsorship renewal. Activation will extend through to the 2028 season with expanded digital fan experiences.',
      whyItMatters: 'CFL sponsorship anchors Ford Canada\'s sports brand presence — ensure F-150 and Bronco brand campaigns lean into game-day moments through Q3.' },
    { title: 'Ford Performance Wins Canadian Tire Motorsport Park Endurance Race',
      tags: ['sports', 'brand'], urgency: 'low',
      summary: 'Ford Performance team scored an overall victory at the Canadian Tire Motorsport Park endurance race. Mustang and Bronco performance content saw strong organic engagement.',
      whyItMatters: 'Performance heritage feeds Bronco and Mustang Mach-E brand equity. Consider amplifying race highlights in Bronco Adventure creative.' },
    { title: 'Built Ford Tough TV Spot Wins Canadian Marketing Award — Mindshare Cited',
      tags: ['brand', 'sponsorships'], urgency: 'low',
      summary: 'The "Built Ford Tough" Spring TV spot won the Canadian Marketing Association\'s 2026 Automotive Brand Campaign award. Mindshare cited for media strategy execution.',
      whyItMatters: 'Award validation strengthens AOR partnership narrative. Reference in CMO trust-building moments around media investment efficacy.' },
    { title: 'Ford CFL Title Sponsorship 2026 Activation — 8 Stadium Branding Refresh',
      tags: ['sponsorships', 'sports'], urgency: 'medium',
      summary: 'Ford\'s CFL title sponsorship 2026 activation includes refreshed stadium branding across all 8 CFL stadiums. F-150 and Bronco prominently featured in fan zones.',
      whyItMatters: 'CFL fan demographic indexes high for F-150 and Bronco. Sponsorship leverage in regional campaigns (Ontario, Alberta, Atlantic).' },
    { title: 'Ford Performance Cup Canadian Race Series — 8 Events Across Ontario, Quebec, BC',
      tags: ['sponsorships', 'sports'], urgency: 'low',
      summary: 'Ford Performance Cup Canadian race series confirmed for 2026 with 8 events across Ontario, Quebec, and BC. Mustang Mach-E GT featured in performance category.',
      whyItMatters: 'Performance heritage feeds Mach-E GT brand narrative. Coordinate Mach-E GT social content around race events.' },
    { title: 'F-150 Built Tough Series Canadian Tour — Construction & Trades Event Activation',
      tags: ['sponsorships', 'sports'], urgency: 'medium',
      summary: 'Built Ford Tough Series Canadian tour begins May with stops in 12 cities, including dealer-led construction and trades professional events. Truck Intender and Fleet/Commercial audience activation.',
      whyItMatters: 'Direct dealer-tier activation reaching Fleet/Commercial buyers. Ontario, Alberta dealer campaigns should integrate event-specific creative.' },
    { title: 'Ford Mustang 60th Anniversary Canadian Activation — Toronto and Montreal',
      tags: ['sponsorships', 'sports', 'brand'], urgency: 'low',
      summary: 'Mustang 60th Anniversary Canadian celebration with featured events in Toronto and Montreal. Mach-E GT and Mustang Coyote V8 featured side-by-side at Edmonton Petrol-Heads Festival.',
      whyItMatters: 'Mustang heritage halo benefits Mach-E and Mach-E GT premium positioning. Integrate heritage messaging into Mach-E launch creative.' },

    // ════════════════════════════════════════════
    // SOCIAL & CULTURAL SIGNALS
    // ════════════════════════════════════════════
    { title: 'Reddit r/electricvehicles "Lightning vs Cybertruck" Mega-Thread Hits 5K Upvotes',
      tags: ['social', 'ev'], urgency: 'medium',
      summary: 'A comparison mega-thread on r/electricvehicles asking "Lightning vs Cybertruck — which would you actually buy?" has reached 5K upvotes and 1,400+ comments. Lightning sentiment is broadly favorable on practicality and resale.',
      whyItMatters: 'Strong organic Lightning sentiment is a free amplification asset. Brief social team to monitor and (carefully) engage where appropriate.' },
    { title: 'TikTok #BroncoLife Tag Surpasses 240M Views — Adventure Community Authentic Engagement',
      tags: ['social', 'brand'], urgency: 'low',
      summary: 'The #BroncoLife TikTok tag surpassed 240M cumulative views in Q1 with strong creator-led adventure and overlanding content driving impressions.',
      whyItMatters: 'Bronco TikTok organic momentum is industry-leading. Creator partnership program could amplify with relatively modest investment.' },
    { title: 'Ford Motor Credit Consumer Sentiment Up 12% Quarter-over-Quarter',
      tags: ['social', 'brand'], urgency: 'low',
      summary: 'Ford Motor Credit Canada\'s consumer sentiment tracker shows Q1 lift of 12% versus prior quarter, driven by competitive APR offers and improved digital application UX.',
      whyItMatters: 'Financing sentiment improvements support dealer co-op messaging on close-of-funnel. Consider financing-led creative in Tier 1 conversion campaigns.' },
    { title: 'Reddit r/Ford F-150 Lightning Pre-Order Megathread — 12K Comments, Strong Buyer Sentiment',
      tags: ['social', 'ev'], urgency: 'medium',
      summary: 'r/Ford community pre-order megathread for F-150 Lightning has 12K comments and 18K upvotes. Buyer sentiment strongly positive on towing capability, charging, and Ford Charging Network Plus access.',
      whyItMatters: 'Authentic Lightning buyer enthusiasm. Social team should monitor and (selectively) engage. Use buyer language in Lightning launch creative.' },
    { title: 'TikTok #LightningChallenge Trend Drives 80M Views — Lightning Capability Demos',
      tags: ['social', 'ev'], urgency: 'medium',
      summary: 'TikTok #LightningChallenge trend featuring real Lightning owners demonstrating towing, off-road, and tech capabilities reached 80M cumulative views. Authentic UGC peak in Q2.',
      whyItMatters: 'High-quality organic Lightning content. Coordinate paid amplification of best UGC pieces. Brief Mindshare on creator partner shortlist.' },
    { title: 'Twitter/X Tesla Layoffs Sentiment Shift — Lightning Consideration Up 14%',
      tags: ['social'], urgency: 'medium',
      summary: 'Twitter/X conversations following Tesla Canadian layoffs show 14% increase in Lightning consideration mentions in affected geographic clusters (Toronto, Vancouver).',
      whyItMatters: 'Conquest opportunity in Tesla-disappointed cohorts. Lightning Search and TTD targeting should layer Conquest — Tesla audience in Toronto and Vancouver markets.' },
    { title: 'Reddit r/electricvehicles Lightning vs Cybertruck Cost-of-Ownership Analysis Goes Viral — 6K Upvotes',
      tags: ['social', 'ev'], urgency: 'medium',
      summary: 'A detailed cost-of-ownership comparison thread on r/electricvehicles favors F-150 Lightning over Tesla Cybertruck on 5-year TCO due to insurance, maintenance, and resale projections.',
      whyItMatters: 'Authoritative community analysis. Update Lightning Conquest — Tesla creative to lean into TCO advantage rather than just feature comparison.' },

    // ════════════════════════════════════════════
    // AUTOMOTIVE INDUSTRY & MARKET DATA
    // ════════════════════════════════════════════
    { title: 'AutoTrader Canada Search Trends Q1 — F-150 Lightning Searches Up 47%',
      tags: ['automotive', 'ev'], urgency: 'medium',
      summary: 'AutoTrader Canada Q1 search trends report shows F-150 Lightning consumer searches up 47% YoY, the largest increase among any EV. Mustang Mach-E and Escape PHEV also up 22-31%.',
      whyItMatters: 'Quantified consumer intent data validates Lightning launch timing. Use AutoTrader data point in Lightning launch press materials and trust-signal creative.' },
    { title: 'Canadian Auto Industry Jobs Report — Ford Oakville and Windsor Stable, Hiring Resumed',
      tags: ['automotive', 'macro'], urgency: 'low',
      summary: 'Canadian Automobile Manufacturers Association Q1 jobs report shows Ford Oakville and Windsor plants stable employment and resuming hiring. Direct contrast with industry layoffs at GM and Tesla.',
      whyItMatters: 'Local employment positioning advantage in Ontario. Brand campaigns can integrate "Ford keeps Canadians working" narrative in Q3.' },
    { title: 'JD Power 2026 Initial Quality Study — F-150 and Mustang Top Their Segments',
      tags: ['automotive', 'brand'], urgency: 'medium',
      summary: 'JD Power 2026 Initial Quality Study results: F-150 ranked #1 in full-size truck segment, Mustang ranked #1 in sports car segment, Mach-E top-3 in compact EV. Strong overall Ford lineup performance.',
      whyItMatters: 'Third-party quality validation across multiple nameplates. Integrate JD Power badges across Tier 1 and Tier 2 creative for F-150 and Mach-E. Trust-signal opportunity.' },
  ];

  // Generate procedural items with dates spread across 90 days before END_DATE
  for (let i = 0; i < templates.length; i++) {
    const tmpl = templates[i];
    const tag = tmpl.tags[0];
    const daysAgo = randInt(0, 89);
    const date = format(subDays(END_DATE, daysAgo), 'yyyy-MM-dd');
    const sources = NEWS_SOURCES_BY_TAG[tag] ?? ['Globe and Mail'];
    const geos = pickN(ALL_GEOS, randInt(1, 3));

    items.push({
      id: `news-${tag}-${i}`,
      title: tmpl.title,
      source: pick(sources),
      date,
      tags: tmpl.tags,
      regions: geos,
      urgency: tmpl.urgency,
      summary: tmpl.summary,
      whyItMatters: tmpl.whyItMatters,
      competitor: tmpl.competitor,
      enterprises: ['ford-canada'],
    });
  }

  // ── LINCOLN-specific hero news ──
  items.push(
    {
      id: 'news-lincoln-bmw-x5-redesign',
      title: 'BMW Announces 2027 X5 Redesign with Aggressive CAD $74,900 Starting Price — Direct Aviator Pressure',
      source: 'Driving.ca Luxury',
      date: '2026-05-07',
      tags: ['competitors', 'launch'],
      urgency: 'high',
      competitor: 'BMW',
      regions: ['national'],
      summary: 'BMW Canada confirmed the 2027 X5 will launch in September with a starting price of CAD $74,900 — $4,200 below the current Lincoln Aviator Reserve. The reveal also previewed an enhanced ADAS package and new electrification options.',
      whyItMatters: 'X5 is the single most aggressive cross-shop in the Aviator consideration funnel (38% overlap). The pricing move compresses Lincoln\'s value position in conquest-from-BMW segments. STRATIS recommends accelerating Aviator value-narrative repositioning before X5 launch ramps.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-lexus-rx-loyalty',
      title: 'Lexus RX Loyalty Hits Record 91% in Canada — J.D. Power Q1 Study',
      source: 'J.D. Power Canada',
      date: '2026-05-04',
      tags: ['competitors'],
      urgency: 'medium',
      competitor: 'Lexus',
      regions: ['national'],
      summary: 'J.D. Power\'s Q1 luxury loyalty study shows Lexus RX retention at 91% — the highest single-nameplate luxury SUV loyalty figure ever recorded in Canada. Conquest from RX into Lincoln Nautilus has dropped 4.1pp YoY.',
      whyItMatters: 'Conquest creative against Lexus RX is no longer producing meaningful flow. Lincoln should pivot Nautilus conquest dollars toward Mercedes GLE and Audi Q7 segments where loyalty is softer. Estimated efficiency gain: 22% on conquest spend.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-luxury-tariff-relief',
      title: 'Federal Government Announces Luxury Vehicle Tax Threshold Adjustment — Effective July 1',
      source: 'Department of Finance Canada',
      date: '2026-05-01',
      tags: ['macro'],
      urgency: 'high',
      regions: ['national'],
      summary: 'The federal luxury tax threshold for vehicles will rise from CAD $100,000 to CAD $108,000 effective July 1, 2026. Lincoln Navigator Reserve and Aviator Black Label trims previously caught by the tax will now fall below threshold for some configurations.',
      whyItMatters: 'Removes a CAD $4K–$8K friction point on top-trim Aviator and Navigator configurations. STRATIS projects +280 incremental Q3 dealer leads with creative leading on "no luxury tax" messaging post-July 1.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-mercedes-gle-refresh',
      title: 'Mercedes-Benz Canada Confirms 2027 GLE Refresh — Hybrid-First Lineup, Q3 Launch',
      source: 'Automotive News Canada',
      date: '2026-05-06',
      tags: ['competitors', 'launch', 'ev'],
      urgency: 'high',
      competitor: 'Mercedes-Benz',
      regions: ['national'],
      summary: 'Mercedes-Benz Canada announced the 2027 GLE refresh will arrive in Q3 with a fully hybridized lineup — every trim now mild-hybrid or PHEV. Pricing holds at CAD $84,500 base. Estimated national media weight $9.6M over 8 weeks.',
      whyItMatters: 'GLE is the #2 cross-shop for Aviator (after BMW X5) and the #1 cross-shop for Lincoln Nautilus. The hybrid-first message directly counters Lincoln\'s mid-cycle positioning. Hudson Rouge should accelerate Nautilus 2026 hybrid messaging in CTV + Spotify before GLE launch grabs the conversation.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-tiff-sponsorship-window',
      title: 'TIFF Opens Premier Auto Sponsorship Window for 2026 Festival — Luxury Tier Limited to One OEM',
      source: 'Toronto International Film Festival',
      date: '2026-05-05',
      tags: ['sponsorships', 'partnerships', 'brand'],
      urgency: 'medium',
      regions: ['ontario', 'national'],
      summary: 'TIFF is accepting applications for its 2026 premier auto sponsorship tier, which limits the category to a single OEM. The package includes red-carpet vehicle presence, festival-week experiential activations across Toronto, and integrated brand placement. Decision expected late June.',
      whyItMatters: 'TIFF audience demographics overlap 71% with Lincoln Aviator + Navigator buyer profiles (HHI $250K+, urban-affluent, cultural sophisticate). Last automaker (Genesis 2024) reported a 28% lift in Toronto-DMA brand consideration during festival weeks. Hudson Rouge should fast-track a TIFF integration brief.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-quebec-luxury-growth',
      title: 'Quebec Luxury Vehicle Sales Up 18% YoY in Q1 — Outpacing National 11% Growth',
      source: 'DesRosiers Automotive Consultants',
      date: '2026-05-03',
      tags: ['macro'],
      urgency: 'medium',
      regions: ['quebec'],
      summary: 'DesRosiers Q1 report shows Quebec luxury vehicle registrations grew 18% YoY — significantly ahead of the 11% national luxury growth rate. Drivers include Montreal urban affluent expansion + Quebec City executive segment recovery. Lincoln share in Quebec held flat at 6.1%.',
      whyItMatters: 'Quebec is over-indexing on luxury growth but Lincoln isn\'t capturing it — flat share against a +18% market means competitors (BMW, Mercedes, Audi) are winning the new buyers. Cossette Luxury should propose a Quebec-specific Aviator + Nautilus campaign to capture growth before share calcifies.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-genesis-dealer-expansion',
      title: 'Hyundai Confirms 12 New Genesis Boutique Dealers in Canada by 2027 — Toronto, Montreal, Vancouver Priority',
      source: 'Globe and Mail Auto',
      date: '2026-04-30',
      tags: ['competitors', 'partnerships'],
      urgency: 'high',
      competitor: 'Genesis',
      regions: ['national'],
      summary: 'Hyundai Motor Group confirmed plans to open 12 new Genesis boutique dealerships across Canada by end of 2027 — concentrated in Toronto (5), Montreal (3), Vancouver (2), Calgary (1), Ottawa (1). Boutique format mirrors successful US strategy.',
      whyItMatters: 'Genesis is the fastest-growing luxury entrant in Canada (G80 + GV80 took 4.2pp from Lincoln Aviator over 2 years). New boutique footprint targets exactly Lincoln\'s urban-affluent segment in 5 of the 6 highest-conversion markets. Lincoln should pre-empt with conquest-Genesis creative + dealer-experience differentiation messaging.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-range-rover-sport',
      title: 'Land Rover Canada Pulls 2026 Range Rover Sport Marketing After Reliability Recall',
      source: 'Driving.ca Luxury',
      date: '2026-04-29',
      tags: ['competitors'],
      urgency: 'medium',
      competitor: 'Land Rover',
      regions: ['national'],
      summary: 'Land Rover Canada paused all 2026 Range Rover Sport paid media after a NHTSA-mirror Transport Canada recall covering 8,400 Canadian units for an electrical fault. Marketing pause expected to last 6–10 weeks pending fix verification.',
      whyItMatters: 'Range Rover Sport is the #3 cross-shop for Lincoln Navigator. Land Rover\'s media silence creates a 6–10 week SOV vacuum in the full-size luxury SUV category. Hudson Rouge should temporarily surge Navigator CTV + Spotify weight to capture the Range Rover audience cluster while their consideration is open.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-lincoln-quiet-flight-spotify',
      title: 'Spotify Canada Reports Audio Ad Engagement +34% in Premium Lifestyle Segment Q1',
      source: 'Spotify Canada',
      date: '2026-04-26',
      tags: ['partnerships'],
      urgency: 'medium',
      regions: ['national'],
      summary: 'Spotify\'s Q1 Canada audio engagement report shows the Premium Lifestyle segment (HHI $200K+, urban) drove a 34% YoY lift in audio ad engagement vs. the broader Spotify base. Listening duration up 22%, podcast attribution up 41%.',
      whyItMatters: 'Spotify Premium Lifestyle audience matches Lincoln\'s buyer profile almost exactly. The "Quiet Flight" Aviator audio spots are testing strongly here (12% above benchmark). Hudson Rouge should push 30% more Spotify weight into Aviator + Nautilus before Q3 GLE + X5 launches consume the inventory.',
      enterprises: ['lincoln'],
    },
  );

  // ── DEALERSHIP NETWORK-specific hero news ──
  items.push(
    {
      id: 'news-dn-ontario-coop-program-update',
      title: 'Ford Canada Updates Tier 3 Co-op Reimbursement Structure — Effective Q3 2026',
      source: 'Ford Dealer Council Bulletin',
      date: '2026-05-06',
      tags: ['brand'],
      urgency: 'high',
      regions: ['national'],
      summary: 'Ford Canada announced changes to dealer co-op reimbursement: digital media (Search, Meta, programmatic) reimbursement rises from 50% to 65%, while traditional media (radio, print) drops from 65% to 40%. Effective for Q3 spend.',
      whyItMatters: 'Dealers running >40% traditional media will see effective marketing budget compress unless they shift to digital. STRATIS detects 312 of 890 dealers currently above the threshold — proactive outreach can prevent budget surprise and accelerate digital-first transition.',
      enterprises: ['dealership-network'],
    },
    {
      id: 'news-dn-google-vehicle-listing-ads',
      title: 'Google Launches Vehicle Listing Ads in Canada — Available to All Authorized Dealers',
      source: 'Google Ads Canada',
      date: '2026-05-03',
      tags: ['partnerships'],
      urgency: 'high',
      regions: ['national'],
      summary: 'Google rolled out Vehicle Listing Ads (VLAs) to Canadian auto dealers this week. Inventory feeds plug into Google Search and Google Shopping with VIN-level visibility. Early US results show 28% lift in qualified leads at flat CPL.',
      whyItMatters: 'First-mover dealers will capture disproportionate volume. STRATIS recommends a coordinated 60-dealer pilot in Ontario + BC to validate the format before full network rollout. Expected lead-volume lift: 18-24% within 90 days.',
      enterprises: ['dealership-network'],
    },
    {
      id: 'news-dn-quebec-french-creative-mandate',
      title: 'OQLF Tightens French-Language Compliance for Digital Auto Ads — December 2026 Deadline',
      source: 'Office québécois de la langue française',
      date: '2026-04-29',
      tags: ['macro'],
      urgency: 'medium',
      regions: ['quebec'],
      summary: 'The Office québécois de la langue française published updated guidance requiring all digital auto advertising in Quebec to feature primary French copy by December 31, 2026. Bilingual ads with English-first treatment will be non-compliant.',
      whyItMatters: 'Quebec dealer co-op currently runs 38% English-first creative. STRATIS detected 64 dealers at compliance risk. Coordinated French-creative production via Cossette saves dealer-by-dealer scramble and reduces compliance risk to zero.',
      enterprises: ['dealership-network'],
    },
  );

  // Cross-industry agency clients (authored in src/lib/clients/*)
  items.push(...RBC_NEWS, ...MOLSON_COORS_NEWS, ...LULULEMON_NEWS, ...TIM_HORTONS_NEWS);

  // Pinned items always at top — sort by pinned status (id prefix) then date desc
  return items.sort((a, b) => {
    const aPinned = isPinned(a.id);
    const bPinned = isPinned(b.id);
    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
}

const PINNED_NEWS_IDS = new Set([
  'news-tesla-cybertruck-cut', 'news-izev-extension', 'news-gm-silverado-fleet',
  'news-lincoln-bmw-x5-redesign', 'news-lexus-rx-loyalty', 'news-luxury-tariff-relief',
  'news-dn-ontario-coop-program-update', 'news-dn-google-vehicle-listing-ads', 'news-dn-quebec-french-creative-mandate',
  ...RBC_RADAR_PINS, ...MOLSON_COORS_RADAR_PINS, ...LULULEMON_RADAR_PINS, ...TIM_HORTONS_RADAR_PINS,
]);
function isPinned(id: string): boolean {
  return PINNED_NEWS_IDS.has(id);
}

// ===== Insights =====
function generateInsights(_anomalies: Anomaly[]): Insight[] {
  const today = format(END_DATE, 'yyyy-MM-dd') + 'T07:00:00Z';
  const at = (daysAgo: number, hhmmss: string) =>
    format(subDays(END_DATE, daysAgo), 'yyyy-MM-dd') + 'T' + hhmmss + 'Z';

  return [
    // ═════════════════════════════════════════════════════════════════
    // STRATEGIC OPENERS — portfolio-level brand & halo signals visible only
    // because STRATIS reads across every agency and nameplate at once
    // ═════════════════════════════════════════════════════════════════

    // Card IDs retained from the prior set so chart seeds stay stable.
    {
      id: 'ins-strat-01-brand-promises',
      createdAt: today,
      enterprise: 'ford-canada', category: 'strategic-opener',
      scope: 'brand',
      channels: ['ctv', 'ooh', 'instagram', 'ttd'],
      title: 'Summed Across Every Live Campaign, the Average Canadian Sees Ford 31x a Week — Past the Point of Diminishing Brand Return',
      summary: 'Every live Ford campaign respects its own frequency cap, but no cap exists across the portfolio. When STRATIS dedupes audiences across all 23 live campaigns spanning Mindshare, the five regional partners, and the dealer network, the average reached Canadian is seeing roughly 31 Ford brand exposures a week — well past the ~8–12 range where brand response plateaus. The overexposure is invisible to any single agency because each only sees its own delivery; it only emerges when every campaign is deduped against the same person. A portfolio-level brand frequency cap pulls combined weight back into the effective range and frees the wasted impressions for reach the brand is not getting.',
      evidence: [
        'Deduped across all 23 live Ford campaigns: ~31 brand exposures/week to the average reached Canadian',
        'Per-campaign frequency caps are respected; no portfolio-level cap exists across the three tiers',
        'Point of diminishing brand return for awareness: ~8–12x/week',
        'Overlap is heaviest where Tier 1, regional, and dealer campaigns hit the same metros',
        'Visible only by deduping audiences across every live campaign at once — no single agency sees the sum',
      ],
      confidence: 0.87,
      impactEstimate: 'A portfolio-level brand frequency cap across all live campaigns pulls combined weekly exposure back toward the effective range and redeploys the over-delivered impressions to unreached audiences — no loss of net reach.',
      recommendedAction: 'Set a portfolio-level brand frequency cap across all live Ford campaigns and reallocate the recovered weight to unreached audiences. STRATIS dedupes and enforces continuously.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Set a portfolio-level brand frequency cap', subtitle: 'ACROSS ALL LIVE CAMPAIGNS, ALL TIERS', type: 'bidding', completed: false },
        { id: 's2', title: 'Reallocate recovered weight to unreached audiences', subtitle: 'PRESERVE NET REACH', type: 'budget', completed: false },
        { id: 's3', title: 'Monitor combined brand frequency continuously', subtitle: 'STRATIS DEDUPES + ENFORCES', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-strat-02-f150-halo',
      createdAt: at(1, '08:30:00'),
      enterprise: 'ford-canada', category: 'strategic-opener',
      scope: 'brand',
      channels: ['ctv', 'ooh', 'google-search', 'spotify'],
      title: 'Brand Impressions Are Up 12% This Quarter but Branded Search Is Down 4% — Spend Is Rising, Brand Pull Is Not',
      summary: 'Across the live portfolio, paid brand delivery is climbing — impressions up ~12% quarter over quarter — while organic branded search, the clearest demand-pull signal, has softened ~4% over the same window. The two normally move together, and the divergence typically precedes a brand-efficiency decline where each added impression buys less. STRATIS holds delivered brand impressions and branded search side by side across every campaign, so it flags the gap weeks before it surfaces in cost-per-result. Because the pattern holds across tiers rather than in one campaign, the likely cause is creative wear or message — not budget — and adding weight will not close it.',
      evidence: [
        'Delivered brand impressions: +12% QoQ across the live portfolio',
        'Organic branded search: −4% over the same window — the demand-pull signal is softening',
        'Impressions and branded search normally move together; the divergence precedes efficiency decline',
        'Pattern holds across all three tiers — not isolated to one campaign or agency',
        'Points to creative wear or message, not budget — added weight will not close the gap',
      ],
      confidence: 0.83,
      impactEstimate: 'Catching the impressions-vs-search divergence early lets a creative and message refresh restore brand pull before cost-per-result climbs; STRATIS keeps holding delivery and search side by side as the leading indicator.',
      recommendedAction: 'Treat the impressions-vs-search gap as a creative signal, not a budget one — refresh the brand message before adding weight. STRATIS tracks the divergence as a leading indicator.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Diagnose the brand-pull gap', subtitle: 'CREATIVE / MESSAGE, NOT BUDGET', type: 'creative', completed: false },
        { id: 's2', title: 'Refresh brand creative before adding weight', subtitle: 'HIGHEST-DELIVERY CAMPAIGNS FIRST', type: 'creative', completed: false },
        { id: 's3', title: 'Track impressions vs branded search weekly', subtitle: 'STRATIS LEADING INDICATOR', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-strat-03-bronco-earned',
      createdAt: at(3, '14:00:00'),
      enterprise: 'ford-canada', category: 'strategic-opener',
      scope: 'brand',
      channels: ['ctv', 'instagram', 'tiktok', 'google-search'],
      title: 'One Message Theme Is Outperforming Everywhere It Runs Across the Live Portfolio — Yet It Carries No Brand-Level Campaign',
      summary: 'Ranking creative performance across all live Ford campaigns, STRATIS finds a single message theme consistently beating its alternatives wherever it appears — across multiple campaigns, agencies, and regions — on both engagement and consideration. The signal is trustworthy precisely because it repeats across independent campaigns rather than showing up once. Yet the theme lives only inside product, regional, and dealer activations; no brand-level campaign carries it, and the Built Ford Tough Master Brand Q2 flight does not lead with it. The live portfolio is effectively surfacing the brand\'s next platform on its own — the opportunity is to elevate the proven theme deliberately rather than leave it to keep emerging piecemeal.',
      evidence: [
        'One message theme outperforms its alternatives wherever it runs — across multiple live campaigns, agencies, and regions',
        'Outperformance shows on both engagement and consideration',
        'The theme appears only in product, regional, and dealer activations — no brand-level campaign carries it',
        'Built Ford Tough Master Brand Q2 does not currently lead with the outperforming theme',
        'Signal is trustworthy because it repeats across independent campaigns — visible only by ranking the full live portfolio at once',
      ],
      confidence: 0.82,
      impactEstimate: 'Elevating the proven theme to the master-brand level turns a pattern the live portfolio surfaced on its own into a deliberate brand platform; STRATIS keeps ranking message themes across all live creative.',
      recommendedAction: 'Elevate the outperforming message theme to a brand-level platform instead of leaving it to surface piecemeal across activations. STRATIS keeps ranking themes across the live portfolio.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Validate the outperforming theme across campaigns', subtitle: 'CONFIRM IT REPEATS, NOT A ONE-OFF', type: 'creative', completed: false },
        { id: 's2', title: 'Elevate the theme to the master-brand level', subtitle: 'BUILD INTO THE BRAND PLATFORM', type: 'creative', completed: false },
        { id: 's3', title: 'Keep ranking message themes across live creative', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // NATIONAL-TO-REGIONAL ORCHESTRATION — Tier 1 (Mindshare) → Tier 2 (five
    // regional partners): national demand vs regional capture, playbook cascade
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-natreg-01-demand-vs-budget',
      createdAt: today,
      enterprise: 'ford-canada', category: 'national-regional',
      scope: 'brand',
      channels: ['ctv', 'ttd', 'google-search', 'instagram'],
      title: 'Tier 1 Lifted Consideration Most in 3 Regions — but Regional Budget Is Weighted to a Different 3',
      summary: 'National brand activity from Tier 1 (Mindshare) is lifting consideration unevenly across the country. STRATIS holds the national consideration lift by region against where the five regional partners are actually spending and finds them out of sync: the markets where Tier 1 created the most warmed demand — Ontario, Alberta, and BC over the trailing 30 days — are not the markets carrying the most Tier 2 weight. Ford pays nationally to create demand in one set of regions and funds conversion in another. No single agency sees both halves; Mindshare sees national delivery, and each regional partner sees only its own market. Reweighting Tier 2 toward the national tailwind converts demand that is already there, at lower cost than generating it fresh.',
      evidence: [
        'National (Tier 1) consideration lift, trailing 30 days: strongest in Ontario, Alberta, and BC',
        'Heaviest Tier 2 weight sits in a different set of markets — not following the national lift',
        'Regions with the largest national assist are under-resourced at the regional tier',
        'Mindshare sees national delivery; each regional partner sees only its own market — neither sees the mismatch',
        'Five regional partners, ~$41.8M total — reweightable toward where Tier 1 created demand',
      ],
      confidence: 0.83,
      impactEstimate: 'Reweighting Tier 2 toward the regions where Tier 1 created the most consideration converts warmed demand already in market, at lower cost than generating fresh demand; STRATIS tracks national lift against regional weight continuously.',
      recommendedAction: 'Reweight regional (Tier 2) budget toward the markets where Tier 1 created the most consideration lift. STRATIS holds national lift and regional spend in one view and flags drift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Rank regions by the national-to-regional demand gap', subtitle: 'TIER 1 LIFT vs TIER 2 WEIGHT', type: 'targeting', completed: false },
        { id: 's2', title: 'Reweight regional budget toward the national tailwind', subtitle: 'PHASED — FIVE REGIONAL PARTNERS', type: 'budget', completed: false },
        { id: 's3', title: 'Track national lift vs regional spend continuously', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-natreg-02-playbook-cascade',
      createdAt: at(2, '10:40:00'),
      enterprise: 'ford-canada', category: 'national-regional',
      scope: 'division',
      division: 'tier-2',
      channels: ['google-search', 'facebook', 'instagram'],
      title: 'The Winning Tier 1 Audience and Channel Mix Has Reached Only 1 of 5 Regional Partners — the Other 4 Are Relearning It From Scratch',
      summary: 'Tier 1 (Mindshare) has already proven which audiences and channel mix convert most efficiently this quarter. STRATIS compares that structure against what each of the five regional partners is running and finds only one — BC — has converged on it; the other four run their own audience and channel structures and sit at materially higher cost-per-lead. The proven playbook is not a secret, it has simply never been cascaded, because no layer sits across Tier 1 and all five Tier 2 partners at once. Pushing the Tier 1 structure to the remaining regions is a free efficiency gain that needs no new creative — only a structural change.',
      evidence: [
        'Proven Tier 1 audience + channel mix matched by only 1 of 5 regional partners (BC)',
        'BC regional CPL: $148 — best in Tier 2; Ontario $298 is the widest gap',
        'The other four partners run their own structures and sit above the ~$218 Tier 1 baseline',
        'No layer sits across Tier 1 and all five Tier 2 partners at once — the playbook never cascades',
        'Cascading the proven structure needs no new creative — a structural change only',
      ],
      confidence: 0.85,
      impactEstimate: 'Cascading the proven Tier 1 (and BC) audience and channel structure to the other four regional partners pulls their cost-per-lead toward the best-in-class $148 with no new creative; STRATIS tracks adoption and the CPL gap.',
      recommendedAction: 'Codify the proven Tier 1 audience and channel mix as the regional standard and cascade it to the four partners that have not adopted it. STRATIS tracks adoption and the regional CPL gap.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Codify the proven Tier 1 + BC structure as the regional standard', subtitle: 'AUDIENCE + CHANNEL MIX', type: 'targeting', completed: false },
        { id: 's2', title: 'Cascade to the four non-adopting regional partners', subtitle: 'PHASED — NO NEW CREATIVE', type: 'targeting', completed: false },
        { id: 's3', title: 'Track adoption and the regional CPL gap', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // TACTICAL EFFICIENCY & ALLOCATION — operator-level levers ready to ship;
    // the budget-shift cards are slider-driven and launch onto platform
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-tactical-001-lightning-channel-mix',
      createdAt: today,
      enterprise: 'ford-canada', category: 'tactical-efficiency',
      scope: 'campaign',
      productLine: 'lightning',
      campaign: 'F-150 Lightning — Q2 Conquest',
      channels: ['ctv', 'facebook', 'instagram', 'tiktok', 'spotify'],
      title: 'YouTube Beats CTV + Meta on Cost-Per-Qualified-View — Yet Holds the Smallest Share of the Video Budget',
      summary: 'Holding channel efficiency and channel allocation in one view, STRATIS found YouTube beating both CTV and Meta video on cost-per-qualified-view against the consideration objective over the trailing 30 days, while receiving the smallest share of the video pool. The two facts live in separate agency dashboards, so the headroom is invisible until they sit together. The recommended move is deliberately small and reversible: a single capped step into the proven channel, measured before any larger shift, so the test costs little if the lift does not hold.',
      evidence: [
        'Cost-per-qualified-view (consideration objective, trailing 30 days): YouTube best of the video set, ahead of CTV and Meta video',
        'YouTube share of the video pool: smallest, despite leading on cost-per-qualified-view',
        'Facebook video carries the largest video share at the weakest qualified-view rate',
        'Efficiency and allocation live in separate agency dashboards — the headroom is invisible until they sit together',
        'Recommended step is capped and reversible — a single move measured before any larger shift',
      ],
      confidence: 0.86,
      impactEstimate: 'A capped, reversible shift of video budget into YouTube, read on consideration lift at 14 days before scaling, captures the qualified-view efficiency at low downside if the lift does not hold.',
      recommendedAction: 'Shift video budget into YouTube in a capped, reversible step and measure consideration lift before scaling. Adjust slider to set the step size, then push through Mindshare\'s buying seats.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Apply the capped YouTube shift', subtitle: 'TOP-PERFORMING FORMATS FIRST', type: 'budget', completed: false },
        { id: 's2', title: 'Hold CTV and Meta video at current levels', subtitle: 'MEASURE CLEAN', type: 'budget', completed: false },
        { id: 's3', title: 'Read consideration lift at 14 days', subtitle: 'STRATIS REPORTS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-tac-05-instagram-cpm',
      createdAt: at(2, '11:20:00'),
      enterprise: 'ford-canada', category: 'tactical-efficiency',
      scope: 'brand',
      channels: ['instagram', 'facebook', 'tiktok', 'ttd'],
      title: 'Instagram CPMs Up 3 Weeks Straight While Results Stayed Flat — Budget Hasn\'t Reacted',
      summary: 'Instagram CPMs rose materially over the trailing three weeks while the cost-per-result held flat, meaning Ford is now paying more to achieve the same outcome and the budget has not yet reacted. STRATIS tracks CPM against outcome by platform continuously, so it flagged the divergence the week it began rather than at the end of a monthly reporting cycle. The move is a straightforward reallocation away from a channel that has quietly gotten more expensive toward channels currently under their benchmark, fully reversible if the CPM trend reverses.',
      evidence: [
        'Instagram CPM trend: up materially over the trailing 3 weeks',
        'Cost-per-result over the same window: flat — more spent for the same outcome',
        'Instagram budget weight: unchanged since the CPM climb began',
        'STRATIS tracks CPM against outcome by platform continuously — flagged the divergence the week it started, not at month-end',
        'Reallocation targets are channels currently under their CPM benchmark — fully reversible if the trend reverses',
      ],
      confidence: 0.84,
      impactEstimate: 'Trimming the inefficient Instagram share to its efficient run-rate and redeploying to under-benchmark channels stops the rising cost-per-result; reversible the moment the CPM trend reverses.',
      recommendedAction: 'Trim the inefficient Instagram share and redeploy to channels currently beating their CPM benchmark.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Reduce Instagram weight to match efficient run-rate', subtitle: 'REVERSIBLE', type: 'budget', completed: false },
        { id: 's2', title: 'Redeploy to under-benchmark channels', subtitle: 'DATA-RANKED', type: 'budget', completed: false },
        { id: 's3', title: 'Set a CPM-spike alert threshold', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-tac-06-meta-audience-overlap',
      createdAt: at(1, '09:10:00'),
      enterprise: 'ford-canada', category: 'tactical-efficiency',
      scope: 'division',
      division: 'tier-2',
      channels: ['facebook', 'instagram'],
      title: 'Mindshare + a Regional Partner Are Bidding the Same Meta Truck Audience Against Each Other — Self-Inflicted CPM Premium',
      summary: 'Mindshare and a Regional Partner are both live on Meta against the same in-market truck audience in the same flight window. Because they bid into the same auction for the same users, Ford\'s effective CPM on the contested audience runs measurably above the CPM on comparable non-overlapping audiences. Neither agency can see this; each sees only its own plan. This is the single clearest example of why cross-silo visibility matters, and it is exactly the kind of waste a media team suspects exists but can almost never prove. A shared suppression layer removes the internal competition without either agency losing reach it actually needs.',
      evidence: [
        'Mindshare (Tier 1) and a Regional Partner both live on Meta against the same in-market truck audience, same flight window',
        'Effective CPM on the contested audience runs measurably above CPM on comparable non-overlapping audiences',
        'Both agencies bid into the same auction for the same users — neither can see the other\'s plan',
        'Clearest example in the account of cross-silo waste a media team suspects but cannot usually prove',
        'A shared suppression layer removes the internal competition without either agency losing needed reach',
      ],
      confidence: 0.88,
      impactEstimate: 'A shared audience-suppression layer ends the agencies bidding against each other on Meta and removes the self-inflicted CPM premium; a monthly overlap audit keeps it from recurring.',
      recommendedAction: 'Implement a shared audience-suppression layer so the agencies stop competing for the same impressions. Run a cross-agency overlap audit monthly via STRATIS.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Deploy cross-agency audience suppression', subtitle: 'META FIRST, THEN EXPAND', type: 'targeting', completed: false },
        { id: 's2', title: 'Confirm reach is preserved post-suppression', subtitle: 'STRATIS VERIFIES', type: 'targeting', completed: false },
        { id: 's3', title: 'Schedule monthly overlap audit', subtitle: 'AUTOMATED VIA STRATIS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-tactical-002-vla-search',
      createdAt: at(1, '10:15:00'),
      enterprise: 'ford-canada', category: 'tactical-efficiency',
      scope: 'division',
      division: 'tier-3',
      channels: ['google-search'],
      title: 'VLAs Convert at ~2.6x the ROAS of Generic Search — Yet Generic Search Still Holds the Larger Google Budget',
      summary: 'Across the 312 dealer accounts running both formats, Vehicle Listing Ads and inventory-aware placements are delivering materially higher ROAS than generic Search over the trailing 30 days (5.8 vs 2.2), because they let in-market shoppers pre-qualify vehicle, price, and distance before they click. Despite that, generic Search still holds the larger share of the combined Google budget out of habit, while VLA is underfunded. The move starts only with the 170 dealers that already have clean inventory feeds, stands up a feed-cleanup workstream for the remaining 142, and leaves brand-defense spend untouched, so nothing breaks while the efficient format scales.',
      evidence: [
        'VLA ROAS (last 30d, 312 dealer accounts): 5.8 vs generic Search 2.2 (~2.6x)',
        'Generic Search share of combined Google spend: 47% ($1.02M/mo)',
        'VLA share: 18% ($391K/mo) — capped by inventory-feed coverage, not budget',
        'GS Brand defense: 35% ($760K/mo) — hold steady, do not grow',
        '170 of 312 dealers have clean inventory feeds; 142 still incomplete — blocking VLA scaling',
        'PMax-with-inventory lift over standalone VLA in pilot: +18% on truck nameplates',
      ],
      confidence: 0.89,
      impactEstimate: 'Shifting a capped $480K/month from generic Search into VLA + Performance Max across the 170 clean-feed dealers is projected at ~$312K/month incremental dealer-attributed revenue ($3.7M annual), with brand-defense spend unchanged.',
      recommendedAction: 'Shift a capped slice from generic Search into VLA + Performance Max with inventory feed, starting with the dealers that have clean feeds. Maintain brand defense at current levels. Adjust slider to set rollout pace before launching the bid adjustments.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Apply the capped shift to clean-feed dealers', subtitle: 'VLA + PMAX WITH INVENTORY — 170 DEALERS', type: 'budget', completed: false },
        { id: 's2', title: 'Stand up feed-cleanup workstream', subtitle: 'REMAINING 142 DEALERS — DEALER.COM', type: 'targeting', completed: false },
        { id: 's3', title: 'Hold brand-defense search at current levels', subtitle: 'NO CHANGE', type: 'budget', completed: false },
      ],
    },
    {
      id: 'ins-tac-08-lightning-creative-fatigue',
      createdAt: at(0, '10:15:00'),
      enterprise: 'ford-canada', category: 'tactical-efficiency',
      scope: 'product',
      productLine: 'lightning',
      channels: ['facebook', 'instagram', 'ctv', 'tiktok'],
      title: 'Lightning Conquest Creative Peaked 11 Days Ago on Meta — Where the Majority of Its Spend Still Sits',
      summary: 'The Lightning conquest creative\'s effectiveness on Meta peaked about 11 days ago and has been declining as cumulative frequency builds, yet Meta still carries the majority of the variant\'s delivery. STRATIS tracks per-creative decay by platform alongside delivery share, so it caught the fatigue while the creative is still performing on lower-frequency platforms. Continuing to weight a fatiguing unit on its most-saturated platform pays a rising cost for falling return. Rotating the creative and moving weight to fresher platforms recovers efficiency without pulling the conquest push.',
      evidence: [
        'Lightning conquest creative effectiveness on Meta: peaked ~11 days ago, declining as cumulative frequency builds',
        'Meta still carries the majority of the variant\'s delivery',
        'Same creative remains fresh on lower-frequency platforms (CTV, TikTok)',
        'STRATIS tracks per-creative decay by platform alongside delivery share — caught the fatigue while the unit still performs elsewhere',
        'Weighting a fatiguing unit on its most-saturated platform pays a rising cost for falling return',
      ],
      confidence: 0.85,
      impactEstimate: 'Rotating the variant and capping frequency on Meta, then moving that weight to platforms where the creative is still fresh, recovers efficiency without pulling the conquest push.',
      recommendedAction: 'Rotate the variant and cap frequency on Meta. Shift that weight to platforms where the same creative is still fresh.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Rotate to the next creative variant on Meta', subtitle: 'IMMEDIATE', type: 'creative', completed: false },
        { id: 's2', title: 'Cap frequency on the fatigued unit', subtitle: 'PREVENT FURTHER DECAY', type: 'bidding', completed: false },
        { id: 's3', title: 'Reweight to fresher platforms', subtitle: 'STRATIS RANKS', type: 'budget', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // CREATIVE PERFORMANCE & FATIGUE — per-creative decay, geographic fit,
    // and delivery-vs-segment mismatches across the nameplate portfolio
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-tac-09-creative-geo-split',
      createdAt: at(2, '13:15:00'),
      enterprise: 'ford-canada', category: 'creative-performance',
      scope: 'brand',
      channels: ['ctv', 'facebook', 'instagram'],
      title: 'Creative A Wins Toronto/Calgary/Vancouver, Creative B Wins Montreal/Atlantic — Both Still Run Everywhere',
      summary: 'Breaking each creative\'s performance out by DMA, STRATIS found a clean geographic split: Creative A leads in Toronto, Calgary, and Vancouver, while Creative B leads in Montreal and the Atlantic markets. The divide tracks closely with language and regional culture, and Quebec behaves distinctly enough to warrant its own treatment. The view requires every region\'s results in one place, which is why it is hard to assemble by hand and easy for STRATIS. Today both creatives run broadly, which means several markets are seeing the lower-performing option for their geography. Assigning by DMA is low-risk and immediate.',
      evidence: [
        'Creative A leads in Toronto, Calgary, and Vancouver; Creative B leads in Montreal and the Atlantic markets',
        'Split tracks closely with language and regional culture — Quebec behaves distinctly enough to warrant its own treatment',
        'View requires every region\'s results in one place — hard to assemble by hand, easy for STRATIS',
        'Today both creatives run broadly — several markets see the lower-performing option for their geography',
        'Assigning by DMA is low-risk and immediate',
      ],
      confidence: 0.86,
      impactEstimate: 'Matching creative to geography by DMA stops several markets seeing the weaker option for their region; a quarterly re-read keeps the assignment current.',
      recommendedAction: 'Match creative to geography instead of running both everywhere. Assign by DMA and hold a quarterly read.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Assign Creative A to ON + AB + BC metros', subtitle: 'DMA-LEVEL', type: 'targeting', completed: false },
        { id: 's2', title: 'Assign Creative B to QC + Atlantic', subtitle: 'DMA-LEVEL', type: 'targeting', completed: false },
        { id: 's3', title: 'Re-read the geographic split quarterly', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-tac-10-mache-delivery',
      createdAt: at(0, '09:10:00'),
      enterprise: 'ford-canada', category: 'creative-performance',
      scope: 'product',
      productLine: 'mach-e',
      channels: ['ttd', 'instagram', 'ctv'],
      title: 'Mach-E\'s Top Creative for EV-Intenders Gets a Minority of Impressions — Delivery Is Optimizing to a Cheaper, Lower-Converting Audience',
      summary: 'Cross-referencing creative conversion by audience segment against impression share, STRATIS found the Mach-E variant that converts best among committed EV-intenders is receiving a minority of impressions, because delivery is optimizing toward a broader, cheaper audience that converts at a lower rate. The optimization is doing what it was told, just toward volume rather than the high-value segment. Conversion-by-segment and impression share normally live in different reports, so the mismatch goes unseen. Rebalancing delivery toward the segment the variant actually wins should lift consideration among the intenders that matter most.',
      evidence: [
        'The Mach-E variant that converts best among committed EV-intenders receives a minority of impressions',
        'Delivery is optimizing toward a broader, cheaper audience that converts at a lower rate',
        'The optimization is doing what it was told — toward volume, not the high-value segment',
        'Conversion-by-segment and impression share live in different reports, so the mismatch goes unseen',
        'Rebalancing toward the segment the variant wins should lift consideration among the intenders that matter most',
      ],
      confidence: 0.83,
      impactEstimate: 'Rebalancing delivery of the winning variant toward the high-intent EV segment, capped and reversible on the broad audience, is read on consideration lift at 14 days.',
      recommendedAction: 'Rebalance delivery toward the high-intent EV segment for the winning variant and measure consideration lift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Rebalance delivery to the high-intent segment', subtitle: 'WINNING VARIANT', type: 'targeting', completed: false },
        { id: 's2', title: 'Cap delivery to the low-converting broad audience', subtitle: 'REVERSIBLE', type: 'targeting', completed: false },
        { id: 's3', title: 'Read consideration lift at 14 days', subtitle: 'STRATIS REPORTS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-tac-11-scheduled-refresh',
      createdAt: at(4, '15:40:00'),
      enterprise: 'ford-canada', category: 'creative-performance',
      scope: 'brand',
      channels: ['facebook', 'instagram', 'ctv', 'tiktok'],
      title: '0 Nameplates Are on a Scheduled Creative Refresh — Every One Waits for CPL to Climb Before Replacing',
      summary: 'Looking across every nameplate\'s creative timeline, STRATIS found that refresh is consistently reactive: creative is replaced only after effectiveness has already fallen and cost-per-lead has begun to climb as a lagging signal. No nameplate is currently on a scheduled, fatigue-anticipating cadence. Because the pattern repeats across the portfolio, Ford pays the same avoidable fatigue tax again and again. A predictive calendar driven by per-creative decay curves flags each unit before it tips, turning a recurring loss into a scheduled, planned refresh.',
      evidence: [
        'Nameplates on a scheduled, fatigue-anticipating refresh cadence today: 0',
        'Creative is replaced only after effectiveness has fallen and cost-per-lead has begun to climb — a lagging signal',
        'Pattern repeats across the portfolio — Ford pays the same avoidable fatigue tax again and again',
        'A predictive calendar driven by per-creative decay curves flags each unit before it tips',
        'Piloting on the two highest-spend nameplates proves the saving first',
      ],
      confidence: 0.82,
      impactEstimate: 'A predictive refresh calendar that flags fatigue before cost-per-lead climbs turns a recurring, reactive loss into a scheduled, planned refresh — proven first on the two highest-spend nameplates.',
      recommendedAction: 'Move to a predictive refresh calendar where STRATIS flags fatigue before cost-per-lead climbs.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Build the predictive refresh calendar', subtitle: 'ALL NAMEPLATES', type: 'scheduling', completed: false },
        { id: 's2', title: 'Set fatigue-threshold alerts per creative', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
        { id: 's3', title: 'Pilot on the two highest-spend nameplates first', subtitle: 'PROVE THE SAVING', type: 'creative', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // AUDIENCE TARGETING & OVERLAP — shared-audience collisions and
    // portfolio frequency math across the Ford nameplate lineup
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-tac-12-tesla-conquest-overlap',
      createdAt: at(1, '08:45:00'),
      enterprise: 'ford-canada', category: 'audience-overlap',
      scope: 'brand',
      channels: ['ctv', 'ttd', 'instagram', 'facebook', 'google-search'],
      title: 'Lightning, Mach-E + F-150 Are All Targeting the Same Tesla-Conquest Audience — One Prospect, 3 Uncapped Ford Messages',
      summary: 'The same Tesla-conquest audience sits in three nameplates\' active targeting at the same time, so a single prospect can receive three uncoordinated Ford messages with no cap across them. Each campaign team sees only its own delivery, so combined frequency on the shared prospect runs well above the point of diminishing returns. STRATIS sees all three nameplates\' targeting at once, which is the only way the overexposure becomes visible. A portfolio-level cap plus a designated primary nameplate per segment ends the internal pile-on and recovers the wasted impressions, without reducing legitimate conquest reach.',
      evidence: [
        'The same Tesla-conquest audience sits in three nameplates\' active targeting at once: Lightning, Mach-E, F-150',
        'No frequency cap exists across the three — a single prospect can receive three uncoordinated Ford messages',
        'Each campaign team sees only its own delivery; combined frequency runs well above diminishing returns',
        'STRATIS sees all three nameplates\' targeting at once — the only way the overexposure becomes visible',
        'A portfolio cap plus a primary nameplate per segment ends the pile-on without cutting legitimate conquest reach',
      ],
      confidence: 0.90,
      impactEstimate: 'A portfolio-level frequency cap on shared conquest audiences plus a primary nameplate per segment recovers the wasted impressions from three uncoordinated Ford messages hitting one prospect.',
      recommendedAction: 'Implement a portfolio-level frequency cap on shared conquest audiences and assign a primary nameplate per segment.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Apply portfolio-level frequency cap', subtitle: 'SHARED CONQUEST AUDIENCES', type: 'bidding', completed: false },
        { id: 's2', title: 'Assign a primary nameplate per conquest segment', subtitle: 'ROUTING RULE', type: 'targeting', completed: false },
        { id: 's3', title: 'Monitor combined frequency continuously', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-tac-13-ev-considerer-overlap',
      createdAt: at(2, '09:00:00'),
      enterprise: 'ford-canada', category: 'audience-overlap',
      scope: 'brand',
      channels: ['google-search', 'facebook', 'instagram', 'ttd'],
      title: 'Escape PHEV + Mach-E Are Spending Against the Same EV-Considerer — They Convert Different Buyers and Should Be Sequenced',
      summary: 'Both nameplates target EV-considerers, but STRATIS\'s conversion-by-readiness data shows they convert different people: Escape PHEV wins the range-anxious EV-curious who are not ready for full electric, while Mach-E wins committed EV intenders. Running both against the blended audience means each spends against prospects the other would convert more efficiently, diluting both. Splitting the audience by readiness signal and sequencing the messages lets each nameplate spend where it is strongest, and gives the portfolio a logical ladder from hybrid curiosity to full EV.',
      evidence: [
        'Both nameplates target EV-considerers, but conversion-by-readiness shows they convert different people',
        'Escape PHEV wins the range-anxious "EV-curious" not ready for full electric',
        'Mach-E wins committed EV intenders',
        'Running both against the blended audience means each spends against prospects the other would convert more efficiently',
        'Splitting by readiness signal gives the portfolio a logical ladder from hybrid curiosity to full EV',
      ],
      confidence: 0.84,
      impactEstimate: 'Splitting the EV-considerer audience by readiness and sequencing PHEV to the EV-curious and Mach-E to committed intenders lets each nameplate spend where it is strongest; blended efficiency is measured against the prior approach.',
      recommendedAction: 'Split the audience by readiness signal and sequence the messaging — PHEV to the EV-curious, Mach-E to committed intenders.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Split the EV-considerer audience by readiness signal', subtitle: 'TWO TIERS', type: 'targeting', completed: false },
        { id: 's2', title: 'Route PHEV to EV-curious, Mach-E to intenders', subtitle: 'SEQUENCED', type: 'targeting', completed: false },
        { id: 's3', title: 'Measure blended efficiency vs prior approach', subtitle: 'STRATIS REPORTS', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // COMPETITIVE & MACRO INTELLIGENCE — external signals triangulated
    // against Ford search, reported as correlation, not cause
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-011-tesla-cybertruck-response',
      createdAt: at(0, '10:15:00'),
      enterprise: 'ford-canada', category: 'competitive-macro',
      scope: 'product',
      productLine: 'lightning',
      channels: ['ctv', 'google-search', 'ttd'],
      linkedNewsId: 'news-tesla-cybertruck-cut',
      title: 'Tesla Cuts Cybertruck by ~$8,400 in Canada — Lightning Comparison-Search Shifts in the Days After',
      summary: 'STRATIS\'s keyword scraping detected Tesla\'s Cybertruck price reduction in Canada and, in the days following, observed a measurable rise in Lightning-vs-Cybertruck comparison-shopping search. With 23 days remaining in the Lightning launch window, STRATIS is reporting this as a correlation in the window, not a causal claim on Lightning\'s value position, because comparison search has many drivers and the launch window is still open. The responsible move is a targeted comparison message to the prospects showing the new search behavior, held to a test scale, with STRATIS watching whether the shift persists before any larger commitment.',
      evidence: [
        'Tesla Cybertruck base price reduced ~$8,400 CAD in Canada (detected via competitor / keyword scraping)',
        'Lightning-vs-Cybertruck comparison-shopping search: measurable rise in the days following',
        'Reported as a correlation in the window — not a causal claim on Lightning\'s value position',
        'Lightning launch window: 23 days remaining',
        'Comparison search has many drivers; the launch window is still open',
      ],
      confidence: 0.86,
      impactEstimate: 'A test-scale Lightning value-and-capability comparison message to the affected search segment meets the shift where it is forming; STRATIS monitors whether it persists before any larger commitment.',
      recommendedAction: 'STRATIS is monitoring — activate a Lightning value-and-capability comparison message to the affected search segment. Monitor and scale only if the shift holds.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Activate comparison message to the affected segment', subtitle: 'TEST SCALE', type: 'creative', completed: false },
        { id: 's2', title: 'Brief lead agency on the response plan', subtitle: 'CONFIRM', type: 'creative', completed: false },
        { id: 's3', title: 'Continue monitoring the comparison-search signal', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-010-gas-price-phev-tailwind',
      createdAt: at(0, '07:30:00'),
      enterprise: 'ford-canada', category: 'competitive-macro',
      scope: 'product',
      productLine: 'escape-phev',
      channels: ['google-search', 'facebook', 'instagram'],
      title: 'Gas Above $1.65/L for 14+ Days Coincides With Rising Escape Hybrid/PHEV Organic Search',
      summary: 'Scraping fuel-price data alongside organic search, STRATIS observed that extended periods of elevated gas prices coincide with increased organic interest in Escape Hybrid and PHEV. This is reported as a correlation, not a causal relationship, since organic interest responds to many factors at once. The opportunity is to meet the demand that is already forming: weighting efficiency and fuel-savings messaging on the electrified Escape variants while the high-gas window lasts, and pulling back when it closes. Because it rides an existing signal rather than trying to create one, the move is low-cost and fully reversible.',
      evidence: [
        'National retail gasoline currently above the $1.65/L threshold for 14+ consecutive days',
        'Elevated-gas windows coincide with rising Escape Hybrid / PHEV organic search (correlation, not cause)',
        'Organic interest responds to many factors at once — reported as correlation only',
        'Move rides an existing demand signal rather than trying to manufacture one',
        'Fully reversible — pull back when the high-gas window closes',
      ],
      confidence: 0.84,
      impactEstimate: 'Leaning Escape Hybrid/PHEV efficiency messaging into the high-gas window while it persists meets demand that is already forming; a gas-price threshold trigger weights and pulls back automatically.',
      recommendedAction: 'STRATIS is monitoring — lean Escape Hybrid/PHEV efficiency messaging into the high-gas window while it persists. Fully reversible.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Weight Escape Hybrid/PHEV efficiency messaging', subtitle: 'WHILE WINDOW PERSISTS', type: 'budget', completed: false },
        { id: 's2', title: 'Set the gas-price threshold trigger', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
        { id: 's3', title: 'Pull back when the window closes', subtitle: 'AUTOMATED FLAG', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // LINCOLN — CMO-level insights for Lincoln Canada luxury division
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-lincoln-001-nautilus-rx-pivot',
      enterprise: 'lincoln',
      createdAt: today,
      category: 'portfolio-dynamics',
      scope: 'product',
      productLine: 'lincoln-nautilus',
      channels: ['ctv', 'ttd', 'google-search'],
      title: 'Conquest spend against Lexus RX no longer converting — pivot Nautilus dollars to Mercedes GLE and Audi Q7 segments',
      summary: 'Lexus RX loyalty hit a record 91% in Canada (J.D. Power Q1 study, May 4). Nautilus conquest flow from RX has dropped 4.1pp YoY. Continuing to spend against an audience that won\'t switch is value-destructive. STRATIS recommends reallocating Nautilus conquest spend to Mercedes GLE and Audi Q7 where loyalty is softer (78% and 74% respectively).',
      evidence: [
        'Lexus RX loyalty Q1 2026: 91% (record high, J.D. Power)',
        'Nautilus conquest flow from RX: −4.1pp YoY',
        'Mercedes GLE loyalty: 78% / Audi Q7 loyalty: 74%',
        'Current Nautilus conquest spend: $720K against RX, $310K against GLE/Q7 combined',
        'Conquest CPL — RX: $612 / GLE: $384 / Q7: $358',
      ],
      confidence: 0.86,
      impactEstimate: 'Reallocating $580K from RX-conquest to GLE+Q7-conquest projects +260 incremental Nautilus dealer leads at $372 blended CPL — 22% efficiency gain on conquest spend.',
      recommendedAction: 'Sunset RX-conquest creative immediately. Hudson Rouge produces new GLE and Q7 comparative cuts within 3 weeks. Maintain Lexus RX presence at $140K residual for any high-intent late-funnel signals.',
      status: 'new',
      linkedNewsId: 'news-lexus-rx-loyalty',
      actionSteps: [
        { id: 's1', title: 'Sunset Nautilus vs RX conquest', subtitle: 'PAUSE ACTIVE CREATIVE', type: 'creative', completed: false },
        { id: 's2', title: 'Brief Hudson Rouge on GLE + Q7 cuts', subtitle: '3-WEEK PRODUCTION TIMELINE', type: 'creative', completed: false },
        { id: 's3', title: 'Reallocate $580K to GLE/Q7 audiences', subtitle: 'TTD + GOOGLE SEARCH', type: 'budget', completed: false },
      ],
    },
    {
      id: 'ins-lincoln-002-aviator-x5-pricing',
      enterprise: 'lincoln',
      createdAt: at(0, '09:20:00'),
      category: 'macro-convergence',
      scope: 'product',
      productLine: 'lincoln-aviator',
      channels: ['ctv', 'google-search', 'ooh', 'spotify'],
      title: 'BMW X5 2027 redesign opens at CAD $74,900 — $4,200 below Aviator Reserve, compressing Lincoln\'s premium positioning',
      summary: 'BMW Canada announced 2027 X5 at $74,900 base — below current Aviator Reserve ($79,100). 38% of Aviator consideration funnel cross-shops with X5. The pricing move re-frames Aviator as the "premium" choice in price-conscious luxury — the opposite of how Lincoln has positioned the nameplate. STRATIS recommends accelerated value-narrative repositioning before X5 launch ramps in September.',
      evidence: [
        'BMW X5 2027 base price: CAD $74,900 (announced May 7)',
        'Aviator Reserve base price: CAD $79,100 (current)',
        'Aviator ↔ X5 consideration overlap: 38%',
        'X5 launch ramp: September 2026 (~120 days)',
        'Current Aviator creative emphasizes performance + quietness — does not address pricing perception',
      ],
      confidence: 0.83,
      impactEstimate: 'Value-narrative repositioning (lead with "every feature standard that\'s a $5K option on X5") projects +320 Aviator leads in conquest segments over the X5 launch window.',
      recommendedAction: 'Brief Hudson Rouge on revised Aviator value narrative: standard-equipment story vs. X5 a-la-carte trim ladder. Activate within 5 weeks (before X5 launch ramp). CTV + Search + OOH coordinated.',
      status: 'new',
      linkedNewsId: 'news-lincoln-bmw-x5-redesign',
      actionSteps: [
        { id: 's1', title: 'Brief Hudson Rouge on value-narrative shift', subtitle: 'STANDARD-EQUIPMENT POSITIONING', type: 'creative', completed: false },
        { id: 's2', title: 'Activate value creative across CTV + Search + OOH', subtitle: 'BEFORE SEPT X5 LAUNCH', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-lincoln-003-corsair-quebec-french',
      enterprise: 'lincoln',
      createdAt: at(2, '14:10:00'),
      category: 'agency-arbitrage',
      scope: 'product',
      productLine: 'lincoln-corsair',
      channels: ['instagram', 'facebook', 'spotify'],
      title: 'Cossette Luxury\'s Quebec French-language Corsair creative outperforms Hudson Rouge\'s adapted version by 2.3x ThruPlay',
      summary: 'Lincoln Corsair runs two French-Quebec creative tracks: Cossette Luxury\'s original-French cut and Hudson Rouge\'s translated-from-English cut. Cossette\'s version delivers 2.3x the ThruPlay completion rate and 1.8x the qualified site sessions, but only receives 22% of Quebec Corsair impression weight because budgets default to AOR ownership.',
      evidence: [
        'Cossette Luxury Quebec Corsair — ThruPlay rate: 41.8%',
        'Hudson Rouge translated cut — ThruPlay rate: 17.9%',
        'Cossette qualified-session lift: 1.8x',
        'Current Quebec impression weight: 22% Cossette / 78% Hudson Rouge',
        'Quebec is Corsair\'s second-strongest market (after Ontario)',
      ],
      confidence: 0.81,
      impactEstimate: 'Reweighting Quebec Corsair to 75% Cossette / 25% Hudson Rouge captures +14K additional ThruPlays and +280 qualified sessions at flat $1.8M Quebec spend.',
      recommendedAction: 'Reweight Quebec Corsair impression share to performance-based (75/25 Cossette/Hudson Rouge). Codify that Cossette Luxury owns Quebec French-creative production for Lincoln, with Hudson Rouge retaining English-Canada national lead.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Reweight Quebec Corsair to 75/25 Cossette/Hudson Rouge', subtitle: 'INSTAGRAM + FACEBOOK + SPOTIFY', type: 'creative', completed: false },
        { id: 's2', title: 'Codify Cossette as Lincoln QC French AOR', subtitle: 'POLICY CHANGE Q3', type: 'creative', completed: false },
      ],
    },
    {
      id: 'ins-lincoln-004-luxury-tax-window',
      enterprise: 'lincoln',
      createdAt: at(1, '11:00:00'),
      category: 'macro-convergence',
      scope: 'brand',
      channels: ['google-search', 'instagram', 'spotify', 'ctv'],
      title: 'Federal luxury tax threshold rises CAD $108K on July 1 — Aviator Black Label and Navigator Reserve trims gain a $4K–$8K friction removal',
      summary: 'Federal luxury vehicle tax threshold rises from $100K to $108K effective July 1, 2026 (announced May 1). Several top-trim Aviator Black Label and Navigator Reserve configurations that previously cleared the threshold by $2K–$8K will no longer be taxable. STRATIS recommends a focused 90-day creative push leading with "no luxury tax" positioning for affected trims.',
      evidence: [
        'Luxury tax threshold change: $100K → $108K effective July 1, 2026',
        'Aviator Black Label most-popular configurations: $102K–$106K (now untaxed)',
        'Navigator Reserve configurations: $104K–$112K (mixed effect)',
        'Average tax saved on Aviator Black Label: $4.2K–$6.8K',
        'Window before tax framing becomes normalized: 60-90 days',
      ],
      confidence: 0.84,
      impactEstimate: 'Activating a 90-day "no luxury tax" creative push projects +280 incremental Q3 Aviator Black Label dealer leads, with avg consideration-to-lead conversion lifting from 8.1% to 11.4% on affected trims.',
      recommendedAction: 'Brief Hudson Rouge on a 90-day creative push leading with the tax-removal framing. Activate July 1 across Search, Instagram, Spotify, CTV. Coordinate dealer co-op with VIN-level eligibility messaging.',
      status: 'new',
      linkedNewsId: 'news-luxury-tariff-relief',
      actionSteps: [
        { id: 's1', title: 'Brief Hudson Rouge on tax-removal creative', subtitle: 'AVIATOR BLACK LABEL + NAVIGATOR RESERVE', type: 'creative', completed: false },
        { id: 's2', title: 'Activate July 1 across CTV + Search + Spotify', subtitle: '90-DAY FLIGHT', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-lincoln-005-navigator-conquest-bmw',
      enterprise: 'lincoln',
      createdAt: at(3, '15:30:00'),
      category: 'portfolio-dynamics',
      scope: 'product',
      productLine: 'lincoln-navigator',
      channels: ['ctv', 'ooh', 'linkedin'],
      title: 'Navigator and Aviator are both targeting Conquest — BMW audience — Navigator should own this segment outright',
      summary: 'Both Navigator and Aviator are simultaneously active against the Conquest — BMW audience in Tier 1 CTV. Audience overlap is 84% — these are the same buyers. Navigator\'s aggregate frequency on this audience is 12x/week, Aviator\'s is 9x/week — combined 21x, well above the 8x luxury cap. Brand-recall testing shows aggregated frequency dilutes both nameplates\' positioning.',
      evidence: [
        'Conquest — BMW audience size: 47K Canadian profiles',
        'Navigator frequency: 12x/wk · Aviator frequency: 9x/wk · combined: 21x/wk',
        'Luxury-segment optimal cap: 8x/wk (Hudson Rouge benchmark)',
        'Brand recall in dual-targeted cohort: −18% vs single-nameplate cohort',
        'Lincoln nameplate substitution math: Navigator wins on Conquest — BMW (higher consideration), Aviator wins on Conquest — Audi',
      ],
      confidence: 0.85,
      impactEstimate: 'Designating Navigator as exclusive nameplate for Conquest — BMW (Aviator suppresses) cuts frequency to 12x and projects +14pp brand recall, plus $410K in recovered impression spend.',
      recommendedAction: 'Implement nameplate-exclusive audience policy at Lincoln: Navigator → Conquest BMW; Aviator → Conquest Audi; Nautilus → Conquest Mercedes/Lexus; Corsair → Conquest Audi/Lexus entry-luxury. Configure via TTD audience-suppression API.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Implement Lincoln nameplate-exclusive audience policy', subtitle: 'PORTFOLIO POLICY CHANGE', type: 'targeting', completed: false },
        { id: 's2', title: 'Configure TTD audience suppression', subtitle: 'NAVIGATOR / AVIATOR / NAUTILUS / CORSAIR', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-lincoln-006-aviator-launch-q3-prep',
      enterprise: 'lincoln',
      createdAt: at(4, '10:45:00'),
      category: 'launch-calendar',
      scope: 'product',
      productLine: 'lincoln-aviator',
      channels: ['ctv', 'ooh', 'spotify', 'google-search'],
      title: 'Aviator 2027 refresh launches in 84 days — current Tier 1 weight is 0.7x of competitive set average',
      summary: 'Aviator 2027 refresh launches August 1. STRATIS rolled up confirmed BMW X5 launch ($14.2M Tier 1 weight), Audi Q7 refresh ($9.8M), and Lexus RX hybrid push ($11.6M) for the same window. Aviator current planned weight is $7.8M — 0.7x the average competitive launch weight. Without a surge, Aviator launch will be SOV-disadvantaged in CTV.',
      evidence: [
        'Aviator 2027 launch: August 1, 2026 (84 days out)',
        'BMW X5 launch weight: $14.2M / Audi Q7 refresh: $9.8M / Lexus RX hybrid: $11.6M',
        'Aviator current planned weight: $7.8M Tier 1 (under-weighted)',
        'Luxury CTV CPM in launch windows: $76 (1.8x normal)',
        'Available surge sources: Corsair always-on ($1.4M slack), Nautilus mid-funnel ($800K slack)',
      ],
      confidence: 0.82,
      impactEstimate: 'A $2.6M Aviator surge (pulled from Corsair always-on + Nautilus mid-funnel slack) brings Aviator to 1:1 SOV vs competitive avg and lifts launch probability +19pp.',
      recommendedAction: 'Reallocate $2.6M from Corsair always-on + Nautilus mid-funnel into Aviator launch CTV + OOH for the 60-day launch window. Hudson Rouge executes. Brief Corsair team that always-on resumes in October.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Reallocate $2.6M to Aviator launch', subtitle: 'FROM CORSAIR + NAUTILUS SLACK', type: 'budget', completed: false },
        { id: 's2', title: 'Brief Hudson Rouge on launch SOV plan', subtitle: '1:1 vs COMPETITIVE AVG', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // DEALERSHIP NETWORK — Corporate-admin "wow" insights derived from
    // cross-dealer pattern recognition across all 890 dealers. The CMO of
    // the network reads these to make holistic strategic decisions.
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-dn-001-pioneer-cohort',
      enterprise: 'dealership-network',
      createdAt: today,
      category: 'agency-arbitrage',
      scope: 'brand',
      channels: ['instagram', 'facebook', 'tiktok'],
      title: '32 dealers across the network independently adopted vertical-video-first Meta creative — and they\'re outperforming the rest 2.5x. Roll the playbook out',
      summary: 'STRATIS scanned every dealer\'s creative composition and noticed an unintended pattern: 32 dealers (3.6% of the network) — spread across all six regions, with no coordinated direction — independently shifted to a 60%+ vertical-video creative mix in Q1. Their ThruPlay rate is 41.2% vs. network average 16.8%, and they generate +84% qualified site sessions. This is a network-wide best practice waiting to be discovered. The CMO can codify it tomorrow.',
      evidence: [
        'Pioneer cohort: 32 dealers identified by STRATIS clustering — none knew the others were doing it',
        'Geographic spread: 11 ON, 7 QC, 6 BC, 5 AB, 2 Atlantic, 1 Prairies',
        'Avg vertical-video share: 68% (vs. network 22%)',
        'ThruPlay rate: 41.2% (vs. network 16.8% — 2.5x lift)',
        'Qualified site sessions: +84% vs. matched control (similar dealer size + region)',
        '100% of pioneers also have compliant brand-mark usage — operational excellence correlates',
      ],
      confidence: 0.89,
      impactEstimate: 'Codifying the pioneer playbook as a network template + auto-deploy via co-op portal projects +$4.6M in annual dealer leads. Estimated adoption: 60% of network within 2 quarters.',
      recommendedAction: 'Cossette produces a vertical-video template kit modeled on the 32 pioneers\' winning creative. Auto-deploy to all 890 dealers via the co-op portal with a one-click activation. Quarterly Dealer Council readout shows which dealers adopted + their lift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Reverse-engineer pioneer playbook into a template kit', subtitle: 'COSSETTE — 4 WEEK TIMELINE', type: 'creative', completed: false },
        { id: 's2', title: 'Auto-deploy via co-op portal one-click activation', subtitle: 'TARGET 60% ADOPTION IN 2 QUARTERS', type: 'targeting', completed: false },
        { id: 's3', title: 'Recognize 32 pioneer dealers at next Dealer Council', subtitle: 'BUILDS NETWORK GOODWILL', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-002-flagship-halo',
      enterprise: 'dealership-network',
      createdAt: at(0, '09:30:00'),
      category: 'tier-choreography',
      scope: 'brand',
      channels: ['ctv', 'ooh', 'google-search', 'facebook'],
      title: 'When metro-flagship dealers run inventory campaigns, satellite dealers within 50km gain a 14% organic traffic lift — but the timing is uncoordinated, leaving $3.8M of halo on the table',
      summary: 'STRATIS correlated 18 months of metro-flagship campaign flights with surrounding dealers\' organic site traffic and found a clean halo signature: every flagship CTV + OOH campaign creates a +14% organic lift on satellite dealers within a 50km radius for ~10 days after the flight. Today the flagships and satellites schedule independently — meaning halos often land when satellites are stocked-out, or satellites peak their own spend when no halo is active. Coordinated calendar = recovered $3.8M in network value.',
      evidence: [
        'Metro-flagship dealers: 53 (6% of network) — verified by dealer-type classification',
        'Halo radius: 50km — measured via geo-attribution lift on satellite organic traffic',
        'Organic traffic lift on satellites within radius: +14% over 10-day window (n=47 flights)',
        'Flagship campaign frequency: ~3x/year per flagship, ad-hoc timing',
        'Misalignment cost: 38% of flights land while ≥3 satellites are stocked-out',
        'Coordinated-calendar value recovery: $3.8M projected',
      ],
      confidence: 0.84,
      impactEstimate: 'Synchronizing flagship flights with satellite inventory readiness + co-op surge windows recovers $3.8M in halo lift annually, with no incremental media spend.',
      recommendedAction: 'Build a Flagship Halo Calendar in STRATIS that visualizes flagship flight windows + satellite inventory readiness in one view. Mindshare orchestrates flagship timing 30 days ahead. Satellite dealers receive auto-alerts to surge their local Search during halo windows.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Stand up Flagship Halo Calendar', subtitle: 'STRATIS — INVENTORY × FLIGHT VIEW', type: 'scheduling', completed: false },
        { id: 's2', title: 'Mindshare schedules flagships 30 days ahead', subtitle: 'POLICY CHANGE', type: 'scheduling', completed: false },
        { id: 's3', title: 'Auto-alert satellite dealers of halo windows', subtitle: 'CO-OP PORTAL NOTIFICATION', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-dn-003-top-performer-decoded',
      enterprise: 'dealership-network',
      createdAt: at(1, '08:45:00'),
      category: 'agency-arbitrage',
      scope: 'brand',
      channels: ['google-search', 'facebook'],
      title: 'STRATIS analyzed the top 89 performing dealers and decoded 3 invisible commonalities. None were intentionally coordinated. This is the network playbook',
      summary: 'The CMO has been asking "what makes our best dealers our best dealers?" STRATIS clustered the top 10% (89 dealers) on CPL efficiency and found three commonalities they all share independently: (1) Radio spend below 8% of mix, (2) Google Search share at or above 35%, and (3) a Service email cadence of exactly 4 weeks. None of these dealers know about each other\'s strategy. Codifying these 3 levers as the official network playbook is the single highest-leverage strategic move available.',
      evidence: [
        'Top 89 dealers (10%): 2.1x CPL efficiency vs. network — but no two operate identically in other respects',
        'Common signal #1: Radio spend <8% of mix (network avg 18%)',
        'Common signal #2: Google Search share ≥35% of mix (network avg 24%)',
        'Common signal #3: Service email cadence at 4-week intervals (network varies 1–12 weeks)',
        'These three signals were not part of any documented playbook — pure independent emergence',
        'Lift potential if bottom-quartile dealers adopt: 28% CPL improvement = $5.2M aggregate annual saving',
      ],
      confidence: 0.86,
      impactEstimate: 'Codifying the 3 levers as the official network playbook + supporting bottom-quartile dealers on adoption projects $5.2M in annual CPL efficiency gain across the network.',
      recommendedAction: 'Publish the "Network Playbook" as a one-page benchmark. Build a STRATIS scorecard for each dealer showing their current vs. target on the 3 levers. Prioritize bottom-quartile dealers for white-glove onboarding to the playbook.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Publish the Network Playbook', subtitle: '3 LEVERS, ONE PAGE', type: 'creative', completed: false },
        { id: 's2', title: 'Build per-dealer Playbook Scorecard in STRATIS', subtitle: 'DEALER PORTAL', type: 'targeting', completed: false },
        { id: 's3', title: 'White-glove onboarding for bottom-quartile dealers', subtitle: 'FIELD TEAM PRIORITY', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-004-service-sales-bridge',
      enterprise: 'dealership-network',
      createdAt: at(2, '11:00:00'),
      category: 'portfolio-dynamics',
      scope: 'brand',
      channels: ['facebook', 'google-search'],
      title: '18 dealers run a "Service Today, Sales Tomorrow" cross-sell motion that converts service customers into next-vehicle buyers at 3.4x the network rate — replicate it and unlock $58M in 5-year LTV',
      summary: 'The single most underused asset in the dealership network is the service customer database. 18 dealers (across BC, ON, QC and AB) figured out independently that emailing service customers a "trade-up" offer 6 weeks before their next service date converts them into test-drives at 11.2% — vs. the network rate of 3.3%. Replicating this single motion across all 890 dealers projects 14,000 incremental test drives a year and 5,200 incremental vehicle sales — $58M in 5-year LTV.',
      evidence: [
        '18 dealers identified running this motion (no coordination, no documented strategy)',
        'Trigger: 6-week pre-service trade-up email (auto-generated from DMS data)',
        'Test-drive conversion rate: 11.2% (vs. 3.3% network)',
        'Vehicle sale conversion from test-drive: 37%',
        'Avg service customer LTV (service alone): $4,200 over 5 years',
        'Avg vehicle sale value: $44K',
        'Network-wide projection if replicated: +14,000 test drives, +5,200 vehicles, $58M 5-yr LTV',
      ],
      confidence: 0.85,
      impactEstimate: 'Standardizing the "Service Today, Sales Tomorrow" cross-sell motion across all 890 dealers projects $58M in 5-year LTV from service-to-sales conversion alone.',
      recommendedAction: 'Build the cross-sell trigger into the standard DMS integration. Auto-deploy the email template (Cossette produces) to all dealers as opt-out (vs. opt-in) so adoption is automatic. Recognize the 18 originating dealers in the next Dealer Council.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Build cross-sell trigger into DMS integration', subtitle: 'AUTO-FIRES 6 WK PRE-SERVICE', type: 'targeting', completed: false },
        { id: 's2', title: 'Cossette produces standardized trade-up template', subtitle: 'LOCALIZED PER REGION', type: 'creative', completed: false },
        { id: 's3', title: 'Opt-out (not opt-in) network-wide rollout', subtitle: 'AUTO-ENROLL ALL 890', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-005-qew-corridor-cluster',
      enterprise: 'dealership-network',
      createdAt: at(2, '14:20:00'),
      category: 'portfolio-dynamics',
      scope: 'brand',
      channels: ['google-search', 'instagram', 'facebook'],
      title: '23 dealers along the QEW corridor share an identical buyer profile (47% cross-shop with Toyota Highlander) — yet each runs uncoordinated creative. Coordinated conquest = +$2.4M',
      summary: 'STRATIS clustered customer-journey data across all 890 dealers and surfaced a hidden pattern: the 23 Ford dealers along the Lake Ontario / QEW corridor (Niagara Falls → Burlington → Oakville → Toronto → Whitby → Oshawa) share an identical buyer profile — 47% cross-shop with Toyota Highlander vs. the network average of 18%. They\'re fighting the same battle independently. A coordinated comparative-creative push specific to this corridor — naming Highlander explicitly — would lift conquest share dramatically.',
      evidence: [
        'QEW corridor cluster: 23 Ford dealers identified via customer-journey clustering',
        'Cross-shop with Toyota Highlander: 47% (vs. network 18%)',
        'Cross-shop with anything else: under 12%',
        'Currently 0 coordinated creative — each runs generic Family-SUV ads',
        'Estimated lift from coordinated Highlander-comparative creative: +19% conquest share',
        'Aggregate value: $2.4M / year additional Explorer + Bronco conquest sales',
      ],
      confidence: 0.81,
      impactEstimate: 'A QEW Corridor Pack of comparative creative (Explorer vs. Highlander, Bronco vs. Highlander) deployed exclusively to these 23 dealers projects +$2.4M in annual conquest sales.',
      recommendedAction: 'Cossette + Mindshare jointly produce a "QEW Corridor Pack" — Highlander-comparative creative localized to each city in the corridor. Auto-deploy via co-op portal to the 23 dealers. Quarterly readout on conquest-share lift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Produce QEW Corridor Pack (Highlander-comparative)', subtitle: 'COSSETTE + MINDSHARE — 6 WK', type: 'creative', completed: false },
        { id: 's2', title: 'Auto-deploy to the 23 corridor dealers', subtitle: 'CO-OP PORTAL', type: 'targeting', completed: false },
        { id: 's3', title: 'Apply same clustering analysis to other regions', subtitle: 'CALGARY/EDMONTON CORRIDOR NEXT', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-006-coop-stranded',
      enterprise: 'dealership-network',
      createdAt: at(3, '10:00:00'),
      category: 'macro-convergence',
      scope: 'brand',
      channels: ['google-search', 'facebook', 'instagram'],
      title: '142 dealers used less than 50% of their Q1 co-op fund because the claim process requires 8 manual steps. Auto-claim unlocks $4.8M in stranded marketing investment',
      summary: 'Corporate has been allocating co-op funds in good faith — but STRATIS pulled the actual claim data and found that 142 dealers (16% of network) claimed less than 50% of their available Q1 co-op. Field interviews surfaced the cause: the claim workflow requires 8 manual steps including paper invoice submission. The unused co-op is real money that disappears every quarter. Auto-claiming via STRATIS direct-API integration to dealers\' Google Ads + Meta accounts unlocks $4.8M of stranded investment annually with zero incremental budget.',
      evidence: [
        'Q1 co-op fund avg per dealer: $14K',
        'Q1 actual claim rate per dealer avg: 67% (network)',
        'Dealers claiming <50%: 142 of 890 (16%)',
        'Top reason for under-claim (per dealer survey): "claim workflow takes too long"',
        'Auto-claim adoption willingness: 84% per pre-survey of affected dealers',
        'Stranded Q1 co-op: $4.8M aggregated',
        'Projected if auto-claimed: +18,000 incremental dealer leads',
      ],
      confidence: 0.87,
      impactEstimate: 'STRATIS auto-claim integration unlocks $4.8M in stranded co-op funds annually and converts them to +18,000 dealer leads with no incremental budget.',
      recommendedAction: 'Build STRATIS auto-claim direct integration with Google Ads + Meta Ads Manager. Co-op claim becomes opt-out rather than opt-in. Field roll-out targeting the 142 high-stranded dealers first; expand to network within 90 days.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Build STRATIS auto-claim API integration', subtitle: 'GOOGLE ADS + META', type: 'targeting', completed: false },
        { id: 's2', title: 'Convert co-op claim to opt-out', subtitle: 'POLICY CHANGE', type: 'targeting', completed: false },
        { id: 's3', title: 'Field-priority outreach to 142 high-stranded dealers', subtitle: 'WHITE-GLOVE ONBOARDING', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-007-toronto-dma-auction',
      enterprise: 'dealership-network',
      createdAt: at(3, '16:15:00'),
      category: 'tier-choreography',
      scope: 'division',
      division: 'tier-3',
      productLine: 'dn-ontario-rollup',
      channels: ['google-search'],
      title: '4,200 weekly Toronto-DMA Search auctions have multiple Ford dealers bidding against each other — Ford pays both sides, $4.4M annual self-tax',
      summary: 'STRATIS reconstructed Google Ads auction logs across the 47 Ford dealers in the Toronto DMA and found that 4,200 weekly auctions have ≥2 Ford dealer accounts bidding on the same brand-term keyword simultaneously. The CPC inflates by an average $2.10 per auction from the intra-Ford competition. Aggregate self-tax: $4.4M / year in Toronto alone. Same pattern detected in Vancouver (1,800/wk), Montreal (2,100/wk), Calgary (1,400/wk) — total $11.8M / yr nationally.',
      evidence: [
        'Toronto DMA Ford dealers: 47',
        'Multi-dealer auctions/week (intra-Ford): 4,200',
        'Average CPC inflation when multiple Ford dealers bid: +$2.10',
        'Annual auction self-tax in Toronto DMA alone: $4.4M',
        'National pattern: VAN 1,800/wk, MTL 2,100/wk, CGY 1,400/wk',
        'Aggregate national self-tax: $11.8M / year',
      ],
      confidence: 0.88,
      impactEstimate: 'A coordinated DMA-level negative-keyword + geo-fence map (each dealer owns a slice of brand-term auctions in their primary trade area) recovers $11.8M nationally per year.',
      recommendedAction: 'Roll out STRATIS-managed DMA territory assignments. Each dealer\'s Google Ads account inherits a negative-keyword + geo-fence template. Dealer Council approves territories before rollout to maintain dealer trust.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Generate Toronto DMA territory assignments', subtitle: '47 DEALERS, BRAND-TERM SLICING', type: 'targeting', completed: false },
        { id: 's2', title: 'Present territory map to Dealer Council', subtitle: 'JUNE COUNCIL MEETING', type: 'targeting', completed: false },
        { id: 's3', title: 'Phased rollout to Vancouver, Montreal, Calgary', subtitle: 'Q3 ROLLOUT PLAN', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-dn-008-cottage-seasonality',
      enterprise: 'dealership-network',
      createdAt: at(4, '12:30:00'),
      category: 'launch-calendar',
      scope: 'brand',
      channels: ['facebook', 'instagram', 'google-search'],
      title: '27 dealers in cottage / lake regions have inverted seasonal demand — they peak in summer, not in the spring buying season. Network calendar misalignment costs $1.8M / year',
      summary: 'STRATIS noticed an unusual signal: 27 dealers in cottage and lake regions (Muskoka, Lower Mainland Vancouver Island, Bras d\'Or, Okanagan Valley) have inverted seasonality — their demand peaks in May–September, NOT in the national March-spring-buying-season pattern. They get the same co-op calendar as the rest of the network, meaning they\'re running heavy media in March when their buyers aren\'t shopping, and dim media in July when buyers are flooding their lots. Hidden cohort, fixable with one calendar split.',
      evidence: [
        '27 dealers identified across Muskoka, Lower Mainland, Bras d\'Or, Okanagan',
        'Q2-Q3 (summer) demand: 1.6x Q4-Q1 (winter)',
        'Network norm: spring peak (March)',
        'Currently their co-op spend follows network norm — peaks in March',
        'Misalignment: heavy spend during low-demand months, dim spend during peak demand',
        'Annual loss: $1.8M (modeled from CPL × misallocated impressions)',
      ],
      confidence: 0.83,
      impactEstimate: 'Splitting the co-op calendar for the 27 cottage-region dealers (May-Sept heavy, Nov-Feb dim) recovers $1.8M annually in better-timed lead acquisition.',
      recommendedAction: 'Define a "Cottage Country Calendar" as a second co-op calendar variant. Auto-assign the 27 affected dealers based on geographic clustering. Quarterly readout on lift. Also flag any future dealers that match the geographic signature.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Define Cottage Country co-op calendar', subtitle: 'MAY-SEPT HEAVY, NOV-FEB DIM', type: 'scheduling', completed: false },
        { id: 's2', title: 'Auto-assign 27 cottage-region dealers', subtitle: 'GEOGRAPHIC CLUSTERING', type: 'targeting', completed: false },
        { id: 's3', title: 'Codify geo-flagging for future dealer onboarding', subtitle: 'STRATIS AUTO-DETECT', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-009-quebec-french-compliance',
      enterprise: 'dealership-network',
      createdAt: at(5, '09:15:00'),
      category: 'macro-convergence',
      scope: 'division',
      division: 'tier-3',
      productLine: 'dn-quebec-rollup',
      channels: ['google-search', 'facebook', 'instagram'],
      title: '64 Quebec dealers at OQLF compliance risk by Dec 31 — coordinated Cossette template saves $768K vs. dealer-by-dealer scramble',
      summary: 'OQLF\'s updated digital-advertising compliance requires French-first creative by December 31, 2026. STRATIS audited Quebec dealer creative inventory and identified 64 dealers (42% of QC network) running English-first or bilingual-with-English-prominence creative. Without coordination each will face a Q4 production scramble at $18K/dealer; with a Cossette-led template + customization system the cost drops to $6K/dealer. Same compliance outcome, $768K saved network-wide.',
      evidence: [
        'OQLF compliance deadline: December 31, 2026',
        'Quebec dealers at risk: 64 of 152 (42%)',
        'Average dealer-level creative production cost (independent): $18K',
        'Coordinated Cossette production cost (template + customization): $6K/dealer',
        'Total savings via coordinated approach: $768K',
        'Network compliance risk after coordinated rollout: effectively zero',
      ],
      confidence: 0.84,
      impactEstimate: 'Coordinated Cossette French creative production saves $768K vs. independent dealer-by-dealer scrambles, and reduces network compliance risk to effectively zero.',
      recommendedAction: 'Cossette builds a template + customization French-creative system. Quebec dealers opt in for $6K/year subscription replacing $18K independent cost. Rollout begins September; full network compliant by November 30.',
      status: 'new',
      linkedNewsId: 'news-dn-quebec-french-creative-mandate',
      actionSteps: [
        { id: 's1', title: 'Cossette builds template+custom French creative system', subtitle: 'SEPT–NOV TIMELINE', type: 'creative', completed: false },
        { id: 's2', title: 'Field 64-dealer subscription outreach', subtitle: 'AUG ENROLLMENT', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-010-brand-mark-drift',
      enterprise: 'dealership-network',
      createdAt: at(6, '15:30:00'),
      category: 'agency-arbitrage',
      scope: 'brand',
      channels: ['facebook', 'instagram', 'google-search'],
      title: '142 dealer creatives across the network are running outdated 2023 Ford brand-mark lockups — invisible to corporate without STRATIS, $1.8M brand-equity dilution',
      summary: 'STRATIS scanned 890 dealers\' active creative across Meta + Google in real time and identified 142 ads still using the 2023 Ford brand-mark lockup (replaced February 2025). They\'re running an aggregate 14M monthly impressions — every one of them dilutes brand consistency. The drift is structurally invisible to corporate because dealers don\'t flag it and there\'s no automated scanner anywhere in the dealer ecosystem. STRATIS just made it visible.',
      evidence: [
        'Outdated brand-mark creatives detected: 142 active across 89 dealers',
        'Aggregate monthly impressions: 14M',
        'Concentration: independently-managed dealer-side creative (not co-op-approved)',
        'Avg creative age: 18 months (predates 2025 brand refresh)',
        'No existing automated brand-compliance scanner in dealer ecosystem prior to STRATIS',
      ],
      confidence: 0.84,
      impactEstimate: 'Remediating brand-mark violations within 60 days prevents an estimated $1.8M in brand-equity dilution. STRATIS continuous brand-mark scan prevents recurrence at no incremental cost.',
      recommendedAction: 'Generate per-dealer remediation notices with replacement creative attached (Cossette provides). Field outreach over 30 days; auto-flag any new creatives that revert. Codify continuous STRATIS brand-mark monitoring as a network service.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Generate 142 remediation notices with replacement assets', subtitle: 'COSSETTE-PROVIDED CREATIVE', type: 'creative', completed: false },
        { id: 's2', title: 'Field 30-day outreach + tracking', subtitle: 'DEALER-BY-DEALER', type: 'targeting', completed: false },
        { id: 's3', title: 'Codify continuous brand-mark monitoring', subtitle: 'STRATIS AUTO-SCAN — NETWORK SERVICE', type: 'targeting', completed: false },
      ],
    },

    // ── Cross-industry agency clients (authored in src/lib/clients/*) ──
    ...RBC_INSIGHTS,
    ...MOLSON_COORS_INSIGHTS,
    ...LULULEMON_INSIGHTS,
    ...TIM_HORTONS_INSIGHTS,
  ];
}

// ===== Main Data Store =====
export interface MockDataStore {
  campaigns: Campaign[];
  dailyData: Record<string, Record<string, DailyMetrics[]>>;
  newsItems: NewsItem[];
  insights: Insight[];
  anomalies: Anomaly[];
}

const cachedStores: Partial<Record<EnterpriseId, MockDataStore>> = {};

export function generateAllData(enterpriseId: EnterpriseId = 'ford-canada'): MockDataStore {
  const cached = cachedStores[enterpriseId];
  if (cached) return cached;

  const enterpriseCampaignDefs = CAMPAIGN_DEFS.filter((def) => def.enterprise === enterpriseId);

  const campaigns: Campaign[] = enterpriseCampaignDefs.map(def => ({
    id: def.id,
    name: def.name,
    enterprise: def.enterprise,
    division: def.division,
    agency: def.agency,
    productLine: def.productLine,
    audiences: def.audiences,
    objective: def.objective,
    status: def.status,
    channels: def.channels,
    geos: def.geos,
    startDate: format(START_DATE, 'yyyy-MM-dd'),
    plannedBudget: def.plannedBudget,
  }));

  const dailyData = generateDailyData(enterpriseCampaignDefs);
  const anomalies = detectAnomalies(dailyData, enterpriseCampaignDefs);
  const allNews = generateNews();
  const newsItems = allNews.filter((n) => n.enterprises.includes(enterpriseId));
  const allInsights = generateInsights(anomalies);
  const baseInsights = allInsights.filter((i) => i.enterprise === enterpriseId);
  const radarInsights = generateMarketRadarInsights(newsItems, baseInsights, enterpriseId);
  const insights = [...radarInsights, ...baseInsights];

  const store: MockDataStore = { campaigns, dailyData, newsItems, insights, anomalies };
  cachedStores[enterpriseId] = store;
  return store;
}

// ===== Market Radar — top 3 most impactful news items, surfaced as insight cards =====
const RADAR_PINNED_BY_ENTERPRISE: Record<EnterpriseId, string[]> = {
  'ford-canada': ['news-tesla-cybertruck-cut', 'news-izev-extension', 'news-gm-silverado-fleet'],
  'lincoln': ['news-lincoln-bmw-x5-redesign', 'news-luxury-tariff-relief', 'news-lexus-rx-loyalty'],
  'dealership-network': ['news-dn-ontario-coop-program-update', 'news-dn-google-vehicle-listing-ads', 'news-dn-quebec-french-creative-mandate'],
  'rbc': RBC_RADAR_PINS,
  'molson-coors': MOLSON_COORS_RADAR_PINS,
  'lululemon': LULULEMON_RADAR_PINS,
  'tim-hortons': TIM_HORTONS_RADAR_PINS,
};

function generateMarketRadarInsights(news: NewsItem[], existingInsights: Insight[], enterpriseId: EnterpriseId): Insight[] {
  const pinnedIds = RADAR_PINNED_BY_ENTERPRISE[enterpriseId] ?? [];
  const pinned = pinnedIds
    .map((id) => news.find((n) => n.id === id))
    .filter((n): n is NewsItem => Boolean(n));

  return pinned.map((item, idx) => {
    const linkedInsight = existingInsights.find((i) => i.linkedNewsId === item.id);
    const channelHint: ChannelId[] =
      item.tags.includes('ev') ? ['ctv', 'google-search', 'ttd'] :
      item.tags.includes('izev') ? ['google-search', 'facebook', 'instagram'] :
      ['ctv', 'google-search'];

    const radarSubtitle = linkedInsight
      ? `STRATIS is monitoring — linked active recommendation: ${linkedInsight.title.split('—')[0].trim()}.`
      : `STRATIS is monitoring — no active recommendation required yet, but downstream signals are being correlated against this event.`;

    return {
      id: `radar-${item.id}`,
      enterprise: enterpriseId,
      createdAt: item.date + 'T07:0' + idx + ':00Z',
      category: 'market-radar',
      scope: 'brand',
      channels: channelHint,
      linkedNewsId: item.id,
      title: item.title,
      summary: item.whyItMatters,
      evidence: [
        `Source: ${item.source}`,
        `Detected: ${item.date}`,
        `Urgency: ${item.urgency.toUpperCase()}`,
        ...(item.competitor ? [`Competitor: ${item.competitor}`] : []),
        item.summary,
      ],
      confidence: item.urgency === 'high' ? 0.95 : item.urgency === 'medium' ? 0.80 : 0.65,
      impactEstimate: linkedInsight
        ? `Triggered downstream recommendation worth ${linkedInsight.impactEstimate.split('.')[0]}.`
        : `Tracked at the enterprise level. STRATIS is correlating against active campaigns; no action required at this time.`,
      recommendedAction: radarSubtitle,
      status: 'new',
      actionSteps: linkedInsight
        ? [
            { id: 's1', title: 'Review linked STRATIS recommendation', subtitle: linkedInsight.id.toUpperCase(), type: 'targeting', completed: false },
            { id: 's2', title: 'Brief lead AOR on event', subtitle: 'CONFIRM RESPONSE PLAN', type: 'scheduling', completed: false },
          ]
        : [
            { id: 's1', title: 'Acknowledge — STRATIS continues monitoring', subtitle: 'NO ACTION REQUIRED', type: 'targeting', completed: false },
          ],
    };
  });
}
