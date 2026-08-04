"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag, Conversation, FollowUp, LeadStatus } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  User,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  FileText,
  Flag,
  Calendar,
  CheckCircle2,
  Circle,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

interface ContactSidebarProps {
  contact: Contact | null;
  /** The active conversation, used to look up the assigned agent. */
  conversation: Conversation | null;
}

function leadStatusColor(status: LeadStatus): { bg: string; text: string } {
  switch (status) {
    case "new":
      return { bg: "#e5e7eb20", text: "#6b7280" };
    case "contacted":
      return { bg: "#dbeafe20", text: "#3b82f6" };
    case "qualified":
      return { bg: "#d1fae520", text: "#10b981" };
    case "proposal":
      return { bg: "#fef3c720", text: "#d97706" };
    case "negotiation":
      return { bg: "#f3e8ff20", text: "#8b5cf6" };
    case "won":
      return { bg: "#dcfce720", text: "#16a34a" };
    case "lost":
      return { bg: "#fee2e220", text: "#dc2626" };
    default:
      return { bg: "#e5e7eb20", text: "#6b7280" };
  }
}

export function ContactSidebar({ contact, conversation }: ContactSidebarProps) {
  const tSidebar = useTranslations("Inbox.sidebar");
  const tThread = useTranslations("Inbox.messageThread");

  const { accountId } = useAuth();
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [documents, setDocuments] = useState<
    {
      id: string;
      content_type: string;
      media_url: string | null;
      content_text: string | null;
      created_at: string;
    }[]
  >([]);
  const [assignedAgentName, setAssignedAgentName] = useState<string | null>(
    null,
  );
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [newFollowUpTitle, setNewFollowUpTitle] = useState("");
  const [addingFollowUp, setAddingFollowUp] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, tags, media documents, assigned agent, and follow-ups in parallel
    const agentId = conversation?.assigned_agent_id;
    const [dealsRes, notesRes, tagsRes, docsRes, agentRes, followUpsRes] =
      await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
      // Documents = messages linked to this contact's conversations
      // that carry a media_url (images, videos, audio, documents, templates).
      supabase
        .from("messages")
        .select(
          "id, content_type, media_url, content_text, created_at, conversations!inner(contact_id)",
        )
        .eq("conversations.contact_id", contact.id)
        .not("media_url", "is", null)
        .order("created_at", { ascending: false }),
      // Assigned agent profile name (if a conversation is active).
      agentId
        ? supabase
            .from("profiles")
            .select("full_name")
            .eq("user_id", agentId)
            .single()
        : { data: null as null, error: null as null },
      supabase
        .from("follow_ups")
        .select("*")
        .eq("contact_id", contact.id)
        .eq("account_id", contact.account_id)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
    if (docsRes.data) setDocuments(docsRes.data);
    if (agentRes?.data?.full_name) setAssignedAgentName(agentRes.data.full_name);
    if (followUpsRes.data) setFollowUps(followUpsRes.data as FollowUp[]);
  }, [contact, conversation?.assigned_agent_id]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  const handleAddFollowUp = useCallback(async () => {
    if (!contact || !newFollowUpTitle.trim() || !accountId) return;
    setAddingFollowUp(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("follow_ups")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        title: newFollowUpTitle.trim(),
        status: "pending",
      })
      .select("*")
      .single();

    if (!error && data) {
      setFollowUps((prev) => [data, ...prev]);
      setNewFollowUpTitle("");
    }
    setAddingFollowUp(false);
  }, [contact, newFollowUpTitle, accountId]);

  const handleToggleFollowUp = useCallback(async (fu: FollowUp) => {
    const supabase = createClient();
    const nextStatus = fu.status === "pending" ? "completed" : "pending";
    const updates: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "completed") {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }

    const { error } = await supabase
      .from("follow_ups")
      .update(updates)
      .eq("id", fu.id);

    if (!error) {
      setFollowUps((prev) =>
        prev.map((f) =>
          f.id === fu.id
            ? { ...f, status: nextStatus as FollowUp["status"], completed_at: updates.completed_at as string | undefined }
            : f
        )
      );
    }
  }, []);

  const handleDeleteFollowUp = useCallback(async (fuId: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("follow_ups")
      .delete()
      .eq("id", fuId);

    if (!error) {
      setFollowUps((prev) => prev.filter((f) => f.id !== fuId));
    }
  }, []);

  if (!contact) {
    return (
      <div className="flex h-full w-70 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-70 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Assigned to */}
          {assignedAgentName && (
            <>
              <div className="my-2 border-t border-border" />
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{tSidebar("assignedTo")}</span>
                <span className="text-sm font-medium text-foreground">{assignedAgentName}</span>
              </div>
            </>
          )}

          {/* Lead Status */}
          {contact.lead_status && (
            <>
              <div className="my-2 border-t border-border" />
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                <Flag className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{tSidebar("leadStatus")}</span>
                <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{
                    backgroundColor: leadStatusColor(contact.lead_status).bg,
                    color: leadStatusColor(contact.lead_status).text,
                  }}
                >
                  {contact.lead_status}
                </span>
              </div>
            </>
          )}

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Tags */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <TagIcon className="h-3 w-3" />
              {tSidebar("tags")}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {tags.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noTags")}</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${tag.color}20`,
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Active Deals */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              {tSidebar("deals")}
            </div>
            <div className="mt-2 space-y-2">
              {deals.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noDeals")}</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {deal.title}
                    </p>
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {deal.currency ?? "$"}
                        {deal.value.toLocaleString()}
                      </span>
                      {deal.stage && (
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[10px]"
                          style={{
                            backgroundColor: `${deal.stage.color}20`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Documents / Media */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <FileText className="h-3 w-3" />
              {tSidebar("documents")}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {documents.length === 0 ? (
                <p className="col-span-2 px-1 text-xs text-muted-foreground">{tSidebar("noDocuments")}</p>
              ) : (
                documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.media_url ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1 rounded-lg bg-muted p-2 text-center"
                  >
                      {doc.content_type === "image" ? (
                        <img
                          src={doc.media_url ?? ""}
                          alt={doc.content_text || "Shared image"}
                          className="h-12 w-12 rounded object-cover"
                        />
                      ) : doc.content_type === "video" ? (
                        <video
                          src={doc.media_url ?? ""}
                          className="h-12 w-12 rounded object-cover"
                          controls={false}
                        />
                      ) : doc.content_type === "audio" ? (
                        <audio
                          src={doc.media_url ?? ""}
                          controls={false}
                          className="w-full"
                        />
                      ) : (
                        <FileText className="h-6 w-6 text-muted-foreground" />
                      )}
                    <span
                      className="truncate text-[10px] text-muted-foreground"
                      title={doc.content_text || doc.content_type}
                    >
                      {doc.content_text || tSidebar(doc.content_type)}
                    </span>
                  </a>
                ))
              )}
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              {tSidebar("notes")}
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={tSidebar("addNotePlaceholder")}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Follow-ups */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {tSidebar("followUps")}
            </div>
            <div className="mt-2 space-y-2">
              {followUps.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">{tSidebar("noFollowUps")}</p>
              ) : (
                followUps.map((fu) => (
                  <div
                    key={fu.id}
                    className={`rounded-lg px-3 py-2 ${fu.status === "completed" ? "bg-muted/50 opacity-60" : "bg-muted"}`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => handleToggleFollowUp(fu)}
                        className="mt-0.5 shrink-0"
                        title={fu.status === "completed" ? tSidebar("markPending") : tSidebar("markComplete")}
                      >
                        {fu.status === "completed" ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium ${fu.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {fu.title}
                        </p>
                        {fu.due_date && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Due: {format(new Date(fu.due_date), "MMM d, yyyy HH:mm")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteFollowUp(fu.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        title={tSidebar("deleteFollowUp")}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newFollowUpTitle}
                onChange={(e) => setNewFollowUpTitle(e.target.value)}
                placeholder={tSidebar("addFollowUpPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddFollowUp();
                }}
                className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
              />
              <Button
                size="sm"
                className="h-auto bg-primary px-2 hover:bg-primary/90"
                onClick={handleAddFollowUp}
                disabled={!newFollowUpTitle.trim() || addingFollowUp}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
