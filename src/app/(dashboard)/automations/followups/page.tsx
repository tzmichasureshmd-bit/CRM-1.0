"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Bot,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Loader2,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  ChevronDown,
  ChevronRight,
  Filter,
  Archive,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { useTranslations } from "next-intl"
import type {
  AiFollowup,
  AiFollowupExecution,
  AiFollowupStatus,
  AiFollowupTriggerType,
  MessageTemplate,
} from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"

const TRIGGER_TYPES: { value: AiFollowupTriggerType; labelKey: string }[] = [
  { value: "manual", labelKey: "triggers.manual" },
  { value: "new_contact", labelKey: "triggers.new_contact" },
  { value: "tag_added", labelKey: "triggers.tag_added" },
  { value: "deal_created", labelKey: "triggers.deal_created" },
  { value: "no_response", labelKey: "triggers.no_response" },
  { value: "keyword", labelKey: "triggers.keyword" },
]

const STATUS_STYLES: Record<AiFollowupStatus, string> = {
  draft: "bg-secondary text-secondary-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  archived: "bg-muted text-muted-foreground",
}

const EXECUTION_STATUS_STYLES: Record<string, string> = {
  active: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  stopped: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  waiting: "bg-secondary text-secondary-foreground",
}

type FollowupFormData = {
  name: string
  description: string
  trigger_type: AiFollowupTriggerType
  max_followups: number
  delay_hours: number
  working_hours_only: boolean
  working_hours_start: string
  working_hours_end: string
  stop_on_reply: boolean
  stop_on_opt_out: boolean
  ai_provider: string
  ai_model: string
  ai_system_prompt: string
  ai_temperature: number
  ai_max_tokens: number
  template_id: string
  use_template: boolean
}

const EMPTY_FORM: FollowupFormData = {
  name: "",
  description: "",
  trigger_type: "manual",
  max_followups: 3,
  delay_hours: 24,
  working_hours_only: false,
  working_hours_start: "09:00",
  working_hours_end: "17:00",
  stop_on_reply: true,
  stop_on_opt_out: true,
  ai_provider: "openai",
  ai_model: "gpt-4o-mini",
  ai_system_prompt: "",
  ai_temperature: 0.7,
  ai_max_tokens: 500,
  template_id: "",
  use_template: false,
}

export default function AiFollowupsPage() {
  const t = useTranslations("AiFollowups")
  const { accountId } = useAuth()
  const [followups, setFollowups] = useState<AiFollowup[] | null>(null)
  const [executions, setExecutions] = useState<AiFollowupExecution[]>([])
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [selectedFollowup, setSelectedFollowup] = useState<AiFollowup | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AiFollowup | null>(null)
  const [historyTarget, setHistoryTarget] = useState<AiFollowup | null>(null)
  const [formData, setFormData] = useState<FollowupFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [statusFilter, setStatusFilter] = useState<AiFollowupStatus | "all">("all")
  const [activeTab, setActiveTab] = useState("list")

  const loadFollowups = useCallback(async () => {
    try {
      const supabase = createClient()
      let query = supabase
        .from("ai_followups")
        .select("*")
        .order("created_at", { ascending: false })

      if (accountId) {
        query = query.eq("account_id", accountId)
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter)
      }

      const { data, error } = await query
      if (error) throw error
      setFollowups((data ?? []) as AiFollowup[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load follow-ups")
    }
  }, [accountId, statusFilter])

  const loadTemplates = useCallback(async () => {
    try {
      const supabase = createClient()
      let query = supabase
        .from("message_templates")
        .select("*")
        .order("name", { ascending: true })

      if (accountId) {
        query = query.eq("account_id", accountId)
      }

      const { data, error } = await query
      if (error) throw error
      setTemplates((data ?? []) as MessageTemplate[])
    } catch {
      // Templates are optional
    }
  }, [accountId])

  useEffect(() => {
    loadFollowups()
    loadTemplates()
  }, [loadFollowups, loadTemplates])

  function openCreateDialog() {
    setFormData(EMPTY_FORM)
    setEditMode(false)
    setSelectedFollowup(null)
    setDialogOpen(true)
  }

  function openEditDialog(f: AiFollowup) {
    setFormData({
      name: f.name,
      description: f.description ?? "",
      trigger_type: f.trigger_type,
      max_followups: f.max_followups,
      delay_hours: f.delay_hours,
      working_hours_only: f.working_hours_only,
      working_hours_start: f.working_hours_start,
      working_hours_end: f.working_hours_end,
      stop_on_reply: f.stop_on_reply,
      stop_on_opt_out: f.stop_on_opt_out,
      ai_provider: f.ai_provider ?? "openai",
      ai_model: f.ai_model ?? "gpt-4o-mini",
      ai_system_prompt: f.ai_system_prompt ?? "",
      ai_temperature: f.ai_temperature,
      ai_max_tokens: f.ai_max_tokens,
      template_id: f.template_id ?? "",
      use_template: f.use_template,
    })
    setEditMode(true)
    setSelectedFollowup(f)
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      toast.error(t("validation.nameRequired"))
      return
    }
    setSaving(true)
    try {
      const supabase = createClient()
      const payload = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        trigger_type: formData.trigger_type,
        max_followups: formData.max_followups,
        delay_hours: formData.delay_hours,
        working_hours_only: formData.working_hours_only,
        working_hours_start: formData.working_hours_start,
        working_hours_end: formData.working_hours_end,
        stop_on_reply: formData.stop_on_reply,
        stop_on_opt_out: formData.stop_on_opt_out,
        ai_provider: formData.ai_provider,
        ai_model: formData.ai_model,
        ai_system_prompt: formData.ai_system_prompt.trim() || null,
        ai_temperature: formData.ai_temperature,
        ai_max_tokens: formData.ai_max_tokens,
        template_id: formData.template_id || null,
        use_template: formData.use_template,
        account_id: accountId,
      }

      if (editMode && selectedFollowup) {
        const { error } = await supabase
          .from("ai_followups")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", selectedFollowup.id)
        if (error) throw error
        toast.success(t("toasts.updated"))
      } else {
        const { error } = await supabase.from("ai_followups").insert({
          ...payload,
          status: "draft",
          execution_count: 0,
        })
        if (error) throw error
        toast.success(t("toasts.created"))
      }
      setDialogOpen(false)
      loadFollowups()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.saveError"))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from("ai_followups").delete().eq("id", deleteTarget.id)
      if (error) throw error
      toast.success(t("toasts.deleted"))
      setDeleteTarget(null)
      loadFollowups()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.deleteError"))
    } finally {
      setDeleting(false)
    }
  }

  async function updateStatus(f: AiFollowup, newStatus: AiFollowupStatus) {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("ai_followups")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", f.id)
      if (error) throw error
      toast.success(t(`toasts.${newStatus}`))
      loadFollowups()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toasts.updateError"))
    }
  }

  async function loadExecutionHistory(f: AiFollowup) {
    setHistoryTarget(f)
    setLoadingHistory(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("ai_followup_executions")
        .select("*, contacts!inner(name, phone)")
        .eq("followup_id", f.id)
        .order("created_at", { ascending: false })
        .limit(50)
      if (error) throw error
      setExecutions((data ?? []) as AiFollowupExecution[])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load history")
    } finally {
      setLoadingHistory(false)
    }
  }

  const stats = followups
    ? {
        total: followups.length,
        active: followups.filter((f) => f.status === "active").length,
        totalExecutions: followups.reduce((sum, f) => sum + f.execution_count, 0),
      }
    : { total: 0, active: 0, totalExecutions: 0 }

  if (followups === null) {
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
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          {t("create")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("stats.total")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("stats.active")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("stats.executions")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalExecutions}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="gap-1">
            <TabsTrigger value="list" className="min-w-24 px-4">
              {t("tabs.sequences")}
            </TabsTrigger>
            <TabsTrigger value="history" className="min-w-24 px-4">
              {t("tabs.history")}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as AiFollowupStatus | "all")}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filter.all")}</SelectItem>
                <SelectItem value="draft">{t("filter.draft")}</SelectItem>
                <SelectItem value="active">{t("filter.active")}</SelectItem>
                <SelectItem value="paused">{t("filter.paused")}</SelectItem>
                <SelectItem value="archived">{t("filter.archived")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="list" className="mt-4">
          {followups.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{t("empty.title")}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("empty.desc")}</p>
              <Button onClick={openCreateDialog} variant="outline" className="mt-4">
                <Plus className="h-4 w-4" />
                {t("create")}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {followups.map((f) => (
                <FollowupCard
                  key={f.id}
                  followup={f}
                  t={t}
                  onEdit={() => openEditDialog(f)}
                  onStart={() => updateStatus(f, "active")}
                  onPause={() => updateStatus(f, "paused")}
                  onResume={() => updateStatus(f, "active")}
                  onArchive={() => updateStatus(f, "archived")}
                  onDelete={() => setDeleteTarget(f)}
                  onHistory={() => {
                    loadExecutionHistory(f)
                    setActiveTab("history")
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {historyTarget
                    ? t("history.title") + " — " + historyTarget.name
                    : t("history.selectPrompt")}
                </CardTitle>
                {!historyTarget && (
                  <Select
                    value=""
                    onValueChange={(val) => {
                      const f = followups.find((x) => x.id === val)
                      if (f) loadExecutionHistory(f)
                    }}
                  >
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder={t("history.selectFollowup")} />
                    </SelectTrigger>
                    <SelectContent>
                      {followups.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : historyTarget && executions.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  {t("history.empty")}
                </div>
              ) : historyTarget ? (
                <ExecutionTable executions={executions} t={t} />
              ) : (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  {t("history.selectPrompt")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editMode ? t("dialog.editTitle") : t("dialog.createTitle")}</DialogTitle>
            <DialogDescription>{t("dialog.description")}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-6 py-2">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("dialog.section.general")}</h3>
                <div className="space-y-2">
                  <Label htmlFor="fu-name">{t("dialog.name")}</Label>
                  <Input
                    id="fu-name"
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    placeholder={t("dialog.namePlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fu-desc">{t("dialog.descriptionLabel")}</Label>
                  <Textarea
                    id="fu-desc"
                    value={formData.description}
                    onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                    placeholder={t("dialog.descriptionPlaceholder")}
                    rows={2}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("dialog.section.trigger")}</h3>
                <div className="space-y-2">
                  <Label>{t("dialog.triggerType")}</Label>
                  <Select
                    value={formData.trigger_type}
                    onValueChange={(val) =>
                      setFormData((p) => ({ ...p, trigger_type: val as AiFollowupTriggerType }))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((tt) => (
                        <SelectItem key={tt.value} value={tt.value}>
                          {t(tt.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("dialog.section.settings")}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fu-max">{t("dialog.maxFollowups")}</Label>
                    <Input
                      id="fu-max"
                      type="number"
                      min={1}
                      max={50}
                      value={formData.max_followups}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, max_followups: parseInt(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fu-delay">{t("dialog.delayHours")}</Label>
                    <Input
                      id="fu-delay"
                      type="number"
                      min={1}
                      max={720}
                      value={formData.delay_hours}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, delay_hours: parseInt(e.target.value) || 1 }))
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="fu-wh">{t("dialog.workingHoursOnly")}</Label>
                  <Switch
                    id="fu-wh"
                    checked={formData.working_hours_only}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, working_hours_only: !!v }))}
                  />
                </div>
                {formData.working_hours_only && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fu-wh-start">{t("dialog.workingHoursStart")}</Label>
                      <Input
                        id="fu-wh-start"
                        type="time"
                        value={formData.working_hours_start}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, working_hours_start: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fu-wh-end">{t("dialog.workingHoursEnd")}</Label>
                      <Input
                        id="fu-wh-end"
                        type="time"
                        value={formData.working_hours_end}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, working_hours_end: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label htmlFor="fu-sr">{t("dialog.stopOnReply")}</Label>
                  <Switch
                    id="fu-sr"
                    checked={formData.stop_on_reply}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, stop_on_reply: !!v }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="fu-so">{t("dialog.stopOnOptOut")}</Label>
                  <Switch
                    id="fu-so"
                    checked={formData.stop_on_opt_out}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, stop_on_opt_out: !!v }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("dialog.section.template")}</h3>
                <div className="flex items-center justify-between">
                  <Label htmlFor="fu-ut">{t("dialog.useTemplate")}</Label>
                  <Switch
                    id="fu-ut"
                    checked={formData.use_template}
                    onCheckedChange={(v) => setFormData((p) => ({ ...p, use_template: !!v }))}
                  />
                </div>
                {formData.use_template && (
                  <div className="space-y-2">
                    <Label>{t("dialog.template")}</Label>
                    <Select
                      value={formData.template_id ?? ""}
                      onValueChange={(val) => setFormData((p) => ({ ...p, template_id: val ?? "" }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("dialog.templatePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id}>
                            {tpl.name} ({tpl.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground">{t("dialog.section.ai")}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("dialog.aiProvider")}</Label>
                    <Select
                      value={formData.ai_provider ?? ""}
                      onValueChange={(val) => setFormData((p) => ({ ...p, ai_provider: val ?? "" }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{t("dialog.aiModel")}</Label>
                    <Input
                      value={formData.ai_model}
                      onChange={(e) => setFormData((p) => ({ ...p, ai_model: e.target.value }))}
                      placeholder="gpt-4o-mini"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fu-prompt">{t("dialog.systemPrompt")}</Label>
                  <Textarea
                    id="fu-prompt"
                    value={formData.ai_system_prompt}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, ai_system_prompt: e.target.value }))
                    }
                    placeholder={t("dialog.systemPromptPlaceholder")}
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fu-temp">{t("dialog.temperature")}</Label>
                    <Input
                      id="fu-temp"
                      type="number"
                      min={0}
                      max={2}
                      step={0.1}
                      value={formData.ai_temperature}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          ai_temperature: parseFloat(e.target.value) || 0.7,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fu-tokens">{t("dialog.maxTokens")}</Label>
                    <Input
                      id="fu-tokens"
                      type="number"
                      min={50}
                      max={4096}
                      value={formData.ai_max_tokens}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          ai_max_tokens: parseInt(e.target.value) || 500,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              {t("dialog.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editMode ? t("dialog.save") : t("dialog.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete.title")}</DialogTitle>
            <DialogDescription>{t("delete.desc", { name: deleteTarget?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              {t("delete.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("delete.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FollowupCard({
  followup,
  t,
  onEdit,
  onStart,
  onPause,
  onResume,
  onArchive,
  onDelete,
  onHistory,
}: {
  followup: AiFollowup
  t: ReturnType<typeof useTranslations>
  onEdit: () => void
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onArchive: () => void
  onDelete: () => void
  onHistory: () => void
}) {
  const statusLabel = t(`filter.${followup.status}`)
  const triggerLabel = t(`triggers.${followup.trigger_type}`)

  return (
    <li className="rounded-xl border border-border bg-card transition-colors hover:border-border">
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{followup.name}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[followup.status]}`}
            >
              {statusLabel}
            </span>
          </div>
          {followup.description && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{followup.description}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Filter className="h-3 w-3" />
              {triggerLabel}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" />
              {t("card.maxFollowups", { count: followup.max_followups })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t("card.delay", { hours: followup.delay_hours })}
            </span>
            <span>{t("card.runs", { count: followup.execution_count })}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {followup.status === "draft" && (
            <Button size="sm" variant="outline" onClick={onStart}>
              <Play className="h-3 w-3" />
              {t("actions.start")}
            </Button>
          )}
          {followup.status === "active" && (
            <Button size="sm" variant="outline" onClick={onPause}>
              <Pause className="h-3 w-3" />
              {t("actions.pause")}
            </Button>
          )}
          {followup.status === "paused" && (
            <Button size="sm" variant="outline" onClick={onResume}>
              <RotateCcw className="h-3 w-3" />
              {t("actions.resume")}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Open menu"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                {t("actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onHistory}>
                <Eye className="h-4 w-4" />
                {t("actions.viewHistory")}
              </DropdownMenuItem>
              {followup.status !== "archived" && (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="h-4 w-4" />
                  {t("actions.archive")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
}

function ExecutionTable({
  executions,
  t,
}: {
  executions: AiFollowupExecution[]
  t: ReturnType<typeof useTranslations>
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("history.contact")}</TableHead>
          <TableHead>{t("history.status")}</TableHead>
          <TableHead>{t("history.step")}</TableHead>
          <TableHead>{t("history.lastSent")}</TableHead>
          <TableHead>{t("history.nextAction")}</TableHead>
          <TableHead>{t("history.created")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {executions.map((ex) => (
          <TableRow key={ex.id}>
            <TableCell className="font-medium">
              {((ex as unknown as Record<string, unknown>).contacts
                ? ((ex as unknown as Record<string, unknown>).contacts as { name?: string; phone: string }).name ||
                  ((ex as unknown as Record<string, unknown>).contacts as { phone: string }).phone
                : ex.contact_id) ?? ""}
            </TableCell>
            <TableCell>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${EXECUTION_STATUS_STYLES[ex.status] ?? ""}`}
              >
                {t(`history.statuses.${ex.status}`)}
              </span>
            </TableCell>
            <TableCell>
              {ex.current_step} / {ex.total_steps}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {ex.last_sent_at ? new Date(ex.last_sent_at).toLocaleString() : "—"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {ex.next_action_at ? new Date(ex.next_action_at).toLocaleString() : "—"}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {new Date(ex.created_at).toLocaleString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
