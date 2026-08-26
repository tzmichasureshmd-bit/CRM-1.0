import { NextResponse, NextRequest } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    const { data, error } = await ctx.supabase
      .from("ai_followups")
      .select("*")
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "AI follow-up not found" }, { status: 404 });
    }

    return NextResponse.json({ followup: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = ["name", "sequence", "config", "status"];
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await ctx.supabase
      .from("ai_followups")
      .update(updates)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update AI follow-up:", error);
      return NextResponse.json({ error: "Failed to update AI follow-up" }, { status: 500 });
    }

    return NextResponse.json({ followup: data });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const ctx = await getCurrentAccount();
    const { id } = await params;

    await ctx.supabase
      .from("ai_followup_executions")
      .delete()
      .eq("followup_id", id);

    const { error } = await ctx.supabase
      .from("ai_followups")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId);

    if (error) {
      console.error("Failed to delete AI follow-up:", error);
      return NextResponse.json({ error: "Failed to delete AI follow-up" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
