"use client";
import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Newspaper, Lightbulb, Paintbrush, MessageSquareText, FlaskConical, BarChart3, DollarSign, TrendingUp, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { generateAllData } from '@/lib/mock-data';

const navSections = [
  {
    label: 'GENERAL',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { href: '/news', label: 'STRATIS Radar', icon: Newspaper },
      { href: '/insights', label: 'STRATIS Signals', icon: Lightbulb },
    ],
  },
  {
    label: 'ASSISTANT',
    items: [
      { href: '/assistant', label: 'STRATIS Assistant', icon: MessageSquareText },
    ],
  },
  {
    label: 'LAUNCH',
    items: [
      { href: '/launch-campaign', label: 'Launch Campaign', icon: Rocket },
    ],
  },
  {
    label: 'CREATIVE',
    items: [
      { href: '/creative-studio', label: 'Creative Studio', icon: Paintbrush, comingSoon: true },
    ],
  },
  {
    label: 'SIMULATION',
    items: [
      { href: '/simulation', label: 'Simulation Sandbox', icon: FlaskConical, comingSoon: true },
    ],
  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const selectedEnterprise = useAppStore((s) => s.selectedEnterprise);

  const stats = useMemo(() => {
    const store = generateAllData(selectedEnterprise ?? 'ford-canada');
    const totalSpend = store.campaigns.reduce((s, c) => s + c.plannedBudget, 0);
    const allDays = Object.values(store.dailyData)
      .flatMap((byCh) => Object.values(byCh))
      .flat();
    const aggRevenue = allDays.reduce((sum, d) => sum + d.revenue, 0);
    const aggSpend = allDays.reduce((sum, d) => sum + d.spend, 0);
    const avgRoas = aggSpend > 0 ? aggRevenue / aggSpend : 0;
    const fmtMoney = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(0)}M` : `$${(v / 1000).toFixed(0)}K`;
    return {
      campaigns: store.campaigns.length,
      totalSpend: fmtMoney(totalSpend),
      avgRoas: avgRoas > 0 ? `${avgRoas.toFixed(1)}x` : '—',
    };
  }, [selectedEnterprise]);

  return (
    <aside className="w-[240px] shrink-0 border-r border-border/30 bg-sidebar flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <img src="/stratis-logo.svg" alt="STRATIS" className="h-5 invert" />
        </Link>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 px-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="px-3 mb-3 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.2em]">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all relative",
                      isActive
                        ? "text-teal"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 bg-teal rounded-r-full" />
                    )}
                    <item.icon className={cn("h-[18px] w-[18px]", isActive && "text-teal")} />
                    {item.label}
                    {'comingSoon' in item && item.comingSoon && (
                      <span className="ml-auto text-[9px] font-semibold text-teal/70 bg-teal/10 px-1.5 py-0.5 rounded-full">Soon</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom stats card */}
      <div className="px-4 pb-4 mt-auto">
        <div className="rounded-xl bg-card-elevated/40 border border-border/30 p-4 space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.2em]">Quick Stats</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-[12px] text-muted-foreground">Campaigns</span>
            </div>
            <span className="text-[13px] font-bold text-foreground">{stats.campaigns}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-[12px] text-muted-foreground">Total Spend</span>
            </div>
            <span className="text-[13px] font-bold text-foreground">{stats.totalSpend}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-teal" />
              <span className="text-[12px] text-muted-foreground">Avg ROAS</span>
            </div>
            <span className="text-[13px] font-bold text-teal">{stats.avgRoas}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
