"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

export default function SuperAdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      // ── Step 1: Authenticate ──────────────────────────────────────
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        console.error("[SUPER ADMIN] Authentication failed:", authError.message);
        setError(authError.message);
        return;
      }

      if (!authData.user) {
        setError("Sign in succeeded but no user was returned.");
        return;
      }

      console.log("[SUPER ADMIN] Authenticated user ID:", authData.user.id);
      console.log("[SUPER ADMIN] Authenticated email:", authData.user.email);

      // ── Step 2: Fetch profile — query ALL role-related columns ────
      // We select both `platform_role` (the proper column from migration 045)
      // and the legacy `role` column, so we can diagnose exactly what
      // the database returns and distinguish between:
      //   a) platform_role column doesn't exist (migration 045 not applied)
      //   b) platform_role exists but is 'user' (default, never set to super_admin)
      //   c) legacy role column has the value instead
      console.log("[SUPER ADMIN] Profile query started");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("platform_role, role, email")
        .eq("user_id", authData.user.id)
        .maybeSingle();

      console.log("[SUPER ADMIN] Profile query completed");
      console.log("[SUPER ADMIN] Profile result:", profile);
      console.log("[SUPER ADMIN] Profile error:", profileError?.message ?? "none");
      console.log("[SUPER ADMIN] platform_role value:", profile?.platform_role);
      console.log("[SUPER ADMIN] legacy role value:", (profile as Record<string, unknown>)?.role);

      if (profileError) {
        await supabase.auth.signOut();
        // Distinguish column-missing errors from other failures
        const msg = profileError.message;
        if (msg.includes("platform_role") && msg.includes("column")) {
          setError(
            "The 'platform_role' column does not exist in the profiles table. " +
              "Please run database migration 045 to add the platform_role column.",
          );
        } else {
          setError(`Failed to verify admin access: ${msg}`);
        }
        return;
      }

      if (!profile) {
        await supabase.auth.signOut();
        setError(
          "No profile found for this user. " +
            "Every authenticated user must have a profile row in the profiles table.",
        );
        return;
      }

      // ── Step 3: Check the Super Admin role ────────────────────────
      // Prefer platform_role (the proper column). Fall back to legacy role column
      // if platform_role is undefined (column doesn't exist in DB).
      const platformRole = profile.platform_role as string | undefined;
      const legacyRole = (profile as Record<string, unknown>)?.role as string | undefined;

      console.log("[SUPER ADMIN] Detected platform_role:", platformRole ?? "COLUMN MISSING");
      console.log("[SUPER ADMIN] Detected legacy role:", legacyRole ?? "COLUMN MISSING");
      console.log("[SUPER ADMIN] Expected Super Admin role: super_admin");

      if (platformRole === "super_admin" || legacyRole === "super_admin") {
        // Role matches — proceed to dashboard
        console.log("[SUPER ADMIN] Role check PASSED, redirecting to /super-admin");
        window.location.href = "/super-admin";
        return;
      }

      // Role does not match — show a detailed diagnostic error
      await supabase.auth.signOut();

      if (platformRole === undefined) {
        setError(
          "Super Admin account authenticated successfully, but the 'platform_role' column " +
            "does not exist in the profiles table. Please run database migration 045.",
        );
      } else {
        setError(
          `Super Admin account authenticated successfully, but no Super Admin role is ` +
            `assigned to this account. Current role: "${platformRole}". ` +
            `To grant Super Admin access, run in your database:\n\n` +
            `UPDATE profiles SET platform_role = 'super_admin' WHERE user_id = '${authData.user.id}';`,
        );
      }
    } catch (err) {
      console.error("[SUPER ADMIN LOGIN]", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Super Admin Access
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Sign in with your Super Admin credentials.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="password" className="text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In as Super Admin"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              &larr; Back to Customer Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
