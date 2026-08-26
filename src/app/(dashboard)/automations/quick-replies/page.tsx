"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  MessageSquare,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Search,
  Tag,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface QuickReplyRow {
  id: string
  account_id: string
  shortcut: string
  title: string
  message: string
  category: string | null
  is_global: boolean
  created_by: string
  created_at: string
  updated_at: string
}

interface DraftState {
  id?: string
  shortcut: string
  title: string
  message: string
  category: string
  is_global: boolean
}

const CATEGORIES = [
  "general",
  "pricing",
  "support",
  "sales",
  "onboarding",
  "follow-up",
]

function emptyDraft(): DraftState {
  return {
    shortcut: "",
    title: "",
    message: "",
    category: "general",
    is_global: false,
  }
}

const VARIABLE_HINTS = [
  "{{first_name}}",
  "{{last_name}}",
  "{{phone}}",
  "{{email}}",
  "{{company}}",
]

export default function QuickRepliesPage() {
  const t = useTranslations("Automations.quickReplies")
  const { accountId, canSendMessages } = useAuth()

  const [items, setItems] = useState<QuickReplyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const [draft, setDraft] = useState<DraftState | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<QuickReplyRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSeq = useRef(0)

  const load = useCallback(async () => {
    const seq = ++fetchSeq.current
    setLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("quick_replies")
      .select("*")
      .order("created_at", { ascending: false })

    if (accountId) {
      query = query.eq("account_id", accountId)
    }

    const { data, error } = await query
    if (seq !== fetchSeq.current) return
    if (error) {
      toast.error(t("toast.loadError"))
      setLoading(false)
      return
    }

    setItems((data as QuickReplyRow[]) ?? [])
    setLoading(false)
  }, [accountId, t])

  useEffect(() => {
    load()
  }, [load])

  const filtered = items.filter((qr) => {
    const term = search.toLowerCase()
    const matchesSearch =
      !term ||
      qr.shortcut.toLowerCase().includes(term) ||
      qr.title.toLowerCase().includes(term) ||
      qr.message.toLowerCase().includes(term)
    const matchesCategory = !categoryFilter || qr.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(
    new Set(items.map((qr) => qr.category).filter((c): c is string => !!c)),
  ).sort()

  function openCreate() {
    setDraft(emptyDraft())
  }

  function openEdit(qr: QuickReplyRow) {
    setDraft({
      id: qr.id,
      shortcut: qr.shortcut,
      title: qr.title,
      message: qr.message,
      category: qr.category ?? "general",
      is_global: qr.is_global,
    })
  }

  async function save() {
    if (!draft) return
    if (!draft.title.trim()) {
      toast.error(t("toast.titleRequired"))
      return
    }
    if (!draft.message.trim()) {
      toast.error(t("toast.messageRequired"))
      return
    }
    if (!draft.shortcut.startsWith("/")) {
      setDraft({ ...draft, shortcut: `/${draft.shortcut}` })
      return
    }

    setSaving(true)
    const supabase = createClient()

    const payload = {
      shortcut: draft.shortcut.trim(),
      title: draft.title.trim(),
      message: draft.message.trim(),
      category: draft.category || null,
      is_global: draft.is_global,
    }

    if (draft.id) {
      const { error } = await supabase
        .from("quick_replies")
        .update(payload)
        .eq("id", draft.id)
      if (error) {
        toast.error(t("toast.saveError"))
        setSaving(false)
        return
      }
      toast.success(t("toast.updated"))
    } else {
      const { error } = await supabase.from("quick_replies").insert({
        ...payload,
        account_id: accountId,
        created_by: accountId,
      })
      if (error) {
        toast.error(t("toast.saveError"))
        setSaving(false)
        return
      }
      toast.success(t("toast.created"))
    }

    setDraft(null)
    setSaving(false)
    load()
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("quick_replies")
      .delete()
      .eq("id", pendingDelete.id)
    setDeleting(false)
    if (error) {
      toast.error(t("toast.deleteError"))
      return
    }
    toast.success(t("toast.deleted"))
    setPendingDelete(null)
    load()
  }

  function insertVariable(varName: string) {
    if (!draft) return
    setDraft({ ...draft, message: draft.message + varName })
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        {canSendMessages && (
          <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" />
            {t("create")}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              !categoryFilter
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {t("all")}
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors capitalize ${
                categoryFilter === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {cat}
            </button>
          ))}
          {categories
            .filter((c) => !CATEGORIES.includes(c))
            .map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors capitalize ${
                  categoryFilter === cat
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {cat}
              </button>
            ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">
            {items.length === 0 ? t("emptyTitle") : t("noResults")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {items.length === 0 ? t("emptyDesc") : t("noResultsDesc")}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-40 text-muted-foreground">{t("table.shortcut")}</TableHead>
                <TableHead className="text-muted-foreground">{t("table.title")}</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">{t("table.message")}</TableHead>
                <TableHead className="text-muted-foreground hidden sm:table-cell">{t("table.category")}</TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell w-20">{t("table.global")}</TableHead>
                <TableHead className="text-muted-foreground w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((qr) => (
                <TableRow key={qr.id} className="border-border hover:bg-muted/50">
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-primary">
                      {qr.shortcut}
                    </code>
                  </TableCell>
                  <TableCell className="text-foreground font-medium">
                    {qr.title}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <p className="max-w-md truncate text-xs text-muted-foreground">
                      {qr.message}
                    </p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {qr.category ? (
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {qr.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {qr.is_global ? (
                      <Badge variant="secondary" className="text-[10px]">
                        <Tag className="mr-1 h-3 w-3" />
                        {t("badge.global")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {canSendMessages && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(qr)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canSendMessages && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setPendingDelete(qr)}
                          className="text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(v) => !v && setDraft(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? t("dialog.editTitle") : t("dialog.createTitle")}
            </DialogTitle>
            <DialogDescription>
              {t("dialog.description")}
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="qr-shortcut">{t("dialog.shortcut")}</Label>
                <Input
                  id="qr-shortcut"
                  value={draft.shortcut}
                  onChange={(e) => setDraft({ ...draft, shortcut: e.target.value })}
                  placeholder="/price"
                  className="bg-muted text-foreground font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  {t("dialog.shortcutHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qr-title">{t("dialog.title")}</Label>
                <Input
                  id="qr-title"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder={t("dialog.titlePlaceholder")}
                  className="bg-muted text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qr-message">{t("dialog.message")}</Label>
                <Textarea
                  id="qr-message"
                  value={draft.message}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                  placeholder={t("dialog.messagePlaceholder")}
                  className="min-h-28 bg-muted text-foreground"
                />
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLE_HINTS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariable(v)}
                      className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qr-category">{t("dialog.category")}</Label>
                <Input
                  id="qr-category"
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  placeholder="general"
                  className="bg-muted text-foreground"
                  list="category-options"
                />
                <datalist id="category-options">
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">{t("dialog.globalLabel")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("dialog.globalHint")}
                  </p>
                </div>
                <Switch
                  checked={draft.is_global}
                  onCheckedChange={(v) => setDraft({ ...draft, is_global: !!v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
              {t("dialog.cancel")}
            </Button>
            <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {draft?.id ? t("dialog.save") : t("dialog.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("deleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("deleteDesc", { title: pendingDelete?.title ?? "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
              {t("dialog.cancel")}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("dialog.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
