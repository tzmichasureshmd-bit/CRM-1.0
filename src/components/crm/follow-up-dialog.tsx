"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Loader2 } from "lucide-react";
import { PRIORITY_VALUES } from "@/lib/crm/display";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  presetContactId?: string | null;
}

interface ContactOption {
  id: string;
  name: string | null;
  phone: string | null;
}

export function FollowUpDialog({
  open,
  onOpenChange,
  onCreated,
  presetContactId,
}: Props) {
  const t = useTranslations("Crm");
  const supabase = createClient();

  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [contactId, setContactId] = useState<string>(presetContactId ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setContactId(presetContactId ?? "");
    setTitle("");
    setDescription("");
    setPriority("normal");
    const tomorrow = new Date(Date.now() + 86400000);
    tomorrow.setMinutes(0, 0, 0);
    const local = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDueDate(local);

    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("contacts")
        .select("id, name, phone")
        .order("name", { ascending: true, nullsFirst: false })
        .limit(300);
      if (!cancelled) setContacts((data ?? []) as ContactOption[]);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presetContactId]);

  async function handleSubmit() {
    if (!contactId) {
      toast.error(t("workspace.customerRequired"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("workspace.titleRequired"));
      return;
    }
    setSaving(true);
    try {
      const iso = dueDate ? new Date(dueDate).toISOString() : null;
      const res = await fetch("/api/follow-ups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_id: contactId,
          title: title.trim(),
          description: description.trim() || null,
          due_date: iso,
          reminder_at: iso,
          priority,
          reason: "manual",
        }),
      });
      if (!res.ok) throw new Error("request failed");
      toast.success(t("workspace.created"));
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      console.error("[follow-up-dialog] create failed", err);
      toast.error(t("workspace.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-popover text-popover-foreground sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-popover-foreground">
            {t("workspace.newFollowUpTitle")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {t("workspace.newFollowUpDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("workspace.customer")}
            </Label>
            <Select
              value={contactId}
              onValueChange={(v) => setContactId(v ?? "")}
            >
              <SelectTrigger className="w-full border-border bg-card text-sm">
                <SelectValue placeholder={t("workspace.selectCustomer")} />
              </SelectTrigger>
              <SelectContent className="border-border bg-popover">
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name || c.phone || c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("workspace.titleLabel")}
            </Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("workspace.titlePlaceholder")}
              className="border-border bg-card"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {t("workspace.descriptionLabel")}
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("workspace.descriptionPlaceholder")}
              className="min-h-16 border-border bg-card"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("workspace.dueDateLabel")}
              </Label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="border-border bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {t("workspace.rulePriority")}
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v ?? "normal")}
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
          </div>
        </div>

        <DialogFooter className="border-border bg-popover">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            {t("workspace.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {t("workspace.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
