"use server";

import { createClient } from "@/lib/supabase/server";
import { isPlatformRole } from "@/lib/auth/roles";
import { isAuthorizedSuperAdmin } from "@/lib/auth/super-admin-emails";

/**
 * Server action: verify the current session belongs to an authorized
 * super admin (platform_role = 'super_admin' AND email in SUPER_ADMIN_EMAILS).
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

    if (!profile) {
      console.warn("[SUPER ADMIN] verifySuperAdmin: no profile found for user_id:", user.id);
      return { authorized: false, reason: "No profile found for this user." };
    }

    console.log("[SUPER ADMIN] verifySuperAdmin: profile found, platform_role:", profile.platform_role, "email:", profile.email);

    if (
      !isPlatformRole(profile?.platform_role) ||
      profile?.platform_role !== "super_admin"
    ) {
      console.warn("[SUPER ADMIN] verifySuperAdmin: user does not have super_admin role, got:", profile?.platform_role);
      return { authorized: false, reason: "You do not have Super Admin access." };
    }

    if (!profile?.email || !isAuthorizedSuperAdmin(profile.email)) {
      console.warn("[SUPER ADMIN] verifySuperAdmin: email not in SUPER_ADMIN_EMAILS:", profile?.email);
      return { authorized: false, reason: "This email is not authorized for Super Admin access." };
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
