// ===== Enterprise (Multi-Tenant Selector) =====
// Top-level enterprise tenants — each is a distinct banner in the Empire / Sobeys
// portfolio, with its own siloed data. The Sobeys flagship plus the sister banners.
//
// NOTE: the EnterpriseId *slugs* below are retained from the prior build as opaque
// internal keys (they are never shown to users — only the `name` field renders).
// Keeping them stable avoids churning hundreds of `enterprise:` references.
//   ford-canada → Sobeys · lincoln → Farm Boy · dealership-network → Longo's
//   rbc → Safeway · molson-coors → IGA · lululemon → FreshCo · tim-hortons → Foodland
export type EnterpriseId =
  | 'ford-canada' | 'lincoln' | 'dealership-network'
  | 'rbc' | 'molson-coors' | 'lululemon' | 'tim-hortons';

export type Industry =
  | 'Full-Service Grocery' | 'Discount Grocery' | 'Specialty / Fresh' | 'Community Grocery';

export interface EnterpriseConfig {
  id: EnterpriseId;
  name: string;
  industry: Industry;
  tagline: string;
  description: string;
  productNoun: string;        // what a "product line" is called for this banner (Category / Department / Store Group)
  accentClass: string;        // Tailwind text/bg class for tile accent
  borderClass: string;        // Tailwind border class for tile
}

export const ENTERPRISES: EnterpriseConfig[] = [
  {
    id: 'ford-canada',
    name: 'Sobeys',
    industry: 'Full-Service Grocery',
    tagline: 'National full-service grocery — 8 merchandising categories',
    description: "Tier 1 (FCB / UM National AOR) · Tier 2 (Regional marketing across Atlantic, Québec, Ontario & West) · Tier 3 (1,500+ store network). $124M annual marketing investment.",
    productNoun: 'Category',
    accentClass: 'text-blue-400',
    borderClass: 'border-blue-500/30 hover:border-blue-500/60',
  },
  {
    id: 'lincoln',
    name: 'Farm Boy',
    industry: 'Specialty / Fresh',
    tagline: 'Fresh-market specialty — 4 fresh departments',
    description: 'Fresh Produce · Prepared Foods & Deli · Bakery · Butcher & Seafood. In-house brand studio + regional support. $34M annual marketing investment.',
    productNoun: 'Department',
    accentClass: 'text-amber-400',
    borderClass: 'border-amber-500/30 hover:border-amber-500/60',
  },
  {
    id: 'dealership-network',
    name: "Longo's",
    industry: 'Specialty / Fresh',
    tagline: 'Premium GTA grocery + Grocery Gateway — aggregate store network',
    description: "Aggregate view across Longo's stores + Grocery Gateway online fulfilment. Store-led marketing rolled up to corporate visibility — local relevance, flyer compliance, online conversion. $42M aggregated annual spend.",
    productNoun: 'Store Group',
    accentClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30 hover:border-emerald-500/60',
  },
  {
    id: 'rbc',
    name: 'Safeway',
    industry: 'Full-Service Grocery',
    tagline: 'Western full-service grocery — 6 categories',
    description: 'Fresh & Produce · Meat & Seafood · Bakery & Deli · Centre-Store · World Foods · Floral & Seasonal. Western Canada (BC · AB · SK · MB). $58M annual marketing investment.',
    productNoun: 'Category',
    accentClass: 'text-indigo-400',
    borderClass: 'border-indigo-500/30 hover:border-indigo-500/60',
  },
  {
    id: 'molson-coors',
    name: 'IGA',
    industry: 'Full-Service Grocery',
    tagline: 'Québec full-service grocery — 6 categories',
    description: 'Fresh & Produce · Boucherie · Boulangerie · Prepared Foods · Centre-Store · Rachelle-Béry Organic. Québec (franchised) + IGA West. $46M annual marketing investment.',
    productNoun: 'Category',
    accentClass: 'text-orange-400',
    borderClass: 'border-orange-500/30 hover:border-orange-500/60',
  },
  {
    id: 'lululemon',
    name: 'FreshCo',
    industry: 'Discount Grocery',
    tagline: 'Discount grocery — 6 value categories',
    description: 'Fresh & Produce · Meat & Value Packs · Weekly Price Drops · World Foods · Centre-Store Value · App & Scene+ Offers. Ontario + West. $38M annual marketing investment.',
    productNoun: 'Category',
    accentClass: 'text-pink-400',
    borderClass: 'border-pink-500/30 hover:border-pink-500/60',
  },
  {
    id: 'tim-hortons',
    name: 'Foodland',
    industry: 'Community Grocery',
    tagline: 'Community grocery — 6 categories',
    description: 'Fresh & Produce · Local & Ontario-Grown · Meat & Deli · Bakery · Centre-Store · Scene+ Loyalty. Rural Ontario + Atlantic (franchised). $22M annual marketing investment.',
    productNoun: 'Category',
    accentClass: 'text-red-400',
    borderClass: 'border-red-500/30 hover:border-red-500/60',
  },
];

// ===== Enterprise Hierarchy =====
// Type names retained from prior build to minimize refactor churn.
// DivisionId is semantically "Tier" in the Sobeys marketing ontology.
// ProductLineId is semantically "Category" (or Department / Store Group).

// --- Tiers (typed as DivisionId) ---
export type DivisionId = 'tier-1' | 'tier-2' | 'tier-3';

export const DIVISION_LABELS: Record<DivisionId, string> = {
  'tier-1': 'Tier 1 — National',
  'tier-2': 'Tier 2 — Regional',
  'tier-3': 'Tier 3 — Store & Local',
};

// Per-banner overrides for the generic tier structure. Tier 3 in particular is
// banner-specific (Store Network for Longo's, Marchand & Local for IGA, etc.).
export const ENTERPRISE_DIVISION_LABELS: Partial<Record<EnterpriseId, Record<DivisionId, string>>> = {
  'dealership-network': {
    'tier-1': 'Tier 1 — National',
    'tier-2': 'Tier 2 — Regional',
    'tier-3': 'Store Network',
  },
  'rbc': {
    'tier-1': 'Tier 1 — National Brand',
    'tier-2': 'Tier 2 — Regional',
    'tier-3': 'Tier 3 — Store & Local',
  },
  'molson-coors': {
    'tier-1': 'Tier 1 — National Brand',
    'tier-2': 'Tier 2 — Regional',
    'tier-3': 'Tier 3 — Marchand & Local',
  },
  'lululemon': {
    'tier-1': 'Tier 1 — Brand',
    'tier-2': 'Tier 2 — Performance',
    'tier-3': 'Tier 3 — Store & Community',
  },
  'tim-hortons': {
    'tier-1': 'Tier 1 — National Brand',
    'tier-2': 'Tier 2 — Regional',
    'tier-3': 'Tier 3 — Local Store',
  },
};

/** Division label resolved for a given banner, falling back to the generic tier label. */
export function divisionLabel(division: DivisionId, enterprise?: EnterpriseId | null): string {
  if (enterprise) {
    const overrides = ENTERPRISE_DIVISION_LABELS[enterprise];
    if (overrides) return overrides[division];
  }
  return DIVISION_LABELS[division];
}

// --- Agency / Marketing Partners ---
// Sobeys-family slugs were renamed to grocery (they surface as column values in the
// Assistant's SQL evidence for the default tenant). Sister-banner slugs are kept as
// opaque keys and only relabelled.
export type AgencyId =
  | 'sob-national-aor'
  | 'sob-quebec'
  | 'sob-west'
  | 'sob-ontario'
  | 'sob-alberta'
  | 'sob-atlantic'
  | 'store-local'
  | 'fb-studio'              // Farm Boy in-house studio
  | 'fb-regional'           // Farm Boy regional support
  // Safeway roster
  | 'rbc-bbdo' | 'rbc-initiative' | 'rbc-branch'
  // IGA roster
  | 'mc-rethink' | 'mc-mediacom' | 'mc-field'
  // FreshCo roster
  | 'lulu-inhouse' | 'lulu-performance' | 'lulu-community'
  // Foodland roster
  | 'th-zulu' | 'th-touche' | 'th-local';

export const AGENCY_LABELS: Record<AgencyId, string> = {
  'sob-national-aor': 'FCB / UM (National AOR)',
  'sob-quebec': 'Sobeys Québec',
  'sob-west': 'West Regional',
  'sob-ontario': 'Ontario Regional',
  'sob-alberta': 'Alberta Regional',
  'sob-atlantic': 'Atlantic Regional',
  'store-local': 'Store & Local Marketing',
  'fb-studio': 'Farm Boy Studio',
  'fb-regional': 'Farm Boy Regional',
  // Safeway
  'rbc-bbdo': 'Safeway Creative',
  'rbc-initiative': 'Safeway Media',
  'rbc-branch': 'Safeway Store & Local',
  // IGA
  'mc-rethink': 'IGA Creative (Sid Lee)',
  'mc-mediacom': 'IGA Media (Touché)',
  'mc-field': 'IGA Marchand & Local',
  // FreshCo
  'lulu-inhouse': 'FreshCo Creative',
  'lulu-performance': 'FreshCo Performance Media',
  'lulu-community': 'FreshCo Store & Community',
  // Foodland
  'th-zulu': 'Foodland Creative',
  'th-touche': 'Foodland Media',
  'th-local': 'Foodland Local Store',
};

// Tier mapping — used by molecular bonds and benchmarking widget
export const AGENCY_TO_TIER: Record<AgencyId, DivisionId> = {
  'sob-national-aor': 'tier-1',
  'sob-quebec': 'tier-2',
  'sob-west': 'tier-2',
  'sob-ontario': 'tier-2',
  'sob-alberta': 'tier-2',
  'sob-atlantic': 'tier-2',
  'store-local': 'tier-3',
  'fb-studio': 'tier-1',
  'fb-regional': 'tier-2',
  // Safeway
  'rbc-bbdo': 'tier-1',
  'rbc-initiative': 'tier-2',
  'rbc-branch': 'tier-3',
  // IGA
  'mc-rethink': 'tier-1',
  'mc-mediacom': 'tier-2',
  'mc-field': 'tier-3',
  // FreshCo
  'lulu-inhouse': 'tier-1',
  'lulu-performance': 'tier-2',
  'lulu-community': 'tier-3',
  // Foodland
  'th-zulu': 'tier-1',
  'th-touche': 'tier-2',
  'th-local': 'tier-3',
};

// --- Categories (typed as ProductLineId) ---
// Sobeys-flagship slugs renamed to grocery (surface in Assistant SQL for the default
// tenant). Sister-banner slugs kept as opaque keys and only relabelled.
export type ProductLineId =
  // Sobeys merchandising categories
  | 'scene-plus' | 'weekly-flyer' | 'compliments' | 'seasonal-bbq'
  | 'meat-seafood' | 'voila' | 'pharmacy' | 'centre-store'
  // Farm Boy departments
  | 'lincoln-aviator' | 'lincoln-nautilus' | 'lincoln-corsair' | 'lincoln-navigator'
  // Longo's — store-group / format rollups
  | 'dn-bc-rollup' | 'dn-ontario-rollup' | 'dn-quebec-rollup'
  | 'dn-alberta-rollup' | 'dn-atlantic-rollup' | 'dn-prairies-rollup'
  // Safeway categories
  | 'rbc-chequing' | 'rbc-mortgages' | 'rbc-avion' | 'rbc-wealth' | 'rbc-newcomers' | 'rbc-business'
  // IGA categories
  | 'mc-coors-light' | 'mc-molson-canadian' | 'mc-miller-lite' | 'mc-blue-moon' | 'mc-coors-banquet' | 'mc-vizzy'
  // FreshCo categories
  | 'lulu-womens' | 'lulu-mens' | 'lulu-align' | 'lulu-footwear' | 'lulu-accessories' | 'lulu-membership'
  // Foodland categories
  | 'th-hot-bev' | 'th-cold-bev' | 'th-breakfast' | 'th-baked' | 'th-lunch' | 'th-rewards';

export const PRODUCT_LINE_LABELS: Record<ProductLineId, string> = {
  // Sobeys
  'scene-plus': 'Scene+ Loyalty',
  'weekly-flyer': 'Weekly Flyer',
  'compliments': 'Compliments Own Brands',
  'seasonal-bbq': 'Seasonal & BBQ',
  'meat-seafood': 'Meat & Seafood',
  'voila': 'Voilà E-Commerce',
  'pharmacy': 'Pharmacy & Wellness',
  'centre-store': 'Centre-Store Grocery',
  // Farm Boy
  'lincoln-aviator': 'Fresh Produce',
  'lincoln-nautilus': 'Prepared Foods & Deli',
  'lincoln-corsair': 'Bakery',
  'lincoln-navigator': 'Butcher & Seafood',
  // Longo's
  'dn-bc-rollup': 'Fresh Market',
  'dn-ontario-rollup': 'Grocery Gateway (Online)',
  'dn-quebec-rollup': 'Prepared Foods & Deli',
  'dn-alberta-rollup': 'Bakery & Café',
  'dn-atlantic-rollup': 'Centre-Store Grocery',
  'dn-prairies-rollup': 'Catering & Corporate',
  // Safeway
  'rbc-chequing': 'Fresh & Produce',
  'rbc-mortgages': 'Meat & Seafood',
  'rbc-avion': 'Bakery & Deli',
  'rbc-wealth': 'Centre-Store Grocery',
  'rbc-newcomers': 'World Foods',
  'rbc-business': 'Floral & Seasonal',
  // IGA
  'mc-coors-light': 'Fresh & Produce',
  'mc-molson-canadian': 'Boucherie / Meat',
  'mc-miller-lite': 'Boulangerie / Bakery',
  'mc-blue-moon': 'Prepared Foods',
  'mc-coors-banquet': 'Centre-Store Grocery',
  'mc-vizzy': 'Rachelle-Béry Organic',
  // FreshCo
  'lulu-womens': 'Fresh & Produce',
  'lulu-mens': 'Meat & Value Packs',
  'lulu-align': 'Weekly Price Drops',
  'lulu-footwear': 'World Foods',
  'lulu-accessories': 'Centre-Store Value',
  'lulu-membership': 'App & Scene+ Offers',
  // Foodland
  'th-hot-bev': 'Fresh & Produce',
  'th-cold-bev': 'Local & Ontario-Grown',
  'th-breakfast': 'Meat & Deli',
  'th-baked': 'Bakery',
  'th-lunch': 'Centre-Store Grocery',
  'th-rewards': 'Scene+ Loyalty',
};

export interface ProductLine {
  id: ProductLineId;
  label: string;
  division: DivisionId;
  agencies: AgencyId[];
}

// --- Audience Segments ---
// Shared grocery shopper segments (Sobeys flagship + store network) were renamed;
// sister-banner slugs kept as opaque keys and only relabelled.
export type AudienceId =
  // Sobeys / shared shopper segments
  | 'value-families' | 'scene-members' | 'health-shoppers'
  | 'bulk-shoppers' | 'foodies' | 'weekly-families'
  | 'conquest-nofrills' | 'conquest-loblaws' | 'conquest-walmart' | 'conquest-costco'
  // Farm Boy premium-fresh segments
  | 'luxury-intenders' | 'conquest-bmw' | 'conquest-mercedes'
  | 'conquest-audi' | 'conquest-lexus' | 'lincoln-loyalists'
  // Longo's — local shopper buckets
  | 'local-shoppers' | 'service-loyalists' | 'finance-deal-seekers'
  // Safeway
  | 'rbc-newcomers-aud' | 'rbc-first-home' | 'rbc-students' | 'rbc-mass-affluent' | 'rbc-small-biz' | 'rbc-switchers'
  // IGA
  | 'mc-lda-young' | 'mc-sports-fans' | 'mc-value-mainstream' | 'mc-craft-curious' | 'mc-seltzer-flavor' | 'mc-light-loyalists'
  // FreshCo
  | 'lulu-yogis' | 'lulu-runners' | 'lulu-mens-perf' | 'lulu-everyday' | 'lulu-genz' | 'lulu-members' | 'lulu-lapsed'
  // Foodland
  | 'th-daily-regulars' | 'th-commuters' | 'th-families' | 'th-value-seekers' | 'th-cold-younger' | 'th-app-members' | 'th-lapsed';

export const AUDIENCE_LABELS: Record<AudienceId, string> = {
  // Sobeys / shared
  'value-families': 'Value-Seeking Families',
  'scene-members': 'Scene+ Members',
  'health-shoppers': 'Health & Wellness Shoppers',
  'bulk-shoppers': 'Bulk / Stock-Up Shoppers',
  'foodies': 'Foodies & Premium Fresh',
  'weekly-families': 'Weekly Family Shoppers',
  'conquest-nofrills': 'Conquest — No Frills',
  'conquest-loblaws': 'Conquest — Loblaws',
  'conquest-walmart': 'Conquest — Walmart',
  'conquest-costco': 'Conquest — Costco',
  // Farm Boy
  'luxury-intenders': 'Premium-Fresh Seekers',
  'conquest-bmw': 'Conquest — Whole Foods',
  'conquest-mercedes': 'Conquest — Metro',
  'conquest-audi': 'Organic & Natural Shoppers',
  'conquest-lexus': 'Prepared-Foods Shoppers',
  'lincoln-loyalists': 'Farm Boy Loyalists',
  // Longo's
  'local-shoppers': 'Local GTA Shoppers',
  'service-loyalists': 'Grocery Gateway Loyalists',
  'finance-deal-seekers': 'Deal & Flyer Seekers',
  // Safeway
  'rbc-newcomers-aud': 'New Canadians',
  'rbc-first-home': 'Young Families',
  'rbc-students': 'Students & Singles',
  'rbc-mass-affluent': 'Premium-Fresh Shoppers',
  'rbc-small-biz': 'Bulk / Stock-Up Shoppers',
  'rbc-switchers': 'Conquest — Save-On-Foods',
  // IGA
  'mc-lda-young': 'Young Foodies',
  'mc-sports-fans': 'Family Households',
  'mc-value-mainstream': 'Value Shoppers',
  'mc-craft-curious': 'Québec-Sourced Seekers',
  'mc-seltzer-flavor': 'Organic & Natural',
  'mc-light-loyalists': 'IGA Loyalists',
  // FreshCo
  'lulu-yogis': 'Budget Families',
  'lulu-runners': 'New Canadians',
  'lulu-mens-perf': 'Bulk / Stock-Up Shoppers',
  'lulu-everyday': 'Everyday Value Shoppers',
  'lulu-genz': 'Young Value Seekers',
  'lulu-members': 'App / Offer Members',
  'lulu-lapsed': 'Conquest — No Frills',
  // Foodland
  'th-daily-regulars': 'Community Regulars',
  'th-commuters': 'Convenience Shoppers',
  'th-families': 'Rural Families',
  'th-value-seekers': 'Value Seekers',
  'th-cold-younger': 'Younger Households',
  'th-app-members': 'Scene+ Members',
  'th-lapsed': 'Lapsed Shoppers',
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

// ROAS-led for grocery retail. "leads" / "cpl" are retained as the synthetic
// loyalty/registration sign-up metrics ("Sign-Ups" / "Cost per Sign-Up", e.g. Scene+
// enrolment) but are no longer the headline KPI.
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
  { key: 'leads', label: 'Sign-Ups', format: 'number', higherIsBetter: true, category: 'conversion' },
  { key: 'cpl', label: 'Cost / Sign-Up', format: 'currency', higherIsBetter: false, category: 'conversion' },
  { key: 'conversions', label: 'Transactions', format: 'number', higherIsBetter: true, category: 'conversion' },
  { key: 'cpa', label: 'Cost / Acquisition', format: 'currency', higherIsBetter: false, category: 'conversion' },
  { key: 'revenue', label: 'Attributed Sales', format: 'currency', higherIsBetter: true, category: 'revenue' },
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
  'spend', 'revenue', 'roas', 'conversions', 'cpa', 'reach',
  'impressions', 'ctr', 'cpm', 'engagementRate', 'shareOfVoice', 'budgetPacing'
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
  all: ['spend', 'roas', 'revenue'],
  upper: ['impressions', 'reach', 'cpm'],
  mid: ['clicks', 'ctr', 'engagementRate'],
  lower: ['conversions', 'roas', 'revenue'],
  retention: ['conversions', 'cpa', 'roas'],
};

export const FUNNEL_CUSTOM_KPIS: Record<FunnelStage, KPIKey[]> = {
  all: DEFAULT_BRAND_KPIS,
  upper: ['spend', 'impressions', 'reach', 'frequency', 'cpm', 'videoViews3s', 'videoViewsThruplay', 'threeSecondViewRate', 'brandSearchLift', 'budgetPacing'],
  mid: ['spend', 'clicks', 'ctr', 'cpc', 'landingPageViews', 'lpvRate', 'engagements', 'engagementRate', 'videoViewsThruplay', 'videoCompletionRate', 'budgetPacing'],
  lower: ['spend', 'conversions', 'cpa', 'revenue', 'roas', 'assistedConversions', 'ctr', 'budgetPacing'],
  retention: ['spend', 'conversions', 'cpa', 'revenue', 'roas', 'assistedConversions', 'engagementRate', 'budgetPacing'],
};

export const DEFAULT_EXEC_KPIS: KPIKey[] = [
  'spend', 'revenue', 'roas', 'conversions', 'cpa', 'reach',
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
  | 'grocery'
  | 'loyalty'
  | 'launch'
  | 'value'
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
  enterprises: EnterpriseId[];   // News may be relevant to multiple banners
}

// ===== Insights =====
export type InsightCategory =
  | 'market-radar'           // Top news / external events surfaced as CMO-attention cards
  // Sobeys signal taxonomy
  | 'strategic-opener'       // Portfolio-level brand & halo signals visible only across every banner/category
  | 'national-regional'      // Tier 1 → Tier 2 orchestration: national demand vs regional capture, playbook cascade
  | 'tactical-efficiency'    // Operator-level efficiency & allocation levers (incl. slider-driven channel reallocation)
  | 'creative-performance'   // Per-creative decay, geographic fit, delivery-vs-segment mismatches
  | 'audience-overlap'       // Shared-audience collisions & portfolio frequency math
  | 'competitive-macro'      // External signals (competitor promos, inflation) triangulated against Sobeys — correlation-only
  // Retained for Farm Boy + Longo's banners
  | 'tier-choreography'      // Tier 1 ↔ Tier 2 ↔ Tier 3 collisions, halo, store-corp coordination
  | 'portfolio-dynamics'     // Cross-category halo / cannibalization / audience overlap math
  | 'agency-arbitrage'       // National vs regional vs store playbook comparisons
  | 'macro-convergence'      // External signals (inflation, weather, competitor, holidays) triangulated against Sobeys
  | 'launch-calendar';       // Seasonal / promo-window timing collisions across portfolio + competitive set
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
