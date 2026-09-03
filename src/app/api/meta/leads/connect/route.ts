import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireRole, toErrorResponse } from "@/lib/auth/account";

export const dynamic = "force-dynamic";

const PERMISSIONS = [
  "pages_show_list",
  "pages_manage_metadata",
  "leads_retrieval",
  "ads_management",
].join(",");

/**
 * Build the Meta OAuth authorization URL for server-side redirect.
 *
 * The `state` is a random value stored in a short-lived cookie; the
 * callback validates it to prevent CSRF. The redirect URI is derived
 * from the request origin (or a NEXT_PUBLIC override) so it works in
 * local dev and production with no hardcoded host.
 */
export async function GET(request: Request) {
  try {
    const ctx = await requireRole("admin");

    const appId = process.env.META_APP_ID;
    if (!appId) {
      return NextResponse.json(
        { error: "META_APP_ID is not configured" },
        { status: 500 },
      );
    }

    const redirectUri = buildRedirectUri(request) + "/api/meta/leads/connect/callback";

    const state = crypto.randomBytes(24).toString("hex");

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: PERMISSIONS,
      state,
    });

    const url = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;

    const response = NextResponse.redirect(url);
    // Short-lived HttpOnly state cookie for CSRF protection on callback.
    // Carries the trusted account + user ids captured from the
    // authenticated session (the callback itself is an external redirect
    // with no app session).
    response.cookies.set(
      "meta_oauth_state",
      JSON.stringify({ state, accountId: ctx.accountId, userId: ctx.userId }),
      {
        httpOnly: true,
        sameSite: "lax",
        secure: request.url.startsWith("https://"),
        path: "/",
        maxAge: 600,
      },
    );
    return response;
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * Derive the site origin from the request, falling back to a
 * NEXT_PUBLIC_SITE_URL override. Never hardcodes localhost/prod.
 */
export function buildRedirectUri(request: Request): string {
  const override = process.env.NEXT_PUBLIC_SITE_URL;
  if (override) return override.replace(/\/+$/, "");
  const { protocol, host } = new URL(request.url);
  return `${protocol}//${host}`;
}
