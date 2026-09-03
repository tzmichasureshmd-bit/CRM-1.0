import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";

export const dynamic = "force-dynamic";

/**
 * Aggregate payload for the Social Media page and the Dashboard's
 * "Lead Overview" / "Recent Leads" sections.
 *
 * Everything is computed server-side against the authenticated user's
 * account (never from a frontend-supplied tenant id) using grouped SQL,
 * so counts stay correct at any scale and never require loading every
 * contact into the browser. RLS keeps the data scoped to the tenant.
 */
export async function GET() {
  try {
    const ctx = await requireRole("viewer");
    const accountId = ctx.accountId;

    const [statsRes, breakdownRes, recentRes, connRes] = await Promise.all([
      ctx.supabase.rpc("count_meta_leads", { p_account_id: accountId }),
      ctx.supabase.rpc("get_social_media_overview", { p_account_id: accountId }),
      ctx.supabase
        .from("contacts")
        .select(
          "id, name, phone, source_platform, source_page_name, " +
            "source_instagram_username, campaign_name, lead_status, created_at",
        )
        .eq("account_id", accountId)
        .not("source_platform", "is", null)
        .order("created_at", { ascending: false })
        .limit(10),
      ctx.supabase
        .from("meta_page_connections")
        .select(
          "page_id, page_name, platform, status, webhook_status, " +
            "instagram_account_id, instagram_username",
        )
        .eq("status", "active"),
    ]);

    if (statsRes.error) {
      return NextResponse.json(
        { error: "Could not load lead statistics" },
        { status: 500 },
      );
    }

    const statsRow = (statsRes.data as
      | Array<{
          total_contacts: number;
          total_leads: number;
          new_leads: number;
          facebook_leads: number;
          instagram_leads: number;
          today_leads: number;
          week_leads: number;
          month_leads: number;
        }>
      | null)?.[0];

    const stats = statsRow ?? {
      total_contacts: 0,
      total_leads: 0,
      new_leads: 0,
      facebook_leads: 0,
      instagram_leads: 0,
      today_leads: 0,
      week_leads: 0,
      month_leads: 0,
    };

    // Aggregate the grouped breakdown into per-platform + per-page totals.
    type OverviewRow = {
      platform: string | null;
      source_page_name: string | null;
      source_instagram_username: string | null;
      lead_count: number;
    };
    const rows = (breakdownRes.data as OverviewRow[] | null) ?? [];
    const facebookByPage: { label: string; count: number }[] = [];
    const instagramByAccount: { label: string; count: number }[] = [];
    let facebookTotal = 0;
    let instagramTotal = 0;
    for (const r of rows) {
      if (r.platform === "facebook") {
        facebookTotal += Number(r.lead_count ?? 0);
        const label = r.source_page_name || "Unknown";
        const existing = facebookByPage.find((b) => b.label === label);
        if (existing) existing.count += Number(r.lead_count ?? 0);
        else facebookByPage.push({ label, count: Number(r.lead_count ?? 0) });
      } else if (r.platform === "instagram") {
        instagramTotal += Number(r.lead_count ?? 0);
        const label = r.source_instagram_username
          ? `@${r.source_instagram_username}`
          : "Instagram";
        const existing = instagramByAccount.find((b) => b.label === label);
        if (existing) existing.count += Number(r.lead_count ?? 0);
        else instagramByAccount.push({ label, count: Number(r.lead_count ?? 0) });
      }
    }
    facebookByPage.sort((a, b) => b.count - a.count);
    instagramByAccount.sort((a, b) => b.count - a.count);

    const breakdown = {
      facebookTotal,
      instagramTotal,
      byFacebookPage: facebookByPage,
      byInstagramAccount: instagramByAccount,
    };

    const connections = (
      (connRes.data ?? []) as unknown as Array<{
        page_id: string;
        page_name: string | null;
        platform: string;
        status: string;
        webhook_status: string | null;
        instagram_account_id: string | null;
        instagram_username: string | null;
      }>
    ).map((c) => ({
      pageId: c.page_id,
      pageName: c.page_name,
      platform: c.platform,
      status: c.status,
      webhookStatus: c.webhook_status,
      instagramAccountId: c.instagram_account_id,
      instagramUsername: c.instagram_username,
    }));

    const recentLeads = (
      (recentRes.data ?? []) as unknown as Array<{
        id: string;
        name: string | null;
        phone: string | null;
        source_platform: string | null;
        source_page_name: string | null;
        source_instagram_username: string | null;
        campaign_name: string | null;
        lead_status: string | null;
        created_at: string | null;
      }>
    ).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      sourcePlatform: c.source_platform,
      pageName: c.source_page_name,
      instagramUsername: c.source_instagram_username,
      campaignName: c.campaign_name,
      leadStatus: c.lead_status,
      createdAt: c.created_at,
    }));

    return NextResponse.json({
      stats,
      breakdown,
      connections,
      recentLeads,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
