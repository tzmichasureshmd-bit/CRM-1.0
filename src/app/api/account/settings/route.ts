import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

type SettingsType = "company" | "email" | "notifications";

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "company") as SettingsType;

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!profile?.account_id) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const accountId = profile.account_id;

    switch (type) {
      case "company": {
        const { data } = await supabase
          .from("accounts")
          .select("id, name, address, phone, website, industry")
          .eq("id", accountId)
          .single();
        return NextResponse.json({ data: data ?? null });
      }
      case "email": {
        const { data } = await supabase
          .from("email_config")
          .select("*")
          .eq("account_id", accountId)
          .maybeSingle();
        return NextResponse.json({ data: data ?? null });
      }
      case "notifications": {
        const { data } = await supabase
          .from("notification_preferences")
          .select("*")
          .eq("account_id", accountId)
          .eq("user_id", session.user.id)
          .maybeSingle();
        return NextResponse.json({ data: data ?? null });
      }
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (err) {
    console.error("Settings GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "company") as SettingsType;

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id, account_role")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!profile?.account_id) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const accountId = profile.account_id;
    const body = await request.json();

    switch (type) {
      case "company": {
        const { data } = await supabase
          .from("accounts")
          .update({
            name: body.name,
            address: body.address,
            phone: body.phone,
            website: body.website,
            industry: body.industry,
            updated_at: new Date().toISOString(),
          })
          .eq("id", accountId)
          .select("id, name, address, phone, website, industry")
          .single();
        return NextResponse.json({ data: data ?? null });
      }
      case "email": {
        const { data } = await supabase
          .from("email_config")
          .upsert({
            account_id: accountId,
            provider: body.provider ?? "smtp",
            smtp_host: body.smtp_host,
            smtp_port: body.smtp_port,
            smtp_username: body.smtp_username,
            smtp_password: body.smtp_password,
            smtp_secure: body.smtp_secure ?? true,
            from_email: body.from_email ?? "",
            from_name: body.from_name ?? "",
            enabled: body.enabled ?? false,
            updated_at: new Date().toISOString(),
          })
          .select("*")
          .single();
        return NextResponse.json({ data: data ?? null });
      }
      case "notifications": {
        const { data } = await supabase
          .from("notification_preferences")
          .upsert({
            account_id: accountId,
            user_id: session.user.id,
            email_messages: body.email_messages ?? true,
            email_broadcasts: body.email_broadcasts ?? true,
            email_automations: body.email_automations ?? true,
            email_deals: body.email_deals ?? true,
            push_messages: body.push_messages ?? true,
            push_broadcasts: body.push_broadcasts ?? true,
            push_automations: body.push_automations ?? true,
            push_deals: body.push_deals ?? true,
            updated_at: new Date().toISOString(),
          })
          .select("*")
          .single();
        return NextResponse.json({ data: data ?? null });
      }
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  } catch (err) {
    console.error("Settings PATCH error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
