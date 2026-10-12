import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { recordActivity } from "@/lib/crm/activity";
import type { FollowUp, FollowUpPriority } from "@/types";

const PRIORITIES: readonly FollowUpPriority[] = ["low", "normal", "high", "urgent"];

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contact_id");
    const status = searchParams.get("status");

    let query = ctx.supabase
      .from("follow_ups")
      .select("*")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .eq("account_id", ctx.accountId);

    if (contactId) {
      query = query.eq("contact_id", contactId);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch follow-ups:", error);
      return NextResponse.json({ error: "Failed to fetch follow-ups" }, { status: 500 });
    }

    return NextResponse.json((data ?? []) as FollowUp[]);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { contact_id, title, description, due_date, reminder_at, priority, reason } = body;

    if (!contact_id || !title || typeof title !== "string") {
      return NextResponse.json({ error: "contact_id and title are required" }, { status: 400 });
    }

    const safePriority =
      typeof priority === "string" && (PRIORITIES as readonly string[]).includes(priority)
        ? (priority as FollowUpPriority)
        : "normal";

    const { data, error } = await ctx.supabase
      .from("follow_ups")
      .insert({
        contact_id,
        account_id: ctx.accountId,
        user_id: ctx.userId,
        assigned_to: ctx.userId,
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        due_date: due_date || null,
        reminder_at: reminder_at || null,
        priority: safePriority,
        reason: typeof reason === "string" ? reason.trim() || null : null,
        source: "manual",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to create follow-up:", error);
      return NextResponse.json({ error: "Failed to create follow-up" }, { status: 500 });
    }

    const created = data as FollowUp;
    await recordActivity(ctx.supabase, {
      accountId: ctx.accountId,
      contactId: created.contact_id,
      userId: ctx.userId,
      kind: "follow_up_created",
      title: created.title,
      body: created.description ?? null,
      status: created.priority ?? "normal",
      externalId: `followup:${created.id}:created`,
      occurredAt: created.created_at,
      metadata: { followUpId: created.id, source: created.source, dueDate: created.due_date },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
