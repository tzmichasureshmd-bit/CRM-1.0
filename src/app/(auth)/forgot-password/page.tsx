"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { MessageSquare, CheckCircle, ArrowLeft, MailQuestion } from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login and /signup.
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageInner />
    </Suspense>
  );
}

// Simple, strict-enough format check — full deliverability is
// Supabase's problem, this just catches obvious typos client-side.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPasswordPageInner() {
  const searchParams = useSearchParams();
  // /auth/callback bounces here when a reset link's single-use code
  // was already consumed or expired — explain that instead of showing
  // a generic failure.
  const staleLink = searchParams.get("error") === "invalid_reset_link";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate before touching the network.
    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      // Supabase sends the secure, single-use reset link. The link
      // lands on /auth/callback which exchanges its code server-side
      // and forwards to /reset-password — no tokens ever touch this
      // page.
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setError(error.message);
        return;
      }

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
            <CardTitle className="text-xl text-foreground">Check your email</CardTitle>
            <CardDescription className="text-muted-foreground">
              If an account exists for this email address, you will receive
              password reset instructions shortly. Please check your inbox and
              spam folder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login">
              <Button
                variant="outline"
                className="w-full border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Back to sign in
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
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">Reset password</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email and we&apos;ll send you a secure reset link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staleLink && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
              <MailQuestion className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                That reset link is invalid or has already been used. Request a
                new one below.
              </span>
            </div>
          )}

          <form onSubmit={handleReset} className="flex flex-col gap-4" noValidate>
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-muted-foreground">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
