// ===== Sobeys / Empire Store Network — 890 deterministic stores =====
// Used by the Store Network enterprise's molecular filter and data scoping.
// Banners + cities are plausibly Canadian Empire/Sobeys stores; deterministic via
// seeded PRNG so the demo is stable.

import type { GeoId } from '@/types';

// Store flyer / brand / pricing compliance status
export type ComplianceStatus = 'compliant' | 'at-risk' | 'violation';
// Grocery store formats (key strings drive the molecular display labels):
//  full-service = large full-service supermarket (Sobeys / Safeway flagship)
//  urban-fresh  = compact urban fresh-market format
//  community    = community / neighbourhood store
//  discount     = discount banner (FreshCo / No Frills-class value)
export type DealerType = 'full-service' | 'urban-fresh' | 'community' | 'discount';

export interface Dealer {
  id: string;
  name: string;
  region: GeoId;
  city: string;
  type: DealerType;
  complianceStatus: ComplianceStatus;
  monthlySpend: number;
  share: number; // 0-1, this store's share of their region's aggregate spend
}

// ===== Region distribution (totals 890) =====
export const DEALER_REGION_COUNTS: Record<Exclude<GeoId, 'national'>, number> = {
  ontario: 330,
  quebec: 180,
  bc: 150,
  alberta: 120,
  atlantic: 70,
  // Prairies (Saskatchewan + Manitoba) is folded into 'alberta' since GeoId doesn't have a separate prairies key.
  // We expose 'prairies' as a logical grouping in the molecular view by splitting alberta stores.
};

// Logical region for molecular display — prairies splits out from alberta for visualization
export const MOLECULAR_REGION_LABELS: Record<string, string> = {
  ontario: 'Ontario',
  quebec: 'Quebec',
  bc: 'British Columbia',
  alberta: 'Alberta',
  atlantic: 'Atlantic',
  prairies: 'Prairies',
};

export const MOLECULAR_REGION_COLORS: Record<string, string> = {
  ontario: '#3B82F6',     // blue
  quebec: '#A855F7',      // purple
  bc: '#10B981',          // emerald
  alberta: '#F97316',     // orange
  atlantic: '#06B6D4',    // cyan
  prairies: '#EAB308',    // yellow
};

// ===== City pools per region (each store gets a real-feeling Canadian city) =====
const CITIES: Record<string, string[]> = {
  ontario: [
    'Toronto', 'Mississauga', 'Brampton', 'Hamilton', 'London', 'Markham', 'Vaughan', 'Kitchener', 'Windsor', 'Richmond Hill',
    'Oakville', 'Burlington', 'Oshawa', 'Barrie', 'St. Catharines', 'Cambridge', 'Kingston', 'Whitby', 'Guelph', 'Ajax',
    'Waterloo', 'Thunder Bay', 'Sudbury', 'Sault Ste. Marie', 'Pickering', 'Newmarket', 'Peterborough', 'Sarnia', 'Brantford', 'Niagara Falls',
    'North Bay', 'Welland', 'Belleville', 'Cornwall', 'Chatham', 'Orangeville', 'Bradford', 'Stratford', 'Owen Sound', 'Timmins',
  ],
  quebec: [
    'Montreal', 'Quebec City', 'Laval', 'Gatineau', 'Longueuil', 'Sherbrooke', 'Saguenay', 'Lévis', 'Trois-Rivières', 'Terrebonne',
    'Saint-Jean-sur-Richelieu', 'Repentigny', 'Brossard', 'Drummondville', 'Saint-Jérôme', 'Granby', 'Blainville', 'Saint-Hyacinthe', 'Mirabel', 'Shawinigan',
    'Rimouski', 'Châteauguay', 'Victoriaville', 'Rouyn-Noranda', 'Salaberry-de-Valleyfield', 'Sorel-Tracy', 'Sept-Îles', 'Saint-Eustache', 'Mascouche', 'Boucherville',
  ],
  bc: [
    'Vancouver', 'Surrey', 'Burnaby', 'Richmond', 'Abbotsford', 'Coquitlam', 'Kelowna', 'Saanich', 'Delta', 'Langley',
    'Kamloops', 'Nanaimo', 'Victoria', 'Chilliwack', 'Maple Ridge', 'New Westminster', 'Prince George', 'North Vancouver', 'Vernon', 'Penticton',
    'Mission', 'Port Coquitlam', 'Campbell River', 'Courtenay', 'Cranbrook', 'Fort St. John', 'Williams Lake', 'Squamish',
  ],
  alberta: [
    'Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat', 'Grande Prairie', 'Airdrie', 'Spruce Grove', 'Leduc',
    'Okotoks', 'Cochrane', 'Fort McMurray', 'Camrose', 'Lloydminster', 'Sherwood Park', 'Beaumont', 'Stony Plain', 'Brooks', 'Wetaskiwin',
  ],
  atlantic: [
    'Halifax', 'Moncton', 'Saint John', 'Fredericton', 'Charlottetown', 'St. John\'s', 'Sydney', 'Truro', 'Dartmouth', 'Bathurst',
    'Dieppe', 'New Glasgow', 'Cape Breton', 'Mount Pearl', 'Summerside', 'Corner Brook',
  ],
  prairies: [
    'Winnipeg', 'Saskatoon', 'Regina', 'Brandon', 'Steinbach', 'Moose Jaw', 'Prince Albert', 'Swift Current', 'Yorkton', 'Estevan',
    'Portage la Prairie', 'North Battleford', 'Selkirk',
  ],
};

// Empire/Sobeys banner names by region — a store reads like "Sobeys Toronto", "FreshCo Surrey", etc.
// Banner selection is region-appropriate: IGA in Québec, Thrifty Foods + Safeway in the West,
// Safeway/FreshCo on the Prairies, Sobeys/Foodland/FreshCo elsewhere.
const REGION_BANNERS: Record<string, string[]> = {
  ontario: ['Sobeys', 'FreshCo', 'Foodland'],
  quebec: ['IGA', 'IGA extra', 'Rachelle-Béry'],
  bc: ['Safeway', 'Thrifty Foods', 'FreshCo'],
  alberta: ['Safeway', 'Sobeys', 'FreshCo'],
  atlantic: ['Sobeys', 'Foodland', 'Lawtons Drugs'],
  prairies: ['Safeway', 'Sobeys', 'FreshCo'],
};
// Retained for compatibility / optional flavour in store naming (family-run Foodland-style stores).
const FAMILY_NAMES = [
  'MacEwan', 'Sutherland', 'Blackwell', 'Galbraith', 'Whitlock', 'Pemberton', 'Crowley', 'Ashbury', 'Sinclair', 'Trembley',
  'Beaumont', 'Mercier', 'Tremblay', 'Lavoie', 'Gagné', 'Bouchard', 'Côté', 'Roy', 'Belanger', 'Simard',
  'Anderson', 'Walker', 'Mitchell', 'Reid', 'Stewart', 'Cameron', 'Ross', 'Robertson', 'Campbell', 'Murray',
  'Johansen', 'Patel', 'Nguyen', 'Singh', 'Khan', 'Chen', 'Wong', 'Lee', 'Tanaka', 'Ricci',
  'Hartley', 'Westwood', 'Northgate', 'Riverside', 'Lakeside', 'Crossroads', 'Highlands', 'Heritage', 'Maple', 'Pioneer',
  'Crown', 'Capital', 'Royal', 'Atlantic', 'Pacific', 'Northern', 'Mountain', 'Valley', 'Coastal', 'Central',
];

// Store-format distribution (weights unchanged — feeds visualizations)
const DEALER_TYPE_DIST: Array<[DealerType, number]> = [
  ['full-service', 0.06],
  ['urban-fresh', 0.32],
  ['community', 0.45],
  ['discount', 0.17],
];

const COMPLIANCE_DIST: Array<[ComplianceStatus, number]> = [
  ['compliant', 0.78],
  ['at-risk', 0.16],
  ['violation', 0.06],
];

// ===== Seeded PRNG (Mulberry32) — deterministic across reloads =====
function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(rng: () => number, dist: Array<[T, number]>): T {
  const r = rng();
  let acc = 0;
  for (const [val, weight] of dist) {
    acc += weight;
    if (r < acc) return val;
  }
  return dist[dist.length - 1][0];
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

// Used by molecular display + store-region selection
type MolecularRegion = 'ontario' | 'quebec' | 'bc' | 'alberta' | 'atlantic' | 'prairies';

// Per-region count for molecular display (splits Alberta into Alberta proper + Prairies)
const MOLECULAR_REGION_COUNTS: Record<MolecularRegion, number> = {
  ontario: 330,
  quebec: 180,
  bc: 150,
  alberta: 80,    // Alberta proper (split out from the original 120)
  prairies: 40,   // Prairies = Saskatchewan + Manitoba (the rest of the original 120)
  atlantic: 70,
};
// Total: 850, plus +40 spread to reach 890
const REGION_BONUS: Record<MolecularRegion, number> = {
  ontario: 16, quebec: 8, bc: 8, alberta: 4, prairies: 2, atlantic: 2,
};

// Map molecular region back to GeoId for filtering
const MOLECULAR_REGION_TO_GEO: Record<MolecularRegion, GeoId> = {
  ontario: 'ontario',
  quebec: 'quebec',
  bc: 'bc',
  alberta: 'alberta',
  prairies: 'alberta',  // Prairies stores attribute to alberta GeoId for data purposes
  atlantic: 'atlantic',
};

// ===== Store generation =====
let cachedDealers: Dealer[] | null = null;
let cachedDealersByRegion: Record<MolecularRegion, Dealer[]> | null = null;

function generateDealers(): { all: Dealer[]; byRegion: Record<MolecularRegion, Dealer[]> } {
  if (cachedDealers && cachedDealersByRegion) {
    return { all: cachedDealers, byRegion: cachedDealersByRegion };
  }

  const rng = mulberry32(20260508);
  const dealers: Dealer[] = [];
  const byRegion: Record<MolecularRegion, Dealer[]> = {
    ontario: [], quebec: [], bc: [], alberta: [], prairies: [], atlantic: [],
  };

  const regions: MolecularRegion[] = ['ontario', 'quebec', 'bc', 'alberta', 'prairies', 'atlantic'];

  for (const region of regions) {
    const count = MOLECULAR_REGION_COUNTS[region] + REGION_BONUS[region];
    const cityPool = CITIES[region];
    const bannerPool = REGION_BANNERS[region];
    const regionalShareDist: number[] = [];

    // First pass — generate stores + raw shares
    for (let i = 0; i < count; i++) {
      // NOTE: keep the exact same number of rng() draws (and order) as before so
      // the deterministic output is unchanged. We still draw a family-name and a
      // banner each iteration (banner replaces the old Ford suffix draw).
      const family = pick(rng, FAMILY_NAMES);
      void family; // draw retained to preserve the PRNG sequence; not used in grocery banner names
      const city = pick(rng, cityPool);
      const banner = pick(rng, bannerPool);
      const type = pickWeighted(rng, DEALER_TYPE_DIST);
      const compliance = pickWeighted(rng, COMPLIANCE_DIST);

      // Spend skews by store format — full-service flagships have ~3-5x community stores
      const baseSpend =
        type === 'full-service' ? 65000 + rng() * 35000 :
        type === 'urban-fresh' ? 28000 + rng() * 18000 :
        type === 'community' ? 14000 + rng() * 12000 :
        7000 + rng() * 6000;

      regionalShareDist.push(baseSpend);

      const id = `dealer-${region}-${String(i).padStart(3, '0')}`;
      // Store reads like a real grocery banner: "Sobeys Toronto", "IGA Laval", "FreshCo Surrey".
      const name = `${banner} ${city}`;

      const dealer: Dealer = {
        id, name, region: MOLECULAR_REGION_TO_GEO[region],
        city, type, complianceStatus: compliance,
        monthlySpend: Math.round(baseSpend),
        share: 0, // populated in second pass
      };
      dealers.push(dealer);
      byRegion[region].push(dealer);
    }

    // Second pass — normalize per-region shares so they sum to 1.0
    const regionTotal = regionalShareDist.reduce((s, v) => s + v, 0);
    const startIdx = dealers.length - count;
    for (let i = 0; i < count; i++) {
      dealers[startIdx + i].share = regionalShareDist[i] / regionTotal;
    }
  }

  cachedDealers = dealers;
  cachedDealersByRegion = byRegion;
  return { all: dealers, byRegion };
}

// ===== Public API =====
export function getAllDealers(): Dealer[] {
  return generateDealers().all;
}

export function getDealersByMolecularRegion(): Record<MolecularRegion, Dealer[]> {
  return generateDealers().byRegion;
}

export function getDealerById(id: string): Dealer | undefined {
  return generateDealers().all.find((d) => d.id === id);
}

export const MOLECULAR_REGIONS: MolecularRegion[] = ['ontario', 'quebec', 'bc', 'alberta', 'prairies', 'atlantic'];
export type { MolecularRegion };
