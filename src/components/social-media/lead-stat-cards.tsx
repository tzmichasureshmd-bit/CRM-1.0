"use client";

import Link from "next/link";
import { Loader2, UsersRound, Sparkles, ArrowRight } from "lucide-react";

export interface LeadStats {
  total_leads: number;
  new_leads: number;
  facebook_leads: number;
  instagram_leads: number;
  today_leads: number;
  month_leads: number;
}

function hrefFor(kind: string): string {
  switch (kind) {
    case "total":
      return "/contacts?tab=meta_leads";
    case "new":
      return "/contacts?tab=new_leads";
    case "facebook":
      return "/contacts?tab=facebook_leads";
    case "instagram":
      return "/contacts?tab=instagram_leads";
    case "today":
      return "/contacts?tab=meta_leads&created=today";
    case "month":
      return "/contacts?tab=meta_leads&created=this_month";
    default:
      return "/contacts?tab=meta_leads";
  }
}

interface Box {
  key: string;
  label: string;
  value: number;
  highlight?: boolean;
  accentClass: string;
}

/**
 * Six clickable lead-stat boxes shared by the Dashboard ("Lead Overview")
 * and the Social Media page. Values come from the server `count_meta_leads`
 * RPC — never mock data. Each box deep-links to a filtered Contacts view.
 */
export function LeadStatCards({
  stats,
  loading,
}: {
  stats: LeadStats | null;
  loading?: boolean;
}) {
  const boxes: Box[] = [
    {
      key: "total",
      label: "Total Leads",
      value: stats?.total_leads ?? 0,
      highlight: true,
      accentClass: "bg-primary/10 text-primary",
    },
    {
      key: "new",
      label: "New Leads",
      value: stats?.new_leads ?? 0,
      accentClass: "bg-emerald-500/10 text-emerald-500",
    },
    {
      key: "facebook",
      label: "Facebook",
      value: stats?.facebook_leads ?? 0,
      accentClass: "bg-blue-500/10 text-blue-500",
    },
    {
      key: "instagram",
      label: "Instagram",
      value: stats?.instagram_leads ?? 0,
      accentClass: "bg-pink-500/10 text-pink-500",
    },
    {
      key: "today",
      label: "Today",
      value: stats?.today_leads ?? 0,
      accentClass: "bg-amber-500/10 text-amber-500",
    },
    {
      key: "month",
      label: "This Month",
      value: stats?.month_leads ?? 0,
      accentClass: "bg-violet-500/10 text-violet-500",
    },
  ];

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {boxes.map((b) => (
        <Link
          key={b.key}
          href={hrefFor(b.key)}
          className={`group relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            b.highlight ? "border-primary/30 bg-primary/5" : "border-border bg-card"
          }`}
        >
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {b.label}
            </span>
            <ArrowRight className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p
            className={`mt-2 text-3xl font-bold tabular-nums ${
              b.highlight ? "text-primary" : "text-foreground"
            }`}
          >
            {b.value.toLocaleString()}
          </p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md ${b.accentClass}`}>
              {b.key === "total" ? (
                <UsersRound className="size-3.5" />
              ) : b.key === "new" ? (
                <Sparkles className="size-3.5" />
              ) : (
                <span className="text-[10px] font-bold uppercase">{b.value > 0 ? "›" : "·"}</span>
              )}
            </span>
            <span className="text-[11px] text-muted-foreground">View leads</span>
          </div>
        </Link>
      ))}
      {loading && stats && (
        <div className="col-span-full flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Refreshing…
        </div>
      )}
    </div>
  );
}
