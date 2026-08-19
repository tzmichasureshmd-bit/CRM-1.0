"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  X,
  CheckCircle,
  MessageSquare,
  CreditCard,
  Users,
  Upload,
  ArrowRight,
} from "lucide-react";

const ONBOARDING_DISMISSED_KEY = "onboarding_dismissed";

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
      // Check if user dismissed onboarding
      const isDismissed =
        localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
      if (isDismissed) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      // Check subscription status
      const { data: sub } = await supabase
        .from("business_subscriptions")
        .select("status")
        .eq("account_id", accountId)
        .in("status", ["active", "trialing"])
        .limit(1)
        .single();

      // Check if WhatsApp is connected
      const { data: whatsapp } = await supabase
        .from("whatsapp_config")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      // Check contact count
      const { count: contactCount } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      // Check team members
      const { count: memberCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("account_id", accountId);

      const hasPlan = !!sub;
      const hasWhatsApp = !!whatsapp;
      const hasContacts = (contactCount ?? 0) > 0;
      const hasTeam = (memberCount ?? 0) > 1;

      // If everything is set up, dismiss onboarding
      if (hasPlan && hasWhatsApp) {
        setDismissed(true);
        setLoading(false);
        return;
      }

      setSteps([
        {
          id: "plan",
          title: "Choose your plan",
          description: "Select a plan that fits your business needs.",
          icon: <CreditCard className="h-5 w-5" />,
          href: "/billing",
          completed: hasPlan,
        },
        {
          id: "whatsapp",
          title: "Connect WhatsApp",
          description: "Link your WhatsApp Business account.",
          icon: <MessageSquare className="h-5 w-5" />,
          href: "/settings?tab=whatsapp",
          completed: hasWhatsApp,
        },
        {
          id: "contacts",
          title: "Import contacts",
          description: "Add your existing customers and leads.",
          icon: <Upload className="h-5 w-5" />,
          href: "/contacts",
          completed: hasContacts,
        },
        {
          id: "team",
          title: "Invite your team",
          description: "Add teammates to collaborate.",
          icon: <Users className="h-5 w-5" />,
          href: "/settings?tab=members",
          completed: hasTeam,
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

  return (
    <Card className="border-border bg-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">
            Welcome to WhatsApp CRM
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Let&apos;s get you set up. {completedCount} of {steps.length}{" "}
            steps complete.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {steps.map((step) => (
            <Link
              key={step.id}
              href={step.href}
              className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                step.completed
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-border hover:bg-muted"
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                  step.completed
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {step.completed ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  step.icon
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.completed
                      ? "text-emerald-500 line-through"
                      : "text-foreground"
                  }`}
                >
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
              {!step.completed && (
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
