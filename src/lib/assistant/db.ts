/**
 * Assistant data layer — "chat with data" prototype.
 *
 * Builds an in-memory SQLite database from the same `generateAllData()` store
 * the dashboard renders, then exposes a read-only query runner. Because the
 * mock data is produced by a seeded PRNG it is deterministic, so the DB is
 * built once per server process and cached.
 *
 * The proof-point guarantee lives here: every number the assistant cites comes
 * from a real row returned by `runReadOnlySql`, not from the model.
 */
import Database from "better-sqlite3";
import { generateAllData } from "@/lib/mock-data";
import { CHANNEL_LABELS } from "@/types";
import type { EnterpriseId } from "@/types";

let cached: Database.Database | null = null;

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

function buildDb(enterpriseId: EnterpriseId = "ford-canada"): Database.Database {
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
      channel              TEXT,   -- google-search | facebook | instagram | tiktok | ttd | ctv | spotify | linkedin | ooh
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
          row[sqlCol] = (day as Record<string, unknown>)[srcKey] ?? 0;
        }
        rows.push(row);
      }
    }
  }
  insertMany(rows);

  const insertChannel = db.prepare(`INSERT INTO channels (id, label) VALUES (?, ?)`);
  for (const [id, label] of Object.entries(CHANNEL_LABELS)) {
    insertChannel.run(id, label);
  }

  return db;
}

export function getDb(): Database.Database {
  if (!cached) cached = buildDb();
  return cached;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
}

/** Runs a single read-only SELECT. Rejects anything that could mutate state. */
export function runReadOnlySql(sql: string): QueryResult {
  const trimmed = sql.trim().replace(/;+\s*$/, "");
  if (/;/.test(trimmed)) {
    throw new Error("Only a single statement is allowed (no semicolons).");
  }
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error("Only SELECT / WITH queries are allowed.");
  }
  if (/\b(insert|update|delete|drop|alter|create|attach|pragma|replace)\b/i.test(trimmed)) {
    throw new Error("Write/DDL keywords are not allowed.");
  }

  const stmt = getDb().prepare(trimmed);
  // cap result size so a runaway query can't blow up the response
  const rows = stmt.all() as Record<string, unknown>[];
  const capped = rows.slice(0, 1000);
  const columns = capped.length ? Object.keys(capped[0]) : stmt.columns().map((c) => c.name);
  return { columns, rows: capped, rowCount: rows.length };
}

/** Schema + semantics handed to the model so it can author correct SQL. */
export const SCHEMA_DOC = `
You are querying a SQLite database of Ford Canada marketing-campaign performance.
The data spans ~180 days ending 2026-05-08, across 9 media channels.

TABLES

campaigns
  id            TEXT  -- e.g. 'ford-lightning-launch-hero'
  name          TEXT  -- human label, e.g. 'F-150 Lightning Launch — National Hero'
  division      TEXT  -- 'tier-1' | 'tier-2' | 'tier-3'
  agency        TEXT
  product_line  TEXT  -- e.g. 'lightning','f150','mach-e','bronco','explorer'
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
  spend                REAL
  impressions          REAL
  reach                REAL
  clicks               REAL
  landing_page_views   REAL
  leads                REAL
  conversions          REAL
  revenue              REAL
  video_views_3s       REAL
  video_views_thruplay REAL
  engagements          REAL
  assisted_conversions REAL

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
  LPV rate = SUM(landing_page_views) / NULLIF(SUM(clicks),0)

NOTES
- Always aggregate (SUM) raw columns first, then divide — never average per-row ratios.
- "this week" / "recent" = the last 7 dates in the data (max date is 2026-05-08).
- Join daily_metrics to campaigns on daily_metrics.campaign_id = campaigns.id.
- channel and division values use hyphens exactly as listed above.
`.trim();
