import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  channelLabel,
  recordActivity,
  onOutboundMessage,
  onInboundMessage,
} from "./activity";

interface MockState {
  table: string;
  op: "select" | "insert" | "update" | "upsert";
  payload?: Record<string, unknown>;
}

function makeMockDb(resolve: (state: MockState) => { data: unknown; error: unknown }) {
  const calls: MockState[] = [];
  const db = {
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
        upsert: (payload: Record<string, unknown>) => {
          state.op = "upsert";
          state.payload = payload;
          return builder;
        },
        maybeSingle: () => {
          calls.push({ ...state });
          return Promise.resolve(resolve(state));
        },
        single: () => {
          calls.push({ ...state });
          return Promise.resolve(resolve(state));
        },
        then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
          calls.push({ ...state });
          return Promise.resolve(resolve(state)).then(onFulfilled, onRejected);
        },
      });
      return builder;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe("channelLabel", () => {
  it("maps known channels and falls back sensibly", () => {
    expect(channelLabel("whatsapp")).toBe("WhatsApp");
    expect(channelLabel("INSTAGRAM")).toBe("Instagram");
    expect(channelLabel("telegram")).toBe("Telegram");
    expect(channelLabel(null)).toBe("Unknown");
    expect(channelLabel("carrier-pigeon")).toBe("carrier-pigeon");
  });
});

describe("recordActivity", () => {
  it("upserts idempotently and returns the stored row", async () => {
    const { db, calls } = makeMockDb(() => ({
      data: [{ id: "act-1" }],
      error: null,
    }));
    const row = await recordActivity(db, {
      accountId: "acct-1",
      contactId: "contact-1",
      kind: "note",
      title: "Hello",
      externalId: "note:1",
    });
    expect(row).toEqual({ id: "act-1" });
    expect(calls[0].op).toBe("upsert");
    expect(calls[0].payload).toMatchObject({
      account_id: "acct-1",
      contact_id: "contact-1",
      kind: "note",
      external_id: "note:1",
    });
  });

  it("never throws — returns null on a database error", async () => {
    const { db } = makeMockDb(() => ({ data: null, error: { message: "boom" } }));
    const row = await recordActivity(db, {
      accountId: "acct-1",
      contactId: "contact-1",
      kind: "note",
    });
    expect(row).toBeNull();
  });
});

const OCCURRED = "2024-01-08T10:00:00Z";

describe("onOutboundMessage", () => {
  it("records the send, updates last_contacted_at and applies rules", async () => {
    const insertedRules: Record<string, unknown>[] = [];
    const { db, calls } = makeMockDb((state) => {
      if (state.table === "contacts" && state.op === "select") {
        return { data: { user_id: "owner-1", name: "Alice" }, error: null };
      }
      if (state.table === "conversations") {
        return { data: { platform: "whatsapp", assigned_agent_id: null }, error: null };
      }
      if (state.table === "follow_up_rules") {
        return {
          data: [
            {
              id: "rule-1",
              account_id: "acct-1",
              name: "No reply",
              trigger: "no_reply",
              delay_minutes: 60,
              priority: "normal",
              business_hours_only: false,
              business_start_hour: 9,
              business_end_hour: 18,
              business_days: [1, 2, 3, 4, 5],
              timezone: "UTC",
              assign_to: "owner",
              enabled: true,
            },
          ],
          error: null,
        };
      }
      if (state.table === "follow_ups" && state.op === "insert") {
        insertedRules.push(state.payload ?? {});
        return { data: { id: "fu-1", ...state.payload }, error: null };
      }
      if (state.table === "follow_ups") return { data: null, error: null };
      return { data: [{ id: "act" }], error: null };
    });

    await onOutboundMessage(db, {
      accountId: "acct-1",
      contactId: "contact-1",
      conversationId: "conv-1",
      messageId: "msg-1",
      providerMessageId: "wamid.1",
      body: "Hi there",
      occurredAt: OCCURRED,
    });

    const contactUpdate = calls.find(
      (c) => c.table === "contacts" && c.op === "update",
    );
    expect(contactUpdate?.payload).toMatchObject({ last_contacted_at: OCCURRED });

    const activityUpserts = calls.filter(
      (c) => c.table === "customer_activities" && c.op === "upsert",
    );
    expect(activityUpserts[0].payload).toMatchObject({
      kind: "message_sent",
      direction: "outbound",
      external_id: "msg:wamid.1",
      channel: "whatsapp",
    });
    expect(insertedRules).toHaveLength(1);
    expect(insertedRules[0]).toMatchObject({ source: "rule", rule_id: "rule-1" });
  });
});

describe("onInboundMessage", () => {
  it("records the receive and cancels pending rule follow-ups", async () => {
    const { db, calls } = makeMockDb((state) => {
      if (state.table === "contacts") {
        return { data: { user_id: "owner-1", name: "Alice" }, error: null };
      }
      if (state.table === "conversations") {
        return { data: { platform: "instagram", assigned_agent_id: null }, error: null };
      }
      if (state.table === "follow_ups" && state.op === "update") {
        return { data: [{ id: "fu-1", status: "cancelled", title: "Follow up" }], error: null };
      }
      return { data: [{ id: "act" }], error: null };
    });

    await onInboundMessage(db, {
      accountId: "acct-1",
      contactId: "contact-1",
      conversationId: "conv-1",
      providerMessageId: "mid.1",
      body: "Hello back",
      occurredAt: OCCURRED,
    });

    const receive = calls.find(
      (c) =>
        c.table === "customer_activities" &&
        c.op === "upsert" &&
        (c.payload as { kind?: string })?.kind === "message_received",
    );
    expect(receive?.payload).toMatchObject({
      direction: "inbound",
      channel: "instagram",
      external_id: "msg:mid.1",
    });

    const cancelCall = calls.find(
      (c) => c.table === "follow_ups" && c.op === "update",
    );
    expect(cancelCall?.payload).toMatchObject({ status: "cancelled" });
  });
});
