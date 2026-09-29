import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { OrgAdminShell } from "@/components/admin/org-admin-shell";
import { OrgAdminDenied } from "@/components/admin/org-admin-denied";

export const metadata: Metadata = {
  title: "Organisation Admin",
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → go to login
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_role, platform_role, full_name, email")
    .eq("user_id", user.id)
    .maybeSingle();

  // Super admin → show clear message (they use /super-admin, not /admin)
  if (profile?.platform_role === "super_admin") {
    return (
      <OrgAdminDenied
        reason="super_admin"
        email={profile.email ?? user.email}
      />
    );
  }

  // Only owner or admin can access org admin panel
  if (profile?.account_role !== "owner" && profile?.account_role !== "admin") {
    return (
      <OrgAdminDenied
        reason="insufficient_role"
        currentRole={profile?.account_role ?? "unknown"}
        email={profile?.email ?? user.email}
      />
    );
  }

  return <OrgAdminShell>{children}</OrgAdminShell>;
}
