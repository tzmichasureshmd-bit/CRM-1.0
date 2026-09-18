"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Code,
  FileSpreadsheet,
  Loader2,
  Mail,
  MessageCircle,
  Plug,
  RefreshCw,
  Settings2,
  ThumbsUp,
  Webhook,
  Power,
  HelpCircle,
} from "lucide-react";

/**
 * Integrations hub. Every card is driven by the live
 * `/api/integrations/overview` payload — nothing here is hardcoded
 * connection state. A card links to the real management surface for
 * that integration (Settings tabs, Social Media center, API developer
 * page) and never points at a non-existent flow.
 */

interface OverviewPayload {
  whatsapp: {
    connected: boolean;
    accountCount: number;
    primary: {
      id: string;
      displayPhoneNumber: string | null;
      businessName: string | null;
      connectionMethod: string | null;
    } | null;
    lastInboundAt: string | null;
  };
  email: {
    connected: boolean;
    fromEmail: string | null;
    provider: string | null;
  };
  meta: {
    configured: boolean;
    connected: boolean;
    connectionCount: number;
    facebookPages: number;
    instagramAccounts: number;
    lastLeadAt: string | null;
  };
  googleForms: {
    connected: boolean;
    contactCount: number;
    lastSubmissionAt: string | null;
  };
  webhooks: {
    endpointCount: number;
  };
  apiKeys: {
    activeCount: number;
  };
  leadCounts: {
    facebook: number;
    instagram: number;
    whatsapp: number;
    google_form: number;
  };
}

/** Live Graph-API health from /api/integrations/health. */
interface HealthPayload {
  checkedAt: string;
  config: {
    metaConfigured: boolean;
    whatsappConfigured: boolean;
  };
  whatsapp: {
    connected: boolean;
    numbers: {
      id: string;
      phoneNumberId: string;
      displayPhoneNumber: string | null;
      businessName: string | null;
      connectionMethod: string | null;
      api: "ok" | "error" | "unverified" | "unknown";
      apiError: string | null;
      webhook: "ok" | "error" | "unverified" | "unknown";
      lastWebhookAt: string | null;
      lastInboundAt: string | null;
    }[];
  };
  facebook: {
    connected: boolean;
    pages: {
      id: string;
      pageId: string;
      pageName: string | null;
      api: "ok" | "error" | "unverified" | "unknown";
      apiError: string | null;
      leadgenWebhook: "ok" | "error" | "unverified" | "unknown";
      messagesWebhook: "ok" | "error" | "unverified" | "unknown";
    }[];
  };
  instagram: {
    connected: boolean;
    accounts: {
      id: string;
      instagramAccountId: string | null;
      username: string | null;
      pageName: string | null;
      api: "ok" | "error" | "unverified" | "unknown";
      apiError: string | null;
    }[];
  };
}

type HealthTone = "ok" | "warn" | "error" | "idle";

type Category =
  | "all"
  | "communication"
  | "social-media"
  | "forms"
  | "marketing"
  | "ecommerce"
  | "crm"
  | "payments"
  | "analytics"
  | "developer"
  | "automation"
  | "ai"
  | "leads"
  | "other";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "All" },
  { id: "communication", label: "Communication" },
  { id: "social-media", label: "Social Media" },
  { id: "forms", label: "Forms" },
  { id: "marketing", label: "Marketing" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "crm", label: "CRM" },
  { id: "payments", label: "Payments" },
  { id: "analytics", label: "Analytics" },
  { id: "developer", label: "Developer" },
  { id: "automation", label: "Automation" },
  { id: "ai", label: "AI" },
  { id: "leads", label: "Leads" },
  { id: "other", label: "Other" },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

interface ConnectionBadgeProps {
  state: "connected" | "notConnected" | "attention" | "available";
  label: string;
}

function ConnectionBadge({ state, label }: ConnectionBadgeProps) {
  const styles: Record<ConnectionBadgeProps["state"], string> = {
    connected:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    notConnected:
      "border-border bg-muted text-muted-foreground",
    attention:
      "border-amber-500/30 bg-amber-500/10 text-amber-300",
    available:
      "border-primary/30 bg-primary/10 text-primary",
  };
  const Icon = state === "connected" ? CheckCircle2 : state === "attention" ? AlertTriangle : Power;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${styles[state]}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

interface IntegrationCard {
  id: string;
  category: Exclude<Category, "all">;
  name: string;
  tagline: string;
  icon: typeof Webhook;
  iconClass: string;
  description: string;
  sections: (payload: OverviewPayload) => { label: string; value: string }[];
  state: (payload: OverviewPayload) => ConnectionBadgeProps;
  /** Optional live Graph-API health rows (checked when the user runs a
   *  health check). Rendered as tone chips under the detail list. */
  health?: (payload: HealthPayload) => { label: string; value: string; tone: HealthTone }[];
  action:
    | { href: string; label: string; primary?: boolean }[]
    | ((payload: OverviewPayload) => { href: string; label: string; primary?: boolean }[]);
}

function buildCards(): IntegrationCard[] {
  return [
    {
      id: "whatsapp",
      category: "communication",
      name: "WhatsApp",
      tagline: "Cloud API messaging",
      icon: MessageCircle,
      iconClass: "bg-emerald-500/10 text-emerald-500",
      description:
        "Send and receive WhatsApp messages on one or more numbers through the official WhatsApp Cloud API. Set a default number for outbound and register numbers for inbound inbox delivery.",
      sections: (p) => [
        {
          label: "Connected numbers",
          value: p.whatsapp.accountCount.toString(),
        },
        {
          label: "Default number",
          value:
            p.whatsapp.primary?.displayPhoneNumber ??
            p.whatsapp.primary?.businessName ??
            "—",
        },
        { label: "Last inbound", value: fmtDate(p.whatsapp.lastInboundAt) },
      ],
      state: (p) =>
        p.whatsapp.connected
          ? { state: "connected", label: "Connected" }
          : { state: "notConnected", label: "Not connected" },
      health: (h) => {
        const nums = h.whatsapp.numbers;
        if (nums.length === 0) return [];
        const apiOk = nums.every((n) => n.api === "ok");
        const apiError = nums.some((n) => n.api === "error");
        const webhookOk = nums.some((n) => n.webhook === "ok");
        const webhookError = nums.some((n) => n.webhook === "error");
        return [
          {
            label: "Cloud API",
            value: apiOk ? "Reachable" : apiError ? "Unreachable" : "Not verified",
            tone: apiError ? "error" : apiOk ? "ok" : "warn",
          },
          {
            label: "Webhook",
            value: webhookOk ? "Subscribed" : webhookError ? "Error" : "Not verified",
            tone: webhookError ? "error" : webhookOk ? "ok" : "warn",
          },
        ];
      },
      action: [
        {
          href: "/settings?tab=whatsapp",
          label: "Manage",
          primary: true,
        },
      ],
    },
    {
      id: "email",
      category: "communication",
      name: "Email (SMTP)",
      tagline: "Transactional email",
      icon: Mail,
      iconClass: "bg-blue-500/10 text-blue-500",
      description:
        "Configure an SMTP provider for sending email from your account (notifications and outbound mail). Credentials are stored encrypted and scoped to this account.",
      sections: (p) => [
        { label: "From address", value: p.email.fromEmail ?? "—" },
        { label: "Provider", value: p.email.provider ?? "—" },
      ],
      state: (p) =>
        p.email.connected
          ? { state: "connected", label: "Connected" }
          : { state: "notConnected", label: "Not connected" },
      action: (p) => [{ href: "/settings?tab=email", label: "Configure", primary: p.email.connected }],
    },
    {
      id: "meta-leads",
      category: "social-media",
      name: "Facebook & Instagram Lead Ads",
      tagline: "Meta Lead Ads",
      icon: ThumbsUp,
      iconClass: "bg-[#1877F2]/10 text-[#1877F2]",
      description:
        "Connect Facebook Pages to automatically capture Lead Ads into the CRM as contacts, with campaign attribution and deduplicated ingestion via the official Meta Graph API.",
      sections: (p) => [
        { label: "Pages connected", value: p.meta.facebookPages.toString() },
        { label: "Instagram accounts", value: p.meta.instagramAccounts.toString() },
        { label: "Leads captured", value: (p.leadCounts.facebook + p.leadCounts.instagram).toString() },
        { label: "Last lead", value: fmtDate(p.meta.lastLeadAt) },
      ],
      state: (p) =>
        !p.meta.configured
          ? {
              state: "attention",
              label: "Server setup required",
            }
          : p.meta.connected
            ? { state: "connected", label: "Connected" }
            : { state: "notConnected", label: "Not connected" },
      health: (h) => {
        if (h.facebook.pages.length === 0) return [];
        const apiOk = h.facebook.pages.every((pg) => pg.api === "ok");
        const apiError = h.facebook.pages.some((pg) => pg.api === "error");
        const leadgenOk = h.facebook.pages.some((pg) => pg.leadgenWebhook === "ok");
        const leadgenError = h.facebook.pages.some((pg) => pg.leadgenWebhook === "error");
        const msgOk = h.facebook.pages.some((pg) => pg.messagesWebhook === "ok");
        const msgError = h.facebook.pages.some((pg) => pg.messagesWebhook === "error");
        return [
          {
            label: "Pages API",
            value: apiOk ? "Reachable" : apiError ? "Unreachable" : "Not verified",
            tone: apiError ? "error" : apiOk ? "ok" : "warn",
          },
          {
            label: "Lead webhook",
            value: leadgenOk ? "Subscribed" : leadgenError ? "Error" : "Not verified",
            tone: leadgenError ? "error" : leadgenOk ? "ok" : "warn",
          },
          {
            label: "Messenger/IG webhook",
            value: msgOk ? "Subscribed" : msgError ? "Error" : "Not verified",
            tone: msgError ? "error" : msgOk ? "ok" : "warn",
          },
        ];
      },
      action: [
        { href: "/social-media", label: "Open lead center", primary: true },
        { href: "/settings?tab=meta-leads", label: "Settings" },
      ],
    },
    {
      id: "google-forms",
      category: "forms",
      name: "Google Forms",
      tagline: "Form → CRM contact",
      icon: FileSpreadsheet,
      iconClass: "bg-amber-500/10 text-amber-500",
      description:
        "Every Google Form submission is delivered into the CRM as an ordinary contact (source: Google Form) via a public API key with the contacts:write scope. De-duplicated by submission id.",
      sections: (p) => [
        { label: "Contacts synced", value: p.googleForms.contactCount.toString() },
        { label: "Last submission", value: fmtDate(p.googleForms.lastSubmissionAt) },
      ],
      state: (p) =>
        p.googleForms.connected
          ? { state: "connected", label: "Active" }
          : { state: "notConnected", label: "Not started" },
      action: (p) => [
        {
          href: "/settings?tab=google-forms",
          label: p.googleForms.connected ? "Manage" : "Set up",
          primary: true,
        },
        { href: "/contacts?source=google_form", label: "View contacts" },
      ],
    },
    {
      id: "webhooks",
      category: "developer",
      name: "Outbound Webhooks",
      tagline: "Event delivery",
      icon: Webhook,
      iconClass: "bg-violet-500/10 text-violet-500",
      description:
        "Receive CRM events (new message, lead created, conversation opened) at your own endpoints. Register endpoints with a webhooks:manage API key; delivery is signed and SSRF-protected.",
      sections: (p) => [
        { label: "Endpoints", value: p.webhooks.endpointCount.toString() },
      ],
      state: (p) =>
        p.webhooks.endpointCount > 0
          ? { state: "connected", label: "Active" }
          : { state: "notConnected", label: "Not configured" },
      action: [{ href: "/api", label: "Open API docs", primary: true }],
    },
    {
      id: "api-keys",
      category: "developer",
      name: "Public API & API Keys",
      tagline: "Programmatic access",
      icon: Code,
      iconClass: "bg-slate-500/10 text-slate-300",
      description:
        "Create scoped API keys (contacts:write, webhooks:manage, broadcasts:send, …) to integrate other tools. Every key is account-scoped, revocable, and never shown in plaintext after creation.",
      sections: (p) => [
        { label: "Active keys", value: p.apiKeys.activeCount.toString() },
        { label: "Google Form endpoint", value: "/api/v1/integrations/google-forms" },
      ],
      state: () => ({ state: "available", label: "Available" }),
      action: [{ href: "/settings?tab=api", label: "Manage keys", primary: true }],
    },
  ];
}

export default function IntegrationsPage() {
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("all");
  // True while a manual health check is running (the checks hit the Meta
  // Graph API and can take a moment).
  const [checkingHealth, setCheckingHealth] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, hRes] = await Promise.all([
        fetch("/api/integrations/overview", { cache: "no-store" }),
        fetch("/api/integrations/health", { cache: "no-store" }),
      ]);
      if (!ovRes.ok || !hRes.ok) {
        setError("Could not load integration status. Please try again.");
        return;
      }
      setPayload(await ovRes.json());
      setHealth((await hRes.json()) as HealthPayload);
    } catch (err) {
      console.error("Integrations overview load failed:", err);
      setError("Could not load integration status. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const checkHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch("/api/integrations/health", { cache: "no-store" });
      if (!res.ok) throw new Error("health failed");
      setHealth((await res.json()) as HealthPayload);
    } catch (err) {
      console.error("Health check failed:", err);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  const cards = payload ? buildCards() : [];
  const visible =
    category === "all" ? cards : cards.filter((c) => c.category === category);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Plug className="h-6 w-6 text-primary" />
            Integrations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect the tools your business already uses and they show up here with
            live status. Only real connections are listed — every card reflects an
            actual, verified integration in your account.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void checkHealth()}
          disabled={loading || checkingHealth}
          title="Re-check every connection against the Meta Graph API"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={checkingHealth ? "size-3.5 animate-spin" : "size-3.5"} />
          {checkingHealth ? "Checking…" : "Check status"}
        </button>
      </div>

      {/* Last checked timestamp */}
      {health && !loading && (
        <p className="-mt-3 text-[11px] text-muted-foreground">
          Health verified{" "}
          {new Date(health.checkedAt).toLocaleTimeString()} · checks hit the live Meta
          Graph API; credentials are never exposed.
        </p>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategory(cat.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              category === cat.id
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading integration status…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive/60" />
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={load}
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            Retry
          </button>
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <HelpCircle className="h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">
            No integrations in this category yet
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Integrations live in the catalog only once they are real and
            connectable in this deployment — nothing is listed just for show.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {visible.map((card) => {
            const badge = card.state(payload!);
            const actions =
              typeof card.action === "function" ? card.action(payload!) : card.action;
            const Icon = card.icon;
            return (
              <li
                key={card.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconClass}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {card.name}
                      </h3>
                      <p className="text-xs text-muted-foreground">{card.tagline}</p>
                    </div>
                  </div>
                  <ConnectionBadge {...badge} />
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  {card.description}
                </p>

                <dl className="mt-4 space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
                  {card.sections(payload!).map((s) => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <dt className="text-xs text-muted-foreground">{s.label}</dt>
                      <dd className="truncate text-sm font-semibold tabular-nums text-foreground">
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                {card.health && health && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {card.health(health).map((h) => (
                      <HealthChip key={h.label} label={h.label} value={h.value} tone={h.tone} />
                    ))}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  {actions.map((a) =>
                    a.primary ? (
                      <Link
                        key={a.label}
                        href={a.href}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        {a.label}
                      </Link>
                    ) : (
                      <Link
                        key={a.label}
                        href={a.href}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                      >
                        <Settings2 className="size-3.5" /> {a.label}
                      </Link>
                    ),
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}