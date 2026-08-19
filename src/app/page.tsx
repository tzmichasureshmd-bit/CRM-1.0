import Link from "next/link";
import {
  MessageSquare,
  ArrowRight,
  Users,
  BarChart3,
  Settings,
  Megaphone,
  FileText,
  Shield,
  Clock,
  CreditCard,
  Zap,
  Smartphone,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: MessageSquare,
    title: "Shared WhatsApp Inbox",
    description:
      "Manage all customer conversations in one place. Never miss a message.",
  },
  {
    icon: Users,
    title: "Contact Management",
    description:
      "Organize customers and leads with tags, notes, and custom fields.",
  },
  {
    icon: Megaphone,
    title: "Campaigns",
    description:
      "Send bulk WhatsApp messages to your contacts with approved templates.",
  },
  {
    icon: FileText,
    title: "Templates",
    description:
      "Create and manage reusable WhatsApp message templates.",
  },
  {
    icon: Users,
    title: "Team Management",
    description:
      "Invite your team, assign roles, and collaborate seamlessly.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "Track conversations, response times, and business activity.",
  },
  {
    icon: Zap,
    title: "Automation",
    description:
      "Automate repetitive tasks with powerful workflow automation.",
  },
  {
    icon: Smartphone,
    title: "WhatsApp Business",
    description:
      "Connect your own WhatsApp Business number. Your data stays yours.",
  },
];

const steps = [
  { number: "01", title: "Create your account" },
  { number: "02", title: "Choose your plan" },
  { number: "03", title: "Connect your WhatsApp Business" },
  { number: "04", title: "Start managing conversations" },
];

const plans = [
  {
    name: "Starter",
    price: "₹499",
    period: "/month",
    features: [
      "2 team members",
      "5,000 contacts",
      "1 WhatsApp number",
      "Shared inbox",
      "Contact management",
    ],
    popular: false,
  },
  {
    name: "Business",
    price: "₹999",
    period: "/month",
    features: [
      "5 team members",
      "25,000 contacts",
      "1 WhatsApp number",
      "Everything in Starter",
      "Campaigns & templates",
      "Automation",
      "Analytics",
    ],
    popular: true,
  },
  {
    name: "Professional",
    price: "₹1,999",
    period: "/month",
    features: [
      "15 team members",
      "100,000 contacts",
      "3 WhatsApp numbers",
      "Everything in Business",
      "Advanced automation",
      "Priority support",
    ],
    popular: false,
  },
];

const whyChooseUs = [
  {
    title: "Your WhatsApp, Your Data",
    description:
      "Connect your own WhatsApp Business account. Your conversations and contacts stay under your control.",
    icon: Shield,
  },
  {
    title: "Built for Teams",
    description:
      "Invite teammates, assign roles, manage access. From 2 to 15+ members.",
    icon: Users,
  },
  {
    title: "Simple Pricing",
    description:
      "No hidden fees. No per-message charges. Plans starting at ₹499/month.",
    icon: CreditCard,
  },
];

const useCases = [
  {
    name: "Retail Businesses",
    description: "Manage orders, product inquiries, and customer support on WhatsApp.",
  },
  {
    name: "Real Estate",
    description: "Track leads, schedule viewings, and follow up with prospects.",
  },
  {
    name: "Clinics & Healthcare",
    description: "Handle appointment bookings and patient communication.",
  },
  {
    name: "Salons & Beauty",
    description: "Manage bookings, reminders, and client relationships.",
  },
  {
    name: "Restaurants & Food",
    description: "Take orders, share menus, and handle reservations.",
  },
  {
    name: "Coaching & Education",
    description: "Connect with students, share materials, and manage enrollment.",
  },
  {
    name: "Service Businesses",
    description: "Coordinate jobs, share quotes, and update customers.",
  },
  {
    name: "Small Online Businesses",
    description: "Provide support, process orders, and build customer loyalty.",
  },
];

const faqs = [
  {
    question: "What is WhatsApp CRM?",
    answer:
      "A CRM that connects to your WhatsApp Business account, helping you manage conversations, contacts, campaigns, and team collaboration.",
  },
  {
    question: "Can I use my own WhatsApp Business number?",
    answer:
      "Yes. You connect your own WhatsApp Business API number. Your data stays under your control.",
  },
  {
    question: "How does the subscription work?",
    answer:
      "Choose a plan, pay monthly or yearly. Your plan determines your limits for contacts, team members, and features.",
  },
  {
    question: "Can I upgrade my plan?",
    answer:
      "Yes. Upgrade anytime from your billing page. The price difference is prorated.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "Yes. Cancel anytime from your billing page. Your access continues until the end of the billing period.",
  },
  {
    question: "How many team members can I add?",
    answer:
      "Depends on your plan: Starter (2), Business (5), Professional (15). Upgrade anytime.",
  },
  {
    question: "Are WhatsApp/Meta messaging charges included?",
    answer:
      "No. Our pricing is for the CRM platform only. WhatsApp/Meta messaging charges are separate and billed by Meta.",
  },
  {
    question: "How do I connect WhatsApp Business?",
    answer:
      "After signing up, go to Settings → WhatsApp and follow the setup instructions to connect your Meta WhatsApp Business API.",
  },
  {
    question: "Can I import contacts?",
    answer: "Yes. Import contacts via CSV from the Contacts page.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "Every new account starts with a free trial. No credit card required to start.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <MessageSquare className="size-5 text-primary" />
            <span>TZmicha</span>
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            <a href="#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Features
            </a>
            <a href="#pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              Pricing
            </a>
            <a href="#faq" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Start Free
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-20 text-center sm:px-6 sm:pt-28">
          <Badge variant="secondary" className="mb-6">
            WhatsApp CRM for Business
          </Badge>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Manage Your Business on WhatsApp — Simply.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            One powerful CRM for conversations, contacts, campaigns and your
            team.
          </p>
          <p className="mt-3 text-sm font-medium text-primary">
            Plans starting at ₹499/month
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup">
              <Button size="lg" className="px-6">
                Start Free
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#pricing">
              <Button variant="outline" size="lg" className="px-6">
                View Pricing
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-y border-border/50 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="mb-4 text-center text-sm text-muted-foreground">
            Trusted by growing businesses across India
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
            {[
              "WhatsApp Business",
              "Multi-User",
              "Secure",
              "24/7 Access",
            ].map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1"
              >
                <CheckCircle2 className="size-3 text-primary" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-3 text-muted-foreground">
              Powerful features to manage your business on WhatsApp
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <Card key={feature.title}>
                <CardHeader>
                  <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="size-4.5" />
                  </div>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-y border-border/50 bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Get started in four simple steps
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {step.number}
                </div>
                <p className="font-medium">{step.title}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Simple, Transparent Pricing
            </h2>
            <p className="mt-3 text-muted-foreground">
              No hidden fees. No per-message charges.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={
                  plan.popular
                    ? "relative border-primary/50 ring-primary/20"
                    : ""
                }
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    MOST POPULAR
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="mb-6 space-y-2">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="block">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Need a custom plan?{" "}
            <a
              href="mailto:support@tzmicha.com"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Contact Sales
            </a>
          </p>
        </div>
      </section>

      {/* Why Choose Us */}
      <section className="border-y border-border/50 bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why Choose TZmicha
            </h2>
            <p className="mt-3 text-muted-foreground">
              Built for businesses that want simplicity and control
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {whyChooseUs.map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-5" />
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for Every Industry
            </h2>
            <p className="mt-3 text-muted-foreground">
              Whatever your business, TZmicha helps you serve customers better
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {useCases.map((uc) => (
              <Card key={uc.name}>
                <CardHeader>
                  <CardTitle className="text-base">{uc.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{uc.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="border-y border-border/50 bg-muted/30 py-20"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-muted-foreground">
              Everything you need to know about TZmicha
            </p>
          </div>
          <div className="space-y-2">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-border bg-card"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-medium">
                  {faq.question}
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm text-muted-foreground">
                  {faq.answer}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to manage your business on WhatsApp?
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start your free trial today.
          </p>
          <div className="mt-8">
            <Link href="/signup">
              <Button size="lg" className="px-8">
                Start Free
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
            <div className="sm:col-span-2 md:col-span-1">
              <Link
                href="/"
                className="mb-3 flex items-center gap-2 font-semibold"
              >
                <MessageSquare className="size-4 text-primary" />
                TZmicha
              </Link>
              <p className="text-sm text-muted-foreground">
                Simple, affordable WhatsApp CRM for growing businesses.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-foreground">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-foreground">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Changelog
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground">
                    Support
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/privacy" className="hover:text-foreground">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-foreground">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/refund" className="hover:text-foreground">
                    Refund Policy
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-medium">Connect</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground">
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:support@tzmicha.com"
                    className="hover:text-foreground"
                  >
                    Email
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            © 2026 TZmicha. All rights reserved. | Not affiliated with Meta or
            WhatsApp.
          </div>
        </div>
      </footer>
    </div>
  );
}
