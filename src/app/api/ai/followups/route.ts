import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

/**
 * GET /api/ai/followups  (agent+)
 *
 * Lists AI follow-ups for the account. Optionally filter by status.
 * Note: `ai_followups` is the configuration/recipe, not per-contact
 * executions. There is no contact_id on this table (see migration 051).
 */
export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = ctx.supabase
      .from("ai_followups")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
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

/**
 * POST /api/ai/followups  (agent+)
 *
 * Creates a new AI follow-up recipe. The body matches the real
 * ai_followups schema (migration 051). Executions are created
 * separately via the manual-run endpoint or the scheduler.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const {
      name,
      description,
      trigger_type,
      trigger_config,
      max_followups,
      delay_hours,
      working_hours_only,
      working_hours_start,
      working_hours_end,
      stop_on_reply,
      stop_on_opt_out,
      ai_provider,
      ai_model,
      ai_system_prompt,
      ai_temperature,
      ai_max_tokens,
      template_id,
      use_template,
    } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    const TRIGGER_TYPES = ['manual','new_contact','tag_added','deal_created','no_response','keyword','webhook','scheduled'];
    if (trigger_type && !TRIGGER_TYPES.includes(trigger_type as string)) {
      return NextResponse.json({ error: `Invalid trigger_type. Must be one of: ${TRIGGER_TYPES.join(', ')}` }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("ai_followups")
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        name: name.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        trigger_type: typeof trigger_type === "string" ? trigger_type : "manual",
        trigger_config: typeof trigger_config === "object" && trigger_config !== null ? trigger_config : {},
        max_followups: typeof max_followups === "number" ? max_followups : 3,
        delay_hours: typeof delay_hours === "number" ? delay_hours : 24,
        working_hours_only: typeof working_hours_only === "boolean" ? working_hours_only : false,
        working_hours_start: typeof working_hours_start === "string" ? working_hours_start : "09:00",
        working_hours_end: typeof working_hours_end === "string" ? working_hours_end : "18:00",
        stop_on_reply: typeof stop_on_reply === "boolean" ? stop_on_reply : true,
        stop_on_opt_out: typeof stop_on_opt_out === "boolean" ? stop_on_opt_out : true,
        ai_provider: typeof ai_provider === "string" ? ai_provider : null,
        ai_model: typeof ai_model === "string" ? ai_model : null,
        ai_system_prompt: typeof ai_system_prompt === "string" ? ai_system_prompt.trim() || null : null,
        ai_temperature: typeof ai_temperature === "number" ? ai_temperature : 0.7,
        ai_max_tokens: typeof ai_max_tokens === "number" ? ai_max_tokens : 500,
        template_id: typeof template_id === "string" ? template_id : null,
        use_template: typeof use_template === "boolean" ? use_template : false,
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
