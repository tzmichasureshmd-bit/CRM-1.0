import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminShell } from "@/components/admin/admin-shell";
import { UnauthorizedAccess } from "@/components/admin/unauthorized-access";

export const metadata: Metadata = {
  title: "Super Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

/**
 * Server-side authorization gate for the Super Admin dashboard.
 *
 * On every navigation into /super-admin/* (except /super-admin/login
 * which is handled below), this layout verifies:
 *   1. The user has an authenticated session.
 *   2. The user's profile has platform_role = "super_admin".
 *
 * If the user is unauthenticated, they are redirected to /super-admin/login.
 * If the user is authenticated but NOT a super_admin, they see an
 * authorization error page (not a redirect to login).
 */
export default async function SuperAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users visiting /super-admin/* get the login page
  // without the admin shell chrome.
  if (!user) {
    return <>{children}</>;
  }

  // Select both platform_role (proper column) and legacy role (fallback)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("platform_role, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[SUPER ADMIN LAYOUT] Profile query error:", profileError.message);
    redirect("/super-admin/login");
  }

  const platformRole = profile?.platform_role as string | undefined;
  const legacyRole = (profile as Record<string, unknown> | null)?.role as string | undefined;

  if (platformRole !== "super_admin" && legacyRole !== "super_admin") {
    // Authenticated but NOT authorized — show error page, don't redirect to login
    return <UnauthorizedAccess />;
  }

  return (
    <AdminShell basePath="/super-admin" logoutRedirect="/super-admin/login" showBackToCrm={false}>
      {children}
    </AdminShell>
  );
}
