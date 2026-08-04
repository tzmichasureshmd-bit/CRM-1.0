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
import { formatCurrency } from "@/lib/currency";
import { Loader2, Download, FileSpreadsheet, FileText } from "lucide-react";
import jsPDF from "jspdf";

type ReportType = "leads" | "customers" | "conversations" | "sales" | "employees" | "daily" | "monthly";

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: "leads", label: "Leads" },
  { value: "customers", label: "Customers" },
  { value: "conversations", label: "WhatsApp Conversations" },
  { value: "sales", label: "Sales" },
  { value: "employees", label: "Employee Performance" },
  { value: "daily", label: "Daily Summary" },
  { value: "monthly", label: "Monthly Summary" },
];

export default function ReportsPage() {
  const t = useTranslations("Reports.page");
  const { defaultCurrency } = useAuth();
  const [reportType, setReportType] = useState<ReportType>("daily");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

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
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `report-${reportType}-${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    if (rows.length === 0) return;
    const doc = new jsPDF();
    const headers = rows[0] ? Object.keys(rows[0]) : [];
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

    rows.forEach((row) => {
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

      <Card>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            {t("results", { count })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
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
