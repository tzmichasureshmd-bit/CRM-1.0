// ============================================================
// Configurable follow-up rules engine (CRM "Smart Follow-up").
//
// The engine turns REAL customer activity into reminders/tasks. It
// never sends a customer message — a rule only ever creates a
// `follow_ups` row (a task shown in the Follow-up Center). This is a
// deliberate safety boundary: automated customer messaging must go
// through an explicitly configured workflow/automation, not this
// engine.
//
// Design:
//   * Rules are per-account and DISABLED by default. Nothing is
//     scheduled until an admin opts in.
//   * When an outbound message is sent, each enabled rule creates AT
//     MOST ONE pending follow-up per contact (enforced by the partial
//     unique index `idx_follow_ups_rule_pending`).
//   * When the customer replies, pending rule follow-ups for that
//     contact are cancelled — the customer is no longer "waiting".
//   * Due dates are timezone-aware and can be constrained to business
//     hours.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FollowUp, FollowUpPriority, FollowUpRule } from '@/types';

export const FOLLOW_UP_PRIORITIES: readonly FollowUpPriority[] = [
  'low',
  'normal',
  'high',
  'urgent',
];

export const DEFAULT_FOLLOW_UP_RULE = {
  name: 'No reply after 24h',
  trigger: 'no_reply' as const,
  delay_minutes: 1440,
  priority: 'normal' as const,
  business_hours_only: false,
  business_start_hour: 9,
  business_end_hour: 18,
  business_days: [1, 2, 3, 4, 5],
  timezone: 'UTC',
  assign_to: 'owner' as const,
  enabled: false,
};

type BusinessHourRule = Pick<
  FollowUpRule,
  | 'business_hours_only'
  | 'business_start_hour'
  | 'business_end_hour'
  | 'business_days'
  | 'timezone'
>;

// ---------------------------------------------------------------
// Timezone helpers (no external dependency)
// ---------------------------------------------------------------

/** Minutes east of UTC for `date` in `timeZone` (e.g. +120 for CEST). */
function tzOffsetMinutes(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second),
  );
  return (asUTC - date.getTime()) / 60000;
}

/** Convert a wall-clock time in `timeZone` to the corresponding UTC date. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let offset = tzOffsetMinutes(new Date(guess), timeZone);
  let result = guess - offset * 60000;
  // Refine once to absorb a DST transition between guess and result.
  offset = tzOffsetMinutes(new Date(result), timeZone);
  result = guess - offset * 60000;
  return new Date(result);
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) map[part.type] = part.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    weekday: weekdayMap[map.weekday] ?? 0,
  };
}

/**
 * If a rule is business-hours-only, push `date` forward to the next
 * instant that falls inside the configured working window. Returns the
 * original date unchanged when the rule doesn't restrict hours.
 */
export function shiftToBusinessHours(date: Date, rule: BusinessHourRule): Date {
  if (!rule.business_hours_only) return date;
  const tz = rule.timezone || 'UTC';
  const startHour = rule.business_start_hour;
  const endHour = rule.business_end_hour;
  const days = new Set(
    rule.business_days && rule.business_days.length > 0
      ? rule.business_days
      : [1, 2, 3, 4, 5],
  );

  let cursor = date;
  for (let i = 0; i < 14; i++) {
    const p = zonedParts(cursor, tz);
    const allowed = days.has(p.weekday);
    if (allowed && p.hour >= startHour && p.hour < endHour) return cursor;
    if (allowed && p.hour < startHour) {
      return zonedTimeToUtc(p.year, p.month, p.day, startHour, 0, tz);
    }
    // Move to the next calendar day at the window start (use noon as a
    // DST-safe pivot so the date arithmetic never lands on a gap).
    const noon = zonedTimeToUtc(p.year, p.month, p.day, 12, 0, tz);
    const nextDay = new Date(noon.getTime() + 24 * 60 * 60 * 1000);
    const np = zonedParts(nextDay, tz);
    cursor = zonedTimeToUtc(np.year, np.month, np.day, startHour, 0, tz);
  }
  return cursor;
}

/** The task's due time for a rule applied at `occurredAt`. */
export function computeDueDate(occurredAt: string, rule: BusinessHourRule & {
  delay_minutes: number;
}): Date {
  const base = new Date(occurredAt);
  const target = new Date(base.getTime() + rule.delay_minutes * 60000);
  return shiftToBusinessHours(target, rule);
}

// ---------------------------------------------------------------
// Rule application
// ---------------------------------------------------------------

export interface OutboundRuleContext {
  accountId: string;
  contactId: string;
  conversationId: string;
  occurredAt: string;
  contactName?: string | null;
  /** `contacts.user_id` — the default assignee. */
  contactOwnerId: string | null;
  /** `conversations.assigned_agent_id` — used when assign_to says so. */
  conversationAssigneeId: string | null;
}

export function ruleTaskTitle(
  rule: Pick<FollowUpRule, 'trigger' | 'delay_minutes'>,
  contactName?: string | null,
): string {
  const who = contactName?.trim() || 'customer';
  if (rule.trigger === 'no_reply') {
    const mins = rule.delay_minutes;
    const human =
      mins % 1440 === 0
        ? `${mins / 1440} day${mins / 1440 === 1 ? '' : 's'}`
        : mins % 60 === 0
          ? `${mins / 60} hour${mins / 60 === 1 ? '' : 's'}`
          : `${mins} minutes`;
    return `Follow up with ${who} if no reply within ${human}`;
  }
  return `Follow up with ${who}`;
}

function resolveAssignee(
  rule: Pick<FollowUpRule, 'assign_to'>,
  ctx: OutboundRuleContext,
): string | null {
  if (rule.assign_to === 'unassigned') return ctx.contactOwnerId;
  if (rule.assign_to === 'conversation_assignee') {
    return ctx.conversationAssigneeId || ctx.contactOwnerId;
  }
  return ctx.contactOwnerId;
}

/**
 * Apply every enabled outbound rule to one contact interaction.
 * Returns the follow-ups that were actually created (so the caller can
 * log activity for them). Never throws — callers treat it as
 * best-effort and log failures.
 */
export async function applyOutboundRules(
  db: SupabaseClient,
  ctx: OutboundRuleContext,
): Promise<FollowUp[]> {
  const { data: rules, error } = await db
    .from('follow_up_rules')
    .select('*')
    .eq('account_id', ctx.accountId)
    .eq('enabled', true)
    .in('trigger', ['no_reply', 'after_outbound']);

  if (error || !rules || rules.length === 0) return [];

  const created: FollowUp[] = [];

  for (const rule of rules as FollowUpRule[]) {
    if (!ctx.contactOwnerId) continue;

    // Dedupe: one pending follow-up per (contact, rule).
    const { data: existing } = await db
      .from('follow_ups')
      .select('id')
      .eq('contact_id', ctx.contactId)
      .eq('rule_id', rule.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    const due = computeDueDate(ctx.occurredAt, rule);
    const assignee = resolveAssignee(rule, ctx);
    if (!assignee) continue;

    const { data: inserted, error: insertError } = await db
      .from('follow_ups')
      .insert({
        contact_id: ctx.contactId,
        account_id: ctx.accountId,
        user_id: assignee,
        assigned_to: assignee,
        title: ruleTaskTitle(rule, ctx.contactName),
        description: `Automatically created by rule "${rule.name}".`,
        due_date: due.toISOString(),
        reminder_at: due.toISOString(),
        priority: rule.priority,
        reason: rule.trigger,
        source: 'rule',
        rule_id: rule.id,
      })
      .select('*')
      .single();

    if (insertError) {
      // 23505 = a concurrent send already created the pending task.
      if (insertError.code !== '23505') {
        console.warn('[follow-up-rules] insert failed:', insertError.message);
      }
      continue;
    }
    if (inserted) created.push(inserted as FollowUp);
  }

  return created;
}

/**
 * Cancel every pending rule-generated follow-up for a contact when the
 * customer replies. Returns the rows that were cancelled.
 */
export async function cancelRulesOnReply(
  db: SupabaseClient,
  opts: { accountId: string; contactId: string },
): Promise<FollowUp[]> {
  const { data, error } = await db
    .from('follow_ups')
    .update({ status: 'cancelled' })
    .eq('account_id', opts.accountId)
    .eq('contact_id', opts.contactId)
    .eq('source', 'rule')
    .eq('status', 'pending')
    .select('*');

  if (error) {
    console.warn('[follow-up-rules] cancel-on-reply failed:', error.message);
    return [];
  }
  return (data ?? []) as FollowUp[];
}
