// ===========================================================================
// Shared scaffolding for per-client data modules.
//
// Each cross-industry client (RBC, Molson Coors, lululemon, Tim Hortons) lives
// in its own module exporting campaign defs, insights, and news. They are
// spread into the master arrays in mock-data.ts. This file holds the pieces
// those modules need WITHOUT importing mock-data.ts (which would be circular).
// ===========================================================================
import { subDays, format } from 'date-fns';
import type {
  EnterpriseId, DivisionId, AgencyId, ProductLineId, AudienceId,
  CampaignObjective, CampaignStatus, ChannelId, GeoId,
} from '@/types';

// Mirrors END_DATE in mock-data.ts — the synthetic "today" the demo is anchored to.
export const END_DATE = new Date('2026-05-08');

/** ISO timestamp for "today" (insight createdAt at the top of the feed). */
export const todayISO = format(END_DATE, 'yyyy-MM-dd') + 'T07:00:00Z';

/** ISO timestamp `daysAgo` before END_DATE at the given HH:MM:SS. */
export const at = (daysAgo: number, hhmmss: string): string =>
  format(subDays(END_DATE, daysAgo), 'yyyy-MM-dd') + 'T' + hhmmss + 'Z';

// Campaign definition consumed by the synthetic daily-data generator.
// Kept structurally identical to the Ford-family defs in mock-data.ts.
export interface CampaignDef {
  id: string; name: string; enterprise: EnterpriseId;
  division: DivisionId; agency: AgencyId;
  productLine: ProductLineId; audiences: AudienceId[];
  objective: CampaignObjective; status: CampaignStatus;
  channels: ChannelId[]; geos: GeoId[]; budgetMultiplier: number;
  plannedBudget: number;
  revPerConvRange: [number, number];
  cvrModifier: number;
  cplCalibration: number;
  revTrend: number;
}
