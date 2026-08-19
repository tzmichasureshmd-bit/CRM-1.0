import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  MessageSquare,
  Users,
  Zap,
  ArrowRight,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, affordable WhatsApp CRM plans for growing businesses. Plans starting at ₹499/month.",
  robots: { index: true, follow: true },
};

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

export default async function PricingPage() {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold text-foreground">
              TZmicha
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Start Free</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-20 text-center sm:px-6">
        <Badge variant="secondary" className="mb-4">
          Pricing
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Choose the plan that fits your business. All plans include core CRM
          features. Upgrade or downgrade anytime.
        </p>
      </section>

      {/* Plans */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {plans?.map((plan) => {
            const isPopular = plan.slug === "business";
            const price = plan.price_monthly_cents;
            const yearlyPrice = plan.price_yearly_cents;
            const yearlyMonthly = yearlyPrice > 0 ? yearlyPrice / 12 : 0;
            const yearlySavings =
              price > 0 && yearlyPrice > 0
                ? Math.round(((price * 12 - yearlyPrice) / (price * 12)) * 100)
                : 0;

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col border-border bg-card ${
                  isPopular
                    ? "border-primary ring-2 ring-primary/20"
                    : ""
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  {/* Monthly Price */}
                  <div className="mb-6 text-center">
                    <div className="text-4xl font-bold text-foreground">
                      {formatPrice(price, plan.currency)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      / month
                    </div>
                    {yearlyPrice > 0 && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        or {formatPrice(yearlyPrice, plan.currency)}/year
                        {yearlySavings > 0 && (
                          <span className="ml-1 text-emerald-500">
                            (save {yearlySavings}%)
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-6 flex-1 space-y-3">
                    <li className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>
                        {plan.max_contacts.toLocaleString()} contacts
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>
                        {plan.max_team_members} team{" "}
                        {plan.max_team_members === 1 ? "member" : "members"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>
                        {plan.max_whatsapp_numbers} WhatsApp{" "}
                        {plan.max_whatsapp_numbers === 1
                          ? "number"
                          : "numbers"}
                      </span>
                    </li>
                    <li className="flex items-center gap-2 text-sm">
                      <Zap className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span>
                        {plan.max_monthly_messages.toLocaleString()} messages
                        / month
                      </span>
                    </li>
                    {plan.max_broadcasts_per_month > 0 && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>
                          {plan.max_broadcasts_per_month} broadcasts / month
                        </span>
                      </li>
                    )}
                    {plan.max_automations > 0 && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{plan.max_automations} automations</span>
                      </li>
                    )}
                    {plan.max_flows > 0 && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{plan.max_flows} flows</span>
                      </li>
                    )}
                    {plan.max_ai_requests_per_month > 0 && (
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                        <span>
                          {plan.max_ai_requests_per_month.toLocaleString()} AI
                          requests / month
                        </span>
                      </li>
                    )}
                  </ul>

                  {/* CTA */}
                  <Link href="/signup" className="w-full">
                    <Button
                      className="w-full"
                      variant={isPopular ? "default" : "outline"}
                    >
                      Get Started
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Custom Plan */}
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Need a custom plan for your business?
          </p>
          <Link href="/support">
            <Button variant="link" className="mt-2">
              Contact Sales
            </Button>
          </Link>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {[
              {
                q: "Are WhatsApp/Meta messaging charges included?",
                a: "No. Our pricing is for the CRM platform only. WhatsApp/Meta messaging charges are separate and billed directly by Meta.",
              },
              {
                q: "Can I upgrade or downgrade my plan?",
                a: "Yes. You can change your plan anytime from the Plans & Billing page in your dashboard.",
              },
              {
                q: "Is there a free trial?",
                a: "Every new account starts with a free trial so you can explore the CRM before committing.",
              },
              {
                q: "What payment methods do you accept?",
                a: "We support UPI, credit/debit cards, and net banking through our secure payment gateway.",
              },
              {
                q: "Can I cancel my subscription?",
                a: "Yes. Cancel anytime from your billing page. Your access continues until the end of the current billing period.",
              },
            ].map((item) => (
              <Card key={item.q} className="border-border bg-card">
                <CardContent className="pt-6">
                  <h3 className="font-medium text-foreground">{item.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {item.a}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              TZmicha
            </span>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/refund" className="hover:text-foreground">
              Refund
            </Link>
            <Link href="/support" className="hover:text-foreground">
              Support
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 TZmicha. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
