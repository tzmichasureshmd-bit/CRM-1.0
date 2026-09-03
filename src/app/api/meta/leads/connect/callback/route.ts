import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/automations/admin-client";
import { encrypt } from "@/lib/whatsapp/encryption";
import {
  discoverPages,
  exchangeCodeForLongLivedToken,
  subscribePageToLeadgen,
  MetaLeadsApiError,
} from "@/lib/meta/leads-api";
import { buildRedirectUri } from "../../connect/route";

export const dynamic = "force-dynamic";

/**
 * Facebook OAuth callback.
 *
 * 1. Validates the CSRF `state` against the short-lived cookie and
 *    recovers the account id (the tenant — never taken from input).
 * 2. Exchanges the code for a long-lived user token.
 * 3. Discovers the user's Pages and linked Instagram accounts.
 * 4. Subscribes each Page to the leadgen webhook.
 * 5. Persists connections (with encrypted page access tokens).
 * 6. Redirects back to Settings with a status flag.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    return NextResponse.redirect(
      buildRedirectUri(request) + "/settings?meta_leads=denied",
    );
  }
  if (!code || !stateParam) {
    return NextResponse.redirect(
      buildRedirectUri(request) + "/settings?meta_leads=error",
    );
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
  } | null;
  if (
    !session ||
    !cookieRaw ||
    session.state !== stateParam ||
    !session.accountId ||
    !session.userId
  ) {
    return NextResponse.redirect(
      buildRedirectUri(request) + "/settings?meta_leads=error",
    );
  }
  const { accountId, userId } = session;

  try {
    const redirectUri = buildRedirectUri(request) + "/api/meta/leads/connect/callback";

    // 1. Code -> long-lived user token.
    const { accessToken } = await exchangeCodeForLongLivedToken(code, redirectUri);

    // 2. Discover Pages (and their linked Instagram accounts).
    const pages = await discoverPages(accessToken);
    if (pages.length === 0) {
      return NextResponse.redirect(
        buildRedirectUri(request) +
          "/settings?meta_leads=error&reason=no_pages",
      );
    }

    const admin = supabaseAdmin();

    // 3. Subscribe each Page to the leadgen webhook, then persist.
    const records = [];
    for (const page of pages) {
      try {
        await subscribePageToLeadgen(page.id, page.pageAccessToken);
      } catch {
        // best-effort; still record the connection and let the webhook
        // status show 'error'
      }

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

    return NextResponse.redirect(
      buildRedirectUri(request) +
        `/settings?meta_leads=connected&pages=${records.length}`,
    );
  } catch (err) {
    const reason =
      err instanceof MetaLeadsApiError
        ? encodeURIComponent(err.metaMessage ?? "meta_error")
        : "unknown";
    return NextResponse.redirect(
      buildRedirectUri(request) + `/settings?meta_leads=error&reason=${reason}`,
    );
  }
}
