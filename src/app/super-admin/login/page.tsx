"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient, checkSupabaseConnection } from "@/lib/supabase/client";
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
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        setError(
          "Super Admin authentication is temporarily unavailable. The Supabase configuration is missing. Please contact the administrator.",
        );
        return;
      }

      const health = await checkSupabaseConnection();
      if (!health.ok) {
        if (health.reason === "paused_project") {
          setError(
            "The Supabase project is paused or unavailable. The project administrator must log in to the Supabase dashboard (supabase.com) and resume the project before login can proceed.",
          );
        } else if (health.reason === "network_error") {
          setError(
            "Unable to reach the Supabase authentication server. Please verify the NEXT_PUBLIC_SUPABASE_URL environment variable is correct and try again.",
          );
        } else {
          setError(
            "Super Admin authentication is temporarily unavailable. Please contact the administrator.",
          );
        }
        return;
      }

      const supabase = createClient();

      let authData;
      try {
        const result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        authData = result.data;
        if (result.error) {
          const msg = result.error.message;
          if (
            msg.includes("Invalid login credentials") ||
            msg.includes("invalid_grant") ||
            msg.includes(" Email not confirmed")
          ) {
            setError("Invalid email or password. Please try again.");
          } else {
            console.error("[SUPER ADMIN] signInWithPassword error:", msg);
            setError(
              "Unable to sign in. Please verify your credentials and try again.",
            );
          }
          return;
        }
      } catch (fetchErr) {
        console.error("[SUPER ADMIN] signInWithPassword threw:", fetchErr);
        const fetchMsg =
          fetchErr instanceof Error ? fetchErr.message : String(fetchErr);

        if (fetchMsg.includes("Failed to fetch") || fetchMsg.includes("NetworkError")) {
          setError(
            "Unable to connect to the authentication server. Please verify the deployment environment variables are correctly configured and try again.",
          );
        } else {
          setError(
            "Unable to sign in. Please try again.",
          );
        }
        return;
      }

      if (!authData?.user) {
        setError("Sign in succeeded but no user was returned. Please try again.");
        return;
      }

      console.log("[SUPER ADMIN] Auth successful, verifying role for user:", authData.user.id);

      const result = await verifySuperAdminRole();

      if (!result.authorized) {
        await supabase.auth.signOut();
        setError(result.reason ?? "You do not have Super Admin access.");
        return;
      }

      window.location.href = "/super-admin";
    } catch (err) {
      console.error("[SUPER ADMIN LOGIN] Unexpected error:", err);
      setError(
        "Super Admin authentication is temporarily unavailable. Please try again later.",
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
