import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import { recordActivity } from "@/lib/crm/activity";
import type { FollowUp, FollowUpPriority } from "@/types";

const PRIORITIES: readonly FollowUpPriority[] = ["low", "normal", "high", "urgent"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    const { data, error } = await ctx.supabase
      .from("follow_ups")
      .select("*")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
    }

    return NextResponse.json(data as FollowUp);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = ["title", "description", "due_date", "reminder_at", "status", "priority"];
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (
      "priority" in updates &&
      !(typeof updates.priority === "string" && (PRIORITIES as readonly string[]).includes(updates.priority))
    ) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }

    if (updates.status === "completed") {
      updates.completed_at = new Date().toISOString();
    } else if (updates.status && updates.status !== "completed") {
      updates.completed_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("follow_ups")
      .update(updates)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update follow-up:", error);
      return NextResponse.json({ error: "Failed to update follow-up" }, { status: 500 });
    }

    const updated = data as FollowUp;
    const occurredAt = new Date().toISOString();

    if (updates.status === "completed") {
      await recordActivity(ctx.supabase, {
        accountId: ctx.accountId,
        contactId: updated.contact_id,
        userId: ctx.userId,
        kind: "follow_up_completed",
        title: `Follow-up completed: ${updated.title}`,
        body: updated.description ?? null,
        status: "completed",
        externalId: `followup:${updated.id}:completed:${updated.completed_at ?? occurredAt}`,
        occurredAt: updated.completed_at ?? occurredAt,
        metadata: { followUpId: updated.id },
      });
    } else if (updates.status === "cancelled") {
      await recordActivity(ctx.supabase, {
        accountId: ctx.accountId,
        contactId: updated.contact_id,
        userId: ctx.userId,
        kind: "follow_up_cancelled",
        title: `Follow-up cancelled: ${updated.title}`,
        status: "cancelled",
        externalId: `followup:${updated.id}:cancelled:${occurredAt}`,
        occurredAt,
        metadata: { followUpId: updated.id },
      });
    } else if ("due_date" in updates) {
      await recordActivity(ctx.supabase, {
        accountId: ctx.accountId,
        contactId: updated.contact_id,
        userId: ctx.userId,
        kind: "follow_up_rescheduled",
        title: `Follow-up rescheduled: ${updated.title}`,
        status: updated.priority ?? "normal",
        externalId: `followup:${updated.id}:rescheduled:${occurredAt}`,
        occurredAt,
        metadata: { followUpId: updated.id, dueDate: updated.due_date },
      });
    }

    return NextResponse.json(updated);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    const { error } = await ctx.supabase
      .from("follow_ups")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId);

    if (error) {
      console.error("Failed to delete follow-up:", error);
      return NextResponse.json({ error: "Failed to delete follow-up" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
