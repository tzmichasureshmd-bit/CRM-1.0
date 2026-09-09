import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import {
  MessageSquare,
  ArrowRight,
  Users,
  BarChart3,
  Megaphone,
  FileText,
  Shield,
  CreditCard,
  Zap,
  CheckCircle2,
  ChevronDown,
  Bot,
  GitBranch,
  Bell,
  Workflow,
  Images,
  Globe,
  Inbox,
  Radio,
  UserPlus,
  ArrowDown,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingMarquee } from "@/components/landing/landing-marquee";
import { LandingReveal } from "@/components/landing/landing-reveal";

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */

const heroFloatCards = [
  { icon: UserPlus, text: "New Facebook Lead", color: "text-blue-500", delay: "landing-float-card-delay-1" },
  { icon: MessageSquare, text: "New WhatsApp Message", color: "text-emerald-500", delay: "landing-float-card-delay-2" },
  { icon: CheckCircle2, text: "Lead Converted", color: "text-primary", delay: "landing-float-card-delay-3" },
  { icon: Bell, text: "Follow-up Due", color: "text-amber-500", delay: "landing-float-card-delay-4" },
];

const features = [
  { icon: Inbox, title: "Unified Inbox", description: "Manage customer conversations from WhatsApp, Facebook and Instagram in one place." },
  { icon: Users, title: "Lead Management", description: "Capture, organize and follow up with every lead from every channel." },
  { icon: Zap, title: "WhatsApp Automation", description: "Automate repetitive conversations, follow-ups and responses with AI." },
  { icon: Megaphone, title: "Campaigns", description: "Reach thousands of customers with targeted WhatsApp broadcast campaigns." },
  { icon: FileText, title: "Templates", description: "Create and manage reusable WhatsApp message templates for any scenario." },
  { icon: Bot, title: "AI Agents", description: "Deploy AI-powered agents to handle conversations and qualify leads 24/7." },
  { icon: GitBranch, title: "Sales Pipelines", description: "Visual Kanban pipelines to track every deal from first contact to close." },
  { icon: BarChart3, title: "Reports & Analytics", description: "Track response times, conversion rates and team performance in real time." },
  { icon: Workflow, title: "Flows & Automations", description: "Build no-code visual flows to automate your entire customer journey." },
  { icon: Radio, title: "Broadcasts", description: "Send personalized bulk messages with scheduling and delivery tracking." },
  { icon: Bell, title: "Notifications", description: "Never miss a message or follow-up with real-time smart notifications." },
  { icon: Shield, title: "Multi-Tenant Security", description: "Enterprise-grade security with role-based access and data isolation." },
];

const leadSources = [
  { name: "Facebook Leads", icon: Globe, count: "120", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" },
  { name: "Instagram Leads", icon: Images, count: "85", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  { name: "WhatsApp Leads", icon: MessageSquare, count: "240", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { name: "Website Leads", icon: Globe, count: "42", color: "bg-violet-500/10 text-violet-500 border-violet-500/20" },
];

const leadFlow = [
  "Facebook Lead",
  "Instagram Lead",
  "WhatsApp Conversation",
  "CRM",
  "Assigned Agent",
  "Follow-up",
  "Converted Customer",
];

const plans = [
  {
    name: "Starter",
    price: "\u20B9499",
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
    price: "\u20B9999",
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
    price: "\u20B91,999",
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

const faqs = [
  { question: "What is WhatsApp CRM?", answer: "A CRM that connects to your WhatsApp Business account, helping you manage conversations, contacts, campaigns, and team collaboration \u2014 all in one powerful platform." },
  { question: "Can I use my own WhatsApp Business number?", answer: "Yes. You connect your own WhatsApp Business API number through our secure embedded signup. Your data stays under your control." },
  { question: "How does the subscription work?", answer: "Choose a plan, pay monthly or yearly. Your plan determines your limits for contacts, team members, and features." },
  { question: "Can I upgrade my plan?", answer: "Yes. Upgrade anytime from your billing page. The price difference is prorated." },
  { question: "Can I cancel my subscription?", answer: "Yes. Cancel anytime from your billing page. Your access continues until the end of the billing period." },
  { question: "How many team members can I add?", answer: "Depends on your plan: Starter (2), Business (5), Professional (15). Upgrade anytime." },
  { question: "Are WhatsApp/Meta messaging charges included?", answer: "No. Our pricing is for the CRM platform only. WhatsApp/Meta messaging charges are separate and billed by Meta." },
  { question: "Is there a free trial?", answer: "Every new account starts with a free trial. No credit card required to start." },
];

const dashboardCallouts = [
  { label: "Total Leads", value: "2,847", icon: Users },
  { label: "New Conversations", value: "184", icon: MessageSquare },
  { label: "Conversion Rate", value: "24.8%", icon: BarChart3 },
  { label: "Open Deals", value: "53", icon: GitBranch },
  { label: "Follow-ups", value: "37", icon: Bell },
  { label: "Campaign Performance", value: "92%", icon: Megaphone },
];

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "WhatsApp CRM | Manage Leads, Conversations & Sales | TZMICHA IT SOLUTIONS",
  description:
    "Manage WhatsApp conversations, leads, campaigns, automation and customer relationships from one powerful CRM. Connect Facebook, Instagram and WhatsApp in a single platform.",
  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* ====== NAVIGATION ====== */}
      <LandingNav />

      {/* ====== HERO ====== */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 landing-dots-bg opacity-60" />
        <div className="absolute left-1/2 top-0 -z-10 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-primary/5 blur-3xl landing-glow" />

        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-32">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Left: Copy */}
            <div className="text-center lg:text-left">
              <Badge variant="secondary" className="mb-5 text-xs font-medium">
                TZMICHA IT SOLUTIONS
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Turn Conversations
                <br />
                Into{" "}
                <span className="landing-gradient-text">Customers</span>
              </h1>
              <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground lg:mx-0">
                Manage WhatsApp conversations, leads, contacts, campaigns and automation
                from one powerful CRM.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
                <Link href="/signup">
                  <Button size="lg" className="px-7 landing-btn-lift">
                    Get Started
                    <ArrowRight className="size-4" />
                  </Button>
                </Link>
                <a href="#product">
                  <Button variant="outline" size="lg" className="px-7">
                    See the Product
                  </Button>
                </a>
              </div>
              <p className="mt-5 text-xs text-muted-foreground">
                Trusted by growing businesses across India
              </p>
            </div>

            {/* Right: Product screenshot with floating cards */}
            <div className="landing-perspective hidden lg:block">
              <div className="relative">
                {/* Glow behind image */}
                <div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-2xl landing-glow" />

                {/* Main screenshot */}
                <div className="relative landing-3d-tilt overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/10">
                  <Image
                    src="/crm/crm1.jpeg"
                    alt="WhatsApp CRM Dashboard"
                    width={800}
                    height={500}
                    className="h-auto w-full"
                    priority
                  />
                </div>

                {/* Floating notification cards */}
                {heroFloatCards.map((card, i) => (
                  <div
                    key={card.text}
                    className={`absolute -right-2 flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/95 px-3.5 py-2.5 shadow-lg backdrop-blur-sm landing-float-card ${card.delay}`}
                    style={{
                      top: `${15 + i * 20}%`,
                      right: i % 2 === 0 ? "-12px" : "-8px",
                    }}
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-background ${card.color}`}>
                      <card.icon className="h-4 w-4" />
                    </div>
                    <span className="whitespace-nowrap text-xs font-medium">{card.text}</span>
                  </div>
                ))}

                {/* Floating marketing words */}
                <div
                  className="pointer-events-none absolute left-[-8px] top-[2%] text-sm font-bold uppercase tracking-[0.2em] text-primary/50 landing-float-word"
                  style={{ transform: "rotate(-8deg)" }}
                >
                  LEADS
                </div>
                <div
                  className="pointer-events-none absolute right-[-6px] top-[58%] text-sm font-bold uppercase tracking-[0.2em] text-emerald-500/50 landing-float-word"
                  style={{ animationDelay: "1.2s", transform: "rotate(6deg)" }}
                >
                  AUTOMATION
                </div>
                <div
                  className="pointer-events-none absolute bottom-[-8px] left-[8%] text-sm font-bold uppercase tracking-[0.2em] text-blue-500/50 landing-float-word"
                  style={{ animationDelay: "2.4s", transform: "rotate(3deg)" }}
                >
                  GROWTH
                </div>
                <div
                  className="pointer-events-none absolute left-[-20px] top-[34%] text-sm font-bold uppercase tracking-[0.2em] text-pink-500/50 landing-float-word"
                  style={{ animationDelay: "3.6s", transform: "rotate(-4deg)" }}
                >
                  AI
                </div>
                <div
                  className="pointer-events-none absolute right-[4px] top-[2%] text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground/40 landing-float-word"
                  style={{ animationDelay: "1.8s", transform: "rotate(-6deg)" }}
                >
                  CONVERSATIONS
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== TRUST STRIP ====== */}
      <section className="border-y border-border/40 bg-muted/20">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
          {["WhatsApp Business", "Multi-User", "Secure", "24/7 Access", "Meta Verified", "Self-Hostable"].map((item) => (
            <span key={item} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3 text-primary" />
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ====== MARQUEE 1 ====== */}
      <section className="border-b border-border/40 py-4">
        <LandingMarquee
          items={["WHATSAPP CRM", "LEAD MANAGEMENT", "AUTOMATION", "AI", "CAMPAIGNS", "ANALYTICS", "GROWTH", "PIPELINES", "BROADCASTS", "TEMPLATES"]}
        />
      </section>

      {/* ====== PRODUCT SHOWCASE ====== */}
      <section id="product" className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingReveal>
            <div className="mb-14 text-center">
              <Badge variant="secondary" className="mb-4 text-xs">
                <Sparkles className="mr-1.5 size-3" />
                Product
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Everything Your Team Needs To Grow
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                A complete WhatsApp CRM that centralizes conversations, leads, campaigns and automation
                so your team can focus on what matters: closing deals.
              </p>
            </div>
          </LandingReveal>

          <LandingReveal delay={100}>
            <div className="landing-perspective">
              <div className="relative mx-auto max-w-4xl">
                <div className="absolute -inset-6 rounded-3xl bg-primary/5 blur-3xl landing-glow" />
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/10 landing-3d-tilt">
                  <Image
                    src="/crm/crm2.jpeg"
                    alt="WhatsApp CRM Inbox and Lead Management"
                    width={1200}
                    height={750}
                    className="h-auto w-full"
                  />
                </div>
              </div>
            </div>
          </LandingReveal>

          {/* Feature cards around the showcase */}
          <LandingReveal delay={200}>
            <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Inbox, title: "Unified Inbox", desc: "All conversations in one place." },
                { icon: Users, title: "Lead Management", desc: "Capture and follow up with every lead." },
                { icon: Zap, title: "WhatsApp Automation", desc: "Automate repetitive follow-ups." },
                { icon: Megaphone, title: "Campaigns", desc: "Targeted messages at scale." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm landing-card-hover">
                  <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <f.icon className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
                </div>
              ))}
            </div>
          </LandingReveal>
        </div>
      </section>

      {/* ====== MARQUEE 2 (reverse) ====== */}
      <section className="border-y border-border/40 py-4">
        <LandingMarquee
          reverse
          items={["CONNECT", "ENGAGE", "AUTOMATE", "CONVERT", "GROW"]}
          speed="25s"
        />
      </section>

      {/* ====== ALL FEATURES ====== */}
      <section id="features" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingReveal>
            <div className="mb-14 text-center">
              <Badge variant="secondary" className="mb-4 text-xs">
                <Zap className="mr-1.5 size-3" />
                Features
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Built for Modern Sales Teams
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Every tool your team needs to manage WhatsApp conversations, convert leads, and grow revenue.
              </p>
            </div>
          </LandingReveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {features.map((feature, i) => (
              <LandingReveal key={feature.title} delay={i * 50}>
                <div className="group h-full rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:bg-card landing-card-hover">
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                </div>
              </LandingReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====== LEADS SECTION ====== */}
      <section id="leads" className="relative overflow-hidden border-y border-border/40 bg-muted/20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingReveal>
            <div className="mb-14 text-center">
              <Badge variant="secondary" className="mb-4 text-xs">
                <UserPlus className="mr-1.5 size-3" />
                Lead Management
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Never Lose a Lead Again
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Capture leads from Facebook, Instagram, WhatsApp and your website.
                Every lead is automatically organized, assigned and followed up.
              </p>
            </div>
          </LandingReveal>

          {/* Lead source cards */}
          <LandingReveal delay={100}>
            <div className="mx-auto mb-16 grid max-w-3xl grid-cols-2 gap-4 lg:grid-cols-4">
              {leadSources.map((source) => (
                <div key={source.name} className={`rounded-xl border p-4 text-center landing-card-hover ${source.color}`}>
                  <source.icon className="mx-auto mb-2 h-6 w-6" />
                  <p className="text-2xl font-bold">{source.count}</p>
                  <p className="mt-1 text-xs font-medium opacity-80">{source.name}</p>
                </div>
              ))}
            </div>
          </LandingReveal>

          {/* Lead flow visualization */}
          <LandingReveal delay={200}>
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-col items-center gap-2">
                {leadFlow.map((step, i) => (
                  <div key={step} className="flex items-center gap-3">
                    <div className="flex h-10 items-center rounded-lg border border-border/60 bg-card px-4 text-sm font-medium shadow-sm">
                      {step === "CRM" ? (
                        <span className="flex items-center gap-2">
                          <MessageSquare className="size-4 text-primary" />
                          {step}
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Central Hub</span>
                        </span>
                      ) : step === "Converted Customer" ? (
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-emerald-500" />
                          {step}
                        </span>
                      ) : (
                        step
                      )}
                    </div>
                    {i < leadFlow.length - 1 && (
                      <ArrowDown className="size-4 text-muted-foreground/40" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </LandingReveal>

          {/* CRM screenshot for leads */}
          <LandingReveal delay={300}>
            <div className="landing-perspective mx-auto mt-16 max-w-4xl">
              <div className="relative">
                <div className="absolute -inset-4 rounded-2xl bg-primary/5 blur-2xl landing-glow" />
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/10 landing-3d-tilt">
                  <Image
                    src="/crm/crm3.jpeg"
                    alt="WhatsApp CRM Lead Pipeline"
                    width={1200}
                    height={750}
                    className="h-auto w-full"
                  />
                </div>
              </div>
            </div>
          </LandingReveal>
        </div>
      </section>

      {/* ====== DASHBOARD ANALYTICS SECTION ====== */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingReveal>
            <div className="mb-14 text-center">
              <Badge variant="secondary" className="mb-4 text-xs">
                <BarChart3 className="mr-1.5 size-3" />
                Analytics
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Your Entire Business At A Glance
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
                Real-time dashboards that give you complete visibility into leads, conversations, campaigns and team performance.
              </p>
            </div>
          </LandingReveal>

          {/* Dashboard callouts grid */}
          <LandingReveal delay={100}>
            <div className="mx-auto mb-12 grid max-w-3xl grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {dashboardCallouts.map((item) => (
                <div key={item.label} className="rounded-xl border border-border/60 bg-card/60 p-4 text-center backdrop-blur-sm landing-card-hover">
                  <item.icon className="mx-auto mb-2 h-5 w-5 text-primary" />
                  <p className="text-xl font-bold">{item.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </LandingReveal>

          <LandingReveal delay={200}>
            <div className="landing-perspective mx-auto max-w-4xl">
              <div className="relative">
                <div className="absolute -inset-6 rounded-3xl bg-primary/5 blur-3xl landing-glow" />
                <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl shadow-black/10 landing-3d-tilt">
                  <Image
                    src="/crm/crm1.jpeg"
                    alt="WhatsApp CRM Dashboard Analytics"
                    width={1200}
                    height={750}
                    className="h-auto w-full"
                  />
                </div>
              </div>
            </div>
          </LandingReveal>
        </div>
      </section>

      {/* ====== HOW IT WORKS ====== */}
      <section className="border-y border-border/40 bg-muted/20 py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingReveal>
            <div className="mb-14 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Get Started in Minutes
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                Four simple steps to transform your WhatsApp business communication.
              </p>
            </div>
          </LandingReveal>

          <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { number: "01", title: "Create Account", desc: "Sign up in seconds. No credit card required." },
              { number: "02", title: "Connect WhatsApp", desc: "Link your WhatsApp Business number securely." },
              { number: "03", title: "Invite Your Team", desc: "Add teammates and assign roles." },
              { number: "04", title: "Start Growing", desc: "Manage conversations and close deals." },
            ].map((step, i) => (
              <LandingReveal key={step.number} delay={i * 80}>
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-lg font-bold text-primary">
                    {step.number}
                  </div>
                  <h3 className="font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </LandingReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====== PRICING ====== */}
      <section id="pricing" className="py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <LandingReveal>
            <div className="mb-14 text-center">
              <Badge variant="secondary" className="mb-4 text-xs">
                <CreditCard className="mr-1.5 size-3" />
                Pricing
              </Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Simple, Transparent Pricing
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                No hidden fees. No per-message charges. Start free and scale as you grow.
              </p>
            </div>
          </LandingReveal>

          <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
            {plans.map((plan, i) => (
              <LandingReveal key={plan.name} delay={i * 80}>
                <div
                  className={`relative flex h-full flex-col rounded-2xl border p-6 transition-all duration-300 landing-card-hover ${
                    plan.popular
                      ? "border-primary/50 bg-card shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                      : "border-border/60 bg-card/60"
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                      MOST POPULAR
                    </Badge>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-3 flex items-baseline gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="mt-6 block">
                    <Button
                      className="w-full landing-btn-lift"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      Get Started
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>
              </LandingReveal>
            ))}
          </div>

          <LandingReveal delay={300}>
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Need a custom plan?{" "}
              <a
                href="mailto:support@tzmicha.com"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Contact Sales
              </a>
            </p>
          </LandingReveal>
        </div>
      </section>

      {/* ====== FAQ ====== */}
      <section id="faq" className="border-y border-border/40 bg-muted/20 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <LandingReveal>
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Frequently Asked Questions
              </h2>
              <p className="mt-3 text-muted-foreground">
                Everything you need to know about TZMICHA WhatsApp CRM
              </p>
            </div>
          </LandingReveal>

          <div className="space-y-2">
            {faqs.map((faq, i) => (
              <LandingReveal key={faq.question} delay={i * 40}>
                <details className="group rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 text-sm font-medium">
                    {faq.question}
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </div>
                </details>
              </LandingReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ====== FINAL CTA ====== */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 landing-dots-bg opacity-40" />
        <div className="absolute left-1/2 top-1/2 -z-10 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-3xl landing-glow" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <LandingReveal>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Ready to Turn Conversations Into Customers?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Start your free trial today. No credit card required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" className="px-8 landing-btn-lift">
                  Start Free Trial
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <a href="mailto:support@tzmicha.com">
                <Button variant="outline" size="lg" className="px-8">
                  Talk to Sales
                </Button>
              </a>
            </div>
          </LandingReveal>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t border-border bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-5">
            <div className="sm:col-span-2 md:col-span-1">
              <Link href="/" className="mb-3 flex items-center gap-2 font-bold">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageSquare className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm">TZMICHA IT SOLUTIONS</span>
              </Link>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Powering smarter customer conversations.
              </p>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="transition-colors hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="transition-colors hover:text-foreground">Pricing</a></li>
                <li><a href="#product" className="transition-colors hover:text-foreground">Product</a></li>
                <li><a href="#leads" className="transition-colors hover:text-foreground">Lead Management</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="mailto:support@tzmicha.com" className="transition-colors hover:text-foreground">Contact</a></li>
                <li><a href="mailto:support@tzmicha.com" className="transition-colors hover:text-foreground">Support</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="transition-colors hover:text-foreground">Privacy Policy</Link></li>
                <li><Link href="/terms" className="transition-colors hover:text-foreground">Terms of Service</Link></li>
                <li><Link href="/refund" className="transition-colors hover:text-foreground">Refund Policy</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 text-sm font-semibold">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="transition-colors hover:text-foreground">Login</Link></li>
                <li><Link href="/signup" className="transition-colors hover:text-foreground">Sign Up</Link></li>
                <li><Link href="/support" className="transition-colors hover:text-foreground">Help Center</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-10 border-t border-border pt-6 text-center text-xs text-muted-foreground">
            &copy; 2026 TZMICHA IT SOLUTIONS. All rights reserved. | Not affiliated with Meta or WhatsApp.
          </div>
        </div>
      </footer>
    </div>
  );
}
