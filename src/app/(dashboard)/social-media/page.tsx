"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ThumbsUp, Camera, Link2, RefreshCw, AlertTriangle } from "lucide-react";
import { LeadStatCards, type LeadStats } from "@/components/social-media/lead-stat-cards";
import { RecentLeads, type RecentLead } from "@/components/social-media/recent-leads";

interface OverviewPayload {
  stats: LeadStats;
  breakdown: {
    facebookTotal: number;
    instagramTotal: number;
    byFacebookPage: { label: string; count: number }[];
    byInstagramAccount: { label: string; count: number }[];
  };
  connections: {
    pageId: string;
    pageName: string | null;
    platform: string;
    status: string;
    webhookStatus: string | null;
    instagramAccountId: string | null;
    instagramUsername: string | null;
  }[];
  recentLeads: RecentLead[];
}

function StatusPill({ connected, error }: { connected: boolean; error?: boolean }) {
  if (error) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-400">
        <AlertTriangle className="size-3" /> Connection Error
      </span>
    );
  }
  return connected ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
      <span className="flex h-1.5 w-1.5">
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      Connected
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
      Not Connected
    </span>
  );
}

const GET_CONNECT_URL = "/api/meta/leads/connect";

export default function SocialMediaPage() {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, configRes] = await Promise.all([
        fetch("/api/social-media/overview", { cache: "no-store" }),
        fetch("/api/meta/leads/config", { cache: "no-store" }),
      ]);
      const overview = overviewRes.ok ? await overviewRes.json() : null;
      const config = configRes.ok ? await configRes.json() : null;
      const connections = overview?.connections ?? config?.connections ?? [];
      setData({
        stats:
          overview?.stats ??
          {
            total_leads: 0,
            new_leads: 0,
            facebook_leads: 0,
            instagram_leads: 0,
            today_leads: 0,
            month_leads: 0,
          },
        breakdown:
          overview?.breakdown ??
          { facebookTotal: 0, instagramTotal: 0, byFacebookPage: [], byInstagramAccount: [] },
        connections,
        recentLeads: overview?.recentLeads ?? [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const facebookConnections = (data?.connections ?? []).filter((c) => c.platform === "facebook");
  const instagramConnections = (data?.connections ?? []).filter((c) => c.platform === "instagram");
  const facebookConnected = facebookConnections.length > 0;
  const instagramConnected = instagramConnections.length > 0;
  const instagramAccount = instagramConnections[0]?.instagramUsername
    ? `@${instagramConnections[0].instagramUsername}`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Social Media Lead Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Facebook and Instagram accounts and automatically capture advertising leads into
          your CRM.
        </p>
      </div>

      {/* Lead Overview */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Lead Overview</h2>
        <LeadStatCards stats={data?.stats ?? null} loading={loading} />
      </section>

      {/* Connected accounts */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Facebook card */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <ThumbsUp className="size-5 text-[#1877F2]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Facebook Lead Ads</h3>
                <p className="text-xs text-muted-foreground">Capture leads from your Facebook Pages</p>
              </div>
            </div>
            <StatusPill connected={facebookConnected} />
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : facebookConnected ? (
              <div>
                <p className="text-sm font-medium text-foreground">
                  {facebookConnections.length}{" "}
                  {facebookConnections.length === 1 ? "Page" : "Pages"} Connected
                </p>
                <ul className="mt-2 space-y-1">
                  {facebookConnections.map((c) => (
                    <li
                      key={`${c.pageId}-${c.platform}`}
                      className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
                    >
                      <span className="truncate text-foreground">{c.pageName ?? c.pageId}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {c.webhookStatus === "active" ? "Webhook active" : "Webhook pending"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connect your Facebook account to discover your Pages and start receiving lead ads.
              </p>
            )}
          </div>

          {!facebookConnected && (
            <Link
              href={GET_CONNECT_URL}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Link2 className="size-4" />
              Connect Facebook
            </Link>
          )}
          {facebookConnected && (
            <Link
              href={GET_CONNECT_URL}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="size-4" />
              Reconnect / Refresh Pages
            </Link>
          )}
        </div>

        {/* Instagram card */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10">
                <Camera className="size-5 text-pink-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">Instagram Lead Ads</h3>
                <p className="text-xs text-muted-foreground">Instagram Professional account</p>
              </div>
            </div>
            <StatusPill connected={instagramConnected} />
          </div>

          <div className="mt-4">
            {loading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Loading…
              </div>
            ) : instagramConnected && instagramAccount ? (
              <p className="text-sm text-foreground">
                <span className="font-medium">{instagramAccount}</span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Instagram lead ads are delivered through a Facebook Page. When the connected Page has a
                linked Instagram Professional account, it is discovered automatically — no separate
                login needed.
              </p>
            )}
          </div>

          {instagramConnected ? (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400">
              Capturing Instagram leads via Facebook connection
            </div>
          ) : (
            <Link
              href={GET_CONNECT_URL}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <Camera className="size-4" />
              Connect Instagram via Facebook
            </Link>
          )}
        </div>
      </section>

      {/* Lead Sources */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Lead Sources</h2>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SourceList
              title="Facebook"
              total={data?.breakdown.facebookTotal ?? 0}
              colorClass="text-blue-500"
              items={data?.breakdown.byFacebookPage ?? []}
            />
            <SourceList
              title="Instagram"
              total={data?.breakdown.instagramTotal ?? 0}
              colorClass="text-pink-500"
              items={data?.breakdown.byInstagramAccount ?? []}
            />
          </div>
        )}
      </section>

      {/* Recent Leads */}
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Recent Leads</h2>
          <Link href="/contacts?tab=meta_leads" className="text-xs font-medium text-primary hover:underline">
            View all leads
          </Link>
        </div>
        <RecentLeads leads={data?.recentLeads ?? []} loading={loading} />
      </section>
    </div>
  );
}

function SourceList({
  title,
  total,
  colorClass,
  items,
}: {
  title: string;
  total: number;
  colorClass: string;
  items: { label: string; count: number }[];
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className={`text-xl font-bold tabular-nums ${colorClass}`}>
          {total.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">leads</span>
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No leads from this source yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm"
            >
              <span className="truncate text-foreground">{item.label}</span>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {item.count.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
