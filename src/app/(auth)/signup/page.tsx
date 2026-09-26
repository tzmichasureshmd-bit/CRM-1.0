"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle, Eye, EyeOff, Mail, User } from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    setSuccess(true);
    setLoading(false);
  };

  const loginHref = inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : "/login";

  if (success) {
    return (
      <div className="login-page login-page--signup">
        <div className="login-card login-card--reversed">
          <div className="login-right">
            <img src="/images/1843ca78-a7d8-4f62-a658-2f7864fe570a.png" alt=""
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
          </div>
          <div className="login-left">
            <div className="login-content" style={{ alignItems: "center", textAlign: "center" }}>
              <CheckCircle style={{ width: 48, height: 48, color: "#22c55e", marginBottom: 16 }} />
              <h1>Check your email</h1>
              <p className="login-subtitle" style={{ marginBottom: 24 }}>
                We&apos;ve sent a confirmation link to <strong>{email}</strong>. Click the link to verify your account.
              </p>
              <Link href={loginHref} className="login-button"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none" }}>
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page login-page--signup">
      <div className="login-card login-card--reversed">

        {/* LEFT — image */}
        <div className="login-right">
          <img src="/images/1843ca78-a7d8-4f62-a658-2f7864fe570a.png" alt=""
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }} />
        </div>

        {/* RIGHT — form */}
        <div className="login-left">
          <div className="login-content">
            <p className="login-brand-sub">WhatsApp CRM</p>
            <h1>{inviteToken ? "Create account & join" : "Create account"}</h1>
            <p className="login-subtitle">
              {inviteToken ? "Verify your email, then accept the invitation." : "Get started with WhatsApp CRM TZmicha"}
            </p>

            <form className="login-form" onSubmit={handleSignup}>
              {error && <div className="login-error-banner">{error}</div>}

              <div className="input-wrapper">
                <input id="fullName" type="text" placeholder="Full name" autoComplete="name" spellCheck={false}
                  value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                <User className="input-icon" style={{ width: 16, height: 16 }} />
              </div>

              <div className="input-wrapper">
                <input id="email" type="email" placeholder="Email" autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
                <Mail className="input-icon" style={{ width: 16, height: 16 }} />
              </div>

              <div className="input-wrapper">
                <input id="password" type={showPassword ? "text" : "password"} placeholder="Password (min 6 chars)"
                  autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>

              <div className="input-wrapper">
                <input id="confirmPassword" type={showConfirm ? "text" : "password"} placeholder="Confirm password"
                  autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                <button type="button" className="password-toggle" onClick={() => setShowConfirm(v => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}>
                  {showConfirm ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
                </button>
              </div>

              <button type="submit" className="login-button" disabled={loading} style={{ marginTop: 16 }}>
                {loading ? "Creating account..." : "Create account"}
              </button>
            </form>

            <p className="login-switch">
              Already have an account?{" "}
              <Link href={loginHref}>Sign in</Link>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
