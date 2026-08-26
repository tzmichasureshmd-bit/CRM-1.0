"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Appointment, AppointmentStatus, Contact, AccountMember } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  Plus,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Bell,
  BellOff,
  CalendarDays,
} from "lucide-react";

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  no_show: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  rescheduled: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  rescheduled: "Rescheduled",
};

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

interface AppointmentForm {
  title: string;
  description: string;
  contact_id: string;
  agent_id: string;
  appointment_date: string;
  appointment_time: string;
  duration_minutes: number;
  service: string;
  notes: string;
}

const EMPTY_FORM: AppointmentForm = {
  title: "",
  description: "",
  contact_id: "",
  agent_id: "",
  appointment_date: "",
  appointment_time: "",
  duration_minutes: 60,
  service: "",
  notes: "",
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeStr: string) {
  const [h, m] = timeStr.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function isToday(dateStr: string) {
  return dateStr === new Date().toISOString().split("T")[0];
}

function isUpcoming(dateStr: string, timeStr: string) {
  const dt = new Date(`${dateStr}T${timeStr}`);
  return dt > new Date();
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export default function AppointmentsPage() {
  const t = useTranslations("Appointments.page");
  const { accountId, user } = useAuth();
  const supabase = createClient();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [members, setMembers] = useState<AccountMember[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [form, setForm] = useState<AppointmentForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);

  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [rescheduling, setRescheduling] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewTab, setViewTab] = useState("list");

  const fetchAppointments = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    let query = supabase
      .from("appointments")
      .select("*")
      .eq("account_id", accountId)
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (dateFrom) {
      query = query.gte("appointment_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("appointment_date", dateTo);
    }

    const { data, error } = await query;
    if (!error) setAppointments((data as Appointment[]) ?? []);
    setLoading(false);
  }, [accountId, statusFilter, dateFrom, dateTo, supabase]);

  const fetchResources = useCallback(async () => {
    if (!accountId) return;

    const [contactsRes, membersRes] = await Promise.all([
      supabase
        .from("contacts")
        .select("id, name, phone, email")
        .eq("account_id", accountId)
        .order("name"),
      fetch("/api/account/members", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { members: [] }
      ).catch(() => ({ members: [] as AccountMember[] })),
    ]);

    setContacts((contactsRes.data as Contact[]) ?? []);
    setMembers((membersRes as { members?: AccountMember[] }).members ?? []);
  }, [accountId, supabase]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function openCreateForm() {
    setEditingAppointment(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEditForm(appt: Appointment) {
    setEditingAppointment(appt);
    setForm({
      title: appt.title,
      description: appt.description ?? "",
      contact_id: appt.contact_id ?? "",
      agent_id: appt.agent_id ?? "",
      appointment_date: appt.appointment_date,
      appointment_time: appt.appointment_time,
      duration_minutes: appt.duration_minutes,
      service: appt.service ?? "",
      notes: appt.notes ?? "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!accountId || !form.title || !form.appointment_date || !form.appointment_time) return;
    setSaving(true);

    const payload = {
      title: form.title,
      description: form.description || null,
      contact_id: form.contact_id || null,
      agent_id: form.agent_id || null,
      appointment_date: form.appointment_date,
      appointment_time: form.appointment_time,
      duration_minutes: form.duration_minutes,
      service: form.service || null,
      notes: form.notes || null,
    };

    if (editingAppointment) {
      const { error } = await supabase
        .from("appointments")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", editingAppointment.id);
      if (!error) {
        setFormOpen(false);
        fetchAppointments();
      }
    } else {
      const { error } = await supabase.from("appointments").insert({
        ...payload,
        account_id: accountId,
        status: "scheduled",
        reminder_sent: false,
        reminder_24h_sent: false,
        reminder_1h_sent: false,
        created_by: user?.id ?? null,
      });
      if (!error) {
        setFormOpen(false);
        fetchAppointments();
      }
    }
    setSaving(false);
  }

  async function updateStatus(appt: Appointment, status: AppointmentStatus) {
    const updates: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (status === "completed") updates.completed_at = new Date().toISOString();
    if (status === "cancelled") updates.cancelled_at = new Date().toISOString();

    const { error } = await supabase
      .from("appointments")
      .update(updates)
      .eq("id", appt.id);
    if (!error) {
      fetchAppointments();
      if (detailAppointment?.id === appt.id) {
        setDetailAppointment({ ...detailAppointment, ...updates } as Appointment);
      }
    }
  }

  async function handleReschedule() {
    if (!rescheduleTarget || !rescheduleDate || !rescheduleTime) return;
    setRescheduling(true);

    const { error } = await supabase
      .from("appointments")
      .update({
        appointment_date: rescheduleDate,
        appointment_time: rescheduleTime,
        status: "rescheduled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", rescheduleTarget.id);

    if (!error) {
      setRescheduleOpen(false);
      setRescheduleTarget(null);
      fetchAppointments();
    }
    setRescheduling(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("id", deleteTarget.id);
    if (!error) {
      setDeleteOpen(false);
      setDeleteTarget(null);
      setDetailOpen(false);
      setDetailAppointment(null);
      fetchAppointments();
    }
    setDeleting(false);
  }

  function openReschedule(appt: Appointment) {
    setRescheduleTarget(appt);
    setRescheduleDate(appt.appointment_date);
    setRescheduleTime(appt.appointment_time);
    setRescheduleOpen(true);
  }

  function getContactName(contactId: string | null | undefined) {
    if (!contactId) return "—";
    const c = contacts.find((ct) => ct.id === contactId);
    return c?.name ?? c?.phone ?? "Unknown";
  }

  function getAgentName(agentId: string | null | undefined) {
    if (!agentId) return "—";
    const m = members.find((mb) => mb.user_id === agentId);
    return m?.full_name ?? "Unknown";
  }

  const upcomingAppointments = appointments.filter(
    (a) => isUpcoming(a.appointment_date, a.appointment_time) && a.status !== "cancelled" && a.status !== "completed"
  );
  const todayAppointments = appointments.filter(
    (a) => isToday(a.appointment_date) && a.status !== "cancelled"
  );
  const totalUpcoming = upcomingAppointments.length;
  const completedCount = appointments.filter((a) => a.status === "completed").length;
  const cancelledCount = appointments.filter((a) => a.status === "cancelled").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("title", { fallback: "Appointments" })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle", { fallback: `Good ${getGreeting()}. Manage your appointments.` })}
          </p>
        </div>
        <Button onClick={openCreateForm} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Plus className="size-4" />
          {t("newAppointment", { fallback: "New Appointment" })}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("totalUpcoming", { fallback: "Upcoming" })}</p>
                <p className="text-2xl font-bold text-foreground">{totalUpcoming}</p>
              </div>
              <CalendarDays className="size-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("todayCount", { fallback: "Today" })}</p>
                <p className="text-2xl font-bold text-foreground">{todayAppointments.length}</p>
              </div>
              <Calendar className="size-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("completed", { fallback: "Completed" })}</p>
                <p className="text-2xl font-bold text-foreground">{completedCount}</p>
              </div>
              <CheckCircle2 className="size-8 text-emerald-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{t("cancelled", { fallback: "Cancelled" })}</p>
                <p className="text-2xl font-bold text-foreground">{cancelledCount}</p>
              </div>
              <XCircle className="size-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={viewTab} onValueChange={(v) => setViewTab(v as string)}>
        <TabsList variant="line">
          <TabsTrigger value="list">
            <CalendarDays className="size-4" />
            {t("listView", { fallback: "List" })}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            <Clock className="size-4" />
            {t("upcomingView", { fallback: "Upcoming" })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card className="bg-card border-border mt-4">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40 bg-transparent"
                    placeholder="From"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40 bg-transparent"
                    placeholder="To"
                  />
                  {(statusFilter !== "all" || dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setStatusFilter("all");
                        setDateFrom("");
                        setDateTo("");
                      }}
                      className="text-muted-foreground"
                    >
                      {t("clearFilters", { fallback: "Clear" })}
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">{t("table.title", { fallback: "Title" })}</TableHead>
                      <TableHead className="text-muted-foreground">{t("table.contact", { fallback: "Contact" })}</TableHead>
                      <TableHead className="text-muted-foreground hidden md:table-cell">{t("table.agent", { fallback: "Agent" })}</TableHead>
                      <TableHead className="text-muted-foreground">{t("table.date", { fallback: "Date & Time" })}</TableHead>
                      <TableHead className="text-muted-foreground hidden sm:table-cell">{t("table.duration", { fallback: "Duration" })}</TableHead>
                      <TableHead className="text-muted-foreground">{t("table.status", { fallback: "Status" })}</TableHead>
                      <TableHead className="text-muted-foreground hidden lg:table-cell">{t("table.reminders", { fallback: "Reminders" })}</TableHead>
                      <TableHead className="text-muted-foreground w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow className="border-border">
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <Loader2 className="size-6 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">{t("loading", { fallback: "Loading..." })}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : appointments.length === 0 ? (
                      <TableRow className="border-border">
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2">
                            <Calendar className="size-8 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              {t("noAppointments", { fallback: "No appointments found." })}
                            </p>
                            <Button variant="outline" size="sm" onClick={openCreateForm} className="mt-2 border-border text-muted-foreground hover:bg-muted">
                              <Plus className="size-3.5" />
                              {t("createFirst", { fallback: "Create Appointment" })}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      appointments.map((appt) => (
                        <TableRow
                          key={appt.id}
                          className="border-border hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setDetailAppointment(appt);
                            setDetailOpen(true);
                          }}
                        >
                          <TableCell className="font-medium text-foreground">{appt.title}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{getContactName(appt.contact_id)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm hidden md:table-cell">{getAgentName(appt.agent_id)}</TableCell>
                          <TableCell className="text-sm">
                            <div className="text-foreground">{formatDate(appt.appointment_date)}</div>
                            <div className="text-muted-foreground text-xs">{formatTime(appt.appointment_time)}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">{appt.duration_minutes}m</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[appt.status]}`}>
                              {STATUS_LABELS[appt.status]}
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex items-center gap-1">
                              {appt.reminder_24h_sent ? (
                                <Bell className="size-3.5 text-green-500" />
                              ) : (
                                <BellOff className="size-3.5 text-muted-foreground/40" />
                              )}
                              {appt.reminder_1h_sent ? (
                                <Bell className="size-3.5 text-green-500" />
                              ) : (
                                <BellOff className="size-3.5 text-muted-foreground/40" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" />
                                }
                              >
                                <MoreHorizontal className="size-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="bg-popover border-border">
                                <DropdownMenuItem
                                  onClick={() => openEditForm(appt)}
                                  className="text-popover-foreground focus:bg-muted focus:text-foreground"
                                >
                                  <Pencil className="size-4" />
                                  {t("actions.edit", { fallback: "Edit" })}
                                </DropdownMenuItem>
                                {appt.status === "scheduled" && (
                                  <DropdownMenuItem
                                    onClick={() => updateStatus(appt, "confirmed")}
                                    className="text-popover-foreground focus:bg-muted focus:text-foreground"
                                  >
                                    <CheckCircle2 className="size-4" />
                                    {t("actions.confirm", { fallback: "Confirm" })}
                                  </DropdownMenuItem>
                                )}
                                {(appt.status === "scheduled" || appt.status === "confirmed") && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => updateStatus(appt, "completed")}
                                      className="text-popover-foreground focus:bg-muted focus:text-foreground"
                                    >
                                      <CheckCircle2 className="size-4 text-emerald-500" />
                                      {t("actions.complete", { fallback: "Mark Completed" })}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => openReschedule(appt)}
                                      className="text-popover-foreground focus:bg-muted focus:text-foreground"
                                    >
                                      <RotateCcw className="size-4" />
                                      {t("actions.reschedule", { fallback: "Reschedule" })}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => updateStatus(appt, "cancelled")}
                                      className="text-popover-foreground focus:bg-muted focus:text-foreground"
                                    >
                                      <XCircle className="size-4 text-red-500" />
                                      {t("actions.cancel", { fallback: "Cancel" })}
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {appt.status === "confirmed" && (
                                  <DropdownMenuItem
                                    onClick={() => updateStatus(appt, "no_show")}
                                    className="text-popover-foreground focus:bg-muted focus:text-foreground"
                                  >
                                    <XCircle className="size-4 text-orange-500" />
                                    {t("actions.noShow", { fallback: "Mark No Show" })}
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator className="bg-border" />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    setDeleteTarget(appt);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                  {t("actions.delete", { fallback: "Delete" })}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {upcomingAppointments.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <CalendarDays className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {t("noUpcoming", { fallback: "No upcoming appointments." })}
                </p>
              </div>
            ) : (
              upcomingAppointments.slice(0, 12).map((appt) => (
                <Card
                  key={appt.id}
                  className="bg-card border-border hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => {
                    setDetailAppointment(appt);
                    setDetailOpen(true);
                  }}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <h3 className="font-semibold text-foreground text-sm">{appt.title}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 ${STATUS_COLORS[appt.status]}`}>
                        {STATUS_LABELS[appt.status]}
                      </span>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3" />
                        <span className={isToday(appt.appointment_date) ? "text-primary font-medium" : ""}>
                          {isToday(appt.appointment_date) ? "Today" : formatDate(appt.appointment_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="size-3" />
                        <span>{formatTime(appt.appointment_time)} · {appt.duration_minutes}m</span>
                      </div>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Contact:</span>
                        <span>{getContactName(appt.contact_id)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Agent:</span>
                        <span>{getAgentName(appt.agent_id)}</span>
                      </div>
                    </div>
                    {appt.service && (
                      <p className="text-xs text-muted-foreground italic">{appt.service}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {editingAppointment
                ? t("editTitle", { fallback: "Edit Appointment" })
                : t("createTitle", { fallback: "New Appointment" })}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {editingAppointment
                ? t("editDescription", { fallback: "Update the appointment details below." })
                : t("createDescription", { fallback: "Fill in the details to schedule a new appointment." })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">{t("form.title", { fallback: "Title" })} *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t("form.titlePlaceholder", { fallback: "e.g. Product Demo" })}
                className="bg-transparent"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t("form.description", { fallback: "Description" })}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t("form.descriptionPlaceholder", { fallback: "Brief description..." })}
                rows={2}
                className="bg-transparent resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">{t("form.contact", { fallback: "Contact" })}</Label>
                <Select value={(form.contact_id ?? "") || "_none"} onValueChange={(v) => setForm({ ...form, contact_id: v === "_none" ? "" : (v ?? "") })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("form.selectContact", { fallback: "Select contact" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t("form.none", { fallback: "None" })}</SelectItem>
                    {contacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name || c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{t("form.agent", { fallback: "Agent" })}</Label>
                <Select value={(form.agent_id ?? "") || "_none"} onValueChange={(v) => setForm({ ...form, agent_id: v === "_none" ? "" : (v ?? "") })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("form.selectAgent", { fallback: "Assign agent" })} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">{t("form.none", { fallback: "None" })}</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">{t("form.date", { fallback: "Date" })} *</Label>
                <Input
                  type="date"
                  value={form.appointment_date}
                  onChange={(e) => setForm({ ...form, appointment_date: e.target.value })}
                  className="bg-transparent"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{t("form.time", { fallback: "Time" })} *</Label>
                <Input
                  type="time"
                  value={form.appointment_time}
                  onChange={(e) => setForm({ ...form, appointment_time: e.target.value })}
                  className="bg-transparent"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-foreground">{t("form.duration", { fallback: "Duration (min)" })}</Label>
                <Select
                  value={String(form.duration_minutes)}
                  onValueChange={(v) => setForm({ ...form, duration_minutes: Number(v) })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_OPTIONS.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} min
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">{t("form.service", { fallback: "Service" })}</Label>
                <Input
                  value={form.service}
                  onChange={(e) => setForm({ ...form, service: e.target.value })}
                  placeholder={t("form.servicePlaceholder", { fallback: "e.g. Consultation" })}
                  className="bg-transparent"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t("form.notes", { fallback: "Notes" })}</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder={t("form.notesPlaceholder", { fallback: "Additional notes..." })}
                rows={3}
                className="bg-transparent resize-none"
              />
            </div>
          </div>
          <DialogFooter className="bg-popover border-border">
            <Button variant="outline" onClick={() => setFormOpen(false)} className="border-border text-muted-foreground hover:bg-muted">
              {t("cancel", { fallback: "Cancel" })}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.title || !form.appointment_date || !form.appointment_time}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingAppointment
                ? t("saveChanges", { fallback: "Save Changes" })
                : t("createBtn", { fallback: "Create Appointment" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-lg">
          {detailAppointment && (
            <>
              <DialogHeader>
                <DialogTitle className="text-popover-foreground">{detailAppointment.title}</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  {detailAppointment.description || t("noDescription", { fallback: "No description" })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_COLORS[detailAppointment.status]}`}>
                    {STATUS_LABELS[detailAppointment.status]}
                  </span>
                  {detailAppointment.service && (
                    <Badge variant="secondary" className="text-xs">{detailAppointment.service}</Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{t("detail.date", { fallback: "Date" })}</p>
                    <p className="text-foreground font-medium">{formatDate(detailAppointment.appointment_date)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{t("detail.time", { fallback: "Time" })}</p>
                    <p className="text-foreground font-medium">{formatTime(detailAppointment.appointment_time)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{t("detail.duration", { fallback: "Duration" })}</p>
                    <p className="text-foreground font-medium">{detailAppointment.duration_minutes} min</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{t("detail.contact", { fallback: "Contact" })}</p>
                    <p className="text-foreground font-medium">{getContactName(detailAppointment.contact_id)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">{t("detail.agent", { fallback: "Agent" })}</p>
                    <p className="text-foreground font-medium">{getAgentName(detailAppointment.agent_id)}</p>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-muted-foreground text-xs mb-2">{t("detail.reminders", { fallback: "Reminders" })}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1.5">
                      {detailAppointment.reminder_24h_sent ? (
                        <Bell className="size-4 text-green-500" />
                      ) : (
                        <BellOff className="size-4 text-muted-foreground/40" />
                      )}
                      <span className="text-muted-foreground">24h</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {detailAppointment.reminder_1h_sent ? (
                        <Bell className="size-4 text-green-500" />
                      ) : (
                        <BellOff className="size-4 text-muted-foreground/40" />
                      )}
                      <span className="text-muted-foreground">1h</span>
                    </div>
                  </div>
                </div>

                {detailAppointment.notes && (
                  <div className="border-t border-border pt-3">
                    <p className="text-muted-foreground text-xs mb-1">{t("detail.notes", { fallback: "Notes" })}</p>
                    <p className="text-foreground text-sm whitespace-pre-wrap">{detailAppointment.notes}</p>
                  </div>
                )}

                <div className="border-t border-border pt-3 flex flex-wrap gap-2">
                  {detailAppointment.status === "scheduled" && (
                    <Button size="sm" onClick={() => updateStatus(detailAppointment, "confirmed")} className="bg-green-600 hover:bg-green-700 text-white">
                      <CheckCircle2 className="size-3.5" />
                      {t("actions.confirm", { fallback: "Confirm" })}
                    </Button>
                  )}
                  {(detailAppointment.status === "scheduled" || detailAppointment.status === "confirmed") && (
                    <>
                      <Button size="sm" onClick={() => updateStatus(detailAppointment, "completed")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <CheckCircle2 className="size-3.5" />
                        {t("actions.complete", { fallback: "Complete" })}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openReschedule(detailAppointment); }} className="border-border text-muted-foreground hover:bg-muted">
                        <RotateCcw className="size-3.5" />
                        {t("actions.reschedule", { fallback: "Reschedule" })}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => updateStatus(detailAppointment, "cancelled")} className="border-border text-red-500 hover:bg-red-50 dark:hover:bg-red-950">
                        <XCircle className="size-3.5" />
                        {t("actions.cancel", { fallback: "Cancel" })}
                      </Button>
                    </>
                  )}
                  {detailAppointment.status === "confirmed" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(detailAppointment, "no_show")} className="border-border text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950">
                      <XCircle className="size-3.5" />
                      {t("actions.noShow", { fallback: "No Show" })}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => { setDetailOpen(false); openEditForm(detailAppointment); }} className="border-border text-muted-foreground hover:bg-muted">
                    <Pencil className="size-3.5" />
                    {t("actions.edit", { fallback: "Edit" })}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {t("rescheduleTitle", { fallback: "Reschedule Appointment" })}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("rescheduleDescription", { fallback: "Pick a new date and time." })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-foreground">{t("form.date", { fallback: "Date" })}</Label>
              <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="bg-transparent" />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">{t("form.time", { fallback: "Time" })}</Label>
              <Input type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="bg-transparent" />
            </div>
          </div>
          <DialogFooter className="bg-popover border-border">
            <Button variant="outline" onClick={() => setRescheduleOpen(false)} className="border-border text-muted-foreground hover:bg-muted">
              {t("cancel", { fallback: "Cancel" })}
            </Button>
            <Button onClick={handleReschedule} disabled={rescheduling || !rescheduleDate || !rescheduleTime} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              {rescheduling && <Loader2 className="size-4 animate-spin" />}
              {t("rescheduleBtn", { fallback: "Reschedule" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">
              {t("deleteTitle", { fallback: "Delete Appointment" })}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("deleteDescription", { fallback: "This action cannot be undone." })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="border-border text-muted-foreground hover:bg-muted">
              {t("cancel", { fallback: "Cancel" })}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {t("deleteBtn", { fallback: "Delete" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
