"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Mail, CheckCircle, MailQuestion } from "lucide-react";

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordPageInner />
    </Suspense>
  );
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPasswordPageInner() {
  const searchParams = useSearchParams();
  const staleLink = searchParams.get("error") === "invalid_reset_link";

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) { setError("Please enter your email address."); return; }
    if (!EMAIL_PATTERN.test(email.trim())) { setError("Please enter a valid email address."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (error) { setError(error.message); return; }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* LEFT — form */}
        <div className="login-left">
          <div className="login-content">

            {success ? (
              <>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--primary, #22c55e)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle style={{ width: 24, height: 24, color: "#fff" }} />
                  </div>
                </div>
                <h1 className="login-heading-cursive">Check your email</h1>
                <p className="login-subtitle">
                  If an account exists for this email, you&apos;ll receive reset instructions shortly. Check your inbox and spam folder.
                </p>
                <Link href="/login">
                  <button className="login-button" style={{ marginTop: "1.5rem" }}>
                    Back to sign in
                  </button>
                </Link>
              </>
            ) : (
              <>
                <h1 className="login-heading-cursive">Reset password</h1>
                <p className="login-subtitle">Enter your email and we&apos;ll send you a secure reset link.</p>

                <form className="login-form" onSubmit={handleReset}>
                  {staleLink && (
                    <div className="login-error-banner" style={{ background: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.3)", color: "#f59e0b", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <MailQuestion style={{ width: 16, height: 16, marginTop: 2, flexShrink: 0 }} />
                      That reset link is invalid or has already been used. Request a new one below.
                    </div>
                  )}

                  {error && <div className="login-error-banner">{error}</div>}

                  <div className="input-wrapper">
                    <input
                      id="email"
                      type="email"
                      placeholder="Email address"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <Mail className="input-icon" style={{ width: 16, height: 16 }} />
                  </div>

                  <button type="submit" className="login-button" disabled={loading}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>

                <Link href="/login" className="login-switch" style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: "1.25rem" }}>
                  <ArrowLeft style={{ width: 14, height: 14 }} />
                  Back to sign in
                </Link>
              </>
            )}

          </div>
        </div>

        {/* RIGHT — image */}
        <div className="login-right">
          <img
            src="/images/3804820b-a1d6-4a83-923c-e509ff58a324.png"
            alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
        </div>

      </div>
    </div>
  );
}
