"use client";

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from '@/components/ui/dialog';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Circle,
  Info,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import type { Insight } from '@/types';
import { cn } from '@/lib/utils';
import {
  generateInsightChartData,
  interpolateChannels,
  type MetricsHint,
} from '@/lib/insight-chart-data';
import type { InsightChartData, ChannelAllocation } from '@/lib/insight-chart-data';
import { getInsightVisual } from '@/lib/insight-visuals';
import { InsightChart } from '@/components/insights/insight-chart';

// --- Derive metrics hint from insight ---
function deriveMetricsHint(insight: Insight): MetricsHint {
  const mapping: Record<string, MetricsHint> = {
    'insight-agency-collision': 'cpm-overlap',
    'insight-frequency-overexposure': 'frequency-waste',
    'insight-attribution-blind': 'attribution-lift',
    'insight-product-cannibalization': 'cpc-competition',
    'insight-awareness-correlation': 'awareness-conversion',
    'insight-geo-arbitrage': 'cpa-geo',
    'insight-competitive-response': 'conversions-market',
    'insight-market-event-window': 'conversions-market',
    'insight-portfolio-rebalance': 'roas-saturation',
    'insight-funnel-bottleneck': 'convrate-volume',
    'ins-tactical-001-lightning-channel-mix': 'engagement-spend',
    'ins-tactical-002-vla-search': 'roas-saturation',
  };
  return mapping[insight.id] || 'engagement-spend';
}

// --- Generate asset name from insight ID ---
function generateAssetName(insightId: string): string {
  let hash = 0;
  for (let i = 0; i < insightId.length; i++) {
    hash = ((hash << 5) - hash) + insightId.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash);
  const adNum = (hash % 20) + 1;
  const formats = ['V', 'I', 'C'];
  const fmt = formats[hash % 3];
  const langs = ['EN', 'FR', 'ES'];
  const lang = langs[(hash >> 4) % 3];
  const durations = ['09', '15', '30'];
  const dur = durations[(hash >> 8) % 3];
  const aspects = ['1x1', '16x9', '9x16'];
  const aspect = aspects[(hash >> 12) % 3];
  const code = insightId.replace(/[^a-zA-Z0-9]/g, '').slice(-3).toUpperCase();
  return `FORD26-${code}-Ad${String(adNum).padStart(2, '0')}-${fmt}-${lang}-${dur}-${aspect}`;
}

// --- Check if insight is creative/ad type ---
function isCreativeType(_insight: Insight): boolean {
  return false; // No creative-category insights in orchestration model
}

// --- Direct action vs strategic brief ---
const DIRECT_ACTION_INSIGHT_IDS = new Set([
  'insight-geo-arbitrage',
  'insight-portfolio-rebalance',
]);

function isDirectActionType(insight: Insight): boolean {
  return DIRECT_ACTION_INSIGHT_IDS.has(insight.id);
}

// --- Slider-driven channel reallocation cards (render the channel-allocation bar chart) ---
const CHANNEL_OPT_INSIGHT_IDS = new Set([
  'ins-tactical-001-lightning-channel-mix',
  'ins-tactical-002-vla-search',
]);

function isChannelOptType(insight: Insight): boolean {
  return CHANNEL_OPT_INSIGHT_IDS.has(insight.id);
}

function getBriefRecipients(insight: Insight): string[] {
  const mapping: Record<string, string[]> = {
    // Ford Canada signals
    'ins-strat-01-brand-promises': ['CMO', 'VP Brand', 'VP Media', 'Mindshare Lead'],
    'ins-strat-02-f150-halo': ['CMO', 'VP Media', 'Marketing Ops', 'Mindshare Lead'],
    'ins-strat-03-bronco-earned': ['CMO', 'VP Brand', 'VP Media', 'Marketing Ops'],
    'ins-natreg-01-demand-vs-budget': ['CMO', 'VP Media', 'Mindshare Lead', 'Regional Partner Leads'],
    'ins-natreg-02-playbook-cascade': ['VP Media', 'Mindshare Lead', 'Regional Partner Leads'],
    'ins-tac-05-instagram-cpm': ['VP Media', 'Mindshare Lead', 'Ad Ops'],
    'ins-tac-06-meta-audience-overlap': ['VP Media', 'Mindshare Lead', 'Regional Partner Lead', 'Ad Ops'],
    'ins-tac-08-lightning-creative-fatigue': ['VP Media', 'Lightning Brand Lead', 'Creative — Mindshare'],
    'ins-tac-09-creative-geo-split': ['VP Media', 'Creative Strategy', 'Cossette Lead'],
    'ins-tac-10-mache-delivery': ['VP Media', 'Mach-E Brand Lead', 'Ad Ops'],
    'ins-tac-11-scheduled-refresh': ['VP Media', 'Creative Operations', 'All Agency Leads'],
    'ins-tac-12-tesla-conquest-overlap': ['VP Media', 'Lightning / Mach-E / F-150 Leads', 'Ad Ops'],
    'ins-tac-13-ev-considerer-overlap': ['VP Media', 'Mach-E Lead', 'Escape PHEV Lead'],
    'ins-011-tesla-cybertruck-response': ['CMO', 'VP Media', 'Lightning Launch Team', 'Mindshare Lead'],
    'ins-010-gas-price-phev-tailwind': ['VP Media', 'Escape PHEV Lead', 'Mindshare Lead'],
    // Legacy / other enterprises
    'insight-agency-collision': ['VP Media', 'Omnicom Account Lead', 'In-House Media Director'],
    'insight-frequency-overexposure': ['VP Media', 'All Agency Leads', 'Ad Ops'],
    'insight-attribution-blind': ['VP Analytics', 'Measurement Team', 'VP Media'],
    'insight-product-cannibalization': ['VP Media', 'Omnicom Account Lead', 'Product Marketing — Cards'],
    'insight-awareness-correlation': ['CMO', 'VP Media', 'CFO Office'],
    'insight-competitive-response': ['CMO', 'VP Media', 'Omnicom Lead', 'Publicis Lead', 'In-House Director'],
    'insight-market-event-window': ['VP Media', 'Ad Ops', 'Omnicom Account Lead'],
    'insight-funnel-bottleneck': ['VP Digital', 'Product — Mortgages', 'Product — Wealth', 'UX Team'],
  };
  return mapping[insight.id] || ['VP Media', 'Agency Lead'];
}

interface InsightDetailModalProps {
  insight: Insight | null;
  open: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onDiscard: (id: string) => void;
  onComplete: (id: string) => void;
  hasPrev: boolean;
  hasNext: boolean;
}

export function InsightDetailModal({
  insight,
  open,
  onClose,
  onPrev,
  onNext,
  onDiscard,
  onComplete,
  hasPrev,
  hasNext,
}: InsightDetailModalProps) {
  const [budgetIntensity, setBudgetIntensity] = useState(50);

  const metricsHint = insight ? deriveMetricsHint(insight) : 'engagement-frequency';

  const chartData = useMemo<InsightChartData | null>(
    () => (insight ? generateInsightChartData(insight.id, metricsHint) : null),
    [insight, metricsHint]
  );

  // Reset state when insight changes
  useEffect(() => {
    if (!insight) return;
    setBudgetIntensity(50);
  }, [insight]);

  const intensity = budgetIntensity / 100;

  const adjustedChannels = useMemo(() => {
    if (!chartData) return [];
    return interpolateChannels(chartData.channelAllocations, intensity);
  }, [chartData, intensity]);

  // Budget move amount for channel insights
  const budgetMoveAmount = useMemo(() => {
    if (!adjustedChannels.length) return { amount: 0, percent: 0 };
    const totalSpend = adjustedChannels.reduce((s, c) => s + c.spend, 0);
    const reduced = adjustedChannels.filter(c => c.direction === 'reduced');
    const moveAmount = reduced.reduce((s, c) => s + Math.abs(c.recommendedSpend - c.spend), 0);
    return {
      amount: moveAmount,
      percent: totalSpend > 0 ? Math.round((moveAmount / totalSpend) * 100) : 0,
    };
  }, [adjustedChannels]);

  if (!insight || !chartData) return null;

  const creative = isCreativeType(insight);
  const directAction = isDirectActionType(insight);
  const assetName = creative ? generateAssetName(insight.id) : '';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed top-[50%] left-[50%] z-50 w-full max-w-lg max-h-[85vh] translate-x-[-50%] translate-y-[-50%] rounded-2xl border border-border/40 bg-card shadow-2xl outline-none overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DialogTitle className="sr-only">{insight.title}</DialogTitle>

          {/* Nav arrows */}
          {hasPrev && (
            <button
              onClick={onPrev}
              className="absolute -left-12 top-1/2 -translate-y-1/2 rounded-full bg-card/80 border border-border/40 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {hasNext && (
            <button
              onClick={onNext}
              className="absolute -right-12 top-1/2 -translate-y-1/2 rounded-full bg-card/80 border border-border/40 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}

          <div className="overflow-y-auto max-h-[85vh]">
            <div className="p-5 space-y-0">

              {/* ─── Purpose-built chart illustrating the finding ─── */}
              <div className="mb-4 -mx-1">
                <InsightChart visual={getInsightVisual(insight.id)} variant="detail" />
              </div>

              {/* ─── Separator ─── */}
              <Separator className="mb-4" />

              {/* ─── Title & Summary ─── */}
              <div className="mb-3">
                <h2 className="text-xl font-bold leading-tight">{insight.title}</h2>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                  {insight.recommendedAction}
                </p>
              </div>

              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {insight.summary}
              </p>

              {/* ─── Separator ─── */}
              <Separator className="mb-4" />

              {/* ─── Action Section ─── */}
              {creative ? (
                <CreativeActionSection
                  insight={insight}
                  assetName={assetName}
                  budgetIntensity={budgetIntensity}
                  onBudgetChange={setBudgetIntensity}
                  onSkip={() => onDiscard(insight.id)}
                  onPause={() => onComplete(insight.id)}
                />
              ) : isChannelOptType(insight) ? (
                <ChannelOptActionSection
                  insight={insight}
                  channels={adjustedChannels}
                  avgEngagementRate={chartData.avgEngagementRate}
                  avgSpend={chartData.avgSpend}
                  efficiencyLabel={chartData.efficiencyLabel}
                  efficiencyFormat={chartData.efficiencyFormat}
                  budgetIntensity={budgetIntensity}
                  onBudgetChange={setBudgetIntensity}
                  moveAmount={budgetMoveAmount.amount}
                  movePercent={budgetMoveAmount.percent}
                  onDiscard={() => onDiscard(insight.id)}
                  onComplete={() => onComplete(insight.id)}
                />
              ) : directAction ? (
                <DefaultActionSection
                  insight={insight}
                  budgetIntensity={budgetIntensity}
                  onBudgetChange={setBudgetIntensity}
                  onDiscard={() => onDiscard(insight.id)}
                  onComplete={() => onComplete(insight.id)}
                />
              ) : (
                <StrategicBriefSection
                  insight={insight}
                  onDiscard={() => onDiscard(insight.id)}
                  onComplete={() => onComplete(insight.id)}
                />
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// ─── Creative Action Section (Pause Asset) ───

function CreativeActionSection({
  insight,
  assetName,
  budgetIntensity,
  onBudgetChange,
  onSkip,
  onPause,
}: {
  insight: Insight;
  assetName: string;
  budgetIntensity: number;
  onBudgetChange: (v: number) => void;
  onSkip: () => void;
  onPause: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Action header */}
      <div className="flex items-start gap-3">
        <Circle className="h-5 w-5 text-muted-foreground/40 mt-0.5 shrink-0" />
        <div>
          <p className="text-base font-bold">Pause Asset</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            {insight.recommendedAction}
          </p>
        </div>
      </div>

      {/* Asset selector */}
      <div className="border border-border/40 rounded-lg px-4 py-3 flex items-center justify-between bg-muted/10">
        <span className="text-xs font-mono text-muted-foreground tracking-tight">
          {assetName}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground/50" />
      </div>

      {/* Spend reduction slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Spend Reduction</p>
          <span className="text-xs text-muted-foreground font-medium">{budgetIntensity}%</span>
        </div>
        <div className="px-1">
          <Slider
            value={[budgetIntensity]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onBudgetChange(v)}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
          <span>No change</span>
          <span>Full pause</span>
        </div>
      </div>

      {/* Info disclaimer */}
      <div className="flex items-start gap-2.5 bg-muted/20 rounded-lg p-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Adjust how aggressively to reduce spend on this asset. The chart above reflects the projected improvement.
        </p>
      </div>

      {/* Bottom action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-none h-10 px-6 text-xs font-semibold border-border/60 rounded-full"
          onClick={onSkip}
        >
          Skip
        </Button>
        <Button
          size="sm"
          className="flex-1 h-10 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 rounded-full"
          onClick={onPause}
        >
          Pause Spend
        </Button>
      </div>
    </div>
  );
}

// ─── Channel Optimization Action Section ───

function ChannelOptActionSection({
  insight,
  channels,
  avgEngagementRate,
  avgSpend,
  efficiencyLabel,
  efficiencyFormat,
  budgetIntensity,
  onBudgetChange,
  moveAmount,
  movePercent,
  onDiscard,
  onComplete,
}: {
  insight: Insight;
  channels: ChannelAllocation[];
  avgEngagementRate: number;
  avgSpend: number;
  efficiencyLabel: string;
  efficiencyFormat: 'decimal-4' | 'decimal-2';
  budgetIntensity: number;
  onBudgetChange: (v: number) => void;
  moveAmount: number;
  movePercent: number;
  onDiscard: () => void;
  onComplete: () => void;
}) {
  const effDecimals = efficiencyFormat === 'decimal-4' ? 4 : 2;
  return (
    <div className="space-y-4">
      {/* Action header */}
      <div className="flex items-start gap-3">
        <Circle className="h-5 w-5 text-muted-foreground/40 mt-0.5 shrink-0" />
        <div>
          <p className="text-base font-bold">Optimize Budget Allocation</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            SHIFT SPEND TO HIGH EFFICIENCY ({efficiencyLabel})
          </p>
        </div>
      </div>

      {/* Channel bar chart */}
      <ChannelBarChart
        channels={channels}
        avgEngagementRate={avgEngagementRate}
        efficiencyFormat={efficiencyFormat}
      />

      {/* Chart legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-muted-foreground">
        <span className="font-semibold text-foreground text-[9px] uppercase tracking-wider">CHANNELS</span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#555]" />
          {efficiencyLabel} (AVG: {avgEngagementRate.toFixed(effDecimals)})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500" />
          SPEND (AVG: ${avgSpend.toLocaleString()})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm border border-emerald-500 bg-emerald-500/20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(34,197,94,0.3) 2px, rgba(34,197,94,0.3) 4px)' }} />
          INCREASED
        </span>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground -mt-2">
        <span className="inline-block w-2.5 h-2.5 rounded-sm border border-red-500 bg-red-500/20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(239,68,68,0.3) 2px, rgba(239,68,68,0.3) 4px)' }} />
        REDUCED
      </div>

      {/* Budget move text */}
      <p className="text-sm font-semibold">
        Move ${moveAmount.toFixed(2)} ({movePercent}%) to top performers
      </p>

      {/* Budget slider */}
      <div className="px-1">
        <Slider
          value={[budgetIntensity]}
          min={0}
          max={100}
          step={1}
          onValueChange={([v]) => onBudgetChange(v)}
        />
      </div>

      {/* Info disclaimer */}
      <div className="flex items-start gap-2.5 bg-muted/20 rounded-lg p-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Platform-specific structures like budget minimums or campaign-level settings may affect how you apply these shifts.
        </p>
      </div>

      {/* Platform action items */}
      {channels.map((ch) => {
        const delta = ch.recommendedSpend - ch.spend;
        const verb = delta >= 0 ? 'Increase' : 'Reduce';
        return (
          <div
            key={ch.channel}
            className="flex items-center gap-3 bg-muted/30 rounded-lg px-4 py-3 border border-border/20"
          >
            <p className="text-xs flex-1">
              {verb} {ch.channelLabel} budget by ${Math.abs(delta).toFixed(2)} to ${ch.recommendedSpend.toLocaleString()}.00
            </p>
            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          </div>
        );
      })}

      {/* Bottom action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10 text-xs font-semibold gap-1.5 border-border/60 rounded-full"
          onClick={onDiscard}
        >
          <X className="h-3.5 w-3.5" />
          Discard Insight
        </Button>
        <Button
          size="sm"
          className="flex-1 h-10 text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 rounded-full"
          onClick={onComplete}
        >
          <Check className="h-3.5 w-3.5" />
          Launch
        </Button>
      </div>
    </div>
  );
}

// ─── Strategic Brief Action Section ───

function StrategicBriefSection({
  insight,
  onDiscard,
  onComplete,
}: {
  insight: Insight;
  onDiscard: () => void;
  onComplete: () => void;
}) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const recipients = getBriefRecipients(insight);

  return (
    <div className="space-y-4">
      {insight.actionSteps.map((step) => {
        const done = completedSteps.has(step.id);
        return (
          <button
            key={step.id}
            onClick={() => toggleStep(step.id)}
            className={cn(
              'flex items-start gap-3 w-full text-left rounded-lg px-3 py-2.5 border transition-colors',
              done
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border/20 bg-muted/10 hover:bg-muted/20'
            )}
          >
            {done ? (
              <Check className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/40 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={cn('text-sm font-semibold', done && 'text-emerald-300/80')}>
                {step.title}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {step.subtitle}
              </p>
            </div>
          </button>
        );
      })}

      <div className="border border-border/30 rounded-lg p-3 bg-muted/10">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">
          Brief recipients
        </p>
        <div className="flex flex-wrap gap-1.5">
          {recipients.map((r) => (
            <span
              key={r}
              className="text-[10px] px-2 py-1 rounded-md bg-muted/30 text-muted-foreground border border-border/20"
            >
              {r}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2.5 bg-muted/20 rounded-lg p-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          The brief will include this insight&apos;s analysis, supporting evidence, recommended actions, and projected impact — formatted for distribution to the recipients above.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10 text-xs font-semibold gap-1.5 border-border/60 rounded-full"
          onClick={onDiscard}
        >
          <X className="h-3.5 w-3.5" />
          Discard Insight
        </Button>
        <Button
          size="sm"
          className="flex-1 h-10 text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 rounded-full"
          onClick={onComplete}
        >
          <Check className="h-3.5 w-3.5" />
          Generate Brief
        </Button>
      </div>
    </div>
  );
}

// ─── Default Action Section (direct action with slider) ───

function DefaultActionSection({
  insight,
  budgetIntensity,
  onBudgetChange,
  onDiscard,
  onComplete,
}: {
  insight: Insight;
  budgetIntensity: number;
  onBudgetChange: (v: number) => void;
  onDiscard: () => void;
  onComplete: () => void;
}) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (stepId: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Action steps */}
      {insight.actionSteps.map((step) => {
        const done = completedSteps.has(step.id);
        return (
          <button
            key={step.id}
            onClick={() => toggleStep(step.id)}
            className={cn(
              'flex items-start gap-3 w-full text-left rounded-lg px-3 py-2.5 border transition-colors',
              done
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-border/20 bg-muted/10 hover:bg-muted/20'
            )}
          >
            {done ? (
              <Check className="h-5 w-5 text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/40 mt-0.5 shrink-0" />
            )}
            <div>
              <p className={cn('text-sm font-semibold', done && 'text-emerald-300/80')}>
                {step.title}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {step.subtitle}
              </p>
            </div>
          </button>
        );
      })}

      {/* Execution intensity slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold">Execution Intensity</p>
          <span className="text-xs text-muted-foreground font-medium">{budgetIntensity}%</span>
        </div>
        <div className="px-1">
          <Slider
            value={[budgetIntensity]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => onBudgetChange(v)}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
          <span>Conservative</span>
          <span>Aggressive</span>
        </div>
      </div>

      {/* Info disclaimer */}
      <div className="flex items-start gap-2.5 bg-muted/20 rounded-lg p-3">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Adjust how aggressively to apply this recommendation. The chart above reflects the projected improvement at the selected intensity.
        </p>
      </div>

      {/* Bottom action buttons */}
      <div className="flex items-center gap-3 pt-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-10 text-xs font-semibold gap-1.5 border-border/60 rounded-full"
          onClick={onDiscard}
        >
          <X className="h-3.5 w-3.5" />
          Discard Insight
        </Button>
        <Button
          size="sm"
          className="flex-1 h-10 text-xs font-semibold gap-1.5 bg-foreground text-background hover:bg-foreground/90 rounded-full"
          onClick={onComplete}
        >
          <Check className="h-3.5 w-3.5" />
          Launch
        </Button>
      </div>
    </div>
  );
}

// ─── Channel Bar Chart ───

function ChannelBarChart({
  channels,
  avgEngagementRate,
  efficiencyFormat = 'decimal-4',
}: {
  channels: ChannelAllocation[];
  avgEngagementRate: number;
  efficiencyFormat?: 'decimal-4' | 'decimal-2';
}) {
  const effDecimals = efficiencyFormat === 'decimal-4' ? 4 : 2;
  const maxEng = Math.max(
    ...channels.flatMap(c => [c.engagementRate, c.recommendedEngagementRate])
  );
  const maxSpend = Math.max(...channels.flatMap(c => [c.spend, c.recommendedSpend]));
  // Pad the top so the tallest bar reaches ~80% of the plot area.
  const chartMax = maxEng * 1.25;
  const spendMax = maxSpend * 1.25;
  const chartHeight = 220;
  const barAreaHeight = chartHeight - 30; // leave room for x-axis labels

  const groupWidth = 100 / channels.length;
  const avgPct = (avgEngagementRate / chartMax) * 100;

  return (
    <div className="relative" style={{ height: chartHeight }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-[30px] w-10 flex flex-col justify-between text-[9px] text-muted-foreground">
        {[chartMax, chartMax * 0.75, chartMax * 0.5, chartMax * 0.25, 0].map((v, i) => (
          <span key={i}>{v.toFixed(effDecimals === 4 ? (v < 0.01 ? 4 : 3) : 2)}</span>
        ))}
      </div>

      {/* Chart area */}
      <div className="ml-12 relative" style={{ height: barAreaHeight }}>
        {/* AVG line */}
        <div
          className="absolute left-0 right-0 border-t border-dashed border-muted-foreground/40 z-10 pointer-events-none"
          style={{ top: `${100 - avgPct}%` }}
        >
          <span className="absolute right-0 -top-3 text-[9px] text-muted-foreground">
            AVG {avgEngagementRate.toFixed(effDecimals)}
          </span>
        </div>

        {/* Channel groups */}
        <div className="flex h-full items-end">
          {channels.map((ch) => {
            const engHeight = (ch.engagementRate / chartMax) * 100;
            const recEngHeight = (ch.recommendedEngagementRate / chartMax) * 100;
            const isIncreased = ch.direction === 'increased';

            // Spend bars share the bar-area height but use spendMax for their scale.
            const spendHeight = (ch.spend / spendMax) * 100;
            const recSpendHeight = (ch.recommendedSpend / spendMax) * 100;

            const engBase = Math.min(engHeight, recEngHeight);
            const engDelta = Math.abs(recEngHeight - engHeight);
            const spendBase = Math.min(spendHeight, recSpendHeight);
            const spendDelta = Math.abs(recSpendHeight - spendHeight);
            const spendUp = ch.recommendedSpend > ch.spend;

            return (
              <div
                key={ch.channel}
                className="h-full flex items-end justify-center gap-1"
                style={{ width: `${groupWidth}%` }}
              >
                {/* Engagement rate bar */}
                <div className="relative h-full" style={{ width: 28 }}>
                  {/* Base bar */}
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-[#555] "
                    style={{ height: `${engBase}%`, minHeight: engBase > 0 ? 2 : 0 }}
                  />
                  {/* Delta cap */}
                  {engDelta > 0.5 && (
                    <div
                      className={cn(
                        'absolute left-0 right-0 ',
                        isIncreased ? 'border border-emerald-500/60' : 'border border-red-500/60'
                      )}
                      style={{
                        bottom: `${engBase}%`,
                        height: `${engDelta}%`,
                        backgroundImage: isIncreased
                          ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(34,197,94,0.25) 2px, rgba(34,197,94,0.25) 4px)'
                          : 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(239,68,68,0.25) 2px, rgba(239,68,68,0.25) 4px)',
                        backgroundColor: isIncreased ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                      }}
                    />
                  )}
                </div>

                {/* Spend bar */}
                <div className="relative h-full" style={{ width: 28 }}>
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-blue-500 "
                    style={{ height: `${spendBase}%`, minHeight: spendBase > 0 ? 2 : 0 }}
                  />
                  {spendDelta > 0.5 && (
                    <div
                      className={cn(
                        'absolute left-0 right-0 ',
                        spendUp ? 'border border-emerald-500/60' : 'border border-red-500/60'
                      )}
                      style={{
                        bottom: `${spendBase}%`,
                        height: `${spendDelta}%`,
                        backgroundImage: spendUp
                          ? 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(34,197,94,0.25) 2px, rgba(34,197,94,0.25) 4px)'
                          : 'repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(239,68,68,0.25) 2px, rgba(239,68,68,0.25) 4px)',
                        backgroundColor: spendUp ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="ml-12 flex h-[30px] items-center">
        {channels.map((ch) => (
          <div
            key={ch.channel}
            className="text-center text-xs text-muted-foreground font-medium"
            style={{ width: `${groupWidth}%` }}
          >
            {ch.channel}
          </div>
        ))}
      </div>
    </div>
  );
}
