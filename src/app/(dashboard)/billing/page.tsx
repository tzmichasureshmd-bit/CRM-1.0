"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Phone, PhoneCall, Sparkles, Clock, ShieldCheck, Check } from "lucide-react";

const CONSULTANT_PHONE = "9346947043";
const CONSULTANT_TEL_HREF = "tel:9346947043";
const CONSULTANT_WHATSAPP_HREF =
  "https://wa.me/919346947043?text=" +
  encodeURIComponent(
    "Hi, I would like to discuss the right CRM plan for my business.",
  );

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function BillingPage() {
  return (
    <div className="relative isolate flex min-h-[75vh] items-center justify-center py-2">
      {/* Decorative, token-driven background — reads correctly in light & dark */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-3xl"
      >
        <div className="landing-dots-bg absolute inset-0 opacity-60" />
        <div className="absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-16 top-1/3 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Card className="landing-card-hover w-full max-w-3xl border-border bg-card/80 shadow-card backdrop-blur-sm">
        <div className="h-1.5 w-full bg-gradient-to-r from-transparent via-primary to-transparent" />

        <CardContent className="p-6 sm:p-10">
          <div className="landing-stagger mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
            {/* Icon badge */}
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
              <PhoneCall className="h-7 w-7 text-primary" />
            </div>

            {/* Eyebrow */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              CRM Consultation
            </span>

            {/* Heading */}
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
              Need a CRM Solution for Your Business?
            </h1>

            {/* Message */}
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Looking for the right CRM plan for your business? Contact our
              consultant to explore the best solution for your requirements.
            </p>

            {/* Consultant number */}
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Consultant Helpline
              </span>
              <a
                href={CONSULTANT_TEL_HREF}
                className="text-3xl font-bold tracking-wide text-foreground tabular-nums transition-colors hover:text-primary sm:text-4xl"
              >
                {CONSULTANT_PHONE}
              </a>
            </div>

            {/* Actions */}
            <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">
              <a
                href={CONSULTANT_TEL_HREF}
                className="landing-btn-lift inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              >
                <Phone className="h-4 w-4" />
                Call Our Consultant
              </a>

              <a
                href={CONSULTANT_WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-lift inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-6 text-sm font-semibold text-white shadow-sm shadow-[#25D366]/30 transition-all duration-200 hover:bg-[#1ebe5b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
              >
                <WhatsAppGlyph className="h-4 w-4" />
                Contact on WhatsApp
              </a>
            </div>

            {/* Reassurance row */}
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Quick response
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Trusted guidance
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" />
                Tailored to your needs
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
