# Google Forms + Google Sheets → CRM contacts

This document explains how to connect an **existing Google Form** to the CRM so
every submission automatically becomes an ordinary CRM contact. Google Forms /
Google Sheets are only the **delivery / staging** layer — the CRM's existing
`contacts` table remains the **single source of truth** after sync. No new
contact table, no separate "Google Leads" page, and nothing is cut out of the
existing Facebook / Instagram / WhatsApp / Website / Manual flows.

## How it works

```
Google Form → Google Sheet → Apps Script (onFormSubmit)
    → POST /api/v1/integrations/google-forms (Bearer wacrm_…, scope contacts:write)
    → Existing backend (find-or-create contact, source = Google Form, dedup)
    → Supabase contacts table
    → Contacts page  +  Social Media Google Form count
```

1. The user submits the Google Form.
2. Google Forms appends the response row to the connected **Google Sheet**.
3. An **installable form-submit trigger** runs `onFormSubmit` in Apps Script.
4. Apps Script reads the row, maps the fields, and POSTs the payload to the
   CRM webhook with `Authorization: Bearer <API key>`.
5. The CRM authenticates the key, resolves the **tenant/account from the key**
   (never from the client), and creates or updates the contact.
6. Sync status (`SUCCESS` / `FAILED`, contact id, time, error) is written back
   to integration columns at the right edge of the sheet. The original form
   response columns are never modified.

Leads are **not** a separate system: they live in the existing `contacts` table
with `source = 'google_form'`, `lead_status = 'new'`, an optional campaign, and
a `Google Form Lead` tag. Replayed webhooks and Apps Script retries never create
duplicates (see idempotency below).

## Prerequisites

- The Google Form is already connected to a Google Sheet (Form → Responses →
  Link to Sheets).
- A CRM **API key** with the `contacts:write` scope. Create one in
  **Settings → API keys → New key** and select the `contacts:write` scope.
  This key is the security credential for the integration and — because the
  key belongs to one account — is what pins each submission to the correct
  tenant. Never share it, and never put it in frontend code.

## Apps Script setup

The reference script is at `scripts/google-forms/Code.gs`. Copy its contents
into the Google Sheet's Apps Script editor (Extensions → Apps Script).

1. **Store credentials** (Script properties, not committed to source):
   - `CRM_BASE_URL` — e.g. `https://app.yourcrm.com`
   - `CRM_API_KEY` — the `contacts:write` key above
2. **Configure field mapping.** By default the script auto-maps response
   columns by header (`Name`, `Phone`/`Phone Number`, `Email`, `Company`,
   `Location`/`City`, `Message`/`Notes`, `Campaign`). If your form uses
   different labels, set explicit 1-based column numbers in the `COLUMN_MAP`
   object at the top of the script.
3. **Install the trigger.** Run `installFormTrigger` once in the editor, or
   add a trigger: **Triggers → Add Trigger → `onFormSubmit` →
   On form submit**. (Installable triggers run regardless of whether the Sheet
   is open.)
4. **Optional:** add a time-based trigger for `retryFailedSyncs` so a row
   whose sync failed while the CRM was offline is retried automatically.
5. Run `testConnection` to confirm the CRM is reachable and the key works.

## Webhook payload

The CRM endpoint accepts (only `phone` is required):

```jsonc
{
  "submission_id": "…",        // Google Forms response id — idempotency key
  "form_id": "…",
  "name": "Sai Kumar",
  "phone": "+919876543210",
  "email": "example@gmail.com",
  "company": "…",
  "location": "…",
  "message": "…",
  "campaign": "summer_campaign",
  "submitted_at": "2026-01-01T10:00:00Z",
  "utm_source": "facebook",
  "utm_medium": "paid",
  "utm_campaign": "summer_campaign"
}
```

Campaign tracking: if the form / landing page URL carries
`utm_source` / `utm_medium` / `utm_campaign` / `utm_content` / `utm_term`, pass
them along — they are stored on the contact (see the `utm_*` columns in the
migration) so the CRM can tell where a lead originated. A `campaign` value (or
fallback `utm_campaign`) also becomes a `Campaign: <name>` tag.

## Idempotency & duplicate prevention

- `google_form_submission_id` (filled from the Google Forms response id or a
  row hash) is the idempotency key — a retried submission maps back to the
  same contact and never creates a second one (partial unique index
  `(account_id, google_form_submission_id)`).
- Phone-based `findExistingContact` dedup still applies: a new submission whose
  phone already matches an existing contact updates it instead of duplicating,
  and an existing contact whose status has already progressed past `new` is
  never regressed.
- Apps Script skips rows already marked `SUCCESS` on re-runs, so retries are
  safe even if a partial failure happened mid-run.

## Contact fields created/updated

| Google Form field | CRM field |
|---|---|
| Full Name | `name` |
| Phone Number | `phone` (logged/validated as E.164) |
| Email | `email` |
| Location / City | `location` |
| Message / Notes | saved as a contact note |
| Company | `company` |
| Campaign / utm_campaign | `campaign_name` + `Campaign: …` tag |
| — | `source = 'google_form'`, `lead_status = 'new'`, tag `Google Form Lead` |

No information is invented — only submitted fields are stored; unsubmitted
optional fields stay empty.

## Where Google Form leads appear

- **Contacts** — automatically, like any other contact. Filter with the
  **Source** quick filter → **Google Form**, or deep-link
  `/contacts?source=google_form` (optionally combined with `&status=new`,
  `&created=today|this_month`).
- **Social Media → Lead Sources** — a **Google Form** card showing the real
  database count; clicking it opens `/contacts?source=google_form`. All counts
  come from the CRM database (never from Google Sheets).
- **Dashboard / Reports** — included wherever the existing lead-count logic
  already counts `contacts` by source.

## Security notes

- No `SUPABASE_SERVICE_ROLE_KEY`, Meta app secret, encryption keys or database
  credentials are ever placed in Apps Script. The only secret is the CRM API
  key (stored in Script Properties), and it is used solely as a bearer
  credential to the protected webhook.
- The webhook requires a valid API key with the `contacts:write` scope; the key
  determines the account, and every query is scoped to that account. Existing
  RLS policies are unchanged and never bypassed for user sessions.
- Do not weaken or remove the API key / scope checks on the endpoint.

## Troubleshooting

- **`CRM_BASE_URL and CRM_API_KEY are not set`** — the two Script Properties
  are missing or empty.
- **Row = `FAILED` with `unauthorized`** — the API key is wrong, revoked, or
  lacking the `contacts:write` scope. Check Settings → API keys.
- **Row = `FAILED` with `bad_request` / `'phone' is required`** — the form
  doesn't have a mapped phone column; update `COLUMN_MAP` / `FIELD_HEADER_MAP`.
- **No sync at all** — the installable trigger wasn't created, or the Sheet is
  not linked to the form. Run `installFormTrigger` and confirm a trigger exists
  under Triggers.
- **CRM temporarily offline** — the row stays in the sheet with
  `CRM Sync Status = FAILED` and `CRM Error` set; run `retryFailedSyncs` later.
