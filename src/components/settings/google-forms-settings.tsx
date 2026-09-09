"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardCopy, KeyRound, FileJson } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * Google Forms → CRM integration guide. The credential for this
 * integration is an existing public API key (scope: contacts:write) —
 * created and managed in the API keys section — so no secrets are
 * stored or surfaced here. This panel walks the user through wiring
 * the provided Apps Script to their response Sheet.
 */
export function GoogleFormsSettings() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goApi = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "api");
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  const copyScriptProps = () => {
    void navigator.clipboard
      ?.writeText("PropertiesService.getScriptProperties().setProperty('CRM_BASE_URL', 'https://your-site.example');")
      .then(() =>
        toast.success("Snippet copied — paste into the Apps Script editor"),
      )
      .catch(() => toast.error("Could not copy snippet"));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Google Forms</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every Google Form submission is automatically delivered into your
          CRM as an ordinary contact (source: Google Form). Google Forms +
          Sheets are only the delivery layer — the Supabase contacts database
          remains the single source of truth.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400">
          Auto-sync via Apps Script
        </Badge>
      </div>

      {/* Endpoint */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileJson className="size-4 text-muted-foreground" /> Webhook endpoint
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          POST <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/api/v1/integrations/google-forms</code>
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Authenticates with a public API key (scope <code>contacts:write</code>), which
          also pins every submission to this account — form responses can never leak across
          tenants. Retries are de-duplicated by the form’s submission id.
        </p>
      </div>

      {/* Setup steps */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-foreground">Setup</h3>

        <ol className="space-y-4">
          <Step
            n={1}
            title="Create an API key with the contacts:write scope"
          >
            <p className="text-sm text-muted-foreground">
              The API key is this integration’s password and lives only in
              your account. Keep it private — never paste it into a public
              repo or frontend code.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={goApi}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              <KeyRound className="size-4" /> Open API keys
            </Button>
          </Step>

          <Step
            n={2}
            title="Copy the Apps Script into the response Sheet"
          >
            <p className="text-sm text-muted-foreground">
              Open the Google Sheet that receives form responses (Form →
              Responses → Link to Sheets), then Extensions → Apps Script and
              paste the contents of{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                scripts/google-forms/Code.gs
              </code>{" "}
              from this repository.
            </p>
          </Step>

          <Step
            n={3}
            title="Set the CRM credentials in Script Properties"
          >
            <p className="text-sm text-muted-foreground">
              Store <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">CRM_BASE_URL</code> and{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">CRM_API_KEY</code> in the script’s
              properties (not in the code), then map the form columns.
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={copyScriptProps}
              className="text-primary hover:bg-primary/10"
            >
              <ClipboardCopy className="size-4" /> Copy snippet
            </Button>
          </Step>

          <Step
            n={4}
            title="Install the trigger and verify end-to-end"
          >
            <p className="text-sm text-muted-foreground">
              Run <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">installFormTrigger</code>, then
              submit the form once and confirm a contact appears with the{" "}
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px]">
                Google Form
              </Badge>{" "}
              source badge. The sheet gets <em>CRM Sync Status</em> /{" "}
              <em>CRM Contact ID</em> / <em>CRM Error</em> columns.
            </p>
          </Step>
        </ol>
      </div>

      {/* Deep-links */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="mb-2 text-sm font-medium text-foreground">See your Google Form leads</h3>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/contacts?source=google_form"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Contacts: Google Form
          </Link>
          <Link
            href="/social-media"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Social Media count
          </Link>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children}
      </div>
    </li>
  );
}