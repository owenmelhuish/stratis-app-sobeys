"use client";

import React, { useState, useCallback } from 'react';
import { X, MapPin, Store, ArrowRight, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { getNode } from '@/lib/molecular-graph';
import { MolecularScene } from './molecular-scene';
import { MolecularPanel } from './molecular-panel';
import { DealershipMolecularScene } from './dealership-molecular-scene';
import { getDealerById, MOLECULAR_REGION_LABELS, MOLECULAR_REGION_COLORS } from '@/lib/dealers';
import type { MolecularNode } from '@/lib/molecular-graph';
import type { ChannelId, GeoId, CampaignObjective, DivisionId, AgencyId, ProductLineId, AudienceId } from '@/types';
import { cn } from '@/lib/utils';

interface MolecularFilterOverlayProps {
  onClose: () => void;
}

export function MolecularFilterOverlay({ onClose }: MolecularFilterOverlayProps) {
  const selectedEnterprise = useAppStore((s) => s.selectedEnterprise);

  if (selectedEnterprise === 'dealership-network') {
    return <DealershipFilterOverlay onClose={onClose} />;
  }
  return <DefaultFilterOverlay onClose={onClose} />;
}

// ===== Default (Sobeys / Farm Boy) =====
function DefaultFilterOverlay({ onClose }: MolecularFilterOverlayProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredNode, setHoveredNode] = useState<MolecularNode | null>(null);

  const {
    setSelectedDivisions, setSelectedAgencies, setSelectedProductLines,
    setSelectedAudiences, setSelectedGeos, setSelectedChannels,
    setSelectedCampaigns, setSelectedObjectives,
    setMolecularSelections, setMolecularFilterOpen,
    theme,
  } = useAppStore();

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (id === 'sobeys') return new Set();
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDeselect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleApply = useCallback(() => {
    const selectedNodes = Array.from(selectedIds)
      .map(id => getNode(id))
      .filter(Boolean) as MolecularNode[];

    const divisions = selectedNodes.filter(n => n.filterType === 'division').map(n => n.filterValue as DivisionId);
    const agencies = selectedNodes.filter(n => n.filterType === 'agency').map(n => n.filterValue as AgencyId);
    const productLines = selectedNodes.filter(n => n.filterType === 'productLine').map(n => n.filterValue as ProductLineId);
    const audiences = selectedNodes.filter(n => n.filterType === 'audience').map(n => n.filterValue as AudienceId);
    const campaigns = selectedNodes.filter(n => n.filterType === 'campaign').map(n => n.filterValue!);
    const channels = selectedNodes.filter(n => n.filterType === 'channel').map(n => n.filterValue as ChannelId);
    const geos = selectedNodes.filter(n => n.filterType === 'geo').map(n => n.filterValue as GeoId);
    const objectives = selectedNodes.filter(n => n.filterType === 'funnel').map(n => n.filterValue as CampaignObjective);

    if (divisions.length > 0) setSelectedDivisions(divisions);
    if (agencies.length > 0) setSelectedAgencies(agencies);
    if (productLines.length > 0) setSelectedProductLines(productLines);
    if (audiences.length > 0) setSelectedAudiences(audiences);
    if (campaigns.length > 0) setSelectedCampaigns(campaigns);
    if (channels.length > 0) setSelectedChannels(channels);
    if (geos.length > 0) setSelectedGeos(geos);
    if (objectives.length > 0) setSelectedObjectives(objectives);

    setMolecularSelections(Array.from(selectedIds));
    setMolecularFilterOpen(false);
    onClose();
  }, [selectedIds, setSelectedDivisions, setSelectedAgencies, setSelectedProductLines, setSelectedAudiences, setSelectedCampaigns, setSelectedChannels, setSelectedGeos, setSelectedObjectives, setMolecularSelections, setMolecularFilterOpen, onClose]);

  const handleCancel = useCallback(() => {
    setMolecularFilterOpen(false);
    onClose();
  }, [setMolecularFilterOpen, onClose]);

  const handleHover = useCallback((node: MolecularNode | null) => {
    setHoveredNode(node);
  }, []);

  return (
    <div className="absolute inset-0 bg-background flex">
      <div className="flex-1 relative">
        <MolecularScene
          selectedIds={selectedIds}
          onSelect={handleSelect}
          hoveredNode={hoveredNode}
          onHover={handleHover}
          theme={theme}
        />
        <button
          onClick={handleCancel}
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card-elevated/80 backdrop-blur border border-border/30 text-muted-foreground hover:text-foreground transition-colors text-xs"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
        <div className="absolute bottom-4 left-4 z-10 px-3 py-2.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/30 space-y-1">
          {[
            ['#1B4DA0', 'Sobeys (nucleus)'],
            ['#7F77DD', 'Tiers & Agencies'],
            ['#1D9E75', 'Categories'],
            ['#D85A30', 'Audiences'],
            ['#5DCAA5', 'Campaigns'],
            ['#378ADD', 'Execution'],
          ].map(([color, label]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-[280px] shrink-0 border-l border-border/30 bg-background p-4 overflow-y-auto">
        <MolecularPanel
          selectedIds={selectedIds}
          onDeselect={handleDeselect}
          onClearAll={handleClearAll}
          onApply={handleApply}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}

// ===== Dealership Network =====
function DealershipFilterOverlay({ onClose }: MolecularFilterOverlayProps) {
  const [selectedRegionIds, setSelectedRegionIds] = useState<Set<string>>(new Set());
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [hoveredDealerId, setHoveredDealerId] = useState<string | null>(null);
  const [pendingDealerId, setPendingDealerId] = useState<string | null>(null);

  const {
    setSelectedGeos, setSelectedDealer,
    setMolecularFilterOpen,
    theme,
  } = useAppStore();

  const handleRegionSelect = useCallback((id: string) => {
    setSelectedRegionIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDealerSelect = useCallback((id: string) => {
    setPendingDealerId(prev => prev === id ? null : id);
  }, []);

  const handleClearAll = useCallback(() => {
    setSelectedRegionIds(new Set());
    setPendingDealerId(null);
  }, []);

  const handleApply = useCallback(() => {
    // Map region selections back to GeoId. Prairies maps to alberta.
    const REGION_TO_GEO: Record<string, GeoId> = {
      ontario: 'ontario', quebec: 'quebec', bc: 'bc', alberta: 'alberta',
      atlantic: 'atlantic', prairies: 'alberta',
    };
    const geos = Array.from(selectedRegionIds)
      .map((id) => id.replace('region-', ''))
      .map((r) => REGION_TO_GEO[r])
      .filter(Boolean) as GeoId[];

    if (geos.length > 0) setSelectedGeos(geos);
    setSelectedDealer(pendingDealerId);
    setMolecularFilterOpen(false);
    onClose();
  }, [selectedRegionIds, pendingDealerId, setSelectedGeos, setSelectedDealer, setMolecularFilterOpen, onClose]);

  const handleCancel = useCallback(() => {
    setMolecularFilterOpen(false);
    onClose();
  }, [setMolecularFilterOpen, onClose]);

  const pendingDealer = pendingDealerId ? getDealerById(pendingDealerId) : null;
  const totalSelections = selectedRegionIds.size + (pendingDealerId ? 1 : 0);

  return (
    <div className="absolute inset-0 bg-background flex">
      <div className="flex-1 relative">
        <DealershipMolecularScene
          selectedIds={selectedRegionIds}
          selectedDealerId={pendingDealerId}
          onSelect={handleRegionSelect}
          onSelectDealer={handleDealerSelect}
          hoveredId={hoveredRegionId}
          hoveredDealerId={hoveredDealerId}
          onHover={setHoveredRegionId}
          onHoverDealer={setHoveredDealerId}
          theme={theme}
        />
        <button
          onClick={handleCancel}
          className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card-elevated/80 backdrop-blur border border-border/30 text-muted-foreground hover:text-foreground transition-colors text-xs"
        >
          <X className="h-3.5 w-3.5" />
          Close
        </button>
        {/* Region color legend */}
        <div className="absolute bottom-4 left-4 z-10 px-3 py-2.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/30 space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground/70 mb-1.5">Regions</p>
          {Object.entries(MOLECULAR_REGION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MOLECULAR_REGION_COLORS[key] }} />
              <span className="text-[11px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selection panel */}
      <div className="w-[300px] shrink-0 border-l border-border/30 bg-background flex flex-col">
        <div className="p-4 border-b border-border/30">
          <h2 className="text-sm font-bold">Selection</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {totalSelections === 0 ? 'Click regions or dealers to filter' : `${totalSelections} active`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Selected regions */}
          {selectedRegionIds.size > 0 && (
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground/70 mb-2">
                Regions ({selectedRegionIds.size})
              </p>
              <div className="space-y-1.5">
                {Array.from(selectedRegionIds).map((id) => {
                  const region = id.replace('region-', '');
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card-elevated/40 border border-border/30"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MOLECULAR_REGION_COLORS[region] }} />
                        <MapPin className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                        <span className="text-xs font-medium truncate">{MOLECULAR_REGION_LABELS[region]}</span>
                      </div>
                      <button
                        onClick={() => handleRegionSelect(id)}
                        className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected dealer */}
          {pendingDealer && (
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] uppercase text-muted-foreground/70 mb-2">
                Dealer
              </p>
              <div className="flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg bg-card-elevated/40 border border-border/30">
                <div className="flex items-start gap-2 min-w-0">
                  <Store className="h-3 w-3 text-muted-foreground/60 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{pendingDealer.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {pendingDealer.city} · ${(pendingDealer.monthlySpend / 1000).toFixed(1)}K/mo
                    </p>
                    <p className={cn(
                      'text-[10px] mt-0.5 capitalize',
                      pendingDealer.complianceStatus === 'compliant' && 'text-emerald-400',
                      pendingDealer.complianceStatus === 'at-risk' && 'text-amber-400',
                      pendingDealer.complianceStatus === 'violation' && 'text-red-400',
                    )}>
                      {pendingDealer.complianceStatus.replace('-', ' ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPendingDealerId(null)}
                  className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}

          {totalSelections === 0 && (
            <div className="py-8 text-center">
              <p className="text-xs text-muted-foreground/60">
                Click any region or dealer in the molecule to start filtering corporate visibility into this store network.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/30 space-y-2">
          {totalSelections > 0 && (
            <button
              onClick={handleClearAll}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </button>
          )}
          <button
            onClick={handleApply}
            disabled={totalSelections === 0}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors',
              totalSelections === 0
                ? 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                : 'bg-orange/15 text-orange hover:bg-orange/25 border border-orange/30',
            )}
          >
            Apply filter
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
