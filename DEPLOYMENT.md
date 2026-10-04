# Production Deployment Guide — Instagram DM + Facebook Messenger

This document covers the critical environment variables and Meta configuration required for Instagram DMs and Facebook Messenger to work in production.

## 1. Environment Variables (CRITICAL)

### Required for Production

Set these in your hosting platform (Vercel, Railway, etc.) — **NOT** in `.env.local`:

```bash
# CRITICAL: Must be your production URL, not localhost
NEXT_PUBLIC_SITE_URL=https://crm.tzmicha.com

# Meta App credentials (from Meta for Developers → App Settings → Basic)
META_APP_ID=1354004176287129
META_APP_SECRET=a25ab21211db675c2a23bdceddd68332
META_VERIFY_TOKEN=tzmicha_verify_2024

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://repfwcrfxlqgxnqcshdg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Encryption key for access tokens
ENCRYPTION_KEY=054ebbd6b523cb36b6ce786aa3532ee00c27686fa5cf409948e81e5b508f24fb
```

### Why `NEXT_PUBLIC_SITE_URL` is Critical

The Meta OAuth flow constructs redirect URIs using `NEXT_PUBLIC_SITE_URL`. If this is set to `http://localhost:3001`, the OAuth callback fails because:

1. User clicks "Connect Facebook Account" in CRM Settings
2. CRM redirects to Meta with `redirect_uri=http://localhost:3001/api/meta/leads/connect/callback`
3. Meta rejects the redirect because `localhost` is not a registered domain
4. OAuth never completes → no `meta_page_connections` rows are saved
5. Webhook receives messages but finds no matching connection → drops all messages

**Solution:** Set `NEXT_PUBLIC_SITE_URL=https://crm.tzmicha.com` in production environment variables.

## 2. Meta App Dashboard Configuration

### Register Production URLs

Go to [developers.facebook.com/apps/1354004176287129](https://developers.facebook.com/apps/1354004176287129)

#### OAuth Redirect URI

**App Settings → Basic → App Domains:**
- Add: `crm.tzmicha.com`

**Facebook Login → Settings → Valid OAuth Redirect URIs:**
- Add: `https://crm.tzmicha.com/api/meta/leads/connect/callback`

#### Webhook URLs

**Products → Messenger → Settings → Webhooks:**
- Callback URL: `https://crm.tzmicha.com/api/meta/leads/webhook`
- Verify Token: `tzmicha_verify_2024`
- Subscribe to fields:
  - `messages` ✅
  - `messaging_postbacks` ✅
  - `leadgen` ✅ (for Lead Ads)

**Products → Instagram → Settings → Webhooks:**
- Callback URL: `https://crm.tzmicha.com/api/meta/leads/webhook`
- Verify Token: `tzmicha_verify_2024`
- Subscribe to field:
  - `messages` ✅

### Required Permissions

The OAuth flow requests these permissions (must be approved in App Review for production use):

**Facebook:**
- `pages_show_list` — discover user's Pages
- `pages_manage_metadata` — subscribe Pages to webhook
- `pages_messaging` — send/receive Messenger messages
- `leads_retrieval` — fetch Lead Ads submissions (optional, for Lead Ads feature)

**Instagram:**
- `instagram_basic` — read Instagram account info
- `instagram_manage_messages` — send/receive Instagram DMs

### Test Webhook Configuration

After setting callback URL and verify token, click **"Test"** next to the `messages` field in both Messenger and Instagram webhook settings. It should return HTTP 200. If it returns 401, the `META_APP_SECRET` in production doesn't match your app secret.

## 3. Verify Production Deployment

### After Deploying

1. **Check environment variables:**
   ```bash
   # In Vercel dashboard → Settings → Environment Variables
   # Verify NEXT_PUBLIC_SITE_URL=https://crm.tzmicha.com
   ```

2. **Test webhook reachability:**
   ```bash
   curl https://crm.tzmicha.com/api/meta/leads/webhook
   # Should return "Bad Request" (400) — this is correct (missing query params)
   ```

3. **Check Meta connections:**
   ```bash
   # As a logged-in agent, visit:
   https://crm.tzmicha.com/api/meta/diagnostic
   # Should return JSON with meta_page_connections for your account
   ```

4. **Reconnect Facebook/Instagram:**
   - Go to CRM → Settings → Integrations
   - Click "Connect Facebook Account"
   - Authorize both Facebook and Instagram permissions
   - Verify `meta_page_connections` now has rows with:
     - `platform='facebook'` and `page_id` set
     - `platform='instagram'` and `instagram_account_id` set (not NULL)

5. **Send test Instagram DM:**
   - From a different Instagram account, send a DM to your connected Instagram Professional account
   - Check CRM Inbox → should appear within 5 seconds
   - Reply from CRM → external Instagram account should receive it

6. **Send test Facebook Messenger message:**
   - From a different Facebook account, send a message to your connected Facebook Page
   - Check CRM Inbox → should appear within 5 seconds
   - Reply from CRM → external Facebook account should receive it

## 4. Troubleshooting

### Messages not appearing in inbox

**Check webhook logs:**
```bash
# In your hosting platform's logs, search for:
[messaging] CONNECTION_NOT_FOUND
```

If you see this error with a `recipientId`, it means:
- For Instagram: No row in `meta_page_connections` with `platform='instagram'` AND `instagram_account_id=recipientId`
- For Facebook: No row in `meta_page_connections` with `platform='facebook'` AND `page_id=recipientId`

**Solution:** Reconnect the account via Settings → Integrations, ensuring Instagram permissions are granted.

### OAuth redirect fails

**Symptom:** After clicking "Connect Facebook Account", Meta shows an error or redirects to `http://localhost:3001/...`

**Cause:** `NEXT_PUBLIC_SITE_URL` is not set to production URL in environment variables.

**Solution:** 
1. Set `NEXT_PUBLIC_SITE_URL=https://crm.tzmicha.com` in production environment
2. Rebuild and redeploy the app (Next.js bundles `NEXT_PUBLIC_*` vars at build time)
3. Register `https://crm.tzmicha.com/api/meta/leads/connect/callback` as a valid OAuth redirect URI in Meta App Dashboard

### Webhook returns 401 (Invalid signature)

**Cause:** `META_APP_SECRET` in production environment doesn't match the App Secret in Meta for Developers → App Settings → Basic.

**Solution:** Copy the exact App Secret from Meta dashboard and set it in production environment variables. Restart the app.

### Instagram DMs not appearing, but Facebook Messenger works

**Cause:** `instagram_account_id` is NULL in `meta_page_connections`.

**Check database:**
```sql
SELECT platform, page_id, instagram_account_id, instagram_username, status
FROM meta_page_connections
WHERE platform = 'instagram';
```

If `instagram_account_id` is NULL, the OAuth flow didn't have Instagram permissions.

**Solution:**
1. Disconnect the Instagram integration in CRM Settings
2. Reconnect, ensuring you approve BOTH permissions in the Meta dialog:
   - ✅ `instagram_basic`
   - ✅ `instagram_manage_messages`
3. Verify the new row has `instagram_account_id` populated

## 5. Database Verification

Run these queries in Supabase SQL Editor to verify setup:

```sql
-- Check meta_page_connections
SELECT 
  platform,
  page_id,
  page_name,
  instagram_account_id,
  instagram_username,
  status,
  webhook_status,
  created_at
FROM meta_page_connections
WHERE status = 'active'
ORDER BY created_at DESC;

-- Should see:
-- 1 row with platform='facebook', page_id set
-- 1 row with platform='instagram', instagram_account_id set (NOT NULL)

-- Check if any Instagram/Facebook conversations exist
SELECT 
  platform,
  COUNT(*) as count,
  MAX(last_message_at) as latest_message
FROM conversations
WHERE platform IN ('facebook', 'instagram')
GROUP BY platform;

-- Check if any Instagram/Facebook contacts exist
SELECT 
  COUNT(*) FILTER (WHERE messenger_psid IS NOT NULL) as facebook_contacts,
  COUNT(*) FILTER (WHERE instagram_user_id IS NOT NULL) as instagram_contacts
FROM contacts;
```

## 6. Security Checklist

- [ ] `NEXT_PUBLIC_SITE_URL` is `https://` (not `http://localhost`)
- [ ] `META_APP_SECRET` matches Meta App Dashboard exactly
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set (webhook needs it)
- [ ] `ENCRYPTION_KEY` is set (decrypt access tokens)
- [ ] Webhook URL registered in Meta uses `https://` (not localhost)
- [ ] OAuth redirect URI registered in Meta uses `https://` (not localhost)
- [ ] Row Level Security (RLS) is enabled on all tables
- [ ] Meta webhook signature validation is enabled (never disabled)

## 7. Production-Only Issues

### Issue: Works in dev, fails in production

**Common causes:**
1. Environment variables set in `.env.local` but not in production hosting platform
2. `NEXT_PUBLIC_SITE_URL` not set in production (still uses build-time localhost value)
3. Firewall blocking Meta's webhook IPs
4. Meta app in "Development Mode" (only sends events to app admins/testers)

**Solutions:**
1. Copy all required env vars from `.env.local` to production environment
2. Rebuild after changing `NEXT_PUBLIC_*` vars (they're bundled at build time)
3. Ensure production server allows inbound HTTPS from Meta IPs
4. Switch Meta app to "Live Mode" after App Review approval (or add test users in Development Mode)
