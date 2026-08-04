import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";
import type { FollowUp } from "@/types";

async function getAccountId(supabase: ReturnType<typeof createClient>, userId: string): Promise<string | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_id")
    .eq("user_id", userId)
    .maybeSingle();
  return profile?.account_id ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const accountId = await getAccountId(supabase, session.user.id);
    if (!accountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("follow_ups")
      .select("*")
      .eq("id", id)
      .eq("account_id", accountId)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Follow-up not found" }, { status: 404 });
    }

    return NextResponse.json(data as FollowUp);
  } catch (err) {
    console.error("Follow-up GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const accountId = await getAccountId(supabase, session.user.id);
    if (!accountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    const allowedFields = ["title", "description", "due_date", "reminder_at", "status"];
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (updates.status === "completed") {
      updates.completed_at = new Date().toISOString();
    } else if (updates.status && updates.status !== "completed") {
      updates.completed_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("follow_ups")
      .update(updates)
      .eq("id", id)
      .eq("account_id", accountId)
      .select("*")
      .single();

    if (error) {
      console.error("Failed to update follow-up:", error);
      return NextResponse.json({ error: "Failed to update follow-up" }, { status: 500 });
    }

    return NextResponse.json(data as FollowUp);
  } catch (err) {
    console.error("Follow-up PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const accountId = await getAccountId(supabase, session.user.id);
    if (!accountId) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("follow_ups")
      .delete()
      .eq("id", id)
      .eq("account_id", accountId);

    if (error) {
      console.error("Failed to delete follow-up:", error);
      return NextResponse.json({ error: "Failed to delete follow-up" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Follow-up DELETE error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
