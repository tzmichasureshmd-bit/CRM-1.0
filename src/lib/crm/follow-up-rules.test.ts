import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  shiftToBusinessHours,
  computeDueDate,
  ruleTaskTitle,
  zonedTimeToUtc,
  applyOutboundRules,
  cancelRulesOnReply,
} from "./follow-up-rules";
import type { FollowUpRule } from "@/types";

const WEEKDAY_RULE = {
  business_hours_only: true,
  business_start_hour: 9,
  business_end_hour: 18,
  business_days: [1, 2, 3, 4, 5],
  timezone: "UTC",
} as const;

describe("zonedTimeToUtc", () => {
  it("converts a UTC wall-clock time to itself", () => {
    const d = zonedTimeToUtc(2024, 1, 8, 9, 0, "UTC");
    expect(d.toISOString()).toBe("2024-01-08T09:00:00.000Z");
  });

  it("respects a fixed positive offset", () => {
    const d = zonedTimeToUtc(2024, 1, 8, 9, 0, "Asia/Seoul"); // UTC+9
    expect(d.toISOString()).toBe("2024-01-08T00:00:00.000Z");
  });
});

describe("shiftToBusinessHours", () => {
  it("leaves non-business-hours rules untouched", () => {
    const d = new Date("2024-01-06T12:00:00Z"); // Saturday
    expect(
      shiftToBusinessHours(d, { ...WEEKDAY_RULE, business_hours_only: false }),
    ).toBe(d);
  });

  it("leaves an in-window instant unchanged", () => {
    const d = new Date("2024-01-08T10:30:00Z"); // Monday 10:30
    expect(shiftToBusinessHours(d, WEEKDAY_RULE).toISOString()).toBe(
      "2024-01-08T10:30:00.000Z",
    );
  });

  it("shifts an early same-day instant to the window start", () => {
    const d = new Date("2024-01-08T07:00:00Z"); // Monday 07:00
    expect(shiftToBusinessHours(d, WEEKDAY_RULE).toISOString()).toBe(
      "2024-01-08T09:00:00.000Z",
    );
  });

  it("pushes a weekend instant to Monday morning", () => {
    const d = new Date("2024-01-06T12:00:00Z"); // Saturday
    expect(shiftToBusinessHours(d, WEEKDAY_RULE).toISOString()).toBe(
      "2024-01-08T09:00:00.000Z",
    );
  });

  it("pushes an after-hours Friday instant to Monday morning", () => {
    const d = new Date("2024-01-05T19:00:00Z"); // Friday 19:00
    expect(shiftToBusinessHours(d, WEEKDAY_RULE).toISOString()).toBe(
      "2024-01-08T09:00:00.000Z",
    );
  });
});

describe("computeDueDate", () => {
  it("adds the delay when business hours are unrestricted", () => {
    const due = computeDueDate("2024-01-08T10:00:00Z", {
      delay_minutes: 60,
      business_hours_only: false,
      business_start_hour: 9,
      business_end_hour: 18,
      business_days: [1, 2, 3, 4, 5],
      timezone: "UTC",
    });
    expect(due.toISOString()).toBe("2024-01-08T11:00:00.000Z");
  });

  it("lands inside business hours when enabled", () => {
    const due = computeDueDate("2024-01-05T17:30:00Z", {
      delay_minutes: 60, // -> Fri 18:30, outside window
      ...WEEKDAY_RULE,
    });
    expect(due.toISOString()).toBe("2024-01-08T09:00:00.000Z");
  });
});

describe("ruleTaskTitle", () => {
  it("formats day/hour/minute delays and the after_outbound variant", () => {
    expect(ruleTaskTitle({ trigger: "no_reply", delay_minutes: 1440 }, "Alice")).toBe(
      "Follow up with Alice if no reply within 1 day",
    );
    expect(ruleTaskTitle({ trigger: "no_reply", delay_minutes: 2880 }, "Bob")).toBe(
      "Follow up with Bob if no reply within 2 days",
    );
    expect(ruleTaskTitle({ trigger: "no_reply", delay_minutes: 120 }, "Cara")).toBe(
      "Follow up with Cara if no reply within 2 hours",
    );
    expect(ruleTaskTitle({ trigger: "no_reply", delay_minutes: 30 }, "Dan")).toBe(
      "Follow up with Dan if no reply within 30 minutes",
    );
    expect(ruleTaskTitle({ trigger: "after_outbound", delay_minutes: 60 }, "Eve")).toBe(
      "Follow up with Eve",
    );
  });

  it("falls back to a generic customer name", () => {
    expect(ruleTaskTitle({ trigger: "after_outbound", delay_minutes: 60 }, null)).toBe(
      "Follow up with customer",
    );
  });
});

// ---------------------------------------------------------------
// Rule engine (mock Supabase client)
// ---------------------------------------------------------------

interface MockState {
  table: string;
  op: "select" | "insert" | "update";
  payload?: Record<string, unknown>;
}

function makeMockDb(resolve: (state: MockState) => { data: unknown; error: unknown }) {
  return {
    from(table: string) {
      const state: MockState = { table, op: "select" };
      const builder: Record<string, unknown> = {};
      const pass = () => builder;
      Object.assign(builder, {
        select: pass,
        eq: pass,
        in: pass,
        limit: pass,
        order: pass,
        insert: (payload: Record<string, unknown>) => {
          state.op = "insert";
          state.payload = payload;
          return builder;
        },
        update: (payload: Record<string, unknown>) => {
          state.op = "update";
          state.payload = payload;
          return builder;
        },
        maybeSingle: () => Promise.resolve(resolve(state)),
        single: () => Promise.resolve(resolve(state)),
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
          Promise.resolve(resolve(state)).then(onFulfilled, onRejected),
      });
      return builder;
    },
  } as unknown as SupabaseClient;
}

const BASE_RULE: FollowUpRule = {
  id: "rule-1",
  account_id: "acct-1",
  name: "No reply after 24h",
  trigger: "no_reply",
  delay_minutes: 1440,
  priority: "high",
  business_hours_only: false,
  business_start_hour: 9,
  business_end_hour: 18,
  business_days: [1, 2, 3, 4, 5],
  timezone: "UTC",
  assign_to: "owner",
  enabled: true,
  created_by: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
};

function outboundContext() {
  return {
    accountId: "acct-1",
    contactId: "contact-1",
    conversationId: "conv-1",
    occurredAt: "2024-01-08T10:00:00Z",
    contactName: "Alice",
    contactOwnerId: "owner-1",
    conversationAssigneeId: null,
  };
}

describe("applyOutboundRules", () => {
  it("creates one pending follow-up from an enabled rule", async () => {
    const resolve = vi.fn((state: MockState) => {
      if (state.table === "follow_up_rules") return { data: [BASE_RULE], error: null };
      if (state.table === "follow_ups" && state.op === "insert") {
        return { data: { id: "fu-1", ...state.payload }, error: null };
      }
      return { data: null, error: null }; // no existing pending
    });
    const created = await applyOutboundRules(makeMockDb(resolve), outboundContext());

    expect(created).toHaveLength(1);
    expect(created[0].id).toBe("fu-1");
    expect(resolve).toHaveBeenCalled();
  });

  it("dedupes when a pending follow-up already exists for the rule", async () => {
    const resolve = vi.fn((state: MockState) => {
      if (state.table === "follow_up_rules") return { data: [BASE_RULE], error: null };
      if (state.table === "follow_ups" && state.op !== "insert") {
        return { data: { id: "existing" }, error: null };
      }
      return { data: { id: "fu-new", ...state.payload }, error: null };
    });
    const created = await applyOutboundRules(makeMockDb(resolve), outboundContext());
    expect(created).toHaveLength(0);
  });

  it("does nothing when there are no enabled rules", async () => {
    const resolve = vi.fn(() => ({ data: [], error: null }));
    const created = await applyOutboundRules(makeMockDb(resolve), outboundContext());
    expect(created).toHaveLength(0);
  });

  it("skips a rule when the contact has no owner", async () => {
    const resolve = vi.fn((state: MockState) => {
      if (state.table === "follow_up_rules") return { data: [BASE_RULE], error: null };
      return { data: null, error: null };
    });
    const created = await applyOutboundRules(makeMockDb(resolve), {
      ...outboundContext(),
      contactOwnerId: null,
    });
    expect(created).toHaveLength(0);
  });
});

describe("cancelRulesOnReply", () => {
  it("returns the rows that were cancelled", async () => {
    const resolve = vi.fn((state: MockState) => {
      if (state.table === "follow_ups" && state.op === "update") {
        return { data: [{ id: "fu-1", status: "cancelled" }], error: null };
      }
      return { data: null, error: null };
    });
    const cancelled = await cancelRulesOnReply(makeMockDb(resolve), {
      accountId: "acct-1",
      contactId: "contact-1",
    });
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].status).toBe("cancelled");
  });

  it("returns an empty list on error", async () => {
    const resolve = vi.fn(() => ({ data: null, error: { message: "boom" } }));
    const cancelled = await cancelRulesOnReply(makeMockDb(resolve), {
      accountId: "acct-1",
      contactId: "contact-1",
    });
    expect(cancelled).toHaveLength(0);
  });
});
