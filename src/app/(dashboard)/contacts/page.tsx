'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  Filter,
  X,
  Columns3,
  Download,
  Star,
  Globe,
  PlusCircle,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Mail,
  Phone as PhoneIcon,
  MapPin,
  Landmark,
} from 'lucide-react';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { CustomFieldsManager } from '@/components/contacts/custom-fields-manager';
import { useCan } from '@/hooks/use-can';
import { GatedButton } from '@/components/ui/gated-button';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import {
  CONTACT_FIELDS,
  CONTACT_FIELDS_BY_KEY,
  DEFAULT_VISIBLE_COLUMNS,
  OPERATOR_LABELS,
  operatorsForType,
  leadStatusLabel,
  filtersToGroups,
  TV_LOCALSTORAGE_KEY,
  parseColumnVisibility,
  type ContactColumnKey,
  type ContactFilter,
  type FilterOperator,
} from '@/lib/contacts/contact-fields';

const PAGE_SIZE = 25;
type OrderKey = 'name' | 'created_at' | 'updated_at' | 'rating' | 'review_count' | 'lead_status' | 'location' | 'category';

interface Row extends Contact {
  tags?: Tag[];
}

function formatCreated(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function showDomain(website?: string | null): string {
  if (!website) return '';
  const clean = website.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
  return clean;
}

function RatingStars({ value }: { value?: number | null }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1 text-amber-400">
      <Star className="size-3.5 fill-amber-400" />
      {value.toFixed(1)}
    </span>
  );
}

function LeadStatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const map: Record<string, string> = {
    new: 'bg-blue-950/40 text-blue-300 border-blue-700/50',
    contacted: 'bg-sky-950/40 text-sky-300 border-sky-700/50',
    qualified: 'bg-violet-950/40 text-violet-300 border-violet-700/50',
    proposal: 'bg-purple-950/40 text-purple-300 border-purple-700/50',
    negotiation: 'bg-amber-950/40 text-amber-300 border-amber-700/50',
    won: 'bg-emerald-950/40 text-emerald-300 border-emerald-700/50',
    lost: 'bg-red-950/40 text-red-300 border-red-700/50',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${
        map[status] ?? 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {leadStatusLabel(status)}
    </span>
  );
}

function FieldContent({
  field,
  row,
}: {
  field: ContactColumnKey;
  row: Row;
}) {
  switch (field) {
    case 'name':
      return <span className="font-medium text-foreground">{row.name || '(unnamed)'}</span>;
    case 'phone':
      return <span className="font-mono text-xs text-muted-foreground">{row.phone}</span>;
    case 'email':
      return row.email ? (
        <span className="text-muted-foreground">{row.email}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case 'company':
      return row.company || <span className="text-muted-foreground">—</span>;
    case 'country':
      return row.country || <span className="text-muted-foreground">—</span>;
    case 'location':
      return row.location || <span className="text-muted-foreground">—</span>;
    case 'category':
      return row.category ? (
        <span className="text-muted-foreground capitalize">{row.category}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case 'address':
      return row.address ? (
        <span
          className="block max-w-[13rem] truncate text-muted-foreground"
          title={row.address}
        >
          {row.address}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case 'website':
      return row.website ? (
        <a
          href={row.website.startsWith('http') ? row.website : `https://${row.website}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-primary hover:underline"
          title={row.website}
        >
          <Globe className="size-3" />
          <span className="max-w-[10rem] truncate">{showDomain(row.website)}</span>
          <ExternalLink className="size-2.5 opacity-60" />
        </a>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case 'rating':
      return <RatingStars value={row.rating} />;
    case 'reviews':
      return row.review_count != null ? (
        <span className="text-muted-foreground">
          {row.review_count.toLocaleString()} reviews
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case 'lead_status':
      return <LeadStatusBadge status={row.lead_status} />;
    case 'tags':
      return row.tags && row.tags.length > 0 ? (
        <div className="flex max-w-[12rem] flex-wrap gap-1">
          {row.tags.slice(0, 2).map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
          {row.tags.length > 2 && (
            <span className="text-[10px] text-muted-foreground">+{row.tags.length - 2}</span>
          )}
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    case 'created_at':
      return <span className="text-xs text-muted-foreground">{formatCreated(row.created_at)}</span>;
    case 'updated_at':
      return <span className="text-xs text-muted-foreground">{formatCreated(row.updated_at)}</span>;
    default:
      return null;
  }
}

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsPageInner />
    </Suspense>
  );
}

function ContactsPageInner() {
  const t = useTranslations('Contacts.page');
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = useCan('send-messages');
  const canEditSettings = useCan('edit-settings');

  const [contacts, setContacts] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [filters, setFilters] = useState<ContactFilter[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [sort, setSort] = useState<OrderKey>('created_at');
  const [sortAsc, setSortAsc] = useState(false);

  // Column management (persisted to localStorage).
  const [columns, setColumns] = useState<ContactColumnKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE_COLUMNS;
    return (
      parseColumnVisibility(localStorage.getItem(TV_LOCALSTORAGE_KEY)) ??
      DEFAULT_VISIBLE_COLUMNS
    );
  });

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [customFieldsOpen, setCustomFieldsOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});
  const fetchSeq = useRef(0);

  const contactParam = searchParams.get('contact');
  const [lastContactParam, setLastContactParam] = useState<string | null>(null);
  if (contactParam !== lastContactParam) {
    setLastContactParam(contactParam);
    if (contactParam) {
      setDetailContactId(contactParam);
      setDetailOpen(true);
    }
  }

  const persistColumns = (cols: ContactColumnKey[]) => {
    setColumns(cols);
    try {
      localStorage.setItem(TV_LOCALSTORAGE_KEY, JSON.stringify(cols));
    } catch {
      /* ignore */
    }
  };

  const toggleColumn = (key: ContactColumnKey) => {
    const on = columns.includes(key);
    persistColumns(on ? columns.filter((c) => c !== key) : [...columns, key]);
  };
  const moveColumn = (key: ContactColumnKey, dir: -1 | 1) => {
    const idx = columns.indexOf(key);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= columns.length) return;
    const next = [...columns];
    next[idx] = columns[to];
    next[to] = columns[idx];
    persistColumns(next);
  };
  const resetColumns = () => persistColumns(DEFAULT_VISIBLE_COLUMNS);

  const buildGroups = useCallback(() => {
    if (activeTab === 'all') return filtersToGroups(filters);
    if (activeTab === 'high_rated') return filtersToGroups([{ id: 'hr', field: 'rating', operator: 'gte', value: '4' }]);
    if (activeTab === 'reviewed')
      return filtersToGroups([{ id: 'rv', field: 'reviews', operator: 'gt', value: '0' }]);
    if (activeTab === 'new_leads')
      return filtersToGroups([{ id: 'nl', field: 'lead_status', operator: 'is', value: 'new' }]);
    return filtersToGroups(filters);
  }, [filters, activeTab]);

  const fetchContacts = useCallback(async () => {
    const seq = ++fetchSeq.current;
    setLoading(true);
    setSelected(new Set());
    const groups = buildGroups();
    try {
      const res = await fetch('/api/contacts/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search: search.trim() || null,
          groups,
          tagIds: selectedTagIds,
          page,
          pageSize: PAGE_SIZE,
          order: sort,
          ascending: sortAsc,
          importedOnly: activeTab === 'imported',
        }),
      });
      if (!res.ok) throw new Error('query failed');
      const data = await res.json();
      if (seq !== fetchSeq.current) return;
      setContacts(data.contacts ?? []);
      setTotalCount(data.totalCount ?? 0);
    } catch {
      if (seq !== fetchSeq.current) return;
      toast.error(t('toastFailedLoad'));
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [search, page, selectedTagIds, buildGroups, sort, sortAsc, activeTab, t]);

  const fetchTags = useCallback(async () => {
    const { data } = await fetch('/api/tags', { cache: 'no-store' }).then((r) =>
      r.json().catch(() => ({ data: undefined }))
    );
    if (Array.isArray(data)) {
      const map: Record<string, Tag> = {};
      data.forEach((tag: Tag) => (map[tag.id] = tag));
      setTagsMap(map);
      setSelectedTagIds((prev) => prev.filter((id) => map[id]));
    }
  }, []);

  useEffect(() => {
    void fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    void fetchContacts();
  }, [fetchContacts]);

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await createClient()
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
    if (searchParams.get('contact')) {
      router.replace('/contacts', { scroll: false });
    }
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await createClient()
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);
    if (error) toast.error(t('toastFailedDelete'));
    else {
      toast.success(t('toastDeleted'));
      fetchContacts();
    }
    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);
    const { error } = await createClient()
      .from('contacts')
      .delete()
      .in('id', ids);
    if (error) toast.error(t('toastBulkFailedDelete'));
    else {
      toast.success(t('toastBulkDeleted', { count: ids.length }));
      setSelected(new Set());
      fetchContacts();
    }
    setDeleting(false);
    setBulkDeleteOpen(false);
  }

  const allOnPageSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const someOnPageSelected = contacts.some((c) => selected.has(c.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) contacts.forEach((c) => next.delete(c.id));
      else contacts.forEach((c) => next.add(c.id));
      return next;
    });
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  const allTags = Object.values(tagsMap).sort((a, b) => a.name.localeCompare(b.name));
  const hasActiveFilters =
    search.trim().length > 0 ||
    selectedTagIds.length > 0 ||
    filters.length > 0 ||
    activeTab !== 'all';

  function toggleTagFilter(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
    setPage(0);
  }
  function clearTagFilters() {
    setSelectedTagIds([]);
    setPage(0);
  }

  function clearAll() {
    setSearch('');
    setFilters([]);
    setSelectedTagIds([]);
    setActiveTab('all');
    setPage(0);
  }

  // Filter editor helpers
  const addFilter = () => {
    setFilters((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        field: 'category',
        operator: 'is',
        value: '',
        connector: prev.length > 0 ? 'and' : undefined,
      },
    ]);
  };
  const updateFilter = (id: string, patch: Partial<ContactFilter>) =>
    setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFilter = (id: string) => setFilters((prev) => prev.filter((f) => f.id !== id));

  const filterSummary = useMemo(
    () =>
      filters.map((f) => {
        const field = CONTACT_FIELDS_BY_KEY[f.field];
        const label = `${field.label} ${OPERATOR_LABELS[f.operator] ?? f.operator}${f.value ? ` ${f.value}` : ''}`;
        return { id: f.id, label };
      }),
    [filters]
  );

  async function exportContacts(mode: 'all' | 'filter' | 'selected') {
    let data: { contacts: Row[] } | null = null;
    try {
      const body: Record<string, unknown> = { all: true };
      if (mode === 'all') {
        body.search = null;
        body.groups = [];
        body.tagIds = [];
        body.importedOnly = false;
      } else if (mode === 'filter') {
        body.search = search.trim() || null;
        body.groups = buildGroups();
        body.tagIds = selectedTagIds;
        body.importedOnly = activeTab === 'imported';
      } else {
        body.ids = [...selected];
      }
      const res = await fetch('/api/contacts/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('export failed');
      data = await res.json();
    } catch {
      toast.error('Export failed');
      return;
    }
    const rows = (data?.contacts ?? []) as (Contact & { tags?: Tag[] })[];
    if (rows.length === 0) {
      toast.info('No contacts to export');
      return;
    }
    const XLSX = await import('xlsx');
    const cols: ContactColumnKey[] = CONTACT_FIELDS.map((f) => f.key).filter(
      (k) => k !== 'tags' && k !== 'updated_at'
    );
    const sheetRows = rows.map((c) => {
      const rec: Record<string, unknown> = {};
      const cr = c as unknown as Record<string, unknown>;
      for (const k of cols) {
        const key = CONTACT_FIELDS_BY_KEY[k].label;
        if (k === 'rating') rec[key] = cr.rating ?? '';
        else if (k === 'reviews') rec[key] = cr.review_count ?? '';
        else if (k === 'created_at')
          rec[key] =
            typeof cr.created_at === 'string'
              ? cr.created_at.slice(0, 10)
              : '';
        else rec[key] = cr[CONTACT_FIELDS_BY_KEY[k].dbColumn ?? ''] ?? '';
      }
      rec['Tags'] = (c.tags ?? []).map((tg) => tg.name).join(', ');
      return rec;
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    XLSX.writeFile(wb, `contacts-${Date.now()}.xlsx`);
    toast.success(`Exported ${rows.length.toLocaleString()} contacts`);
  }

  // Filter editor value component
  function OperatorInputs({ f }: { f: ContactFilter }) {
    const type = CONTACT_FIELDS_BY_KEY[f.field]?.type ?? 'text';
    const numeric = type === 'number';
    const isDate = type === 'date';
    const noValue = [
      'is_empty',
      'is_not_empty',
      'today',
      'yesterday',
      'last7',
      'last30',
      'this_month',
      'custom',
    ].includes(f.operator);
    if (noValue && f.operator !== 'custom') return null;
    const inputClass = 'bg-muted border-border text-foreground h-8 text-sm';
    return (
      <div className="flex items-center gap-1.5">
        {(numeric || f.operator === 'before' || f.operator === 'after' || f.operator === 'custom') && (
          <Input
            value={f.value}
            onChange={(e) => updateFilter(f.id, { value: e.target.value })}
            placeholder={isDate ? 'YYYY-MM-DD' : 'value'}
            className={`${inputClass} w-28`}
          />
        )}
        {(f.operator === 'between') && (
          <>
            <Input
              value={f.value}
              onChange={(e) => updateFilter(f.id, { value: e.target.value })}
              placeholder="min"
              className={`${inputClass} w-20`}
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              value={f.value2 ?? ''}
              onChange={(e) => updateFilter(f.id, { value2: e.target.value })}
              placeholder="max"
              className={`${inputClass} w-20`}
            />
          </>
        )}
        {f.operator === 'custom' && (
          <>
            <Input
              value={f.value}
              onChange={(e) => updateFilter(f.id, { value: e.target.value })}
              placeholder="from"
              className={`${inputClass} w-28`}
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              value={f.value2 ?? ''}
              onChange={(e) => updateFilter(f.id, { value2: e.target.value })}
              placeholder="to"
              className={`${inputClass} w-28`}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount > 0 ? t('subtitle', { count: totalCount }) : t('subtitleZero')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEditSettings && (
            <Button
              variant="outline"
              onClick={() => setCustomFieldsOpen(true)}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <SlidersHorizontal className="size-4" />
              {t('customFieldsBtn')}
            </Button>
          )}

          {/* Export */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" className="border-border text-muted-foreground hover:bg-muted" />}
            >
              <Download className="size-4" />
              Export
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem onClick={() => exportContacts('all')} className="text-popover-foreground">
                Export All
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasActiveFilters}
                onClick={() => exportContacts('filter')}
                className="text-popover-foreground disabled:opacity-40"
              >
                Export Current Filter
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={selected.size === 0}
                onClick={() => exportContacts('selected')}
                className="text-popover-foreground disabled:opacity-40"
              >
                Export Selected ({selected.size})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <GatedButton
            variant="outline"
            canAct={canEdit}
            gateReason="add or import contacts"
            onClick={() => setImportOpen(true)}
            className="border-border text-muted-foreground hover:bg-muted"
          >
            <Upload className="size-4" />
            Import
          </GatedButton>
          <GatedButton
            canAct={canEdit}
            gateReason="add or import contacts"
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            {t('addContactBtn')}
          </GatedButton>
        </div>
      </div>

      {/* Quick tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', 'All'],
            ['high_rated', 'High Rated'],
            ['reviewed', 'Reviewed'],
            ['new_leads', 'New Leads'],
            ['imported', 'Imported'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => {
              setActiveTab(key);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              activeTab === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search + filter + columns */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Search name, location, category, phone, email, website…"
              className="pl-8 bg-card border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Filter builder */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  className={`border-border shrink-0 ${
                    filters.length > 0
                      ? 'text-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                />
              }
            >
              <Filter className="size-4" />
              Filter
              {filters.length > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {filters.length}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[26rem] p-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-popover-foreground">Filter contacts</p>
                {filters.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No filters applied.</p>
                ) : (
                  filters.map((f, idx) => {
                    const def = CONTACT_FIELDS_BY_KEY[f.field];
                    const ops = operatorsForType(def?.type ?? 'text');
                    const fieldCandidates = CONTACT_FIELDS.filter((fc) => fc.filterable);
                    return (
                      <div key={f.id} className="space-y-1.5 rounded-lg border border-border/70 bg-background/40 p-2">
                        <div className="flex items-center gap-1.5">
                          {idx > 0 && (
                            <Select
                              value={f.connector ?? 'and'}
                              onValueChange={(v) => updateFilter(f.id, { connector: v as 'and' | 'or' })}
                            >
                              <SelectTrigger className="h-7 w-16 bg-muted border-border text-muted-foreground text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover border-border">
                                <SelectItem value="and">AND</SelectItem>
                                <SelectItem value="or">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <Select
                            value={f.field}
                            onValueChange={(v) =>
                              updateFilter(f.id, {
                                field: v as ContactColumnKey,
                                operator: 'is',
                                value: '',
                                value2: undefined,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 flex-1 bg-muted border-border text-muted-foreground text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              {fieldCandidates
                                .filter((fc) => !(fc.key === 'tags'))
                                .map((fc) => (
                                  <SelectItem key={fc.key} value={fc.key}>
                                    {fc.label}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <button
                            onClick={() => removeFilter(f.id)}
                            className="text-muted-foreground hover:text-red-400"
                            aria-label="Remove filter"
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 pl-0">
                          <Select
                            value={f.operator}
                            onValueChange={(v) => updateFilter(f.id, { operator: v as FilterOperator, value: '', value2: undefined })}
                          >
                            <SelectTrigger className="h-7 w-40 bg-muted border-border text-muted-foreground text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-popover border-border">
                              {ops.map((op) => (
                                <SelectItem key={op} value={op}>
                                  {OPERATOR_LABELS[op] ?? op}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <OperatorInputs f={f} />
                        </div>
                      </div>
                    );
                  })
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFilter}
                  className="w-full border-border text-muted-foreground hover:bg-muted"
                >
                  <PlusCircle className="size-4" />
                  Add condition
                </Button>
                {filters.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters([])}
                    className="w-full text-red-400 hover:bg-red-950/20"
                  >
                    Clear filters
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Sort */}
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as OrderKey);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-9 w-[10.5rem] shrink-0 bg-card border-border text-muted-foreground text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="created_at">Newest first</SelectItem>
              <SelectItem value="name">Name (A–Z)</SelectItem>
              <SelectItem value="rating">Highest rating</SelectItem>
              <SelectItem value="review_count">Most reviews</SelectItem>
              <SelectItem value="location">Location</SelectItem>
              <SelectItem value="category">Category</SelectItem>
              <SelectItem value="lead_status">Lead status</SelectItem>
            </SelectContent>
          </Select>

          {/* Sort direction */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortAsc((v) => !v)}
            className="border-border text-muted-foreground hover:bg-muted shrink-0"
            aria-label="Toggle sort order"
          >
            {sortAsc ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}
          </Button>

          {/* Columns manager */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  className="border-border text-muted-foreground hover:bg-muted shrink-0"
                />
              }
            >
              <Columns3 className="size-4" />
              Columns
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-popover-foreground">Columns</p>
                <button
                  onClick={resetColumns}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              </div>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {columns.map((key, idx) => {
                  const def = CONTACT_FIELDS_BY_KEY[key];
                  return (
                    <div key={key} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
                      <Checkbox
                        checked
                        onCheckedChange={() => toggleColumn(key)}
                        aria-label={`Hide ${def.label}`}
                      />
                      <span className="flex-1 text-sm text-popover-foreground">{def.label}</span>
                      <button
                        onClick={() => moveColumn(key, -1)}
                        disabled={idx === 0}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label={`Move ${def.label} up`}
                      >
                        <ArrowUp className="size-3.5" />
                      </button>
                      <button
                        onClick={() => moveColumn(key, 1)}
                        disabled={idx === columns.length - 1}
                        className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                        aria-label={`Move ${def.label} down`}
                      >
                        <ArrowDown className="size-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 border-t border-border/70 pt-2">
                <p className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                  Hidden
                </p>
                {CONTACT_FIELDS.filter((f) => !columns.includes(f.key)).map((f) => (
                  <label
                    key={f.key}
                    className="flex cursor-pointer items-center gap-2 px-1 py-1 text-sm text-muted-foreground hover:bg-muted/40"
                  >
                    <Checkbox onCheckedChange={() => toggleColumn(f.key)} />
                    {f.label}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Tag filter */}
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  className={`border-border shrink-0 ${
                    selectedTagIds.length > 0 ? 'text-primary' : 'text-muted-foreground hover:bg-muted'
                  }`}
                />
              }
            >
              <Filter className="size-4" />
              {t('filterByTags')}
              {selectedTagIds.length > 0 && (
                <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {selectedTagIds.length}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                <span className="text-sm font-medium text-popover-foreground">
                  {t('filterByTags')}
                </span>
                {selectedTagIds.length > 0 && (
                  <button onClick={clearTagFilters} className="text-xs text-muted-foreground hover:text-foreground">
                    {t('clearAll')}
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {allTags.map((tag) => (
                  <label
                    key={tag.id}
                    className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={() => toggleTagFilter(tag.id)}
                    />
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                    <span className="text-sm text-popover-foreground truncate">{tag.name}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Active filter summary */}
        {(filters.length > 0 || selectedTagIds.length > 0 || activeTab !== 'all' || search.trim()) && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground">Active:</span>
            {search.trim() && (
              <ActiveChip label={`Search: "${search.trim()}"`} onRemove={() => setSearch('')} />
            )}
            {activeTab !== 'all' && (
              <ActiveChip label={`Tab: ${activeTab.replace('_', ' ')}`} onRemove={() => setActiveTab('all')} />
            )}
            {filters.map((f) => {
              const fl = filterSummary.find((s) => s.id === f.id);
              return (
                <ActiveChip key={f.id} label={fl?.label ?? 'filter'} onRemove={() => removeFilter(f.id)} />
              );
            })}
            {selectedTagIds.map((id) => {
              const tag = tagsMap[id];
              if (!tag) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                  <button onClick={() => toggleTagFilter(id)} className="hover:opacity-70">
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground px-1">
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 px-4 py-2">
          <p className="text-sm text-foreground">{t('selectedCount', { count: selected.size })}</p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())} className="text-muted-foreground hover:text-foreground">
              {t('clearSelection')}
            </Button>
            <GatedButton
              variant="destructive"
              size="sm"
              canAct={canEdit}
              gateReason="delete contacts"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="size-4" /> {t('deleteSelected')}
            </GatedButton>
          </div>
        </div>
      )}

      {/* Table (md+) */}
      <div className="hidden md:block rounded-lg border border-border overflow-hidden">
        <Table className="min-w-[46rem]">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  indeterminate={!allOnPageSelected && someOnPageSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={contacts.length === 0}
                  aria-label="Select all"
                />
              </TableHead>
              {columns.map((key) => (
                <TableHead key={key} className="text-muted-foreground whitespace-nowrap">
                  {CONTACT_FIELDS_BY_KEY[key].label}
                </TableHead>
              ))}
              <TableHead className="text-muted-foreground w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-border">
                <TableCell colSpan={columns.length + 2} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{t('loading')}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow className="border-border">
                <TableCell colSpan={columns.length + 2} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {hasActiveFilters ? t('noContactsMatch') : t('noContactsYet')}
                    </p>
                    {!hasActiveFilters && (
                      <GatedButton canAct={canEdit} gateReason="add or import contacts" variant="outline" size="sm" onClick={openAddForm} className="mt-2 border-border text-muted-foreground hover:bg-muted">
                        <Plus className="size-3.5" /> {t('addFirstContact')}
                      </GatedButton>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="border-border hover:bg-muted/50 cursor-pointer"
                  onClick={() => openDetail(contact.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(contact.id)}
                      onCheckedChange={() => toggleSelect(contact.id)}
                    />
                  </TableCell>
                  {columns.map((key) => (
                    <TableCell key={key} className="text-sm">
                      <FieldContent field={key} row={contact} />
                    </TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()} />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-popover border-border">
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); openEditForm(contact); }}
                          className="text-popover-foreground"
                        >
                          <Pencil className="size-4" /> {t('editAction')}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-border" />
                        <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); confirmDelete(contact); }}>
                          <Trash2 className="size-4" /> {t('deleteAction')}
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

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-sm text-muted-foreground">
            <Users className="size-8" />
            {hasActiveFilters ? t('noContactsMatch') : t('noContactsYet')}
          </div>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              onClick={() => openDetail(contact.id)}
              className="cursor-pointer rounded-lg border border-border bg-card p-3 hover:bg-muted/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{contact.name || '(unnamed)'}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <PhoneIcon className="size-3" /> {contact.phone}
                  </p>
                  {contact.email && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" /> <span className="truncate">{contact.email}</span>
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <LeadStatusBadge status={contact.lead_status} />
                  <RatingStars value={contact.rating} />
                </div>
              </div>
              {(contact.category || contact.location || contact.country) && (
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  {contact.category && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"><Landmark className="size-3" />{contact.category}</span>
                  )}
                  {contact.location && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5"><MapPin className="size-3" />{contact.location}</span>
                  )}
                  {contact.country && (
                    <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5">{contact.country}</span>
                  )}
                </div>
              )}
              {contact.tags && contact.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {contact.tags.slice(0, 3).map((tag) => (
                    <span key={tag.id} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{formatCreated(contact.created_at)}</span>
                <button onClick={(e) => { e.stopPropagation(); openEditForm(contact); }} className="text-xs text-primary hover:underline">
                  View Details
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {t('showingPagination', { start: page * PAGE_SIZE + 1, end: Math.min((page + 1) * PAGE_SIZE, totalCount), total: totalCount })}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)} className="border-border text-muted-foreground hover:bg-muted disabled:opacity-30">
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">{t('pageCount', { page: page + 1, total: totalPages })}</span>
            <Button variant="outline" size="icon-sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)} className="border-border text-muted-foreground hover:bg-muted disabled:opacity-30">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <ContactForm open={formOpen} onOpenChange={setFormOpen} contact={editContact} contactTags={editContactTags} onSaved={() => { fetchContacts(); fetchTags(); }} onViewExisting={(id) => { setFormOpen(false); openDetail(id); }} />

      <ContactDetailView open={detailOpen} onOpenChange={setDetailOpen} contactId={detailContactId} onUpdated={fetchContacts} />

      <ImportModal open={importOpen} onOpenChange={setImportOpen} onImported={fetchContacts} />

      {canEditSettings && <CustomFieldsManager open={customFieldsOpen} onOpenChange={setCustomFieldsOpen} />}

      {/* Delete confirm */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t('deleteContactTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{t('deleteContactDesc', { name: deleteTarget?.name || deleteTarget?.phone || '' })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="border-border text-muted-foreground hover:bg-muted">{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting && <Loader2 className="size-4 animate-spin" />}{t('deleteBtn')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirm */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="bg-popover border-border text-popover-foreground sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-popover-foreground">{t('deleteBulkTitle')}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{t('deleteBulkDesc', { count: selected.size })}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-popover border-border">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} className="border-border text-muted-foreground hover:bg-muted">{t('cancel')}</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>{deleting && <Loader2 className="size-4 animate-spin" />}{t('deleteBtn')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
      {label}
      <button onClick={onRemove} className="hover:opacity-70" aria-label={`Remove ${label}`}>
        <X className="size-3" />
      </button>
    </span>
  );
}
