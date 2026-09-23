"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck } from "lucide-react";
import {
  LoginBrand,
  LoginCard,
  LoginDivider,
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
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    // The premium chrome (CRM4 image pane, glass frame) is served in
    // the static HTML outside the Suspense boundary so the visual
    // paints immediately, while the form itself (which needs
    // useSearchParams for the invite token) hydrates on the client.
    <LoginShell>
      <Suspense fallback={null}>
        <LoginPageInner />
      </Suspense>
    </LoginShell>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

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

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } catch (err) {
      console.error("[LOGIN] Unexpected error:", err);
      const isMisconfigured =
        err instanceof Error && err.message.includes("Supabase is not configured");
      setError(
        isMisconfigured
          ? "Login is temporarily unavailable. Supabase is not configured. Please contact the administrator."
          : "Unable to sign in. Please try again later.",
      );
      setLoading(false);
      return;
    }

    // Always land in the customer CRM. Super Admin access is a
    // deliberate, separate flow entered via the "Super Admin" button
    // (/super-admin/login) — never auto-triggered from the customer
    // login, even for users whose profile carries the super_admin
    // platform role.
    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";

    // Full-page navigation (not router.push) so the browser issues a
    // fresh top-level request that carries the just-written Supabase
    // auth cookies to the middleware gating /dashboard. A soft
    // client-side navigation can reach the protected route before the
    // server observes the new session, so the middleware bounces it
    // back to /login — which looks like the page "just refreshing"
    // instead of signing in (issue #365). Mirrors the deliberate full
    // reload the invite-accept flow already uses in join/[token].
    window.location.href = destination;
  };

  return (
    <>
      <LoginCard>
        <LoginBrand />

        <LoginHeading title={inviteToken ? t("titleAccept") : t("titleWelcome")}>
          {inviteToken
            ? t("descAccept")
            : "Sign in to manage your conversations, leads, contacts and business communication."}
        </LoginHeading>

        <form onSubmit={handleLogin} className="mt-2 flex flex-col gap-4">
          <LoginError>{error}</LoginError>

          <LoginField label={t("emailLabel")} htmlFor="email">
            <LoginEmailInput
              id="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </LoginField>

          <LoginField
            label={t("passwordLabel")}
            htmlFor="password"
            action={
              <Link href="/forgot-password" className="login-link-accent">
                {t("forgotPassword")}
              </Link>
            }
          >
            <LoginPasswordInput
              id="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              showLabel={t("showPassword")}
              hideLabel={t("hidePassword")}
            />
          </LoginField>

          <LoginSubmit loading={loading} loadingText={t("signingIn")}>
            {t("signIn")}
          </LoginSubmit>
        </form>

        <LoginDivider>{t("or")}</LoginDivider>

        <LoginSecondary
          href="/super-admin/login"
          icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />}
        >
          {t("superAdmin")}
        </LoginSecondary>

        <p className="login-muted mt-6 text-center">
          {t("noAccount")}{" "}
          <Link
            href={
              inviteToken
                ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                : "/signup"
            }
            className="login-link-accent"
          >
            {t("createAccount")}
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