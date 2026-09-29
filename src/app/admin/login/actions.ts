"use server";

import { createClient } from "@/lib/supabase/server";
import { assertSuperAdminProfile } from "@/lib/auth/super-admin-policy";

/**
 * Server action: verify the current session belongs to an authorized
 * super admin (platform_role = 'super_admin', plus the optional
 * SUPER_ADMIN_EMAILS allowlist when that variable is configured).
 *
 * Called from the /admin/login page after signInWithPassword succeeds.
 */
export async function verifySuperAdmin(): Promise<{
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
      console.error("[SUPER ADMIN] verifySuperAdmin: getUser error:", authError.message);
      return { authorized: false, reason: `Auth error: ${authError.message}` };
    }

    if (!user) {
      console.warn("[SUPER ADMIN] verifySuperAdmin: no authenticated user");
      return { authorized: false, reason: "No authenticated user found." };
    }

    console.log("[SUPER ADMIN] verifySuperAdmin: user authenticated, id:", user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("platform_role, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[SUPER ADMIN] verifySuperAdmin: profile query error:", profileError.message);
      return { authorized: false, reason: `Profile error: ${profileError.message}` };
    }

    console.log(
      "[SUPER ADMIN] verifySuperAdmin: profile found, platform_role:",
      profile?.platform_role,
      "email:",
      profile?.email,
    );

    // Shared rule — identical to the /admin and /super-admin layout
    // gates. This action used to apply the allowlist unconditionally,
    // which meant that on any deployment without SUPER_ADMIN_EMAILS set
    // (including self-hosted ones) NO ONE could sign in to /admin even
    // with platform_role = 'super_admin'. The allowlist is now opt-in.
    const verdict = assertSuperAdminProfile(profile);

    if (!verdict.authorized) {
      console.warn(
        `[SUPER ADMIN] verifySuperAdmin: denied for ${profile?.email ?? user.id} (${verdict.code})`,
      );
      return { authorized: false, reason: verdict.reason };
    }

    console.log("[SUPER ADMIN] verifySuperAdmin: authorization successful");
    return { authorized: true };
  } catch (err) {
    console.error("[SUPER ADMIN] verifySuperAdmin: unexpected error:", err);
    return {
      authorized: false,
      reason: err instanceof Error ? err.message : "Unknown verification error.",
    };
  }
}
