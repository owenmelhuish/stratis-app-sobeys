"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { generateAllData } from '@/lib/mock-data';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, Lightbulb, Activity, Zap, MoreHorizontal, ListChecks,
} from 'lucide-react';
import {
  type InsightCategory, type InsightStatus, type Insight,
} from '@/types';
import { cn } from '@/lib/utils';
import { getInsightVisual } from '@/lib/insight-visuals';
import { InsightChart } from '@/components/insights/insight-chart';
import { InsightDetailModal } from '@/components/insights/insight-detail-modal';

const CATEGORY_CONFIG: Record<InsightCategory, { label: string; color: string }> = {
  'market-radar':         { label: 'Market Radar',         color: 'bg-emerald-500/20 text-emerald-400' },
  // Sobeys signal taxonomy
  'strategic-opener':     { label: 'Brand & Portfolio',    color: 'bg-purple-500/20 text-purple-400' },
  'national-regional':    { label: 'National ↔ Regional',  color: 'bg-teal-500/20 text-teal-400' },
  'tactical-efficiency':  { label: 'Media Efficiency',     color: 'bg-orange/20 text-orange' },
  'creative-performance': { label: 'Creative Performance', color: 'bg-cyan-500/20 text-cyan-400' },
  'audience-overlap':     { label: 'Audience & Frequency', color: 'bg-blue-500/20 text-blue-400' },
  'competitive-macro':    { label: 'Competitive & Market', color: 'bg-red-500/20 text-red-400' },
  // Retained for Farm Boy + Longo's banners
  'tier-choreography':    { label: 'Tier Choreography',    color: 'bg-purple-500/20 text-purple-400' },
  'portfolio-dynamics':   { label: 'Portfolio Dynamics',   color: 'bg-cyan-500/20 text-cyan-400' },
  'agency-arbitrage':     { label: 'Agency Arbitrage',     color: 'bg-amber-500/20 text-amber-400' },
  'macro-convergence':    { label: 'Macro Convergence',    color: 'bg-red-500/20 text-red-400' },
  'launch-calendar':      { label: 'Launch Calendar',      color: 'bg-blue-500/20 text-blue-400' },
};

const STATUS_OPTIONS: { value: InsightStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: 'snoozed', label: 'Snoozed' },
];

interface ScopeGroup {
  key: string;
  label: string;
  description: string;
  filter: (item: Insight) => boolean;
}

const SCOPE_GROUPS: ScopeGroup[] = [
  // ── Sobeys signal taxonomy ──
  {
    key: 'strategic-opener',
    label: 'BRAND & PORTFOLIO STRATEGY',
    description: 'Portfolio-level brand and halo signals only visible across every banner and category at once',
    filter: (item) => item.category === 'strategic-opener',
  },
  {
    key: 'national-regional',
    label: 'NATIONAL-TO-REGIONAL ORCHESTRATION',
    description: 'Tier 1 → Tier 2 choreography — whether national brand demand is being converted regionally, and whether the tiers reinforce or work against each other',
    filter: (item) => item.category === 'national-regional',
  },
  {
    key: 'tactical-efficiency',
    label: 'MEDIA EFFICIENCY & ALLOCATION',
    description: 'Channel, format, and budget moves ready to ship — efficiency levers measured before they scale',
    filter: (item) => item.category === 'tactical-efficiency',
  },
  {
    key: 'creative-performance',
    label: 'CREATIVE PERFORMANCE',
    description: 'Per-creative decay, geographic fit, and delivery-vs-segment mismatches across the category portfolio',
    filter: (item) => item.category === 'creative-performance',
  },
  {
    key: 'audience-overlap',
    label: 'AUDIENCE & FREQUENCY',
    description: 'Shared-audience collisions and frequency math across categories — one shopper, multiple uncoordinated Sobeys messages',
    filter: (item) => item.category === 'audience-overlap',
  },
  {
    key: 'competitive-macro',
    label: 'COMPETITIVE & MARKET SIGNALS',
    description: 'External signals — competitor promos, food inflation — triangulated against Sobeys demand and reported as correlation, not cause',
    filter: (item) => item.category === 'competitive-macro',
  },
  // ── Retained for Farm Boy + Longo's banners ──
  {
    key: 'tier-choreography',
    label: 'TIER CHOREOGRAPHY',
    description: 'Tier 1 ↔ Tier 2 ↔ Tier 3 collisions, halo, and store-corporate coordination only visible across the full hierarchy',
    filter: (item) => item.category === 'tier-choreography',
  },
  {
    key: 'portfolio-dynamics',
    label: 'PORTFOLIO DYNAMICS',
    description: 'Cross-category halo, cannibalization, and shared-audience frequency math across the portfolio',
    filter: (item) => item.category === 'portfolio-dynamics',
  },
  {
    key: 'agency-arbitrage',
    label: 'AGENCY ARBITRAGE',
    description: 'Who has the better playbook for which job — agencies compared on the same work',
    filter: (item) => item.category === 'agency-arbitrage',
  },
  {
    key: 'macro-convergence',
    label: 'MACRO CONVERGENCE',
    description: 'External signals — food inflation, weather, competitor moves, seasonal demand — triangulated against performance',
    filter: (item) => item.category === 'macro-convergence',
  },
  {
    key: 'launch-calendar',
    label: 'LAUNCH CALENDAR',
    description: 'Seasonal and promo-window timing collisions across the portfolio and the competitive set',
    filter: (item) => item.category === 'launch-calendar',
  },
  // ── Always-on news feed (rendered last) ──
  {
    key: 'market-radar',
    label: 'MARKET RADAR',
    description: 'Top news events surfaced from the always-on news feed — the highest-impact items the CMO should know are being tracked right now',
    filter: (item) => item.category === 'market-radar',
  },
];

export default function InsightsPage() {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InsightStatus | 'all'>('all');
  const [categoryFilters, setCategoryFilters] = useState<InsightCategory[]>([]);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);

  const selectedEnterprise = useAppStore((s) => s.selectedEnterprise);
  const store = useMemo(() => generateAllData(selectedEnterprise ?? 'ford-canada'), [selectedEnterprise]);
  const {
    insightStatuses, insightApprovals, insightDismissals, insightSnoozes,
    actionLog, approvedDrawerOpen, setApprovedDrawerOpen,
    approveInsight, dismissInsight, reviewInsight,
  } = useAppStore();

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const getStatus = useCallback(
    (id: string, defaultStatus: InsightStatus): InsightStatus => {
      return insightStatuses[id] || defaultStatus;
    },
    [insightStatuses]
  );

  const filtered = useMemo(() => {
    return store.insights.filter((item) => {
      const status = getStatus(item.id, item.status);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (statusFilter === 'all' && status === 'snoozed') {
        const snoozeUntil = insightSnoozes[item.id];
        if (snoozeUntil && snoozeUntil > new Date().toISOString().split('T')[0]) return false;
      }
      if (categoryFilters.length > 0 && !categoryFilters.includes(item.category)) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.title.toLowerCase().includes(q) && !item.summary.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [store.insights, statusFilter, categoryFilters, search, getStatus, insightSnoozes]);

  // Only surface category pills for categories the current enterprise actually uses
  const availableCategories = useMemo(() => {
    const present = new Set(store.insights.map((i) => i.category));
    return (Object.keys(CATEGORY_CONFIG) as InsightCategory[]).filter((c) => present.has(c));
  }, [store.insights]);

  const toggleCategory = (c: InsightCategory) =>
    setCategoryFilters((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const selectedInsight = useMemo(
    () => (selectedInsightId ? filtered.find((i) => i.id === selectedInsightId) ?? null : null),
    [selectedInsightId, filtered]
  );

  const selectedIndex = useMemo(
    () => (selectedInsightId ? filtered.findIndex((i) => i.id === selectedInsightId) : -1),
    [selectedInsightId, filtered]
  );

  const approvedInsights = store.insights.filter(
    (i) => getStatus(i.id, i.status) === 'approved'
  );
  const approvedCount = approvedInsights.length;

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">STRATIS Signals</h1>
          <p className="text-xs text-muted-foreground mt-1">
            AI-derived insights from performance patterns, news, and anomalies
          </p>
        </div>
        <Sheet open={approvedDrawerOpen} onOpenChange={setApprovedDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Approved Actions
              {approvedCount > 0 && (
                <Badge className="bg-orange/20 text-orange text-[10px]">{approvedCount}</Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[400px] sm:w-[440px]">
            <SheetHeader>
              <SheetTitle>Approved Actions & Action Log</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              {approvedCount > 0 && (
                <div className="bg-orange/5 border border-orange/20 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-orange" />
                    <span className="text-xs font-semibold text-orange">
                      Simulated plan updated
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {approvedCount} approved actions influencing budget allocation model
                  </p>
                  <Badge className="mt-2 bg-emerald-500/20 text-emerald-400 text-[10px]">
                    Projected: +{(approvedCount * 3.2).toFixed(1)}% efficiency
                  </Badge>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold mb-3">Approved Insights</h3>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2 pr-3">
                    {approvedInsights.map((insight) => (
                      <div
                        key={insight.id}
                        className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5"
                      >
                        <p className="text-xs font-medium">{insight.title}</p>
                        <p className="text-[10px] text-orange mt-1">{insight.impactEstimate}</p>
                        {insightApprovals[insight.id] && (
                          <p className="text-[10px] text-muted-foreground mt-1 italic">
                            &quot;{insightApprovals[insight.id]}&quot;
                          </p>
                        )}
                      </div>
                    ))}
                    {approvedInsights.length === 0 && (
                      <p className="text-xs text-muted-foreground">No approved actions yet</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <Separator />
              <div>
                <h3 className="text-sm font-semibold mb-3">Action Log</h3>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2 pr-3">
                    {actionLog.map((entry) => {
                      const insight = store.insights.find((i) => i.id === entry.insightId);
                      return (
                        <div
                          key={entry.id}
                          className="flex items-start gap-2 p-2 rounded bg-muted/30 text-xs"
                        >
                          <Activity className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                          <div>
                            <span
                              className={cn(
                                'font-medium capitalize',
                                entry.action === 'approved' && 'text-emerald-400',
                                entry.action === 'dismissed' && 'text-red-400',
                                entry.action === 'snoozed' && 'text-yellow-400',
                                entry.action === 'reviewed' && 'text-blue-400'
                              )}
                            >
                              {entry.action}
                            </span>
                            <span className="text-muted-foreground">
                              {' '}
                              — {insight?.title?.slice(0, 50) || entry.insightId}...
                            </span>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              {new Date(entry.timestamp).toLocaleString()}
                              {entry.rationale && <span> &bull; &quot;{entry.rationale}&quot;</span>}
                              {entry.dismissReason && (
                                <span> &bull; Reason: {entry.dismissReason}</span>
                              )}
                              {entry.snoozeUntil && (
                                <span> &bull; Until: {entry.snoozeUntil}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {actionLog.length === 0 && (
                      <p className="text-xs text-muted-foreground">No actions taken yet</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Horizontal filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search insights..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 bg-muted/50 text-xs"
          />
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Status pills */}
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatusFilter(opt.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors',
                statusFilter === opt.value
                  ? 'bg-orange/15 text-orange'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Category pills */}
        <div className="flex items-center gap-1">
          {availableCategories.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            return (
              <button
                key={cat}
                onClick={() => toggleCategory(cat)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                  categoryFilters.includes(cat)
                    ? config.color + ' border-current'
                    : 'bg-muted text-muted-foreground border-transparent hover:text-foreground'
                )}
              >
                {config.label}
              </button>
            );
          })}
        </div>

        <span className="ml-auto text-[11px] text-muted-foreground">
          {filtered.length} insights
        </span>
      </div>

      {/* Grouped sections */}
      {SCOPE_GROUPS.map((group) => {
        const groupInsights = filtered.filter(group.filter);
        if (groupInsights.length === 0) return null;

        return (
          <div key={group.key} className="space-y-3">
            {/* Section header */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-foreground">
                {group.label}
              </h2>
              <p className="text-[11px] text-muted-foreground">{group.description}</p>
            </div>

            {/* 3-column grid */}
            <div className="grid grid-cols-3 gap-4">
              {groupInsights.map((item) => (
                <InsightCard
                  key={item.id}
                  insight={item}
                  status={getStatus(item.id, item.status)}
                  onClick={() => setSelectedInsightId(item.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No insights match your filters</p>
        </div>
      )}

      {/* Detail modal */}
      <InsightDetailModal
        insight={selectedInsight}
        open={selectedInsightId !== null && selectedInsight !== null}
        onClose={() => setSelectedInsightId(null)}
        onPrev={() => {
          if (selectedIndex > 0) setSelectedInsightId(filtered[selectedIndex - 1].id);
        }}
        onNext={() => {
          if (selectedIndex < filtered.length - 1)
            setSelectedInsightId(filtered[selectedIndex + 1].id);
        }}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex < filtered.length - 1}
        onDiscard={(id) => {
          dismissInsight(id, 'not-relevant');
          setSelectedInsightId(null);
        }}
        onComplete={(id) => {
          approveInsight(id);
          setSelectedInsightId(null);
        }}
      />
    </div>
  );
}

// ===== InsightCard Component =====

function InsightCard({
  insight,
  status,
  onClick,
}: {
  insight: Insight;
  status: InsightStatus;
  onClick: () => void;
}) {
  const visual = useMemo(() => getInsightVisual(insight.id), [insight.id]);

  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border/40 bg-card p-5 cursor-pointer transition-all hover:border-border/70 hover:shadow-md relative group flex flex-col',
        status === 'approved' && 'border-emerald-500/20',
        status === 'dismissed' && 'border-red-500/10 opacity-60'
      )}
    >
      {/* Menu button */}
      <button className="absolute top-3 right-3 p-1 rounded text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity hover:text-foreground">
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {/* Title */}
      <h3 className="text-sm font-bold pr-6 line-clamp-2">{insight.title}</h3>

      {/* Subtitle from recommended action */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 line-clamp-2">
        {insight.recommendedAction}
      </p>

      {/* Purpose-built chart illustrating the finding */}
      <div className="mt-auto pt-3">
        <InsightChart visual={visual} variant="card" />
      </div>
    </div>
  );
}
