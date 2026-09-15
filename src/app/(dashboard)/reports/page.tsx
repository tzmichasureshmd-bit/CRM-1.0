"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  FileSpreadsheet,
  FileText,
  Users,
  MessageSquare,
  Megaphone,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import jsPDF from "jspdf";

type ReportType = "leads" | "customers" | "conversations" | "sales" | "employees" | "agent-performance" | "daily" | "monthly";

const REPORT_TYPES: { value: ReportType; label: string; icon: typeof Users }[] = [
  { value: "leads", label: "Leads", icon: Users },
  { value: "customers", label: "Customers", icon: Users },
  { value: "conversations", label: "WhatsApp Conversations", icon: MessageSquare },
  { value: "sales", label: "Sales", icon: TrendingUp },
  { value: "agent-performance", label: "Agent Performance", icon: Users },
  { value: "employees", label: "Employee Directory", icon: Users },
  { value: "daily", label: "Daily Summary", icon: BarChart3 },
  { value: "monthly", label: "Monthly Summary", icon: BarChart3 },
];

interface SummaryStats {
  totalContacts: number;
  totalConversations: number;
  totalDeals: number;
  totalBroadcasts: number;
}

export default function ReportsPage() {
  const t = useTranslations("Reports.page");
  const { accountId } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    const db = createClient();
    const loadSummary = async () => {
      try {
        const [contacts, conversations, deals, broadcasts] = await Promise.all([
          db.from("contacts").select("id", { count: "exact", head: true }).eq("account_id", accountId),
          db.from("conversations").select("id", { count: "exact", head: true }).eq("account_id", accountId),
          db.from("deals").select("id", { count: "exact", head: true }).eq("account_id", accountId),
          db.from("broadcasts").select("id", { count: "exact", head: true }).eq("account_id", accountId),
        ]);
        setSummaryStats({
          totalContacts: contacts.count ?? 0,
          totalConversations: conversations.count ?? 0,
          totalDeals: deals.count ?? 0,
          totalBroadcasts: broadcasts.count ?? 0,
        });
      } catch {
        // non-critical
      } finally {
        setSummaryLoading(false);
      }
    };
    void loadSummary();
  }, [accountId]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: reportType });
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const res = await fetch(`/api/reports?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows ?? []);
        setCount(data.count ?? 0);
      }
    } catch {
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [reportType, from, to]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  const exportExcel = async () => {
    if (rows.length === 0) return;
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(sanitizeReportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `report-${reportType}-${Date.now()}.xlsx`);
  };

  // Build report rows with phone numbers removed, so exported data never
  // exposes customer mobile numbers. The button stays; the sensitive
  // column is stripped. Heuristically drops columns whose header contains
  // "phone"/"mobile", and masks a bare phone used as a fallback contact
  // name in the "Contact" column.
  const sanitizeReportRows = () => {
    const PII_HEADER = /phone|mobile/i;
    const PHONE_RE = /\b(\+?\d[\d\s.\-()]{6,})\b/g;
    return rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        if (PII_HEADER.test(key)) continue;
        if (typeof value === "string" && /phone|mobile|contact/i.test(key)) {
          // For "Contact", a bare phone (fallback when name unknown)
          // should not leak — mask it.
          out[key] = value.replace(PHONE_RE, "[hidden]");
        } else {
          out[key] = value;
        }
      }
      return out;
    });
  };

  const exportPDF = () => {
    if (rows.length === 0) return;
    const safe = sanitizeReportRows();
    const doc = new jsPDF();
    const headers = safe[0] ? Object.keys(safe[0]) : [];
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;
    const colWidth = (pageWidth - margin * 2) / headers.length;

    doc.setFontSize(14);
    doc.text(`Report: ${reportType}`, margin, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 22);

    let y = 30;
    doc.setFontSize(8);
    headers.forEach((h, i) => {
      doc.setFont("helvetica", "bold");
      doc.text(h, margin + i * colWidth, y);
    });
    y += 5;

    safe.forEach((row) => {
      if (y > 280) {
        doc.addPage();
        y = 20;
      }
      headers.forEach((h, i) => {
        const val = String(row[h] ?? "");
        doc.setFont("helvetica", "normal");
        doc.text(val, margin + i * colWidth, y);
      });
      y += 5;
    });

    doc.save(`report-${reportType}-${Date.now()}.pdf`);
  };

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStatCard
          icon={Users}
          label="Total Contacts"
          value={summaryStats?.totalContacts ?? 0}
          loading={summaryLoading}
        />
        <SummaryStatCard
          icon={MessageSquare}
          label="Total Conversations"
          value={summaryStats?.totalConversations ?? 0}
          loading={summaryLoading}
        />
        <SummaryStatCard
          icon={TrendingUp}
          label="Total Deals"
          value={summaryStats?.totalDeals ?? 0}
          loading={summaryLoading}
        />
        <SummaryStatCard
          icon={Megaphone}
          label="Total Broadcasts"
          value={summaryStats?.totalBroadcasts ?? 0}
          loading={summaryLoading}
        />
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{t("filters")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>{t("reportType")}</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      {rt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("from")}</Label>
              <Input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-40"
              />
            </div>

            <div className="space-y-2">
              <Label>{t("to")}</Label>
              <Input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-40"
              />
            </div>

            <Button onClick={fetchReport} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("generate")}
            </Button>

            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => void exportExcel()} disabled={rows.length === 0}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" onClick={exportPDF} disabled={rows.length === 0}>
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t("results", { count })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Generating report...</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <BarChart3 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">{t("noData")}</p>
              <p className="text-xs text-muted-foreground">{t("noDataHint")}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col} className="text-xs">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={i}>
                      {columns.map((col) => (
                        <TableCell key={col} className="text-xs">
                          {String(row[col] ?? "")}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryStatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1 h-5 w-12 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-lg font-bold tabular-nums text-foreground">
            {value.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
