// Small pure display helpers shared by the CRM workspace views.

export function relativeTime(iso?: string | null, locale = "en-US"): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diff = Date.now() - then;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const minute = 60000;
  const hour = 3600000;
  const day = 86400000;
  if (abs < minute) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < day * 30) return rtf.format(Math.round(diff / day), "day");
  if (abs < day * 365) return rtf.format(Math.round(diff / (day * 30)), "month");
  return rtf.format(Math.round(diff / (day * 365)), "year");
}

export function formatDateTime(iso?: string | null, locale = "en-US"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Tailwind class string for the priority pill. */
export const PRIORITY_BADGE_CLASS: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  high: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  urgent: "bg-red-500/10 text-red-500 border-red-500/30",
};

export const PRIORITY_VALUES = ["low", "normal", "high", "urgent"] as const;
