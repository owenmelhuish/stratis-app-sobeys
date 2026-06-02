// ===========================================================================
// Brand-select molecular graph (agency → brands → campaigns)
//
// Mirrors the data-filter molecular graph (src/lib/molecular-graph.ts): nodes
// are distributed on TRUE 3D Fibonacci spheres per ring, and bonds connect each
// parent to its children. Here the hierarchy is the agency's portfolio:
//   Ring 0 — STRATIS nucleus (the agency)
//   Ring 1 — the brands / clients the agency services
//   Ring 2 — the campaigns that link to each brand (its sub-components)
// Campaigns are laid out in contiguous Fibonacci bands per brand, so each
// brand's campaigns cluster together while still living on the 3D sphere.
// ===========================================================================
import { ENTERPRISES, PRODUCT_LINE_LABELS, divisionLabel, type EnterpriseId } from '@/types';
import { generateAllData } from '@/lib/mock-data';

// Brand atom colors (hex for Three.js). Distinct hue per client.
export const BRAND_COLORS: Record<EnterpriseId, string> = {
  'ford-canada': '#3B82F6',
  'lincoln': '#F59E0B',
  'dealership-network': '#10B981',
  'rbc': '#6366F1',
  'molson-coors': '#F97316',
  'lululemon': '#EC4899',
  'tim-hortons': '#EF4444',
};

export const NUCLEUS_COLOR = '#FF7A1A'; // STRATIS orange

// Ring radii (sphere shells). Ring guides are drawn at these radii.
export const BRAND_RING_RADII = [0, 9, 17];
const RING_VIZ_RADIUS = [2.5, 1.35, 0.62];

export type BrandNodeKind = 'nucleus' | 'brand' | 'campaign';

export interface BrandNode {
  id: string;                 // 'stratis' | `brand:<entId>` | `camp:<campId>`
  kind: BrandNodeKind;
  label: string;              // full name (used in the hover tooltip)
  shortLabel: string;         // concise label rendered on the atom at all times
  ring: number;               // 0 | 1 | 2
  angle: number;              // used only to vary the per-node drift phase
  color: string;
  vizRadius: number;
  enterpriseId?: EnterpriseId; // brand + campaign nodes
  campaignId?: string;         // campaign nodes
  sublabel?: string;           // industry (brand) | "Product · Tier" (campaign)
}

// Concise on-atom label so all 70+ campaign titles stay legible at rest.
// Front-truncate so the identifying lead (product/brand) is always kept; the
// full title remains in the hover tooltip.
function shorten(name: string, max = 26): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1).replace(/[\s—–-]+$/, '') + '…';
}

export interface BrandBond { source: string; target: string; }

// ----- Fibonacci sphere (oblate), identical feel to the data-filter graph -----
function fibonacciSphere(numPoints: number, radius: number): [number, number, number][] {
  if (numPoints <= 0) return [];
  if (numPoints === 1) return [[0, radius * 0.0, 0]];
  const points: [number, number, number][] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < numPoints; i++) {
    const y = 1 - (i / (numPoints - 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    points.push([
      radius * radiusAtY * Math.cos(theta),
      radius * y * 0.7, // oblate spheroid — same as data filter
      radius * radiusAtY * Math.sin(theta),
    ]);
  }
  return points;
}

interface BrandGraph {
  nodes: BrandNode[];
  bonds: BrandBond[];
  positions: Map<string, [number, number, number]>;
  nodeMap: Map<string, BrandNode>;
  childrenMap: Map<string, Set<string>>;
  parentsMap: Map<string, Set<string>>;
}

let _cached: BrandGraph | null = null;

export function getBrandGraph(): BrandGraph {
  if (_cached) return _cached;

  const nodes: BrandNode[] = [];
  const bonds: BrandBond[] = [];
  const positions = new Map<string, [number, number, number]>();

  // Ring 0 — nucleus
  nodes.push({
    id: 'stratis', kind: 'nucleus', label: 'STRATIS', shortLabel: 'STRATIS', ring: 0, angle: 0,
    color: NUCLEUS_COLOR, vizRadius: RING_VIZ_RADIUS[0],
  });
  positions.set('stratis', [0, 0, 0]);

  // Ring 1 — brands (one Fibonacci sphere across all clients)
  const brandPositions = fibonacciSphere(ENTERPRISES.length, BRAND_RING_RADII[1]);
  ENTERPRISES.forEach((ent, i) => {
    const id = `brand:${ent.id}`;
    nodes.push({
      id, kind: 'brand', label: ent.name, shortLabel: ent.name, ring: 1,
      angle: (360 / ENTERPRISES.length) * i,
      color: BRAND_COLORS[ent.id], vizRadius: RING_VIZ_RADIUS[1],
      enterpriseId: ent.id, sublabel: ent.industry,
    });
    positions.set(id, brandPositions[i]);
    bonds.push({ source: 'stratis', target: id });
  });

  // Ring 2 — campaigns, laid out in contiguous Fibonacci bands per brand so each
  // brand's sub-components cluster together on the outer sphere.
  const perBrandCampaigns: { ent: EnterpriseId; camps: { id: string; name: string; sublabel: string }[] }[] =
    ENTERPRISES.map((ent) => {
      const store = generateAllData(ent.id);
      const camps = store.campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        sublabel: `${PRODUCT_LINE_LABELS[c.productLine] ?? c.productLine} · ${divisionLabel(c.division, ent.id)}`,
      }));
      return { ent: ent.id, camps };
    });

  const totalCampaigns = perBrandCampaigns.reduce((n, b) => n + b.camps.length, 0);
  const campPositions = fibonacciSphere(totalCampaigns, BRAND_RING_RADII[2]);

  let cursor = 0;
  let angleSeed = 0;
  for (const { ent, camps } of perBrandCampaigns) {
    const brandId = `brand:${ent}`;
    for (const c of camps) {
      const id = `camp:${c.id}`;
      nodes.push({
        id, kind: 'campaign', label: c.name, shortLabel: shorten(c.name), ring: 2,
        angle: (angleSeed * 23) % 360,
        color: BRAND_COLORS[ent], vizRadius: RING_VIZ_RADIUS[2],
        enterpriseId: ent, campaignId: c.id, sublabel: c.sublabel,
      });
      positions.set(id, campPositions[cursor]);
      bonds.push({ source: brandId, target: id });
      cursor += 1;
      angleSeed += 1;
    }
  }

  // Adjacency maps
  const nodeMap = new Map<string, BrandNode>();
  for (const n of nodes) nodeMap.set(n.id, n);
  const childrenMap = new Map<string, Set<string>>();
  const parentsMap = new Map<string, Set<string>>();
  for (const b of bonds) {
    if (!childrenMap.has(b.source)) childrenMap.set(b.source, new Set());
    if (!parentsMap.has(b.target)) parentsMap.set(b.target, new Set());
    childrenMap.get(b.source)!.add(b.target);
    parentsMap.get(b.target)!.add(b.source);
  }

  _cached = { nodes, bonds, positions, nodeMap, childrenMap, parentsMap };
  return _cached;
}

export function getBrandBasePosition(id: string): [number, number, number] {
  return getBrandGraph().positions.get(id) ?? [0, 0, 0];
}

export function bondKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Lineage for a hovered/selected node:
//  - brand   → the brand, its campaigns, the nucleus, and all connecting bonds
//  - campaign→ the campaign, its parent brand, the nucleus, and connecting bonds
export function traceBrandLineage(focusId: string | null): { litNodes: Set<string>; litBonds: Set<string> } {
  const litNodes = new Set<string>();
  const litBonds = new Set<string>();
  if (!focusId) return { litNodes, litBonds };

  const { nodeMap, childrenMap, parentsMap } = getBrandGraph();
  const node = nodeMap.get(focusId);
  if (!node) return { litNodes, litBonds };

  litNodes.add(focusId);

  if (node.kind === 'brand') {
    litNodes.add('stratis');
    litBonds.add(bondKey('stratis', focusId));
    for (const child of childrenMap.get(focusId) ?? []) {
      litNodes.add(child);
      litBonds.add(bondKey(focusId, child));
    }
  } else if (node.kind === 'campaign') {
    for (const parent of parentsMap.get(focusId) ?? []) {
      litNodes.add(parent);
      litBonds.add(bondKey(parent, focusId));
      // also light the nucleus → brand bond above it
      litNodes.add('stratis');
      litBonds.add(bondKey('stratis', parent));
    }
  } else {
    // nucleus → light every brand
    for (const child of childrenMap.get('stratis') ?? []) {
      litNodes.add(child);
      litBonds.add(bondKey('stratis', child));
    }
  }

  return { litNodes, litBonds };
}
