# WhatsApp Embedded Signup / WhatsApp Business App Coexistence

The CRM supports connecting WhatsApp numbers in two additive ways:

1. **Manual Cloud API** (`connection_method = 'manual'`) — the original flow:
   paste a System User access token, phone number ID, WABA ID, verify token,
   and PIN. This remains fully supported and untouched.
2. **Meta Embedded Signup (v4)** (`connection_method = 'embedded_signup'`) —
   a Meta-hosted popup (Facebook JS SDK) that lets you connect a number
   managed by a WhatsApp Business App. When Meta confirms the number is live
   on **both** the WhatsApp Business App and the Cloud API, the connection is
   flagged `coexistence_status = 'active'`.

> **Safety rule:** the Embedded Signup flow is strictly additive. It creates a
> new `whatsapp_config` row; it never modifies, resets, or deletes an existing
> manual connection. Coexistence is only ever reported when Meta's own fields
> confirm it (`is_on_biz_app = true` AND `platform_type = CLOUD_API`).

## Why coexistence?

Meta supports running the same WhatsApp number on a WhatsApp Business App
(used by the Facebook/Instagram commerce surfaces and the WhatsApp app itself)
*and* on the Cloud API at the same time. The CRM listens on the Cloud API side
while the number stays fully managed by your WhatsApp Business App.

## Prerequisites (Meta side)

Before this flow works you must have, in Meta for Developers:

- A Meta app with the **WhatsApp** product added (Cloud API).
- **Facebook Login for Business** configured using the
  **"WhatsApp Embedded Signup Configuration With 60 Expiration Token"**
  template — this creates a **Facebook Login for Business configuration**
  (the `config_id`).
- The app's **client OAuth settings** with:
  - *Web OAuth Login* enabled,
  - *Embedded Browser OAuth Login* enabled,
  - *Client OAuth Login* enabled,
  - *Strict Mode for redirect URIs* enabled,
  - *Login with the JavaScript SDK* enabled,
  - your app's domain under **Allowed Domains for JavaScript SDK**,
  - your domain + OAuth redirect URIs under **Valid OAuth Redirect URIs**.
- The app enabled out of Developer Mode (a verified, live app).

This project uses **Embedded Signup v4** (the current flow). The deprecated v2
endpoint is **not** used and will stop working on October 15, 2026.

## Environment variables

Add to the deployment (server-side only — do **not** commit secrets):

```
META_APP_ID=your-numeric-meta-app-id
META_EMBEDDED_SIGNUP_CONFIG_ID=your-facebook-login-for-business-config-id
META_APP_SECRET=your-app-secret   # already required for webhook signatures
```

`META_APP_ID` and `META_EMBEDDED_SIGNUP_CONFIG_ID` are public by nature (the
Facebook JS SDK exposes the app id to every browser that loads it); the code
reads them server-side and hands them to the SDK only for the popup. The
**app secret** stays server-only and is used for the OAuth code exchange.

See `.env.local.example` for documented placeholders.

## How the flow works

1. In **Settings → WhatsApp**, the *Connect WhatsApp Business App* card calls
   `GET /api/whatsapp/embedded/status`, which reports whether the flow is
   configured (it never returns secrets).
2. The **Connect with Meta** button launches the Facebook Embedded Signup
   popup using `react-whatsapp-embedded-signup`, which calls
   `FB.login` with the coexistence extras:
   `featureType: 'whatsapp_business_app_onboarding'`.
3. Meta posts back a one-time OAuth **code** plus session info
   (`waba_id`, `phone_number_id`, `business_id`).
4. The client sends the code to the server:
   `POST /api/whatsapp/embedded/connect`.
5. Server-side (`src/lib/whatsapp/embedded-signup.ts`):
   - exchanges the code → 60-day long-lived token (`META_APP_SECRET`),
   - verifies the token (`/me`), the WABA, and the phone number,
   - confirms coexistence from Meta's own fields (with a short retry loop
     because propagation is async),
   - encrypts the token (AES-256-GCM, `ENCRYPTION_KEY`) and inserts a **new**
     `whatsapp_config` row with `connection_method = 'embedded_signup'`.
6. The UI shows the result, including the coexistence status.

## Schema

Migration `060_whatsapp_embedded_signup.sql` adds **only new nullable
columns** to `whatsapp_config`:

- `connection_method` (`'manual'` default | `'embedded_signup'`)
- `onboarding_source` (`'cloud_api'` | `'whatsapp_business_app'`)
- `embedded_signup_status`, `coexistence_status`
- `meta_business_id`, `access_token_expires_at`, `token_type`
- `is_on_biz_app`, `platform_type`, `coexistence_confirmed_at`

No existing column or row is altered. Existing connections keep working
unchanged.

## About the wrapper patch

The launcher uses the community package `react-whatsapp-embedded-signup`. Its
2.0.0 build hardcodes `extras.featureType: ""` in the `FB.login` call, which
would prevent the WhatsApp Business App coexistence prompt. A postinstall
script (`scripts/patch-whatsapp-embedded-signup.mjs`, wired to `postinstall`
in `package.json`) rewrites that one expression so `featureType` is read from
the package's `extras` option. The UI passes
`extras: { featureType: 'whatsapp_business_app_onboarding' }`.

If the pattern changes in a future package release, the script warns loudly at
install time (it never breaks the build silently) — update the patch to match.

## What is NOT done automatically

- The CRM does **not** call `/register` for an Embedded Signup number.
  The number is already managed by your WhatsApp Business App; calling
  `/register` would try to move inbound routing to this app and could
  interfere with the Business App. Inbound is received through the existing
  webhook (`/api/whatsapp/webhook`).
- The CRM does **not** delete or unsubscribe anything. To stop using a
  coexisting number, remove it with the CRM's existing disconnect flow.