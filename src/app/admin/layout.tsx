import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { isPlatformRole } from "@/lib/auth/roles";
import { isAuthorizedSuperAdmin } from "@/lib/auth/super-admin-emails";
import { AdminShell } from "@/components/admin/admin-shell";

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
 * 1. Unauthenticated → redirect to /login
 * 2. platform_role !== "super_admin" → redirect to /dashboard
 * 3. Email not in SUPER_ADMIN_EMAILS → redirect to /dashboard
 * 4. All checks pass → render the admin shell with sidebar
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("platform_role, email")
    .eq("user_id", user.id)
    .maybeSingle();

  const platformRole = profile?.platform_role;

  if (!isPlatformRole(platformRole) || platformRole !== "super_admin") {
    redirect("/dashboard");
  }

  if (!profile?.email || !isAuthorizedSuperAdmin(profile.email)) {
    redirect("/dashboard");
  }

  return <AdminShell>{children}</AdminShell>;
}
