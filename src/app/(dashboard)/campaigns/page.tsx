'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import {
  Megaphone,
  Plus,
  Loader2,
  Send,
  CheckCheck,
  Eye,
  AlertCircle,
  Radio,
  FileEdit,
  Clock,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';

// Campaign command center. The sending engine behind campaigns is the
// platform's broadcast infrastructure (broadcasts + broadcast_recipients)
// — this page adds the campaign-level analytics layer on top instead of
// duplicating backend logic: KPI rollups across every campaign plus a
// performance table that deep-links into each campaign's detail.

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  total_recipients: number | null;
  sent_count: number | null;
  delivered_count: number | null;
  read_count: number | null;
  failed_count: number | null;
  replied_count: number | null;
  scheduled_at: string | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  draft: { label: 'Draft', classes: 'bg-slate-600/20 text-muted-foreground border-slate-600/30' },
  scheduled: { label: 'Scheduled', classes: 'bg-blue-600/20 text-blue-400 border-blue-600/30' },
  sending: { label: 'Sending', classes: 'bg-amber-600/20 text-amber-400 border-amber-600/30' },
  sent: { label: 'Completed', classes: 'bg-emerald-600/20 text-emerald-400 border-emerald-600/30' },
  failed: { label: 'Failed', classes: 'bg-red-600/20 text-red-400 border-red-600/30' },
};

function rate(part: number | null | undefined, total: number | null | undefined): string {
  if (!total) return '—';
  return `${Math.round(((part ?? 0) / total) * 100)}%`;
}

export default function CampaignsPage() {
  const { accountId, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!accountId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const seq = ++(window as unknown as Record<string, number>).__campaignsSeq;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        // Latest 50 campaigns; aggregate KPIs computed over this window.
        const { data, error: err } = await supabase
          .from('broadcasts')
          .select(
            'id, name, status, total_recipients, sent_count, delivered_count, read_count, failed_count, replied_count, scheduled_at, created_at',
          )
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(50);
        if (err) throw err;
        if (!cancelled && seq === ((window as unknown as Record<string, number>).__campaignsSeq ?? 0)) {
          setCampaigns((data ?? []) as CampaignRow[]);
        }
      } catch (err) {
        console.error('Failed to load campaigns:', err);
        if (!cancelled) setError('Failed to load campaigns. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, authLoading, supabase]);

  const totals = campaigns.reduce(
    (acc, c) => {
      acc.recipients += c.total_recipients ?? 0;
      acc.sent += c.sent_count ?? 0;
      acc.delivered += c.delivered_count ?? 0;
      acc.read += c.read_count ?? 0;
      acc.failed += c.failed_count ?? 0;
      acc.replied += c.replied_count ?? 0;
      if (c.status === 'sending' || c.status === 'scheduled') acc.active += 1;
      if (c.status === 'sent') acc.completed += 1;
      if (c.status === 'failed') acc.failedCampaigns += 1;
      if (c.status === 'draft') acc.drafts += 1;
      return acc;
    },
    { recipients: 0, sent: 0, delivered: 0, read: 0, failed: 0, replied: 0, active: 0, completed: 0, failedCampaigns: 0, drafts: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description="Performance overview of every WhatsApp campaign you have run."
        action={
          <Link
            href="/broadcasts/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Campaign
          </Link>
        }
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Radio className="h-4 w-4" />}
          iconClass="bg-primary/10 text-primary"
          label="Active campaigns"
          value={totals.active}
          sub={`${totals.drafts} draft${totals.drafts === 1 ? '' : 's'} waiting`}
        />
        <KpiCard
          icon={<Send className="h-4 w-4" />}
          iconClass="bg-blue-500/10 text-blue-500"
          label="Messages sent"
          value={totals.sent}
          sub={`${totals.recipients.toLocaleString()} recipients targeted`}
        />
        <KpiCard
          icon={<CheckCheck className="h-4 w-4" />}
          iconClass="bg-emerald-500/10 text-emerald-500"
          label="Delivery rate"
          value={rate(totals.delivered, totals.sent)}
          sub={`${totals.delivered.toLocaleString()} delivered`}
        />
        <KpiCard
          icon={<Eye className="h-4 w-4" />}
          iconClass="bg-violet-500/10 text-violet-500"
          label="Read rate"
          value={rate(totals.read, totals.delivered)}
          sub={`${totals.replied.toLocaleString()} replies received`}
        />
      </div>

      {/* Campaign table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {loading || authLoading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading campaigns…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <AlertCircle className="h-10 w-10 text-destructive/60" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign to send an approved template to a targeted audience and track delivery end-to-end."
            action={
              <Link
                href="/broadcasts/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create campaign
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Recipients</th>
                  <th className="px-4 py-3">Delivered</th>
                  <th className="px-4 py-3">Read</th>
                  <th className="px-4 py-3">Failed</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {campaigns.map((c) => {
                  const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.draft;
                  return (
                    <tr key={c.id} className="transition-colors hover:bg-muted/50">
                      <td className="max-w-[220px] px-4 py-3">
                        <Link
                          href={`/campaigns/${c.id}`}
                          className="block truncate font-medium text-foreground hover:text-primary"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${s.classes}`}>
                          {c.status === 'sending' && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          {c.status === 'scheduled' && (
                            <Clock className="mr-1 h-3 w-3" />
                          )}
                          {c.status === 'draft' && (
                            <FileEdit className="mr-1 h-3 w-3" />
                          )}
                          {s.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {(c.total_recipients ?? 0).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {(c.delivered_count ?? 0).toLocaleString()}{' '}
                        <span className="text-xs">({rate(c.delivered_count, c.sent_count)})</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {(c.read_count ?? 0).toLocaleString()}{' '}
                        <span className="text-xs">({rate(c.read_count, c.delivered_count)})</span>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3 ${(c.failed_count ?? 0) > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {(c.failed_count ?? 0).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  iconClass,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 transition-all duration-200 hover:border-border hover:shadow-md hover:shadow-black/5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${iconClass}`}>
            {icon}
          </div>
        </div>
        <p className="mt-3 text-2xl font-bold tracking-tight text-foreground">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
