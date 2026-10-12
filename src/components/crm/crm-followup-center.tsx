"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlarmClock,
  Check,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Settings2,
  Timer,
} from "lucide-react";
import { formatDateTime, relativeTime, PRIORITY_BADGE_CLASS } from "@/lib/crm/display";
import { FollowUpDialog } from "@/components/crm/follow-up-dialog";
import { CrmRulesDialog } from "@/components/crm/crm-rules-dialog";
import type { FollowUp, FollowUpPriority } from "@/types";

interface FollowUpWithContact extends FollowUp {
  contact?: {
    id: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    lead_status?: string | null;
  } | null;
}

interface Props {
  onOpenCustomer: (contactId: string) => void;
  bucket?: "overdue" | "today" | "upcoming" | "all";
  onChanged?: () => void;
}

export function CrmFollowUpCenter({ onOpenCustomer, bucket, onChanged }: Props) {
  const t = useTranslations("Crm");
  const locale =
    typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

  const [status, setStatus] = useState<"pending" | "completed" | "all">("pending");
  const [bucketFilter, setBucketFilter] = useState<string>(bucket ?? "all");
  const [priority, setPriority] = useState<string>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [items, setItems] = useState<FollowUpWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);

  const fetchSeq = useRef(0);

  useEffect(() => {
    if (bucket) setBucketFilter(bucket);
  }, [bucket]);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const load = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, limit: "100" });
      if (bucketFilter !== "all") params.set("bucket", bucketFilter);
      if (priority !== "all") params.set("priority", priority);
      if (search) params.set("search", search);
      const res = await fetch(`/api/crm/follow-ups?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("failed");
      const body = (await res.json()) as { items: FollowUpWithContact[] };
      if (seq === fetchSeq.current) setItems(body.items ?? []);
    } catch (err) {
      console.error("[crm-followups] load failed", err);
      if (seq === fetchSeq.current) setItems([]);
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [status, bucketFilter, priority, search]);

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(fu: FollowUpWithContact) {
    setBusyId(fu.id);
    try {
      const res = await fetch(`/api/follow-ups/${fu.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success(t("workspace.completed"));
      setItems((prev) => prev.filter((i) => i.id !== fu.id));
      onChanged?.();
    } catch (err) {
      console.error("[crm-followups] complete failed", err);
      toast.error(t("workspace.actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  async function snooze(fu: FollowUpWithContact) {
    setBusyId(fu.id);
    try {
      const base = fu.due_date ? new Date(fu.due_date).getTime() : Date.now();
      const next = new Date(Math.max(base, Date.now()) + 86400000).toISOString();
      const res = await fetch(`/api/follow-ups/${fu.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ due_date: next }),
      });
      if (!res.ok) throw new Error("failed");
      const updated = (await res.json()) as FollowUp;
      setItems((prev) =>
        prev.map((i) => (i.id === fu.id ? { ...i, due_date: updated.due_date } : i)),
      );
      onChanged?.();
    } catch (err) {
      console.error("[crm-followups] snooze failed", err);
      toast.error(t("workspace.actionFailed"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {t("workspace.followupsTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("workspace.followupsSubtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setRulesOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Settings2 className="size-4" />
            {t("workspace.rules")}
          </Button>
          <Button
            onClick={() => setFollowUpOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            {t("workspace.newFollowUp")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border p-0.5">
          {(["pending", "completed", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              aria-pressed={status === s}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                status === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s === "pending"
                ? t("workspace.filterPending")
                : s === "completed"
                  ? t("workspace.filterCompleted")
                  : t("workspace.filterAll")}
            </button>
          ))}
        </div>

        <Select value={bucketFilter} onValueChange={(v) => setBucketFilter(v ?? "all")}>
          <SelectTrigger className="h-9 w-36 border-border bg-card text-sm text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="all">{t("workspace.bucketAll")}</SelectItem>
            <SelectItem value="overdue">{t("workspace.bucketOverdue")}</SelectItem>
            <SelectItem value="today">{t("workspace.bucketToday")}</SelectItem>
            <SelectItem value="upcoming">{t("workspace.bucketUpcoming")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priority} onValueChange={(v) => setPriority(v ?? "all")}>
          <SelectTrigger className="h-9 w-36 border-border bg-card text-sm text-muted-foreground">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-border bg-popover">
            <SelectItem value="all">{t("workspace.allPriorities")}</SelectItem>
            <SelectItem value="low">{t("workspace.priorityLow")}</SelectItem>
            <SelectItem value="normal">{t("workspace.priorityNormal")}</SelectItem>
            <SelectItem value="high">{t("workspace.priorityHigh")}</SelectItem>
            <SelectItem value="urgent">{t("workspace.priorityUrgent")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("workspace.searchFollowUps")}
            className="border-border bg-card pl-8"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("workspace.noFollowUps")}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {items.map((fu) => {
              const overdue =
                fu.status === "pending" && fu.due_date
                  ? new Date(fu.due_date).getTime() < Date.now()
                  : false;
              const p = (fu.priority ?? "normal") as FollowUpPriority;
              return (
                <div
                  key={fu.id}
                  className="flex flex-col gap-2 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
                          PRIORITY_BADGE_CLASS[p] ?? PRIORITY_BADGE_CLASS.normal
                        }`}
                      >
                        {t(`workspace.priority${p.charAt(0).toUpperCase()}${p.slice(1)}`)}
                      </span>
                      {fu.source === "rule" && (
                        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {t("workspace.rules")}
                        </span>
                      )}
                      <p className="truncate text-sm font-medium text-foreground">
                        {fu.title}
                      </p>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="truncate">
                        {fu.contact?.name || fu.contact?.phone || t("workspace.unknownCustomer")}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 ${
                          overdue ? "font-medium text-red-500" : ""
                        }`}
                      >
                        {overdue ? (
                          <AlarmClock className="size-3" />
                        ) : (
                          <Timer className="size-3" />
                        )}
                        {fu.due_date
                          ? `${relativeTime(fu.due_date, locale)} · ${formatDateTime(fu.due_date, locale)}`
                          : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {fu.status === "pending" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busyId === fu.id}
                          onClick={() => complete(fu)}
                          className="border-border text-foreground hover:bg-muted"
                        >
                          {busyId === fu.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          {t("workspace.complete")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === fu.id}
                          onClick={() => snooze(fu)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {t("workspace.reschedule")}
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onOpenCustomer(fu.contact_id)}
                      aria-label={t("workspace.openCustomer")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FollowUpDialog
        open={followUpOpen}
        onOpenChange={setFollowUpOpen}
        onCreated={() => {
          void load();
          onChanged?.();
        }}
      />
      <CrmRulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
}
