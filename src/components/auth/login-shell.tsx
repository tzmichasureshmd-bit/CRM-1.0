"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  CircleAlert,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

import { cn } from "@/lib/utils";

const LOGIN_IMAGE_SRC = "/images/crm4.jpeg";

/* ------------------------------------------------------------------
 * Cinematic shell: CRM4 image covers the entire viewport as one
 * background, a subtle neutral overlay sits on top for legibility,
 * and the glass login card floats centered above it. The image is
 * the page — there is no split-screen, side panel or separate
 * login column.
 * ------------------------------------------------------------------ */
export function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="login-shell">
      <div className="login-bg" aria-hidden="true">
        <Image
          className="login-bg__img"
          src={LOGIN_IMAGE_SRC}
          alt=""
          fill
          priority
          sizes="100vw"
        />
        <div className="login-bg__overlay" />
      </div>
      <div className="login-shell__content">{children}</div>
    </main>
  );
}

/* ------------------------------------------------------------------
 * Frosted glass card.
 * ------------------------------------------------------------------ */
export function LoginCard({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "login-glass login-card-enter w-full px-5 py-5 sm:px-5 sm:py-6",
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------
 * Brand header — existing Tzmicha mark (primary chat-square tile as
 * used by the favicon / sidebar / landing nav) + wordmark.
 * ------------------------------------------------------------------ */
export function LoginBrand() {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="login-brand-mark">
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
      <p className="login-brand-eyebrow">TZmicha IT Solutions</p>
      <p className="login-brand-name">WhatsApp CRM</p>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Panel heading inside the card.
 * ------------------------------------------------------------------ */
export function LoginHeading({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <h2 className="login-heading-title">{title}</h2>
      {children && <p className="login-heading-text">{children}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------
 * Label row (optionally with an inline action like "Forgot password?").
 * ------------------------------------------------------------------ */
export function LoginField({
  label,
  htmlFor,
  action,
  children,
}: {
  label: string;
  htmlFor: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="login-field-row">
        <label className="login-label" htmlFor={htmlFor}>
          {label}
        </label>
        {action}
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------
 * Email field with leading icon.
 * ------------------------------------------------------------------ */
export function LoginEmailInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="login-field">
      <Mail className="login-input-icon" aria-hidden="true" />
      <input
        type="email"
        autoComplete="email"
        spellCheck={false}
        className={cn("login-input login-input--icon", className)}
        {...props}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
 * Password field with leading icon + accessible show/hide toggle.
 * ------------------------------------------------------------------ */
export function LoginPasswordInput({
  className,
  showLabel,
  hideLabel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  showLabel: string;
  hideLabel: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="login-field">
      <Lock className="login-input-icon" aria-hidden="true" />
      <input
        type={visible ? "text" : "password"}
        autoComplete="current-password"
        className={cn(
          "login-input login-input--icon login-input--icon-end",
          className,
        )}
        {...props}
      />
      <button
        type="button"
        className="login-toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
      >
        {visible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Inline error banner (role="alert" → announced to screen readers).
 * ------------------------------------------------------------------ */
export function LoginError({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!children) return null;
  return (
    <div className="login-error login-error-enter" role="alert">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------
 * Primary CTA — spinner while submitting, disabled to block duplicates.
 * ------------------------------------------------------------------ */
export function LoginSubmit({
  loading,
  loadingText,
  children,
}: {
  loading: boolean;
  loadingText: string;
  children: React.ReactNode;
}) {
  return (
    <button type="submit" className="login-submit" disabled={loading}>
      {loading ? (
        <>
          <Loader2
            className="h-4 w-4 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
          {loadingText}
        </>
      ) : (
        <>{children}</>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------
 * Secondary full-width link-button.
 * ------------------------------------------------------------------ */
export function LoginSecondary({
  href,
  icon,
  children,
}: {
  href: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="login-secondary">
      {icon}
      {children}
    </Link>
  );
}

export function LoginDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-divider">
      <span>{children}</span>
    </div>
  );
}

export function LoginFooter({ children }: { children: React.ReactNode }) {
  return <p className="login-muted text-center">{children}</p>;
}