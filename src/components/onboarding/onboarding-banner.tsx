"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  X,
  CheckCircle2,
  Circle,
  MessageSquare,
  CreditCard,
  Users,
  Upload,
  ArrowRight,
  Sparkles,
  Zap,
  Layers,
} from "lucide-react";

const ONBOARDING_DISMISSED_KEY = "onboarding_dismissed_v2";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  completed: boolean;
}

export function OnboardingBanner() {
  const { accountId, user } = useAuth();
  const supabase = createClient();
  const [dismissed, setDismissed] = useState(false);
  const [steps, setSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);

  const checkOnboarding = useCallback(async () => {
    if (!accountId || !user) return;

    try {
      const isDismissed =
        localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
      if (isDismissed) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      const { data: sub } = await supabase
        .from("business_subscriptions")
        .select("status")
        .eq("account_id", accountId)
        .in("status", ["active", "trialing"])
        .limit(1)
        .maybeSingle();

      const { data: whatsapp } = await supabase
        .from("whatsapp_config")
        .select("id")
        .eq("account_id", accountId)
        .limit(1);

      const { count: contactCount } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      const { count: memberCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      const { count: templateCount } = await supabase
        .from("message_templates")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      const { count: automationCount } = await supabase
        .from("automations")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      const hasPlan = !!sub;
      const hasWhatsApp = !!whatsapp && whatsapp.length > 0;
      const hasContacts = (contactCount ?? 0) > 0;
      const hasTeam = (memberCount ?? 0) > 1;
      const hasTemplate = (templateCount ?? 0) > 0;
      const hasAutomation = (automationCount ?? 0) > 0;

      if (hasPlan && hasWhatsApp && hasContacts) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      setSteps([
        {
          id: "plan",
          title: "Choose your plan",
          description: "Select a plan that fits your business needs.",
          icon: <CreditCard className="h-4 w-4" />,
          href: "/billing",
          completed: hasPlan,
        },
        {
          id: "whatsapp",
          title: "Connect WhatsApp",
          description: "Link your WhatsApp Business account to start messaging.",
          icon: <MessageSquare className="h-4 w-4" />,
          href: "/settings?tab=whatsapp",
          completed: hasWhatsApp,
        },
        {
          id: "contacts",
          title: "Import contacts",
          description: "Add your existing customers and leads.",
          icon: <Upload className="h-4 w-4" />,
          href: "/contacts",
          completed: hasContacts,
        },
        {
          id: "template",
          title: "Create a template",
          description: "Build reusable message templates for outreach.",
          icon: <Layers className="h-4 w-4" />,
          href: "/templates",
          completed: hasTemplate,
        },
        {
          id: "team",
          title: "Invite your team",
          description: "Add teammates to collaborate on conversations.",
          icon: <Users className="h-4 w-4" />,
          href: "/settings?tab=members",
          completed: hasTeam,
        },
        {
          id: "automation",
          title: "Set up automation",
          description: "Automate responses and workflows to save time.",
          icon: <Zap className="h-4 w-4" />,
          href: "/automations",
          completed: hasAutomation,
        },
      ]);
    } catch {
      // Silently handle errors
    } finally {
      setLoading(false);
    }
  }, [accountId, user, supabase]);

  useEffect(() => {
    checkOnboarding();
  }, [checkOnboarding]);

  const handleDismiss = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    setDismissed(true);
  };

  if (loading || dismissed || steps.length === 0) return null;

  const completedCount = steps.filter((s) => s.completed).length;
  const allDone = completedCount === steps.length;
  if (allDone) return null;

  const progress = Math.round((completedCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.completed);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/[0.02]" />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Get your workspace ready
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {completedCount} of {steps.length} steps complete — your workspace is {progress}% ready
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={`group flex items-center gap-3 rounded-lg border p-3 transition-all ${
                step.completed
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-border hover:border-primary/30 hover:bg-muted/50"
              }`}
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  step.completed
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                }`}
              >
                {step.completed ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.completed
                      ? "text-emerald-500"
                      : "text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {step.description}
                </p>
              </div>
              {!step.completed && (
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </Link>
          ))}
        </div>

        {nextStep && (
          <div className="mt-4 flex items-center gap-2">
            <Link href={nextStep.href}>
              <Button size="sm" className="gap-1.5">
                {nextStep.title}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Skip for now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
