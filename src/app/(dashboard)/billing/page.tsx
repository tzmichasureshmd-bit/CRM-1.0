"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatCurrency } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Check,
  ArrowRight,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Zap,
  Users,
  MessageSquare,
  Send,
  Bot,
  Radio,
  Workflow,
} from "lucide-react";
import type {
  SubscriptionPlan,
  BusinessSubscription,
  ResourceUsage,
} from "@/types";

interface PlanWithSubscription extends SubscriptionPlan {
  _isCurrent?: boolean;
}

export default function BillingPage() {
  const { accountId, defaultCurrency } = useAuth();
  const supabase = createClient();

  const [currentSub, setCurrentSub] = useState<BusinessSubscription | null>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan | null>(null);
  const [plans, setPlans] = useState<PlanWithSubscription[]>([]);
  const [usage, setUsage] = useState<ResourceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanWithSubscription | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  const loadData = useCallback(async () => {
    if (!accountId) return;
    setLoading(true);
    setError(null);

    try {
      // Fetch active plans
      const { data: plansData, error: plansError } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");

      if (plansError) throw plansError;

      // Fetch current subscription
      const { data: subData } = await supabase
        .from("business_subscriptions")
        .select("*, subscription_plans(*)")
        .eq("account_id", accountId)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Fetch usage
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data: usageData } = await supabase
        .from("resource_usage")
        .select("*")
        .eq("account_id", accountId)
        .gte("period_start", periodStart)
        .order("period_start", { ascending: false })
        .limit(1)
        .single();

      setPlans(plansData || []);
      setCurrentSub(subData as BusinessSubscription | null);
      setCurrentPlan(subData?.subscription_plans as SubscriptionPlan | null);
      setUsage(usageData as ResourceUsage | null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load billing information";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [accountId, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatPrice = (cents: number, currency: string) =>
    formatCurrency(cents / 100, currency);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "text-emerald-500";
      case "trialing":
        return "text-blue-500";
      case "past_due":
        return "text-amber-500";
      default:
        return "text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active";
      case "trialing":
        return "Trial";
      case "past_due":
        return "Past Due";
      case "canceled":
        return "Canceled";
      case "expired":
        return "Expired";
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={loadData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Plans & Billing</h1>
        <p className="text-muted-foreground">
          Manage your CRM subscription and view usage.
        </p>
      </div>

      {/* Current Plan */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Current Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentPlan ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {currentPlan.name}
                </h2>
                <p className="text-muted-foreground">
                  {formatPrice(
                    billingPeriod === "yearly"
                      ? currentPlan.price_yearly_cents
                      : currentPlan.price_monthly_cents,
                    currentPlan.currency
                  )}{" "}
                  / {billingPeriod}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${getStatusColor(currentSub?.status || "")}`} />
                  <span className="text-sm text-muted-foreground">
                    {getStatusLabel(currentSub?.status || "")}
                  </span>
                </div>
                {currentSub?.current_period_end && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Renews: {formatDate(currentSub.current_period_end)}
                  </p>
                )}
              </div>
              <Button variant="outline" onClick={() => setSelectedPlan(plans.find(p => p.id === currentPlan.id) || null)}>
                Manage Plan
              </Button>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-2 text-muted-foreground">No active plan</p>
              <p className="text-sm text-muted-foreground/70">
                Choose a plan to start using WhatsApp CRM.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      {usage && currentPlan && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <UsageItem
                icon={<Users className="h-4 w-4" />}
                label="Contacts"
                used={usage.contacts_created}
                limit={currentPlan.max_contacts}
              />
              <UsageItem
                icon={<MessageSquare className="h-4 w-4" />}
                label="Messages Sent"
                used={usage.messages_sent}
                limit={currentPlan.max_monthly_messages}
              />
              <UsageItem
                icon={<Send className="h-4 w-4" />}
                label="Broadcasts"
                used={usage.broadcasts_created}
                limit={currentPlan.max_broadcasts_per_month}
              />
              <UsageItem
                icon={<Zap className="h-4 w-4" />}
                label="Automations"
                used={usage.automations_executed}
                limit={currentPlan.max_automations}
              />
              <UsageItem
                icon={<Bot className="h-4 w-4" />}
                label="AI Requests"
                used={usage.ai_requests}
                limit={currentPlan.max_ai_requests_per_month}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing Period Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={billingPeriod === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => setBillingPeriod("monthly")}
        >
          Monthly
        </Button>
        <Button
          variant={billingPeriod === "yearly" ? "default" : "outline"}
          size="sm"
          onClick={() => setBillingPeriod("yearly")}
        >
          Yearly
        </Button>
      </div>

      {/* Available Plans */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          Available Plans
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = currentPlan?.id === plan.id;
            const price = billingPeriod === "yearly"
              ? plan.price_yearly_cents
              : plan.price_monthly_cents;

            return (
              <Card
                key={plan.id}
                className={`border-border bg-card ${isCurrent ? "ring-2 ring-primary" : ""}`}
              >
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    {formatPrice(price, plan.currency)} / {billingPeriod}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {plan.max_contacts.toLocaleString()} contacts
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {plan.max_team_members} team members
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {plan.max_whatsapp_numbers} WhatsApp number
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-emerald-500" />
                      {plan.max_monthly_messages.toLocaleString()} messages/month
                    </li>
                  </ul>
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() => setSelectedPlan(plan)}
                    >
                      {currentPlan ? "Upgrade" : "Choose Plan"}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Plan Selection Dialog */}
      {selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md border-border bg-card">
            <CardHeader>
              <CardTitle>
                {currentPlan ? `Upgrade to ${selectedPlan.name}` : `Choose ${selectedPlan.name}`}
              </CardTitle>
              <CardDescription>
                {formatPrice(
                  billingPeriod === "yearly"
                    ? selectedPlan.price_yearly_cents
                    : selectedPlan.price_monthly_cents,
                  selectedPlan.currency
                )}{" "}
                / {billingPeriod}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentPlan && (
                <div className="text-sm text-muted-foreground">
                  <p>Current plan: {currentPlan.name}</p>
                  <p>New plan: {selectedPlan.name}</p>
                </div>
              )}
              <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                Payment integration is coming soon. Your selected plan has been saved for checkout.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setSelectedPlan(null)}>
                  Go Back
                </Button>
                <Button className="flex-1" disabled>
                  Continue to Payment
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function UsageItem({
  icon,
  label,
  used,
  limit,
}: {
  icon: React.ReactNode;
  label: string;
  used: number;
  limit: number;
}) {
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isUnlimited = limit === -1 || limit === 999999;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          {icon}
          {label}
        </span>
        <span className="text-foreground">
          {used.toLocaleString()} / {isUnlimited ? "∞" : limit.toLocaleString()}
        </span>
      </div>
      {!isUnlimited && (
        <div className="h-2 rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
