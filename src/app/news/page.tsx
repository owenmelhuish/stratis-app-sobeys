"use client";
import React, { useState, useMemo, useEffect } from 'react';
import { generateAllData } from '@/lib/mock-data';
import { useAppStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, X, Sparkles, AlertTriangle, TrendingUp, Shield, Target, ArrowRight, ExternalLink, Bookmark, Share2 } from 'lucide-react';
import { type NewsItem, type NewsTag } from '@/types';
import { cn } from '@/lib/utils';

// ─── Section definitions ────────────────────────────────────────────────────

interface FeedSection {
  id: string;
  title: string;
  sources: string[];
  filterFn: (item: { tags: NewsTag[]; competitor?: string }) => boolean;
}

// Section order matters: items go to first matching section (dedupe via used.add).
// Sobeys-first display: Loyalty/Scene+ and Value/Inflation lead; competitor watches
// sit at the bottom (Loblaw / No Frills first). Every non-competitor section excludes
// competitor-tagged items, so competitor stories always fall through to their own
// watch at the end.
const FEED_SECTIONS: FeedSection[] = [
  {
    id: "loyalty",
    title: "Loyalty & Scene+",
    sources: ["Canadian Grocer", "Strategy Online", "The Message", "Marketing Magazine"],
    filterFn: (item) =>
      item.tags.includes("loyalty") &&
      !(item as { competitor?: string }).competitor &&
      !item.tags.includes("partnerships"),
  },
  {
    id: "value",
    title: "Value & Affordability / Inflation",
    sources: ["Statistics Canada", "Financial Post", "CBC", "Globe and Mail"],
    filterFn: (item) =>
      item.tags.includes("value") &&
      !(item as { competitor?: string }).competitor,
  },
  {
    id: "launch",
    title: "Own Brands & Product Launches (Compliments / Panache)",
    sources: ["Canadian Grocer", "Strategy Online", "Retail Insider", "The Message"],
    filterFn: (item) =>
      item.tags.includes("launch") &&
      !(item as { competitor?: string }).competitor &&
      !item.tags.includes("partnerships"),
  },
  {
    id: "partnerships",
    title: "Voilà, Retail Media & Strategic Partnerships",
    sources: ["Canadian Grocer", "Retail Insider", "Strategy Online", "Globe and Mail"],
    filterFn: (item) =>
      item.tags.includes("partnerships") &&
      !(item as { competitor?: string }).competitor,
  },
  {
    id: "sports",
    title: "Sports, Events & Sponsorships",
    sources: ["The Message", "Strategy Online", "Marketing Magazine", "Sportsnet"],
    filterFn: (item) =>
      (item.tags.includes("sports") || item.tags.includes("sponsorships")) &&
      !item.tags.includes("partnerships") &&
      !(item as { competitor?: string }).competitor,
  },
  {
    id: "brand",
    title: "Brand & Corporate Narrative",
    sources: ["Canadian Grocer", "Strategy Online", "Marketing Magazine", "Globe and Mail"],
    filterFn: (item) =>
      item.tags.includes("brand") &&
      !(item as { competitor?: string }).competitor &&
      !item.tags.includes("partnerships"),
  },
  {
    id: "social",
    title: "Social & Cultural Signals",
    sources: ["Reddit r/loblawsisoutofcontrol", "TikTok #GroceryHaul", "Reddit r/PersonalFinanceCanada", "TikTok"],
    filterFn: (item) =>
      item.tags.includes("social") &&
      !(item as { competitor?: string }).competitor,
  },
  {
    id: "grocery",
    title: "Grocery Industry & Market Data",
    sources: ["Canadian Grocer", "Retail Insider", "Financial Post", "BNN Bloomberg"],
    filterFn: (item) =>
      item.tags.includes("grocery") &&
      !(item as { competitor?: string }).competitor,
  },
  {
    id: "macro",
    title: "Macro Consumer & Economic Environment",
    sources: ["Statistics Canada", "Bank of Canada", "Globe and Mail", "BNN Bloomberg"],
    filterFn: (item) =>
      item.tags.includes("macro") &&
      !(item as { competitor?: string }).competitor,
  },
  // ── Competitor watches (moved to the bottom; Loblaw / No Frills first) ──
  {
    id: "loblaw",
    title: "Loblaw Watch — Loblaws, RCSS, Shoppers, PC Optimum, Loblaw Advance",
    sources: ["Canadian Grocer", "Financial Post", "Retail Insider", "Globe and Mail"],
    filterFn: (item) => (item as { competitor?: string }).competitor === "Loblaw",
  },
  {
    id: "no-frills",
    title: "No Frills Watch — Hauler Value Events & Discount Pricing",
    sources: ["Canadian Grocer", "Strategy Online", "Reddit r/loblawsisoutofcontrol", "CBC"],
    filterFn: (item) => (item as { competitor?: string }).competitor === "No Frills",
  },
  {
    id: "metro",
    title: "Metro Watch — Food Basics, Super C, Moi Loyalty",
    sources: ["Canadian Grocer", "Financial Post", "Retail Insider", "Globe and Mail"],
    filterFn: (item) => (item as { competitor?: string }).competitor === "Metro",
  },
  {
    id: "walmart",
    title: "Walmart Canada Watch — Price Leadership & Supercentres",
    sources: ["Retail Insider", "Canadian Grocer", "Financial Post", "BNN Bloomberg"],
    filterFn: (item) => (item as { competitor?: string }).competitor === "Walmart",
  },
  {
    id: "costco",
    title: "Costco Watch — Kirkland, Membership & Bulk Value",
    sources: ["Retail Insider", "Financial Post", "Canadian Grocer", "BNN Bloomberg"],
    filterFn: (item) => (item as { competitor?: string }).competitor === "Costco",
  },
  {
    id: "save-on-foods",
    title: "Save-On-Foods Watch — Pattison / Western Grocery & More Rewards",
    sources: ["Retail Insider", "Canadian Grocer", "BNN Bloomberg", "Globe and Mail"],
    filterFn: (item) => (item as { competitor?: string }).competitor === "Save-On-Foods",
  },
];

// ─── Article image picker (reliable generic grocery Unsplash photos) ──────────
//
// A small, deliberately conservative set of well-known, search-stable Unsplash
// food / grocery / retail photo IDs, reused across article types. Using a tight
// reliable set (rather than many guessed IDs) keeps the layout intact — every
// article resolves to a real image that depicts a sensible grocery subject.

const PHOTOS = {
  // Produce / fresh
  produce:        "photo-1542838132-92c53300491e",   // colorful produce market stall
  produceBasket:  "photo-1488459716781-31db52582fe9", // basket of fresh fruit & veg
  // Grocery store / aisle
  groceryAisle:   "photo-1534723452862-4c874018d66d", // grocery store aisle
  storeShelves:   "photo-1578916171728-46686eac8d58", // stocked supermarket shelves
  // Shopping cart / basket
  shoppingCart:   "photo-1604719312566-8912e9227c6a", // shopping cart in supermarket
  groceryBags:    "photo-1543168256-418811576931",    // full paper grocery bags
  // Meat & seafood
  meatCounter:    "photo-1607623814075-e51df1bdc82f", // raw meat / butcher counter
  // Bakery
  bakery:         "photo-1509440159596-0249088772ff", // fresh bread / bakery
  // Loyalty / payment / card
  payment:        "photo-1556742049-0cfed4f6a45d",    // card payment at checkout
  // E-commerce / delivery
  delivery:       "photo-1586528116311-ad8dd3c8310d", // grocery delivery / packing
  // Corporate / business
  office:         "photo-1497366811353-6870744d04b2", // modern office workspace
  // Financial / macro
  financialChart: "photo-1611974789855-9c2a0a7236a3", // candlestick chart red/green
  receipt:        "photo-1554224155-8d04cb21cd6c",    // receipt / calculator (cost)
  // Sports / awards
  trophy:         "photo-1578269174936-2709b6aeb913", // golden trophy
  stadium:        "photo-1522778119026-d647f0596c20", // stadium with crowd
  // Social / phone
  phone:          "photo-1611162617474-5b21e879e113", // person scrolling phone
  // Local / farm
  farm:           "photo-1500076656116-558758c991c1", // farm field / local produce
} as const;

function unsplashUrl(photoId: string, w: number, h: number): string {
  const base = photoId.startsWith("premium_photo-")
    ? "https://plus.unsplash.com/"
    : "https://images.unsplash.com/";
  return `${base}${photoId}?w=${w}&h=${h}&fit=crop&auto=format&q=70`;
}

// Map an article to a grocery photo. Order matters — most-specific patterns first.
function pickArticlePhoto(item: NewsItem): string {
  const title = item.title;
  const c = item.competitor;

  // ═══ Competitor watches ═══
  // Event-type matches run before generic banner matches.
  if (c) {
    if (/Earnings|Quarterly Results|Q[1-4]|Revenue|Profit|Sales Up|Comparable Sales/i.test(title)) return PHOTOS.financialChart;
    if (/Price|Pricing|Discount|Hauler|Rollback|Value Event|Affordab/i.test(title)) return PHOTOS.receipt;
    if (/Loyalty|PC Optimum|Moi|More Rewards|Points/i.test(title)) return PHOTOS.payment;
    if (/E-?Commerce|Online|Delivery|Pickup|Fulfilment/i.test(title)) return PHOTOS.delivery;
    if (/Own Brand|Private Label|Kirkland|No Name/i.test(title)) return PHOTOS.storeShelves;
    if (/Reddit|TikTok|Social|Boycott|Viral/i.test(title)) return PHOTOS.phone;
    if (/Store|Supercentre|Format|Opening|Renovation/i.test(title)) return PHOTOS.groceryAisle;
    return PHOTOS.storeShelves;
  }

  // ═══ Loyalty / Scene+ ═══
  if (/Scene\+|Loyalty|Points|Rewards|Personaliz|First-Party|Empire Media/i.test(title)) {
    if (/Reddit|TikTok|Social/i.test(title)) return PHOTOS.phone;
    return PHOTOS.payment;
  }

  // ═══ Voilà / e-commerce / delivery ═══
  if (/Voilà|Voila|E-?Commerce|Online Grocery|Delivery|Pickup|Ocado|Fulfilment/i.test(title)) {
    return PHOTOS.delivery;
  }

  // ═══ Own brands / launches ═══
  if (/Compliments|Panache|Own Brand|Private Label|Sensations|New Line|Launch|Range/i.test(title)) {
    return PHOTOS.storeShelves;
  }

  // ═══ Value / inflation / affordability ═══
  if (/Inflation|Food Price|Affordab|Value|Rollback|Price Freeze|Cost of (Living|Groceries)|Basket/i.test(title)) {
    return PHOTOS.receipt;
  }

  // ═══ Fresh / local / Buy Canadian ═══
  if (/Buy Canadian|Local|Ontario-?Grown|Fresh|Produce|Farm|Harvest/i.test(title)) {
    return PHOTOS.produce;
  }

  // ═══ Meat & seafood ═══
  if (/Meat|Seafood|Butcher|Boucherie|Protein/i.test(title)) {
    return PHOTOS.meatCounter;
  }

  // ═══ Bakery ═══
  if (/Bakery|Bread|Boulangerie|Baked/i.test(title)) {
    return PHOTOS.bakery;
  }

  // ═══ Seasonal ═══
  if (/Thanksgiving|Holiday|Christmas|BBQ|Grilling|Back-?to-?School|Summer|Seasonal/i.test(title)) {
    return PHOTOS.groceryBags;
  }

  // ═══ Retail media / partnerships ═══
  if (/Retail Media|Empire Media|Loblaw Advance|Media Network|Ad Network|Partnership|Alliance|Scotiabank|Cineplex/i.test(title)) {
    return PHOTOS.payment;
  }

  // ═══ Macro / financial ═══
  if (/Bank of Canada|Rate|Statistics Canada|StatsCan|GDP|Wages|Unemployment|Economic|Spending/i.test(title)) {
    return PHOTOS.financialChart;
  }

  // ═══ Sports / sponsorship ═══
  if (/Stadium|Game.?Day|Hockey|NHL|CFL|Football|Olympic/i.test(title)) {
    return PHOTOS.stadium;
  }
  if (/Award|Wins|Best|Recogniz|Sponsorship/i.test(title)) {
    return PHOTOS.trophy;
  }

  // ═══ Social ═══
  if (/Reddit|TikTok|#GroceryHaul|loblawsisoutofcontrol|Boycott|Viral|Sentiment|Megathread/i.test(title)) {
    return PHOTOS.phone;
  }

  // ═══ Brand / corporate ═══
  if (/CEO|Empire|Sobeys|Corporate|Earnings|Quarterly|Masterbrand|So Canadian/i.test(title)) {
    return PHOTOS.office;
  }

  // ═══ Fallback by primary tag ═══
  const tag = item.tags[0];
  if (tag === "loyalty") return PHOTOS.payment;
  if (tag === "value") return PHOTOS.receipt;
  if (tag === "launch") return PHOTOS.storeShelves;
  if (tag === "partnerships") return PHOTOS.payment;
  if (tag === "sports" || tag === "sponsorships") return PHOTOS.stadium;
  if (tag === "macro") return PHOTOS.financialChart;
  if (tag === "social") return PHOTOS.phone;
  if (tag === "grocery") return PHOTOS.groceryAisle;
  if (tag === "brand") return PHOTOS.office;
  if (tag === "competitors") return PHOTOS.storeShelves;

  return PHOTOS.produce; // ultimate fallback — neutral fresh-produce shot
}

// Relevance-ranked candidate photos for an article. [0] is the best match (same
// as pickArticlePhoto); the rest are progressively-broader still-relevant options
// followed by a variety tail spanning the whole library — so the render-time
// de-dupe can fall back to the next-most-relevant photo when the best one is
// already used by another article in the feed.
function candidatePhotos(item: NewsItem): string[] {
  const P = PHOTOS;
  const t = item.title;
  const out: string[] = [pickArticlePhoto(item)];
  const add = (...ids: string[]) => out.push(...ids);

  if (/Award|Wins|Best|Recogniz|Sponsorship/i.test(t)) add(P.trophy);
  if (/Loyalty|Scene\+|Points|Rewards|PC Optimum|Moi|More Rewards|Personaliz/i.test(t)) add(P.payment);
  if (/Voilà|Voila|E-?Commerce|Online|Delivery|Pickup|Ocado|Fulfilment/i.test(t)) add(P.delivery);
  if (/Own Brand|Private Label|Compliments|Panache|Kirkland|No Name|Launch|Range/i.test(t)) add(P.storeShelves, P.groceryAisle);
  if (/Inflation|Price|Affordab|Value|Rollback|Cost|Basket|Hauler/i.test(t)) add(P.receipt, P.financialChart);
  if (/Buy Canadian|Local|Fresh|Produce|Farm|Harvest|Organic/i.test(t)) add(P.produce, P.produceBasket, P.farm);
  if (/Meat|Seafood|Butcher|Boucherie|Protein/i.test(t)) add(P.meatCounter);
  if (/Bakery|Bread|Boulangerie|Baked/i.test(t)) add(P.bakery);
  if (/Thanksgiving|Holiday|Christmas|BBQ|Grilling|Back-?to-?School|Summer|Seasonal/i.test(t)) add(P.groceryBags, P.shoppingCart);
  if (/Reddit|TikTok|#GroceryHaul|Boycott|Viral|Sentiment|Megathread|Social/i.test(t)) add(P.phone, P.office);
  if (/Stadium|Game.?Day|Hockey|NHL|CFL|Football|Olympic/i.test(t)) add(P.stadium);
  if (/Earnings|Revenue|Rate|Bank of Canada|Statistics Canada|StatsCan|GDP|Financial|Comparable Sales/i.test(t)) add(P.financialChart);
  if (/Store|Supercentre|Aisle|Format|Opening|Shelf|Centre-Store/i.test(t)) add(P.groceryAisle, P.storeShelves);
  if (/CEO|Empire|Sobeys|Corporate|Masterbrand|So Canadian/i.test(t)) add(P.office);

  // variety tail — broad coverage so the list spans the whole photo library
  add(P.produce, P.produceBasket, P.groceryAisle, P.storeShelves, P.shoppingCart,
      P.groceryBags, P.meatCounter, P.bakery, P.payment, P.delivery,
      P.office, P.financialChart, P.receipt, P.trophy, P.stadium,
      P.phone, P.farm);

  return Array.from(new Set(out));
}

function articleImageUrl(photoId: string): string {
  return unsplashUrl(photoId, 640, 400);
}

function articleImageUrlLarge(photoId: string): string {
  return unsplashUrl(photoId, 1200, 500);
}
// ─── AI Insight generator (deterministic from article) ──────────────────────

const TAG_LABELS: Record<NewsTag, string> = {
  brand: "Brand & Corporate",
  grocery: "Grocery Industry",
  loyalty: "Loyalty & Scene+",
  launch: "Own Brand / Launch",
  value: "Value & Affordability",
  social: "Social & Cultural",
  sports: "Sports & Events",
  sponsorships: "Sponsorships",
  partnerships: "Strategic Partnership",
  competitors: "Competitor Watch",
  macro: "Macro Environment",
};

function generateInsight(item: NewsItem): { impact: string; actions: Array<{ icon: React.ComponentType<{ className?: string }>; title: string; description: string }> } {
  const tag = item.tags[0];

  if (tag === "competitors") {
    return {
      impact: "Competitor activity from Loblaw, No Frills, Metro, Walmart, Costco, and Save-On-Foods directly affects Sobeys' market position, share-of-voice, and basket share. Price-drop events, own-brand launches, loyalty moves, and store-format expansion signal where pressure is intensifying — and where Sobeys has an opening to defend, differentiate, or win switchers.",
      actions: [
        { icon: TrendingUp, title: "Assess Competitive Threat Level", description: "Evaluate whether this move targets a category, region, or shopper segment where Sobeys has meaningful share. Decide if it requires a measured value counter-response, a loyalty activation, or whether current positioning holds." },
        { icon: Target, title: "Monitor SOV and Basket Impact", description: "Track whether this move shifts share-of-voice, flyer engagement, or basket pacing in overlapping categories. Scene+ first-party signals and digital engagement show impact faster than syndicated share studies." },
        { icon: Shield, title: "Activate Conquest Audiences", description: "Where Sobeys has structural advantages (Scene+ breadth, Voilà fulfilment, Compliments value), surface them. Layer Conquest — No Frills / Loblaws / Walmart / Costco audiences into defensive media plans." },
      ],
    };
  }
  if (tag === "loyalty") {
    return {
      impact: "Loyalty and first-party data are the fastest-moving lever in grocery. Scene+ enrolment, points-event mechanics, personalization, and Empire Media+ retail-media all sit in this stream. Acting on a loyalty signal early — before a competitor's PC Optimum or Moi move resets shopper expectations — is where STRATIS unlocks margin-efficient growth.",
      actions: [
        { icon: TrendingUp, title: "Tune Scene+ Offer Weight", description: "If Scene+ enrolment or redemption signals are strengthening, surge personalized offers and CTV/Search behind the moment. If a competitor loyalty move is landing, protect high-value segments with targeted bonus-points activation." },
        { icon: Target, title: "Exploit First-Party Data", description: "Loyalty moments expose conquest and win-back openings. Use Scene+ segments to target lapsed shoppers and competitor switchers with relevant, personalized creative rather than blanket discounts." },
        { icon: Shield, title: "Coordinate Retail Media", description: "Loyalty and Empire Media+ are won at the shelf and the screen. Ensure CPG-funded retail-media, banner creative, and Scene+ offers are coordinated so the same shopper sees one coherent story." },
      ],
    };
  }
  if (tag === "value") {
    return {
      impact: "Food inflation and affordability shape grocery consideration more than any other factor right now. Price-freeze claims, rollback events, own-brand trade-down, and basket-cost coverage all flow through to where shoppers shop within weeks. The price math is the marketing.",
      actions: [
        { icon: TrendingUp, title: "Sharpen Value Messaging", description: "Refresh flyer, Compliments, and weekly-offer creative to make the real basket savings clear. When affordability is top-of-mind, lead with concrete price proof, not brand sentiment." },
        { icon: Target, title: "Recalibrate vs Discount Banners", description: "Where No Frills, Food Basics, or Walmart sharpen price, model the basket-share impact and adjust value weight — or steer price-sensitive shoppers to FreshCo within the Empire family." },
        { icon: Shield, title: "Protect Margin with Own Brands", description: "Affordability moments favour Compliments and Panache trade-in. Surface own-brand value to defend basket size without conceding headline price on national brands." },
      ],
    };
  }
  if (tag === "launch") {
    return {
      impact: "Own-brand and product launches — Compliments lines, premium Panache, new fresh and prepared ranges — reshape margin mix and basket value faster than national-brand promotion. Launching with coordinated media, in-store, and Scene+ support inside the launch window is where STRATIS protects sell-through.",
      actions: [
        { icon: TrendingUp, title: "Align Media to Launch Pacing", description: "If a Compliments or Panache launch is converging positively, surge Tier 1 support and Scene+ offers. If a competitor own-brand is closing in on a category, activate defense weight before trial erodes." },
        { icon: Target, title: "Surface Trade-In Opportunities", description: "Launches expose trade-in openings — shoppers buying a national brand who are persuadable to own-brand. Build creative that names the value comparison and leans into Compliments quality." },
        { icon: Shield, title: "Coordinate Shelf & Store", description: "Launches are won at the shelf. Ensure store-level merchandising, flyer features, and Scene+ bonus offers are coordinated with national creative across the launch window." },
      ],
    };
  }
  if (tag === "partnerships") {
    return {
      impact: "Sobeys' strategic partnerships — Scene+ (Scotiabank, Cineplex), Voilà / Ocado e-commerce, and Empire Media+ retail media — directly affect competitive position in loyalty, online grocery, and CPG ad revenue. These alliances are how Sobeys matches capabilities Loblaw is building with PC Optimum and Loblaw Advance, and they unlock material first-party-data messaging.",
      actions: [
        { icon: TrendingUp, title: "Surface in Brand & Offer Creative", description: "Partnership wins (Scene+ breadth, Voilà same-day fulfilment, Empire Media+ targeting) are concrete trust signals. Update masterbrand and category creative to lead with the most relevant partnership proof per shopper segment." },
        { icon: Target, title: "Brief Stores & CPG Partners", description: "Store teams and CPG media buyers need clear talking points on what each partnership means (faster delivery, better targeting, richer rewards). Brief banner leadership and update retail-media sales decks." },
        { icon: Shield, title: "Counter Loblaw's Integrated Stack", description: "Loblaw is integrating PC Optimum, PC Bank, and Loblaw Advance. Sobeys' partnership strategy delivers comparable outcomes through best-in-class partners. Use this framing in CMO and CEO trust-building moments." },
      ],
    };
  }
  if (tag === "grocery") {
    return {
      impact: "Industry-level signals — category sales data, store-format shifts, supplier and Grocery Code of Conduct dynamics, and broad shopper data — shape expectation and Sobeys' competitive baseline. Third-party industry data carries credibility that paid media cannot manufacture.",
      actions: [
        { icon: TrendingUp, title: "Amplify Wins, Defuse Losses", description: "Where Sobeys banners gain category share or recognition, build campaigns around the third-party validation. Where competitors gain, model the SOV and basket impact and prepare a response." },
        { icon: Target, title: "Cross-Reference with Internal KPIs", description: "Industry shifts often show up in Sobeys KPIs (ROAS, basket pacing, conversion) before they show up in syndicated share. Use STRATIS visibility to confirm signals against attributed-sales impact." },
        { icon: Shield, title: "Update Competitive Set", description: "Industry data may reveal a banner gaining share in a region or category Sobeys hasn't closely tracked. Add to the conquest audience list and competitive monitoring scope." },
      ],
    };
  }
  if (tag === "social") {
    return {
      impact: "Shopper decisions are increasingly community-driven. Reddit r/loblawsisoutofcontrol, r/PersonalFinanceCanada, and TikTok #GroceryHaul creators surface high-conviction opinions on price, value, and trust that move real shopping behaviour. These communities reveal exactly how affordability sentiment is shifting — and where Sobeys can earn credibility.",
      actions: [
        { icon: TrendingUp, title: "Align Creative to Community Language", description: "If a value or own-brand story is gaining traction on Reddit or #GroceryHaul, ensure paid creative reflects the framing shoppers already use. Community-driven trust is high-conviction." },
        { icon: Target, title: "Monitor Sentiment Velocity", description: "Track which value, price, and boycott narratives are gaining momentum across key communities. Comment velocity and upvotes are leading indicators of a basket-share shift." },
        { icon: Shield, title: "Activate Creators Carefully", description: "Budget-meal and grocery-haul creators for value, foodie creators for Compliments and fresh. Authentic partnerships outperform branded content; brief the social team on shortlists before activating." },
      ],
    };
  }
  if (tag === "sports" || tag === "sponsorships") {
    return {
      impact: "Sobeys' sports and sponsorship portfolio creates high-visibility activation windows tied to fan passion and community presence. Game-day moments, event activations, and Scene+ tie-ins are opportunities to convert investment into brand affinity, store traffic, and loyalty enrolment.",
      actions: [
        { icon: TrendingUp, title: "Activate Around the Moment", description: "Coordinate social, in-store, and Scene+ activation around the event window. Affinity peaks during and immediately after — speed of activation determines share of attention." },
        { icon: Target, title: "Tie Sponsorship to Loyalty & Value", description: "Sponsorship moments pair naturally with Scene+ bonus events and seasonal value stories. Connect activations to a current loyalty or category narrative rather than running them as standalone brand moments." },
        { icon: Shield, title: "Measure Sponsorship Lift", description: "Track brand search lift, store foot-traffic proxies, and Scene+ sign-ups during activation windows. Build a sponsorship performance baseline to optimize future investment." },
      ],
    };
  }
  if (tag === "macro") {
    return {
      impact: "Macro signals — Bank of Canada rate moves, StatsCan food-inflation prints, wage and employment data — directly shape Sobeys' near-term shopper behaviour: trade-down to own brands, basket-size pressure, and value-message timing. STRATIS connects these external conditions to internal media response.",
      actions: [
        { icon: TrendingUp, title: "Adjust Messaging to Economic Climate", description: "If food inflation reaccelerates, lean into Compliments value and weekly-flyer savings. If rate relief eases pressure, rebalance toward premium fresh, Panache, and basket-building creative." },
        { icon: Target, title: "Monitor Regional Sensitivity", description: "Macro effects vary by region — Ontario and the West index differently on affordability stress. Calibrate Tier 2 regional value weight accordingly." },
        { icon: Shield, title: "Flag Demand Signals Early", description: "Thanksgiving, the holidays, back-to-school, and summer BBQ create predictable demand windows. Pre-position media and store features ahead of the macro-driven shopping peaks." },
      ],
    };
  }
  if (tag === "brand") {
    return {
      impact: "This signals a shift in how shoppers perceive Sobeys and the Empire family of banners. Whether it's a masterbrand campaign, corporate milestone, or executive narrative, every public signal shapes consideration and store traffic. Sobeys' ability to control its narrative directly affects brand equity across all banners and tiers.",
      actions: [
        { icon: TrendingUp, title: "Amplify Positive Signals", description: "If the narrative is favourable, accelerate owned and paid amplification. Push the story across Sobeys channels and align store-level messaging with the momentum before it fades." },
        { icon: Target, title: "Track Narrative Trajectory", description: "Monitor whether this is being picked up by grocery and marketing trade press and how the tone is shifting. Flag any divergence between Sobeys' intended positioning and how the market reads it." },
        { icon: Shield, title: "Pair with Category Narratives", description: "Brand stories land harder when tied to a concrete category moment — Scene+ value, Compliments quality, Voilà convenience. Avoid pure-brand activations divorced from the shopping basket." },
      ],
    };
  }
  // default
  return {
    impact: "This development has strategic implications for Sobeys' positioning. Staying ahead of market shifts, competitor moves, and shopper behaviour changes ensures Sobeys can respond proactively rather than reactively.",
    actions: [
      { icon: TrendingUp, title: "Assess Strategic Impact", description: "Evaluate how this development affects Sobeys' current category priorities and whether it warrants a change in tier weighting or media approach." },
      { icon: Target, title: "Cross-Reference with Other Signals", description: "Check whether this is being confirmed by other data sources — social conversation, basket pacing, competitor behaviour — to determine confidence before acting." },
      { icon: Shield, title: "Monitor for Escalation", description: "Track whether this signal is intensifying, stabilizing, or fading. Set a review point to reassess impact and determine next steps." },
    ],
  };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function NewsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsItem | null>(null);
  const selectedEnterprise = useAppStore((s) => s.selectedEnterprise);
  const store = useMemo(() => generateAllData(selectedEnterprise ?? 'ford-canada'), [selectedEnterprise]);
  const newsItems = store.newsItems;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedArticle(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const sections = useMemo(() => {
    const used = new Set<string>();
    return FEED_SECTIONS.map((section) => {
      const items = newsItems.filter((item) => {
        if (used.has(item.id)) return false;
        if (section.filterFn(item)) {
          used.add(item.id);
          return true;
        }
        return false;
      });
      return { ...section, items: items.slice(0, 6) };
    }).filter((s) => s.items.length > 0);
  }, [newsItems]);

  // Assign each article a photo in render order, never repeating one while the
  // library still has unused options — each article gets the most relevant photo
  // not already taken by an earlier card.
  const photoById = useMemo(() => {
    const used = new Set<string>();
    const map: Record<string, string> = {};
    for (const section of sections) {
      for (const item of section.items) {
        const cands = candidatePhotos(item);
        const pick = cands.find((p) => !used.has(p)) ?? cands[0];
        used.add(pick);
        map[item.id] = pick;
      }
    }
    return map;
  }, [sections]);

  if (loading) {
    return (
      <div className="space-y-10 px-2">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="grid grid-cols-3 gap-5">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-3">
                  <Skeleton className="h-44 rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const insight = selectedArticle ? generateInsight(selectedArticle) : null;

  return (
    <>
      <div className="space-y-12 px-2">
        {sections.map((section) => {
          const sourcesDisplay = section.sources.slice(0, 3).join(", ");
          const moreCount = Math.max(0, section.sources.length - 3);
          const unreadCount = section.items.length;

          return (
            <div key={section.id}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <h2 className="text-lg font-bold">{section.title}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Monitoring: {sourcesDisplay}
                    {moreCount > 0 && <>, and {moreCount} more</>}
                    .{" "}
                    <button className="text-foreground underline underline-offset-2 hover:text-teal transition-colors">Edit</button>
                  </p>
                </div>
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-1">
                  View all ({unreadCount} unread) <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-5 mt-4">
                {section.items.slice(0, 3).map((item) => {
                  const date = new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedArticle(item)}
                      className="group rounded-xl border border-border/40 bg-card overflow-hidden hover:border-border/60 hover:shadow-lg hover:shadow-black/10 transition-all cursor-pointer"
                    >
                      <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={articleImageUrl(photoById[item.id] ?? pickArticlePhoto(item))}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <div className="p-4">
                        <h3 className="text-sm font-semibold leading-snug mb-2 line-clamp-2 group-hover:text-teal transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-4">
                          <span className="font-medium text-muted-foreground/80">{item.source}</span>
                          {" "}• {date} • {item.summary}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Article Detail Modal ─── */}
      {selectedArticle && insight && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedArticle(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] bg-card border border-border/40 rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Hero image */}
            <div className="relative h-56 shrink-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={articleImageUrlLarge(photoById[selectedArticle.id] ?? pickArticlePhoto(selectedArticle))}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

              {/* Close button */}
              <button
                onClick={() => setSelectedArticle(null)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/80 hover:text-white hover:bg-black/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Tags */}
              <div className="absolute bottom-4 left-6 flex items-center gap-2">
                {selectedArticle.tags.map((tag) => (
                  <span key={tag} className="text-[10px] font-semibold text-white/90 bg-white/15 backdrop-blur-sm border border-white/10 px-2.5 py-1 rounded-full">
                    {TAG_LABELS[tag]}
                  </span>
                ))}
                <span className={cn(
                  "text-[10px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-sm",
                  selectedArticle.urgency === "high" ? "text-red-300 bg-red-500/20 border border-red-500/20" :
                  selectedArticle.urgency === "medium" ? "text-amber-300 bg-amber-500/20 border border-amber-500/20" :
                  "text-white/70 bg-white/10 border border-white/10"
                )}>
                  {selectedArticle.urgency.charAt(0).toUpperCase() + selectedArticle.urgency.slice(1)} Priority
                </span>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-auto px-6 pb-6">
              {/* Article header */}
              <div className="pt-4 pb-5">
                <h2 className="text-xl font-bold leading-tight mb-3">{selectedArticle.title}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/70">{selectedArticle.source}</span>
                  <span>•</span>
                  <span>{new Date(selectedArticle.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
                </div>
              </div>

              {/* Article body */}
              <div className="space-y-4 mb-6">
                <p className="text-sm text-muted-foreground leading-relaxed">{selectedArticle.summary}</p>
                {selectedArticle.competitor && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300/80">
                      <span className="font-semibold text-red-400">Competitor Alert:</span> This article involves <span className="font-semibold">{selectedArticle.competitor}</span>, a competing banner in Sobeys&apos; market.
                    </p>
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="border-t border-border/30 my-6" />

              {/* STRATIS Insight */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal/20 to-emerald-500/10 border border-teal/20 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-teal" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold">STRATIS Insight</h3>
                    <p className="text-[10px] text-muted-foreground/60">What this means for Sobeys</p>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-2">{insight.impact}</p>

                {/* Why it matters callout */}
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-teal/5 border border-teal/10 mb-6">
                  <TrendingUp className="h-4 w-4 text-teal shrink-0 mt-0.5" />
                  <p className="text-xs text-teal/80">
                    <span className="font-semibold text-teal">Why it matters:</span> {selectedArticle.whyItMatters}
                  </p>
                </div>

                {/* Recommended actions */}
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground/50 mb-3">Recommended Actions</h4>
                <div className="space-y-3">
                  {insight.actions.map((action, i) => (
                    <div key={i} className="group/action flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/20 hover:border-teal/20 hover:bg-teal/5 transition-all cursor-pointer">
                      <div className="w-8 h-8 rounded-lg bg-teal/10 border border-teal/10 flex items-center justify-center shrink-0 mt-0.5">
                        <action.icon className="h-4 w-4 text-teal" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="text-sm font-semibold">{action.title}</h5>
                          <ArrowRight className="h-3 w-3 text-teal opacity-0 group-hover/action:opacity-100 transition-opacity" />
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">{action.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom action bar */}
            <div className="shrink-0 border-t border-border/30 px-6 py-3 flex items-center justify-between bg-card">
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Bookmark className="h-3.5 w-3.5" /> Save
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <Share2 className="h-3.5 w-3.5" /> Share
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" /> Source
                </button>
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal text-white text-xs font-semibold hover:bg-teal/90 transition-colors">
                <Sparkles className="h-3.5 w-3.5" /> Generate Insight Report
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
