import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { DEFAULT_FOLLOW_UP_RULE } from "@/lib/crm/follow-up-rules";

const TRIGGERS = ["no_reply", "after_outbound"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const ASSIGN = ["owner", "conversation_assignee", "unassigned"] as const;

type RuleInput = Record<string, unknown>;

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Normalise a rules payload. Returns either a partial field map or an
 * error string. Unknown fields are ignored; every value is validated
 * against the same constraints as the database.
 */
function buildRuleFields(
  body: RuleInput,
  { requireName }: { requireName: boolean },
): { fields: RuleInput } | { error: string } {
  const fields: RuleInput = {};

  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return { error: "Rule name is required" };
    fields.name = name;
  } else if (requireName) {
    return { error: "Rule name is required" };
  }

  if ("trigger" in body) {
    if (
      typeof body.trigger !== "string" ||
      !(TRIGGERS as readonly string[]).includes(body.trigger)
    ) {
      return { error: "Invalid trigger" };
    }
    fields.trigger = body.trigger;
  }

  if ("delay_minutes" in body) {
    const delay = Number(body.delay_minutes);
    if (!Number.isFinite(delay) || delay < 5) {
      return { error: "Delay must be at least 5 minutes" };
    }
    fields.delay_minutes = Math.floor(delay);
  }

  if ("priority" in body) {
    if (
      typeof body.priority !== "string" ||
      !(PRIORITIES as readonly string[]).includes(body.priority)
    ) {
      return { error: "Invalid priority" };
    }
    fields.priority = body.priority;
  }

  if ("assign_to" in body) {
    if (
      typeof body.assign_to !== "string" ||
      !(ASSIGN as readonly string[]).includes(body.assign_to)
    ) {
      return { error: "Invalid assignee" };
    }
    fields.assign_to = body.assign_to;
  }

  if ("business_hours_only" in body) {
    fields.business_hours_only = Boolean(body.business_hours_only);
  }
  if ("enabled" in body) {
    fields.enabled = Boolean(body.enabled);
  }

  const startHour = "business_start_hour" in body ? Number(body.business_start_hour) : undefined;
  const endHour = "business_end_hour" in body ? Number(body.business_end_hour) : undefined;
  if (startHour !== undefined) {
    if (!Number.isInteger(startHour) || startHour < 0 || startHour > 23) {
      return { error: "Business start hour must be 0–23" };
    }
    fields.business_start_hour = startHour;
  }
  if (endHour !== undefined) {
    if (!Number.isInteger(endHour) || endHour < 1 || endHour > 24) {
      return { error: "Business end hour must be 1–24" };
    }
    fields.business_end_hour = endHour;
  }

  if ("business_days" in body) {
    const days = body.business_days;
    if (
      !Array.isArray(days) ||
      days.length === 0 ||
      !days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
    ) {
      return { error: "Business days must be a non-empty list of 0–6" };
    }
    fields.business_days = days;
  }

  if ("timezone" in body) {
    const tz = typeof body.timezone === "string" ? body.timezone.trim() : "";
    if (!tz || !isValidTimezone(tz)) {
      return { error: "Invalid timezone" };
    }
    fields.timezone = tz;
  }

  return { fields };
}

export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const { data, error } = await ctx.supabase
      .from("follow_up_rules")
      .select("*")
      .eq("account_id", ctx.accountId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[crm/rules] fetch failed:", error);
      return NextResponse.json(
        { error: "Failed to load rules" },
        { status: 500 },
      );
    }
    return NextResponse.json({ items: data ?? [] });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = (await request.json().catch(() => null)) as RuleInput | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const built = buildRuleFields(body, { requireName: true });
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("follow_up_rules")
      .insert({
        ...DEFAULT_FOLLOW_UP_RULE,
        ...built.fields,
        account_id: ctx.accountId,
        created_by: ctx.userId,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[crm/rules] insert failed:", error);
      return NextResponse.json({ error: "Failed to create rule" }, { status: 500 });
    }
    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const body = (await request.json().catch(() => null)) as RuleInput | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const id = typeof body.id === "string" ? body.id : null;
    if (!id) {
      return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
    }

    const built = buildRuleFields(body, { requireName: false });
    if ("error" in built) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }
    if (Object.keys(built.fields).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data, error } = await ctx.supabase
      .from("follow_up_rules")
      .update(built.fields)
      .eq("id", id)
      .eq("account_id", ctx.accountId)
      .select("*")
      .single();

    if (error) {
      console.error("[crm/rules] update failed:", error);
      return NextResponse.json({ error: "Failed to update rule" }, { status: 500 });
    }
    return NextResponse.json(data);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await requireRole("admin");
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Rule id is required" }, { status: 400 });
    }

    const { error } = await ctx.supabase
      .from("follow_up_rules")
      .delete()
      .eq("id", id)
      .eq("account_id", ctx.accountId);

    if (error) {
      console.error("[crm/rules] delete failed:", error);
      return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
