import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { encrypt } from "@/lib/whatsapp/encryption";
import {
  discoverPages,
  exchangeCodeForLongLivedToken,
  subscribePageToLeadgen,
  subscribePageToMessaging,
  MetaLeadsApiError,
} from "@/lib/meta/leads-api";
import { buildRedirectUri, normalizeReturnTo } from "../../connect/route";

export const dynamic = "force-dynamic";

/**
 * Operation names whose failures map onto a user-presentable message in the
 * UI. Anything else collapses to the generic `meta_error` code.
 */
const SAFE_REASON_KEYS = new Set([
  "no_pages",
  "denied",
  "exchange_code",
  "discover_pages",
  "subscribe_page",
]);

/**
 * Map a technical error to a safe reason code the UI can translate into a
 * friendly message. `metaMessage` / `code` are logged server-side and never
 * shown to the user.
 */
function reasonForError(err: unknown): string {
  if (!(err instanceof MetaLeadsApiError)) return "meta_error";
  console.error(
    `[meta/callback] ${err.operation} failed: code=${err.code ?? "n/a"} ` +
      `type=${err.type ?? "n/a"} message=${err.metaMessage ?? err.message}`,
  );
  return err.operation && SAFE_REASON_KEYS.has(err.operation)
    ? err.operation
    : "meta_error";
}

function safeRedirect(
  base: string,
  returnTo: string,
  status: "connected" | "denied" | "error" | "error_no_pages",
  params: Record<string, string> = {},
): NextResponse {
  const query = new URLSearchParams({ meta_leads: status });
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  return NextResponse.redirect(`${base}${returnTo}?${query.toString()}`);
}

/**
 * Facebook OAuth callback.
 *
 * 1. Validates the CSRF `state` against the short-lived cookie and
 *    recovers the account id (the tenant — never taken from input).
 * 2. Exchanges the code for a long-lived user token.
 * 3. Discovers the user's Pages and linked Instagram accounts.
 * 4. Subscribes each Page to the leadgen webhook.
 * 5. Persists connections (with encrypted page access tokens).
 * 6. Redirects back to the originating page with a status flag.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  const base = buildRedirectUri(request);

  if (errorParam) {
    // `access_denied` (or the user back-buttoning / the app not being in
    // review) is the common case — treat any Meta `error` as "denied".
    return safeRedirect(base, "/settings", "denied");
  }
  if (!code || !stateParam) {
    return safeRedirect(base, "/settings", "error");
  }

  // CSRF: validate state against the cookie, and recover the trusted
  // account + user ids captured from the authenticated session.
  const cookieStore = await cookies();
  const cookieRaw = cookieStore.get("meta_oauth_state")?.value;
  let parsed: unknown = null;
  try {
    parsed = cookieRaw ? JSON.parse(cookieRaw) : null;
  } catch {
    parsed = null;
  }
  const session = parsed as {
    state?: string;
    accountId?: string;
    userId?: string;
    returnTo?: string;
  } | null;
  if (
    !session ||
    !cookieRaw ||
    session.state !== stateParam ||
    !session.accountId ||
    !session.userId
  ) {
    return safeRedirect(base, "/settings", "error");
  }
  const { accountId, userId } = session;
  const returnTo = normalizeReturnTo(session.returnTo);

  try {
    const redirectUri =
      base + "/api/meta/leads/connect/callback";

    // 1. Code -> long-lived user token.
    const { accessToken } = await exchangeCodeForLongLivedToken(code, redirectUri);

    // 2. Discover Pages (and their linked Instagram accounts).
    const pages = await discoverPages(accessToken);
    if (pages.length === 0) {
      console.warn(
        `[meta/callback] account ${accountId}: OAuth succeeded but no Pages ` +
          "were found (user may not be an admin of any Page).",
      );
      return safeRedirect(base, returnTo, "error_no_pages");
    }

    const admin = supabaseAdmin();

    // 3. Subscribe each Page to the leadgen + messages webhooks, then
    //    persist. `messages` bring Messenger/IG DMs into the unified
    //    inbox; it's best-effort (a Page without messaging permission
    //    still connects for lead ads).
    const records = [];
    for (const page of pages) {
      try {
        await subscribePageToLeadgen(page.id, page.pageAccessToken);
      } catch {
        // best-effort; still record the connection and let the webhook
        // status show 'error'
      }
      await subscribePageToMessaging(page.id, page.pageAccessToken);

      const encryptedToken = encrypt(page.pageAccessToken);

      // Facebook connection.
      const fbRow = {
        account_id: accountId,
        user_id: userId,
        page_id: page.id,
        page_name: page.name,
        access_token: encryptedToken,
        status: "active",
        webhook_status: "active",
        platform: "facebook",
        connected_at: new Date().toISOString(),
      };
      const { data: fbInserted, error: fbErr } = await admin
        .from("meta_page_connections")
        .upsert(fbRow, { onConflict: "account_id,page_id,platform" })
        .select()
        .single();
      if (fbErr) {
        console.error(`[meta/connect] upsert fb ${page.id}:`, fbErr.message);
        continue;
      }
      records.push(fbInserted);

      // Instagram connection (when the Page has a linked Professional
      // account).
      if (page.instagram?.id) {
        const igRow = {
          account_id: accountId,
          user_id: userId,
          page_id: page.id,
          page_name: page.name,
          access_token: encryptedToken,
          status: "active",
          webhook_status: "active",
          platform: "instagram",
          instagram_account_id: page.instagram.id,
          instagram_username: page.instagram.username ?? null,
          connected_at: new Date().toISOString(),
        };
        const { error: igErr } = await admin
          .from("meta_page_connections")
          .upsert(igRow, { onConflict: "account_id,page_id,platform" });
        if (igErr) {
          console.error(`[meta/connect] upsert ig ${page.id}:`, igErr.message);
        }
      }
    }

    return safeRedirect(base, returnTo, "connected", {
      pages: String(records.length),
    });
  } catch (err) {
    return safeRedirect(base, returnTo, "error", {
      reason: reasonForError(err),
    });
  }
}
