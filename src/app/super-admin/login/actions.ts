"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Server action: verify the current session belongs to a super admin
 * (profiles.platform_role = 'super_admin', falling back to the legacy
 * role column — the exact rule the /super-admin layout gate applies).
 *
 * Called from the /super-admin/login page after signInWithPassword
 * succeeds, so the authorization decision happens server-side before
 * the browser ever redirects into the dashboard.
 */
export async function verifySuperAdminRole(): Promise<{
  authorized: boolean;
  reason?: string;
}> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[SUPER ADMIN] verifySuperAdminRole: getUser error:", authError.message);
      return { authorized: false, reason: `Auth error: ${authError.message}` };
    }

    if (!user) {
      console.warn("[SUPER ADMIN] verifySuperAdminRole: no authenticated user");
      return { authorized: false, reason: "No authenticated user found." };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("platform_role, role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[SUPER ADMIN] verifySuperAdminRole: profile query error:", profileError.message);
      return { authorized: false, reason: `Profile error: ${profileError.message}` };
    }

    if (!profile) {
      console.warn("[SUPER ADMIN] verifySuperAdminRole: no profile found for user_id:", user.id);
      return { authorized: false, reason: "No profile found for this user." };
    }

    const platformRole = profile.platform_role as string | undefined;
    const legacyRole = (profile as Record<string, unknown> | null)?.role as string | undefined;

    if (platformRole !== "super_admin" && legacyRole !== "super_admin") {
      console.warn("[SUPER ADMIN] verifySuperAdminRole: user does not have super_admin role, got:", platformRole);
      return { authorized: false, reason: "You do not have Super Admin access." };
    }

    return { authorized: true };
  } catch (err) {
    console.error("[SUPER ADMIN] verifySuperAdminRole: unexpected error:", err);
    return {
      authorized: false,
      reason: err instanceof Error ? err.message : "Unknown verification error.",
    };
  }
}
