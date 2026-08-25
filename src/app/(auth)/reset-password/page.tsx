"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck, AlertCircle, CheckCircle } from "lucide-react";

/**
 * /reset-password — final step of the password recovery flow.
 *
 * The visitor arrives here from /auth/callback after Supabase's
 * single-use PKCE code was exchanged server-side for a recovery
 * session. This page never sees tokens; it only checks that a valid
 * session exists and then updates the password through
 * supabase.auth.updateUser(). Roles, account membership, and
 * permissions are untouched — this changes the auth password only.
 *
 * Password rules mirror the signup page exactly (match check, 6-char
 * minimum) so no security expectation is weakened or divergent.
 */
export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // 'checking' → brief getSession round-trip; 'ready' → recovery
  // session present, form usable; 'invalid' → no session (bad or
  // already-consumed link).
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">(
    "checking",
  );

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data }) => {
      setStatus(data.user ? "ready" : "invalid");
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Reset done — end the recovery session so "Back to Login"
      // actually lands on the sign-in form instead of being bounced
      // to the dashboard by the middleware's logged-in redirect.
      await supabase.auth.signOut();
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl text-foreground">
              Password reset successfully
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Your password has been reset successfully. You can now sign in
              with your new password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button className="h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90">
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <ShieldCheck className="h-6 w-6 animate-pulse text-primary" />
            <p className="text-sm text-muted-foreground">
              Verifying your reset link…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="items-center text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
              <AlertCircle className="h-6 w-6 text-red-400" />
            </div>
            <CardTitle className="text-xl text-foreground">
              Invalid reset link
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              This password reset link is invalid or has already been used.
              Please request a new one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/forgot-password">
              <Button
                variant="outline"
                className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Request new link
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">
            Set a new password
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Choose a strong new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="newPassword" className="text-muted-foreground">
                New Password
              </Label>
              <PasswordInput
                id="newPassword"
                placeholder="Enter your new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="confirmPassword" className="text-muted-foreground">
                Confirm New Password
              </Label>
              <PasswordInput
                id="confirmPassword"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Resetting…" : "Reset Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
