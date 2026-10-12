"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  StickyNote,
  XCircle,
} from "lucide-react";
import { formatDateTime, relativeTime } from "@/lib/crm/display";
import { channelLabel } from "@/lib/crm/activity";
import type { ActivityKind, CustomerActivity } from "@/types";

interface ActivityWithContact extends CustomerActivity {
  contact?: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

interface Props {
  onOpenCustomer: (contactId: string) => void;
}

const KIND_ICON: Record<ActivityKind, typeof Info> = {
  message_sent: ArrowUpRight,
  message_received: ArrowDownLeft,
  note: StickyNote,
  follow_up_created: CalendarClock,
  follow_up_completed: CheckCircle2,
  follow_up_rescheduled: RefreshCw,
  follow_up_cancelled: XCircle,
  status_changed: RefreshCw,
  deal_updated: Briefcase,
  system: Info,
};

const KIND_COLOR: Record<ActivityKind, string> = {
  message_sent: "text-sky-500 bg-sky-500/10",
  message_received: "text-emerald-500 bg-emerald-500/10",
  note: "text-amber-500 bg-amber-500/10",
  follow_up_created: "text-violet-500 bg-violet-500/10",
  follow_up_completed: "text-emerald-500 bg-emerald-500/10",
  follow_up_rescheduled: "text-blue-500 bg-blue-500/10",
  follow_up_cancelled: "text-red-500 bg-red-500/10",
  status_changed: "text-indigo-500 bg-indigo-500/10",
  deal_updated: "text-cyan-500 bg-cyan-500/10",
  system: "text-muted-foreground bg-muted",
};

const PAGE_SIZE = 30;

function kindLabelKey(kind: string): string {
  const map: Record<string, string> = {
    message_sent: "kindMessageSent",
    message_received: "kindMessageReceived",
    note: "kindNote",
    follow_up_created: "kindFollowUpCreated",
    follow_up_completed: "kindFollowUpCompleted",
    follow_up_rescheduled: "kindFollowUpRescheduled",
    follow_up_cancelled: "kindFollowUpCancelled",
    status_changed: "kindStatusChanged",
    deal_updated: "kindDealUpdated",
    system: "kindSystem",
  };
  return `workspace.${map[kind] ?? "kindSystem"}`;
}

export function CrmActivityTimeline({ onOpenCustomer }: Props) {
  const t = useTranslations("Crm");
  const { accountId } = useAuth();
  const locale =
    typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

  const [kind, setKind] = useState("all");
  const [direction, setDirection] = useState("all");
  const [items, setItems] = useState<ActivityWithContact[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchSeq = useRef(0);

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const seq = ++fetchSeq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        if (kind !== "all") params.set("kind", kind);
        if (direction !== "all") params.set("direction", direction);
        const res = await fetch(`/api/crm/activity?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("failed");
        const body = (await res.json()) as {
          items: ActivityWithContact[];
          hasMore: boolean;
        };
        if (seq !== fetchSeq.current) return;
        setItems((prev) => (append ? [...prev, ...(body.items ?? [])] : body.items ?? []));
        setHasMore(Boolean(body.hasMore));
      } catch (err) {
        console.error("[crm-activity] load failed", err);
        if (seq === fetchSeq.current && !append) setItems([]);
      } finally {
        if (seq === fetchSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [kind, direction],
  );

  useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  // Live refresh: any new activity row for this account reloads page 1.
  useEffect(() => {
    if (!accountId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`crm-activity-${accountId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "customer_activities",
          filter: `account_id=eq.${accountId}`,
        },
        () => {
          void fetchPage(0, false);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [accountId, fetchPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("workspace.activityTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("workspace.activitySubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={direction} onValueChange={(v) => setDirection(v ?? "all")}>
            <SelectTrigger className="h-9 w-36 border-border bg-card text-sm text-muted-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
              <SelectItem value="all">{t("workspace.allDirections")}</SelectItem>
              <SelectItem value="inbound">{t("workspace.inbound")}</SelectItem>
              <SelectItem value="outbound">{t("workspace.outbound")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={kind} onValueChange={(v) => setKind(v ?? "all")}>
            <SelectTrigger className="h-9 w-44 border-border bg-card text-sm text-muted-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
              <SelectItem value="all">{t("workspace.allKinds")}</SelectItem>
              <SelectItem value="message_sent">{t("workspace.kindMessageSent")}</SelectItem>
              <SelectItem value="message_received">
                {t("workspace.kindMessageReceived")}
              </SelectItem>
              <SelectItem value="note">{t("workspace.kindNote")}</SelectItem>
              <SelectItem value="follow_up_created">
                {t("workspace.kindFollowUpCreated")}
              </SelectItem>
              <SelectItem value="follow_up_completed">
                {t("workspace.kindFollowUpCompleted")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("workspace.noActivity")}
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {items.map((a) => {
              const Icon = KIND_ICON[a.kind] ?? Info;
              return (
                <li key={a.id} className="flex gap-3 px-3 py-2.5 hover:bg-muted/40">
                  <div
                    className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                      KIND_COLOR[a.kind] ?? KIND_COLOR.system
                    }`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {a.title || t(kindLabelKey(a.kind))}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {relativeTime(a.occurred_at, locale)}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{t(kindLabelKey(a.kind))}</span>
                      {a.channel && (
                        <>
                          <span>·</span>
                          <span>{channelLabel(a.channel)}</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDateTime(a.occurred_at, locale)}</span>
                    </div>
                    {a.body && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {a.body}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenCustomer(a.contact_id)}
                    className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
                    aria-label={t("workspace.openCustomer")}
                  >
                    <ExternalLink className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            disabled={loadingMore}
            onClick={() => void fetchPage(items.length, true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            {loadingMore && <Loader2 className="size-4 animate-spin" />}
            {t("workspace.loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
