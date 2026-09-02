# Production Deployment — WhatsApp / Meta

This document is the operator checklist for shipping the WhatsApp CRM to a
Dockerized production host (this repo deploys via `docker-compose.yml` on a
Hostinger VPS behind Traefik). It exists because the bundled code (Embedded
Signup, webhook, two-way send) is only reachable in production when the right
environment variables reach the running container.

> If production shows the old page / hides "Connect to Meta", **it is almost
> always a missing runtime env var in the container**, not a code problem.

## The one-liner

The `docker-compose.yml` service passes these variables from the host `.env`
into the container at **runtime**. The build also needs the `NEXT_PUBLIC_*`
ones at **build time**. Set all of the following in the **same `.env` file you
already have next to `docker-compose.yml` on the VPS**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ENCRYPTION_KEY=

# ---- Meta / WhatsApp ----
META_APP_ID=
META_APP_SECRET=
META_EMBEDDED_SIGNUP_CONFIG_ID=
META_VERIFY_TOKEN=
NEXT_PUBLIC_SITE_URL=https://crm.tzmicha.com
NEXT_PUBLIC_META_EMBEDDED_SIGNUP_REDIRECT_URI=https://crm.tzmicha.com/settings

# ---- Admin / other ----
SUPER_ADMIN_EMAILS=
NEXT_PUBLIC_APP_LOCALE=en
AUTOMATION_CRON_SECRET=
```

## Why each variable matters

| Variable | Required | Effect if missing |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | App will not start |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | App will not start |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Webhook / send / cron (bypasses RLS) break |
| `ENCRYPTION_KEY` | yes | Tokens can't be decrypted |
| `META_APP_ID` | **yes** | `/api/whatsapp/embedded/status` returns `configured:false` and the UI hides the connection, or template submission with image headers fails |
| `META_APP_SECRET` | **yes** | Webhook rejects every POST (401); signature verification fails |
| `META_EMBEDDED_SIGNUP_CONFIG_ID` | **yes** | Embedded Signup popup can't launch |
| `META_VERIFY_TOKEN` | recommended | Meta dashboard webhook verification may fail before a config row exists |
| `NEXT_PUBLIC_SITE_URL` | recommended | Sitemap/robots + invite links wrong; set to the real production URL (never `localhost`) |
| `NEXT_PUBLIC_META_EMBEDDED_SIGNUP_REDIRECT_URI` | recommended | Embedded Signup OAuth redirect defaults to current page origin (register it verbatim in Meta) |
| `SUPER_ADMIN_EMAILS` | recommended | `/admin` login gating |
| `NEXT_PUBLIC_APP_LOCALE` | no | Defaults to `en` |
| `AI_*` | no | Skip if not using the AI assistant |
| `AUTOMATION_CRON_SECRET` | if used | Wait steps in automations won't drain |

### Security rules

- `META_APP_SECRET`, `META_APP_ID`, `ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
  and `META_VERIFY_TOKEN` are **server-only**. They must never be exposed via a
  `NEXT_PUBLIC_*` name (that inlines them into the browser bundle).
- `META_APP_ID` and `META_EMBEDDED_SIGNUP_CONFIG_ID` are public by nature and
  may be passed to the client (the Facebook JS SDK needs the app id anyway).
- Never commit the `.env` (`.env*` is gitignored).

## Redeploy flow (after editing `.env` or code)

The GitHub Action `.github/workflows/ci.yml` runs on push to `main`: lint →
typecheck → test → build, then SSH to the VPS and `docker compose build
--no-cache && docker compose up -d`. It reads the host `.env`. To force a
redeploy when only env changed, restart:

```bash
cd /path/to/project
docker compose down tzmicha-crm
docker compose build --no-cache tzmicha-crm
docker compose up -d tzmicha-crm
```

Then invalidate any CDN/edge cache for `/_next/static/*` (the Docker build
produces fresh chunk hashes; the edge must stop serving old HTML). The
`Cache-Control` policy in `next.config.ts` self-heals within ~5 minutes.

## Verify the deployed build actually has the feature

Do not trust the deploy finished. Check from the production host:

```bash
# Confirm the running image was rebuilt from the latest main
docker ps --filter name=tzmicha-crm --format "{{.Image}} {{.Status}}"

# Confirm env reached the container
docker exec tzmicha-crm printenv META_APP_ID META_EMBEDDED_SIGNUP_CONFIG_ID \
  META_APP_SECRET NEXT_PUBLIC_SITE_URL
```

Then, from the public internet, verify the endpoints the phone path depends on:

```bash
# Embedded Signup is configured (returns the app id, never a secret)
curl -i https://crm.tzmicha.com/api/whatsapp/embedded/status

# Webhook GET verification challenge is reachable (403 is fine = token check,
# the point is it's NOT a 404/502 from a missing route or stale build)
curl -i "https://crm.tzmicha.com/api/whatsapp/webhook?hub.mode=subscribe&hub.challenge=123&hub.verify_token=wrong"
```

A 404 / 502 / stale-page result means the deployment is serving an old build —
rebuild and re-deploy.

## End-to-end acceptance test (do this on the deployed site)

1. **Settings → WhatsApp** → confirm **Connect with Meta** is visible and the
   status API reports the Embedded Signup config is present (no "not
   configured" warning).
2. Click **Connect with Meta** → complete the Meta popup with the **existing**
   WhatsApp Business number → the CRM saves the connection and shows
   `connected`.
3. From another WhatsApp account, send `Hello CRM Test` → it appears in the
   correct account's Inbox as inbound.
4. Reply `Hello from CRM` → the customer receives it (outbound via Meta Cloud
   API, server-side).
5. Statuses (`sent` → `delivered` → `read`) update in the UI.
6. Log out / log in / refresh / restart the container → the connection and
   message history remain.

## Database migrations on production Supabase

Apply every migration in `supabase/migrations/` to the production Supabase
project (Supabase runs these as "SQL migrations" in the dashboard or via the
Supabase CLI). In particular `052`–`060` add the `whatsapp_config` columns and
RLS policies that the WhatsApp UI, webhook, and send paths read. Local
migrations do **not** auto-apply to production.