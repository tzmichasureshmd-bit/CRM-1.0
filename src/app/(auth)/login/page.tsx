"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Mail } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    } catch (err) {
      const isMisconfigured = err instanceof Error && err.message.includes("Supabase is not configured");
      setError(isMisconfigured ? "Supabase is not configured. Please contact the administrator." : "Unable to sign in. Please try again later.");
      setLoading(false);
      return;
    }
    const destination = inviteToken ? `/join/${encodeURIComponent(inviteToken)}` : "/dashboard";
    window.location.href = destination;
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* LEFT — form */}
        <div className="login-left">
          <div className="login-content">
            <h1 className="login-heading-cursive">Welcome back</h1>
            <p className="login-subtitle">Sign in to manage your conversations, leads, contacts and business communication.</p>

            <form className="login-form" onSubmit={handleLogin}>
              {error && <div className="login-error-banner">{error}</div>}

              <div className="input-wrapper">
                <input id="email" type="email" placeholder="Email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Mail className="input-icon" style={{ width: 16, height: 16 }} />
              </div>

              <div className="input-wrapper">
                <input id="password" type={showPassword ? "text" : "password"} placeholder="Password"
                  autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>

              <div className="login-options">
                <label className="remember-me">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  Remember for 30 days
                </label>
                <Link href="/forgot-password">Forgot password?</Link>
              </div>

              <button type="submit" className="login-button" disabled={loading}>
                {loading ? t("signingIn") : "Login"}
              </button>
            </form>

            <p className="login-switch">
              Don&apos;t have an account?{" "}
              <Link href={inviteToken ? `/signup?invite=${encodeURIComponent(inviteToken)}` : "/signup"}>
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* RIGHT — image */}
        <div className="login-right">
          <img src="/images/3804820b-a1d6-4a83-923c-e509ff58a324.png" alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
        </div>

      </div>
    </div>
  );
}
