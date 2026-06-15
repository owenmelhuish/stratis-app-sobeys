"use client";
import React from 'react';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DIVISION_LABELS,
  AGENCY_LABELS,
  PRODUCT_LINE_LABELS,
  type DivisionId,
  type AgencyId,
  type ProductLineId,
} from '@/types';
import { SectionCard } from './section-card';

const DIVISIONS = Object.keys(DIVISION_LABELS) as DivisionId[];
const AGENCIES = Object.keys(AGENCY_LABELS) as AgencyId[];
const PRODUCT_LINES = Object.keys(PRODUCT_LINE_LABELS) as ProductLineId[];

export function CampaignEssentials() {
  const draft = useAppStore((s) => s.draftCampaign);
  const setField = useAppStore((s) => s.setDraftCampaignField);

  const filled = Boolean(draft.name && draft.division && draft.productLine && draft.agency);

  return (
    <SectionCard
      id="essentials"
      number={1}
      title="Campaign Essentials"
      subtitle="Who and what is STRATIS building for?"
      filled={filled}
    >
      <div className="space-y-2">
        <Label htmlFor="campaign-name" className="text-[12px] text-muted-foreground">Campaign Name</Label>
        <Input
          id="campaign-name"
          placeholder="e.g. Scene+ Summer Activation"
          value={draft.name}
          onChange={(e) => setField('name', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label className="text-[12px] text-muted-foreground">Division</Label>
          <Select
            value={draft.division || undefined}
            onValueChange={(v) => setField('division', v as DivisionId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select division" />
            </SelectTrigger>
            <SelectContent>
              {DIVISIONS.map((id) => (
                <SelectItem key={id} value={id}>{DIVISION_LABELS[id]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[12px] text-muted-foreground">Product Line</Label>
          <Select
            value={draft.productLine || undefined}
            onValueChange={(v) => setField('productLine', v as ProductLineId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select product" />
            </SelectTrigger>
            <SelectContent>
              {PRODUCT_LINES.map((id) => (
                <SelectItem key={id} value={id}>{PRODUCT_LINE_LABELS[id]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[12px] text-muted-foreground">Agency</Label>
          <Select
            value={draft.agency || undefined}
            onValueChange={(v) => setField('agency', v as AgencyId)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select agency" />
            </SelectTrigger>
            <SelectContent>
              {AGENCIES.map((id) => (
                <SelectItem key={id} value={id}>{AGENCY_LABELS[id]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </SectionCard>
  );
}
