// ============================================================
// Customer activity log helpers.
//
// Every customer-facing interaction (message in/out, note, follow-up
// lifecycle, status change) is recorded as a row in
// `customer_activities`. This gives the CRM a single chronological
// timeline that is:
//
//   * Idempotent — writes carry an `external_id` and are deduped by a
//     unique (account_id, external_id) constraint, so webhook retries
//     and repeated events never double-log.
//   * Safe — every entry point is best-effort and never throws, so a
//     logging failure can never break a message send or a webhook.
//
// The `messages` table remains the source of truth for message content;
// activities are a lightweight index over it plus non-message events.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActivityDirection,
  ActivityKind,
  CustomerActivity,
} from '@/types';
import {
  applyOutboundRules,
  cancelRulesOnReply,
} from '@/lib/crm/follow-up-rules';

export const ACTIVITY_KINDS: readonly ActivityKind[] = [
  'message_sent',
  'message_received',
  'note',
  'follow_up_created',
  'follow_up_completed',
  'follow_up_rescheduled',
  'follow_up_cancelled',
  'status_changed',
  'deal_updated',
  'system',
];

export interface RecordActivityInput {
  accountId: string;
  contactId: string;
  kind: ActivityKind;
  direction?: ActivityDirection | null;
  channel?: string | null;
  title?: string | null;
  body?: string | null;
  status?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  userId?: string | null;
  /** Stable dedupe key. Rows with the same (account, externalId) are ignored. */
  externalId?: string | null;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  telegram: 'Telegram',
  x: 'X',
  threads: 'Threads',
};

export function channelLabel(channel?: string | null): string {
  if (!channel) return 'Unknown';
  return CHANNEL_LABELS[channel.toLowerCase()] ?? channel;
}

/**
 * Append one activity row. Idempotent when `externalId` is set.
 * Best-effort: swallows and logs errors.
 */
export async function recordActivity(
  db: SupabaseClient,
  input: RecordActivityInput,
): Promise<CustomerActivity | null> {
  try {
    const row = {
      account_id: input.accountId,
      contact_id: input.contactId,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId ?? null,
      user_id: input.userId ?? null,
      kind: input.kind,
      direction: input.direction ?? null,
      channel: input.channel ?? null,
      title: input.title ?? null,
      body: input.body ? input.body.slice(0, 4000) : null,
      status: input.status ?? null,
      external_id: input.externalId ?? null,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    };

    const { data, error } = await db
      .from('customer_activities')
      .upsert(row, { onConflict: 'account_id,external_id', ignoreDuplicates: true })
      .select('*');

    if (error) {
      console.warn('[activity] record skipped:', error.message);
      return null;
    }
    return (data?.[0] as CustomerActivity) ?? null;
  } catch (err) {
    console.warn(
      '[activity] record threw:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

// ---------------------------------------------------------------
// Message hooks (called from send + webhook paths)
// ---------------------------------------------------------------

export interface MessageHookInput {
  accountId: string;
  contactId: string;
  conversationId: string;
  /** Our `messages.id`. */
  messageId?: string | null;
  /** Provider id (wamid / mid / telegram message id). Preferred dedupe key. */
  providerMessageId?: string | null;
  channel?: string | null;
  body?: string | null;
  status?: string | null;
  occurredAt?: string;
  userId?: string | null;
}

interface ContactContext {
  ownerId: string | null;
  name: string | null;
  platform: string | null;
  assigneeId: string | null;
}

async function loadContext(
  db: SupabaseClient,
  input: MessageHookInput,
): Promise<ContactContext> {
  const [contactRes, convRes] = await Promise.all([
    db
      .from('contacts')
      .select('user_id, name')
      .eq('id', input.contactId)
      .maybeSingle(),
    db
      .from('conversations')
      .select('platform, assigned_agent_id')
      .eq('id', input.conversationId)
      .maybeSingle(),
  ]);
  const contact = contactRes.data as
    | { user_id: string | null; name: string | null }
    | null;
  const conv = convRes.data as
    | { platform: string | null; assigned_agent_id: string | null }
    | null;
  return {
    ownerId: contact?.user_id ?? null,
    name: contact?.name ?? null,
    platform: conv?.platform ?? null,
    assigneeId: conv?.assigned_agent_id ?? null,
  };
}

const MSG_KINDS: readonly ActivityKind[] = ['message_sent', 'message_received'];

export function isMessageActivityKind(kind: string): kind is ActivityKind {
  return (MSG_KINDS as readonly string[]).includes(kind);
}

/**
 * Record a successfully-sent outbound message, update the customer's
 * Last Activity timestamp, and apply outbound follow-up rules.
 */
export async function onOutboundMessage(
  db: SupabaseClient,
  input: MessageHookInput,
): Promise<void> {
  try {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const ctx = await loadContext(db, input);
    const channel = input.channel ?? ctx.platform ?? 'whatsapp';

    await recordActivity(db, {
      accountId: input.accountId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      userId: input.userId ?? null,
      kind: 'message_sent',
      direction: 'outbound',
      channel,
      title: `Message sent via ${channelLabel(channel)}`,
      body: input.body ?? null,
      status: input.status ?? 'sent',
      externalId: input.providerMessageId
        ? `msg:${input.providerMessageId}`
        : input.messageId
          ? `msg:${input.messageId}`
          : null,
      occurredAt,
    });

    // "Last activity" for an outbound send — feeds recency scoring and
    // the customer directory's Last Activity column.
    await db
      .from('contacts')
      .update({ last_contacted_at: occurredAt, updated_at: occurredAt })
      .eq('id', input.contactId);

    const created = await applyOutboundRules(db, {
      accountId: input.accountId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      occurredAt,
      contactName: ctx.name,
      contactOwnerId: ctx.ownerId,
      conversationAssigneeId: ctx.assigneeId,
    });

    for (const fu of created) {
      await recordActivity(db, {
        accountId: input.accountId,
        contactId: input.contactId,
        conversationId: input.conversationId,
        kind: 'follow_up_created',
        title: fu.title,
        body: fu.description ?? null,
        status: fu.priority,
        userId: fu.user_id,
        externalId: `followup:${fu.id}:created`,
        occurredAt,
        metadata: { followUpId: fu.id, source: fu.source, dueDate: fu.due_date },
      });
    }
  } catch (err) {
    console.warn(
      '[activity] onOutboundMessage failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

/**
 * Record an inbound customer message and cancel pending rule follow-ups
 * (the customer replied, so they are no longer "waiting").
 */
export async function onInboundMessage(
  db: SupabaseClient,
  input: MessageHookInput,
): Promise<void> {
  try {
    const occurredAt = input.occurredAt ?? new Date().toISOString();
    const ctx = await loadContext(db, input);
    const channel = input.channel ?? ctx.platform ?? 'whatsapp';

    await recordActivity(db, {
      accountId: input.accountId,
      contactId: input.contactId,
      conversationId: input.conversationId,
      messageId: input.messageId ?? null,
      kind: 'message_received',
      direction: 'inbound',
      channel,
      title: `Message received via ${channelLabel(channel)}`,
      body: input.body ?? null,
      status: input.status ?? 'delivered',
      externalId: input.providerMessageId
        ? `msg:${input.providerMessageId}`
        : input.messageId
          ? `msg:${input.messageId}`
          : null,
      occurredAt,
    });

    const cancelled = await cancelRulesOnReply(db, {
      accountId: input.accountId,
      contactId: input.contactId,
    });

    for (const fu of cancelled) {
      await recordActivity(db, {
        accountId: input.accountId,
        contactId: input.contactId,
        conversationId: input.conversationId,
        kind: 'follow_up_cancelled',
        title: `Follow-up cancelled — customer replied`,
        body: fu.title,
        userId: fu.user_id,
        externalId: `followup:${fu.id}:cancelled`,
        occurredAt,
        metadata: { followUpId: fu.id },
      });
    }
  } catch (err) {
    console.warn(
      '[activity] onInboundMessage failed:',
      err instanceof Error ? err.message : err,
    );
  }
}
