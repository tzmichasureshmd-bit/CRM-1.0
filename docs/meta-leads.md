# Meta Lead Ads (Facebook + Instagram) → CRM contacts

This document explains how to configure the **Facebook & Instagram Lead Ads**
integration (Settings → Meta Leads). When enabled, every new lead form
submission on your connected Pages (and their linked Instagram Professional
accounts) is turned into an ordinary CRM contact — with its source, Page,
campaign, ad set, ad and form recorded on the contact, plus a configurable
source tag and an in-app notification.

## How it works

1. An admin clicks **Connect Facebook Account** in Settings → Meta Leads.
2. The user is redirected to Facebook Login (server-side redirect OAuth).
   On approval, Meta redirects back to
   `/api/meta/leads/connect/callback` with an authorization `code`.
3. The server exchanges the code for a long-lived access token, discovers
   the user's Pages (and the Instagram Professional account linked to each
   Page), subscribes each Page to the `leadgen` webhook and stores the
   Page access token (AES-256-GCM encrypted) in `meta_page_connections`.
4. Meta delivers new leads to `/api/meta/leads/webhook` (HMAC-SHA256
   verified). The server resolves the tenant from the stored connection
   (never from the request), fetches the lead details, and creates or
   updates a contact through the same dedupe/idempotency helpers the rest
   of the CRM uses.

Leads are **not** a separate system: they live in the existing `contacts`
table with source-attribution columns. Replayed webhooks never create
duplicates or inflate the lead count (see `meta_lead_events` + the unique
`(account_id, meta_lead_id)` index).

## Prerequisites

1. A **Meta for Developers** app (production / non-development mode). In
   development mode only app admins, developers and testers can connect.
3. The app must have the **Lead Ads** product added.

## Environment variables

Set these on the host (see `.env.local.example` and `docker-compose.yml`):

| Variable | Purpose |
|---|---|
| `META_APP_ID` | App ID (App Settings → Basic) |
| `META_APP_SECRET` | App Secret; also verifies webhook HMAC signatures |
| `NEXT_PUBLIC_SITE_URL` | Canonical origin used to build OAuth + webhook URLs |
| `META_VERIFY_TOKEN` | Instance-level fallback verify token (optional) |

## Meta for Developers configuration

Under ** your app → App review → Lead Ads → Webhooks**, configure a
Webhooks product for the `page` object with:

| Field | Value |
|---|---|
| Callback URL | `<NEXT_PUBLIC_SITE_URL>/api/meta/leads/webhook` |
| Verify token | `META_VERIFY_TOKEN` (any long random string) |

Under **App settings → Advanced / Login settings**, add
`<NEXT_PUBLIC_SITE_URL>/api/meta/leads/connect/callback` to **Valid OAuth
Redirect URIs**.

Request the following **permissions** (App review → Permissions and
Features): `pages_show_list`, `pages_manage_metadata`, `leads_retrieval`,
`ads_management`.

## Testing end-to-end

1. From Meta for Developers → your app → Lead Ads → open the lead form's
   test harness, or use **Lead Ads Testing** to simulate a submission for a
   Page you've connected in the CRM.
2. Confirm a new contact appears in Contacts with a `Facebook`/`Instagram`
   source badge, its source attribution in the detail panel, the source tag,
   and a notification in the bell.
3. Submit the same test lead again — confirm the contact count / lead stats
   do **not** increase (idempotency).

## Troubleshooting

- **`META_APP_ID / META_APP_SECRET are not configured`** — the app env vars
  are missing or not passed to the server process.
- **“error=access_denied”** — the user declined the connection, or the app
  is in development mode and the user is not an admin/developer/tester.
- **Webhook never fires** — verify the callback URL + verify token were
  saved in the Meta Lead Ads webhook product config, and that the Page is
  actually subscribed (the Settings UI shows “Webhook active/pending”).
- **`reason=no_pages`** — the user isn't an admin of any Facebook Page, or
  the `pages_show_list` permission was not granted.
