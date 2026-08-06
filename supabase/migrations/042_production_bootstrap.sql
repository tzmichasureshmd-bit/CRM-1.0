-- ============================================================
-- 042_production_bootstrap.sql
--
-- Production database is missing the entire schema. This migration
-- creates the essential tables that should have been created by
-- migration 001 but were never applied to the production database.
--
-- Run this in the production Supabase SQL Editor.
-- ============================================================

-- PROFILES (required by AuthProvider and every RLS policy)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ACCOUNTS (required by resolveAccountId and account sharing)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_one_per_owner ON accounts(owner_user_id);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_select ON accounts;
DROP POLICY IF EXISTS accounts_update ON accounts;
CREATE POLICY accounts_select ON accounts FOR SELECT USING (true);
CREATE POLICY accounts_update ON accounts FOR UPDATE USING (true);

-- WHATSAPP_CONFIG (required by /api/whatsapp/config)
CREATE TABLE IF NOT EXISTS whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT,
  access_token TEXT NOT NULL,
  verify_token TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own config" ON whatsapp_config;
CREATE POLICY whatsapp_config_select ON whatsapp_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY whatsapp_config_insert ON whatsapp_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY whatsapp_config_update ON whatsapp_config FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY whatsapp_config_delete ON whatsapp_config FOR DELETE USING (auth.uid() = user_id);

-- CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own contacts" ON contacts;
CREATE POLICY contacts_select ON contacts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY contacts_insert ON contacts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY contacts_update ON contacts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY contacts_delete ON contacts FOR DELETE USING (auth.uid() = user_id);

-- TAGS
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own tags" ON tags;
CREATE POLICY tags_select ON tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tags_insert ON tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tags_update ON tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY tags_delete ON tags FOR DELETE USING (auth.uid() = user_id);

-- CONTACT_TAGS
CREATE TABLE IF NOT EXISTS contact_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact ON contact_tags(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_tags_tag ON contact_tags(tag_id);
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage contact tags" ON contact_tags;
CREATE POLICY contact_tags_select ON contact_tags FOR SELECT USING (
  EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid())
);
CREATE POLICY contact_tags_modify ON contact_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_tags.contact_id AND contacts.user_id = auth.uid())
);

-- CUSTOM_FIELDS
CREATE TABLE IF NOT EXISTS custom_fields (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  field_options JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own custom fields" ON custom_fields;
CREATE POLICY custom_fields_select ON custom_fields FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY custom_fields_insert ON custom_fields FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY custom_fields_update ON custom_fields FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY custom_fields_delete ON custom_fields FOR DELETE USING (auth.uid() = user_id);

-- CONTACT_CUSTOM_VALUES
CREATE TABLE IF NOT EXISTS contact_custom_values (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  custom_field_id UUID NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, custom_field_id)
);
ALTER TABLE contact_custom_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage custom values" ON contact_custom_values;
CREATE POLICY contact_custom_values_select ON contact_custom_values FOR SELECT USING (
  EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid())
);
CREATE POLICY contact_custom_values_modify ON contact_custom_values FOR ALL USING (
  EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM contacts WHERE contacts.id = contact_custom_values.contact_id AND contacts.user_id = auth.uid())
);

-- CONTACT_NOTES
CREATE TABLE IF NOT EXISTS contact_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE contact_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own notes" ON contact_notes;
CREATE POLICY contact_notes_select ON contact_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY contact_notes_insert ON contact_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY contact_notes_update ON contact_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY contact_notes_delete ON contact_notes FOR DELETE USING (auth.uid() = user_id);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'closed')),
  assigned_agent_id UUID,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_contact_id ON conversations(contact_id);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own conversations" ON conversations;
CREATE POLICY conversations_select ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY conversations_insert ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY conversations_update ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY conversations_delete ON conversations FOR DELETE USING (auth.uid() = user_id);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'agent', 'bot')),
  sender_id UUID,
  content_type TEXT NOT NULL DEFAULT 'text' CHECK (content_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'template')),
  content_text TEXT,
  media_url TEXT,
  template_name TEXT,
  message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sending', 'sent', 'delivered', 'read', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_message_id ON messages(message_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON messages;
CREATE POLICY messages_select ON messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
);
CREATE POLICY messages_modify ON messages FOR ALL USING (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid())
);

-- MESSAGE_TEMPLATES
CREATE TABLE IF NOT EXISTS message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Marketing' CHECK (category IN ('Marketing', 'Utility', 'Authentication')),
  language TEXT DEFAULT 'en_US',
  header_type TEXT CHECK (header_type IN ('text', 'image', 'video', 'document')),
  header_content TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB,
  status TEXT DEFAULT 'Draft' CHECK (status IN ('Draft', 'Pending', 'Approved', 'Rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own templates" ON message_templates;
CREATE POLICY message_templates_select ON message_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY message_templates_insert ON message_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY message_templates_update ON message_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY message_templates_delete ON message_templates FOR DELETE USING (auth.uid() = user_id);

-- PIPELINES
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own pipelines" ON pipelines;
CREATE POLICY pipelines_select ON pipelines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY pipelines_insert ON pipelines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY pipelines_update ON pipelines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY pipelines_delete ON pipelines FOR DELETE USING (auth.uid() = user_id);

-- PIPELINE_STAGES
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline ON pipeline_stages(pipeline_id);
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage pipeline stages" ON pipeline_stages;
CREATE POLICY pipeline_stages_select ON pipeline_stages FOR SELECT USING (
  EXISTS (SELECT 1 FROM pipelines WHERE pipelines.id = pipeline_stages.pipeline_id AND pipelines.user_id = auth.uid())
);
CREATE POLICY pipeline_stages_modify ON pipeline_stages FOR ALL USING (
  EXISTS (SELECT 1 FROM pipelines WHERE pipelines.id = pipeline_stages.pipeline_id AND pipelines.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM pipelines WHERE pipelines.id = pipeline_stages.pipeline_id AND pipelines.user_id = auth.uid())
);

-- DEALS
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
  contact_id UUID NOT NULL REFERENCES contacts(id),
  conversation_id UUID REFERENCES conversations(id),
  title TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  expected_close_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON deals(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage_id);
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own deals" ON deals;
CREATE POLICY deals_select ON deals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY deals_insert ON deals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY deals_update ON deals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY deals_delete ON deals FOR DELETE USING (auth.uid() = user_id);

-- BROADCASTS
CREATE TABLE IF NOT EXISTS broadcasts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'en_US',
  template_variables JSONB,
  audience_filter JSONB,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed')),
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  replied_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own broadcasts" ON broadcasts;
CREATE POLICY broadcasts_select ON broadcasts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY broadcasts_insert ON broadcasts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY broadcasts_update ON broadcasts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY broadcasts_delete ON broadcasts FOR DELETE USING (auth.uid() = user_id);

-- BROADCAST_RECIPIENTS
CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  broadcast_id UUID NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'replied', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients(broadcast_id);
ALTER TABLE broadcast_recipients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage broadcast recipients" ON broadcast_recipients;
CREATE POLICY broadcast_recipients_select ON broadcast_recipients FOR SELECT USING (
  EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.user_id = auth.uid())
);
CREATE POLICY broadcast_recipients_modify ON broadcast_recipients FOR ALL USING (
  EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM broadcasts WHERE broadcasts.id = broadcast_recipients.broadcast_id AND broadcasts.user_id = auth.uid())
);

-- AUTOMATIONS
CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own automations" ON automations;
CREATE POLICY automations_select ON automations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY automations_insert ON automations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY automations_update ON automations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY automations_delete ON automations FOR DELETE USING (auth.uid() = user_id);

-- AUTOMATION_STEPS
CREATE TABLE IF NOT EXISTS automation_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_config JSONB,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage steps of own automations" ON automation_steps;
CREATE POLICY automation_steps_select ON automation_steps FOR SELECT USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_steps.automation_id AND automations.user_id = auth.uid())
);
CREATE POLICY automation_steps_modify ON automation_steps FOR ALL USING (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_steps.automation_id AND automations.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM automations WHERE automations.id = automation_steps.automation_id AND automations.user_id = auth.uid())
);

-- AUTOMATION_LOGS
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own automation logs" ON automation_logs;
CREATE POLICY automation_logs_select ON automation_logs FOR SELECT USING (auth.uid() = user_id);

-- AUTOMATION_PENDING_EXECUTIONS
CREATE TABLE IF NOT EXISTS automation_pending_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  automation_id UUID NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE automation_pending_executions ENABLE ROW LEVEL SECURITY;

-- FLOWS
CREATE TABLE IF NOT EXISTS flows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE flows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own flows" ON flows;
CREATE POLICY flows_select ON flows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY flows_insert ON flows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY flows_update ON flows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY flows_delete ON flows FOR DELETE USING (auth.uid() = user_id);

-- FLOW_NODES
CREATE TABLE IF NOT EXISTS flow_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  node_type TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  position_x INTEGER NOT NULL DEFAULT 0,
  position_y INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE flow_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage nodes on their flows" ON flow_nodes;
CREATE POLICY flow_nodes_select ON flow_nodes FOR SELECT USING (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_nodes.flow_id AND flows.user_id = auth.uid())
);
CREATE POLICY flow_nodes_modify ON flow_nodes FOR ALL USING (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_nodes.flow_id AND flows.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_nodes.flow_id AND flows.user_id = auth.uid())
);

-- FLOW_RUNS
CREATE TABLE IF NOT EXISTS flow_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed')),
  context JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_flow_runs_flow ON flow_runs(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_runs_contact ON flow_runs(contact_id);
ALTER TABLE flow_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see own flow runs" ON flow_runs;
CREATE POLICY flow_runs_select ON flow_runs FOR SELECT USING (
  EXISTS (SELECT 1 FROM flows WHERE flows.id = flow_runs.flow_id AND flows.user_id = auth.uid())
);

-- FLOW_RUN_EVENTS
CREATE TABLE IF NOT EXISTS flow_run_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  flow_run_id UUID NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE flow_run_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see events on their runs" ON flow_run_events;
CREATE POLICY flow_run_events_select ON flow_run_events FOR SELECT USING (
  EXISTS (SELECT 1 FROM flow_runs WHERE flow_runs.id = flow_run_events.flow_run_id AND flows.id = flow_runs.flow_id AND flows.user_id = auth.uid())
);

-- MESSAGE_REACTIONS
CREATE TABLE IF NOT EXISTS message_reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users insert reactions on their conversations" ON message_reactions;
DROP POLICY IF EXISTS "Users delete their own agent reactions" ON message_reactions;
DROP POLICY IF EXISTS "Users update their own agent reactions" ON message_reactions;
CREATE POLICY message_reactions_select ON message_reactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND c.user_id = auth.uid()
  )
);
CREATE POLICY message_reactions_modify ON message_reactions FOR ALL USING (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND c.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = message_reactions.message_id
      AND c.user_id = auth.uid()
  )
);

-- ACCOUNT_INVITATIONS
CREATE TABLE IF NOT EXISTS account_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role <> 'owner'),
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_account_invitations_account_pending ON account_invitations(account_id, expires_at) WHERE accepted_at IS NULL;
ALTER TABLE account_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS accounts_select ON accounts;
DROP POLICY IF EXISTS accounts_update ON accounts;
CREATE POLICY accounts_select ON accounts FOR SELECT USING (true);
CREATE POLICY accounts_update ON accounts FOR UPDATE USING (true);
DROP POLICY IF EXISTS account_invitations_select ON account_invitations;
DROP POLICY IF EXISTS account_invitations_modify ON account_invitations;
CREATE POLICY account_invitations_select ON account_invitations FOR SELECT USING (true);
CREATE POLICY account_invitations_modify ON account_invitations FOR ALL USING (true);

-- PROFILE EXTENSION FOR ACCOUNT SHARING
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_role TEXT;
CREATE INDEX IF NOT EXISTS idx_profiles_account_role ON profiles(account_id, account_role);

-- UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON profiles;
DROP TRIGGER IF EXISTS set_updated_at ON contacts;
DROP TRIGGER IF EXISTS set_updated_at ON conversations;
DROP TRIGGER IF EXISTS set_updated_at ON whatsapp_config;
DROP TRIGGER IF EXISTS set_updated_at ON message_templates;
DROP TRIGGER IF EXISTS set_updated_at ON deals;
DROP TRIGGER IF EXISTS set_updated_at ON broadcasts;
DROP TRIGGER IF EXISTS set_updated_at ON accounts;
DROP TRIGGER IF EXISTS set_updated_at ON automations;
DROP TRIGGER IF EXISTS set_updated_at ON flows;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON message_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON broadcasts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON automations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON flows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- SIGNUP TRIGGER (basic version — creates profile on user signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
