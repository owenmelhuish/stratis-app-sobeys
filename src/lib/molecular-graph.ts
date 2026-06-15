// ===== Molecular Graph Data Structure =====
// Defines nodes, bonds, ring config, and lineage tracing for the 3D molecular filter.

export interface MolecularNode {
  id: string;
  label: string;
  ring: number;
  angle: number;
  color: string;
  radius: number;
  description: string;
  filterType?: 'division' | 'agency' | 'productLine' | 'audience' | 'campaign' | 'channel' | 'funnel' | 'geo';
  filterValue?: string;
}

export interface MolecularBond {
  source: string;
  target: string;
}

export const RING_COLORS = {
  nucleus: '#1B4DA0',   // Sobeys blue
  org: '#7F77DD',
  product: '#1D9E75',
  audience: '#D85A30',
  campaign: '#5DCAA5',
  exec: '#378ADD',
};

export const RING_RADII = [0, 8, 14, 20, 27, 34];

// Visual sphere radii per ring (how big the node orb appears)
export const RING_NODE_RADII = [2.0, 1.3, 1.0, 0.9, 0.7, 0.6];

// Fibonacci sphere distribution for even spacing on a sphere surface
function fibonacciSphere(numPoints: number, radius: number): [number, number, number][] {
  if (numPoints === 1) return [[0, 0, 0]];
  const points: [number, number, number][] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < numPoints; i++) {
    const y = 1 - (i / (numPoints - 1)) * 2;
    const radiusAtY = Math.sqrt(1 - y * y);
    const theta = goldenAngle * i;
    points.push([
      radius * radiusAtY * Math.cos(theta),
      radius * y * 0.7, // oblate spheroid
      radius * radiusAtY * Math.sin(theta),
    ]);
  }
  return points;
}

const _nodeBasePositions = new Map<string, [number, number, number]>();

function computeBasePositions(nodes: MolecularNode[]) {
  const byRing = new Map<number, MolecularNode[]>();
  for (const n of nodes) {
    if (!byRing.has(n.ring)) byRing.set(n.ring, []);
    byRing.get(n.ring)!.push(n);
  }
  for (const [ring, ringNodes] of byRing) {
    const radius = RING_RADII[ring];
    if (ring === 0) {
      _nodeBasePositions.set(ringNodes[0].id, [0, 0, 0]);
      continue;
    }
    const positions = fibonacciSphere(ringNodes.length, radius);
    for (let i = 0; i < ringNodes.length; i++) {
      _nodeBasePositions.set(ringNodes[i].id, positions[i]);
    }
  }
}

export function getBasePosition(id: string): [number, number, number] {
  return _nodeBasePositions.get(id) ?? [0, 0, 0];
}

// ===== Node Definitions =====

const CAMPAIGN_IDS = [
  // Tier 1
  'sobeys-scene-summer-hero',
  'sobeys-flyer-spring',
  'sobeys-compliments-defense',
  'sobeys-bbq-national',
  'sobeys-meat-family',
  'sobeys-voila-growth',
  'sobeys-pharmacy-wellness',
  'sobeys-centre-store',
  'sobeys-brand-q2',
  // Tier 2
  'sobeys-scene-west',
  'sobeys-bbq-west',
  'sobeys-flyer-west',
  'sobeys-scene-ontario',
  'sobeys-flyer-ontario',
  'sobeys-meat-ontario',
  'sobeys-flyer-alberta',
  'sobeys-bbq-alberta',
  'sobeys-flyer-quebec',
  'sobeys-voila-quebec',
  'sobeys-flyer-atlantic',
  // Tier 3
  'sobeys-store-flyer-event',
  'sobeys-store-scene-drive',
  'sobeys-store-meat-drive',
] as const;

const CAMPAIGN_LABELS: Record<string, string> = {
  'sobeys-scene-summer-hero': 'Scene+ Summer',
  'sobeys-flyer-spring': 'Flyer Spring',
  'sobeys-compliments-defense': 'Compliments',
  'sobeys-bbq-national': 'BBQ Nat\'l',
  'sobeys-meat-family': 'Meat & Seafood',
  'sobeys-voila-growth': 'Voilà Growth',
  'sobeys-pharmacy-wellness': 'Pharmacy',
  'sobeys-centre-store': 'Centre-Store',
  'sobeys-brand-q2': 'Brand Q2',
  'sobeys-scene-west': 'Scene+ West',
  'sobeys-bbq-west': 'BBQ West',
  'sobeys-flyer-west': 'Flyer West',
  'sobeys-scene-ontario': 'Scene+ ON',
  'sobeys-flyer-ontario': 'Flyer ON',
  'sobeys-meat-ontario': 'Meat ON',
  'sobeys-flyer-alberta': 'Flyer AB',
  'sobeys-bbq-alberta': 'BBQ AB',
  'sobeys-flyer-quebec': 'Flyer QC',
  'sobeys-voila-quebec': 'Voilà QC',
  'sobeys-flyer-atlantic': 'Flyer AT',
  'sobeys-store-flyer-event': 'Store Flyer',
  'sobeys-store-scene-drive': 'Store Scene+',
  'sobeys-store-meat-drive': 'Store Meat',
};

// Campaign → primary nameplate mapping (used for Ring 2→4 bonds)
const CAMPAIGN_TO_NAMEPLATE: Record<string, string> = {
  'sobeys-scene-summer-hero': 'scene-plus',
  'sobeys-flyer-spring': 'weekly-flyer',
  'sobeys-compliments-defense': 'compliments',
  'sobeys-bbq-national': 'seasonal-bbq',
  'sobeys-meat-family': 'meat-seafood',
  'sobeys-voila-growth': 'voila',
  'sobeys-pharmacy-wellness': 'pharmacy',
  'sobeys-centre-store': 'centre-store',
  'sobeys-brand-q2': 'weekly-flyer',
  'sobeys-scene-west': 'scene-plus',
  'sobeys-bbq-west': 'seasonal-bbq',
  'sobeys-flyer-west': 'weekly-flyer',
  'sobeys-scene-ontario': 'scene-plus',
  'sobeys-flyer-ontario': 'weekly-flyer',
  'sobeys-meat-ontario': 'meat-seafood',
  'sobeys-flyer-alberta': 'weekly-flyer',
  'sobeys-bbq-alberta': 'seasonal-bbq',
  'sobeys-flyer-quebec': 'weekly-flyer',
  'sobeys-voila-quebec': 'voila',
  'sobeys-flyer-atlantic': 'weekly-flyer',
  'sobeys-store-flyer-event': 'weekly-flyer',
  'sobeys-store-scene-drive': 'scene-plus',
  'sobeys-store-meat-drive': 'meat-seafood',
};

// Campaign → audiences (mirrors mock-data.ts)
const CAMPAIGN_TO_AUDIENCES: Record<string, string[]> = {
  'sobeys-scene-summer-hero': ['value-families', 'scene-members', 'conquest-nofrills'],
  'sobeys-flyer-spring': ['value-families', 'bulk-shoppers'],
  'sobeys-compliments-defense': ['scene-members', 'conquest-loblaws', 'conquest-costco'],
  'sobeys-bbq-national': ['foodies'],
  'sobeys-meat-family': ['weekly-families', 'conquest-walmart'],
  'sobeys-voila-growth': ['health-shoppers', 'weekly-families', 'conquest-walmart'],
  'sobeys-pharmacy-wellness': ['bulk-shoppers'],
  'sobeys-centre-store': ['weekly-families'],
  'sobeys-brand-q2': ['value-families'],
  'sobeys-scene-west': ['value-families', 'scene-members'],
  'sobeys-bbq-west': ['foodies'],
  'sobeys-flyer-west': ['value-families'],
  'sobeys-scene-ontario': ['value-families', 'scene-members'],
  'sobeys-flyer-ontario': ['value-families'],
  'sobeys-meat-ontario': ['weekly-families'],
  'sobeys-flyer-alberta': ['value-families', 'bulk-shoppers'],
  'sobeys-bbq-alberta': ['foodies'],
  'sobeys-flyer-quebec': ['value-families'],
  'sobeys-voila-quebec': ['health-shoppers'],
  'sobeys-flyer-atlantic': ['value-families'],
  'sobeys-store-flyer-event': ['value-families'],
  'sobeys-store-scene-drive': ['scene-members', 'value-families'],
  'sobeys-store-meat-drive': ['weekly-families'],
};

// Campaign → channels
const CAMPAIGN_TO_CHANNELS: Record<string, string[]> = {
  'sobeys-scene-summer-hero': ['ctv', 'ttd', 'google-search', 'instagram', 'ooh'],
  'sobeys-flyer-spring': ['ctv', 'ttd', 'google-search', 'ooh'],
  'sobeys-compliments-defense': ['google-search', 'instagram', 'tiktok', 'ttd'],
  'sobeys-bbq-national': ['ctv', 'instagram', 'tiktok', 'ttd'],
  'sobeys-meat-family': ['ctv', 'google-search', 'instagram', 'facebook'],
  'sobeys-voila-growth': ['google-search', 'instagram', 'facebook', 'ttd'],
  'sobeys-pharmacy-wellness': ['linkedin', 'google-search', 'ttd'],
  'sobeys-centre-store': ['google-search', 'facebook', 'ttd'],
  'sobeys-brand-q2': ['ctv', 'ooh', 'spotify'],
  'sobeys-scene-west': ['google-search', 'instagram', 'facebook'],
  'sobeys-bbq-west': ['instagram', 'tiktok', 'google-search'],
  'sobeys-flyer-west': ['google-search', 'facebook', 'instagram'],
  'sobeys-scene-ontario': ['google-search', 'instagram', 'facebook', 'spotify'],
  'sobeys-flyer-ontario': ['google-search', 'facebook', 'instagram', 'ttd'],
  'sobeys-meat-ontario': ['google-search', 'facebook', 'instagram'],
  'sobeys-flyer-alberta': ['google-search', 'facebook', 'instagram'],
  'sobeys-bbq-alberta': ['instagram', 'tiktok', 'facebook'],
  'sobeys-flyer-quebec': ['google-search', 'facebook', 'instagram', 'spotify'],
  'sobeys-voila-quebec': ['google-search', 'facebook', 'instagram'],
  'sobeys-flyer-atlantic': ['google-search', 'facebook', 'instagram'],
  'sobeys-store-flyer-event': ['facebook', 'instagram', 'google-search'],
  'sobeys-store-scene-drive': ['facebook', 'instagram', 'google-search'],
  'sobeys-store-meat-drive': ['facebook', 'instagram', 'google-search'],
};

// Campaign → objective (funnel)
const CAMPAIGN_TO_OBJECTIVE: Record<string, string> = {
  'sobeys-scene-summer-hero': 'awareness',
  'sobeys-flyer-spring': 'awareness',
  'sobeys-compliments-defense': 'consideration',
  'sobeys-bbq-national': 'awareness',
  'sobeys-meat-family': 'consideration',
  'sobeys-voila-growth': 'consideration',
  'sobeys-pharmacy-wellness': 'conversion',
  'sobeys-centre-store': 'awareness',
  'sobeys-brand-q2': 'awareness',
  'sobeys-scene-west': 'conversion',
  'sobeys-bbq-west': 'consideration',
  'sobeys-flyer-west': 'conversion',
  'sobeys-scene-ontario': 'conversion',
  'sobeys-flyer-ontario': 'conversion',
  'sobeys-meat-ontario': 'consideration',
  'sobeys-flyer-alberta': 'conversion',
  'sobeys-bbq-alberta': 'consideration',
  'sobeys-flyer-quebec': 'conversion',
  'sobeys-voila-quebec': 'consideration',
  'sobeys-flyer-atlantic': 'conversion',
  'sobeys-store-flyer-event': 'conversion',
  'sobeys-store-scene-drive': 'conversion',
  'sobeys-store-meat-drive': 'conversion',
};

// Campaign → geos
const CAMPAIGN_TO_GEOS: Record<string, string[]> = {
  'sobeys-scene-summer-hero': ['national'],
  'sobeys-flyer-spring': ['national'],
  'sobeys-compliments-defense': ['national'],
  'sobeys-bbq-national': ['national'],
  'sobeys-meat-family': ['national'],
  'sobeys-voila-growth': ['national'],
  'sobeys-pharmacy-wellness': ['national'],
  'sobeys-centre-store': ['national'],
  'sobeys-brand-q2': ['national'],
  'sobeys-scene-west': ['bc'],
  'sobeys-bbq-west': ['bc'],
  'sobeys-flyer-west': ['bc'],
  'sobeys-scene-ontario': ['ontario'],
  'sobeys-flyer-ontario': ['ontario'],
  'sobeys-meat-ontario': ['ontario'],
  'sobeys-flyer-alberta': ['alberta'],
  'sobeys-bbq-alberta': ['alberta'],
  'sobeys-flyer-quebec': ['quebec'],
  'sobeys-voila-quebec': ['quebec'],
  'sobeys-flyer-atlantic': ['atlantic'],
  'sobeys-store-flyer-event': ['ontario', 'alberta', 'bc', 'quebec', 'atlantic'],
  'sobeys-store-scene-drive': ['ontario', 'alberta', 'bc', 'quebec'],
  'sobeys-store-meat-drive': ['ontario', 'alberta', 'bc'],
};

// Campaign → agency
const CAMPAIGN_TO_AGENCY: Record<string, string> = {
  'sobeys-scene-summer-hero': 'sob-national-aor',
  'sobeys-flyer-spring': 'sob-national-aor',
  'sobeys-compliments-defense': 'sob-national-aor',
  'sobeys-bbq-national': 'sob-national-aor',
  'sobeys-meat-family': 'sob-national-aor',
  'sobeys-voila-growth': 'sob-national-aor',
  'sobeys-pharmacy-wellness': 'sob-national-aor',
  'sobeys-centre-store': 'sob-national-aor',
  'sobeys-brand-q2': 'sob-national-aor',
  'sobeys-scene-west': 'sob-west',
  'sobeys-bbq-west': 'sob-west',
  'sobeys-flyer-west': 'sob-west',
  'sobeys-scene-ontario': 'sob-ontario',
  'sobeys-flyer-ontario': 'sob-ontario',
  'sobeys-meat-ontario': 'sob-ontario',
  'sobeys-flyer-alberta': 'sob-alberta',
  'sobeys-bbq-alberta': 'sob-alberta',
  'sobeys-flyer-quebec': 'sob-quebec',
  'sobeys-voila-quebec': 'sob-quebec',
  'sobeys-flyer-atlantic': 'sob-atlantic',
  'sobeys-store-flyer-event': 'store-local',
  'sobeys-store-scene-drive': 'store-local',
  'sobeys-store-meat-drive': 'store-local',
};

const NODES: MolecularNode[] = [
  // Ring 0 — Nucleus
  { id: 'sobeys', label: 'SOBEYS', ring: 0, angle: 0, color: RING_COLORS.nucleus, radius: 2.5, description: 'Sobeys' },

  // Ring 1 — 3 tiers + 7 marketing partners = 10 nodes
  { id: 'tier-1', label: 'Tier 1', ring: 1, angle: 0,   color: RING_COLORS.org, radius: 1.4, description: 'Tier 1 — National / Brand', filterType: 'division', filterValue: 'tier-1' },
  { id: 'tier-2', label: 'Tier 2', ring: 1, angle: 120, color: RING_COLORS.org, radius: 1.4, description: 'Tier 2 — Regional', filterType: 'division', filterValue: 'tier-2' },
  { id: 'tier-3', label: 'Tier 3', ring: 1, angle: 240, color: RING_COLORS.org, radius: 1.4, description: 'Tier 3 — Store & Local', filterType: 'division', filterValue: 'tier-3' },
  { id: 'sob-national-aor',  label: 'FCB / UM',   ring: 1, angle: 36,  color: RING_COLORS.org, radius: 1.1, description: 'FCB / UM — National AOR (T1)', filterType: 'agency', filterValue: 'sob-national-aor' },
  { id: 'sob-quebec',        label: 'Québec',     ring: 1, angle: 72,  color: RING_COLORS.org, radius: 1.1, description: 'Sobeys Québec (T2)', filterType: 'agency', filterValue: 'sob-quebec' },
  { id: 'sob-west',          label: 'West Reg.',  ring: 1, angle: 144, color: RING_COLORS.org, radius: 1.1, description: 'West Regional (T2)', filterType: 'agency', filterValue: 'sob-west' },
  { id: 'sob-ontario',       label: 'ON Reg.',    ring: 1, angle: 180, color: RING_COLORS.org, radius: 1.1, description: 'Ontario Regional (T2)', filterType: 'agency', filterValue: 'sob-ontario' },
  { id: 'sob-alberta',       label: 'AB Reg.',    ring: 1, angle: 216, color: RING_COLORS.org, radius: 1.1, description: 'Alberta Regional (T2)', filterType: 'agency', filterValue: 'sob-alberta' },
  { id: 'sob-atlantic',      label: 'AT Reg.',    ring: 1, angle: 288, color: RING_COLORS.org, radius: 1.1, description: 'Atlantic Regional (T2)', filterType: 'agency', filterValue: 'sob-atlantic' },
  { id: 'store-local',       label: 'Store Net.', ring: 1, angle: 324, color: RING_COLORS.org, radius: 1.1, description: 'Store & Local Marketing — aggregate (T3)', filterType: 'agency', filterValue: 'store-local' },

  // Ring 2 — 8 merchandising categories at 45° intervals
  { id: 'weekly-flyer',   label: 'Weekly Flyer', ring: 2, angle: 0,   color: RING_COLORS.product, radius: 1.2, description: 'Weekly Flyer & Price', filterType: 'productLine', filterValue: 'weekly-flyer' },
  { id: 'scene-plus',     label: 'Scene+',       ring: 2, angle: 45,  color: RING_COLORS.product, radius: 1.2, description: 'Scene+ Loyalty — active summer activation', filterType: 'productLine', filterValue: 'scene-plus' },
  { id: 'seasonal-bbq',   label: 'Seasonal BBQ', ring: 2, angle: 90,  color: RING_COLORS.product, radius: 1.2, description: 'Seasonal & BBQ', filterType: 'productLine', filterValue: 'seasonal-bbq' },
  { id: 'meat-seafood',   label: 'Meat & Sea.',  ring: 2, angle: 135, color: RING_COLORS.product, radius: 1.2, description: 'Meat & Seafood', filterType: 'productLine', filterValue: 'meat-seafood' },
  { id: 'compliments',    label: 'Compliments',  ring: 2, angle: 180, color: RING_COLORS.product, radius: 1.2, description: 'Compliments Own Brands', filterType: 'productLine', filterValue: 'compliments' },
  { id: 'voila',          label: 'Voilà',        ring: 2, angle: 225, color: RING_COLORS.product, radius: 1.2, description: 'Voilà E-Commerce', filterType: 'productLine', filterValue: 'voila' },
  { id: 'pharmacy',       label: 'Pharmacy',     ring: 2, angle: 270, color: RING_COLORS.product, radius: 1.2, description: 'Pharmacy & Wellness', filterType: 'productLine', filterValue: 'pharmacy' },
  { id: 'centre-store',   label: 'Centre-Store', ring: 2, angle: 315, color: RING_COLORS.product, radius: 1.2, description: 'Centre-Store Grocery', filterType: 'productLine', filterValue: 'centre-store' },

  // Ring 3 — 10 shopper segments at 36° intervals
  { id: 'value-families',     label: 'Value Fam.',     ring: 3, angle: 0,   color: RING_COLORS.audience, radius: 1.0, description: 'Value-Seeking Families', filterType: 'audience', filterValue: 'value-families' },
  { id: 'scene-members',      label: 'Scene+ Mbrs',    ring: 3, angle: 36,  color: RING_COLORS.audience, radius: 1.0, description: 'Scene+ Members', filterType: 'audience', filterValue: 'scene-members' },
  { id: 'health-shoppers',    label: 'Health',         ring: 3, angle: 72,  color: RING_COLORS.audience, radius: 1.0, description: 'Health & Wellness Shoppers', filterType: 'audience', filterValue: 'health-shoppers' },
  { id: 'bulk-shoppers',      label: 'Bulk/Stock',     ring: 3, angle: 108, color: RING_COLORS.audience, radius: 1.0, description: 'Bulk / Stock-Up Shoppers', filterType: 'audience', filterValue: 'bulk-shoppers' },
  { id: 'foodies',            label: 'Foodies',        ring: 3, angle: 144, color: RING_COLORS.audience, radius: 1.0, description: 'Foodies & Premium Fresh', filterType: 'audience', filterValue: 'foodies' },
  { id: 'weekly-families',    label: 'Weekly Fam.',    ring: 3, angle: 180, color: RING_COLORS.audience, radius: 1.0, description: 'Weekly Family Shoppers', filterType: 'audience', filterValue: 'weekly-families' },
  { id: 'conquest-nofrills',  label: 'Conq. NoFrills', ring: 3, angle: 216, color: RING_COLORS.audience, radius: 1.0, description: 'Conquest — No Frills', filterType: 'audience', filterValue: 'conquest-nofrills' },
  { id: 'conquest-loblaws',   label: 'Conq. Loblaws',  ring: 3, angle: 252, color: RING_COLORS.audience, radius: 1.0, description: 'Conquest — Loblaws', filterType: 'audience', filterValue: 'conquest-loblaws' },
  { id: 'conquest-walmart',   label: 'Conq. Walmart',  ring: 3, angle: 288, color: RING_COLORS.audience, radius: 1.0, description: 'Conquest — Walmart', filterType: 'audience', filterValue: 'conquest-walmart' },
  { id: 'conquest-costco',    label: 'Conq. Costco',   ring: 3, angle: 324, color: RING_COLORS.audience, radius: 1.0, description: 'Conquest — Costco', filterType: 'audience', filterValue: 'conquest-costco' },

  // Ring 4 — 23 campaigns spread evenly
  ...CAMPAIGN_IDS.map((id, i) => ({
    id,
    label: CAMPAIGN_LABELS[id],
    ring: 4,
    angle: (360 / CAMPAIGN_IDS.length) * i,
    color: RING_COLORS.campaign,
    radius: 0.8,
    description: CAMPAIGN_LABELS[id],
    filterType: 'campaign' as const,
    filterValue: id,
  })),

  // Ring 5 — 9 channels + 3 funnel + 6 geos = 18 nodes
  { id: 'ch-instagram',     label: 'Instagram',     ring: 5, angle: 0,   color: RING_COLORS.exec, radius: 0.9, description: 'Instagram', filterType: 'channel', filterValue: 'instagram' },
  { id: 'ch-facebook',      label: 'Facebook',      ring: 5, angle: 20,  color: RING_COLORS.exec, radius: 0.9, description: 'Facebook', filterType: 'channel', filterValue: 'facebook' },
  { id: 'ch-tiktok',        label: 'TikTok',        ring: 5, angle: 40,  color: RING_COLORS.exec, radius: 0.9, description: 'TikTok', filterType: 'channel', filterValue: 'tiktok' },
  { id: 'ch-google-search', label: 'Google Search', ring: 5, angle: 60,  color: RING_COLORS.exec, radius: 0.9, description: 'Google Search', filterType: 'channel', filterValue: 'google-search' },
  { id: 'ch-ttd',           label: 'Trade Desk',    ring: 5, angle: 80,  color: RING_COLORS.exec, radius: 0.9, description: 'The Trade Desk', filterType: 'channel', filterValue: 'ttd' },
  { id: 'ch-ctv',           label: 'CTV',           ring: 5, angle: 100, color: RING_COLORS.exec, radius: 0.9, description: 'Connected TV', filterType: 'channel', filterValue: 'ctv' },
  { id: 'ch-spotify',       label: 'Spotify',       ring: 5, angle: 120, color: RING_COLORS.exec, radius: 0.9, description: 'Spotify', filterType: 'channel', filterValue: 'spotify' },
  { id: 'ch-linkedin',      label: 'LinkedIn',      ring: 5, angle: 140, color: RING_COLORS.exec, radius: 0.9, description: 'LinkedIn', filterType: 'channel', filterValue: 'linkedin' },
  { id: 'ch-ooh',           label: 'OOH',           ring: 5, angle: 160, color: RING_COLORS.exec, radius: 0.9, description: 'Out-of-Home', filterType: 'channel', filterValue: 'ooh' },
  { id: 'fn-awareness',     label: 'Awareness',     ring: 5, angle: 195, color: RING_COLORS.exec, radius: 0.9, description: 'Awareness Objective', filterType: 'funnel', filterValue: 'awareness' },
  { id: 'fn-consideration', label: 'Consideration', ring: 5, angle: 220, color: RING_COLORS.exec, radius: 0.9, description: 'Consideration Objective', filterType: 'funnel', filterValue: 'consideration' },
  { id: 'fn-conversion',    label: 'Conversion',    ring: 5, angle: 245, color: RING_COLORS.exec, radius: 0.9, description: 'Conversion Objective', filterType: 'funnel', filterValue: 'conversion' },
  { id: 'geo-national',     label: 'National',      ring: 5, angle: 275, color: RING_COLORS.exec, radius: 0.9, description: 'National', filterType: 'geo', filterValue: 'national' },
  { id: 'geo-bc',           label: 'BC',            ring: 5, angle: 290, color: RING_COLORS.exec, radius: 0.9, description: 'British Columbia', filterType: 'geo', filterValue: 'bc' },
  { id: 'geo-alberta',      label: 'Alberta',       ring: 5, angle: 305, color: RING_COLORS.exec, radius: 0.9, description: 'Alberta', filterType: 'geo', filterValue: 'alberta' },
  { id: 'geo-ontario',      label: 'Ontario',       ring: 5, angle: 320, color: RING_COLORS.exec, radius: 0.9, description: 'Ontario', filterType: 'geo', filterValue: 'ontario' },
  { id: 'geo-quebec',       label: 'Quebec',        ring: 5, angle: 335, color: RING_COLORS.exec, radius: 0.9, description: 'Quebec', filterType: 'geo', filterValue: 'quebec' },
  { id: 'geo-atlantic',     label: 'Atlantic',      ring: 5, angle: 350, color: RING_COLORS.exec, radius: 0.9, description: 'Atlantic', filterType: 'geo', filterValue: 'atlantic' },
];

// ===== Bond Definitions =====

const TIER_AGENCIES: Record<string, string[]> = {
  'tier-1': ['sob-national-aor'],
  'tier-2': ['sob-quebec', 'sob-west', 'sob-ontario', 'sob-alberta', 'sob-atlantic'],
  'tier-3': ['store-local'],
};

// Channel id → ring 5 node id
const CHANNEL_NODE = (c: string) => `ch-${c}`;
const FUNNEL_NODE = (f: string) => `fn-${f}`;
const GEO_NODE = (g: string) => `geo-${g}`;

const BONDS: MolecularBond[] = [
  // Ring 0 → Ring 1: Sobeys to all tiers + partners
  ...['tier-1', 'tier-2', 'tier-3', 'sob-national-aor', 'sob-quebec', 'sob-west', 'sob-ontario', 'sob-alberta', 'sob-atlantic', 'store-local'].map(t => ({ source: 'sobeys', target: t })),

  // Ring 1 (Tier) → Ring 1 (Agency)
  ...Object.entries(TIER_AGENCIES).flatMap(([tier, agencies]) => agencies.map(a => ({ source: tier, target: a }))),

  // Ring 1 (Partner) → Ring 2 (Category) — derived from campaigns
  ...(() => {
    const seen = new Set<string>();
    const out: MolecularBond[] = [];
    for (const cid of CAMPAIGN_IDS) {
      const agency = CAMPAIGN_TO_AGENCY[cid];
      const nameplate = CAMPAIGN_TO_NAMEPLATE[cid];
      const key = `${agency}|${nameplate}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ source: agency, target: nameplate });
    }
    return out;
  })(),

  // Ring 2 (Category) → Ring 3 (Audience) — derived from campaigns
  ...(() => {
    const seen = new Set<string>();
    const out: MolecularBond[] = [];
    for (const cid of CAMPAIGN_IDS) {
      const nameplate = CAMPAIGN_TO_NAMEPLATE[cid];
      for (const aud of CAMPAIGN_TO_AUDIENCES[cid]) {
        const key = `${nameplate}|${aud}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ source: nameplate, target: aud });
      }
    }
    return out;
  })(),

  // Ring 3 (Audience) → Ring 4 (Campaign)
  ...CAMPAIGN_IDS.flatMap(cid =>
    CAMPAIGN_TO_AUDIENCES[cid].map(aud => ({ source: aud, target: cid }))
  ),

  // Ring 4 (Campaign) → Ring 5 (Channel)
  ...CAMPAIGN_IDS.flatMap(cid =>
    CAMPAIGN_TO_CHANNELS[cid].map(ch => ({ source: cid, target: CHANNEL_NODE(ch) }))
  ),

  // Ring 4 (Campaign) → Ring 5 (Funnel objective)
  ...CAMPAIGN_IDS.map(cid => ({ source: cid, target: FUNNEL_NODE(CAMPAIGN_TO_OBJECTIVE[cid]) })),

  // Ring 4 (Campaign) → Ring 5 (Geo)
  ...CAMPAIGN_IDS.flatMap(cid =>
    CAMPAIGN_TO_GEOS[cid].map(g => ({ source: cid, target: GEO_NODE(g) }))
  ),
];

// ===== Exports =====

export const MOLECULAR_NODES = NODES;
export const MOLECULAR_BONDS = BONDS;

computeBasePositions(NODES);

// Build adjacency maps for fast lookup.
// Bonds are directional: source = closer to nucleus (parent), target = further (child).
// Same-ring bonds (e.g., tier → agency) are honored via this directional structure
// rather than ring-comparison, so clicking Tier 1 propagates outward through agencies
// to nameplates / audiences / campaigns / channels.
const nodeMap = new Map<string, MolecularNode>();
for (const n of NODES) nodeMap.set(n.id, n);

const childrenMap = new Map<string, Set<string>>();
const parentsMap = new Map<string, Set<string>>();
for (const b of BONDS) {
  if (!childrenMap.has(b.source)) childrenMap.set(b.source, new Set());
  if (!parentsMap.has(b.target)) parentsMap.set(b.target, new Set());
  childrenMap.get(b.source)!.add(b.target);
  parentsMap.get(b.target)!.add(b.source);
}

function bondKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function getNode(id: string): MolecularNode | undefined {
  return nodeMap.get(id);
}

export function traceLineage(
  selectedIds: Set<string>,
  nodes: MolecularNode[] = NODES,
  bonds: MolecularBond[] = BONDS,
): { litNodes: Set<string>; litBonds: Set<string> } {
  if (selectedIds.size === 0) return { litNodes: new Set(), litBonds: new Set() };

  const selectionsByRing = new Map<number, string[]>();
  for (const id of selectedIds) {
    const node = nodeMap.get(id);
    if (!node) continue;
    if (!selectionsByRing.has(node.ring)) selectionsByRing.set(node.ring, []);
    selectionsByRing.get(node.ring)!.push(id);
  }

  function traceDirection(startId: string, direction: 'upstream' | 'downstream'): { nodes: Set<string>; bonds: Set<string> } {
    const visited = new Set<string>();
    const visitedBonds = new Set<string>();
    const queue = [startId];
    visited.add(startId);

    const map = direction === 'downstream' ? childrenMap : parentsMap;

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = map.get(current);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          visitedBonds.add(bondKey(current, neighbor));
          queue.push(neighbor);
        }
      }
    }
    return { nodes: visited, bonds: visitedBonds };
  }

  const allLitNodes = new Set<string>();
  const allLitBonds = new Set<string>();

  // Upstream: always union
  for (const id of selectedIds) {
    const upstream = traceDirection(id, 'upstream');
    for (const n of upstream.nodes) allLitNodes.add(n);
    for (const b of upstream.bonds) allLitBonds.add(b);
  }

  // Downstream: AND across rings, OR within same ring
  const rings = Array.from(selectionsByRing.keys()).sort((a, b) => a - b);
  let downstreamNodeSets: Set<string>[] | null = null;
  let downstreamBondSets: Set<string>[] | null = null;

  for (const ring of rings) {
    const idsInRing = selectionsByRing.get(ring)!;
    const ringNodes = new Set<string>();
    const ringBonds = new Set<string>();
    for (const id of idsInRing) {
      const downstream = traceDirection(id, 'downstream');
      for (const n of downstream.nodes) ringNodes.add(n);
      for (const b of downstream.bonds) ringBonds.add(b);
    }

    if (downstreamNodeSets === null) {
      downstreamNodeSets = [ringNodes];
      downstreamBondSets = [ringBonds];
    } else {
      downstreamNodeSets.push(ringNodes);
      downstreamBondSets!.push(ringBonds);
    }
  }

  if (downstreamNodeSets && downstreamNodeSets.length > 0) {
    let intersectedNodes = downstreamNodeSets[0];
    for (let i = 1; i < downstreamNodeSets.length; i++) {
      const next = downstreamNodeSets[i];
      intersectedNodes = new Set([...intersectedNodes].filter(n => next.has(n)));
    }
    for (const n of intersectedNodes) allLitNodes.add(n);

    for (const bondSet of downstreamBondSets!) {
      for (const bk of bondSet) {
        const [a, b] = bk.split('|');
        if (allLitNodes.has(a) && allLitNodes.has(b)) {
          allLitBonds.add(bk);
        }
      }
    }
  }

  for (const id of selectedIds) allLitNodes.add(id);

  return { litNodes: allLitNodes, litBonds: allLitBonds };
}
