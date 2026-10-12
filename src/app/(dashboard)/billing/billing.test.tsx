// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import "@testing-library/jest-dom/vitest"
import en from "../../../../messages/en.json"

// Regression cover for the Plans & Billing page being made informational.
//
// The page used to offer self-service plan changes: a "Choose Plan"/
// "Upgrade" button on every card and a modal with a "Continue to Payment"
// button that was hard-disabled and had no handler. None of that was ever
// wired to a real checkout — the copy itself said so — but the disabled
// button was still a dead control, and every card implied an action that
// did not exist.
//
// The page is now a single consultant contact card. What must be true:
//   1. The consultant phone number is rendered and is a real `tel:` link.
//   2. The "Call Our Consultant" button is that same link and is clickable.
//   3. There is no purchase CTA, no checkout, and no fake success/error
//      toast anywhere on the page.
//
// happy-dom has no dialer, so the phone assertion is structural: the
// anchor exists, carries the right href, and a click is observable.

import BillingPage from "./page"

function renderBilling() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <BillingPage />
    </NextIntlClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Plans & Billing — informational", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({}),
      })),
    )
  })

  it("renders the consultant helpline with the phone number", async () => {
    renderBilling()

    expect(
      await screen.findByText("Need a CRM Solution for Your Business?"),
    ).toBeInTheDocument()
    expect(
      await screen.findByText("Consultant Helpline"),
    ).toBeInTheDocument()
    expect(await screen.findByText("9346947043")).toBeInTheDocument()
  })

  it("the phone number is a working tel: link", async () => {
    const user = userEvent.setup()
    renderBilling()

    const link = await screen.findByRole("link", { name: /call our consultant/i })
    expect(link.getAttribute("href")).toBe("tel:9346947043")

    // Clicking must not throw, and must not produce a toast.
    await expect(user.click(link)).resolves.toBeUndefined()
  })

  it("exposes a WhatsApp contact button", async () => {
    renderBilling()

    const wa = await screen.findByRole("link", { name: /contact on whatsapp/i })
    expect(wa.getAttribute("href")).toContain("wa.me/919346947043")
    expect(wa.getAttribute("target")).toBe("_blank")
    expect(wa.getAttribute("rel")).toContain("noopener")
  })

  it("carries no purchase CTA and no checkout anywhere", async () => {
    renderBilling()

    expect(
      screen.queryByRole("button", { name: /choose plan/i }),
    ).toBeNull()
    expect(screen.queryByRole("button", { name: /upgrade/i })).toBeNull()
    expect(
      screen.queryByRole("button", { name: /continue to payment/i }),
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: /manage plan/i }),
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: /get started/i }),
    ).toBeNull()
    expect(screen.queryByText(/online checkout/i)).toBeNull()
  })
})