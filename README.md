# STRATIS — Sobeys

Intelligence orchestration layer for the Empire / Sobeys multi-banner marketing ecosystem. Built to give Sobeys' CMO a single unified view across the banner portfolio and the three marketing tiers — National (Tier 1), Regional (Tier 2), and Store & Local (Tier 3) — without requiring teams or agencies to adopt anything new.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the Cross-Banner Intelligence Dashboard.

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **Tailwind CSS** + **shadcn/ui** for components
- **Recharts** + **react-simple-maps** for data visualization
- **Zustand** for state management
- **Deterministic mock data** — seeded PRNG generating 180 days of time series across ~22 flagship campaigns, 6 regions (provinces), 9 channels, 3 tiers

## Pages

| Route | Description |
|-------|-------------|
| `/dashboard` | Cross-Banner Intelligence Dashboard with Brand / Region / Campaign drill-down views |
| `/news` | STRATIS Radar — aggregated feed: competitor (Loblaw, No Frills, Metro, Walmart, Costco, Save-On-Foods), food-inflation macro, loyalty/Scene+, own-brand, sponsorship signals |
| `/insights` | STRATIS Signals — AI-derived insights with human-in-the-loop approval workflow |
| `/assistant` | STRATIS Assistant — chat-with-data (text-to-SQL + charts), scoped per banner |
| `/launch-campaign` | Launch Campaign briefing flow |
| `/creative-studio` | Creative Studio (coming soon) |
| `/simulation` | Simulation Sandbox (coming soon) |
| `/select` | Multi-banner selector + 3D brand-portfolio molecular view |

## Demo Script — Sobeys CMO Flow

1. **Open: Cross-Banner Intelligence Dashboard.** The CMO sees, for the first time, a single unified view across every banner and tier. Hero numbers are ROAS-led: blended ROAS vs the 2.8x–4.0x target band, attributed sales, transactions.

2. **Move to STRATIS Signals (Insights).** The pinned signals tell the story:
   - **Regional ROAS gap** — Ontario regional marketing is the portfolio's lowest ROAS (~2.4x) while the West beats the national benchmark (~4.1x) on the same budget; the West playbook has reached only one other region.
   - **Portfolio frequency / Scene+ overexposure** — signals only visible by deduping across every banner and campaign at once.
   - **No Frills "Hauler Hotline" response** — STRATIS reacts to a live competitive value event with a measured, surgical counter.

3. **Land on the regional benchmark.** West vs Ontario: same budget, very different ROAS.

4. **Live event — No Frills "Hauler Hotline" price event.** Pinned STRATIS Radar item + linked signal recommending a targeted Scene+ / key-value-item flyer defense (not a blanket price war).

## Key Concepts

- **Banner portfolio:** Sobeys (flagship), Farm Boy, Longo's (+ Grocery Gateway), Safeway (West), IGA (Québec), FreshCo (discount), Foodland (community).
- **Three-tier marketing:** Tier 1 National (FCB / UM AOR), Tier 2 Regional (Atlantic / Québec / Ontario / West), Tier 3 Store & Local.
- **Categories** (not nameplates): Scene+ Loyalty, Weekly Flyer, Compliments Own Brands, Seasonal & BBQ, Meat & Seafood, Voilà E-Commerce, Pharmacy & Wellness, Centre-Store.
- **ROAS as primary KPI** (higher is better). Scene+ / email sign-ups are the secondary acquisition metric ("Sign-Ups" / "Cost per Sign-Up").
- **Scene+** loyalty (with Scotiabank + Cineplex), **Voilà** e-commerce, **Empire Media+** retail media, **Compliments / Panache** own brands.
- **Conquest audiences** for No Frills, Loblaws, Walmart, Costco.

## Mock Data

All data is generated deterministically from a seeded PRNG (seed: 42). No external APIs. The generator produces:

- ~22 flagship campaigns across 3 tiers, 7 marketing partners, 8 categories, 6 provinces/regions
- 180 days of daily metrics per campaign per channel, ending 2026-05-08
- Province-level spend allocation for the Canada choropleth map
- Channel-specific distributions tuned to land specific ROAS targets
- News items with pinned heroes (No Frills price event, food-inflation/private-label, Loblaw retail-media)
- 50+ insights with hand-authored heroes (regional ROAS gap, frequency, competitive response)
