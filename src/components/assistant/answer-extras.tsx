"use client";

import React, { useState } from "react";
import {
  Bar, BarChart, Line, LineChart, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Database, ChevronDown, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChartSpec {
  type: "bar" | "line" | "area";
  title?: string;
  xKey: string;
  series: { key: string; label?: string }[];
  data: Record<string, unknown>[];
}

export interface Step {
  query: string;
  rowCount: number;
  columns: string[];
  sample: Record<string, unknown>[];
  error?: string;
}

// Teal-forward palette to match the assistant theme.
const COLORS = ["#14b8a6", "#6366f1", "#f59e0b", "#ec4899", "#22c55e", "#06b6d4"];

export function AnswerChart({ spec }: { spec: ChartSpec }) {
  if (!spec?.data?.length || !spec.series?.length) return null;

  const axisProps = {
    stroke: "currentColor",
    tick: { fontSize: 11, fill: "currentColor" },
    tickLine: false,
    axisLine: false,
  };

  const common = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} vertical={false} />
      <XAxis dataKey={spec.xKey} {...axisProps} interval={0} angle={spec.data.length > 5 ? -25 : 0}
        textAnchor={spec.data.length > 5 ? "end" : "middle"} height={spec.data.length > 5 ? 56 : 24} />
      <YAxis {...axisProps} width={48} />
      <Tooltip
        contentStyle={{
          background: "rgba(20,20,24,0.95)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 10, fontSize: 12, color: "#fff",
        }}
        cursor={{ fill: "rgba(20,184,166,0.06)" }}
      />
      {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
    </>
  );

  return (
    <div className="mt-3 rounded-xl border border-border/30 bg-background/40 p-3 text-muted-foreground">
      {spec.title && (
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-teal/80">{spec.title}</p>
      )}
      <ResponsiveContainer width="100%" height={240}>
        {spec.type === "line" ? (
          <LineChart data={spec.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            {common}
            {spec.series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key}
                stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        ) : spec.type === "area" ? (
          <AreaChart data={spec.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            {common}
            {spec.series.map((s, i) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label ?? s.key}
                stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={spec.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            {common}
            {spec.series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label ?? s.key}
                fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function EvidencePanel({ steps }: { steps: Step[] }) {
  const [open, setOpen] = useState(false);
  if (!steps?.length) return null;

  const totalRows = steps.reduce((n, s) => n + s.rowCount, 0);

  return (
    <div className="mt-3 rounded-xl border border-border/30 bg-background/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-medium text-muted-foreground/80 transition-colors hover:text-foreground"
      >
        <Database className="h-3.5 w-3.5 text-teal/70" />
        <span>
          Grounded in {steps.length} quer{steps.length === 1 ? "y" : "ies"} · {totalRows.toLocaleString()} rows
        </span>
        <ChevronDown className={cn("ml-auto h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border/20 px-3 py-3">
          {steps.map((s, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                {s.error ? (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                ) : (
                  <Check className="h-3 w-3 text-teal" />
                )}
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50">
                  {s.error ? "Query failed" : `${s.rowCount.toLocaleString()} rows`}
                </span>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-2 text-[10.5px] leading-relaxed text-teal/90">
                <code>{s.query}</code>
              </pre>
              {s.error ? (
                <p className="px-1 text-[10.5px] text-amber-500/80">{s.error}</p>
              ) : s.sample.length > 0 ? (
                <EvidenceTable columns={s.columns} rows={s.sample.slice(0, 6)} more={s.rowCount - Math.min(6, s.sample.length)} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EvidenceTable({ columns, rows, more }: { columns: string[]; rows: Record<string, unknown>[]; more: number }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/20">
      <table className="w-full text-[10.5px]">
        <thead>
          <tr className="border-b border-border/20 bg-muted/20">
            {columns.map((c) => (
              <th key={c} className="px-2 py-1 text-left font-semibold text-muted-foreground/70">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border/10 last:border-0">
              {columns.map((c) => (
                <td key={c} className="px-2 py-1 text-muted-foreground/80">{formatCell(r[c])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {more > 0 && (
        <p className="px-2 py-1 text-[10px] text-muted-foreground/40">+{more.toLocaleString()} more rows</p>
      )}
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") {
    if (!Number.isInteger(v)) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return v.toLocaleString();
  }
  return String(v);
}
