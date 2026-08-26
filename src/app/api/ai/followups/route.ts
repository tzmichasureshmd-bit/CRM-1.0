import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const contactId = searchParams.get("contact_id");

    let query = ctx.supabase
      .from("ai_followups")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    if (contactId) {
      query = query.eq("contact_id", contactId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch AI follow-ups:", error);
      return NextResponse.json({ error: "Failed to fetch AI follow-ups" }, { status: 500 });
    }

    return NextResponse.json({ followups: data ?? [] });
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

    const { contact_id, name, sequence, config } = body;

    if (!contact_id || typeof contact_id !== "string") {
      return NextResponse.json({ error: "contact_id is required" }, { status: 400 });
    }

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("ai_followups")
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        contact_id,
        name: name.trim(),
        sequence: sequence ?? [],
        config: config ?? {},
        status: "draft",
      })
      .select("*")
      .single();

    if (error) {
      console.error("Failed to create AI follow-up:", error);
      return NextResponse.json({ error: "Failed to create AI follow-up" }, { status: 500 });
    }

    return NextResponse.json({ followup: data }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
