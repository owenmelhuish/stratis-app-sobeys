"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { ENTERPRISES, type EnterpriseId } from '@/types';
import { EnterpriseMolecularScene } from '@/components/molecular';
import { getBrandGraph, BRAND_COLORS, type BrandNode } from '@/lib/brand-graph';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export default function SelectEnterprisePage() {
  const router = useRouter();
  const setSelectedEnterprise = useAppStore((s) => s.setSelectedEnterprise);
  const drillToCampaign = useAppStore((s) => s.drillToCampaign);
  const currentEnterprise = useAppStore((s) => s.selectedEnterprise);
  const theme = useAppStore((s) => s.theme);

  // ----- Label filter state (which titles show at rest) -----
  const [showBrands, setShowBrands] = useState(true);
  const [showCampaigns, setShowCampaigns] = useState(true);
  const [clientOn, setClientOn] = useState<Record<EnterpriseId, boolean>>(
    () => Object.fromEntries(ENTERPRISES.map((e) => [e.id, true])) as Record<EnterpriseId, boolean>,
  );

  // Campaign count per client (for the panel rows)
  const campaignCounts = useMemo(() => {
    const counts = {} as Record<EnterpriseId, number>;
    for (const e of ENTERPRISES) counts[e.id] = 0;
    for (const n of getBrandGraph().nodes) {
      if (n.kind === 'campaign' && n.enterpriseId) counts[n.enterpriseId] += 1;
    }
    return counts;
  }, []);

  const labelFilter = useCallback(
    (node: BrandNode) => {
      if (node.kind === 'nucleus') return true;
      const ent = node.enterpriseId;
      if (ent && !clientOn[ent]) return false;
      if (node.kind === 'brand') return showBrands;
      if (node.kind === 'campaign') return showCampaigns;
      return true;
    },
    [showBrands, showCampaigns, clientOn],
  );

  const setAllClients = (value: boolean) =>
    setClientOn(Object.fromEntries(ENTERPRISES.map((e) => [e.id, value])) as Record<EnterpriseId, boolean>);

  const allOn = showBrands && showCampaigns && ENTERPRISES.every((e) => clientOn[e.id]);
  const showAll = () => { setShowBrands(true); setShowCampaigns(true); setAllClients(true); };
  const showNone = () => { setShowBrands(false); setShowCampaigns(false); setAllClients(false); };

  // Brand atom → enter the brand instance.
  const handleSelectBrand = (id: EnterpriseId) => {
    setSelectedEnterprise(id);
    router.push('/dashboard');
  };

  // Campaign atom → enter the brand instance drilled straight into that campaign.
  const handleSelectCampaign = (id: EnterpriseId, campaignId: string) => {
    setSelectedEnterprise(id); // resets drill-down state for the new enterprise
    drillToCampaign(campaignId);
    router.push('/dashboard');
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* 3D molecular scene — agency → brands → campaigns */}
      <EnterpriseMolecularScene
        currentEnterprise={currentEnterprise}
        onSelectBrand={handleSelectBrand}
        onSelectCampaign={handleSelectCampaign}
        labelFilter={labelFilter}
        theme={theme}
      />

      {/* Agency-view framing — top-left */}
      <div className="absolute top-8 left-8 z-10 pointer-events-none">
        <p className="text-[10px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
          STRATIS · Agency View
        </p>
        <p className="text-sm font-medium text-foreground/80 mt-1">
          Select a client — or drill into one of its campaigns
        </p>
      </div>

      {/* Label filter panel — left rail */}
      <div className="absolute left-8 top-24 z-20 w-64 rounded-xl border border-border/40 bg-card-elevated/85 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-foreground">Labels</p>
          <div className="flex items-center gap-1">
            <button
              onClick={showAll}
              className={cn('text-[10px] px-1.5 py-0.5 rounded transition-colors', allOn ? 'text-teal' : 'text-muted-foreground hover:text-foreground')}
            >
              All
            </button>
            <span className="text-muted-foreground/40 text-[10px]">/</span>
            <button onClick={showNone} className="text-[10px] px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground transition-colors">
              None
            </button>
          </div>
        </div>

        {/* Layers */}
        <div className="px-4 pb-2">
          <p className="text-[9px] font-semibold tracking-[0.16em] uppercase text-muted-foreground/70 mb-1.5">Layer</p>
          <FilterRow label="Brands" checked={showBrands} onToggle={() => setShowBrands((v) => !v)} swatch="#9AA1A9" />
          <FilterRow label="Campaigns" checked={showCampaigns} onToggle={() => setShowCampaigns((v) => !v)} swatch="#9AA1A9" />
        </div>

        <div className="mx-4 border-t border-border/30" />

        {/* Clients */}
        <div className="px-4 py-2 max-h-[46vh] overflow-auto">
          <p className="text-[9px] font-semibold tracking-[0.16em] uppercase text-muted-foreground/70 mb-1.5">Clients</p>
          {ENTERPRISES.map((e) => (
            <FilterRow
              key={e.id}
              label={e.name}
              meta={`${campaignCounts[e.id]}`}
              checked={clientOn[e.id]}
              onToggle={() => setClientOn((s) => ({ ...s, [e.id]: !s[e.id] }))}
              swatch={BRAND_COLORS[e.id]}
            />
          ))}
        </div>

        <div className="px-4 pb-3 pt-1">
          <p className="text-[10px] leading-snug text-muted-foreground/70">
            Hovering an atom always reveals its title.
          </p>
        </div>
      </div>
    </div>
  );
}

function FilterRow({
  label, checked, onToggle, swatch, meta,
}: {
  label: string; checked: boolean; onToggle: () => void; swatch: string; meta?: string;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1 px-1 -mx-1 rounded hover:bg-muted/40 cursor-pointer">
      <Checkbox checked={checked} onCheckedChange={onToggle} className="h-3.5 w-3.5" />
      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: swatch, opacity: checked ? 1 : 0.35 }} />
      <span className={cn('text-xs flex-1 truncate', checked ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
      {meta && <span className="text-[10px] tabular-nums text-muted-foreground/60">{meta}</span>}
    </label>
  );
}
