"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  CONVERSATION_SELECT,
  matchesContactFilters,
  normalizeConversations,
} from "@/lib/inbox/conversations";
import { cn } from "@/lib/utils";
import type {
  Conversation,
  ConversationPlatform,
  ConversationStatus,
  Tag,
} from "@/types";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Search, ChevronDown, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  resyncToken?: number;
  /** Pre-select a platform filter from the URL (?channel=instagram etc.) */
  initialPlatformFilter?: PlatformFilter;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground",
};

const PLATFORM_BADGE: Record<ConversationPlatform, string> = {
  whatsapp: "bg-[#25D366]/15 text-[#0f9d58]",
  facebook: "bg-[#1877F2]/15 text-[#1877F2]",
  instagram: "bg-[#E1306C]/15 text-[#E1306C]",
  telegram: "bg-[#2AABEE]/15 text-[#2AABEE]",
};



type InboxFilter =
  | "all"
  | "unread"
  | "assigned_me"
  | "ai"
  | "archived";

type PlatformFilter = ConversationPlatform | "all";

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  initialPlatformFilter = "all",
}: ConversationListProps) {
  const t = useTranslations("Inbox.conversationList");
  
   const FILTER_OPTIONS: { label: string; value: InboxFilter }[] = useMemo(() => [
     { label: t("filterAll"), value: "all" },
     { label: t("filterUnread"), value: "unread" },
     { label: t("filterAssignedMe"), value: "assigned_me" },
     { label: t("filterAI"), value: "ai" },
     { label: t("filterArchived"), value: "archived" },
   ], [t]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [loading, setLoading] = useState(true);
  // Contact-based filters (issue #272). Tags use OR logic (a conversation
  // matches if its contact carries any selected tag), consistent with
  // Broadcast audience filtering. Company is an exact match on the field.
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  // Multi-channel: filter to one platform. The chip row stays hidden until
  // a non-WhatsApp conversation actually exists, so WhatsApp-only inboxes
  // look exactly as before.
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>(initialPlatformFilter);

  // Drag-and-drop status organization. Track only the id being dragged;
  // the payload is derived from `conversations` so the overlay stays in
  // sync with realtime updates.
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Small distance so plain clicks still select a conversation instead
      // of always starting a drag.
      activationConstraint: { distance: 6 },
    })
  );

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(normalizeConversations(data ?? []));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken]);

  // Tag definitions for the filter picker — loaded once so labels/colours
  // stay stable regardless of which conversations happen to be loaded.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("tags").select("*").order("name");
      if (!cancelled && data) setTags(data as Tag[]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Company options are derived from the loaded conversations — there's no
  // separate companies table, and only companies with a live conversation
  // are worth offering as an inbox filter.
  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of conversations) {
      const co = c.contact?.company?.trim();
      if (co) set.add(co);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  const tagsById = useMemo(() => {
    const m = new Map<string, Tag>();
    for (const t of tags) m.set(t.id, t);
    return m;
  }, [tags]);

  const { user } = useAuth();

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter === "unread") {
      result = result.filter((c) => c.unread_count > 0);
    } else if (filter === "assigned_me") {
      result = result.filter((c) => c.assigned_agent_id === user?.id);
    } else if (filter === "ai") {
      result = result.filter((c) => (c.ai_reply_count ?? 0) > 0);
    } else if (filter === "archived") {
      result = result.filter((c) => c.status === "closed");
    }

    // Contact-based filters (tags via OR logic, exact company match).
    if (selectedTagIds.length > 0 || selectedCompany !== null) {
      result = result.filter((c) =>
        matchesContactFilters(c, {
          tagIds: selectedTagIds,
          company: selectedCompany,
        })
      );
    }

    if (platformFilter !== "all") {
      result = result.filter((c) => c.platform === platformFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [conversations, filter, search, selectedTagIds, selectedCompany, user?.id, platformFilter]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  }, []);

  const clearContactFilters = useCallback(() => {
    setSelectedTagIds([]);
    setSelectedCompany(null);
  }, []);

  const hasContactFilters = selectedTagIds.length > 0 || selectedCompany !== null;

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  // The platform chip row only appears once Messenger/Instagram data
  // exists — zero visual change for WhatsApp-only inboxes.
  const hasMultiPlatform = useMemo(
    () => conversations.some((c) => c.platform !== "whatsapp"),
    [conversations]
  );

  const PLATFORM_CHIPS: { value: PlatformFilter; label: string }[] = useMemo(
    () => [
      { value: "all", label: t("platformAll") },
      { value: "whatsapp", label: t("platformWhatsapp") },
      { value: "facebook", label: t("platformMessenger") },
      { value: "instagram", label: t("platformInstagram") },
      { value: "telegram", label: t("platformTelegram") },
    ],
    [t]
  );

  const draggableConversation = useMemo(
    () => conversations.find((c) => c.id === activeDragId) ?? null,
    [conversations, activeDragId]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id.toString());
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragId(null);
      const { active, over } = event;
      if (!over) return;
      const dropId = over.id.toString();
      if (!dropId.startsWith("status-")) return;
      const conv = conversations.find((c) => c.id === active.id);
      if (!conv) return;
      const newStatus = dropId.slice("status-".length) as ConversationStatus;
      if (conv.status === newStatus) return;
      // Optimistic update through the existing loading callback (the
      // parent owns the array); realtime reconciles any race below.
      onConversationsLoadedRef.current(
        conversations.map((c) =>
          c.id === conv.id ? { ...c, status: newStatus } : c
        )
      );
      const supabase = createClient();
      const { error } = await supabase
        .from("conversations")
        .update({ status: newStatus })
        .eq("id", conv.id);
      if (error) {
        console.error(
          "[inbox] failed to move conversation to " + newStatus + ":",
          error.message
        );
      }
    },
    [conversations]
  );

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-80">
      {/* Search + Filter */}
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-muted pl-9 text-sm text-foreground placeholder-muted-foreground focus:border-primary/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted">
                {activeFilter?.label ?? t("filterAll")}
                <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-border bg-popover"
            >
              {FILTER_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "text-sm",
                    filter === opt.value
                      ? "text-primary"
                      : "text-popover-foreground"
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {tags.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-muted",
                  selectedTagIds.length > 0
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t("tags")}
                {selectedTagIds.length > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {selectedTagIds.length}
                  </span>
                )}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 w-56 border-border bg-popover"
              >
                {tags.map((t) => (
                  <DropdownMenuCheckboxItem
                    key={t.id}
                    checked={selectedTagIds.includes(t.id)}
                    onCheckedChange={() => toggleTag(t.id)}
                    className="text-sm text-popover-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      <span className="truncate">{t.name}</span>
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {companies.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex max-w-40 items-center justify-center h-7 gap-1 px-2 text-xs rounded-md hover:bg-muted",
                  selectedCompany
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="truncate">{selectedCompany ?? t("company")}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-64 w-56 border-border bg-popover"
              >
                <DropdownMenuItem
                  onClick={() => setSelectedCompany(null)}
                  className={cn(
                    "text-sm",
                    selectedCompany === null
                      ? "text-primary"
                      : "text-popover-foreground"
                  )}
                >
                  {t("allCompanies")}
                </DropdownMenuItem>
                {companies.map((co) => (
                  <DropdownMenuItem
                    key={co}
                    onClick={() => setSelectedCompany(co)}
                    className={cn(
                      "text-sm",
                      selectedCompany === co
                        ? "text-primary"
                        : "text-popover-foreground"
                    )}
                  >
                    <span className="truncate">{co}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {hasMultiPlatform && (
          <div className="flex flex-wrap items-center gap-1">
            {PLATFORM_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setPlatformFilter(chip.value)}
                className={cn(
                  "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-medium transition-colors",
                  platformFilter === chip.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {chip.label}
              </button>
            ))}
          </div>
        )}

        {hasContactFilters && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTagIds.map((id) => {
              const tag = tagsById.get(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleTag(id)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground hover:bg-muted/70"
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag?.color ?? "var(--muted-foreground)" }}
                  />
                  <span className="max-w-24 truncate">{tag?.name ?? t("tags")}</span>
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            {selectedCompany && (
              <button
                onClick={() => setSelectedCompany(null)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground hover:bg-muted/70"
              >
                <span className="max-w-24 truncate">{selectedCompany}</span>
                <X className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={clearContactFilters}
              className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t("clearAll")}
            </button>
          </div>
        )}
      </div>

      {/* Conversation Items.
          `min-h-0` is load-bearing: a flex child defaults to
          min-height:auto, so without it this ScrollArea grows to fit
          every conversation instead of shrinking to the remaining
          space — the list then overflows and gets clipped by the
          parent's overflow-hidden with no scrollbar (issue #229). */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {!loading && conversations.length > 0 && (
          <div className="border-b border-border px-3 py-2">
            <p className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("dropStatusHint")}
            </p>
            <div className="flex items-center gap-1.5">
              {(["open", "pending", "closed"] as ConversationStatus[]).map(
                (status) => (
                  <StatusDropZone key={status} status={status} t={t} />
                )
              )}
            </div>
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-3">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {search.trim() ||
                  selectedTagIds.length > 0 ||
                  selectedCompany !== null ||
                  filter !== "all" ||
                  platformFilter !== "all"
                  ? t("noConversationsFilteredDesc")
                  : t("noConversationsTitle")}
              </p>
              {(!search.trim() &&
                selectedTagIds.length === 0 &&
                selectedCompany === null &&
                filter === "all" &&
                platformFilter === "all") && (
                  <p className="mt-1 text-xs text-muted-foreground max-w-xs">
                    {t("noConversationsDesc")}
                  </p>
                )}
            </div>
          ) : (
            <div className="flex flex-col">
              {filtered.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onSelect={handleSelect}
                  t={t}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        <DragOverlay>
          {draggableConversation && (
            <DragOverlayCard conversation={draggableConversation} t={t} />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
  t: ReturnType<typeof useTranslations>;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  t,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || t("unknown");
  const initials = displayName.charAt(0).toUpperCase();

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: conversation.id,
  });

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: false,
      })
    : "";

  const isNonWhatsapp =
    conversation.platform && conversation.platform !== "whatsapp";

  return (
    <button
      ref={setNodeRef}
      onClick={handleClick}
      {...attributes}
      {...listeners}
      className={cn(
        "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
        isActive && "border-l-2 border-primary bg-muted/70",
        isDragging && "opacity-40"
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
        {contact?.avatar_url ? (
          <img
            src={contact.avatar_url}
            alt={displayName}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-sm font-medium text-foreground">
              {displayName}
            </span>
            {isNonWhatsapp && (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
                  PLATFORM_BADGE[conversation.platform!]
                )}
              >
                {conversation.platform === "facebook" ? t("platformMessenger") : conversation.platform === "telegram" ? t("platformTelegram") : t("platformInstagram")}
              </span>
            )}
          </div>
          <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">
            {conversation.last_message_text || t("noMessagesYet")}
          </p>
          <div className="flex shrink-0 items-center gap-1.5">
            {conversation.unread_count > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {conversation.unread_count}
              </span>
            )}
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_COLORS[conversation.status]
              )}
              title={conversation.status}
            />
          </div>
        </div>
      </div>
    </button>
  );
}

/** Drop target for one conversation status, used by the drag strip. */
function StatusDropZone({
  status,
  t,
}: {
  status: ConversationStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status-${status}` });
  const label =
    status === "open"
      ? t("dropOpen")
      : status === "pending"
        ? t("dropPending")
        : t("dropClosed");

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 rounded-md border border-dashed px-2 py-1.5 text-center text-[11px] font-medium transition-colors",
        isOver
          ? status === "open"
            ? "border-primary bg-primary/5 text-primary"
            : status === "pending"
              ? "border-amber-500 bg-amber-500/5 text-amber-600"
              : "border-muted-foreground/60 bg-muted/40 text-muted-foreground"
          : "border-border text-muted-foreground/70"
      )}
    >
      {label}
    </div>
  );
}

/** Static preview shown under the pointer while dragging an item. */
function DragOverlayCard({
  conversation,
  t,
}: {
  conversation: Conversation;
  t: ReturnType<typeof useTranslations>;
}) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || t("unknown");

  return (
    <div className="flex w-72 items-center gap-3 rounded-lg border border-border bg-card px-3 py-3 shadow-lg">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
        {displayName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {displayName}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.last_message_text || t("noMessagesYet")}
        </p>
      </div>
      {conversation.platform && conversation.platform !== "whatsapp" && (
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide",
            PLATFORM_BADGE[conversation.platform]
          )}
        >
          {conversation.platform === "facebook" ? t("platformMessenger") : conversation.platform === "telegram" ? t("platformTelegram") : t("platformInstagram")}
        </span>
      )}
    </div>
  );
}
