"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, User } from "lucide-react";
import {
  LoginBrand,
  LoginCard,
  LoginEmailInput,
  LoginError,
  LoginField,
  LoginFooter,
  LoginHeading,
  LoginPasswordInput,
  LoginSecondary,
  LoginShell,
  LoginSubmit,
} from "@/components/auth/login-shell";

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary — same pattern as /login.
export default function SignupPage() {
  return (
    // The premium chrome (CRM4 image pane, glass frame) is served in
    // the static HTML outside the Suspense boundary so the visual
    // paints immediately, while the form hydrates on the client.
    <LoginShell>
      <Suspense fallback={null}>
        <SignupPageInner />
      </Suspense>
    </LoginShell>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → email
  // verification → redirect round-trip. `emailRedirectTo` below
  // points back at /join/<token> so the user lands on the redeem
  // step after verifying instead of being dropped on /dashboard.
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    // If we have an invite token, point Supabase's verification
    // email back at the join page so the user can accept after
    // verifying. Without a token, Supabase uses its default
    // redirect (the app root).
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  const loginHref = inviteToken
    ? `/login?invite=${encodeURIComponent(inviteToken)}`
    : "/login";

  if (success) {
    return (
      <>
        <LoginCard>
        <LoginBrand />

        <LoginHeading title="Check your email">
          We&apos;ve sent a confirmation link to{" "}
          <span className="text-white">{email}</span>. Please check your
          inbox and click the link to verify your account.
        </LoginHeading>

        <div className="mt-2 flex justify-center">
          <div className="login-brand-mark">
            <CheckCircle className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>

        <LoginSecondary href={loginHref}>Back to sign in</LoginSecondary>
        </LoginCard>

        <LoginFooter>
          &copy; {new Date().getFullYear()} TZmicha IT Solutions &middot;
          WhatsApp CRM
        </LoginFooter>
      </>
    );
  }

  return (
    <>
      <LoginCard>
        <LoginBrand />

        <LoginHeading
          title={inviteToken ? "Create account & join" : "Create account"}
        >
          {inviteToken
            ? "Verify your email, then accept the invitation to join your team."
            : "Get started with WhatsApp CRM TZmicha"}
        </LoginHeading>

        <form onSubmit={handleSignup} className="mt-2 flex flex-col">
          <LoginError>{error}</LoginError>

          <LoginField label="Full name" htmlFor="fullName">
            <div className="login-field">
              <User className="login-input-icon" aria-hidden="true" />
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                spellCheck={false}
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="login-input login-input--icon"
              />
            </div>
          </LoginField>

          <LoginField label="Email" htmlFor="email">
            <LoginEmailInput
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </LoginField>

          <LoginField label="Password" htmlFor="password">
            <LoginPasswordInput
              id="password"
              placeholder="At least 6 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              showLabel="Show password"
              hideLabel="Hide password"
            />
          </LoginField>

          <LoginField label="Confirm password" htmlFor="confirmPassword">
            <LoginPasswordInput
              id="confirmPassword"
              placeholder="Repeat your password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              showLabel="Show password"
              hideLabel="Hide password"
            />
          </LoginField>

          <LoginSubmit loading={loading} loadingText="Creating account...">
            Create account
          </LoginSubmit>
        </form>

        <p className="login-muted mt-6 text-center">
          Already have an account?{" "}
          <Link href={loginHref} className="login-link-accent">
            Sign in
          </Link>
        </p>
      </LoginCard>

      <LoginFooter>
        &copy; {new Date().getFullYear()} TZmicha IT Solutions &middot; WhatsApp
        CRM
      </LoginFooter>
    </>
  );
}