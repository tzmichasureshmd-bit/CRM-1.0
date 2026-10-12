-- ============================================================
-- Migration 078: Customer activity log + configurable follow-up rules
--
-- Adds the persistence layer behind the CRM "Smart Follow-up" workspace:
--
--   1. `customer_activities` — an append-only, account-scoped event log
--      of everything that happens to a customer (messages in/out, notes,
--      follow-up lifecycle, status changes). The message rows remain the
--      source of truth for message content; this table is a lightweight,
--      unified timeline that is safe to write from webhooks (idempotent
--      via a unique (account_id, external_id) constraint).
--
--   2. `follow_up_rules` — per-account, opt-in rules that turn real
--      activity into reminders/tasks. Rules are DISABLED by default: the
--      CRM never schedules a follow-up until an admin enables a rule.
--      A rule only ever creates a `follow_ups` row (a task); it never
--      sends a customer message.
--
--   3. Extra columns on `follow_ups` for priority, reason, provenance
--      (manual vs rule) and assignment, plus a partial unique index so a
--      given rule can only ever have ONE pending follow-up per contact.
--
-- Additive and idempotent — safe to run multiple times.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. customer_activities
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_activities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  message_id      UUID REFERENCES messages(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL CHECK (kind IN (
                    'message_sent', 'message_received', 'note',
                    'follow_up_created', 'follow_up_completed',
                    'follow_up_rescheduled', 'follow_up_cancelled',
                    'status_changed', 'deal_updated', 'system'
                  )),
  direction       TEXT CHECK (direction IN ('inbound', 'outbound')),
  channel         TEXT,
  title           TEXT,
  body            TEXT,
  status          TEXT,
  external_id     TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency: a webhook retry (same provider message id) or a repeated
-- app event (same follow-up completion) maps to the same external_id and
-- is ignored instead of duplicated. NULL external_ids stay distinct.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_activities_external
  ON customer_activities(account_id, external_id);

CREATE INDEX IF NOT EXISTS idx_customer_activities_account_time
  ON customer_activities(account_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activities_contact_time
  ON customer_activities(contact_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_activities_kind
  ON customer_activities(account_id, kind);

ALTER TABLE customer_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_activities_select" ON customer_activities;
CREATE POLICY "customer_activities_select" ON customer_activities FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "customer_activities_insert" ON customer_activities;
CREATE POLICY "customer_activities_insert" ON customer_activities FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

-- ------------------------------------------------------------
-- 2. follow_up_rules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follow_up_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  trigger             TEXT NOT NULL DEFAULT 'no_reply'
                        CHECK (trigger IN ('no_reply', 'after_outbound')),
  delay_minutes       INTEGER NOT NULL DEFAULT 1440 CHECK (delay_minutes >= 5),
  priority            TEXT NOT NULL DEFAULT 'normal'
                        CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  business_hours_only BOOLEAN NOT NULL DEFAULT FALSE,
  business_start_hour INTEGER NOT NULL DEFAULT 9 CHECK (business_start_hour BETWEEN 0 AND 23),
  business_end_hour   INTEGER NOT NULL DEFAULT 18 CHECK (business_end_hour BETWEEN 1 AND 24),
  business_days       INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  timezone            TEXT NOT NULL DEFAULT 'UTC',
  assign_to           TEXT NOT NULL DEFAULT 'owner'
                        CHECK (assign_to IN ('owner', 'conversation_assignee', 'unassigned')),
  enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  created_by          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT follow_up_rules_hours_valid CHECK (business_end_hour > business_start_hour)
);

CREATE INDEX IF NOT EXISTS idx_follow_up_rules_account ON follow_up_rules(account_id);

ALTER TABLE follow_up_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "follow_up_rules_select" ON follow_up_rules;
CREATE POLICY "follow_up_rules_select" ON follow_up_rules FOR SELECT
  USING (is_account_member(account_id));

DROP POLICY IF EXISTS "follow_up_rules_insert" ON follow_up_rules;
CREATE POLICY "follow_up_rules_insert" ON follow_up_rules FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "follow_up_rules_update" ON follow_up_rules;
CREATE POLICY "follow_up_rules_update" ON follow_up_rules FOR UPDATE
  USING (is_account_member(account_id, 'admin'));

DROP POLICY IF EXISTS "follow_up_rules_delete" ON follow_up_rules;
CREATE POLICY "follow_up_rules_delete" ON follow_up_rules FOR DELETE
  USING (is_account_member(account_id, 'admin'));

DROP TRIGGER IF EXISTS set_updated_at ON follow_up_rules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON follow_up_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- 3. follow_ups — priority / reason / provenance / assignment
-- ------------------------------------------------------------
ALTER TABLE follow_ups
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'rule', 'automation')),
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES follow_up_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_follow_ups_priority ON follow_ups(account_id, priority);
CREATE INDEX IF NOT EXISTS idx_follow_ups_assigned ON follow_ups(assigned_to);

-- One pending follow-up per (contact, rule): the engine's dedupe key.
CREATE UNIQUE INDEX IF NOT EXISTS idx_follow_ups_rule_pending
  ON follow_ups(contact_id, rule_id)
  WHERE status = 'pending' AND rule_id IS NOT NULL;

-- ------------------------------------------------------------
-- 4. Contacts recency columns (idempotent safety net)
--
-- The overview RPC and the activity hooks read/ write these. They are
-- added by earlier migrations (059 = last_contacted_at, 068 =
-- last_customer_reply_at), but this migration must not assume they ran;
-- re-adding with IF NOT EXISTS keeps 078 self-contained.
-- ------------------------------------------------------------
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_customer_reply_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_last_contacted_at
  ON contacts(account_id, last_contacted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_last_customer_reply_at
  ON contacts(account_id, last_customer_reply_at DESC)
  WHERE last_customer_reply_at IS NOT NULL;

-- ------------------------------------------------------------
-- 5. Realtime for the activity feed (dashboard live refresh)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'customer_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE customer_activities;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. Overview counters (single round trip for the CRM dashboard)
--
-- SECURITY INVOKER: the caller's RLS applies, and we additionally
-- scope every subquery to p_account_id. All values are real counts
-- over live rows — nothing is fabricated.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION crm_overview(p_account_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_customers', (
      SELECT count(*) FROM contacts
      WHERE account_id = p_account_id
    ),
    'active_customers', (
      SELECT count(*) FROM contacts
      WHERE account_id = p_account_id
        AND (
          last_customer_reply_at > now() - interval '30 days'
          OR last_contacted_at > now() - interval '30 days'
        )
    ),
    'new_this_week', (
      SELECT count(*) FROM contacts
      WHERE account_id = p_account_id
        AND created_at >= now() - interval '7 days'
    ),
    'follow_ups_due_today', (
      SELECT count(*) FROM follow_ups
      WHERE account_id = p_account_id
        AND status = 'pending'
        AND due_date IS NOT NULL
        AND due_date::date = now()::date
    ),
    'follow_ups_overdue', (
      SELECT count(*) FROM follow_ups
      WHERE account_id = p_account_id
        AND status = 'pending'
        AND due_date IS NOT NULL
        AND due_date < now()
    ),
    'waiting_for_reply', (
      SELECT count(*) FROM contacts
      WHERE account_id = p_account_id
        AND last_contacted_at IS NOT NULL
        AND (last_customer_reply_at IS NULL
             OR last_contacted_at > last_customer_reply_at)
    ),
    'recent_interactions', (
      SELECT count(*) FROM customer_activities
      WHERE account_id = p_account_id
        AND occurred_at >= now() - interval '24 hours'
    )
  );
$$;

COMMIT;
