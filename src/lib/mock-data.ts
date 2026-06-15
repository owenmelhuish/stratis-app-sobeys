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
  // ── TIER 1 — NATIONAL (FCB / UM AOR) — ~$61.2M ──
  // cplCalibration tuned so Tier 1 aggregate ≈ $218 CPL; BC Regional ≈ $148; Ontario Regional ≈ $298; Transit ≈ $94
  { id: 'sobeys-scene-summer-hero', name: 'Scene+ Summer Activation — National Hero',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'scene-plus',
    audiences: ['value-families', 'scene-members', 'conquest-nofrills'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ttd', 'google-search', 'instagram', 'ooh'],
    geos: ['national'], budgetMultiplier: 1.85, plannedBudget: 12_400_000,
    revPerConvRange: [42_000, 68_000], cvrModifier: 1.05, cplCalibration: 0.40, revTrend: 0.0006 },

  { id: 'sobeys-flyer-spring', name: 'Weekly Flyer — Spring Value',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'weekly-flyer',
    audiences: ['value-families', 'bulk-shoppers'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ttd', 'google-search', 'ooh'],
    geos: ['national'], budgetMultiplier: 1.55, plannedBudget: 8_800_000,
    revPerConvRange: [38_000, 58_000], cvrModifier: 1.0, cplCalibration: 0.40, revTrend: 0.0003 },

  { id: 'sobeys-compliments-defense', name: 'Compliments Own-Brand Defense',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'compliments',
    audiences: ['scene-members', 'conquest-loblaws', 'conquest-costco'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'tiktok', 'ttd'],
    geos: ['national'], budgetMultiplier: 1.20, plannedBudget: 5_400_000,
    revPerConvRange: [42_000, 58_000], cvrModifier: 0.95, cplCalibration: 0.40, revTrend: -0.0002 },

  { id: 'sobeys-bbq-national', name: 'Summer BBQ & Grilling — National',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'seasonal-bbq',
    audiences: ['foodies'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'instagram', 'tiktok', 'ttd'],
    geos: ['national'], budgetMultiplier: 1.35, plannedBudget: 6_800_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 1.05, cplCalibration: 0.40, revTrend: 0.0004 },

  { id: 'sobeys-meat-family', name: 'Meat & Seafood — Family Tables',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'meat-seafood',
    audiences: ['weekly-families', 'conquest-walmart'],
    objective: 'consideration', status: 'live',
    channels: ['ctv', 'google-search', 'instagram', 'facebook'],
    geos: ['national'], budgetMultiplier: 1.40, plannedBudget: 7_200_000,
    revPerConvRange: [44_000, 60_000], cvrModifier: 1.0, cplCalibration: 0.40, revTrend: 0.0002 },

  { id: 'sobeys-voila-growth', name: 'Voilà E-Commerce — Growth',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'voila',
    audiences: ['health-shoppers', 'weekly-families', 'conquest-walmart'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'ttd'],
    geos: ['national'], budgetMultiplier: 0.90, plannedBudget: 3_400_000,
    revPerConvRange: [36_000, 48_000], cvrModifier: 1.10, cplCalibration: 0.42, revTrend: 0.0005 },

  { id: 'sobeys-pharmacy-wellness', name: 'Pharmacy & Wellness',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'pharmacy',
    audiences: ['bulk-shoppers'],
    objective: 'conversion', status: 'live',
    channels: ['linkedin', 'google-search', 'ttd'],
    geos: ['national'], budgetMultiplier: 1.05, plannedBudget: 4_200_000,
    revPerConvRange: [48_000, 72_000], cvrModifier: 1.20, cplCalibration: 0.93, revTrend: 0.0006 },

  { id: 'sobeys-centre-store', name: 'Centre-Store Grocery — Always-On',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'centre-store',
    audiences: ['weekly-families'],
    objective: 'awareness', status: 'live',
    channels: ['google-search', 'facebook', 'ttd'],
    geos: ['national'], budgetMultiplier: 0.80, plannedBudget: 2_800_000,
    revPerConvRange: [34_000, 46_000], cvrModifier: 0.85, cplCalibration: 0.34, revTrend: -0.0004 },

  { id: 'sobeys-brand-q2', name: 'Sobeys Masterbrand — So Canadian Q2',
    enterprise: 'ford-canada', division: 'tier-1', agency: 'sob-national-aor', productLine: 'weekly-flyer',
    audiences: ['value-families'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ooh', 'spotify'],
    geos: ['national'], budgetMultiplier: 1.65, plannedBudget: 10_200_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 0.90, cplCalibration: 0.38, revTrend: 0.0001 },

  // ── TIER 2 — REGIONAL — ~$41.8M ──

  // BC Regional — best-in-class CPL ($148) — Scenario 2 hero
  { id: 'sobeys-scene-west', name: 'Scene+ Activation — West',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-west', productLine: 'scene-plus',
    audiences: ['value-families', 'scene-members'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook'],
    geos: ['bc'], budgetMultiplier: 0.85, plannedBudget: 2_400_000,
    revPerConvRange: [42_000, 64_000], cvrModifier: 1.20, cplCalibration: 0.59, revTrend: 0.0006 },

  { id: 'sobeys-bbq-west', name: 'Summer BBQ — West',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-west', productLine: 'seasonal-bbq',
    audiences: ['foodies'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'google-search'],
    geos: ['bc'], budgetMultiplier: 0.75, plannedBudget: 1_800_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 1.15, cplCalibration: 0.59, revTrend: 0.0005 },

  { id: 'sobeys-flyer-west', name: 'Weekly Flyer — West',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-west', productLine: 'weekly-flyer',
    audiences: ['value-families'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['bc'], budgetMultiplier: 0.95, plannedBudget: 3_200_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 1.20, cplCalibration: 0.59, revTrend: 0.0004 },

  // Ontario Regional — anomaly market ($298 CPL) — Scenario 1 + 2
  { id: 'sobeys-scene-ontario', name: 'Scene+ Activation — Ontario',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-ontario', productLine: 'scene-plus',
    audiences: ['value-families', 'scene-members'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'instagram', 'facebook', 'spotify'],
    geos: ['ontario'], budgetMultiplier: 1.05, plannedBudget: 3_400_000,
    revPerConvRange: [42_000, 64_000], cvrModifier: 0.85, cplCalibration: 0.29, revTrend: -0.0001 },

  { id: 'sobeys-flyer-ontario', name: 'Weekly Flyer — Ontario',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-ontario', productLine: 'weekly-flyer',
    audiences: ['value-families'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'ttd'],
    geos: ['ontario'], budgetMultiplier: 1.30, plannedBudget: 5_200_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 0.90, cplCalibration: 0.29, revTrend: 0.0001 },

  { id: 'sobeys-meat-ontario', name: 'Meat & Seafood — Ontario',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-ontario', productLine: 'meat-seafood',
    audiences: ['weekly-families'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['ontario'], budgetMultiplier: 0.95, plannedBudget: 2_800_000,
    revPerConvRange: [42_000, 58_000], cvrModifier: 0.85, cplCalibration: 0.29, revTrend: 0 },

  // Alberta Regional — slightly above Tier 1 baseline (~$210)
  { id: 'sobeys-flyer-alberta', name: 'Weekly Flyer — Alberta',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-alberta', productLine: 'weekly-flyer',
    audiences: ['value-families', 'bulk-shoppers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['alberta'], budgetMultiplier: 1.00, plannedBudget: 3_600_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 1.05, cplCalibration: 0.42, revTrend: 0.0003 },

  { id: 'sobeys-bbq-alberta', name: 'Summer BBQ — Alberta',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-alberta', productLine: 'seasonal-bbq',
    audiences: ['foodies'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'tiktok', 'facebook'],
    geos: ['alberta'], budgetMultiplier: 0.70, plannedBudget: 1_400_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 1.05, cplCalibration: 0.42, revTrend: 0.0003 },

  // Cossette (Quebec) — at Tier 1 baseline
  { id: 'sobeys-flyer-quebec', name: 'Weekly Flyer — Québec',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-quebec', productLine: 'weekly-flyer',
    audiences: ['value-families'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram', 'spotify'],
    geos: ['quebec'], budgetMultiplier: 1.05, plannedBudget: 3_800_000,
    revPerConvRange: [40_000, 56_000], cvrModifier: 1.0, cplCalibration: 0.40, revTrend: 0.0002 },

  { id: 'sobeys-voila-quebec', name: 'Voilà par IGA — Québec',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-quebec', productLine: 'voila',
    audiences: ['health-shoppers'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['quebec'], budgetMultiplier: 0.85, plannedBudget: 2_200_000,
    revPerConvRange: [36_000, 48_000], cvrModifier: 1.05, cplCalibration: 0.42, revTrend: 0.0004 },

  // Atlantic Regional — modestly below Tier 1
  { id: 'sobeys-flyer-atlantic', name: 'Weekly Flyer — Atlantic',
    enterprise: 'ford-canada', division: 'tier-2', agency: 'sob-atlantic', productLine: 'weekly-flyer',
    audiences: ['value-families'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['atlantic'], budgetMultiplier: 0.80, plannedBudget: 1_600_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 0.95, cplCalibration: 0.38, revTrend: 0 },

  // ── TIER 3 — STORE & LOCAL (aggregate) — ~$21.4M ──
  { id: 'sobeys-store-flyer-event', name: 'Store Flyer Event — Network',
    enterprise: 'ford-canada', division: 'tier-3', agency: 'store-local', productLine: 'weekly-flyer',
    audiences: ['value-families'],
    objective: 'conversion', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'],
    geos: ['ontario', 'alberta', 'bc', 'quebec', 'atlantic'],
    budgetMultiplier: 1.45, plannedBudget: 12_400_000,
    revPerConvRange: [38_000, 52_000], cvrModifier: 0.85, cplCalibration: 0.34, revTrend: 0.0001 },

  { id: 'sobeys-store-scene-drive', name: 'Store Scene+ Sign-Up Drive',
    enterprise: 'ford-canada', division: 'tier-3', agency: 'store-local', productLine: 'scene-plus',
    audiences: ['scene-members', 'value-families'],
    objective: 'conversion', status: 'live',
    channels: ['facebook', 'instagram', 'google-search'],
    geos: ['ontario', 'alberta', 'bc', 'quebec'],
    budgetMultiplier: 1.10, plannedBudget: 6_200_000,
    revPerConvRange: [42_000, 64_000], cvrModifier: 0.85, cplCalibration: 0.34, revTrend: 0.0003 },

  { id: 'sobeys-store-meat-drive', name: 'Store Meat & Seafood Drive',
    enterprise: 'ford-canada', division: 'tier-3', agency: 'store-local', productLine: 'meat-seafood',
    audiences: ['weekly-families'],
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
  { id: 'lincoln-aviator-quiet-luxury', name: 'Fresh Produce — Peak-Season Hero',
    enterprise: 'lincoln', division: 'tier-1', agency: 'fb-studio', productLine: 'lincoln-aviator',
    audiences: ['luxury-intenders', 'conquest-bmw', 'conquest-mercedes'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'spotify', 'ooh', 'instagram'],
    geos: ['national'], budgetMultiplier: 1.0, plannedBudget: 5_400_000,
    revPerConvRange: [78_000, 102_000], cvrModifier: 0.88, cplCalibration: 0.18, revTrend: 0.0004 },

  { id: 'lincoln-aviator-conquest-x5', name: 'Fresh Produce vs Whole Foods — Conquest',
    enterprise: 'lincoln', division: 'tier-1', agency: 'fb-studio', productLine: 'lincoln-aviator',
    audiences: ['conquest-bmw', 'conquest-audi'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'ttd', 'instagram'],
    geos: ['national'], budgetMultiplier: 0.85, plannedBudget: 2_800_000,
    revPerConvRange: [78_000, 102_000], cvrModifier: 0.92, cplCalibration: 0.20, revTrend: 0.0003 },

  // ── Nautilus (volume mid-size luxury SUV) ──
  { id: 'lincoln-nautilus-launch', name: 'Prepared Foods & Deli — Ready-Meal Launch',
    enterprise: 'lincoln', division: 'tier-1', agency: 'fb-studio', productLine: 'lincoln-nautilus',
    audiences: ['luxury-intenders', 'health-shoppers', 'conquest-lexus', 'conquest-mercedes'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ttd', 'google-search', 'spotify'],
    geos: ['national'], budgetMultiplier: 1.20, plannedBudget: 6_800_000,
    revPerConvRange: [68_000, 88_000], cvrModifier: 1.0, cplCalibration: 0.22, revTrend: 0.0005 },

  { id: 'lincoln-nautilus-mature', name: 'Prepared Foods & Deli — Always-On',
    enterprise: 'lincoln', division: 'tier-2', agency: 'fb-regional', productLine: 'lincoln-nautilus',
    audiences: ['luxury-intenders', 'lincoln-loyalists'],
    objective: 'consideration', status: 'live',
    channels: ['google-search', 'instagram', 'facebook'],
    geos: ['ontario', 'quebec', 'bc'], budgetMultiplier: 0.70, plannedBudget: 2_400_000,
    revPerConvRange: [68_000, 88_000], cvrModifier: 1.05, cplCalibration: 0.24, revTrend: 0.0002 },

  // ── Corsair (entry luxury — gateway nameplate) ──
  { id: 'lincoln-corsair-entry-luxury', name: 'Bakery — First-Visit Shoppers',
    enterprise: 'lincoln', division: 'tier-1', agency: 'fb-studio', productLine: 'lincoln-corsair',
    audiences: ['luxury-intenders', 'conquest-audi', 'conquest-lexus'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'google-search', 'tiktok', 'ttd'],
    geos: ['national'], budgetMultiplier: 0.90, plannedBudget: 3_400_000,
    revPerConvRange: [54_000, 68_000], cvrModifier: 1.10, cplCalibration: 0.28, revTrend: 0.0006 },

  { id: 'lincoln-corsair-quebec-fr', name: 'Bakery — Québec French-Language',
    enterprise: 'lincoln', division: 'tier-2', agency: 'fb-regional', productLine: 'lincoln-corsair',
    audiences: ['luxury-intenders'],
    objective: 'consideration', status: 'live',
    channels: ['instagram', 'facebook', 'spotify'],
    geos: ['quebec'], budgetMultiplier: 0.65, plannedBudget: 1_800_000,
    revPerConvRange: [54_000, 68_000], cvrModifier: 1.05, cplCalibration: 0.30, revTrend: 0.0004 },

  // ── Navigator (flagship full-size luxury SUV) ──
  { id: 'lincoln-navigator-flagship', name: 'Butcher & Seafood — Flagship Hero',
    enterprise: 'lincoln', division: 'tier-1', agency: 'fb-studio', productLine: 'lincoln-navigator',
    audiences: ['luxury-intenders', 'conquest-mercedes', 'lincoln-loyalists'],
    objective: 'awareness', status: 'live',
    channels: ['ctv', 'ooh', 'spotify', 'instagram'],
    geos: ['national'], budgetMultiplier: 1.30, plannedBudget: 7_200_000,
    revPerConvRange: [108_000, 142_000], cvrModifier: 0.78, cplCalibration: 0.14, revTrend: 0.0003 },

  { id: 'lincoln-navigator-conquest-escalade', name: 'Butcher & Seafood vs Metro — Conquest',
    enterprise: 'lincoln', division: 'tier-1', agency: 'fb-studio', productLine: 'lincoln-navigator',
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

  { id: 'dn-bc-coop-aggregate', name: 'Fresh Market — Store Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-bc-rollup',
    audiences: ['local-shoppers', 'service-loyalists', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['bc'], budgetMultiplier: 1.10, plannedBudget: 6_800_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.25, cplCalibration: 1.40, revTrend: 0.0003 },

  { id: 'dn-ontario-coop-aggregate', name: 'Grocery Gateway — Online Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-ontario-rollup',
    audiences: ['local-shoppers', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['ontario'], budgetMultiplier: 1.45, plannedBudget: 12_400_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.10, cplCalibration: 0.95, revTrend: 0.0002 },

  { id: 'dn-quebec-coop-aggregate', name: 'Prepared Foods & Deli — Store Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-quebec-rollup',
    audiences: ['local-shoppers', 'service-loyalists'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['quebec'], budgetMultiplier: 1.15, plannedBudget: 7_400_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.20, cplCalibration: 1.30, revTrend: 0.0004 },

  { id: 'dn-alberta-coop-aggregate', name: 'Bakery & Café — Store Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-alberta-rollup',
    audiences: ['local-shoppers', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook', 'instagram'],
    geos: ['alberta'], budgetMultiplier: 1.05, plannedBudget: 5_800_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.15, cplCalibration: 1.10, revTrend: 0.0003 },

  { id: 'dn-atlantic-coop-aggregate', name: 'Centre-Store — Store Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-atlantic-rollup',
    audiences: ['local-shoppers', 'service-loyalists'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook'],
    geos: ['atlantic'], budgetMultiplier: 0.85, plannedBudget: 3_400_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.05, cplCalibration: 1.00, revTrend: 0.0002 },

  { id: 'dn-prairies-coop-aggregate', name: 'Catering & Corporate — Rollup',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-prairies-rollup',
    audiences: ['local-shoppers', 'finance-deal-seekers'],
    objective: 'conversion', status: 'live',
    channels: ['google-search', 'facebook'],
    geos: ['alberta'], budgetMultiplier: 0.90, plannedBudget: 4_200_000,
    revPerConvRange: [38_000, 54_000], cvrModifier: 1.10, cplCalibration: 1.05, revTrend: 0.0003 },

  // Service & finance overlays (cross-regional)
  { id: 'dn-service-loyalty-national', name: 'Grocery Gateway Loyalty — Email + Search',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-ontario-rollup',
    audiences: ['service-loyalists'],
    objective: 'retention', status: 'live',
    channels: ['google-search', 'facebook'],
    geos: ['national'], budgetMultiplier: 0.40, plannedBudget: 1_400_000,
    revPerConvRange: [800, 1_400], cvrModifier: 1.80, cplCalibration: 2.20, revTrend: 0.0004 },

  { id: 'dn-finance-rate-deals', name: 'Weekly Flyer Deals — Store Network',
    enterprise: 'dealership-network', division: 'tier-3', agency: 'store-local', productLine: 'dn-bc-rollup',
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
  { name: 'Spring Refresh & Garden Season', dayOffset: 80,  duration: 30, geos: ['national'],            spendMult: 1.30, cvrMult: 1.15, engageMult: 1.0 },
  { name: 'Loblaw Spring Price Campaign', dayOffset: 110, duration: 14, geos: ['national'],         spendMult: 1.0,  cvrMult: 0.90, engageMult: 0.85 },
  { name: 'Scene+ Summer Bonus Event', dayOffset: 130, duration: 30, geos: ['national'],            spendMult: 1.40, cvrMult: 1.20, engageMult: 1.30 },
  { name: 'Long-Weekend BBQ Peak', dayOffset: 165, duration: 7, geos: ['national'],            spendMult: 1.10, cvrMult: 1.15, engageMult: 1.10 },
  { name: 'No Frills Hauler Price Drop',  dayOffset: 175, duration: 5, geos: ['national'],            spendMult: 1.0,  cvrMult: 0.85, engageMult: 0.85 },
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
  brand:        ['Strategy Online', 'Marketing Magazine', 'Canadian Grocer', 'Globe and Mail', 'BNN Bloomberg'],
  grocery:      ['Canadian Grocer', 'Grocery Business', 'Retail Insider', 'Globe and Mail', 'Food in Canada'],
  loyalty:      ['Strategy Online', 'Canadian Grocer', 'Retail Insider', 'Marketing Magazine', 'BNN Bloomberg'],
  launch:       ['Canadian Grocer', 'Strategy Online', 'Globe and Mail', 'Retail Insider'],
  value:        ['Statistics Canada', 'Canadian Grocer', 'Globe and Mail', 'CBC News'],
  social:       ['Reddit r/loblawsisoutofcontrol', 'TikTok #GroceryTok', 'X/Twitter', 'Reddit r/Canada', 'Reddit r/PersonalFinanceCanada'],
  sports:       ['Sportsnet', 'TSN', 'Strategy Online', 'The Athletic'],
  sponsorships: ['Strategy Online', 'Marketing Magazine', 'Canadian Grocer', 'AdAge'],
  partnerships: ['Retail Insider', 'Bloomberg', 'Globe and Mail', 'Canadian Grocer', 'BNN Bloomberg'],
  competitors:  ['Canadian Grocer', 'Retail Insider', 'Bloomberg', 'Globe and Mail', 'Strategy Online'],
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
      title: 'No Frills Launches Aggressive "Hauler Hotline" Price Event — Direct Pressure on Sobeys Value Perception',
      source: 'Canadian Grocer',
      date: '2026-05-08',
      tags: ['competitors', 'value'],
      urgency: 'high',
      competitor: 'No Frills',
      regions: ['national'],
      summary: 'No Frills launched a high-profile "Hauler Hotline" price event across its banners this week — deep price drops on a wide center-store and fresh basket, backed by national TV, social, and in-flyer messaging. The push lands squarely on value-seeking households Sobeys competes hardest for, just as weekly-shop budgets tighten.',
      whyItMatters: 'In the days after the event launched, STRATIS observed a measurable rise in price-comparison and "cheapest grocery" search — reported as a correlation, not a causal claim on Sobeys basket share. See the linked STRATIS signal for the recommended measured, surgical counter rather than a blanket price war.',
      enterprises: ['ford-canada'],
    },
    {
      id: 'news-izev-extension',
      title: 'StatsCan: Food Inflation Eases to 2.1% — but 52% of Shoppers Still Trading Down to Private Label',
      source: 'Statistics Canada',
      date: '2026-05-02',
      tags: ['macro', 'value'],
      urgency: 'high',
      regions: ['national'],
      summary: 'Statistics Canada reported food-at-home inflation eased to 2.1% in the latest print, the slowest pace in three years. But shopper-behaviour tracking shows 52% of households are still actively trading down — switching to private label, buying on deal, and consolidating trips — with the habit sticking even as prices cool.',
      whyItMatters: 'A clear tailwind for Compliments own-brand and value messaging. Easing inflation does not reverse the trade-down behaviour; it locks it in. Lean Compliments and Compliments Organic into the value narrative while shoppers are still receptive, before the discounters own the affordability story outright.',
      enterprises: ['ford-canada'],
    },
    {
      id: 'news-gm-silverado-fleet',
      title: 'Loblaw Expands "Advance" Retail Media + PC Optimum Personalization — Pressure on Empire Media+ & Scene+',
      source: 'Strategy Online',
      date: '2026-05-05',
      tags: ['competitors', 'loyalty'],
      urgency: 'high',
      competitor: 'Loblaw',
      regions: ['national'],
      summary: 'Loblaw confirmed a major expansion of its "Advance" retail-media network and a new wave of PC Optimum personalization — pushing more first-party-data-driven, shopper-level targeting to brand partners and deepening 1:1 offers. The move raises the bar on retail-media maturity and loyalty personalization across the category.',
      whyItMatters: 'This is the most institutional competitive threat to Empire Media+ and Scene+. Loblaw is monetizing first-party data faster and personalizing offers harder. Watch share-of-voice compression in retail media and the maturity gap on Scene+ personalization — the offer engine is now the battleground.',
      enterprises: ['ford-canada'],
    },
  ];

  items.push(...pinnedItems);

  // ── PROCEDURAL templates — Canadian grocery landscape (Sobeys relevance audited per item) ──
  const templates: NewsTemplate[] = [
    // ════════════════════════════════════════════
    // NO FRILLS / DISCOUNT WATCH — deep competitive coverage
    // ════════════════════════════════════════════
    { title: 'No Frills "Haul of Fame" Loyalty Tie-In Goes National — PC Optimum Points Stacked on Hauler Basket',
      tags: ['competitors', 'value'], urgency: 'high', competitor: 'No Frills',
      summary: 'No Frills extended its Hauler value event with stacked PC Optimum points on a defined value basket, backed by national social and in-store. The combination of deep price and loyalty points sharpens the discount value proposition for budget households.',
      whyItMatters: 'This raises the affordability bar in the exact basket Sobeys competes for. Counter surgically with targeted Scene+ offers and flyer features on a matched basket — defend share without triggering a blanket price war that erodes margin across the store.' },
    { title: 'No Frills Q1 Comparable Sales Up 6.2% — Trade-Down Momentum Accelerating',
      tags: ['competitors', 'value'], urgency: 'high', competitor: 'No Frills',
      summary: 'Loblaw reported No Frills same-store sales up 6.2% in Q1, well ahead of the conventional banners, as households continue consolidating shops into discount. Basket size up, trip frequency up.',
      whyItMatters: 'Trade-down is the dominant category force. Lean Compliments own brands and value flyer features hard to keep value-seeking families inside the Sobeys banner rather than ceding the trip to discount.' },
    { title: 'Maxi Expands Price-Lock Program in Québec — 12-Week Freeze on 1,000 Items',
      tags: ['competitors', 'value'], urgency: 'medium', competitor: 'Loblaw',
      summary: 'Loblaw\'s Maxi banner expanded its Québec price-lock program, freezing prices on roughly 1,000 staple items for 12 weeks. Heavy French-language TV and in-store support.',
      whyItMatters: 'Direct pressure on IGA value perception in Québec. A focused price-lock counter on a Québec staples basket, with French-first creative, protects value-shopper share in the province.' },
    { title: 'Food Basics Launches "Locked Low" Center-Store Campaign in Ontario',
      tags: ['competitors', 'value'], urgency: 'medium', competitor: 'Metro',
      summary: 'Metro\'s Food Basics banner launched a "Locked Low" center-store value campaign across Ontario, emphasizing everyday low prices on pantry staples rather than week-to-week deals.',
      whyItMatters: 'Everyday-low-price messaging targets the same trip Sobeys Ontario fights for. Reinforce Compliments center-store value and consistent flyer pricing in Ontario to hold the comparison.' },
    { title: 'Walmart Canada Grocery Push — "Everyday Low Price" Fresh Expansion in GTA',
      tags: ['competitors', 'value'], urgency: 'high', competitor: 'Walmart',
      summary: 'Walmart Canada expanded fresh and produce assortment across GTA Supercentres with aggressive everyday-low-price positioning and increased grocery media weight. Fresh is the fastest-growing department.',
      whyItMatters: 'Walmart fresh expansion pressures Sobeys on both price and produce credibility. Lean fresh-quality and local-sourcing "Buy Canadian" messaging where Walmart competes on price alone.' },
    { title: 'No Frills "PC Insiders" Membership Test — Discount Banner Adds Paid Loyalty Tier',
      tags: ['competitors', 'loyalty'], urgency: 'medium', competitor: 'No Frills',
      summary: 'No Frills began testing a paid membership tier offering bonus PC Optimum points and member-only prices in select Ontario stores. Mirrors a Costco-style paid-loyalty motion in the discount channel.',
      whyItMatters: 'Paid loyalty deepens No Frills retention on value households. Scene+ personalization and member-only offers are the counter — push relevant, redeemable offers before the discount membership locks in habit.' },
    { title: 'Save-On-Foods Expands More Rewards Personalization in BC and Alberta',
      tags: ['competitors', 'loyalty'], urgency: 'medium', competitor: 'Save-On-Foods',
      summary: 'Pattison\'s Save-On-Foods deepened More Rewards personalized offers and added gamified bonus-point events across BC and Alberta, leaning on its strong Western loyalty base.',
      whyItMatters: 'Save-On is the key Western loyalty competitor for Safeway / IGA West. Scene+ personalized offers in the West must match the relevance bar to defend share in Save-On\'s home turf.' },
    { title: 'Costco Canada Kirkland Signature Grows to 28% of Basket — Private-Label Pull Intensifies',
      tags: ['competitors', 'value'], urgency: 'low', competitor: 'Costco',
      summary: 'Costco Canada reported Kirkland Signature now represents roughly 28% of member basket value, the highest private-label penetration in the market, reinforcing the bulk/stock-up value trip.',
      whyItMatters: 'Kirkland sets the private-label benchmark shoppers compare against. Position Compliments and Panache on quality-at-value, and use bulk/stock-up Scene+ offers to defend the pantry-loading trip.' },

    // ════════════════════════════════════════════
    // LOBLAW WATCH — flagship competitor
    // ════════════════════════════════════════════
    { title: 'Loblaw "Advance" Retail Media Adds Self-Serve Brand Dashboard — CPG Spend Shifting',
      tags: ['competitors', 'loyalty'], urgency: 'high', competitor: 'Loblaw',
      summary: 'Loblaw opened a self-serve dashboard on its Advance retail-media network, letting CPG brands buy and measure shopper-level campaigns directly. Early adopters report faster activation and tighter attribution.',
      whyItMatters: 'Retail-media dollars are consolidating toward the most mature platform. Empire Media+ must close the self-serve and measurement gap, or risk CPG budgets defaulting to Advance.' },
    { title: 'PC Optimum Crosses 18M Members — Personalization Engine Cited as Growth Driver',
      tags: ['competitors', 'loyalty'], urgency: 'high', competitor: 'Loblaw',
      summary: 'Loblaw reported PC Optimum active membership crossed 18M, attributing growth to personalized weekly offers and points events tuned by purchase history across grocery, pharmacy, and Shoppers.',
      whyItMatters: 'PC Optimum\'s scale and cross-banner data depth set the loyalty benchmark. Scene+ (15M members) competes on the relevance and redemption experience — sharpen personalization, not just points value.' },
    { title: 'President\'s Choice "Plant-Based" Range Expansion — 40 New SKUs',
      tags: ['competitors', 'launch'], urgency: 'medium', competitor: 'Loblaw',
      summary: 'Loblaw expanded the President\'s Choice plant-based range with 40 new SKUs and front-of-store merchandising, targeting health-conscious and younger households.',
      whyItMatters: 'PC own-brand innovation pressures Compliments on assortment leadership. Compliments and Compliments Balance should answer in health-and-wellness with clear quality and value positioning.' },
    { title: 'Loblaw Expands "PC Express" Curbside to 200 More Stores — E-Commerce Convenience Push',
      tags: ['competitors', 'launch'], urgency: 'high', competitor: 'Loblaw',
      summary: 'Loblaw added PC Express curbside pickup at 200 additional stores nationally, narrowing the convenience gap and reducing pickup wait times. Same-day slots expanded.',
      whyItMatters: 'Pickup convenience drives e-commerce share. Voilà home delivery wins on basket and automation, but pickup is the volume battleground — protect Voilà\'s convenience narrative and conversion.' },
    { title: 'Shoppers Drug Mart Grocery & Loyalty Integration — PC Optimum Cross-Shop Up',
      tags: ['competitors', 'loyalty'], urgency: 'medium', competitor: 'Loblaw',
      summary: 'Loblaw deepened Shoppers Drug Mart food and PC Optimum integration, lifting cross-shop between pharmacy and grocery trips through stacked points and bundled offers.',
      whyItMatters: 'Pharmacy-to-grocery cross-shop is a loyalty moat. Sobeys Pharmacy & Wellness should mirror with Scene+ stacking that links script pickup to grocery baskets.' },
    { title: 'Loblaw Q1 Earnings — Food Retail Margin Holds as Discount Mix Grows',
      tags: ['competitors', 'macro'], urgency: 'medium', competitor: 'Loblaw',
      summary: 'Loblaw reported stable food-retail margins in Q1 even as the sales mix shifted toward discount banners, citing private-label penetration and retail-media income as offsets.',
      whyItMatters: 'Loblaw is defending margin through own-brand and retail media even as shoppers trade down. The same two levers — Compliments and Empire Media+ — are Sobeys\' margin defense.' },

    // ════════════════════════════════════════════
    // METRO WATCH
    // ════════════════════════════════════════════
    { title: 'Metro "Moi" Loyalty Adds Personalized Weekly Targets — Québec & Ontario',
      tags: ['competitors', 'loyalty'], urgency: 'medium', competitor: 'Metro',
      summary: 'Metro upgraded its Moi loyalty program with personalized weekly spend targets and bonus-point challenges across Québec and Ontario, deepening engagement on its owned base.',
      whyItMatters: 'Moi sharpens Metro\'s loyalty relevance in IGA\'s and Sobeys Ontario\'s core markets. Scene+ challenges and personalized offers should match the cadence to keep members engaged.' },
    { title: 'Metro Expands Fresh Prepared-Meal Range — Convenience Dinner Occasion',
      tags: ['competitors', 'launch'], urgency: 'medium', competitor: 'Metro',
      summary: 'Metro broadened its fresh prepared-meal and meal-kit assortment, targeting the weeknight dinner occasion and time-pressed households with ready-to-heat options.',
      whyItMatters: 'Prepared foods is a high-margin growth occasion. Sobeys and Farm Boy prepared-foods programs should defend the dinner trip with quality and freshness differentiation.' },
    { title: 'Super C Québec Value Campaign — French-First "Bas Prix" Messaging',
      tags: ['competitors', 'value'], urgency: 'medium', competitor: 'Metro',
      summary: 'Metro\'s Super C discount banner launched a French-first "Bas Prix" value campaign across Québec with heavy flyer and social weight on staple categories.',
      whyItMatters: 'Direct value pressure on IGA in Québec. French-first value creative via Sobeys Québec / Sid Lee is the right register to defend the IGA value shopper.' },
    { title: 'Metro Q1 Comparable Sales Up 3.1% — Loyalty Engagement Cited',
      tags: ['competitors', 'macro'], urgency: 'low', competitor: 'Metro',
      summary: 'Metro reported comparable food-store sales up 3.1% in Q1, citing Moi loyalty engagement and discount-banner strength in Québec and Ontario.',
      whyItMatters: 'Metro is growing steadily on loyalty and discount. Watch share-of-voice and loyalty engagement in the overlapping Québec and Ontario markets.' },
    { title: 'Metro Pharmacy (Jean Coutu / Brunet) Grocery Cross-Shop Initiative',
      tags: ['competitors', 'partnerships'], urgency: 'low', competitor: 'Metro',
      summary: 'Metro launched a Jean Coutu / Brunet pharmacy-to-grocery cross-shop initiative in Québec, bundling wellness offers with food baskets through Moi.',
      whyItMatters: 'Mirrors the Shoppers-Loblaw pharmacy moat in Québec. IGA Pharmacy and Scene+ should answer the wellness-to-grocery linkage.' },

    // ════════════════════════════════════════════
    // SCENE+ / LOYALTY & RETAIL MEDIA — Sobeys direct
    // ════════════════════════════════════════════
    { title: 'Scene+ Summer Activation Sign-Ups Pace 28% Above Plan — Strongest Quarter Since Launch',
      tags: ['loyalty', 'brand'], urgency: 'high',
      summary: 'Scene+ sign-ups tied to the Summer Activation are running 28% above plan with three weeks left in the window. Strong enrolment momentum across Ontario, West, and Alberta.',
      whyItMatters: 'Sign-up pacing reinforces the Summer Activation signals STRATIS is tracking, including the No Frills value-search shift. Supports holding Scene+ media weight through the window.' },
    { title: 'Scene+ Crosses 15M Members — Personalized Offer Redemption Up 22%',
      tags: ['loyalty', 'macro'], urgency: 'medium',
      summary: 'Scene+ membership held above 15M with personalized offer redemption up 22% year over year, driven by tuned weekly offers across grocery, dining, and entertainment partners.',
      whyItMatters: 'Loyalty depth validates the Scene+ investment. Use redemption lift in the CMO narrative as proof the personalization engine is converting, not just enrolling.' },
    { title: 'Empire Media+ Opens Self-Serve Beta for CPG Partners — 40 Brands in Pilot',
      tags: ['loyalty', 'launch'], urgency: 'high',
      summary: 'Empire Media+ launched a self-serve beta letting CPG partners build and measure Scene+-data campaigns directly, with 40 brands in the first pilot wave.',
      whyItMatters: 'Closes the maturity gap vs Loblaw Advance. Scene+ first-party data is the differentiator — accelerate onboarding to capture CPG budgets before they default to Advance.' },
    { title: 'Voilà E-Commerce Basket Size Up 14% — Automated Fulfilment Drives Larger Orders',
      tags: ['launch'], urgency: 'medium',
      summary: 'Voilà by Sobeys reported average basket size up 14% as Ocado-automated fulfilment improved availability and substitution rates, lifting customer satisfaction and repeat orders.',
      whyItMatters: 'Voilà wins on basket and reliability where pickup competitors win on convenience. Scale media weight on Voilà growth while the basket and satisfaction signal is strong.' },
    { title: 'Compliments Own-Brand Penetration Hits New High — Value Trade-In Accelerating',
      tags: ['value', 'brand'], urgency: 'high',
      summary: 'Compliments own-brand penetration reached a new high across center-store as households traded into private label. Compliments Organic and Balance led the growth among health-conscious shoppers.',
      whyItMatters: 'Own-brand penetration is the clearest trade-down capture signal. Compliments is currently underweighted in media mix relative to demand — scale support while the value tailwind holds.' },
    { title: 'Panache Premium Range Expansion — 30 New SKUs for the Entertaining Occasion',
      tags: ['launch', 'brand'], urgency: 'medium',
      summary: 'Sobeys expanded the Panache premium own-brand range with 30 new SKUs aimed at the entertaining and weekend-treat occasion, holding price flat against national premium brands.',
      whyItMatters: 'Panache lets Sobeys capture trade-up even as the broad market trades down — the premium occasion is resilient. Lean Panache into foodie and premium-fresh audiences.' },
    { title: 'Sobeys "Buy Canadian" Local Sourcing Program Expands — Fresh & Produce Focus',
      tags: ['brand', 'launch'], urgency: 'medium',
      summary: 'Sobeys expanded its local and Canadian-sourcing program across fresh and produce, with in-store and flyer call-outs identifying Canadian-grown and locally sourced items.',
      whyItMatters: '"Buy Canadian" is a strong differentiator vs price-only discounters and a fresh-credibility builder. Surface local sourcing prominently in fresh and produce creative.' },
    { title: 'Voilà par IGA Expands Delivery Coverage in Greater Montréal',
      tags: ['launch'], urgency: 'medium',
      summary: 'Voilà par IGA expanded home-delivery coverage across Greater Montréal, adding same-day slots and broadening the addressable Québec e-commerce base.',
      whyItMatters: 'Québec e-commerce is underweighted relative to demand. French-first Voilà par IGA creative plus the wider coverage is a growth lever for the Québec online basket.' },
    { title: 'Sobeys Weekly Flyer Digital Shift — Print Drops, App Engagement Up 31%',
      tags: ['launch', 'macro'], urgency: 'medium',
      summary: 'Sobeys accelerated its flyer→digital shift, reducing print distribution as digital flyer and app engagement rose 31% year over year. Personalized digital flyer offers outperform static print.',
      whyItMatters: 'The flyer→digital shift lowers cost and lifts personalization, but moves too fast risk losing older value shoppers who rely on print. Manage the transition by region and demographic.' },
    { title: 'Scene+ Identified as Most Efficient Sign-Up Channel in Q1 Review',
      tags: ['loyalty', 'brand'], urgency: 'low',
      summary: 'Internal Q1 review identifies the Scene+ loyalty program as Sobeys\' most efficient channel by cost per sign-up, driven primarily by in-store and digital flyer activation.',
      whyItMatters: 'Scene+ enrolment is structurally efficient and currently underweighted in budget allocation. Consider rebalancing 5–8% of Tier 1 spend toward Scene+ sign-up drives.' },

    // ════════════════════════════════════════════
    // MACRO — INFLATION, AFFORDABILITY, POLICY
    // ════════════════════════════════════════════
    { title: 'StatsCan: Food-at-Home Inflation Eases but Private-Label Share Keeps Climbing',
      tags: ['macro', 'value'], urgency: 'high',
      summary: 'Statistics Canada data shows food-at-home inflation easing while private-label dollar share continues to climb, indicating the trade-down habit is sticking even as price pressure cools.',
      whyItMatters: 'Easing inflation does not reverse trade-down. Keep Compliments and value messaging weighted while shoppers remain in cost-conscious mode.' },
    { title: 'Grocery Code of Conduct in Effect Jan 1 2026 — Governs Supplier Dealings',
      tags: ['macro'], urgency: 'medium',
      summary: 'The Grocery Code of Conduct took effect January 1, 2026, governing dealings between grocers and suppliers. It addresses supplier terms and dispute resolution, not retail shelf prices.',
      whyItMatters: 'A supplier-relations governance change, not a retail-price one. Neutral for consumer marketing — keep value and own-brand messaging consistent.' },
    { title: 'Bank of Canada Holds Rate at 3.75% — Household Grocery Budgets Stable',
      tags: ['macro'], urgency: 'low',
      summary: 'The Bank of Canada held its overnight rate at 3.75%, citing balanced inflation and employment. Household discretionary budgets remain under modest pressure.',
      whyItMatters: 'Rate stability is neutral for grocery — neither tailwind nor headwind. Value and affordability messaging stays consistent.' },
    { title: 'Consumer Confidence Ticks Up — but "Trading Down" Behaviour Persists',
      tags: ['macro', 'value'], urgency: 'medium',
      summary: 'Consumer confidence rose modestly in the latest read, yet shopper surveys show households continuing to trade down, buy on deal, and consolidate trips into discount.',
      whyItMatters: 'Sentiment is improving slowly but behaviour lags. Compliments own-brand and value flyer features remain the right emphasis through the next quarter.' },
    { title: 'Food Prices in Québec Outpace National Average — Value Sensitivity Heightened',
      tags: ['macro', 'value'], urgency: 'high',
      summary: 'Québec food-price tracking shows the basket running slightly above the national average, sharpening value sensitivity among Québec households as discounters press the message.',
      whyItMatters: 'Heightened Québec value sensitivity pressures IGA. French-first value and Compliments messaging via Sobeys Québec defends the value shopper in-province.' },

    // ════════════════════════════════════════════
    // SOBEYS BRAND & CORPORATE NARRATIVE
    // ════════════════════════════════════════════
    { title: 'Empire Company Q1 Results — Food Retail Sales Up, Voilà and Compliments Cited',
      tags: ['brand'], urgency: 'medium',
      summary: 'Empire Company reported food-retail sales growth in Q1, with Voilà e-commerce momentum and Compliments own-brand penetration cited as key drivers alongside disciplined cost control.',
      whyItMatters: 'Strong results support continued investment in loyalty, own brands, and e-commerce. Brand campaigns can lean into "Canada\'s grocer" credibility with quantified validation.' },
    { title: 'Sobeys "So Canadian" Masterbrand Platform Renewed for 2026',
      tags: ['brand', 'launch'], urgency: 'low',
      summary: 'Sobeys renewed its "So Canadian" masterbrand platform for 2026, leaning into Canadian sourcing, community, and fresh-food credibility across national creative.',
      whyItMatters: 'The masterbrand "So Canadian" story is the most durable equity asset. Integrate Buy-Canadian and local sourcing into the platform for a unified fresh-and-Canadian narrative.' },
    { title: 'Sobeys Wins Canadian Grocer Loyalty Program of the Year — Scene+ Cited',
      tags: ['brand', 'loyalty'], urgency: 'high',
      summary: 'Sobeys / Scene+ won Canadian Grocer\'s Loyalty Program of the Year, with judges citing personalization depth and cross-partner redemption breadth.',
      whyItMatters: 'Authoritative third-party validation for Scene+. Surface the award badge across loyalty sign-up and personalized-offer creative immediately.' },
    { title: 'Empire CEO Town Halls — Toronto and Montréal Banner-Leadership Meetings',
      tags: ['brand'], urgency: 'low',
      summary: 'Empire leadership confirmed town halls including Toronto and Montréal banner-leadership meetings. Loyalty personalization, own-brand growth, and e-commerce on the agenda.',
      whyItMatters: 'Executive engagement signals corporate priority. Store and regional campaigns can leverage leadership-led narrative for the Scene+ and Compliments push.' },
    { title: 'Empire Media+ Standalone Retail-Media Brand Launch — CPG Awareness Campaign',
      tags: ['brand', 'launch'], urgency: 'medium',
      summary: 'Empire Media+ launched as a standalone retail-media brand with a national B2B campaign targeting CPG marketers, emphasizing Scene+ first-party data and closed-loop measurement.',
      whyItMatters: 'Brand visibility for retail media matters in the CPG-budget battle vs Loblaw Advance. Align Empire Media+ messaging on data depth and measurement.' },

    // ════════════════════════════════════════════
    // SPORTS & SPONSORSHIPS — Sobeys / Scene+ partnerships
    // ════════════════════════════════════════════
    { title: 'Scene+ Renews Cineplex & Scotiabank Partnership — Multi-Year Extension',
      tags: ['sponsorships', 'partnerships', 'brand'], urgency: 'low',
      summary: 'Scene+ confirmed a multi-year renewal of its Cineplex and Scotiabank partnership, expanding cross-redemption between grocery, dining, banking, and entertainment.',
      whyItMatters: 'The Scene+ coalition breadth is a differentiator vs single-banner programs. Lean cross-partner redemption into loyalty creative through the year.' },
    { title: 'Sobeys Renews Hockey Community Sponsorship — Grassroots Minor-League Program',
      tags: ['sponsorships', 'sports', 'brand'], urgency: 'low',
      summary: 'Sobeys renewed its grassroots hockey community sponsorship, supporting minor-league programs nationally with in-store activation and Scene+ tie-ins.',
      whyItMatters: 'Community sports anchors the local-and-Canadian brand presence. Tie Scene+ family offers to game-day and community moments through the season.' },
    { title: 'Sobeys "So Canadian" Spot Wins Marketing Award — FCB Cited',
      tags: ['brand', 'sponsorships'], urgency: 'low',
      summary: 'Sobeys\' "So Canadian" brand spot won a Canadian marketing award, with FCB cited for creative and UM for media strategy execution.',
      whyItMatters: 'Award validation strengthens the AOR partnership narrative. Reference in CMO trust-building moments around marketing investment efficacy.' },
    { title: 'Scene+ Summer Festival Activation — Foodie Experiences Across 8 Cities',
      tags: ['sponsorships', 'sports'], urgency: 'medium',
      summary: 'Scene+ activated at summer food festivals across 8 cities, offering member experiences and bonus-point events tied to local food and chef programming.',
      whyItMatters: 'Festival activation indexes high for foodie and premium-fresh audiences. Coordinate Scene+ sign-up drives and Panache sampling at the events.' },
    { title: 'Sobeys Local-Farmer Partnership Series — In-Store "Meet the Grower" Events',
      tags: ['sponsorships', 'partnerships'], urgency: 'medium',
      summary: 'Sobeys launched a "Meet the Grower" in-store event series across regions, spotlighting local farmers and Canadian producers in fresh and produce departments.',
      whyItMatters: 'Direct local-sourcing activation reaching value and foodie shoppers. Ontario, Alberta, and Atlantic regional campaigns should integrate event-specific fresh creative.' },
    { title: 'Compliments Partners with Canadian Chefs for Recipe Content Series',
      tags: ['sponsorships', 'partnerships', 'brand'], urgency: 'low',
      summary: 'Compliments launched a Canadian-chef recipe content series across social and in-store, pairing own-brand products with seasonal meal ideas.',
      whyItMatters: 'Chef-led content lifts Compliments quality perception. Integrate into foodie and weekly-family audience creative to support own-brand trade-in.' },

    // ════════════════════════════════════════════
    // SOCIAL & CULTURAL SIGNALS
    // ════════════════════════════════════════════
    { title: 'r/PersonalFinanceCanada "Cheapest Grocery Run" Megathread Hits 5K Upvotes',
      tags: ['social', 'value'], urgency: 'medium',
      summary: 'A "cheapest grocery run in 2026" megathread on r/PersonalFinanceCanada reached 5K upvotes and 1,400+ comments, with heavy debate on discount banners, private label, and loyalty stacking.',
      whyItMatters: 'Strong organic value conversation Sobeys can win on Compliments and Scene+ stacking. Brief social team to monitor sentiment and surface value proof points where appropriate.' },
    { title: 'TikTok #GroceryHaul Compliments Finds Trend Surpasses 80M Views',
      tags: ['social', 'brand'], urgency: 'low',
      summary: 'The #GroceryHaul trend featuring Compliments and Panache product finds surpassed 80M cumulative views, with creators highlighting value and quality picks.',
      whyItMatters: 'Compliments organic momentum is a free amplification asset. A modest creator-partnership program could amplify own-brand discovery at low cost.' },
    { title: 'Scene+ Member Sentiment Up 12% QoQ — Personalized Offers Cited',
      tags: ['social', 'loyalty'], urgency: 'low',
      summary: 'Scene+ member sentiment tracking shows a 12% quarter-over-quarter lift, driven by more relevant personalized offers and improved app redemption experience.',
      whyItMatters: 'Loyalty sentiment improvements support deeper personalization investment. Consider offer-led creative in retention and Scene+ conversion campaigns.' },
    { title: 'TikTok #VoilaDelivery Trend Drives 40M Views — E-Commerce Convenience UGC',
      tags: ['social', 'launch'], urgency: 'medium',
      summary: 'A #VoilaDelivery trend featuring real customers unboxing well-packed, high-fill-rate orders reached 40M cumulative views, reinforcing Voilà\'s reliability story.',
      whyItMatters: 'Authentic Voilà reliability content. Coordinate paid amplification of the best UGC and use customer language in Voilà conversion creative.' },
    { title: 'X/Twitter "Buy Canadian" Grocery Sentiment Surges in Trade-Tension Cycle',
      tags: ['social', 'value'], urgency: 'medium',
      summary: 'X/Twitter conversation around buying Canadian-made groceries surged during a trade-tension news cycle, with shoppers seeking Canadian-sourced alternatives.',
      whyItMatters: 'Tailwind for the local-sourcing narrative. Surface Buy-Canadian and local-producer call-outs in fresh and produce creative while sentiment is elevated.' },
    { title: 'Reddit r/loblawsisoutofcontrol Boycott Chatter Resurfaces — Discount-Switching Mentions Up',
      tags: ['social', 'competitors'], urgency: 'medium',
      summary: 'Renewed boycott chatter on r/loblawsisoutofcontrol coincided with a 14% rise in mentions of switching grocers, concentrated in Ontario and BC urban clusters.',
      whyItMatters: 'Conquest opportunity among Loblaw-disillusioned shoppers. Scene+ and value messaging targeting Conquest — Loblaws audiences in Toronto and Vancouver can capture switchers.' },
    { title: 'TikTok Compliments-vs-Name-Brand Taste-Test Series Goes Viral — 6M Views',
      tags: ['social', 'value'], urgency: 'medium',
      summary: 'A creator taste-test series comparing Compliments products to national brands went viral at 6M views, with Compliments winning several blind comparisons on quality and value.',
      whyItMatters: 'Authoritative social proof for own-brand quality. Update Compliments creative to lean into the taste-and-value comparison rather than price alone.' },

    // ════════════════════════════════════════════
    // GROCERY INDUSTRY & MARKET DATA
    // ════════════════════════════════════════════
    { title: 'Canadian Grocer Survey — Private-Label Searches Up 47% Year over Year',
      tags: ['grocery', 'value'], urgency: 'medium',
      summary: 'Canadian Grocer\'s shopper survey shows private-label and "store brand" searches up 47% year over year, the largest jump among grocery search categories. Value and deal searches up 22–31%.',
      whyItMatters: 'Quantified intent data validates the Compliments push timing. Use the search-trend data point in own-brand creative and CMO narrative.' },
    { title: 'Canadian Grocery E-Commerce Penetration Reaches 9% — Pickup Leads Delivery',
      tags: ['grocery', 'macro'], urgency: 'low',
      summary: 'Industry data shows Canadian grocery e-commerce penetration reached roughly 9% of sales, with curbside pickup growing faster than home delivery on convenience and lower cost.',
      whyItMatters: 'Pickup is the volume battleground while Voilà wins on basket. Factor the pickup-vs-delivery split into Voilà positioning and convenience messaging.' },
    { title: 'Dalhousie Food Price Report — Households Cutting Meat, Trading Into Store Brands',
      tags: ['grocery', 'value'], urgency: 'medium',
      summary: 'The annual Dalhousie food-price analysis found households reducing meat purchases and trading into store brands and frozen to manage budgets, with fresh produce spend holding.',
      whyItMatters: 'Meat & Seafood faces budget pressure while produce holds. Lean value packs and Compliments in meat, and protect fresh-and-local credibility in produce.' },
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

  // ── FARM BOY-specific hero news ──
  items.push(
    {
      id: 'news-lincoln-bmw-x5-redesign',
      title: 'Whole Foods Canada Launches Aggressive Fresh-Produce Price Reset — Direct Pressure on Farm Boy Produce',
      source: 'Retail Insider',
      date: '2026-05-07',
      tags: ['competitors', 'value'],
      urgency: 'high',
      competitor: 'Whole Foods',
      regions: ['national'],
      summary: 'Whole Foods Canada confirmed a September fresh-produce price reset, dropping opening price points roughly 6% across organic and conventional produce and expanding its everyday-low produce program. The reset also previews a broader local-sourcing push.',
      whyItMatters: 'Whole Foods is the single most aggressive cross-shop in the Farm Boy Fresh Produce funnel (38% overlap). The price reset compresses Farm Boy\'s premium-fresh value position. STRATIS recommends accelerating Farm Boy\'s fresh-quality and local-sourcing value narrative before the Whole Foods reset ramps.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-lexus-rx-loyalty',
      title: 'Metro Prepared-Foods Loyalty Hits Record 91% Repeat Rate — Canadian Grocer Q1 Study',
      source: 'Canadian Grocer',
      date: '2026-05-04',
      tags: ['competitors'],
      urgency: 'medium',
      competitor: 'Metro',
      regions: ['national'],
      summary: 'A Canadian Grocer Q1 study shows Metro prepared-foods repeat-purchase rate at 91% — the highest prepared-meal loyalty figure recorded in conventional grocery. Conquest from Metro prepared-foods shoppers into Farm Boy Prepared Foods & Deli has dropped 4.1pp YoY.',
      whyItMatters: 'Conquest creative against Metro prepared-foods is no longer producing meaningful switching. Farm Boy should pivot Prepared Foods conquest spend toward Whole Foods and organic/natural shopper segments where loyalty is softer. Estimated efficiency gain: 22% on conquest spend.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-luxury-tariff-relief',
      title: 'Province Removes Prepared-Food Tax on Several Fresh-Deli Categories — Effective July 1',
      source: 'Department of Finance Canada',
      date: '2026-05-01',
      tags: ['macro'],
      urgency: 'high',
      regions: ['national'],
      summary: 'A provincial tax change effective July 1, 2026 reclassifies several fresh prepared-deli and ready-meal categories as basic groceries, removing the prepared-food tax on items that previously carried it. Farm Boy Prepared Foods & Deli and Bakery ready-meal lines benefit on several configurations.',
      whyItMatters: 'Removes a 5–13% price friction on affected prepared-deli and bakery ready-meals. STRATIS projects +280 incremental Q3 Scene+ sign-ups and basket trips with creative leading on "now tax-free" messaging post-July 1.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-mercedes-gle-refresh',
      title: 'Metro Confirms 2026 Prepared-Meal Range Refresh — Chef-Led, Fresh-First Lineup, Q3 Launch',
      source: 'Canadian Grocer',
      date: '2026-05-06',
      tags: ['competitors', 'launch'],
      urgency: 'high',
      competitor: 'Metro',
      regions: ['national'],
      summary: 'Metro announced a Q3 prepared-meal range refresh — a fully chef-led, fresh-first lineup with cleaner labels and expanded family-format options. Pricing holds. Estimated national media weight $9.6M over 8 weeks.',
      whyItMatters: 'Metro prepared meals is the #2 cross-shop for Farm Boy Fresh Produce and the #1 cross-shop for Prepared Foods & Deli. The fresh-first message directly counters Farm Boy\'s prepared-foods positioning. Farm Boy Studio should accelerate Prepared Foods freshness messaging in CTV + Spotify before the Metro refresh grabs the conversation.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-tiff-sponsorship-window',
      title: 'TIFF Opens Premier Grocery Sponsorship Window for 2026 Festival — Fresh-Food Tier Limited to One Banner',
      source: 'Toronto International Film Festival',
      date: '2026-05-05',
      tags: ['sponsorships', 'partnerships', 'brand'],
      urgency: 'medium',
      regions: ['ontario', 'national'],
      summary: 'TIFF is accepting applications for its 2026 premier fresh-food sponsorship tier, limited to a single grocery banner. The package includes festival-week culinary activations across Toronto, chef-stage presence, and integrated brand placement. Decision expected late June.',
      whyItMatters: 'TIFF audience demographics overlap 71% with Farm Boy premium-fresh shopper profiles (higher-income, urban, food-forward). The last food sponsor reported a 28% lift in Toronto-DMA brand consideration during festival weeks. Farm Boy Studio should fast-track a TIFF integration brief.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-quebec-luxury-growth',
      title: 'Québec Premium-Fresh Grocery Sales Up 18% YoY in Q1 — Outpacing National 11% Growth',
      source: 'Canadian Grocer',
      date: '2026-05-03',
      tags: ['macro'],
      urgency: 'medium',
      regions: ['quebec'],
      summary: 'A Q1 industry report shows Québec premium-fresh and organic grocery sales grew 18% YoY — well ahead of the 11% national premium-fresh rate. Drivers include Montréal urban-foodie expansion and a Québec-sourced local movement. Farm Boy-style fresh share in Québec held flat.',
      whyItMatters: 'Québec is over-indexing on premium-fresh growth but the Farm Boy fresh model isn\'t capturing it — flat share against a +18% market means competitors are winning the new shoppers. Farm Boy Regional should propose a Québec-specific fresh-produce and prepared-foods campaign to capture growth before share calcifies.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-genesis-dealer-expansion',
      title: 'Whole Foods Confirms 12 New Canadian Stores by 2027 — Toronto, Montréal, Vancouver Priority',
      source: 'Retail Insider',
      date: '2026-04-30',
      tags: ['competitors', 'partnerships'],
      urgency: 'high',
      competitor: 'Whole Foods',
      regions: ['national'],
      summary: 'Whole Foods Canada confirmed plans to open 12 new stores by end of 2027 — concentrated in Toronto (5), Montréal (3), Vancouver (2), Calgary (1), Ottawa (1). The compact urban-fresh format mirrors its US growth strategy.',
      whyItMatters: 'Whole Foods is the fastest-growing premium-fresh entrant in Canada (it has taken meaningful share from specialty-fresh banners over two years). The new footprint targets exactly Farm Boy\'s urban premium-fresh shopper in 5 of the 6 highest-conversion markets. Farm Boy should pre-empt with conquest-Whole Foods creative and fresh-experience differentiation messaging.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-range-rover-sport',
      title: 'Organic-Specialty Chain Pulls Marketing After Fresh-Recall — Produce SOV Vacuum Opens',
      source: 'Canadian Grocer',
      date: '2026-04-29',
      tags: ['competitors'],
      urgency: 'medium',
      competitor: 'Whole Foods',
      regions: ['national'],
      summary: 'A national organic-specialty grocer paused all paid media after a CFIA fresh-produce recall covering several leafy-green SKUs. The marketing pause is expected to last 6–10 weeks pending supplier verification.',
      whyItMatters: 'The organic-specialty chain is the #3 cross-shop for Farm Boy Butcher & Seafood and fresh shoppers. Its media silence creates a 6–10 week SOV vacuum in premium-fresh. Farm Boy Studio should temporarily surge fresh CTV + Spotify weight to capture the organic-shopper cluster while consideration is open.',
      enterprises: ['lincoln'],
    },
    {
      id: 'news-lincoln-quiet-flight-spotify',
      title: 'Spotify Canada Reports Audio Ad Engagement +34% in Food-Enthusiast Segment Q1',
      source: 'Spotify Canada',
      date: '2026-04-26',
      tags: ['partnerships'],
      urgency: 'medium',
      regions: ['national'],
      summary: 'Spotify\'s Q1 Canada audio engagement report shows the Food-Enthusiast segment (urban, food-forward, recipe-and-cooking listeners) drove a 34% YoY lift in audio ad engagement vs. the broader Spotify base. Listening duration up 22%, podcast attribution up 41%.',
      whyItMatters: 'The Spotify Food-Enthusiast audience matches Farm Boy\'s premium-fresh shopper almost exactly. Farm Boy\'s "Fresh, Every Day" audio spots are testing strongly here (12% above benchmark). Farm Boy Studio should push 30% more Spotify weight into Fresh Produce + Prepared Foods before Q3 competitor launches consume the inventory.',
      enterprises: ['lincoln'],
    },
  );

  // ── LONGO'S-specific hero news ──
  items.push(
    {
      id: 'news-dn-ontario-coop-program-update',
      title: "Longo's Updates Store Co-op Reimbursement Structure — Effective Q3 2026",
      source: 'Strategy Online',
      date: '2026-05-06',
      tags: ['brand'],
      urgency: 'high',
      regions: ['national'],
      summary: "Longo's announced changes to store-level co-op reimbursement: digital media (Search, Meta, programmatic) reimbursement rises from 50% to 65%, while traditional media (radio, print flyer) drops from 65% to 40%. Effective for Q3 spend.",
      whyItMatters: 'Stores running >40% traditional media will see effective marketing budget compress unless they shift to digital. STRATIS detects 312 of 890 store-marketing accounts currently above the threshold — proactive outreach can prevent budget surprise and accelerate the flyer→digital transition.',
      enterprises: ['dealership-network'],
    },
    {
      id: 'news-dn-google-vehicle-listing-ads',
      title: 'Google Launches Local Inventory Ads for Grocers in Canada — Available to All Banners',
      source: 'Google Ads Canada',
      date: '2026-05-03',
      tags: ['partnerships'],
      urgency: 'high',
      regions: ['national'],
      summary: 'Google rolled out Local Inventory Ads for Canadian grocers this week. Store and Grocery Gateway product feeds plug into Google Search and Shopping with item-level price and availability. Early results show a 28% lift in qualified store and online visits at flat cost.',
      whyItMatters: 'First-mover stores will capture disproportionate volume. STRATIS recommends a coordinated 60-store pilot across GTA + Grocery Gateway to validate the format before full network rollout. Expected qualified-visit lift: 18-24% within 90 days.',
      enterprises: ['dealership-network'],
    },
    {
      id: 'news-dn-quebec-french-creative-mandate',
      title: 'OQLF Tightens French-Language Compliance for Digital Grocery Ads — December 2026 Deadline',
      source: 'Office québécois de la langue française',
      date: '2026-04-29',
      tags: ['macro'],
      urgency: 'medium',
      regions: ['quebec'],
      summary: 'The Office québécois de la langue française published updated guidance requiring all digital grocery advertising in Québec to feature primary French copy by December 31, 2026. Bilingual ads with English-first treatment will be non-compliant.',
      whyItMatters: 'Québec store co-op currently runs 38% English-first creative. STRATIS detected 64 stores at compliance risk. Coordinated French-creative production via Sobeys Québec saves store-by-store scramble and reduces compliance risk to zero.',
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
    // because STRATIS reads across every team and category at once
    // ═════════════════════════════════════════════════════════════════

    // Card IDs retained from the prior set so chart seeds stay stable.
    {
      id: 'ins-strat-01-brand-promises',
      createdAt: today,
      enterprise: 'ford-canada', category: 'strategic-opener',
      scope: 'brand',
      channels: ['ctv', 'ooh', 'instagram', 'ttd'],
      title: 'Summed Across Every Live Campaign, the Average Shopper Sees Sobeys 31x a Week — Past the Point of Diminishing Brand Return',
      summary: 'Every live Sobeys campaign respects its own frequency cap, but no cap exists across the portfolio. When STRATIS dedupes audiences across all 23 live campaigns spanning FCB/UM national, the regional teams, and the store network, the average reached shopper is seeing roughly 31 Sobeys brand exposures a week — well past the ~8–12 range where brand response plateaus. The overexposure is invisible to any single team because each only sees its own delivery; it only emerges when every campaign is deduped against the same household. A portfolio-level brand frequency cap pulls combined weight back into the effective range and frees the wasted impressions for reach the brand is not getting.',
      evidence: [
        'Deduped across all 23 live Sobeys campaigns: ~31 brand exposures/week to the average reached shopper',
        'Per-campaign frequency caps are respected; no portfolio-level cap exists across the three tiers',
        'Point of diminishing brand return for awareness: ~8–12x/week',
        'Overlap is heaviest where national, regional, and store campaigns hit the same metros',
        'Visible only by deduping audiences across every live campaign at once — no single team sees the sum',
      ],
      confidence: 0.87,
      impactEstimate: 'A portfolio-level brand frequency cap across all live campaigns pulls combined weekly exposure back toward the effective range and redeploys the over-delivered impressions to unreached households — no loss of net reach.',
      recommendedAction: 'Set a portfolio-level brand frequency cap across all live Sobeys campaigns and reallocate the recovered weight to unreached households. STRATIS dedupes and enforces continuously.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Set a portfolio-level brand frequency cap', subtitle: 'ACROSS ALL LIVE CAMPAIGNS, ALL TIERS', type: 'bidding', completed: false },
        { id: 's2', title: 'Reallocate recovered weight to unreached households', subtitle: 'PRESERVE NET REACH', type: 'budget', completed: false },
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
      summary: 'Across the live portfolio, paid brand delivery is climbing — impressions up ~12% quarter over quarter — while organic branded search for Sobeys and Scene+, the clearest demand-pull signal, has softened ~4% over the same window. The two normally move together, and the divergence typically precedes a brand-efficiency decline where each added impression buys less. STRATIS holds delivered brand impressions and branded search side by side across every campaign, so it flags the gap weeks before it surfaces in cost-per-result. Because the pattern holds across tiers rather than in one campaign, the likely cause is creative wear or message — not budget — and adding weight will not close it.',
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
      summary: 'Ranking creative performance across all live Sobeys campaigns, STRATIS finds a single message theme — fresh, local, Canadian-sourced value — consistently beating its alternatives wherever it appears, across multiple campaigns, regional teams, and provinces, on both engagement and consideration. The signal is trustworthy precisely because it repeats across independent campaigns rather than showing up once. Yet the theme lives only inside category, regional, and store activations; no brand-level campaign carries it, and the "So Canadian" Masterbrand Q2 flight does not lead with it. The live portfolio is effectively surfacing the brand\'s next platform on its own — the opportunity is to elevate the proven theme deliberately rather than leave it to keep emerging piecemeal.',
      evidence: [
        'One message theme outperforms its alternatives wherever it runs — across multiple live campaigns, regional teams, and provinces',
        'Outperformance shows on both engagement and consideration',
        'The theme appears only in category, regional, and store activations — no brand-level campaign carries it',
        'The "So Canadian" Masterbrand Q2 flight does not currently lead with the outperforming theme',
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
    // NATIONAL-TO-REGIONAL ORCHESTRATION — Tier 1 (FCB / UM national AOR) →
    // Tier 2 (Atlantic, Québec, Ontario, West regional teams): national demand
    // vs regional capture, playbook cascade
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-natreg-01-demand-vs-budget',
      createdAt: today,
      enterprise: 'ford-canada', category: 'national-regional',
      scope: 'brand',
      channels: ['ctv', 'ttd', 'google-search', 'instagram'],
      title: 'National Campaigns Lifted Scene+ & Category Demand Most in 3 Regions — but Regional Budget Is Weighted to a Different 3',
      summary: 'National (Tier 1) brand and Scene+ activity from FCB/UM is lifting category demand unevenly across the country. STRATIS holds the national demand lift by region against where the regional teams are actually spending and finds them out of sync: the markets where Tier 1 created the most warmed demand — Ontario, Alberta, and the West over the trailing 30 days — are not the markets carrying the most Tier 2 weight. Sobeys pays nationally to create demand in one set of regions and funds conversion in another. No single team sees both halves; national sees its delivery, and each regional team sees only its own market. Reweighting Tier 2 toward the national tailwind converts demand that is already in market, at lower cost than generating it fresh — and at higher ROAS.',
      evidence: [
        'National (Tier 1) Scene+/category demand lift, trailing 30 days: strongest in Ontario, Alberta, and the West',
        'Heaviest Tier 2 weight sits in a different set of markets — not following the national lift',
        'Regions with the largest national assist are under-resourced at the regional tier',
        'National sees its own delivery; each regional team sees only its own market — neither sees the mismatch',
        'Regional teams, ~$41.8M total — reweightable toward where Tier 1 created demand',
      ],
      confidence: 0.83,
      impactEstimate: 'Reweighting Tier 2 toward the regions where Tier 1 created the most demand converts warmed shoppers already in market, at lower cost and higher ROAS than generating fresh demand; STRATIS tracks national lift against regional weight continuously.',
      recommendedAction: 'Reweight regional (Tier 2) budget toward the markets where Tier 1 created the most demand lift. STRATIS holds national lift and regional spend in one view and flags drift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Rank regions by the national-to-regional demand gap', subtitle: 'TIER 1 LIFT vs TIER 2 WEIGHT', type: 'targeting', completed: false },
        { id: 's2', title: 'Reweight regional budget toward the national tailwind', subtitle: 'PHASED — ALL REGIONAL TEAMS', type: 'budget', completed: false },
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
      title: 'Ontario Delivers the Portfolio\'s Lowest ROAS — 30%+ Below National — While the West Beats the Benchmark on the Same Budget. Its Playbook Has Reached Only 1 Region',
      summary: 'On the same media budget, the West region delivers the portfolio\'s best ROAS while Ontario delivers the worst — running roughly 30%+ below the national benchmark, the widest efficiency gap of any region. The reason is structural: the West has converged on a proven Scene+ audience and channel mix that the other regional teams have not. STRATIS compares the West\'s structure against every other region and finds only one has adopted it; the rest run their own audience and channel structures and sit well below national ROAS. The winning playbook is not a secret — it has simply never been cascaded, because no layer sits across the national team and all the regions at once. Pushing the West\'s proven structure to Ontario and the other regions is a free efficiency gain that needs no new creative, only a structural change.',
      evidence: [
        'ROAS by region: West 4.1x (best) vs national 3.4x benchmark vs Ontario 2.4x (worst — ~30% below national)',
        'Same budget weight across regions — the gap is structure, not spend',
        'The West\'s proven Scene+ audience + channel mix matched by only 1 other region; the rest run their own',
        'Secondary read: West cost per Scene+ sign-up ~$148 vs Ontario ~$298 — same efficiency story',
        'No layer sits across national and all the regions at once — the playbook never cascades; no new creative needed',
      ],
      confidence: 0.85,
      impactEstimate: 'Cascading the West\'s proven audience and channel structure to Ontario and the other regions pulls their ROAS toward the best-in-class 4.1x with no new creative — closing the 30%+ Ontario gap; STRATIS tracks adoption and the ROAS gap.',
      recommendedAction: 'Codify the West\'s proven Scene+ audience and channel mix as the regional standard and cascade it to Ontario and the regions that have not adopted it. STRATIS tracks adoption and the regional ROAS gap.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Codify the West\'s proven structure as the regional standard', subtitle: 'AUDIENCE + CHANNEL MIX', type: 'targeting', completed: false },
        { id: 's2', title: 'Cascade to Ontario and the non-adopting regions', subtitle: 'PHASED — NO NEW CREATIVE', type: 'targeting', completed: false },
        { id: 's3', title: 'Track adoption and the regional ROAS gap', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
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
      productLine: 'scene-plus',
      campaign: 'Scene+ Summer Activation — National Hero',
      channels: ['ctv', 'facebook', 'instagram', 'tiktok', 'spotify'],
      title: 'YouTube Beats CTV + Meta on Cost-Per-View — Yet Holds the Smallest Share of the Video Budget',
      summary: 'Holding channel efficiency and channel allocation in one view, STRATIS found YouTube beating both CTV and Meta video on cost-per-view over the trailing 30 days, while receiving the smallest share of the video pool. The two facts live in separate team dashboards, so the headroom is invisible until they sit together. The recommended move is deliberately small and reversible: a single capped step into the proven channel, measured before any larger shift, so the test costs little if the lift does not hold.',
      evidence: [
        'Cost-per-view (trailing 30 days): YouTube best of the video set, ahead of CTV and Meta video',
        'YouTube share of the video pool: smallest, despite leading on cost-per-view',
        'Facebook video carries the largest video share at the highest cost-per-view',
        'Efficiency and allocation live in separate team dashboards — the headroom is invisible until they sit together',
        'Recommended step is capped and reversible — a single move measured before any larger shift',
      ],
      confidence: 0.86,
      impactEstimate: 'A capped, reversible shift of video budget into YouTube, read at 14 days before scaling, captures the cost-per-view efficiency at low downside if the lift does not hold.',
      recommendedAction: 'Shift video budget into YouTube in a capped, reversible step and measure Scene+ consideration lift before scaling. Adjust slider to set the step size, then push through UM\'s buying seats.',
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
      summary: 'Instagram CPMs rose materially over the trailing three weeks while the cost-per-result held flat, meaning Sobeys is now paying more to achieve the same outcome and the budget has not yet reacted. STRATIS tracks CPM against outcome by platform continuously, so it flagged the divergence the week it began rather than at the end of a monthly reporting cycle. The move is a straightforward reallocation away from a channel that has quietly gotten more expensive toward channels currently under their benchmark, fully reversible if the CPM trend reverses.',
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
      title: 'The National AOR + a Regional Team Are Bidding the Same Meta Value-Families Audience Against Each Other — Self-Inflicted CPM Premium',
      summary: 'The national AOR (FCB / UM) and a regional banner team are both live on Meta against the same value-seeking family audience in the same flyer window. Because they bid into the same auction for the same shoppers, Sobeys\' effective CPM on the contested audience runs measurably above the CPM on comparable non-overlapping audiences. Neither team can see this; each sees only its own plan. This is the single clearest example of why cross-silo visibility matters, and it is exactly the kind of waste a media team suspects exists but can almost never prove. A shared suppression layer removes the internal competition without either team losing reach it actually needs.',
      evidence: [
        'National AOR (Tier 1, FCB / UM) and a regional team both live on Meta against the same value-families audience, same flyer window',
        'Effective CPM on the contested audience runs measurably above CPM on comparable non-overlapping audiences',
        'Both teams bid into the same auction for the same shoppers — neither can see the other\'s plan',
        'Clearest example in the account of cross-silo waste a media team suspects but cannot usually prove',
        'A shared suppression layer removes the internal competition without either team losing needed reach',
      ],
      confidence: 0.88,
      impactEstimate: 'A shared audience-suppression layer ends the national and regional teams bidding against each other on Meta and removes the self-inflicted CPM premium; a monthly overlap audit keeps it from recurring.',
      recommendedAction: 'Implement a shared audience-suppression layer so the national and regional teams stop competing for the same impressions. Run a cross-team overlap audit monthly via STRATIS.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Deploy cross-team audience suppression', subtitle: 'META FIRST, THEN EXPAND', type: 'targeting', completed: false },
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
      title: 'Voilà Product-Listing Ads Convert at ~2.6x the ROAS of Generic Search — Yet Generic Search Still Holds the Larger Google Budget',
      summary: 'Across the 312 store pages running both formats, Voilà product-listing ads and inventory-aware local placements are delivering materially higher ROAS than generic Search over the trailing 30 days (5.8 vs 2.2), because they let in-market shoppers see the exact item, price, and nearest store before they click. Despite that, generic Search still holds the larger share of the combined Google budget out of habit, while product-listing ads are underfunded. The move starts only with the 170 stores that already have clean product/price feeds, stands up a feed-cleanup workstream for the remaining 142, and leaves brand-defense spend untouched, so nothing breaks while the efficient format scales.',
      evidence: [
        'Product-listing ROAS (last 30d, 312 store pages): 5.8 vs generic Search 2.2 (~2.6x)',
        'Generic Search share of combined Google spend: 47% ($1.02M/mo)',
        'Product-listing share: 18% ($391K/mo) — capped by feed coverage, not budget',
        'GS Brand defense: 35% ($760K/mo) — hold steady, do not grow',
        '170 of 312 stores have clean product/price feeds; 142 still incomplete — blocking scaling',
        'Performance Max with feed lift over standalone listing ads in pilot: +18% on weekly-flyer items',
      ],
      confidence: 0.89,
      impactEstimate: 'Shifting a capped $480K/month from generic Search into product-listing ads + Performance Max across the 170 clean-feed stores is projected at ~$312K/month incremental store-attributed sales ($3.7M annual), with brand-defense spend unchanged.',
      recommendedAction: 'Shift a capped slice from generic Search into Voilà product-listing ads + Performance Max with product feed, starting with the stores that have clean feeds. Maintain brand defense at current levels. Adjust slider to set rollout pace before launching the bid adjustments.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Apply the capped shift to clean-feed stores', subtitle: 'PRODUCT LISTINGS + PMAX — 170 STORES', type: 'budget', completed: false },
        { id: 's2', title: 'Stand up feed-cleanup workstream', subtitle: 'REMAINING 142 STORES — VOILÀ FEED', type: 'targeting', completed: false },
        { id: 's3', title: 'Hold brand-defense search at current levels', subtitle: 'NO CHANGE', type: 'budget', completed: false },
      ],
    },
    {
      id: 'ins-tac-08-lightning-creative-fatigue',
      createdAt: at(0, '10:15:00'),
      enterprise: 'ford-canada', category: 'tactical-efficiency',
      scope: 'product',
      productLine: 'scene-plus',
      channels: ['facebook', 'instagram', 'ctv', 'tiktok'],
      title: 'Scene+ Summer Conquest Creative Peaked 11 Days Ago on Meta — Where the Majority of Its Spend Still Sits',
      summary: 'The Scene+ summer conquest creative\'s effectiveness on Meta peaked about 11 days ago and has been declining as cumulative frequency builds, yet Meta still carries the majority of the variant\'s delivery. STRATIS tracks per-creative decay by platform alongside delivery share, so it caught the fatigue while the creative is still performing on lower-frequency platforms. Continuing to weight a fatiguing unit on its most-saturated platform pays a rising cost for falling return. Rotating the creative and moving weight to fresher platforms recovers efficiency without pulling the Scene+ sign-up push.',
      evidence: [
        'Scene+ conquest creative effectiveness on Meta: peaked ~11 days ago, declining as cumulative frequency builds',
        'Meta still carries the majority of the variant\'s delivery',
        'Same creative remains fresh on lower-frequency platforms (CTV, TikTok)',
        'STRATIS tracks per-creative decay by platform alongside delivery share — caught the fatigue while the unit still performs elsewhere',
        'Weighting a fatiguing unit on its most-saturated platform pays a rising cost for falling return',
      ],
      confidence: 0.85,
      impactEstimate: 'Rotating the variant and capping frequency on Meta, then moving that weight to platforms where the creative is still fresh, recovers efficiency without pulling the Scene+ sign-up push.',
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
    // and delivery-vs-segment mismatches across the category portfolio
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
      productLine: 'compliments',
      channels: ['ttd', 'instagram', 'ctv'],
      title: 'The Compliments Own-Brand Variant That Wins Premium-Fresh Foodies Gets a Minority of Impressions — Delivery Is Optimizing to a Cheaper, Lower-Converting Audience',
      summary: 'Cross-referencing creative conversion by audience segment against impression share, STRATIS found the Compliments own-brand variant that converts best among premium-fresh foodies is receiving a minority of impressions, because delivery is optimizing toward a broader, cheaper audience that converts at a lower rate. The optimization is doing what it was told, just toward volume rather than the high-value segment. Conversion-by-segment and impression share normally live in different reports, so the mismatch goes unseen. Rebalancing delivery toward the segment the variant actually wins should lift Compliments consideration among the shoppers that matter most.',
      evidence: [
        'The Compliments variant that converts best among premium-fresh foodies receives a minority of impressions',
        'Delivery is optimizing toward a broader, cheaper audience that converts at a lower rate',
        'The optimization is doing what it was told — toward volume, not the high-value segment',
        'Conversion-by-segment and impression share live in different reports, so the mismatch goes unseen',
        'Rebalancing toward the segment the variant wins should lift Compliments consideration among the shoppers that matter most',
      ],
      confidence: 0.83,
      impactEstimate: 'Rebalancing delivery of the winning variant toward the premium-fresh foodie segment, capped and reversible on the broad audience, is read on Compliments consideration lift at 14 days.',
      recommendedAction: 'Rebalance delivery toward the premium-fresh foodie segment for the winning variant and measure Compliments consideration lift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Rebalance delivery to the premium-fresh segment', subtitle: 'WINNING VARIANT', type: 'targeting', completed: false },
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
      title: '0 Categories Are on a Scheduled Creative Refresh — Every One Waits for Cost-per-Result to Climb Before Replacing',
      summary: 'Looking across every category\'s creative timeline, STRATIS found that refresh is consistently reactive: creative is replaced only after effectiveness has already fallen and cost-per-result has begun to climb as a lagging signal. No category is currently on a scheduled, fatigue-anticipating cadence. Because the pattern repeats across the portfolio, Sobeys pays the same avoidable fatigue tax again and again. A predictive calendar driven by per-creative decay curves flags each unit before it tips, turning a recurring loss into a scheduled, planned refresh.',
      evidence: [
        'Categories on a scheduled, fatigue-anticipating refresh cadence today: 0',
        'Creative is replaced only after effectiveness has fallen and cost-per-result has begun to climb — a lagging signal',
        'Pattern repeats across the portfolio — Sobeys pays the same avoidable fatigue tax again and again',
        'A predictive calendar driven by per-creative decay curves flags each unit before it tips',
        'Piloting on the two highest-spend categories proves the saving first',
      ],
      confidence: 0.82,
      impactEstimate: 'A predictive refresh calendar that flags fatigue before cost-per-result climbs turns a recurring, reactive loss into a scheduled, planned refresh — proven first on the two highest-spend categories.',
      recommendedAction: 'Move to a predictive refresh calendar where STRATIS flags fatigue before cost-per-result climbs.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Build the predictive refresh calendar', subtitle: 'ALL CATEGORIES', type: 'scheduling', completed: false },
        { id: 's2', title: 'Set fatigue-threshold alerts per creative', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
        { id: 's3', title: 'Pilot on the two highest-spend categories first', subtitle: 'PROVE THE SAVING', type: 'creative', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // AUDIENCE TARGETING & OVERLAP — shared-audience collisions and
    // portfolio frequency math across the Sobeys category lineup
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-tac-12-tesla-conquest-overlap',
      createdAt: at(1, '08:45:00'),
      enterprise: 'ford-canada', category: 'audience-overlap',
      scope: 'brand',
      channels: ['ctv', 'ttd', 'instagram', 'facebook', 'google-search'],
      title: 'Scene+, Weekly Flyer + Compliments Are All Targeting the Same No Frills–Conquest Audience — One Shopper, 3 Uncapped Sobeys Messages',
      summary: 'The same No Frills–conquest audience sits in three categories\' active targeting at the same time, so a single shopper can receive three uncoordinated Sobeys messages with no cap across them. Each campaign team sees only its own delivery, so combined frequency on the shared shopper runs well above the point of diminishing returns. STRATIS sees all three categories\' targeting at once, which is the only way the overexposure becomes visible. A portfolio-level cap plus a designated primary category per segment ends the internal pile-on and recovers the wasted impressions, without reducing legitimate conquest reach.',
      evidence: [
        'The same No Frills–conquest audience sits in three categories\' active targeting at once: Scene+, Weekly Flyer, Compliments',
        'No frequency cap exists across the three — a single shopper can receive three uncoordinated Sobeys messages',
        'Each campaign team sees only its own delivery; combined frequency runs well above diminishing returns',
        'STRATIS sees all three categories\' targeting at once — the only way the overexposure becomes visible',
        'A portfolio cap plus a primary category per segment ends the pile-on without cutting legitimate conquest reach',
      ],
      confidence: 0.90,
      impactEstimate: 'A portfolio-level frequency cap on shared conquest audiences plus a primary category per segment recovers the wasted impressions from three uncoordinated Sobeys messages hitting one shopper.',
      recommendedAction: 'Implement a portfolio-level frequency cap on shared conquest audiences and assign a primary category per segment.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Apply portfolio-level frequency cap', subtitle: 'SHARED CONQUEST AUDIENCES', type: 'bidding', completed: false },
        { id: 's2', title: 'Assign a primary category per conquest segment', subtitle: 'ROUTING RULE', type: 'targeting', completed: false },
        { id: 's3', title: 'Monitor combined frequency continuously', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-tac-13-ev-considerer-overlap',
      createdAt: at(2, '09:00:00'),
      enterprise: 'ford-canada', category: 'audience-overlap',
      scope: 'brand',
      channels: ['google-search', 'facebook', 'instagram', 'ttd'],
      title: 'Voilà + Weekly Flyer Are Spending Against the Same Value-Family Audience — They Convert Different Shoppers and Should Be Sequenced',
      summary: 'Both categories target value-seeking families, but STRATIS\'s conversion-by-readiness data shows they convert different people: the Weekly Flyer wins price-led shoppers planning an in-store trip, while Voilà wins time-pressed households ready to switch to online delivery. Running both against the blended audience means each spends against shoppers the other would convert more efficiently, diluting both. Splitting the audience by readiness signal and sequencing the messages lets each category spend where it is strongest, and gives the portfolio a logical ladder from flyer-driven value to full online conversion.',
      evidence: [
        'Both categories target value-seeking families, but conversion-by-readiness shows they convert different shoppers',
        'The Weekly Flyer wins price-led shoppers planning an in-store trip',
        'Voilà wins time-pressed households ready to switch to online delivery',
        'Running both against the blended audience means each spends against shoppers the other would convert more efficiently',
        'Splitting by readiness signal gives the portfolio a logical ladder from flyer-driven value to online conversion',
      ],
      confidence: 0.84,
      impactEstimate: 'Splitting the value-family audience by readiness and sequencing the Weekly Flyer to in-store planners and Voilà to delivery-ready households lets each category spend where it is strongest; blended efficiency is measured against the prior approach.',
      recommendedAction: 'Split the audience by readiness signal and sequence the messaging — Weekly Flyer to in-store planners, Voilà to delivery-ready households.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Split the value-family audience by readiness signal', subtitle: 'TWO TIERS', type: 'targeting', completed: false },
        { id: 's2', title: 'Route Weekly Flyer to in-store planners, Voilà to delivery-ready', subtitle: 'SEQUENCED', type: 'targeting', completed: false },
        { id: 's3', title: 'Measure blended efficiency vs prior approach', subtitle: 'STRATIS REPORTS', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // COMPETITIVE & MACRO INTELLIGENCE — external signals triangulated
    // against Sobeys search, reported as correlation, not cause
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-011-tesla-cybertruck-response',
      createdAt: at(0, '10:15:00'),
      enterprise: 'ford-canada', category: 'competitive-macro',
      scope: 'product',
      productLine: 'scene-plus',
      channels: ['ctv', 'google-search', 'ttd'],
      linkedNewsId: 'news-tesla-cybertruck-cut',
      title: 'No Frills Launches the "Hauler Hotline" Price Event — Value-Comparison Search Lifts in the Days After. Recommend a Measured, Surgical Counter — Not a Price War',
      summary: 'STRATIS\'s keyword scraping detected No Frills\' "Hauler Hotline" price event and, in the days following, observed a measurable rise in Sobeys-vs-No Frills value-comparison search. STRATIS is reporting this as a correlation in the window, not a causal claim on Sobeys\' price position, because value-comparison search has many drivers. The responsible move is deliberately surgical: a defined key-value-item basket defended with targeted Scene+ offers and flyer features to the shoppers showing the new search behaviour — not a blanket price drop. The whole point is to protect share on the items shoppers actually compare while leaving the rest of the basket and margin intact, with STRATIS watching whether the shift persists before any larger commitment.',
      evidence: [
        'No Frills "Hauler Hotline" value event launched nationally (detected via competitor / keyword scraping)',
        'Sobeys-vs-No Frills value-comparison search: measurable rise in the days following',
        'Reported as a correlation in the window — not a causal claim on Sobeys\' price position',
        'Concentrated on a defined key-value-item (KVI) basket — the items shoppers actually compare',
        'A surgical KVI defence protects share without triggering a margin-destroying blanket price war',
      ],
      confidence: 0.86,
      impactEstimate: 'A measured ~$1.4M targeted response — Scene+ offers and flyer features on a defined key-value-item basket to the affected search segment — defends share on the items shoppers compare; STRATIS monitors whether the shift persists before any larger commitment.',
      recommendedAction: 'STRATIS is monitoring — activate a surgical KVI-basket defence (targeted Scene+ offers + flyer features) to the affected value-comparison search segment. Hold the line on the comparison items only; do not start a blanket price war. Monitor and scale only if the shift holds.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Activate the KVI-basket defence to the affected segment', subtitle: 'TARGETED SCENE+ OFFERS + FLYER — NOT A PRICE WAR', type: 'creative', completed: false },
        { id: 's2', title: 'Brief national AOR on the measured response plan', subtitle: 'CONFIRM', type: 'creative', completed: false },
        { id: 's3', title: 'Continue monitoring the value-comparison search signal', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-010-gas-price-phev-tailwind',
      createdAt: at(0, '07:30:00'),
      enterprise: 'ford-canada', category: 'competitive-macro',
      scope: 'product',
      productLine: 'voila',
      channels: ['google-search', 'facebook', 'instagram'],
      title: 'Food Inflation Above 4% for 14+ Days Coincides With Rising Compliments Own-Brand & Value Organic Search',
      summary: 'Scraping grocery-inflation data alongside organic search, STRATIS observed that extended periods of elevated food prices coincide with increased organic interest in Compliments own brands and "best value" grocery search as households trade down. This is reported as a correlation, not a causal relationship, since organic interest responds to many factors at once. The opportunity is to meet the demand that is already forming: weighting value and own-brand savings messaging while the high-inflation window lasts, and pulling back when it closes. Because it rides an existing signal rather than trying to create one, the move is low-cost and fully reversible.',
      evidence: [
        'National food CPI currently above the 4% YoY threshold for 14+ consecutive days',
        'Elevated-inflation windows coincide with rising Compliments / value-grocery organic search (correlation, not cause)',
        'Organic interest responds to many factors at once — reported as correlation only',
        'Move rides an existing demand signal rather than trying to manufacture one',
        'Fully reversible — pull back when the high-inflation window closes',
      ],
      confidence: 0.84,
      impactEstimate: 'Leaning Compliments own-brand and value-savings messaging into the high-inflation window while it persists meets demand that is already forming; a food-inflation threshold trigger weights and pulls back automatically.',
      recommendedAction: 'STRATIS is monitoring — lean Compliments own-brand and value-savings messaging into the high-inflation window while it persists. Fully reversible.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Weight Compliments own-brand & value messaging', subtitle: 'WHILE WINDOW PERSISTS', type: 'budget', completed: false },
        { id: 's2', title: 'Set the food-inflation threshold trigger', subtitle: 'STRATIS MONITORS', type: 'scheduling', completed: false },
        { id: 's3', title: 'Pull back when the window closes', subtitle: 'AUTOMATED FLAG', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // FARM BOY — CMO-level insights for the Farm Boy fresh-market banner
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-lincoln-001-nautilus-rx-pivot',
      enterprise: 'lincoln',
      createdAt: today,
      category: 'portfolio-dynamics',
      scope: 'product',
      productLine: 'lincoln-nautilus',
      channels: ['ctv', 'ttd', 'google-search'],
      title: 'Conquest spend against Whole Foods prepared-foods shoppers no longer converting — pivot Prepared Foods & Deli dollars to Metro and organic-natural segments',
      summary: 'Whole Foods prepared-foods loyalty hit a record 91% in its GTA trade area (Q1 shopper-panel read, May 4). Farm Boy\'s Prepared Foods & Deli conquest flow from Whole Foods shoppers has dropped 4.1pp YoY. Continuing to spend against an audience that won\'t switch is value-destructive. STRATIS recommends reallocating that conquest spend to Metro and organic-natural shoppers where loyalty is softer (78% and 74% respectively).',
      evidence: [
        'Whole Foods prepared-foods loyalty Q1 2026: 91% (record high, shopper panel)',
        'Prepared Foods & Deli conquest flow from Whole Foods: −4.1pp YoY',
        'Metro loyalty: 78% / Organic & Natural shoppers loyalty: 74%',
        'Current Prepared Foods conquest spend: $720K against Whole Foods, $310K against Metro/organic combined',
        'Conquest cost per sign-up — Whole Foods: $612 / Metro: $384 / Organic: $358',
      ],
      confidence: 0.86,
      impactEstimate: 'Reallocating $580K from Whole Foods–conquest to Metro + organic-natural conquest projects +260 incremental Farm Boy sign-ups at $372 blended cost per sign-up — 22% efficiency gain on conquest spend.',
      recommendedAction: 'Sunset Whole Foods–conquest creative immediately. Farm Boy Studio produces new Metro and organic-natural comparative cuts within 3 weeks. Maintain a $140K residual presence on Whole Foods shoppers for any high-intent late-funnel signals.',
      status: 'new',
      linkedNewsId: 'news-lexus-rx-loyalty',
      actionSteps: [
        { id: 's1', title: 'Sunset Prepared Foods vs Whole Foods conquest', subtitle: 'PAUSE ACTIVE CREATIVE', type: 'creative', completed: false },
        { id: 's2', title: 'Brief Farm Boy Studio on Metro + organic cuts', subtitle: '3-WEEK PRODUCTION TIMELINE', type: 'creative', completed: false },
        { id: 's3', title: 'Reallocate $580K to Metro/organic audiences', subtitle: 'TTD + GOOGLE SEARCH', type: 'budget', completed: false },
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
      title: 'Whole Foods cuts everyday fresh-produce prices ~6% — narrowing Farm Boy\'s premium-fresh gap and compressing its quality positioning',
      summary: 'Whole Foods Canada rolled out an everyday-low-price cut of ~6% on core fresh produce (announced May 7), narrowing the price gap to Farm Boy\'s premium-fresh produce. 38% of Farm Boy\'s produce consideration cross-shops Whole Foods. The move re-frames Farm Boy as the higher-priced option in premium fresh — the opposite of how the banner has positioned its produce. STRATIS recommends accelerated quality-and-value-narrative repositioning before the Whole Foods campaign ramps in September.',
      evidence: [
        'Whole Foods everyday produce price cut: ~6% on core items (announced May 7)',
        'Farm Boy premium-fresh produce sits above the new Whole Foods price line',
        'Farm Boy produce ↔ Whole Foods consideration overlap: 38%',
        'Whole Foods campaign ramp: September 2026 (~120 days)',
        'Current Farm Boy produce creative emphasizes freshness + sourcing — does not address price perception',
      ],
      confidence: 0.83,
      impactEstimate: 'Quality-and-value-narrative repositioning (lead with "store-grown freshness and local sourcing at everyday prices") projects +320 Farm Boy sign-ups in conquest segments over the Whole Foods campaign window.',
      recommendedAction: 'Brief Farm Boy Studio on a revised produce value narrative: freshness-and-sourcing story vs. the price-only message. Activate within 5 weeks (before the Whole Foods ramp). CTV + Search + OOH coordinated.',
      status: 'new',
      linkedNewsId: 'news-lincoln-bmw-x5-redesign',
      actionSteps: [
        { id: 's1', title: 'Brief Farm Boy Studio on value-narrative shift', subtitle: 'FRESHNESS + LOCAL-SOURCING POSITIONING', type: 'creative', completed: false },
        { id: 's2', title: 'Activate value creative across CTV + Search + OOH', subtitle: 'BEFORE SEPT WHOLE FOODS PUSH', type: 'scheduling', completed: false },
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
      title: 'Farm Boy Regional\'s original-French bakery creative outperforms Farm Boy Studio\'s adapted version by 2.3x ThruPlay in French markets',
      summary: 'Farm Boy bakery runs two French-language creative tracks: Farm Boy Regional\'s original-French cut and Farm Boy Studio\'s translated-from-English cut. The original-French version delivers 2.3x the ThruPlay completion rate and 1.8x the qualified site sessions, but only receives 22% of French-market bakery impression weight because budgets default to studio ownership.',
      evidence: [
        'Farm Boy Regional original-French bakery — ThruPlay rate: 41.8%',
        'Farm Boy Studio translated cut — ThruPlay rate: 17.9%',
        'Original-French qualified-session lift: 1.8x',
        'Current French-market impression weight: 22% Regional / 78% Studio',
        'French markets are bakery\'s second-strongest region (after core Ontario)',
      ],
      confidence: 0.81,
      impactEstimate: 'Reweighting French-market bakery to 75% Regional original-French / 25% Studio captures +14K additional ThruPlays and +280 qualified sessions at flat $1.8M French-market spend.',
      recommendedAction: 'Reweight French-market bakery impression share to performance-based (75/25 Regional/Studio). Codify that Farm Boy Regional owns French-language creative production, with Farm Boy Studio retaining the English-Canada national lead.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Reweight French-market bakery to 75/25 Regional/Studio', subtitle: 'INSTAGRAM + FACEBOOK + SPOTIFY', type: 'creative', completed: false },
        { id: 's2', title: 'Codify Farm Boy Regional as French-creative lead', subtitle: 'POLICY CHANGE Q3', type: 'creative', completed: false },
      ],
    },
    {
      id: 'ins-lincoln-004-luxury-tax-window',
      enterprise: 'lincoln',
      createdAt: at(1, '11:00:00'),
      category: 'macro-convergence',
      scope: 'brand',
      channels: ['google-search', 'instagram', 'spotify', 'ctv'],
      title: 'Federal GST/HST holiday on prepared foods opens July 1 — Farm Boy prepared-foods and bakery baskets gain a 5–13% price-friction removal',
      summary: 'A federal GST/HST holiday on qualifying prepared foods, snacks and baked goods takes effect July 1 (announced May 1). Many of Farm Boy\'s hot-table, deli and bakery items that were previously taxed become tax-free for the window. STRATIS recommends a focused 90-day creative push leading with "no tax on prepared foods" positioning for the affected departments.',
      evidence: [
        'GST/HST holiday on qualifying prepared foods & baked goods: effective July 1',
        'Most-shopped Farm Boy hot-table & deli baskets: now tax-free in the window',
        'Bakery items: mixed effect depending on category',
        'Average tax saved on a prepared-foods basket: 5–13%',
        'Window before the tax framing becomes normalized: 60-90 days',
      ],
      confidence: 0.84,
      impactEstimate: 'Activating a 90-day "no tax on prepared foods" creative push projects +280 incremental Q3 Farm Boy sign-ups, with avg consideration-to-sign-up conversion lifting from 8.1% to 11.4% on affected departments.',
      recommendedAction: 'Brief Farm Boy Studio on a 90-day creative push leading with the tax-removal framing. Activate July 1 across Search, Instagram, Spotify, CTV. Coordinate in-store signage with item-level eligibility messaging.',
      status: 'new',
      linkedNewsId: 'news-luxury-tariff-relief',
      actionSteps: [
        { id: 's1', title: 'Brief Farm Boy Studio on tax-removal creative', subtitle: 'PREPARED FOODS & DELI + BAKERY', type: 'creative', completed: false },
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
      title: 'Butcher & Seafood and Fresh Produce are both targeting the Conquest — Whole Foods audience — Butcher & Seafood should own this segment outright',
      summary: 'Both Butcher & Seafood and Fresh Produce are simultaneously active against the Conquest — Whole Foods audience in Tier 1 CTV. Audience overlap is 84% — these are the same shoppers. Butcher & Seafood\'s aggregate frequency on this audience is 12x/week, Fresh Produce\'s is 9x/week — combined 21x, well above the 8x effective cap. Brand-recall testing shows aggregated frequency dilutes both departments\' positioning.',
      evidence: [
        'Conquest — Whole Foods audience size: 47K profiles in the GTA trade area',
        'Butcher & Seafood frequency: 12x/wk · Fresh Produce frequency: 9x/wk · combined: 21x/wk',
        'Premium-fresh optimal cap: 8x/wk (Farm Boy Studio benchmark)',
        'Brand recall in dual-targeted cohort: −18% vs single-department cohort',
        'Farm Boy department substitution math: Butcher & Seafood wins on Conquest — Whole Foods (higher consideration), Fresh Produce wins on organic & natural',
      ],
      confidence: 0.85,
      impactEstimate: 'Designating Butcher & Seafood as exclusive department for Conquest — Whole Foods (Fresh Produce suppresses) cuts frequency to 12x and projects +14pp brand recall, plus $410K in recovered impression spend.',
      recommendedAction: 'Implement department-exclusive audience policy at Farm Boy: Butcher & Seafood → Conquest Whole Foods; Fresh Produce → organic & natural; Prepared Foods & Deli → Conquest Metro; Bakery → prepared-foods shoppers. Configure via TTD audience-suppression API.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Implement Farm Boy department-exclusive audience policy', subtitle: 'PORTFOLIO POLICY CHANGE', type: 'targeting', completed: false },
        { id: 's2', title: 'Configure TTD audience suppression', subtitle: 'BUTCHER / PRODUCE / PREPARED / BAKERY', type: 'targeting', completed: false },
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
      title: 'Ontario local-harvest produce season opens in 84 days — current Tier 1 weight is 0.7x of the competitive-set average',
      summary: 'Farm Boy\'s Ontario local-harvest produce season opens August 1. STRATIS rolled up confirmed competitor seasonal pushes — Whole Foods local-harvest ($14.2M weight), Metro produce refresh ($9.8M), and Loblaw farmers-market push ($11.6M) for the same window. Farm Boy\'s current planned weight is $7.8M — 0.7x the average competitive seasonal weight. Without a surge, the harvest push will be SOV-disadvantaged in CTV.',
      evidence: [
        'Ontario local-harvest season opens: August 1, 2026 (84 days out)',
        'Whole Foods local-harvest weight: $14.2M / Metro produce refresh: $9.8M / Loblaw farmers-market: $11.6M',
        'Farm Boy current planned weight: $7.8M Tier 1 (under-weighted)',
        'Fresh-category CTV CPM in seasonal windows: $76 (1.8x normal)',
        'Available surge sources: Bakery always-on ($1.4M slack), Prepared Foods mid-funnel ($800K slack)',
      ],
      confidence: 0.82,
      impactEstimate: 'A $2.6M harvest-season surge (pulled from Bakery always-on + Prepared Foods mid-funnel slack) brings Fresh Produce to 1:1 SOV vs the competitive avg and lifts the season\'s share probability +19pp.',
      recommendedAction: 'Reallocate $2.6M from Bakery always-on + Prepared Foods mid-funnel into the local-harvest CTV + OOH push for the 60-day window. Farm Boy Studio executes. Brief the Bakery team that always-on resumes in October.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Reallocate $2.6M to the local-harvest push', subtitle: 'FROM BAKERY + PREPARED FOODS SLACK', type: 'budget', completed: false },
        { id: 's2', title: 'Brief Farm Boy Studio on the seasonal SOV plan', subtitle: '1:1 vs COMPETITIVE AVG', type: 'scheduling', completed: false },
      ],
    },

    // ═════════════════════════════════════════════════════════════════
    // LONGO'S STORE NETWORK — Corporate "wow" insights derived from
    // cross-store pattern recognition across all 890 store locations + Grocery
    // Gateway. The network CMO reads these to make holistic strategic decisions.
    // ═════════════════════════════════════════════════════════════════

    {
      id: 'ins-dn-001-pioneer-cohort',
      enterprise: 'dealership-network',
      createdAt: today,
      category: 'agency-arbitrage',
      scope: 'brand',
      channels: ['instagram', 'facebook', 'tiktok'],
      title: '32 stores across the network independently adopted vertical-video-first Meta creative — and they\'re outperforming the rest 2.5x. Roll the playbook out',
      summary: 'STRATIS scanned every store\'s creative composition and noticed an unintended pattern: 32 stores (3.6% of the network) — spread across all six store groups, with no coordinated direction — independently shifted to a 60%+ vertical-video creative mix in Q1. Their ThruPlay rate is 41.2% vs. network average 16.8%, and they generate +84% qualified site sessions. This is a network-wide best practice waiting to be discovered. The CMO can codify it tomorrow.',
      evidence: [
        'Pioneer cohort: 32 stores identified by STRATIS clustering — none knew the others were doing it',
        'Geographic spread: 11 GTA, 7 Grocery Gateway, 6 Fresh Market, 5 Bakery & Café, 2 Centre-Store, 1 Catering',
        'Avg vertical-video share: 68% (vs. network 22%)',
        'ThruPlay rate: 41.2% (vs. network 16.8% — 2.5x lift)',
        'Qualified site sessions: +84% vs. matched control (similar store size + group)',
        '100% of pioneers also have compliant brand-mark usage — operational excellence correlates',
      ],
      confidence: 0.89,
      impactEstimate: 'Codifying the pioneer playbook as a network template + auto-deploy via the store-marketing portal projects +$4.6M in annual store-attributed sales. Estimated adoption: 60% of network within 2 quarters.',
      recommendedAction: 'Longo\'s central marketing produces a vertical-video template kit modeled on the 32 pioneers\' winning creative. Auto-deploy to all 890 stores via the store-marketing portal with one-click activation. Quarterly Store Council readout shows which stores adopted + their lift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Reverse-engineer pioneer playbook into a template kit', subtitle: 'CENTRAL MARKETING — 4 WEEK TIMELINE', type: 'creative', completed: false },
        { id: 's2', title: 'Auto-deploy via store-marketing portal one-click activation', subtitle: 'TARGET 60% ADOPTION IN 2 QUARTERS', type: 'targeting', completed: false },
        { id: 's3', title: 'Recognize 32 pioneer stores at next Store Council', subtitle: 'BUILDS NETWORK GOODWILL', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-002-flagship-halo',
      enterprise: 'dealership-network',
      createdAt: at(0, '09:30:00'),
      category: 'tier-choreography',
      scope: 'brand',
      channels: ['ctv', 'ooh', 'google-search', 'facebook'],
      title: 'When metro-flagship stores run feature campaigns, satellite stores within 50km gain a 14% organic traffic lift — but the timing is uncoordinated, leaving $3.8M of halo on the table',
      summary: 'STRATIS correlated 18 months of metro-flagship campaign flights with surrounding stores\' organic site traffic and found a clean halo signature: every flagship CTV + OOH campaign creates a +14% organic lift on satellite stores within a 50km radius for ~10 days after the flight. Today the flagships and satellites schedule independently — meaning halos often land when satellites are out of stock on featured items, or satellites peak their own spend when no halo is active. Coordinated calendar = recovered $3.8M in network value.',
      evidence: [
        'Metro-flagship stores: 53 (6% of network) — verified by store-type classification',
        'Halo radius: 50km — measured via geo-attribution lift on satellite organic traffic',
        'Organic traffic lift on satellites within radius: +14% over 10-day window (n=47 flights)',
        'Flagship campaign frequency: ~3x/year per flagship, ad-hoc timing',
        'Misalignment cost: 38% of flights land while ≥3 satellites are out of stock on featured items',
        'Coordinated-calendar value recovery: $3.8M projected',
      ],
      confidence: 0.84,
      impactEstimate: 'Synchronizing flagship flights with satellite stock readiness + store-budget surge windows recovers $3.8M in halo lift annually, with no incremental media spend.',
      recommendedAction: 'Build a Flagship Halo Calendar in STRATIS that visualizes flagship flight windows + satellite stock readiness in one view. Central marketing orchestrates flagship timing 30 days ahead. Satellite stores receive auto-alerts to surge their local Search during halo windows.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Stand up Flagship Halo Calendar', subtitle: 'STRATIS — STOCK × FLIGHT VIEW', type: 'scheduling', completed: false },
        { id: 's2', title: 'Central marketing schedules flagships 30 days ahead', subtitle: 'POLICY CHANGE', type: 'scheduling', completed: false },
        { id: 's3', title: 'Auto-alert satellite stores of halo windows', subtitle: 'STORE PORTAL NOTIFICATION', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-dn-003-top-performer-decoded',
      enterprise: 'dealership-network',
      createdAt: at(1, '08:45:00'),
      category: 'agency-arbitrage',
      scope: 'brand',
      channels: ['google-search', 'facebook'],
      title: 'STRATIS analyzed the top 89 performing stores and decoded 3 invisible commonalities. None were intentionally coordinated. This is the network playbook',
      summary: 'The CMO has been asking "what makes our best stores our best stores?" STRATIS clustered the top 10% (89 stores) on ROAS efficiency and found three commonalities they all share independently: (1) an accurate, fresh flyer/product feed, (2) a vertical-video creative share at or above 60%, and (3) a Scene+ email cadence of exactly 4 weeks. None of these stores know about each other\'s approach. Codifying these 3 levers as the official network playbook is the single highest-leverage strategic move available.',
      evidence: [
        'Top 89 stores (10%): 2.1x ROAS efficiency vs. network — but no two operate identically in other respects',
        'Common signal #1: flyer/product feed health (94% vs. network 51%)',
        'Common signal #2: vertical-video share ≥60% of mix (network avg 43%)',
        'Common signal #3: Scene+ email cadence at 4-week intervals (network varies 1–12 weeks)',
        'These three signals were not part of any documented playbook — pure independent emergence',
        'Lift potential if bottom-quartile stores adopt: 28% ROAS improvement = $5.2M aggregate annual gain',
      ],
      confidence: 0.86,
      impactEstimate: 'Codifying the 3 levers as the official network playbook + supporting bottom-quartile stores on adoption projects $5.2M in annual ROAS efficiency gain across the network.',
      recommendedAction: 'Publish the "Network Playbook" as a one-page benchmark. Build a STRATIS scorecard for each store showing their current vs. target on the 3 levers. Prioritize bottom-quartile stores for white-glove onboarding to the playbook.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Publish the Network Playbook', subtitle: '3 LEVERS, ONE PAGE', type: 'creative', completed: false },
        { id: 's2', title: 'Build per-store Playbook Scorecard in STRATIS', subtitle: 'STORE PORTAL', type: 'targeting', completed: false },
        { id: 's3', title: 'White-glove onboarding for bottom-quartile stores', subtitle: 'FIELD TEAM PRIORITY', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-004-service-sales-bridge',
      enterprise: 'dealership-network',
      createdAt: at(2, '11:00:00'),
      category: 'portfolio-dynamics',
      scope: 'brand',
      channels: ['facebook', 'google-search'],
      title: '18 stores run an "In-Store Today, Online Tomorrow" cross-sell motion that converts fresh-market shoppers into Grocery Gateway online customers at 3.4x the network rate — replicate it and unlock $58M in 5-year LTV',
      summary: 'The single most underused asset in the store network is the in-store fresh-shopper database. 18 stores (across the GTA, Fresh Market and Prepared Foods groups) figured out independently that emailing frequent in-store shoppers a Grocery Gateway "first online order" offer converts them into online basket customers at 11.2% — vs. the network rate of 3.3%. Replicating this single motion across all 890 stores projects 14,000 incremental first online orders a year and 5,200 incremental retained online households — $58M in 5-year LTV.',
      evidence: [
        '18 stores identified running this motion (no coordination, no documented strategy)',
        'Trigger: Grocery Gateway online-trial offer email (auto-generated from loyalty / basket data)',
        'First-online-order conversion rate: 11.2% (vs. 3.3% network)',
        'Retained-online-household conversion from first order: 37%',
        'Avg in-store-only shopper LTV: $4,200 over 5 years',
        'Avg incremental online-household value: $44K over 5 years',
        'Network-wide projection if replicated: +14,000 first online orders, +5,200 retained households, $58M 5-yr LTV',
      ],
      confidence: 0.85,
      impactEstimate: 'Standardizing the "In-Store Today, Online Tomorrow" cross-sell motion across all 890 stores projects $58M in 5-year LTV from in-store-to-online conversion alone.',
      recommendedAction: 'Build the cross-sell trigger into the standard loyalty/CRM integration. Auto-deploy the email template (central marketing produces) to all stores as opt-out (vs. opt-in) so adoption is automatic. Recognize the 18 originating stores in the next Store Council.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Build cross-sell trigger into loyalty/CRM integration', subtitle: 'AUTO-FIRES ON FREQUENT IN-STORE SHOPPERS', type: 'targeting', completed: false },
        { id: 's2', title: 'Central marketing produces standardized online-trial template', subtitle: 'LOCALIZED PER STORE GROUP', type: 'creative', completed: false },
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
      title: '23 stores along the QEW corridor share an identical shopper profile (47% cross-shop Costco) — yet each runs uncoordinated creative. Coordinated conquest = +$2.4M',
      summary: 'STRATIS clustered shopper-journey data across all 890 stores and surfaced a hidden pattern: the 23 Longo\'s stores along the Lake Ontario / QEW corridor (Niagara Falls → Burlington → Oakville → Toronto → Whitby → Oshawa) share an identical shopper profile — 47% cross-shop Costco for their stock-up trip vs. the network average of 18%. They\'re fighting the same battle independently. A coordinated comparative-value push specific to this corridor — speaking directly to the Costco stock-up shopper — would lift conquest share dramatically.',
      evidence: [
        'QEW corridor cluster: 23 Longo\'s stores identified via shopper-journey clustering',
        'Cross-shop Costco: 47% (vs. network 18%)',
        'Cross-shop anything else: under 12%',
        'Currently 0 coordinated creative — each runs generic fresh-market ads',
        'Estimated lift from coordinated Costco-comparative creative: +19% conquest share',
        'Aggregate value: $2.4M / year additional Fresh Market + Prepared Foods conquest sales',
      ],
      confidence: 0.81,
      impactEstimate: 'A QEW Corridor Pack of comparative creative (fresh-quality vs. bulk, prepared-foods convenience vs. stock-up) deployed exclusively to these 23 stores projects +$2.4M in annual conquest sales.',
      recommendedAction: 'Central marketing + national AOR jointly produce a "QEW Corridor Pack" — Costco-comparative creative localized to each city in the corridor. Auto-deploy via store portal to the 23 stores. Quarterly readout on conquest-share lift.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Produce QEW Corridor Pack (Costco-comparative)', subtitle: 'CENTRAL MARKETING + AOR — 6 WK', type: 'creative', completed: false },
        { id: 's2', title: 'Auto-deploy to the 23 corridor stores', subtitle: 'STORE PORTAL', type: 'targeting', completed: false },
        { id: 's3', title: 'Apply same clustering analysis to other regions', subtitle: 'OTTAWA/GTA-NORTH CORRIDOR NEXT', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-006-coop-stranded',
      enterprise: 'dealership-network',
      createdAt: at(3, '10:00:00'),
      category: 'macro-convergence',
      scope: 'brand',
      channels: ['google-search', 'facebook', 'instagram'],
      title: '142 stores used less than 50% of their Q1 local-marketing fund because the claim process requires 8 manual steps. Auto-claim unlocks $4.8M in stranded marketing investment',
      summary: 'Corporate has been allocating local-marketing funds in good faith — but STRATIS pulled the actual claim data and found that 142 stores (16% of network) claimed less than 50% of their available Q1 fund. Field interviews surfaced the cause: the claim workflow requires 8 manual steps including paper invoice submission. The unused fund is real money that disappears every quarter. Auto-claiming via STRATIS direct-API integration to stores\' Google Ads + Meta accounts unlocks $4.8M of stranded investment annually with zero incremental budget.',
      evidence: [
        'Q1 local-marketing fund avg per store: $14K',
        'Q1 actual claim rate per store avg: 67% (network)',
        'Stores claiming <50%: 142 of 890 (16%)',
        'Top reason for under-claim (per store survey): "claim workflow takes too long"',
        'Auto-claim adoption willingness: 84% per pre-survey of affected stores',
        'Stranded Q1 fund: $4.8M aggregated',
        'Projected if auto-claimed: +18,000 incremental store-attributed trips',
      ],
      confidence: 0.87,
      impactEstimate: 'STRATIS auto-claim integration unlocks $4.8M in stranded local-marketing funds annually and converts them to +18,000 store-attributed trips with no incremental budget.',
      recommendedAction: 'Build STRATIS auto-claim direct integration with Google Ads + Meta Ads Manager. Fund claim becomes opt-out rather than opt-in. Field roll-out targeting the 142 high-stranded stores first; expand to network within 90 days.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Build STRATIS auto-claim API integration', subtitle: 'GOOGLE ADS + META', type: 'targeting', completed: false },
        { id: 's2', title: 'Convert fund claim to opt-out', subtitle: 'POLICY CHANGE', type: 'targeting', completed: false },
        { id: 's3', title: 'Field-priority outreach to 142 high-stranded stores', subtitle: 'WHITE-GLOVE ONBOARDING', type: 'targeting', completed: false },
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
      title: '4,200 weekly Toronto-DMA Search auctions have multiple Longo\'s stores bidding against each other — Longo\'s pays both sides, $4.4M annual self-tax',
      summary: 'STRATIS reconstructed Google Ads auction logs across the 47 Longo\'s stores in the Toronto DMA and found that 4,200 weekly auctions have ≥2 store accounts bidding on the same brand-term keyword (e.g. "Longo\'s near me", "Grocery Gateway delivery") simultaneously. The CPC inflates by an average $2.10 per auction from the intra-network competition. Aggregate self-tax: $4.4M / year in Toronto alone. Same pattern detected in adjacent GTA DMAs — total $11.8M / yr across the network.',
      evidence: [
        'Toronto DMA Longo\'s stores: 47',
        'Multi-store auctions/week (intra-network): 4,200',
        'Average CPC inflation when multiple stores bid: +$2.10',
        'Annual auction self-tax in Toronto DMA alone: $4.4M',
        'Network pattern across adjacent GTA DMAs: 1,800/wk, 2,100/wk, 1,400/wk',
        'Aggregate network self-tax: $11.8M / year',
      ],
      confidence: 0.88,
      impactEstimate: 'A coordinated DMA-level negative-keyword + geo-fence map (each store owns a slice of brand-term auctions in its primary trade area) recovers $11.8M across the network per year.',
      recommendedAction: 'Roll out STRATIS-managed DMA territory assignments. Each store\'s Google Ads account inherits a negative-keyword + geo-fence template. Store Council approves territories before rollout to maintain store trust.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Generate Toronto DMA territory assignments', subtitle: '47 STORES, BRAND-TERM SLICING', type: 'targeting', completed: false },
        { id: 's2', title: 'Present territory map to Store Council', subtitle: 'JUNE COUNCIL MEETING', type: 'targeting', completed: false },
        { id: 's3', title: 'Phased rollout to adjacent GTA DMAs', subtitle: 'Q3 ROLLOUT PLAN', type: 'scheduling', completed: false },
      ],
    },
    {
      id: 'ins-dn-008-cottage-seasonality',
      enterprise: 'dealership-network',
      createdAt: at(4, '12:30:00'),
      category: 'launch-calendar',
      scope: 'brand',
      channels: ['facebook', 'instagram', 'google-search'],
      title: '27 stores in cottage / lake regions have inverted seasonal demand — they peak in summer, not in the spring/holiday calendar. Network calendar misalignment costs $1.8M / year',
      summary: 'STRATIS noticed an unusual signal: 27 stores in cottage and lake regions (Muskoka, Kawarthas, Georgian Bay, Prince Edward County) have inverted seasonality — their demand peaks in May–September as cottagers stock up, NOT in the national spring/holiday pattern. They get the same marketing calendar as the rest of the network, meaning they\'re running heavy media when their shoppers aren\'t around, and dim media in July when cottagers are flooding the aisles. Hidden cohort, fixable with one calendar split.',
      evidence: [
        '27 stores identified across Muskoka, Kawarthas, Georgian Bay, Prince Edward County',
        'Q2-Q3 (summer) demand: 1.6x Q4-Q1 (winter)',
        'Network norm: spring/holiday peak',
        'Currently their local-marketing spend follows network norm — peaks in spring',
        'Misalignment: heavy spend during low-demand months, dim spend during peak demand',
        'Annual loss: $1.8M (modeled from cost-per-trip × misallocated impressions)',
      ],
      confidence: 0.83,
      impactEstimate: 'Splitting the marketing calendar for the 27 cottage-region stores (May-Sept heavy, Nov-Feb dim) recovers $1.8M annually in better-timed trip acquisition.',
      recommendedAction: 'Define a "Cottage Country Calendar" as a second marketing-calendar variant. Auto-assign the 27 affected stores based on geographic clustering. Quarterly readout on lift. Also flag any future stores that match the geographic signature.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Define Cottage Country marketing calendar', subtitle: 'MAY-SEPT HEAVY, NOV-FEB DIM', type: 'scheduling', completed: false },
        { id: 's2', title: 'Auto-assign 27 cottage-region stores', subtitle: 'GEOGRAPHIC CLUSTERING', type: 'targeting', completed: false },
        { id: 's3', title: 'Codify geo-flagging for future store onboarding', subtitle: 'STRATIS AUTO-DETECT', type: 'targeting', completed: false },
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
      title: '64 Québec stores at OQLF compliance risk by Dec 31 — coordinated central-marketing template saves $768K vs. store-by-store scramble',
      summary: 'OQLF\'s updated digital-advertising compliance requires French-first creative by December 31, 2026. STRATIS audited Québec store creative inventory and identified 64 stores (42% of the QC network) running English-first or bilingual-with-English-prominence creative. Without coordination each will face a Q4 production scramble at $18K/store; with a central-marketing-led template + customization system the cost drops to $6K/store. Same compliance outcome, $768K saved network-wide.',
      evidence: [
        'OQLF compliance deadline: December 31, 2026',
        'Québec stores at risk: 64 of 152 (42%)',
        'Average store-level creative production cost (independent): $18K',
        'Coordinated central production cost (template + customization): $6K/store',
        'Total savings via coordinated approach: $768K',
        'Network compliance risk after coordinated rollout: effectively zero',
      ],
      confidence: 0.84,
      impactEstimate: 'Coordinated central French creative production saves $768K vs. independent store-by-store scrambles, and reduces network compliance risk to effectively zero.',
      recommendedAction: 'Central marketing builds a template + customization French-creative system. Québec stores opt in for $6K/year subscription replacing $18K independent cost. Rollout begins September; full network compliant by November 30.',
      status: 'new',
      linkedNewsId: 'news-dn-quebec-french-creative-mandate',
      actionSteps: [
        { id: 's1', title: 'Central marketing builds template+custom French creative system', subtitle: 'SEPT–NOV TIMELINE', type: 'creative', completed: false },
        { id: 's2', title: 'Field 64-store subscription outreach', subtitle: 'AUG ENROLLMENT', type: 'targeting', completed: false },
      ],
    },
    {
      id: 'ins-dn-010-brand-mark-drift',
      enterprise: 'dealership-network',
      createdAt: at(6, '15:30:00'),
      category: 'agency-arbitrage',
      scope: 'brand',
      channels: ['facebook', 'instagram', 'google-search'],
      title: '142 store creatives across the network are running outdated 2023 Longo\'s brand-mark lockups — invisible to corporate without STRATIS, $1.8M brand-equity dilution',
      summary: 'STRATIS scanned 890 stores\' active creative across Meta + Google in real time and identified 142 ads still using the 2023 Longo\'s brand-mark lockup (replaced February 2025). They\'re running an aggregate 14M monthly impressions — every one of them dilutes brand consistency. The drift is structurally invisible to corporate because stores don\'t flag it and there\'s no automated scanner anywhere in the store-marketing ecosystem. STRATIS just made it visible.',
      evidence: [
        'Outdated brand-mark creatives detected: 142 active across 89 stores',
        'Aggregate monthly impressions: 14M',
        'Concentration: independently-managed store-side creative (not central-approved)',
        'Avg creative age: 18 months (predates 2025 brand refresh)',
        'No existing automated brand-compliance scanner in store ecosystem prior to STRATIS',
      ],
      confidence: 0.84,
      impactEstimate: 'Remediating brand-mark violations within 60 days prevents an estimated $1.8M in brand-equity dilution. STRATIS continuous brand-mark scan prevents recurrence at no incremental cost.',
      recommendedAction: 'Generate per-store remediation notices with replacement creative attached (central marketing provides). Field outreach over 30 days; auto-flag any new creatives that revert. Codify continuous STRATIS brand-mark monitoring as a network service.',
      status: 'new',
      actionSteps: [
        { id: 's1', title: 'Generate 142 remediation notices with replacement assets', subtitle: 'CENTRAL-PROVIDED CREATIVE', type: 'creative', completed: false },
        { id: 's2', title: 'Field 30-day outreach + tracking', subtitle: 'STORE-BY-STORE', type: 'targeting', completed: false },
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
      item.tags.includes('loyalty') ? ['ctv', 'google-search', 'ttd'] :
      item.tags.includes('value') ? ['google-search', 'facebook', 'instagram'] :
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
