'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import {
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Loader2,
  Copy,
  Trash2,
  ExternalLink,
  AlertCircle,
  Images,
} from 'lucide-react';
import { toast } from 'sonner';

// Media Library: every file the account has uploaded through the shared
// media uploader (inbox attachments, flows builder, template headers).
// Rows come from the media_assets registry (migration 049) written by
// uploadAccountMedia() — we never LIST raw storage buckets client-side.

interface MediaAsset {
  id: string;
  bucket: string;
  path: string;
  public_url: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  kind: 'image' | 'video' | 'audio' | 'document';
  created_at: string;
}

const KIND_FILTERS = [
  { value: '', label: 'All', icon: Images },
  { value: 'image', label: 'Images', icon: ImageIcon },
  { value: 'video', label: 'Videos', icon: Video },
  { value: 'audio', label: 'Audio', icon: Music },
  { value: 'document', label: 'Documents', icon: FileText },
] as const;

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaLibraryPage() {
  const { accountId, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState('');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    if (!accountId) return;
    try {
      setLoading(true);
      setError(null);
      let query = supabase
        .from('media_assets')
        .select(
          'id, bucket, path, public_url, file_name, mime_type, size_bytes, kind, created_at',
        )
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (kindFilter) query = query.eq('kind', kindFilter);
      const { data, error: err } = await query;
      if (err) throw err;
      setAssets((data ?? []) as MediaAsset[]);
    } catch (err) {
      console.error('Failed to load media library:', err);
      setError('Failed to load your media. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountId, kindFilter, supabase]);

  useEffect(() => {
    if (!authLoading) fetchAssets();
  }, [authLoading, fetchAssets]);

  const visible = assets.filter((a) =>
    a.file_name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  async function copyUrl(asset: MediaAsset) {
    try {
      await navigator.clipboard.writeText(asset.public_url);
      toast.success('URL copied to clipboard');
    } catch {
      toast.error('Could not copy the URL');
    }
  }

  async function handleDelete(asset: MediaAsset) {
    setDeletingId(asset.id);
    try {
      // Storage delete first (RLS-scoped to the account folder); the
      // registry row goes second so a failed storage remove can be
      // retried instead of orphaning the object silently.
      const { error: rmErr } = await supabase.storage
        .from(asset.bucket)
        .remove([asset.path]);
      if (rmErr) throw new Error(rmErr.message);

      const { error: delErr } = await supabase
        .from('media_assets')
        .delete()
        .eq('id', asset.id);
      if (delErr) throw delErr;

      setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      toast.success(`Deleted "${asset.file_name}"`);
    } catch (err) {
      console.error('Media delete failed:', err);
      toast.error(
        err instanceof Error ? err.message : 'Could not delete this file.',
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Images className="h-6 w-6 text-primary" />
          Media Library
        </h1>
        <p className="text-muted-foreground">
          Files uploaded across the inbox, flows and templates — reusable
          anywhere WhatsApp media is accepted.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {KIND_FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value || 'all'}
              type="button"
              onClick={() => setKindFilter(value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                kindFilter === value
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by file name…"
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none sm:w-64"
        />
      </div>

      {/* Content */}
      {loading || authLoading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading media…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <AlertCircle className="h-10 w-10 text-destructive/60" />
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={fetchAssets}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <Images className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            {assets.length === 0 && !search && !kindFilter
              ? 'No media yet'
              : 'Nothing matches this filter'}
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            {assets.length === 0
              ? 'Files you attach in chats or upload in flows and templates will appear here automatically.'
              : 'Try a different search term or filter.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((asset) => (
            <li
              key={asset.id}
              className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
            >
              {/* Preview */}
              <div className="relative flex h-28 items-center justify-center bg-muted/50">
                {asset.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.public_url}
                    alt={asset.file_name}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : asset.kind === 'video' ? (
                  <Video className="h-8 w-8 text-muted-foreground" />
                ) : asset.kind === 'audio' ? (
                  <Music className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <FileText className="h-8 w-8 text-muted-foreground" />
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-background/80 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {asset.kind}
                </span>
              </div>

              {/* Meta + actions */}
              <div className="p-2.5">
                <p
                  className="truncate text-xs font-medium text-foreground"
                  title={asset.file_name}
                >
                  {asset.file_name}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatBytes(asset.size_bytes)} &middot;{' '}
                  {new Date(asset.created_at).toLocaleDateString()}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  <IconAction
                    title="Copy URL"
                    onClick={() => copyUrl(asset)}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </IconAction>
                  <a
                    href={asset.public_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in new tab"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <IconAction
                    title="Delete"
                    danger
                    disabled={deletingId === asset.id}
                    onClick={() => handleDelete(asset)}
                  >
                    {deletingId === asset.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </IconAction>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function IconAction({
  title,
  onClick,
  children,
  danger,
  disabled,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${
        danger
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}
