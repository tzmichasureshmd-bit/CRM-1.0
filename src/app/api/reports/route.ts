import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";

type ReportType = "leads" | "customers" | "conversations" | "sales" | "employees" | "agent-performance" | "daily" | "monthly";

interface ReportRow {
  [key: string]: unknown;
}

export async function GET(request: Request) {
  try {
    const ctx = await getCurrentAccount();

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get("type") || "daily") as ReportType;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let rows: ReportRow[] = [];

    switch (type) {
      case "leads": {
        const { data } = await ctx.supabase
          .from("contacts")
          .select("id, name, phone, email, company, lead_status, created_at")
          .eq("account_id", ctx.accountId)
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
        const { data } = await ctx.supabase
          .from("contacts")
          .select("id, name, phone, email, company, created_at, contact_tags(tags(name, color))")
          .eq("account_id", ctx.accountId)
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
        const { data } = await ctx.supabase
          .from("conversations")
          .select("id, status, last_message_text, last_message_at, unread_count, contact:contacts(name, phone), assigned_agent_id")
          .eq("account_id", ctx.accountId)
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
        const { data } = await ctx.supabase
          .from("deals")
          .select("id, title, value, currency, status, created_at, stage:pipeline_stages(name, color), contact:contacts(name, phone)")
          .eq("account_id", ctx.accountId)
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
        const { data } = await ctx.supabase
          .from("profiles")
          .select("id, full_name, email, account_role, created_at")
          .eq("account_id", ctx.accountId)
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
      case "agent-performance": {
        const startDate = from ? new Date(from) : null;
        const endDate = to ? new Date(to) : null;

        // All agent hits are scoped to the account. `messages` has no
        // account_id column, so the message queries filter through the
        // embedded `conversations.account_id` relation (PostgREST).
        const [profilesRes, convsRes, msgsRes, customerRes] = await Promise.all([
          ctx.supabase
            .from("profiles")
            .select("id, full_name, email, account_role")
            .eq("account_id", ctx.accountId)
            .order("full_name"),
          ctx.supabase
            .from("conversations")
            .select("id, assigned_agent_id, status")
            .eq("account_id", ctx.accountId),
          ctx.supabase
            .from("messages")
            .select("sender_id, sender_type, conversations(account_id)")
            .eq("sender_type", "agent")
            .eq("conversations.account_id", ctx.accountId)
            .gte("created_at", startDate ? startDate.toISOString() : "1970-01-01")
            .lte("created_at", endDate ? endDate.toISOString() : "2999-12-31"),
          ctx.supabase
            .from("messages")
            .select("id, conversations(account_id)")
            .eq("sender_type", "customer")
            .eq("conversations.account_id", ctx.accountId)
            .gte("created_at", startDate ? startDate.toISOString() : "1970-01-01")
            .lte("created_at", endDate ? endDate.toISOString() : "2999-12-31"),
        ]);

        const agents = (profilesRes.data ?? []) as Array<{
          id: string;
          full_name: string | null;
          email: string | null;
          account_role: string | null;
        }>;

        const byAgent = new Map<
          string,
          {
            name: string;
            email: string;
            role: string;
            assigned: number;
            open: number;
            replies: number;
          }
        >();
        for (const a of agents) {
          byAgent.set(a.id, {
            name: a.full_name || a.email || "Unknown",
            email: a.email ?? "",
            role: a.account_role ?? "",
            assigned: 0,
            open: 0,
            replies: 0,
          });
        }

        for (const c of (convsRes.data ?? []) as Array<{ assigned_agent_id: string | null; status: string | null }>) {
          const row = c.assigned_agent_id ? byAgent.get(c.assigned_agent_id) : null;
          if (!row) continue;
          row.assigned += 1;
          if (c.status !== "closed") row.open += 1;
        }

        // Unassigned conversations bucket (viewer/reporting visibility).
        const unassignedConvs = (convsRes.data ?? []).filter(
          (c) => !c.assigned_agent_id,
        ).length;
        const unassignedOpen = (convsRes.data ?? []).filter(
          (c) => !c.assigned_agent_id && c.status !== "closed",
        ).length;

        for (const m of (msgsRes.data ?? []) as Array<{ sender_id: string | null }>) {
          if (!m.sender_id) continue;
          const row = byAgent.get(m.sender_id);
          if (row) row.replies += 1;
        }

        const totalCustomerMsg = (customerRes.data ?? []).length;
        const totalReplies = (msgsRes.data ?? []).length;

        rows = Array.from(byAgent.values())
          .filter((r) => r.name !== "Unknown")
          .map((r) => ({
            Agent: r.name,
            Email: r.email,
            Role: r.role,
            "Assigned Conversations": r.assigned,
            "Open Conversations": r.open,
            "Replies Sent": r.replies,
            "Response Rate %":
              totalCustomerMsg === 0
                ? 0
                : Math.round((totalReplies / totalCustomerMsg) * 100),
          }));

        if (unassignedConvs > 0) {
          rows.push({
            Agent: "Unassigned",
            Email: "",
            Role: "",
            "Assigned Conversations": unassignedConvs,
            "Open Conversations": unassignedOpen,
            "Replies Sent": 0,
            "Response Rate %": 0,
          });
        }
        break;
      }
      case "daily":
      case "monthly": {
        const days = type === "monthly" ? 30 : 1;
        const startDate = from ? new Date(from) : new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const endDate = to ? new Date(to) : new Date();

        const [conversations, messages, contacts, deals] = await Promise.all([
          ctx.supabase.from("conversations").select("id, status, created_at").eq("account_id", ctx.accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
          ctx.supabase.from("messages").select("id, sender_type, content_type, created_at").eq("conversations.account_id", ctx.accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
          ctx.supabase.from("contacts").select("id, created_at").eq("account_id", ctx.accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
          ctx.supabase.from("deals").select("id, value, status, created_at").eq("account_id", ctx.accountId).gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
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
    return toErrorResponse(err);
  }
}
