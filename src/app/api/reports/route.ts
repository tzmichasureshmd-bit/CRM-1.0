import { createClient } from "@/lib/supabase/client";
import { NextResponse } from "next/server";

type ReportType = "leads" | "customers" | "conversations" | "sales" | "employees" | "daily" | "monthly";

interface ReportRow {
  [key: string]: unknown;
}

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
    const type = (searchParams.get("type") || "daily") as ReportType;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (!profile?.account_id) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    const accountId = profile.account_id;
    let rows: ReportRow[] = [];

    switch (type) {
      case "leads": {
        const { data } = await supabase
          .from("contacts")
          .select("id, name, phone, email, company, lead_status, created_at")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false });
        rows = (data ?? []).map((c) => ({
          ID: c.id,
          Name: c.name ?? "",
          Phone: c.phone,
          Email: c.email ?? "",
          Company: c.company ?? "",
          "Lead Status": c.lead_status ?? "new",
          "Created At": c.created_at,
        }));
        break;
      }
      case "customers": {
        const { data } = await supabase
          .from("contacts")
          .select("id, name, phone, email, company, created_at, contact_tags(tags(name, color))")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false });
        rows = (data ?? []).map((c) => ({
          ID: c.id,
          Name: c.name ?? "",
          Phone: c.phone,
          Email: c.email ?? "",
          Company: c.company ?? "",
          Tags: ((c as unknown as { contact_tags?: { tags?: { name?: string }[] }[] }).contact_tags ?? [])
            .map((ct) => ct.tags?.map((t) => t.name).filter(Boolean).join(", "))
            .filter(Boolean)
            .join(", ") ?? "",
          "Created At": c.created_at,
        }));
        break;
      }
      case "conversations": {
        const { data } = await supabase
          .from("conversations")
          .select("id, status, last_message_text, last_message_at, unread_count, contact:contacts(name, phone), assigned_agent_id")
          .eq("account_id", accountId)
          .order("last_message_at", { ascending: false });
        rows = (data ?? []).map((c) => {
          const conv = c as { contact?: { name: string | null; phone: string }[] | null; assigned_agent_id?: string | null };
          const contact = Array.isArray(conv.contact) ? conv.contact[0] : conv.contact;
          return {
            ID: c.id,
            Contact: contact?.name || contact?.phone || "Unknown",
            Status: c.status,
            "Last Message": c.last_message_text ?? "",
            "Last Message At": c.last_message_at ?? "",
            "Unread Count": c.unread_count,
            "Assigned Agent ID": conv.assigned_agent_id ?? "",
          };
        });
        break;
      }
      case "sales": {
        const { data } = await supabase
          .from("deals")
          .select("id, title, value, currency, status, created_at, stage:pipeline_stages(name, color), contact:contacts(name, phone)")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false });
        rows = (data ?? []).map((d) => {
          const deal = d as { stage?: { name: string }[] | null; contact?: { name: string | null; phone: string }[] | null };
          const stage = Array.isArray(deal.stage) ? deal.stage[0] : deal.stage;
          const contact = Array.isArray(deal.contact) ? deal.contact[0] : deal.contact;
          return {
            ID: d.id,
            Title: d.title,
            Value: `${d.currency ?? "$"}${(d.value ?? 0).toLocaleString()}`,
            Status: d.status ?? "active",
            Stage: stage?.name ?? "",
            Contact: contact?.name || contact?.phone || "Unknown",
            "Created At": d.created_at,
          };
        });
        break;
      }
      case "employees": {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name, email, account_role, created_at")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false });
        rows = (data ?? []).map((p) => ({
          ID: p.id,
          Name: p.full_name,
          Email: p.email,
          Role: p.account_role ?? "",
          "Created At": p.created_at,
        }));
        break;
      }
      case "daily":
      case "monthly": {
        const days = type === "monthly" ? 30 : 1;
        const startDate = from ? new Date(from) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        const [conversations, messages, contacts, deals] = await Promise.all([
          supabase.from("conversations").select("id, status, created_at").eq("account_id", accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
          supabase.from("messages").select("id, sender_type, content_type, created_at").eq("conversations.account_id", accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
          supabase.from("contacts").select("id, created_at").eq("account_id", accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
          supabase.from("deals").select("id, value, status, created_at").eq("account_id", accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        ]);

        const messageCount = (messages.data ?? []).length;
        const conversationCount = (conversations.data ?? []).length;
        const contactCount = (contacts.data ?? []).length;
        const dealValue = (deals.data ?? []).reduce((sum, d) => sum + (d.value ?? 0), 0);

        rows = [
          { Metric: "New Conversations", Value: conversationCount },
          { Metric: "New Messages", Value: messageCount },
          { Metric: "New Contacts", Value: contactCount },
          { Metric: "Deal Value", Value: dealValue },
          { Metric: "Period", Value: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}` },
        ];
        break;
      }
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    return NextResponse.json({ type, rows, count: rows.length });
  } catch (err) {
    console.error("Reports GET error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
