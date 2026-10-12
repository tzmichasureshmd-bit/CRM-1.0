import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 100;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/**
 * GET /api/crm/follow-ups
 *
 * The Follow-up Center feed: account-scoped follow-ups with their
 * contact embedded, optionally filtered by status, priority and due
 * bucket, and searchable by customer name/phone.
 *
 * Query params:
 *   status   — 'pending' (default) | 'completed' | 'cancelled' | 'all'
 *   priority — low | normal | high | urgent
 *   bucket   — 'overdue' | 'today' | 'upcoming'
 *   search   — customer name / phone substring
 *   limit    — page size (default 100, max 200)
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status") ?? "pending";
    const priority = searchParams.get("priority");
    const bucket = searchParams.get("bucket");
    const search = searchParams.get("search")?.trim();
    const limitRaw = Number(searchParams.get("limit"));
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(1, Math.floor(limitRaw)), MAX_LIMIT)
      : DEFAULT_LIMIT;

    let query = ctx.supabase
      .from("follow_ups")
      .select("*, contact:contacts(id, name, phone, email, lead_status)")
      .eq("account_id", ctx.accountId)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") query = query.eq("status", status);
    if (priority && (PRIORITIES as readonly string[]).includes(priority)) {
      query = query.eq("priority", priority);
    }

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    if (bucket === "overdue") {
      query = query.not("due_date", "is", null).lt("due_date", now.toISOString());
    } else if (bucket === "today") {
      query = query
        .gte("due_date", startOfToday.toISOString())
        .lt("due_date", endOfToday.toISOString());
    } else if (bucket === "upcoming") {
      query = query.gte("due_date", endOfToday.toISOString());
    }

    if (search) {
      const like = `%${search.replace(/[%,]/g, "")}%`;
      const { data: matches, error: matchErr } = await ctx.supabase
        .from("contacts")
        .select("id")
        .eq("account_id", ctx.accountId)
        .or(`name.ilike.${like},phone.ilike.${like}`)
        .limit(500);
      if (matchErr) {
        console.error("[crm/follow-ups] contact search failed:", matchErr);
        return NextResponse.json(
          { error: "Failed to search customers" },
          { status: 500 },
        );
      }
      const ids = (matches ?? []).map((row) => (row as { id: string }).id);
      if (ids.length === 0) return NextResponse.json({ items: [] });
      query = query.in("contact_id", ids);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[crm/follow-ups] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to load follow-ups" },
        { status: 500 },
      );
    }

    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}
