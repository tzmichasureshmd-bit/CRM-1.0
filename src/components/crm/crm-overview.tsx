"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  AlarmClock,
  ArrowRight,
  Clock,
  MessageSquare,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { relativeTime, PRIORITY_BADGE_CLASS } from "@/lib/crm/display";
import type { CrmOverviewCounts, FollowUp } from "@/types";

export type WorkspaceTab = "overview" | "followups" | "activity" | "customers";
export interface NavigateOptions {
  bucket?: "overdue" | "today" | "upcoming";
  status?: string;
}

interface Props {
  onNavigate: (tab: WorkspaceTab, opts?: NavigateOptions) => void;
}

interface FollowUpWithContact extends FollowUp {
  contact?: { id: string; name?: string | null; phone?: string | null } | null;
}

export function CrmOverview({ onNavigate }: Props) {
  const t = useTranslations("Crm");
  const locale =
    typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

  const [data, setData] = useState<CrmOverviewCounts | null>(null);
  const [attention, setAttention] = useState<FollowUpWithContact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, followRes] = await Promise.all([
        fetch("/api/crm/overview", { cache: "no-store" }),
        fetch("/api/crm/follow-ups?status=pending&limit=50", {
          cache: "no-store",
        }),
      ]);
      if (overviewRes.ok) setData((await overviewRes.json()) as CrmOverviewCounts);
      if (followRes.ok) {
        const body = (await followRes.json()) as { items: FollowUpWithContact[] };
        const now = Date.now();
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const withDue = (body.items ?? [])
          .filter((fu) => fu.due_date)
          .filter((fu) => new Date(fu.due_date as string).getTime() <= endOfToday.getTime())
          .sort(
            (a, b) =>
              new Date(a.due_date as string).getTime() -
              new Date(b.due_date as string).getTime(),
          );
        void now;
        setAttention(withDue.slice(0, 5));
      }
    } catch (err) {
      console.warn("[crm-overview] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = [
    {
      key: "active",
      label: t("workspace.statActiveCustomers"),
      value: data?.active_customers ?? 0,
      icon: Activity,
      accent: "text-emerald-500",
      onClick: () => onNavigate("customers"),
    },
    {
      key: "waiting",
      label: t("workspace.statWaitingForReply"),
      value: data?.waiting_for_reply ?? 0,
      icon: MessageSquare,
      accent: "text-sky-500",
      onClick: () => onNavigate("customers"),
    },
    {
      key: "dueToday",
      label: t("workspace.statDueToday"),
      value: data?.follow_ups_due_today ?? 0,
      icon: Clock,
      accent: "text-amber-500",
      onClick: () => onNavigate("followups", { bucket: "today" }),
    },
    {
      key: "overdue",
      label: t("workspace.statOverdue"),
      value: data?.follow_ups_overdue ?? 0,
      icon: AlarmClock,
      accent: "text-red-500",
      onClick: () => onNavigate("followups", { bucket: "overdue" }),
    },
    {
      key: "recent",
      label: t("workspace.statRecentInteractions"),
      value: data?.recent_interactions ?? 0,
      icon: Timer,
      accent: "text-violet-500",
      onClick: () => onNavigate("activity"),
    },
    {
      key: "new",
      label: t("workspace.statNewThisWeek"),
      value: data?.new_this_week ?? 0,
      icon: Sparkles,
      accent: "text-blue-500",
      onClick: () => onNavigate("customers"),
    },
  ];

  const total = data?.total_customers ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("workspace.overviewTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("workspace.overviewSubtitle")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("customers")}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Users className="size-3.5" />
          {total.toLocaleString()}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.key}
              type="button"
              onClick={c.onClick}
              className="group relative overflow-hidden rounded-xl border border-border bg-card/60 p-3 text-left transition-all hover:border-primary/40 hover:bg-card"
            >
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className={`size-3.5 ${c.accent}`} />
                <span className="truncate">{c.label}</span>
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {loading ? "â€”" : c.value.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card/40">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("workspace.needsAttention")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t("workspace.needsAttentionDesc")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("followups", { bucket: "overdue" })}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("workspace.viewAll")}
            <ArrowRight className="size-3.5" />
          </button>
        </div>
        <div className="divide-y divide-border">
          {loading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("hub.loading")}
            </p>
          ) : attention.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t("workspace.noAttention")}
            </p>
          ) : (
            attention.map((fu) => {
              const overdue = fu.due_date
                ? new Date(fu.due_date).getTime() < Date.now()
                : false;
              return (
                <button
                  key={fu.id}
                  type="button"
                  onClick={() =>
                    onNavigate("followups", { bucket: overdue ? "overdue" : "today" })
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {fu.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {fu.contact?.name || fu.contact?.phone || t("workspace.unknownCustomer")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                        PRIORITY_BADGE_CLASS[fu.priority ?? "normal"] ??
                        PRIORITY_BADGE_CLASS.normal
                      }`}
                    >
                      {t(`workspace.priority${(fu.priority ?? "normal").charAt(0).toUpperCase()}${(fu.priority ?? "normal").slice(1)}`)}
                    </span>
                    <span
                      className={`text-[11px] ${
                        overdue ? "font-medium text-red-500" : "text-muted-foreground"
                      }`}
                    >
                      {relativeTime(fu.due_date, locale)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
