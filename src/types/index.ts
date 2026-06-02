// ===== Enterprise (Multi-Tenant Selector) =====
// Top-level enterprise tenants — each is a distinct client an agency services,
// with its own siloed data. The Ford family (auto) plus cross-industry clients.
export type EnterpriseId =
  | 'ford-canada' | 'lincoln' | 'dealership-network'
  | 'rbc' | 'molson-coors' | 'lululemon' | 'tim-hortons';

export type Industry =
  | 'Automotive' | 'Financial Services' | 'CPG / Beverage' | 'Retail / Fashion' | 'QSR / Restaurant';

export interface EnterpriseConfig {
  id: EnterpriseId;
  name: string;
  industry: Industry;
  tagline: string;
  description: string;
  productNoun: string;        // what a "product line" is called for this client (Nameplate / Product / Brand / Category)
  accentClass: string;        // Tailwind text/bg class for tile accent
  borderClass: string;        // Tailwind border class for tile
}

export const ENTERPRISES: EnterpriseConfig[] = [
  {
    id: 'ford-canada',
    name: 'Ford Canada',
    industry: 'Automotive',
    tagline: 'National marketing across 8 nameplates',
    description: 'Tier 1 (Mindshare AOR) · Tier 2 (Cossette + 4 Regional partners) · Tier 3 (890+ dealers). $124M annual marketing investment.',
    productNoun: 'Nameplate',
    accentClass: 'text-blue-400',
    borderClass: 'border-blue-500/30 hover:border-blue-500/60',
  },
  {
    id: 'lincoln',
    name: 'Lincoln',
    industry: 'Automotive',
    tagline: 'Luxury division — 4 nameplates',
    description: 'Aviator · Nautilus · Corsair · Navigator. Premium-segment AOR (Hudson Rouge) + Cossette regional support. $34M annual marketing investment.',
    productNoun: 'Nameplate',
    accentClass: 'text-amber-400',
    borderClass: 'border-amber-500/30 hover:border-amber-500/60',
  },
  {
    id: 'dealership-network',
    name: 'Dealership Network',
    industry: 'Automotive',
    tagline: 'Aggregate co-op view across 890+ dealers',
    description: 'Dealer-led marketing rolled up to corporate visibility. Brand-mark compliance, intra-DMA auction collisions, regional co-op program performance. $42M aggregated annual spend.',
    productNoun: 'Region',
    accentClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30 hover:border-emerald-500/60',
  },
  {
    id: 'rbc',
    name: 'RBC',
    industry: 'Financial Services',
    tagline: 'National retail bank — 6 product lines',
    description: 'Everyday Banking · Mortgages · Avion Rewards · Wealth · Newcomers · Small Business. Tier 1 (BBDO Toronto) · Tier 2 (Initiative media) · Tier 3 (1,200+ branches). $180M annual marketing investment.',
    productNoun: 'Product',
    accentClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30 hover:border-indigo-500/60',
  },
  {
    id: 'molson-coors',
    name: 'Molson Coors',
    industry: 'CPG / Beverage',
    tagline: 'Beverage portfolio — 6 brands',
    description: 'Coors Light · Molson Canadian · Miller Lite · Blue Moon · Coors Banquet · Vizzy. Tier 1 (Rethink AOR) · Tier 2 (MediaCom) · Tier 3 (Field & on-premise). $96M annual marketing investment.',
    productNoun: 'Brand',
    accentClass: 'text-orange-400',
    borderClass: 'border-orange-500/30 hover:border-orange-500/60',
  },
  {
    id: 'lululemon',
    name: 'lululemon',
    industry: 'Retail / Fashion',
    tagline: 'Technical apparel — 6 categories',
    description: "Women's · Men's · Align · Footwear · Bags & Accessories · Membership. Tier 1 (In-House Brand Studio) · Tier 2 (Performance media) · Tier 3 (Community & retail). $72M annual marketing investment.",
    productNoun: 'Category',
    accentClass: 'text-pink-400',
    borderClass: 'border-pink-500/30 hover:border-pink-500/60',
  },
  {
    id: 'tim-hortons',
    name: 'Tim Hortons',
    industry: 'QSR / Restaurant',
    tagline: 'National QSR — 6 product lines',
    description: 'Hot Beverages · Cold Beverages · Breakfast · Baked Goods · Lunch · Tims Rewards. Tier 1 (Zulu Alpha Kilo AOR) · Tier 2 (Touché! media) · Tier 3 (Local store marketing, 3,500+ restaurants). $110M annual marketing investment.',
    productNoun: 'Product',
    accentClass: 'text-red-400',
    borderClass: 'border-red-500/30 hover:border-red-500/60',
  },
];

// ===== Enterprise Hierarchy =====
// Type names retained from prior brand to minimize refactor churn.
// DivisionId is semantically "Tier" in Ford ontology.
// ProductLineId is semantically "Nameplate".

// --- Tiers (typed as DivisionId) ---
export type DivisionId = 'tier-1' | 'tier-2' | 'tier-3';

export const DIVISION_LABELS: Record<DivisionId, string> = {
  'tier-1': 'Tier 1 — National',
  'tier-2': 'Tier 2 — Regional',
  'tier-3': 'Tier 3 — Dealer Network',
};

// Per-client overrides for the generic tier structure. Tier 3 in particular is
// industry-specific (Dealer Network for auto, Branch/Local for a bank, etc.).
export const ENTERPRISE_DIVISION_LABELS: Partial<Record<EnterpriseId, Record<DivisionId, string>>> = {
  'rbc': {
    'tier-1': 'Tier 1 — National Brand',
    'tier-2': 'Tier 2 — Regional',
    'tier-3': 'Tier 3 — Branch & Local',
  },
  'molson-coors': {
    'tier-1': 'Tier 1 — National Brand',
    'tier-2': 'Tier 2 — Regional',
    'tier-3': 'Tier 3 — Field & On-Premise',
  },
  'lululemon': {
    'tier-1': 'Tier 1 — Brand',
    'tier-2': 'Tier 2 — Performance',
    'tier-3': 'Tier 3 — Community & Retail',
  },
  'tim-hortons': {
    'tier-1': 'Tier 1 — National Brand',
    'tier-2': 'Tier 2 — Regional',
    'tier-3': 'Tier 3 — Local Store Marketing',
  },
};

/** Division label resolved for a given client, falling back to the generic tier label. */
export function divisionLabel(division: DivisionId, enterprise?: EnterpriseId | null): string {
  if (enterprise) {
    const overrides = ENTERPRISE_DIVISION_LABELS[enterprise];
    if (overrides) return overrides[division];
  }
  return DIVISION_LABELS[division];
}

// --- Agency Partners ---
export type AgencyId =
  | 'mindshare'
  | 'cossette'
  | 'bc-regional'
  | 'ontario-regional'
  | 'alberta-regional'
  | 'atlantic-regional'
  | 'dealer-network'
  | 'hudson-rouge'           // Lincoln luxury AOR
  | 'cossette-luxury'        // Cossette Lincoln-dedicated team
  // RBC roster
  | 'rbc-bbdo' | 'rbc-initiative' | 'rbc-branch'
  // Molson Coors roster
  | 'mc-rethink' | 'mc-mediacom' | 'mc-field'
  // lululemon roster
  | 'lulu-inhouse' | 'lulu-performance' | 'lulu-community'
  // Tim Hortons roster
  | 'th-zulu' | 'th-touche' | 'th-local';

export const AGENCY_LABELS: Record<AgencyId, string> = {
  'mindshare': 'Mindshare / Initiative AOR',
  'cossette': 'Cossette',
  'bc-regional': 'BC Regional',
  'ontario-regional': 'Ontario Regional',
  'alberta-regional': 'Alberta Regional',
  'atlantic-regional': 'Atlantic Regional',
  'dealer-network': 'Dealer Network',
  'hudson-rouge': 'Hudson Rouge (Lincoln AOR)',
  'cossette-luxury': 'Cossette Luxury',
  // RBC
  'rbc-bbdo': 'BBDO Toronto',
  'rbc-initiative': 'Initiative (Media)',
  'rbc-branch': 'Branch & Local',
  // Molson Coors
  'mc-rethink': 'Rethink',
  'mc-mediacom': 'MediaCom',
  'mc-field': 'Field & On-Premise',
  // lululemon
  'lulu-inhouse': 'In-House Brand Studio',
  'lulu-performance': 'Performance Media',
  'lulu-community': 'Community & Retail',
  // Tim Hortons
  'th-zulu': 'Zulu Alpha Kilo',
  'th-touche': 'Touché!',
  'th-local': 'Local Store Marketing',
};

// Tier mapping — used by molecular bonds and benchmarking widget
export const AGENCY_TO_TIER: Record<AgencyId, DivisionId> = {
  'mindshare': 'tier-1',
  'cossette': 'tier-2',
  'bc-regional': 'tier-2',
  'ontario-regional': 'tier-2',
  'alberta-regional': 'tier-2',
  'atlantic-regional': 'tier-2',
  'dealer-network': 'tier-3',
  'hudson-rouge': 'tier-1',
  'cossette-luxury': 'tier-2',
  // RBC
  'rbc-bbdo': 'tier-1',
  'rbc-initiative': 'tier-2',
  'rbc-branch': 'tier-3',
  // Molson Coors
  'mc-rethink': 'tier-1',
  'mc-mediacom': 'tier-2',
  'mc-field': 'tier-3',
  // lululemon
  'lulu-inhouse': 'tier-1',
  'lulu-performance': 'tier-2',
  'lulu-community': 'tier-3',
  // Tim Hortons
  'th-zulu': 'tier-1',
  'th-touche': 'tier-2',
  'th-local': 'tier-3',
};

// --- Nameplates (typed as ProductLineId) ---
export type ProductLineId =
  // Ford Canada nameplates
  | 'f150' | 'lightning' | 'bronco' | 'explorer'
  | 'mach-e' | 'escape-phev' | 'transit' | 'edge'
  // Lincoln nameplates
  | 'lincoln-aviator' | 'lincoln-nautilus' | 'lincoln-corsair' | 'lincoln-navigator'
  // Dealership Network — regional aggregate "rollup" pseudo-nameplates
  | 'dn-bc-rollup' | 'dn-ontario-rollup' | 'dn-quebec-rollup'
  | 'dn-alberta-rollup' | 'dn-atlantic-rollup' | 'dn-prairies-rollup'
  // RBC product lines
  | 'rbc-chequing' | 'rbc-mortgages' | 'rbc-avion' | 'rbc-wealth' | 'rbc-newcomers' | 'rbc-business'
  // Molson Coors brands
  | 'mc-coors-light' | 'mc-molson-canadian' | 'mc-miller-lite' | 'mc-blue-moon' | 'mc-coors-banquet' | 'mc-vizzy'
  // lululemon categories
  | 'lulu-womens' | 'lulu-mens' | 'lulu-align' | 'lulu-footwear' | 'lulu-accessories' | 'lulu-membership'
  // Tim Hortons product lines
  | 'th-hot-bev' | 'th-cold-bev' | 'th-breakfast' | 'th-baked' | 'th-lunch' | 'th-rewards';

export const PRODUCT_LINE_LABELS: Record<ProductLineId, string> = {
  'f150': 'F-150',
  'lightning': 'F-150 Lightning',
  'bronco': 'Bronco',
  'explorer': 'Explorer',
  'mach-e': 'Mustang Mach-E',
  'escape-phev': 'Escape PHEV',
  'transit': 'Transit',
  'edge': 'Edge',
  'lincoln-aviator': 'Lincoln Aviator',
  'lincoln-nautilus': 'Lincoln Nautilus',
  'lincoln-corsair': 'Lincoln Corsair',
  'lincoln-navigator': 'Lincoln Navigator',
  'dn-bc-rollup': 'BC Dealer Rollup',
  'dn-ontario-rollup': 'Ontario Dealer Rollup',
  'dn-quebec-rollup': 'Quebec Dealer Rollup',
  'dn-alberta-rollup': 'Alberta Dealer Rollup',
  'dn-atlantic-rollup': 'Atlantic Dealer Rollup',
  'dn-prairies-rollup': 'Prairies Dealer Rollup',
  // RBC
  'rbc-chequing': 'Everyday Banking',
  'rbc-mortgages': 'Mortgages',
  'rbc-avion': 'Avion Rewards',
  'rbc-wealth': 'Wealth & Investments',
  'rbc-newcomers': 'Newcomers to Canada',
  'rbc-business': 'Small Business',
  // Molson Coors
  'mc-coors-light': 'Coors Light',
  'mc-molson-canadian': 'Molson Canadian',
  'mc-miller-lite': 'Miller Lite',
  'mc-blue-moon': 'Blue Moon',
  'mc-coors-banquet': 'Coors Banquet',
  'mc-vizzy': 'Vizzy Hard Seltzer',
  // lululemon
  'lulu-womens': "Women's",
  'lulu-mens': "Men's",
  'lulu-align': 'Align',
  'lulu-footwear': 'Footwear',
  'lulu-accessories': 'Bags & Accessories',
  'lulu-membership': 'lululemon Membership',
  // Tim Hortons
  'th-hot-bev': 'Hot Beverages',
  'th-cold-bev': 'Cold Beverages',
  'th-breakfast': 'Breakfast',
  'th-baked': 'Baked Goods',
  'th-lunch': 'Lunch',
  'th-rewards': 'Tims Rewards',
};

export interface ProductLine {
  id: ProductLineId;
  label: string;
  division: DivisionId;
  agencies: AgencyId[];
}

// --- Audience Segments ---
export type AudienceId =
  // Ford / shared
  | 'truck-intenders' | 'ev-considerers' | 'phev-shoppers'
  | 'fleet-commercial' | 'adventure-lifestyle' | 'family-suv-shoppers'
  | 'conquest-tesla' | 'conquest-gm' | 'conquest-toyota' | 'conquest-hyundai-kia'
  // Lincoln luxury
  | 'luxury-intenders' | 'conquest-bmw' | 'conquest-mercedes'
  | 'conquest-audi' | 'conquest-lexus' | 'lincoln-loyalists'
  // Dealership Network — local-shopper buckets
  | 'local-shoppers' | 'service-loyalists' | 'finance-deal-seekers'
  // RBC
  | 'rbc-newcomers-aud' | 'rbc-first-home' | 'rbc-students' | 'rbc-mass-affluent' | 'rbc-small-biz' | 'rbc-switchers'
  // Molson Coors
  | 'mc-lda-young' | 'mc-sports-fans' | 'mc-value-mainstream' | 'mc-craft-curious' | 'mc-seltzer-flavor' | 'mc-light-loyalists'
  // lululemon
  | 'lulu-yogis' | 'lulu-runners' | 'lulu-mens-perf' | 'lulu-everyday' | 'lulu-genz' | 'lulu-members' | 'lulu-lapsed'
  // Tim Hortons
  | 'th-daily-regulars' | 'th-commuters' | 'th-families' | 'th-value-seekers' | 'th-cold-younger' | 'th-app-members' | 'th-lapsed';

export const AUDIENCE_LABELS: Record<AudienceId, string> = {
  'truck-intenders': 'Truck Intenders',
  'ev-considerers': 'EV Considerers',
  'phev-shoppers': 'PHEV Shoppers',
  'fleet-commercial': 'Fleet & Commercial',
  'adventure-lifestyle': 'Adventure Lifestyle',
  'family-suv-shoppers': 'Family SUV Cross-Shoppers',
  'conquest-tesla': 'Conquest — Tesla',
  'conquest-gm': 'Conquest — GM',
  'conquest-toyota': 'Conquest — Toyota',
  'conquest-hyundai-kia': 'Conquest — Hyundai/Kia',
  'luxury-intenders': 'Luxury Intenders',
  'conquest-bmw': 'Conquest — BMW',
  'conquest-mercedes': 'Conquest — Mercedes-Benz',
  'conquest-audi': 'Conquest — Audi',
  'conquest-lexus': 'Conquest — Lexus',
  'lincoln-loyalists': 'Lincoln Loyalists',
  'local-shoppers': 'Local In-Market Shoppers',
  'service-loyalists': 'Service Loyalists',
  'finance-deal-seekers': 'Finance & Deal Seekers',
  // RBC
  'rbc-newcomers-aud': 'Newcomers to Canada',
  'rbc-first-home': 'First-Time Homebuyers',
  'rbc-students': 'Students & Youth',
  'rbc-mass-affluent': 'Mass Affluent',
  'rbc-small-biz': 'Small Business Owners',
  'rbc-switchers': 'Switchers (Conquest)',
  // Molson Coors
  'mc-lda-young': 'LDA 21–34',
  'mc-sports-fans': 'Sports Fans (NHL)',
  'mc-value-mainstream': 'Value / Mainstream',
  'mc-craft-curious': 'Craft-Curious',
  'mc-seltzer-flavor': 'Flavor & Seltzer Seekers',
  'mc-light-loyalists': 'Light-Beer Loyalists',
  // lululemon
  'lulu-yogis': 'Yoga & Studio',
  'lulu-runners': 'Runners',
  'lulu-mens-perf': "Men's Performance",
  'lulu-everyday': 'Everyday Athleisure',
  'lulu-genz': 'Gen-Z Entrants',
  'lulu-members': 'Members / Loyalists',
  'lulu-lapsed': 'Lapsed Purchasers',
  // Tim Hortons
  'th-daily-regulars': 'Daily Regulars',
  'th-commuters': 'Morning Commuters',
  'th-families': 'Families',
  'th-value-seekers': 'Value Seekers',
  'th-cold-younger': 'Younger / Cold-Bev',
  'th-app-members': 'App / Rewards Members',
  'th-lapsed': 'Lapsed Visitors',
};

// --- Geographic Regions (Canadian provinces, plus National rollup) ---
export type GeoId = 'national' | 'bc' | 'alberta' | 'ontario' | 'quebec' | 'atlantic';

export const GEO_LABELS: Record<GeoId, string> = {
  'national': 'National',
  'bc': 'British Columbia',
  'alberta': 'Alberta',
  'ontario': 'Ontario',
  'quebec': 'Quebec',
  'atlantic': 'Atlantic',
};

/** @deprecated Use GeoId. Kept for backward compatibility during migration. */
export type RegionId = GeoId;
/** @deprecated Use GEO_LABELS. Kept for backward compatibility during migration. */
export const REGION_LABELS = GEO_LABELS;

// ===== Channels =====
export type ChannelId = 'instagram' | 'facebook' | 'tiktok' | 'google-search' | 'ttd' | 'ctv' | 'spotify' | 'linkedin' | 'ooh';

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  'instagram': 'Instagram',
  'facebook': 'Facebook',
  'tiktok': 'TikTok',
  'google-search': 'Google Search',
  'ttd': 'The Trade Desk',
  'ctv': 'CTV',
  'spotify': 'Spotify',
  'linkedin': 'LinkedIn',
  'ooh': 'Out-of-Home',
};

export const CHANNEL_COLORS: Record<ChannelId, string> = {
  'instagram': '#E1306C',
  'facebook': '#1877F2',
  'tiktok': '#00F2EA',
  'google-search': '#FBBC05',
  'ttd': '#22C55E',
  'ctv': '#A855F7',
  'spotify': '#1DB954',
  'linkedin': '#0A66C2',
  'ooh': '#F97316',
};

// ===== Campaigns =====
export type CampaignObjective = 'awareness' | 'consideration' | 'conversion' | 'retention';
export type CampaignStatus = 'live' | 'paused' | 'completed' | 'scheduled';

export interface Campaign {
  id: string;
  name: string;
  enterprise: EnterpriseId;
  division: DivisionId;
  agency: AgencyId;
  productLine: ProductLineId;
  audiences: AudienceId[];
  objective: CampaignObjective;
  status: CampaignStatus;
  channels: ChannelId[];
  geos: GeoId[];
  startDate: string;
  endDate?: string;
  plannedBudget: number;
}

// ===== Campaign Draft (briefing input) =====
export type PacingPreference = 'even' | 'front-loaded' | 'back-loaded';
export type ConfidenceLevel = 'low' | 'medium' | 'high';

export interface BriefFileMeta {
  name: string;
  size: number;
  type: string;
}

export interface DraftCampaign {
  name: string;
  division: DivisionId | '';
  productLine: ProductLineId | '';
  agency: AgencyId | '';
  briefNarrative: string;
  briefFile: BriefFileMeta | null;
  successCriteria: string;
  objective: CampaignObjective | '';
  secondaryObjectives: CampaignObjective[];
  funnelStage: FunnelStage;
  attributionModel: AttributionModel | '';
  kpiTargets: Partial<Record<KPIKey, string>>;
  priorityKpis: KPIKey[];
  benchmarkContext: string;
  confidenceLevel: ConfidenceLevel;
  definitionOfWin: string;
  audiences: AudienceId[];
  geos: GeoId[];
  startDate: string;
  endDate: string;
  plannedBudget: string;
  pacing: PacingPreference;
  channels: ChannelId[];
  channelBudgetSplits: Partial<Record<ChannelId, number>>;
}

// ===== KPI Data =====
export interface DailyMetrics {
  date: string; // YYYY-MM-DD
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  landingPageViews: number;
  leads: number;
  conversions: number;
  revenue: number;
  videoViews3s: number;
  videoViewsThruplay: number;
  engagements: number;
  assistedConversions: number;
}

export interface AggregatedKPIs extends DailyMetrics {
  // Derived
  frequency: number;
  ctr: number;
  cpc: number;
  cpm: number;
  lpvRate: number;
  cpl: number;
  cpa: number;
  roas: number;
  videoCompletionRate: number;
  threeSecondViewRate: number;
  engagementRate: number;
  brandSearchLift: number;
  shareOfVoice: number;
  // Health
  volatilityScore: number;
  anomalyCount: number;
  budgetPacing: number;
  creativeFatigueIndex: number;
}

export interface KPIDelta {
  value: number;
  previousValue: number;
  delta: number;
  deltaPercent: number;
}

export type KPIKey = keyof AggregatedKPIs;

export interface KPIConfig {
  key: KPIKey;
  label: string;
  format: 'currency' | 'number' | 'percent' | 'decimal' | 'index';
  higherIsBetter: boolean;
  category: 'spend' | 'reach' | 'engagement' | 'conversion' | 'revenue' | 'video' | 'health';
}

export const KPI_CONFIGS: KPIConfig[] = [
  { key: 'spend', label: 'Spend', format: 'currency', higherIsBetter: false, category: 'spend' },
  { key: 'impressions', label: 'Impressions', format: 'number', higherIsBetter: true, category: 'reach' },
  { key: 'reach', label: 'Reach', format: 'number', higherIsBetter: true, category: 'reach' },
  { key: 'frequency', label: 'Frequency', format: 'decimal', higherIsBetter: false, category: 'reach' },
  { key: 'clicks', label: 'Clicks', format: 'number', higherIsBetter: true, category: 'engagement' },
  { key: 'ctr', label: 'CTR', format: 'percent', higherIsBetter: true, category: 'engagement' },
  { key: 'cpc', label: 'CPC', format: 'currency', higherIsBetter: false, category: 'engagement' },
  { key: 'cpm', label: 'CPM', format: 'currency', higherIsBetter: false, category: 'reach' },
  { key: 'landingPageViews', label: 'Landing Page Views', format: 'number', higherIsBetter: true, category: 'engagement' },
  { key: 'lpvRate', label: 'LPV Rate', format: 'percent', higherIsBetter: true, category: 'engagement' },
  { key: 'leads', label: 'Leads', format: 'number', higherIsBetter: true, category: 'conversion' },
  { key: 'cpl', label: 'CPL', format: 'currency', higherIsBetter: false, category: 'conversion' },
  { key: 'conversions', label: 'Conversions', format: 'number', higherIsBetter: true, category: 'conversion' },
  { key: 'cpa', label: 'CPA', format: 'currency', higherIsBetter: false, category: 'conversion' },
  { key: 'revenue', label: 'Revenue', format: 'currency', higherIsBetter: true, category: 'revenue' },
  { key: 'roas', label: 'ROAS', format: 'decimal', higherIsBetter: true, category: 'revenue' },
  { key: 'videoViews3s', label: 'Video Views (3s)', format: 'number', higherIsBetter: true, category: 'video' },
  { key: 'videoViewsThruplay', label: 'ThruPlay Views', format: 'number', higherIsBetter: true, category: 'video' },
  { key: 'videoCompletionRate', label: 'Video Completion Rate', format: 'percent', higherIsBetter: true, category: 'video' },
  { key: 'threeSecondViewRate', label: '3s View Rate', format: 'percent', higherIsBetter: true, category: 'video' },
  { key: 'engagements', label: 'Engagements', format: 'number', higherIsBetter: true, category: 'engagement' },
  { key: 'engagementRate', label: 'Engagement Rate', format: 'percent', higherIsBetter: true, category: 'engagement' },
  { key: 'assistedConversions', label: 'Assisted Conversions', format: 'number', higherIsBetter: true, category: 'conversion' },
  { key: 'brandSearchLift', label: 'Brand Search Lift', format: 'index', higherIsBetter: true, category: 'reach' },
  { key: 'shareOfVoice', label: 'Share of Voice', format: 'percent', higherIsBetter: true, category: 'reach' },
  { key: 'volatilityScore', label: 'Volatility', format: 'decimal', higherIsBetter: false, category: 'health' },
  { key: 'anomalyCount', label: 'Anomalies (7d)', format: 'number', higherIsBetter: false, category: 'health' },
  { key: 'budgetPacing', label: 'Budget Pacing', format: 'percent', higherIsBetter: true, category: 'health' },
  { key: 'creativeFatigueIndex', label: 'Creative Fatigue', format: 'index', higherIsBetter: false, category: 'health' },
];

export const DEFAULT_BRAND_KPIS: KPIKey[] = [
  'spend', 'impressions', 'reach', 'leads', 'cpl', 'conversions', 'cpa',
  'ctr', 'cpc', 'cpm', 'engagementRate', 'budgetPacing'
];

// ===== Funnel Stage =====
export type FunnelStage = 'all' | 'upper' | 'mid' | 'lower' | 'retention';

export const FUNNEL_LABELS: Record<FunnelStage, string> = {
  all: 'All Funnel',
  upper: 'Upper Funnel',
  mid: 'Mid Funnel',
  lower: 'Lower Funnel',
  retention: 'Retention',
};

export const FUNNEL_HERO_KPIS: Record<FunnelStage, KPIKey[]> = {
  all: ['spend', 'cpl', 'leads'],
  upper: ['impressions', 'reach', 'cpm'],
  mid: ['clicks', 'ctr', 'engagementRate'],
  lower: ['leads', 'cpl', 'conversions'],
  retention: ['conversions', 'cpa', 'leads'],
};

export const FUNNEL_CUSTOM_KPIS: Record<FunnelStage, KPIKey[]> = {
  all: DEFAULT_BRAND_KPIS,
  upper: ['spend', 'impressions', 'reach', 'frequency', 'cpm', 'videoViews3s', 'videoViewsThruplay', 'threeSecondViewRate', 'brandSearchLift', 'budgetPacing'],
  mid: ['spend', 'clicks', 'ctr', 'cpc', 'landingPageViews', 'lpvRate', 'engagements', 'engagementRate', 'videoViewsThruplay', 'videoCompletionRate', 'budgetPacing'],
  lower: ['spend', 'conversions', 'cpa', 'revenue', 'roas', 'leads', 'cpl', 'assistedConversions', 'budgetPacing'],
  retention: ['spend', 'conversions', 'cpa', 'revenue', 'roas', 'leads', 'cpl', 'assistedConversions', 'budgetPacing'],
};

export const DEFAULT_EXEC_KPIS: KPIKey[] = [
  'spend', 'reach', 'leads', 'cpl', 'conversions', 'cpa',
  'brandSearchLift', 'shareOfVoice', 'budgetPacing', 'anomalyCount'
];

// ===== Date Range =====
export type DateRangePreset = '1d' | '7d' | '14d' | '30d' | '90d' | 'ytd' | 'custom';

export interface DateRange {
  preset: DateRangePreset;
  start: string;
  end: string;
}

// ===== Attribution =====
export type AttributionModel = 'last-click' | 'first-click' | 'linear' | 'data-driven';

// ===== Role =====
export type UserRole = 'agency' | 'exec';

// ===== View Level =====
export type ViewLevel = 'brand' | 'division' | 'product' | 'campaign';

// ===== News =====
export type NewsTag =
  | 'brand'
  | 'automotive'
  | 'ev'
  | 'launch'
  | 'izev'
  | 'social'
  | 'sports'
  | 'sponsorships'
  | 'partnerships'
  | 'competitors'
  | 'macro';

export type NewsUrgency = 'low' | 'medium' | 'high';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  date: string;
  tags: NewsTag[];
  regions: RegionId[];
  urgency: NewsUrgency;
  summary: string;
  whyItMatters: string;
  competitor?: string;
  enterprises: EnterpriseId[];   // News may be relevant to multiple enterprises
}

// ===== Insights =====
export type InsightCategory =
  | 'market-radar'           // Top news / external events surfaced as CMO-attention cards
  // Ford Canada signal taxonomy
  | 'strategic-opener'       // Portfolio-level brand & halo signals visible only across every agency/nameplate
  | 'national-regional'      // Tier 1 → Tier 2 orchestration: national demand vs regional capture, playbook cascade
  | 'tactical-efficiency'    // Operator-level efficiency & allocation levers (incl. slider-driven channel reallocation)
  | 'creative-performance'   // Per-creative decay, geographic fit, delivery-vs-segment mismatches
  | 'audience-overlap'       // Shared-audience collisions & portfolio frequency math
  | 'competitive-macro'      // External signals (competitor pricing, gas) triangulated against Ford — correlation-only
  // Retained for Lincoln + Dealership Network enterprises
  | 'tier-choreography'      // Tier 1 ↔ Tier 2 ↔ Tier 3 collisions, halo, dealer-corp coordination
  | 'portfolio-dynamics'     // Cross-nameplate halo / cannibalization / audience overlap math
  | 'agency-arbitrage'       // Mindshare vs Cossette vs Regional partner playbook comparisons
  | 'macro-convergence'      // External signals (gas, iZEV, weather, competitor, NHL) triangulated against Ford
  | 'launch-calendar';       // Launch-window timing collisions across portfolio + competitive set
export type InsightStatus = 'new' | 'reviewed' | 'approved' | 'dismissed' | 'snoozed';
export type InsightScope = 'brand' | 'division' | 'product' | 'campaign';

export type DismissReason = 'not-relevant' | 'insufficient-confidence' | 'brand-constraint' | 'other';

export interface InsightActionStep {
  id: string;
  title: string;
  subtitle: string;
  type: 'budget' | 'creative' | 'targeting' | 'bidding' | 'scheduling';
  completed: boolean;
}

export interface Insight {
  id: string;
  enterprise: EnterpriseId;
  createdAt: string;
  scope: InsightScope;
  division?: DivisionId;
  productLine?: ProductLineId;
  campaign?: string;
  channels: ChannelId[];
  category: InsightCategory;
  title: string;
  summary: string;
  evidence: string[];
  confidence: number;
  impactEstimate: string;
  recommendedAction: string;
  status: InsightStatus;
  linkedNewsId?: string;
  linkedAnomalyId?: string;
  actionSteps: InsightActionStep[];
  approvalRationale?: string;
  dismissReason?: DismissReason;
  snoozeUntil?: string;
  actionedAt?: string;
  actionedBy?: string;
}

export interface ActionLogEntry {
  id: string;
  insightId: string;
  action: 'approved' | 'dismissed' | 'snoozed' | 'reviewed';
  timestamp: string;
  rationale?: string;
  dismissReason?: DismissReason;
  snoozeUntil?: string;
}

// ===== Anomaly =====
export interface Anomaly {
  id: string;
  date: string;
  geo: GeoId;
  division?: DivisionId;
  productLine?: ProductLineId;
  campaign?: string;
  channel?: ChannelId;
  metric: KPIKey;
  severity: 'low' | 'medium' | 'high';
  zScore: number;
  description: string;
}

// ===== Filters =====
export interface DashboardFilters {
  dateRange: DateRange;
  compareEnabled: boolean;
  divisions: DivisionId[];
  agencies: AgencyId[];
  productLines: ProductLineId[];
  audiences: AudienceId[];
  geos: GeoId[];
  channels: ChannelId[];
  objectives: CampaignObjective[];
  campaignStatus: CampaignStatus[];
  attributionModel: AttributionModel;
  role: UserRole;
  selectedDivision?: DivisionId;
  selectedProductLine?: ProductLineId;
  selectedCampaign?: string;
  customKpis?: KPIKey[];
}
