"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

export interface RecentLead {
  id: string;
  name: string | null;
  phone: string | null;
  sourcePlatform: string | null;
  pageName: string | null;
  instagramUsername: string | null;
  campaignName: string | null;
  leadStatus: string | null;
  createdAt: string | null;
}

function SourceBadge({ platform }: { platform?: string | null }) {
  if (!platform) return null;
  const isFb = platform === "facebook";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        isFb
          ? "bg-blue-950/40 text-blue-300 border-blue-700/50"
          : "bg-pink-950/40 text-pink-300 border-pink-700/50"
      }`}
    >
      {isFb ? "Facebook" : "Instagram"}
    </span>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return null;
  return (
    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium capitalize text-primary">
      {status}
    </span>
  );
}

/**
 * Compact list of the most recent Meta leads. Clicking a lead opens the
 * existing CRM contact detail drawer (`/contacts/<id>`). Source / page /
 * account / campaign all come from the real stored contact row.
 */
export function RecentLeads({ leads, loading }: { leads: RecentLead[]; loading?: boolean }) {
  if (loading && leads.length === 0) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (leads.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No Meta leads yet. Connect Facebook / Instagram to start capturing leads.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {leads.map((lead) => {
        const account = lead.sourcePlatform === "instagram"
          ? (lead.instagramUsername ? `@${lead.instagramUsername}` : "Instagram")
          : (lead.pageName ?? "Facebook");
        return (
          <li key={lead.id}>
            <Link
              href={`/contacts/${lead.id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {lead.name || "Unnamed lead"}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    <SourceBadge platform={lead.sourcePlatform} />
                    <span className="truncate">{account}</span>
                    {lead.campaignName && (
                      <span className="hidden truncate sm:inline">· {lead.campaignName}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={lead.leadStatus} />
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {lead.createdAt ? formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true }) : ""}
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
