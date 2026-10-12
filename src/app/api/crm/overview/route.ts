import { NextResponse } from "next/server";
import { getCurrentAccount, toErrorResponse } from "@/lib/auth/account";
import type { CrmOverviewCounts } from "@/types";

export async function GET() {
  try {
    const ctx = await getCurrentAccount();

    const { data, error } = await ctx.supabase.rpc("crm_overview", {
      p_account_id: ctx.accountId,
    });

    if (error) {
      console.error("[crm/overview] rpc failed:", error);
      return NextResponse.json(
        { error: "Failed to load CRM overview" },
        { status: 500 },
      );
    }

    return NextResponse.json((data ?? {}) as CrmOverviewCounts);
  } catch (err) {
    return toErrorResponse(err);
  }
}
