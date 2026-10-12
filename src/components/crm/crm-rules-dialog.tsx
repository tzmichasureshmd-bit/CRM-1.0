"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useCan } from "@/hooks/use-can";
import { PRIORITY_VALUES } from "@/lib/crm/display";
import type { FollowUpRule } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RuleDraft {
  id?: string;
  name: string;
  trigger: "no_reply" | "after_outbound";
  delay_minutes: number;
  priority: string;
  assign_to: "owner" | "conversation_assignee" | "unassigned";
  business_hours_only: boolean;
  business_start_hour: number;
  business_end_hour: number;
  timezone: string;
  business_days: number[];
  enabled: boolean;
}

const DEFAULT_DRAFT: RuleDraft = {
  name: "No reply after 24h",
  trigger: "no_reply",
  delay_minutes: 1440,
  priority: "normal",
  assign_to: "owner",
  business_hours_only: false,
  business_start_hour: 9,
  business_end_hour: 18,
  timezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC",
  business_days: [1, 2, 3, 4, 5],
  enabled: false,
};

function toDraft(rule: FollowUpRule): RuleDraft {
  return {
    id: rule.id,
    name: rule.name,
    trigger: rule.trigger,
    delay_minutes: rule.delay_minutes,
    priority: rule.priority,
    assign_to: rule.assign_to,
    business_hours_only: rule.business_hours_only,
    business_start_hour: rule.business_start_hour,
    business_end_hour: rule.business_end_hour,
    timezone: rule.timezone,
    business_days: rule.business_days ?? [1, 2, 3, 4, 5],
    enabled: rule.enabled,
  };
}

export function CrmRulesDialog({ open, onOpenChange }: Props) {
  const t = useTranslations("Crm");
  const canEdit = useCan("edit-settings");

  const [rules, setRules] = useState<FollowUpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RuleDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crm/rules", { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as { items: FollowUpRule[] };
        setRules(body.items ?? []);
      }
    } catch (err) {
      console.warn("[crm-rules] load failed", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setDraft(null);
      void load();
    }
  }, [open, load]);

  async function toggleEnabled(rule: FollowUpRule, enabled: boolean) {
    setRules((prev) =>
      prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r)),
    );
    try {
      const res = await fetch("/api/crm/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, enabled }),
      });
      if (!res.ok) throw new Error("failed");
      toast.success(t("workspace.saved"));
    } catch (err) {
      console.error("[crm-rules] toggle failed", err);
      toast.error(t("workspace.saveFailed"));
      void load();
    }
  }

  async function saveDraft() {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error(t("workspace.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...draft,
        name: draft.name.trim(),
        delay_minutes: Number(draft.delay_minutes),
        business_start_hour: Number(draft.business_start_hour),
        business_end_hour: Number(draft.business_end_hour),
      };
      const res = await fetch("/api/crm/rules", {
        method: draft.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || "failed");
      }
      toast.success(t("workspace.saved"));
      setDraft(null);
      await load();
    } catch (err) {
      console.error("[crm-rules] save failed", err);
      toast.error(err instanceof Error && err.message !== "failed" ? err.message : t("workspace.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function removeRule(rule: FollowUpRule) {
    try {
      const res = await fetch(`/api/crm/rules?id=${encodeURIComponent(rule.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("failed");
      toast.success(t("workspace.ruleDeleted"));
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err) {
      console.error("[crm-rules] delete failed", err);
      toast.error(t("workspace.saveFailed"));
    }
  }

  const locale =
    typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
  const dayNames = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(2024, 0, 7 + idx); // 2024-01-07 is a Sunday
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  });

  function field<K extends keyof RuleDraft>(key: K, value: RuleDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-popover text-popover-foreground sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {t("workspace.rulesTitle")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("workspace.rulesDesc")}
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("workspace.ruleName")}
              </Label>
              <Input
                value={draft.name}
                onChange={(e) => field("name", e.target.value)}
                className="border-border bg-card"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("workspace.ruleTrigger")}
                </Label>
                <Select
                  value={draft.trigger}
                  onValueChange={(v) =>
                    field("trigger", (v ?? "no_reply") as RuleDraft["trigger"])
                  }
                >
                  <SelectTrigger className="w-full border-border bg-card text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    <SelectItem value="no_reply">
                      {t("workspace.triggerNoReply")}
                    </SelectItem>
                    <SelectItem value="after_outbound">
                      {t("workspace.triggerAfterOutbound")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("workspace.ruleDelay")}
                </Label>
                <Input
                  type="number"
                  min={5}
                  value={draft.delay_minutes}
                  onChange={(e) => field("delay_minutes", Number(e.target.value))}
                  className="border-border bg-card"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("workspace.rulePriority")}
                </Label>
                <Select
                  value={draft.priority}
                  onValueChange={(v) => field("priority", v ?? "normal")}
                >
                  <SelectTrigger className="w-full border-border bg-card text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    {PRIORITY_VALUES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`workspace.priority${p.charAt(0).toUpperCase()}${p.slice(1)}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("workspace.ruleAssign")}
                </Label>
                <Select
                  value={draft.assign_to}
                  onValueChange={(v) =>
                    field("assign_to", (v ?? "owner") as RuleDraft["assign_to"])
                  }
                >
                  <SelectTrigger className="w-full border-border bg-card text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover">
                    <SelectItem value="owner">{t("workspace.assignOwner")}</SelectItem>
                    <SelectItem value="conversation_assignee">
                      {t("workspace.assignConversation")}
                    </SelectItem>
                    <SelectItem value="unassigned">
                      {t("workspace.assignUnassigned")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("workspace.timezoneLabel")}
              </Label>
              <Input
                value={draft.timezone}
                onChange={(e) => field("timezone", e.target.value)}
                placeholder="UTC"
                className="border-border bg-card"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2">
              <span className="text-sm text-foreground">
                {t("workspace.businessHoursOnly")}
              </span>
              <Switch
                checked={draft.business_hours_only}
                onCheckedChange={(checked) =>
                  field("business_hours_only", Boolean(checked))
                }
              />
            </div>

            {draft.business_hours_only && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("workspace.ruleStartHour")}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={draft.business_start_hour}
                      onChange={(e) =>
                        field("business_start_hour", Number(e.target.value))
                      }
                      className="border-border bg-card"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {t("workspace.ruleEndHour")}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={draft.business_end_hour}
                      onChange={(e) =>
                        field("business_end_hour", Number(e.target.value))
                      }
                      className="border-border bg-card"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIdx) => {
                    const active = draft.business_days.includes(dayIdx);
                    return (
                      <label
                        key={dayIdx}
                        className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                      >
                        <Checkbox
                          checked={active}
                          onCheckedChange={() =>
                            field(
                              "business_days",
                              active
                                ? draft.business_days.filter((d) => d !== dayIdx)
                                : [...draft.business_days, dayIdx],
                            )
                          }
                        />
                        {dayNames[dayIdx]}
                      </label>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setDraft(null)}
                className="border-border text-muted-foreground hover:bg-muted"
              >
                {t("workspace.cancel")}
              </Button>
              <Button onClick={saveDraft} disabled={saving}>
                {saving && <Loader2 className="size-4 animate-spin" />}
                {t("workspace.save")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            {loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("hub.loading")}
              </p>
            ) : rules.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("workspace.noRules")}
              </p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {rule.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {rule.trigger === "no_reply"
                        ? t("workspace.triggerNoReply")
                        : t("workspace.triggerAfterOutbound")}
                      {" · "}
                      {rule.delay_minutes} {t("workspace.ruleDelay")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={rule.enabled}
                      disabled={!canEdit}
                      onCheckedChange={(checked) =>
                        toggleEnabled(rule, Boolean(checked))
                      }
                    />
                    {canEdit && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDraft(toDraft(rule))}
                          aria-label={t("workspace.editRule")}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeRule(rule)}
                          aria-label={t("workspace.delete")}
                          className="text-muted-foreground hover:text-red-500"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}

            {canEdit && (
              <Button
                variant="outline"
                onClick={() => setDraft({ ...DEFAULT_DRAFT })}
                className="w-full border-dashed border-border text-muted-foreground hover:bg-muted"
              >
                <Plus className="size-4" />
                {t("workspace.addRule")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
