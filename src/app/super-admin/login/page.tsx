"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { verifySuperAdminRole } from "./actions";

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

      // ── Step 2: Verify Super Admin authorization SERVER-SIDE ─────
      // The role verdict comes from the server action — the same trust
      // level as the /super-admin layout gate — so a tampered client
      // cannot talk its way past this form.
      const result = await verifySuperAdminRole();

      if (!result.authorized) {
        // Authenticated but not authorized: end the session so the
        // visitor leaves with no half-open Supabase session, and show
        // the denial clearly. Never redirect into /super-admin here.
        await supabase.auth.signOut();
        setError(result.reason ?? "You do not have Super Admin access.");
        return;
      }

      // Full-page navigation so the freshly written auth cookies reach
      // the middleware gating /super-admin/*.
      window.location.href = "/super-admin";
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
              <PasswordInput
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
