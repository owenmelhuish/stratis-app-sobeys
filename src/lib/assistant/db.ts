/**
 * Assistant data layer — multi-tenant "chat with data".
 *
 * Each enterprise ("client instance") has its own siloed dataset. We build a
 * separate in-memory SQLite DB per enterprise from `generateAllData(id)` — the
 * same seeded store the dashboard renders — and cache one DB per enterprise.
 *
 * The proof-point guarantee lives here: every number the assistant cites comes
 * from a real row returned by `runReadOnlySql`, scoped to the active client.
 */
import Database from "better-sqlite3";
import { generateAllData } from "@/lib/mock-data";
import { CHANNEL_LABELS, ENTERPRISES } from "@/types";
import type { EnterpriseId } from "@/types";

const dbCache = new Map<EnterpriseId, Database.Database>();

export const VALID_ENTERPRISES: EnterpriseId[] = ENTERPRISES.map((e) => e.id);

export function enterpriseName(id: EnterpriseId): string {
  return ENTERPRISES.find((e) => e.id === id)?.name ?? id;
}

const DAILY_COLUMNS: Array<[string, string]> = [
  ["date", "date"],
  ["spend", "spend"],
  ["impressions", "impressions"],
  ["reach", "reach"],
  ["clicks", "clicks"],
  ["landing_page_views", "landingPageViews"],
  ["leads", "leads"],
  ["conversions", "conversions"],
  ["revenue", "revenue"],
  ["video_views_3s", "videoViews3s"],
  ["video_views_thruplay", "videoViewsThruplay"],
  ["engagements", "engagements"],
  ["assisted_conversions", "assistedConversions"],
];

function buildDb(enterpriseId: EnterpriseId): Database.Database {
  const store = generateAllData(enterpriseId);
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE campaigns (
      id            TEXT PRIMARY KEY,
      name          TEXT,
      division      TEXT,   -- tier-1 | tier-2 | tier-3
      agency        TEXT,
      product_line  TEXT,
      objective     TEXT,   -- awareness | consideration | conversion
      status        TEXT,   -- live | paused | completed
      planned_budget REAL,
      start_date    TEXT,
      channels      TEXT,   -- comma-separated channel ids
      geos          TEXT,   -- comma-separated geo ids
      audiences     TEXT    -- comma-separated audience ids
    );

    CREATE TABLE daily_metrics (
      campaign_id          TEXT,
      channel              TEXT,
      date                 TEXT,   -- YYYY-MM-DD
      spend                REAL,
      impressions          REAL,
      reach                REAL,
      clicks               REAL,
      landing_page_views   REAL,
      leads                REAL,
      conversions          REAL,
      revenue              REAL,
      video_views_3s       REAL,
      video_views_thruplay REAL,
      engagements          REAL,
      assisted_conversions REAL
    );

    CREATE TABLE channels (
      id    TEXT PRIMARY KEY,
      label TEXT
    );

    CREATE INDEX idx_dm_campaign ON daily_metrics(campaign_id);
    CREATE INDEX idx_dm_channel  ON daily_metrics(channel);
    CREATE INDEX idx_dm_date     ON daily_metrics(date);
  `);

  const insertCampaign = db.prepare(`
    INSERT INTO campaigns (id, name, division, agency, product_line, objective, status, planned_budget, start_date, channels, geos, audiences)
    VALUES (@id, @name, @division, @agency, @product_line, @objective, @status, @planned_budget, @start_date, @channels, @geos, @audiences)
  `);
  for (const c of store.campaigns) {
    insertCampaign.run({
      id: c.id,
      name: c.name,
      division: c.division,
      agency: c.agency,
      product_line: c.productLine,
      objective: c.objective,
      status: c.status,
      planned_budget: c.plannedBudget,
      start_date: c.startDate,
      channels: c.channels.join(","),
      geos: c.geos.join(","),
      audiences: c.audiences.join(","),
    });
  }

  const cols = DAILY_COLUMNS.map(([sql]) => sql);
  const insertDaily = db.prepare(`
    INSERT INTO daily_metrics (campaign_id, channel, ${cols.join(", ")})
    VALUES (@campaign_id, @channel, ${cols.map((c) => "@" + c).join(", ")})
  `);
  const insertMany = db.transaction((rows: Record<string, unknown>[]) => {
    for (const r of rows) insertDaily.run(r);
  });

  const rows: Record<string, unknown>[] = [];
  for (const [campaignId, byChannel] of Object.entries(store.dailyData)) {
    for (const [channel, series] of Object.entries(byChannel)) {
      for (const day of series) {
        const row: Record<string, unknown> = { campaign_id: campaignId, channel };
        for (const [sqlCol, srcKey] of DAILY_COLUMNS) {
          row[sqlCol] = (day as unknown as Record<string, unknown>)[srcKey] ?? 0;
        }
        rows.push(row);
      }
    }
  }
  insertMany(rows);

  const insertChannel = db.prepare(`INSERT INTO channels (id, label) VALUES (?, ?)`);
  for (const [id, label] of Object.entries(CHANNEL_LABELS)) insertChannel.run(id, label);

  return db;
}

export function getDb(enterpriseId: EnterpriseId): Database.Database {
  let db = dbCache.get(enterpriseId);
  if (!db) {
    db = buildDb(enterpriseId);
    dbCache.set(enterpriseId, db);
  }
  return db;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/** Runs a single read-only SELECT against one enterprise's siloed DB. */
export function runReadOnlySql(sql: string, enterpriseId: EnterpriseId): QueryResult {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (/;/.test(trimmed)) throw new Error("Only a single statement is allowed (no semicolons).");
  if (!/^(select|with)\b/i.test(trimmed)) throw new Error("Only SELECT / WITH queries are allowed.");
  if (/\b(insert|update|delete|drop|alter|create|attach|pragma|replace)\b/i.test(trimmed)) {
    throw new Error("Write/DDL keywords are not allowed.");
  }

  const stmt = getDb(enterpriseId).prepare(trimmed);
  const rows = stmt.all() as Record<string, unknown>[];
  const capped = rows.slice(0, 1000);
  const columns = capped.length ? Object.keys(capped[0]) : stmt.columns().map((c: { name: string }) => c.name);
  return { columns, rows: capped, rowCount: rows.length };
}

/** Schema + semantics for the active client. Tables are identical per client;
 *  only the data differs, so we inject the client name and isolation note. */
export function schemaDocFor(enterpriseId: EnterpriseId): string {
  const name = enterpriseName(enterpriseId);
  return `
You are querying a SQLite database of ${name} marketing-campaign performance.
This database contains ONLY ${name}'s data — it is a siloed, single-tenant view.
The data spans ~180 days ending 2026-05-08, across up to 9 media channels.

TABLES

campaigns
  id            TEXT  -- e.g. 'sobeys-scene-summer-hero'
  name          TEXT  -- human label
  division      TEXT  -- 'tier-1' | 'tier-2' | 'tier-3'
  agency        TEXT
  product_line  TEXT  -- merchandising category id
  objective     TEXT  -- 'awareness' | 'consideration' | 'conversion'
  status        TEXT  -- 'live' | 'paused' | 'completed'
  planned_budget REAL
  start_date    TEXT  -- YYYY-MM-DD
  channels      TEXT  -- comma-separated channel ids on the campaign
  geos          TEXT  -- comma-separated geo ids ('national','bc','alberta','ontario','quebec','atlantic')
  audiences     TEXT  -- comma-separated audience ids

daily_metrics  (one row per campaign × channel × day)
  campaign_id          TEXT  -- FK -> campaigns.id
  channel              TEXT  -- 'google-search','facebook','instagram','tiktok','ttd','ctv','spotify','linkedin','ooh'
  date                 TEXT  -- YYYY-MM-DD
  spend, impressions, reach, clicks, landing_page_views, leads,
  conversions, revenue, video_views_3s, video_views_thruplay,
  engagements, assisted_conversions   -- all REAL

channels
  id    TEXT  -- channel id
  label TEXT  -- pretty label, e.g. 'Google Search', 'The Trade Desk'

DERIVED METRICS — compute these in SQL from the raw columns (never invent them):
  ROAS  = SUM(revenue) / NULLIF(SUM(spend),0)
  CPL   = SUM(spend)   / NULLIF(SUM(leads),0)
  CPA   = SUM(spend)   / NULLIF(SUM(conversions),0)
  CPC   = SUM(spend)   / NULLIF(SUM(clicks),0)
  CPM   = 1000 * SUM(spend) / NULLIF(SUM(impressions),0)
  CTR   = SUM(clicks)  / NULLIF(SUM(impressions),0)        -- multiply by 100 for %
  CVR   = SUM(conversions) / NULLIF(SUM(clicks),0)

NOTES
- Always aggregate (SUM) raw columns first, then divide — never average per-row ratios.
- "this week" / "recent" = the last 7 dates in the data (max date is 2026-05-08).
- Join daily_metrics to campaigns on daily_metrics.campaign_id = campaigns.id.
- channel and division values use hyphens exactly as listed above.
- Every figure you cite must come from a query against ${name}'s data above.
`.trim();
}
