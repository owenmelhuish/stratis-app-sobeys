"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import type { Campaign, AggregatedKPIs } from "@/types";
import { divisionLabel } from "@/types";
import { formatCurrency, formatKPIValue } from "@/lib/format";

interface CampaignOverviewChartProps {
  campaignData: Array<{ campaign: Campaign; kpis: AggregatedKPIs }>;
}

const CAMPAIGN_COLORS = [
  "#e07060",
  "#50b89a",
  "#6b8aad",
  "#8b7ec8",
  "#f0a050",
  "#c76be0",
  "#5ab8d0",
  "#d06090",
  "#70c070",
  "#b8a060",
  "#60a0d0",
  "#d0a070",
];

const MAX_CAMPAIGNS = 12;

export function CampaignOverviewChart({ campaignData }: CampaignOverviewChartProps) {
  const allActive = campaignData
    .filter((d) => d.campaign.status === "live")
    .sort((a, b) => b.kpis.spend - a.kpis.spend);

  const active = allActive.slice(0, MAX_CAMPAIGNS);
  const rest = allActive.slice(MAX_CAMPAIGNS);
  const restSpend = rest.reduce((s, d) => s + d.kpis.spend, 0);

  const totalSpend = allActive.reduce((s, d) => s + d.kpis.spend, 0);

  return (
    <div className="rounded-xl border border-border/40 bg-card p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold tracking-wide">Active Campaigns</h3>
        <Badge variant="outline" className="text-[10px]">
          {active.length} live
        </Badge>
      </div>
      <p className="text-[11px] text-muted-foreground mb-5">
        Spend distribution across active campaigns
      </p>

      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted-foreground text-[10px] uppercase tracking-wider border-b border-border/30">
              <th className="text-left pb-2 font-medium">Campaign</th>
              <th className="text-left pb-2 font-medium">Division</th>
              <th className="text-right pb-2 font-medium">Spend</th>
              <th className="text-right pb-2 font-medium">% of Total</th>
              <th className="text-right pb-2 font-medium">ROAS</th>
              <th className="text-right pb-2 font-medium">CPA</th>
              <th className="text-right pb-2 font-medium">Conv.</th>
              <th className="text-right pb-2 font-medium">Impressions</th>
              <th className="text-right pb-2 font-medium">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {active.map((d, i) => (
              <tr
                key={d.campaign.id}
                className="border-b border-border/20 hover:bg-muted/30 transition-colors"
              >
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: CAMPAIGN_COLORS[i % CAMPAIGN_COLORS.length] }}
                    />
                    <span className="font-medium truncate max-w-[200px]">
                      {d.campaign.name}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-muted-foreground">
                  {divisionLabel(d.campaign.division, d.campaign.enterprise)}
                </td>
                <td className="text-right py-2.5 tabular-nums">
                  {formatCurrency(d.kpis.spend)}
                </td>
                <td className="text-right py-2.5 tabular-nums text-muted-foreground">
                  {totalSpend > 0 ? ((d.kpis.spend / totalSpend) * 100).toFixed(1) : "0.0"}%
                </td>
                <td className="text-right py-2.5 tabular-nums">
                  {formatKPIValue(d.kpis.roas, "decimal")}
                </td>
                <td className="text-right py-2.5 tabular-nums">
                  {formatCurrency(d.kpis.cpa)}
                </td>
                <td className="text-right py-2.5 tabular-nums">
                  {formatKPIValue(d.kpis.conversions, "number")}
                </td>
                <td className="text-right py-2.5 tabular-nums">
                  {formatKPIValue(d.kpis.impressions, "number")}
                </td>
                <td className="text-right py-2.5 tabular-nums">
                  {formatKPIValue(d.kpis.clicks, "number")}
                </td>
              </tr>
            ))}
          </tbody>
          {rest.length > 0 && (
            <tfoot>
              <tr className="border-t border-border/40 text-muted-foreground">
                <td className="py-2.5 pr-3 font-medium" colSpan={2}>
                  Other ({rest.length} campaigns)
                </td>
                <td className="text-right py-2.5 tabular-nums">{formatCurrency(restSpend)}</td>
                <td className="text-right py-2.5 tabular-nums">
                  {totalSpend > 0 ? ((restSpend / totalSpend) * 100).toFixed(1) : "0.0"}%
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
