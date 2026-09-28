"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Zap,
  Plus,
  MoreVertical,
  Copy,
  Pencil,
  Trash2,
  FileText,
  MessageCircle,
  Clock,
  Users,
  PhoneCall,
  Loader2,
  Search,
  X,
  AlertTriangle,
  RotateCw,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useCan } from "@/hooks/use-can"
import { useTranslations } from "next-intl"
import type { Automation } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AUTOMATION_TEMPLATES, type TemplateSlug } from "@/lib/automations/templates"
import { triggerMeta, formatRelative } from "@/lib/automations/trigger-meta"
import { STEP_META, stepColors } from "@/lib/automations/step-meta"
import { Pagination } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import { ResourcesProvider, useResources } from "@/components/automations/resources"
import { describeTrigger } from "@/components/automations/step-summary"

// ------------------------------------------------------------
// The automation list.
//
// The problem this page had: every row was a name, a trigger pill and
// a run count, so "which of my nine automations is the one that tags
// new leads?" was unanswerable without opening each one.
//
// Each row now states what the workflow DOES — the trigger in a
// sentence ("Tag “vip” is added") plus a strip of the steps it runs —
// so the list is browsable rather than a lookup table.
//
// Three things were also load-state and layout problems rather than
// design ones:
//
//   * the first paint was a spinner in the middle of an empty page, so
//     the list's shape was unknown until it arrived; it is now a
//     skeleton of the rows that are coming
//   * a load error replaced the whole page, including the "create" and
//     "start from a template" actions, so a failed fetch locked the
//     user out of the feature
//   * there was no way to find one automation in a long list
//
// Search and the status filter run in the QUERY, not on the returned
// page. Filtering twenty client-side rows out of a paginated list
// silently hides the other eighty, which is worse than not offering
// the filter at all.
// ------------------------------------------------------------

const TEMPLATE_ORDER: TemplateSlug[] = [
  "welcome_message",
  "out_of_office",
  "lead_qualifier",
  "follow_up_reminder",
]

const TEMPLATE_ICON: Record<TemplateSlug, typeof Zap> = {
  welcome_message: MessageCircle,
  out_of_office: Clock,
  lead_qualifier: Users,
  follow_up_reminder: PhoneCall,
}

type StatusFilter = "all" | "active" | "paused"

/** One top-level step of a saved workflow, for the preview strip. */
interface PreviewStep {
  step_type: string
}

const PAGE_SIZE = 20

export default function AutomationsPage() {
  const router = useRouter()
  const canCreate = useCan("send-messages")
  const t = useTranslations("Automations.list")
  const [automations, setAutomations] = useState<Automation[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Automation | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [query, setQuery] = useState("")
  const [appliedQuery, setAppliedQuery] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [previews, setPreviews] = useState<Record<string, PreviewStep[]>>({})

  // Debounced so typing does not fire a query per keystroke. Page is
  // reset with it: staying on page 4 of a filtered list is the classic
  // "no results" that is actually "wrong page".
  useEffect(() => {
    const id = setTimeout(() => {
      setAppliedQuery(query.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(id)
  }, [query])

  // A ref, not `automations === null` in the dependency array: this
  // callback has to know whether anything is on screen yet, and reading
  // it as state would either re-create the callback on every render (and
  // with it the effect that calls it, looping) or need a lint
  // suppression to say so.
  const loadedRef = useRef(false)

  const load = useCallback(async () => {
    const first = !loadedRef.current
    loadedRef.current = true
    if (!first) setRefreshing(true)
    try {
      const supabase = createClient()
      const from = (page - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      let listQuery = supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to)
      let countQuery = supabase
        .from("automations")
        .select("id", { count: "exact", head: true })

      const search = sanitizeSearch(appliedQuery)
      if (search) {
        const pattern = `%${search}%`
        listQuery = listQuery.or(`name.ilike.${pattern},description.ilike.${pattern}`)
        countQuery = countQuery.or(`name.ilike.${pattern},description.ilike.${pattern}`)
      }
      if (status === "active") {
        listQuery = listQuery.eq("is_active", true)
        countQuery = countQuery.eq("is_active", true)
      } else if (status === "paused") {
        listQuery = listQuery.eq("is_active", false)
        countQuery = countQuery.eq("is_active", false)
      }

      const [dataRes, countRes] = await Promise.all([listQuery, countQuery])
      if (dataRes.error) throw dataRes.error

      const rows = (dataRes.data ?? []) as Automation[]
      setAutomations(rows)
      setTotal(countRes.count ?? 0)
      setError(null)

      // The step strip is a nicety, not the point of the page: if this
      // query fails the list is still fully usable, so it never becomes
      // an error state.
      const ids = rows.map((r) => r.id)
      if (ids.length > 0) {
        const { data: steps } = await supabase
          .from("automation_steps")
          .select("automation_id, step_type")
          .in("automation_id", ids)
          .is("parent_step_id", null)
          .order("position", { ascending: true })
        if (steps) {
          const grouped: Record<string, PreviewStep[]> = {}
          for (const row of steps as { automation_id: string; step_type: string }[]) {
            ;(grouped[row.automation_id] ??= []).push({ step_type: row.step_type })
          }
          setPreviews(grouped)
        }
      } else {
        setPreviews({})
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load automations")
    } finally {
      setRefreshing(false)
    }
  }, [page, appliedQuery, status])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(a: Automation, next: boolean) {
    // Optimistic flip so the switch feels instant.
    setAutomations((prev) =>
      prev?.map((x) => (x.id === a.id ? { ...x, is_active: next } : x)) ?? prev,
    )
    const res = await fetch(`/api/automations/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    })
    if (!res.ok) {
      // Roll back on error.
      setAutomations((prev) =>
        prev?.map((x) => (x.id === a.id ? { ...x, is_active: !next } : x)) ?? prev,
      )
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? t("toasts.updateError"))
      return
    }
    toast.success(next ? t("toasts.activated") : t("toasts.paused"))
  }

  async function duplicate(a: Automation) {
    const res = await fetch(`/api/automations/${a.id}/duplicate`, { method: "POST" })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? t("toasts.duplicateError"))
      return
    }
    toast.success(t("toasts.duplicated"))
    load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const res = await fetch(`/api/automations/${pendingDelete.id}`, { method: "DELETE" })
    setDeleting(false)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? t("toasts.deleteError"))
      return
    }
    toast.success(t("toasts.deleted"))
    setPendingDelete(null)
    load()
  }

  const hasFilters = appliedQuery.length > 0 || status !== "all"
  // Templates are a starting point, so they only belong on a genuinely
  // empty list — not on one the user has just filtered down to nothing.
  const showTemplates = !hasFilters && total === 0

  if (automations === null) {
    return <ListSkeleton />
  }

  return (
    <ResourcesProvider>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>
          <GatedButton
            canAct={canCreate}
            gateReason="create automations"
            onClick={() => router.push("/automations/new")}
            className="self-start bg-primary text-primary-foreground hover:bg-primary/90 sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            {t("create")}
          </GatedButton>
        </div>

        {showTemplates && (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
              {t("templatesTitle")}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {TEMPLATE_ORDER.map((slug) => {
                const template = AUTOMATION_TEMPLATES[slug]
                const Icon = TEMPLATE_ICON[slug]
                return (
                  <button
                    key={slug}
                    onClick={() => router.push(`/automations/new?template=${slug}`)}
                    className="group flex flex-col items-start rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-card/80"
                  >
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-semibold text-foreground">
                      {template.name}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {template.description}
                    </p>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="pr-8 pl-8"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label={t("clearSearch")}
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div
            className="flex items-center gap-1 self-start rounded-lg border border-border p-0.5"
            role="group"
            aria-label={t("filterLabel")}
          >
            {(["all", "active", "paused"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setStatus(value)
                  setPage(1)
                }}
                aria-pressed={status === value}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  status === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(`filters.${value}`)}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorBanner message={error} onRetry={load} />}

        {automations.length === 0 ? (
          hasFilters ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/40 px-6 text-center">
              <p className="text-sm font-medium text-foreground">
                {t("noResultsTitle")}
              </p>
              <p className="text-xs text-muted-foreground">{t("noResultsDesc")}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("")
                  setStatus("all")
                }}
              >
                {t("clearFilters")}
              </Button>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">
                {t("emptyTitle")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t("emptyDesc")}</p>
            </div>
          )
        ) : (
          <>
            <ul
              className={cn(
                "space-y-3 transition-opacity",
                refreshing && "opacity-60",
              )}
            >
              {automations.map((a) => (
                <AutomationCard
                  key={a.id}
                  automation={a}
                  preview={previews[a.id] ?? []}
                  onToggle={(next) => toggleActive(a, next)}
                  onEdit={() => router.push(`/automations/${a.id}/edit`)}
                  onDuplicate={() => duplicate(a)}
                  onLogs={() => router.push(`/automations/${a.id}/logs`)}
                  onDelete={() => setPendingDelete(a)}
                />
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </>
        )}

        <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("deleteTitle")}</DialogTitle>
              <DialogDescription>
                {t("deleteDesc", { name: pendingDelete?.name ?? "" })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setPendingDelete(null)}
                disabled={deleting}
              >
                {t("cancel")}
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {t("delete")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ResourcesProvider>
  )
}

/**
 * Strip the characters PostgREST's `or()` filter treats as syntax.
 *
 * A search box that reaches the query builder is a search box that can
 * be made to fail: a comma turns into "match any of these filters" and
 * a paren unbalances the expression, and the user's word comes back as a
 * 400 instead of as results. `%` and `_` are LIKE wildcards, so they
 * are dropped too — nobody searches for a literal underscore and gets
 * "everything with one character in that spot".
 */
function sanitizeSearch(value: string): string {
  return value.replace(/[,()%*\\]/g, "").trim()
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useTranslations("Automations.list")
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        <span className="break-words">{message}</span>
      </p>
      <Button variant="outline" size="sm" onClick={onRetry} className="self-start sm:self-auto">
        <RotateCw className="h-3.5 w-3.5" />
        {t("retry")}
      </Button>
    </div>
  )
}

/** The list's shape before the data arrives, so the page does not
 *  visibly reflow when it does. */
function ListSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-64 animate-pulse rounded-md bg-muted/70" />
        </div>
        <div className="h-9 w-32 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border p-4">
            <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-muted" />
              <div className="h-3 w-72 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="h-6 w-16 animate-pulse rounded-full bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}

function AutomationCard({
  automation,
  preview,
  onToggle,
  onEdit,
  onDuplicate,
  onLogs,
  onDelete,
}: {
  automation: Automation
  preview: PreviewStep[]
  onToggle: (next: boolean) => void
  onEdit: () => void
  onDuplicate: () => void
  onLogs: () => void
  onDelete: () => void
}) {
  const t = useTranslations("Automations.list")
  const tb = useTranslations("Automations.builder")
  // Read through the same provider the builder uses, so a saved tag
  // reads as "vip" here and as "vip" in the builder.
  const lookups = useResources()
  const meta = triggerMeta(automation.trigger_type)

  // The sentence under the name is the whole point of the row: it says
  // what sets the workflow off, in the user's words rather than in enum
  // names.
  const triggerSentence = useMemo(
    () => describeTrigger(automation.trigger_type, automation.trigger_config ?? {}, tb, lookups),
    [automation.trigger_type, automation.trigger_config, tb, lookups],
  )

  return (
    <li className="rounded-xl border border-border bg-card transition-colors hover:border-border">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10"
            aria-hidden
          >
            <Zap className="h-5 w-5 text-primary" />
          </div>

          <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-semibold text-foreground">
                {automation.name}
              </span>
              {automation.is_active ? (
                <Badge variant="secondary" className="h-5 px-2 text-[11px] leading-none">
                  {t("status.active")}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="h-5 px-2 text-[11px] leading-none text-muted-foreground"
                >
                  {t("status.paused")}
                </Badge>
              )}
            </div>

            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {triggerSentence}
            </p>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                  meta.pillClass,
                )}
              >
                {meta.label}
              </span>
              <span className="tabular-nums">
                {automation.execution_count === 1
                  ? t("runs", { count: automation.execution_count })
                  : t("runsPlural", { count: automation.execution_count ?? 0 })}
              </span>
              <span aria-hidden>·</span>
              <span>
                {t("lastRun", {
                  time: formatRelative(automation.last_executed_at),
                })}
              </span>
            </div>

            <StepStrip preview={preview} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 sm:justify-start">
          <Switch
            checked={automation.is_active}
            onCheckedChange={(v) => onToggle(!!v)}
            aria-label={automation.is_active ? t("deactivate") : t("activate")}
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={t("rowMenu")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                {t("edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4" />
                {t("duplicate")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onLogs}>
                <FileText className="h-4 w-4" />
                {t("viewLogs")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
}

/**
 * The workflow's shape, at a glance: one chip per top-level step, in
 * the order they run, coloured by what each one does.
 *
 * Only the top level is shown on purpose. A condition's children hang
 * off a fork, and flattening them into the same line would draw a
 * straight sequence where the real workflow branches — the one thing
 * this strip must not misrepresent. The count still includes them.
 */
function StepStrip({ preview }: { preview: PreviewStep[] }) {
  // The step's own name, localised: the strip falls back to the raw
  // `step_type` only for a type this build doesn't know, which is the
  // one case where the enum name is genuinely the most honest label.
  const tb = useTranslations("Automations.builder")
  if (preview.length === 0) return null

  const shown = preview.slice(0, 5)
  const rest = preview.length - shown.length

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1">
      {shown.map((step, i) => {
        const known = step.step_type in STEP_META
        const meta = STEP_META[step.step_type as keyof typeof STEP_META]
        if (!meta) return null
        const colors = stepColors(step.step_type as keyof typeof STEP_META)
        const Icon = meta.icon
        const label = known
          ? tb(`steps.${step.step_type}` as "steps.send_message")
          : step.step_type
        return (
          <span key={`${step.step_type}-${i}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground/50" aria-hidden>›</span>}
            <span
              title={label}
              className="flex h-5 w-5 items-center justify-center rounded"
              style={{ background: colors.soft, color: colors.solid }}
            >
              <Icon className="h-3 w-3" />
            </span>
          </span>
        )
      })}
      {rest > 0 && (
        <span className="text-[12px] leading-none text-muted-foreground">+{rest}</span>
      )}
    </div>
  )
}
