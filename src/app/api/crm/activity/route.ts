import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { recordActivity, ACTIVITY_KINDS } from "@/lib/crm/activity";
import type { ActivityKind } from "@/types";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

/**
 * GET /api/crm/activity
 *
 * Paginated, account-scoped activity timeline, newest first, with the
 * related contact embedded so the UI can render it without N+1 fetches.
 *
 * Query params:
 *   contact_id — restrict to one customer
 *   kind       — filter by activity kind
 *   direction  — 'inbound' | 'outbound'
 *   limit      — page size (default 50, max 200)
 *   offset     — page offset
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const { searchParams } = new URL(request.url);

    const contactId = searchParams.get("contact_id");
    const kind = searchParams.get("kind");
    const direction = searchParams.get("direction");
    const limitRaw = Number(searchParams.get("limit"));
    const offsetRaw = Number(searchParams.get("offset"));

    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.floor(limitRaw)), MAX_LIMIT)
      : DEFAULT_LIMIT;
    const offset = Number.isFinite(offsetRaw)
      ? Math.max(0, Math.floor(offsetRaw))
      : 0;

    let query = ctx.supabase
      .from("customer_activities")
      .select("*, contact:contacts(id, name, phone, email, lead_status)", {
        count: "exact",
      })
      .eq("account_id", ctx.accountId)
      .order("occurred_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (contactId) query = query.eq("contact_id", contactId);
    if (kind && (ACTIVITY_KINDS as readonly string[]).includes(kind)) {
      query = query.eq("kind", kind);
    }
    if (direction === "inbound" || direction === "outbound") {
      query = query.eq("direction", direction);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[crm/activity] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to load activity" },
        { status: 500 },
      );
    }

    const items = data ?? [];
    return NextResponse.json({
      items,
      total: count ?? items.length,
      offset,
      limit,
      hasMore: (count ?? 0) > offset + items.length,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/**
 * POST /api/crm/activity
 *
 * Client-authored activity (manual notes / system events). Only the
 * non-message kinds are accepted here — message activity is recorded by
 * the send and webhook pipelines, never by the client.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const body = (await request.json().catch(() => null)) as
      | Record<string, unknown>
      | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const contactId =
      typeof body.contactId === "string"
        ? body.contactId
        : typeof body.contact_id === "string"
          ? body.contact_id
          : null;
    if (!contactId) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const allowed: ActivityKind[] = ["note", "system"];
    const kind =
      typeof body.kind === "string" &&
      (allowed as readonly string[]).includes(body.kind)
        ? (body.kind as ActivityKind)
        : "note";

    const title = typeof body.title === "string" ? body.title.trim() : null;
    const text = typeof body.body === "string" ? body.body.trim() : null;
    if (!title && !text) {
      return NextResponse.json(
        { error: "A title or body is required" },
        { status: 400 },
      );
    }

    const created = await recordActivity(ctx.supabase, {
      accountId: ctx.accountId,
      contactId,
      userId: ctx.userId,
      kind,
      title: title ?? (kind === "note" ? "Note" : "System event"),
      body: text,
      direction: null,
      channel: typeof body.channel === "string" ? body.channel : null,
      metadata: { manual: true },
    });

    if (!created) {
      return NextResponse.json(
        { error: "Failed to record activity" },
        { status: 500 },
      );
    }

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
