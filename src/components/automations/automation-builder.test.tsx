// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NextIntlClientProvider } from "next-intl"
import "@testing-library/jest-dom/vitest"
import en from "../../../messages/en.json"

const replaceMock = vi.fn()
const pushMock = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), message: vi.fn() },
}))

vi.mock("@/lib/supabase/client", () => {
  const empty = () =>
    Promise.resolve({
      data: [],
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    })
  const order = () => empty()
  const eq = () => ({ order })
  const select = () => ({ order, eq })
  return {
    createClient: () => ({
      from: () => ({ select }),
    }),
  }
})

import { AutomationBuilder } from "./automation-builder"

const baseInitial = {
  id: undefined,
  name: "",
  description: "",
  trigger_type: "new_message_received" as const,
  trigger_config: {},
  is_active: false,
  steps: [],
}

const STEP_LABELS = [
  "Send Message",
  "Send Buttons",
  "Send List",
  "Send Template",
  "Add Tag",
  "Remove Tag",
  "Assign Conversation",
  "Update Contact Field",
  "Create Deal",
  "Wait",
  "Condition (If/Else)",
  "Send Webhook",
  "Close Conversation",
]

function renderBuilder() {
  return render(
    <NextIntlClientProvider locale="en" messages={en}>
      <AutomationBuilder initial={baseInitial} />
    </NextIntlClientProvider>,
  )
}

describe("automation builder add-step menu", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ members: [] }),
      })),
    )
  })

  it("clicking + opens the step menu and inserting a step renders its editor", async () => {
    const user = userEvent.setup()
    renderBuilder()

    const addButtons = await screen.findAllByRole("button", { name: "Add step" })
    expect(addButtons.length).toBeGreaterThan(0)

    await user.click(addButtons[0])

    const menu = await screen.findByRole("menu")
    for (const label of STEP_LABELS) {
      expect(within(menu).getByText(label)).toBeInTheDocument()
    }

    await user.click(within(menu).getByText("Send Message"))

    expect(
      await screen.findByPlaceholderText("Hi! Thanks for reaching out…"),
    ).toBeInTheDocument()
  })
})