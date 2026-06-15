"use client";

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import {
  MOLECULAR_NODES, MOLECULAR_BONDS, RING_COLORS,
  traceLineage, getNode, type MolecularNode,
} from '@/lib/molecular-graph';

const RING_NAMES: Record<number, string> = {
  0: 'Nucleus',
  1: 'Tiers & Agencies',
  2: 'Categories',
  3: 'Audiences',
  4: 'Campaigns',
  5: 'Execution',
};

const FILTER_TYPE_LABELS: Record<string, string> = {
  division: 'Tier',
  agency: 'Agency',
  productLine: 'Category',
  audience: 'Audience',
  campaign: 'Campaign',
  channel: 'Channel',
  funnel: 'Objective',
  geo: 'Region',
};

interface MolecularPanelProps {
  selectedIds: Set<string>;
  onDeselect: (id: string) => void;
  onClearAll: () => void;
  onApply: () => void;
  onCancel: () => void;
}

export function MolecularPanel({ selectedIds, onDeselect, onClearAll, onApply, onCancel }: MolecularPanelProps) {
  const selectedNodes = useMemo(() => {
    return Array.from(selectedIds).map(id => getNode(id)).filter(Boolean) as MolecularNode[];
  }, [selectedIds]);

  const { litNodes } = useMemo(
    () => traceLineage(selectedIds),
    [selectedIds],
  );

  // Group lit nodes by ring
  const litByRing = useMemo(() => {
    const groups = new Map<number, MolecularNode[]>();
    for (const id of litNodes) {
      if (selectedIds.has(id)) continue; // Don't show selected nodes in lineage
      const node = getNode(id);
      if (!node) continue;
      if (!groups.has(node.ring)) groups.set(node.ring, []);
      groups.get(node.ring)!.push(node);
    }
    return groups;
  }, [litNodes, selectedIds]);

  // Derive filter summary
  const filterSummary = useMemo(() => {
    const summary: Record<string, string[]> = {};
    for (const node of selectedNodes) {
      if (!node.filterType) continue;
      const label = FILTER_TYPE_LABELS[node.filterType] ?? node.filterType;
      if (!summary[label]) summary[label] = [];
      summary[label].push(node.label);
    }
    return summary;
  }, [selectedNodes]);

  const ringColorForNode = (node: MolecularNode) => {
    const colors = [RING_COLORS.nucleus, RING_COLORS.org, RING_COLORS.product, RING_COLORS.audience, RING_COLORS.campaign, RING_COLORS.exec];
    return colors[node.ring] ?? '#888';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">Molecular Filter</h2>
        <p className="text-[10px] text-muted-foreground">
          Click nodes to select. Lineage traces upstream to Sobeys and downstream to execution.
        </p>
      </div>

      {/* Selection pills */}
      {selectedNodes.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {selectedNodes.length === 1 ? selectedNodes[0].label : `${selectedNodes.length} nodes selected`}
            </p>
            <button onClick={onClearAll} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedNodes.map(node => (
              <Badge
                key={node.id}
                className="text-[10px] gap-1 cursor-pointer hover:opacity-80 transition-opacity border-0"
                style={{ backgroundColor: `${ringColorForNode(node)}22`, color: ringColorForNode(node) }}
                onClick={() => onDeselect(node.id)}
              >
                {node.label}
                <X className="h-2.5 w-2.5" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Description */}
      {selectedNodes.length === 1 && (
        <p className="text-[11px] text-muted-foreground mb-3">{selectedNodes[0].description}</p>
      )}

      {/* Filter mapping */}
      {Object.keys(filterSummary).length > 0 && (
        <div className="mb-3 p-2.5 rounded-lg bg-muted/20 border border-border/20">
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Filters to apply</p>
          <div className="space-y-1">
            {Object.entries(filterSummary).map(([type, values]) => (
              <div key={type} className="flex gap-1.5">
                <span className="text-[10px] text-muted-foreground shrink-0">{type}:</span>
                <span className="text-[10px] text-foreground">{values.join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lineage summary */}
      {litNodes.size > 0 && (
        <div className="flex-1 overflow-y-auto mb-3">
          <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wider">Lineage</p>
          <div className="space-y-2">
            {Array.from(litByRing.entries())
              .sort(([a], [b]) => a - b)
              .map(([ring, nodes]) => (
                <div key={ring}>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{RING_NAMES[ring]}</p>
                  <div className="flex flex-wrap gap-1">
                    {nodes.map(n => (
                      <span
                        key={n.id}
                        className="text-[10px] px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: `${ringColorForNode(n)}15`, color: ringColorForNode(n) }}
                      >
                        {n.label}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedIds.size === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">No nodes selected</p>
            <p className="text-[10px] text-muted-foreground/60">Click any node in the 3D view to begin</p>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="pt-3 border-t border-border/20 space-y-2 mt-auto">
        <Button
          onClick={onApply}
          disabled={selectedIds.size === 0}
          className="w-full h-8 text-xs bg-teal hover:bg-teal/90 text-background font-medium"
        >
          Apply Filters ({selectedIds.size})
        </Button>
        <Button
          onClick={onCancel}
          variant="outline"
          className="w-full h-8 text-xs border-border/30 text-muted-foreground hover:text-foreground"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
