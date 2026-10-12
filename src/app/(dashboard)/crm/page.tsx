"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useCan } from "@/hooks/use-can";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { Contact, ContactTag, FollowUp, Tag } from "@/types";
import { LEAD_STATUS_OPTIONS } from "@/lib/crm/lead-status";
import { sourceBadgeInfo, waLink } from "@/lib/crm/leads";
import { LeadStatusBadge } from "@/components/crm/lead-status-badge";
import { ContactForm } from "@/components/contacts/contact-form";
import { ContactDetailView } from "@/components/contacts/contact-detail-view";
import { ImportModal } from "@/components/contacts/import-modal";
import { CustomFieldsManager } from "@/components/contacts/custom-fields-manager";
import { SendMessageModal } from "@/components/contacts/send-message-modal";
import { ConfidentialWatermark } from "@/components/shared/confidential-watermark";
import { CrmOverview, type WorkspaceTab, type NavigateOptions } from "@/components/crm/crm-overview";
import { CrmFollowUpCenter } from "@/components/crm/crm-followup-center";
import { CrmActivityTimeline } from "@/components/crm/crm-activity-timeline";
import { Button } from "@/components/ui/button";
import { GatedButton } from "@/components/ui/gated-button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  MessageSquare,
  Phone as PhoneIcon,
  Mail,
  Building2,
  CalendarClock,
  AlarmClock,
  Sparkles,
  Activity,
  UserCheck,
  Tag as TagIcon,
  Clock,
} from "lucide-react";

const PAGE_SIZE = 25;

const TABS = [
  "all",
  "active",
  "new",
  "contacted",
  "qualified",
  "won",
  "lost",
] as const;
type TabKey = (typeof TABS)[number];

const SOURCES: { value: string; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "meta", label: "Meta" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "google_form", label: "Google Form" },
  { value: "website", label: "Website" },
  { value: "manual", label: "Manual" },
];

const ACTIVE_STATUSES = ["new", "contacted", "qualified", "proposal", "negotiation"];

interface Row extends Contact {
  tags?: Tag[];
}

type Group = { field: string; op: string; value: string }[];

function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function relativeTime(iso?: string | null, locale = "en-US"): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDate(iso?: string | null, locale = "en-US"): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export default function CrmPage() {
  const t = useTranslations("Crm");
  const supabase = createClient();
  const { accountId, profile, account } = useAuth();
  const canEdit = useCan("send-messages");
  const canEditSettings = useCan("edit-settings");

  const [contacts, setContacts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [sort, setSort] = useState("created_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [rangeFilter, setRangeFilter] = useState<"last7" | null>(null);

  const [activeCount, setActiveCount] = useState<number | null>(null);

  const [stats, setStats] = useState<{
    total_contacts: number;
    total_leads: number;
    new_leads: number;
    week_leads: number;
  } | null>(null);

  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [followUpNames, setFollowUpNames] = useState<Record<string, Row>>({});

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [sendTarget, setSendTarget] = useState<Contact | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [followUpsOpen, setFollowUpsOpen] = useState(false);

  // Workspace (top-level) tabs — Overview is the landing tab.
  const [topTab, setTopTab] = useState<WorkspaceTab>("overview");
  const [followUpBucket, setFollowUpBucket] = useState<
    "overdue" | "today" | "upcoming" | "all"
  >("all");
  const [overviewKey, setOverviewKey] = useState(0);

  const handleNavigate = useCallback(
    (tab: WorkspaceTab, opts?: NavigateOptions) => {
      if (opts?.bucket) setFollowUpBucket(opts.bucket);
      setTopTab(tab);
    },
    [],
  );

  const refreshOverview = useCallback(() => setOverviewKey((k) => k + 1), []);

  const fetchSeq = useRef(0);

  const locale =
    typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";

  // ---------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------

  const followUpsByContact = useMemo(() => {
    const map: Record<string, FollowUp> = {};
    for (const f of followUps) {
      if (f.status !== "pending") continue;
      const existing = map[f.contact_id];
      if (!existing) map[f.contact_id] = f;
      else if (f.due_date && (!existing.due_date || f.due_date < existing.due_date)) {
        map[f.contact_id] = f;
      }
    }
    return map;
  }, [followUps]);

  const followUpsDue = useMemo(() => {
    const limit = endOfToday();
    return followUps
      .filter(
        (f) =>
          f.status === "pending" &&
          (!f.due_date || new Date(f.due_date).getTime() <= limit),
      )
      .sort((a, b) => {
        const av = a.due_date ? new Date(a.due_date).getTime() : Infinity;
        const bv = b.due_date ? new Date(b.due_date).getTime() : Infinity;
        return av - bv;
      });
  }, [followUps]);

  const buildGroups = useCallback((): Group[] => {
    const groups: Group[] = [];
    const tabCond: Group | null =
      activeTab === "all"
        ? null
        : activeTab === "active"
          ? ACTIVE_STATUSES.map((s) => ({
              field: "lead_status",
              op: "is",
              value: s,
            }))
          : [{ field: "lead_status", op: "is", value: activeTab }];
    if (tabCond) groups.push(tabCond);
    if (statusFilter !== "all") {
      groups.push([{ field: "lead_status", op: "is", value: statusFilter }]);
    }
    if (sourceFilter !== "all") {
      if (sourceFilter === "meta") {
        groups.push([
          { field: "source_platform", op: "is", value: "facebook" },
          { field: "source_platform", op: "is", value: "instagram" },
        ]);
      } else if (sourceFilter === "facebook" || sourceFilter === "instagram") {
        groups.push([
          { field: "source_platform", op: "is", value: sourceFilter },
        ]);
      } else {
        groups.push([{ field: "source", op: "is", value: sourceFilter }]);
      }
    }
    if (rangeFilter === "last7") {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      groups.push([
        {
          field: "created_at",
          op: "after",
          value: since.toISOString().slice(0, 10),
        },
      ]);
    }
    return groups;
  }, [activeTab, statusFilter, sourceFilter, rangeFilter]);

  // ---------------------------------------------------------------
  // Loaders
  // ---------------------------------------------------------------

  const fetchAssignees = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        setAssignees({});
        return;
      }
      const map: Record<string, string> = {};
      try {
        const { data: dealRows } = await supabase
          .from("deals")
          .select(
            "contact_id, assigned_to, assignee:profiles!deals_assigned_to_fkey(full_name)",
          )
          .in("contact_id", ids);
        for (const d of (dealRows ?? []) as unknown as Array<{
          contact_id: string | null;
          assigned_to: string | null;
          assignee?: { full_name: string | null }[] | { full_name: string | null } | null;
        }>) {
          const assignee = Array.isArray(d.assignee) ? d.assignee[0] : d.assignee;
          if (d.contact_id && d.assigned_to && assignee?.full_name && !map[d.contact_id]) {
            map[d.contact_id] = assignee.full_name;
          }
        }

        const { data: convRows } = await supabase
          .from("conversations")
          .select("contact_id, assigned_agent_id")
          .in("contact_id", ids)
          .not("assigned_agent_id", "is", null);
        const agentIds = Array.from(
          new Set(
            ((convRows ?? []) as Array<{ assigned_agent_id: string | null }>)
              .map((c) => c.assigned_agent_id)
              .filter((v): v is string => Boolean(v)),
          ),
        );
        if (agentIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", agentIds);
          const nameById = new Map(
            ((profs ?? []) as Array<{ id: string; full_name: string | null }>).map(
              (p) => [p.id, p.full_name],
            ),
          );
          for (const c of (convRows ?? []) as Array<{
            contact_id: string | null;
            assigned_agent_id: string | null;
          }>) {
            if (c.contact_id && c.assigned_agent_id && !map[c.contact_id]) {
              const name = nameById.get(c.assigned_agent_id);
              if (name) map[c.contact_id] = name;
            }
          }
        }
      } catch {
        /* assignment is best-effort */
      }
      setAssignees(map);
    },
    [supabase],
  );

  const fetchContacts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const res = await fetch("/api/contacts/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: search.trim() || null,
          groups: buildGroups(),
          tagIds,
          page,
          pageSize: PAGE_SIZE,
          order: sort,
          ascending: sortAsc,
        }),
      });
      if (!res.ok) throw new Error("query failed");
      const data = await res.json();
      if (seq !== fetchSeq.current) return;
      const rows = (data.contacts ?? []) as Row[];
      setContacts(rows);
      setTotalCount(data.totalCount ?? 0);
      void fetchAssignees(rows.map((c) => c.id));
    } catch {
      if (seq !== fetchSeq.current) return;
      toast.error(t("loadError.description"));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [search, buildGroups, tagIds, page, sort, sortAsc, fetchAssignees, t]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts/stats", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.stats) setStats(data.stats);
    } catch {
      /* stats are best-effort */
    }
  }, []);

  const fetchActiveCount = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groups: [
            ACTIVE_STATUSES.map((s) => ({
              field: "lead_status",
              op: "is",
              value: s,
            })),
          ],
          page: 0,
          pageSize: 1,
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.totalCount === "number") setActiveCount(data.totalCount);
    } catch {
      /* best-effort */
    }
  }, []);

  const fetchFollowUps = useCallback(async () => {
    if (!accountId) return;
    try {
      const res = await fetch("/api/follow-ups?status=pending", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      setFollowUps(Array.isArray(data) ? (data as FollowUp[]) : []);
    } catch {
      /* follow-ups are best-effort */
    }
  }, [accountId]);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from("tags").select("*").order("name");
    setAllTags((data ?? []) as Tag[]);
  }, [supabase]);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    const id = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    void fetchStats();
    void fetchFollowUps();
    void fetchActiveCount();
  }, [fetchStats, fetchFollowUps, fetchActiveCount]);

  // Resolve customer names for the follow-ups panel (bounded to due rows).
  useEffect(() => {
    if (!followUpsOpen || followUpsDue.length === 0) return;
    const ids = Array.from(new Set(followUpsDue.map((f) => f.contact_id)));
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, phone, lead_status, created_at, updated_at, user_id, account_id")
        .in("id", ids);
      if (cancelled) return;
      const map: Record<string, Row> = {};
      for (const c of (data ?? []) as Row[]) map[c.id] = c;
      setFollowUpNames(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [followUpsOpen, followUpsDue, supabase]);

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------

  function refreshAll() {
    void fetchContacts();
    void fetchStats();
    void fetchFollowUps();
    void fetchActiveCount();
  }

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase
      .from("contact_tags")
      .select("*")
      .eq("contact_id", contact.id);
    setEditContact(contact);
    setEditContactTags((data ?? []) as ContactTag[]);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function openSend(contact: Contact) {
    setSendTarget(contact);
    setSendOpen(true);
  }

  function openWhatsApp(contact: Contact) {
    const link = waLink(contact.phone);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("contacts")
      .delete()
      .eq("id", deleteTarget.id);
    if (error) {
      toast.error(t("hub.deleteFailed"));
    } else {
      toast.success(t("hub.deleted"));
      if (detailContactId === deleteTarget.id) setDetailOpen(false);
      refreshAll();
    }
    setDeleting(false);
    setDeleteTarget(null);
  }

  function clearFilters() {
    setSearchInput("");
    setSearch("");
    setActiveTab("all");
    setStatusFilter("all");
    setSourceFilter("all");
    setTagIds([]);
    setRangeFilter(null);
    setPage(0);
  }

  const hasActiveFilters =
    search.trim().length > 0 ||
    activeTab !== "all" ||
    statusFilter !== "all" ||
    sourceFilter !== "all" ||
    rangeFilter !== null ||
    tagIds.length > 0;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  const metrics = [
    {
      key: "total",
      label: t("hub.totalCustomers"),
      value: stats?.total_contacts ?? totalCount,
      icon: Users,
      accent: "text-primary",
      onClick: clearFilters,
      active: false,
    },
    {
      key: "new",
      label: t("stats.newLeads"),
      value: stats?.new_leads ?? 0,
      icon: Sparkles,
      accent: "text-blue-500",
      onClick: () => {
        setActiveTab(activeTab === "new" ? "all" : "new");
        setPage(0);
      },
      active: activeTab === "new",
    },
    {
      key: "active",
      label: t("hub.activeLeads"),
      value: activeCount ?? stats?.total_leads ?? 0,
      icon: Activity,
      accent: "text-emerald-500",
      onClick: () => {
        setActiveTab(activeTab === "active" ? "all" : "active");
        setPage(0);
      },
      active: activeTab === "active",
    },
    {
      key: "followups",
      label: t("hub.followUpsDue"),
      value: followUpsDue.length,
      icon: AlarmClock,
      accent: "text-amber-500",
      onClick: () => setFollowUpsOpen(true),
      active: false,
    },
    {
      key: "week",
      label: t("hub.recentlyAdded"),
      value: stats?.week_leads ?? 0,
      icon: CalendarClock,
      accent: "text-violet-500",
      onClick: () => {
        setRangeFilter(rangeFilter === "last7" ? null : "last7");
        setActiveTab("all");
        setPage(0);
      },
      active: rangeFilter === "last7",
    },
  ];

  const SORTS = [
    { value: "created_at", label: t("hub.sortNewest") },
    { value: "name", label: t("hub.sortName") },
    { value: "lead_status", label: t("hub.sortStatus") },
    { value: "location", label: t("hub.sortLocation") },
    { value: "category", label: t("hub.sortCategory") },
  ];

  return (
    <div className="crm-protected space-y-5">
      <ConfidentialWatermark
        identifier={profile?.full_name || account?.name || undefined}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("page.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {totalCount > 0
              ? t("hub.subtitle", { count: totalCount })
              : t("hub.subtitleZero")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditSettings && (
            <Button
              variant="outline"
              onClick={() => setCustomFieldsOpen(true)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="size-4" />
              {t("hub.customFields")}
            </Button>
          )}
          <GatedButton
            variant="outline"
            canAct={canEdit}
            gateReason="import contacts"
            onClick={() => setImportOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Upload className="size-4" />
            {t("hub.import")}
          </GatedButton>
          <GatedButton
            canAct={canEdit}
            gateReason="add contacts"
            onClick={openAddForm}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            {t("hub.addCustomer")}
          </GatedButton>
        </div>
      </div>

      {/* Workspace tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
        {(
          [
            { key: "overview", label: t("workspace.tabOverview") },
            { key: "followups", label: t("workspace.tabFollowups") },
            { key: "activity", label: t("workspace.tabActivity") },
            { key: "customers", label: t("workspace.tabCustomers") },
          ] as { key: WorkspaceTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleNavigate(tab.key)}
            aria-pressed={topTab === tab.key}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              topTab === tab.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {topTab === "overview" && (
        <CrmOverview key={overviewKey} onNavigate={handleNavigate} />
      )}

      {topTab === "followups" && (
        <CrmFollowUpCenter
          bucket={followUpBucket}
          onOpenCustomer={(id) => openDetail(id)}
          onChanged={refreshOverview}
        />
      )}

      {topTab === "activity" && (
        <CrmActivityTimeline onOpenCustomer={(id) => openDetail(id)} />
      )}

      {topTab === "customers" && (
        <>
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.key}
              type="button"
              onClick={m.onClick}
              aria-pressed={m.active}
              className={`group relative overflow-hidden rounded-xl border p-3 text-left transition-all ${
                m.active
                  ? "border-primary/60 bg-primary/5 shadow-sm"
                  : "border-border bg-card/60 hover:border-primary/40 hover:bg-card"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className={`size-3.5 ${m.accent}`} />
                <span className="truncate">{m.label}</span>
              </div>
              <div className="mt-1 text-xl font-bold tabular-nums text-foreground">
                {m.value.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              setPage(0);
            }}
            aria-pressed={activeTab === tab}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`hub.tab${tab.charAt(0).toUpperCase()}${tab.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("hub.searchPlaceholder")}
              className="border-border bg-card pl-8 text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v ?? "all");
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-full shrink-0 border-border bg-card text-sm text-muted-foreground sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
              <SelectItem value="all">{t("hub.allStatuses")}</SelectItem>
              {LEAD_STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v ?? "all");
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-full shrink-0 border-border bg-card text-sm text-muted-foreground sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
              <SelectItem value="all">{t("hub.allSources")}</SelectItem>
              {SOURCES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  className={`shrink-0 border-border ${
                    tagIds.length > 0
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                />
              }
            >
              <TagIcon className="size-4" />
              {t("hub.tags")}
              {tagIds.length > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {tagIds.length}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="max-h-64 overflow-y-auto py-1">
                {allTags.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {t("hub.noTags")}
                  </p>
                ) : (
                  allTags.map((tag) => (
                    <label
                      key={tag.id}
                      className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 hover:bg-muted/50"
                    >
                      <Checkbox
                        checked={tagIds.includes(tag.id)}
                        onCheckedChange={() => {
                          setPage(0);
                          setTagIds((prev) =>
                            prev.includes(tag.id)
                              ? prev.filter((id) => id !== tag.id)
                              : [...prev, tag.id],
                          );
                        }}
                      />
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate text-sm text-popover-foreground">
                        {tag.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v ?? "created_at");
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-full shrink-0 border-border bg-card text-sm text-muted-foreground sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-border bg-popover">
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortAsc((v) => !v)}
            className="shrink-0 border-border text-muted-foreground hover:bg-muted"
            aria-label={t("hub.toggleSort")}
          >
            {sortAsc ? (
              <ArrowUp className="size-4" />
            ) : (
              <ArrowDown className="size-4" />
            )}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
              {t("hub.clearAll")}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="hidden overflow-hidden rounded-lg border border-border md:block">
        <Table className="min-w-[64rem]">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">
                {t("hub.colCustomer")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colPhone")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colEmail")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colCompany")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colSource")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colStatus")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colAssigned")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colLastActivity")}
              </TableHead>
              <TableHead className="text-muted-foreground">
                {t("hub.colNextFollowUp")}
              </TableHead>
              <TableHead className="w-12 text-muted-foreground" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={10} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {t("hub.loading")}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={10} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {hasActiveFilters ? t("hub.noMatch") : t("hub.noCustomers")}
                    </p>
                    {!hasActiveFilters && (
                      <GatedButton
                        canAct={canEdit}
                        gateReason="add contacts"
                        variant="outline"
                        size="sm"
                        onClick={openAddForm}
                        className="mt-2 border-border text-muted-foreground hover:bg-muted"
                      >
                        <Plus className="size-3.5" />
                        {t("hub.addCustomer")}
                      </GatedButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => {
                const nextFu = followUpsByContact[contact.id];
                const overdue = nextFu?.due_date
                  ? new Date(nextFu.due_date).getTime() < Date.now()
                  : false;
                return (
                  <TableRow
                    key={contact.id}
                    className="cursor-pointer border-border hover:bg-muted/50"
                    onClick={() => openDetail(contact.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 border border-border bg-muted">
                          <AvatarFallback className="bg-primary/10 text-[11px] font-medium text-primary">
                            {initials(contact.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {contact.name || "(unnamed)"}
                          </p>
                          {contact.location && (
                            <p className="truncate text-xs text-muted-foreground">
                              {contact.location}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {contact.phone}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.email || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {contact.company || "—"}
                    </TableCell>
                    <TableCell>
                      <SourceBadge contact={contact} />
                    </TableCell>
                    <TableCell>
                      <LeadStatusBadge status={contact.lead_status} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {assignees[contact.id] || (
                        <span className="text-muted-foreground/70">
                          {t("hub.unassigned")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {relativeTime(
                        contact.last_contacted_at ||
                          contact.last_customer_reply_at ||
                          contact.updated_at,
                        locale,
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {nextFu?.due_date ? (
                        <span
                          className={
                            overdue
                              ? "font-medium text-red-500"
                              : "text-muted-foreground"
                          }
                        >
                          {overdue ? t("card.overdue") : formatDate(nextFu.due_date, locale)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/70">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div
                        className="flex items-center justify-end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-foreground"
                              />
                            }
                          >
                            <MoreHorizontal className="size-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="border-border bg-popover"
                          >
                            <DropdownMenuItem
                              onClick={() => openDetail(contact.id)}
                              className="text-popover-foreground"
                            >
                              <UserCheck className="size-4" />
                              {t("hub.viewProfile")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!canEdit}
                              onClick={() => openEditForm(contact)}
                              className="text-popover-foreground"
                            >
                              <Pencil className="size-4" />
                              {t("hub.edit")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={!canEdit}
                              onClick={() => openSend(contact)}
                              className="text-popover-foreground"
                            >
                              <MessageSquare className="size-4" />
                              {t("hub.sendMessage")}
                            </DropdownMenuItem>
                            {waLink(contact.phone) && (
                              <DropdownMenuItem
                                onClick={() => openWhatsApp(contact)}
                                className="text-popover-foreground"
                              >
                                <PhoneIcon className="size-4" />
                                {t("hub.whatsApp")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={!canEdit}
                              onClick={() => setDeleteTarget(contact)}
                            >
                              <Trash2 className="size-4" />
                              {t("hub.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 md:hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <Users className="size-8" />
            {hasActiveFilters ? t("hub.noMatch") : t("hub.noCustomers")}
          </div>
        ) : (
          contacts.map((contact) => {
            const nextFu = followUpsByContact[contact.id];
            return (
              <div
                key={contact.id}
                onClick={() => openDetail(contact.id)}
                className="cursor-pointer rounded-lg border border-border bg-card p-3 hover:bg-muted/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="size-9 border border-border bg-muted">
                      <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                        {initials(contact.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {contact.name || "(unnamed)"}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <PhoneIcon className="size-3" />
                        {contact.phone}
                      </p>
                    </div>
                  </div>
                  <LeadStatusBadge status={contact.lead_status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {contact.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="size-3" />
                      <span className="max-w-[10rem] truncate">{contact.email}</span>
                    </span>
                  )}
                  {contact.company && (
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="size-3" />
                      {contact.company}
                    </span>
                  )}
                  <SourceBadge contact={contact} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {relativeTime(
                      contact.last_contacted_at ||
                        contact.last_customer_reply_at ||
                        contact.updated_at,
                      locale,
                    )}
                  </span>
                  {nextFu?.due_date && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3" />
                      {formatDate(nextFu.due_date, locale)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <UserCheck className="size-3" />
                    {assignees[contact.id] || t("hub.unassigned")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t("hub.showing", {
              start: page * PAGE_SIZE + 1,
              end: Math.min((page + 1) * PAGE_SIZE, totalCount),
              total: totalCount,
            })}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!hasPrev}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 text-xs text-muted-foreground">
                {t("hub.pageCount", { page: page + 1, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
                className="border-border text-muted-foreground hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      )}

          </>
        )}

      {/* Modals */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={refreshAll}
        onViewExisting={(id) => {
          setFormOpen(false);
          openDetail(id);
        }}
      />

      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={refreshAll}
      />

      <SendMessageModal
        open={sendOpen}
        onOpenChange={setSendOpen}
        contact={sendTarget}
        onSent={refreshAll}
      />

      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={refreshAll}
      />

      {canEditSettings && (
        <CustomFieldsManager
          open={customFieldsOpen}
          onOpenChange={setCustomFieldsOpen}
        />
      )}

      {/* Delete confirm */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {t("hub.deleteTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("hub.deleteDesc", {
                name:
                  deleteTarget?.name || deleteTarget?.phone || "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-border bg-popover">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              {t("hub.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t("hub.deleteBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Follow-ups due panel */}
      <Dialog open={followUpsOpen} onOpenChange={setFollowUpsOpen}>
        <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {t("hub.followUpsTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("hub.followUpsDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto py-1">
            {followUpsDue.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("hub.noFollowUps")}
              </p>
            ) : (
              followUpsDue.map((fu) => {
                const contact = followUpNames[fu.contact_id];
                const overdue = fu.due_date
                  ? new Date(fu.due_date).getTime() < Date.now()
                  : false;
                return (
                  <button
                    key={fu.id}
                    type="button"
                    onClick={() => {
                      setFollowUpsOpen(false);
                      if (contact) openDetail(contact.id);
                    }}
                    className="flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-card/60 p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {fu.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {contact?.name || contact?.phone || t("hub.viewCustomer")}
                      </p>
                      <p
                        className={`mt-0.5 text-[11px] ${
                          overdue ? "font-medium text-red-500" : "text-muted-foreground"
                        }`}
                      >
                        {fu.due_date
                          ? t("hub.due", { date: formatDate(fu.due_date, locale) })
                          : t("hub.noDueDate")}
                      </p>
                    </div>
                    {overdue && (
                      <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500">
                        {t("card.overdue")}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SourceBadge({ contact }: { contact: Row }) {
  const info = sourceBadgeInfo(contact.source, contact.source_platform);
  if (!info) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${info.className}`}
    >
      {info.label}
    </span>
  );
}
