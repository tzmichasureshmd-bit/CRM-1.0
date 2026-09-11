import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  Wrench,
  Ticket,
  Inbox,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface AdminSupportPageProps {
  basePath?: string;
}

/** Shared by /admin and /super-admin � links derive from `basePath`. */
export async function AdminSupportPage({
  basePath = "/admin",
}: AdminSupportPageProps = {}) {
  const supabase = await createClient();

  const [recentAccountsResult, pastDueResult, suspendedResult, recentTicketsResult, ticketCounts] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, slug, status, created_at")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("business_subscriptions")
        .select(
          `
          id,
          status,
          created_at,
          accounts ( id, name, slug )
        `
        )
        .eq("status", "past_due")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("accounts")
        .select("id, name, slug, status, created_at")
        .eq("status", "suspended")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("tickets")
        .select(
          `
          id,
          subject,
          status,
          priority,
          created_at,
          account_id,
          accounts ( id, name, slug )
        `
        )
        .not("status", "in", "(resolved,closed)")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("tickets")
        .select("status")
        .in("status", ["open", "in_progress", "waiting"]),
    ]);

  const openTickets = ticketCounts.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Support</h2>
        <p className="text-muted-foreground">
          Monitor accounts that may need attention.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Ticket className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Live Ticket Overview
          </h3>
          <p className="mt-2 max-w-md mx-auto text-sm text-muted-foreground">
            Open support tickets across all accounts. Recent unresolved tickets
            are listed below, plus a summary of what needs attention.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm">
              <span className="inline-flex items-center gap-2">
                <Inbox className="h-4 w-4 text-primary" />
                Open Tickets
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {openTickets.length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Unresolved tickets (open / in progress / waiting)
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm">
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                In Progress
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {openTickets.filter((t) => t.status === "in_progress").length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tickets actively being worked on
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-sm">
              <span className="inline-flex items-center gap-2">
                <Wrench className="h-4 w-4 text-muted-foreground" />
                Unassigned
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">
              {openTickets.filter((t) => t.status === "open").length}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tickets still in the open queue
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" />
              Recent Open Tickets
            </span>
          </CardTitle>
          <CardDescription>
            Latest unresolved support tickets across all businesses
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!recentTicketsResult.data || recentTicketsResult.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No open tickets. All clear!
            </p>
          ) : (
            <div className="space-y-3">
              {recentTicketsResult.data.map((ticket) => {
                const rawAccount = ticket.accounts as
                  | Array<{ id: string; name: string | null; slug: string | null }>
                  | { id: string; name: string | null; slug: string | null }
                  | null;
                const account = Array.isArray(rawAccount) ? rawAccount[0] ?? null : rawAccount;
                return (
                  <Link
                    key={ticket.id}
                    href={`${basePath}/businesses/${ticket.account_id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {ticket.subject}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account?.name ?? "Unknown Account"}
                        {account?.slug ? ` (@${account.slug})` : ""} &middot;{" "}
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                          (ticket.priority === "urgent"
                            ? "bg-red-500/10 text-red-400"
                            : ticket.priority === "high"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-muted text-muted-foreground")
                        }
                      >
                        {ticket.priority}
                      </span>
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                        {ticket.status}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Accounts
              </span>
            </CardTitle>
            <CardDescription>Newest 5 registered businesses</CardDescription>
          </CardHeader>
          <CardContent>
            {!recentAccountsResult.data ||
            recentAccountsResult.data.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No accounts found.
              </p>
            ) : (
              <div className="space-y-3">
                {recentAccountsResult.data.map((account) => (
                  <Link
                    key={account.id}
                    href={`${basePath}/businesses/${account.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {account.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account.slug ? `@${account.slug}` : "No slug"} &middot;{" "}
                        {new Date(account.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Past Due Subscriptions
              </span>
            </CardTitle>
            <CardDescription>
              Accounts with overdue payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!pastDueResult.data || pastDueResult.data.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No past due subscriptions. All clear!
              </p>
            ) : (
              <div className="space-y-3">
                {pastDueResult.data.map((sub) => {
                  const rawAccount = sub.accounts as
                    | Array<{ id: string; name: string | null; slug: string | null }>
                    | { id: string; name: string | null; slug: string | null }
                    | null;
                  const account = Array.isArray(rawAccount) ? rawAccount[0] ?? null : rawAccount;
                  return (
                    <Link
                      key={sub.id}
                      href={
                        account
                          ? `${basePath}/businesses/${account.id}`
                          : "#"
                      }
                      className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {account?.name ?? "Unknown Account"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {account?.slug
                            ? `@${account.slug}`
                            : "No slug"}{" "}
                          &middot; past since{" "}
                          {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Suspended Accounts
            </span>
          </CardTitle>
          <CardDescription>
            Accounts currently suspended that may need review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!suspendedResult.data || suspendedResult.data.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No suspended accounts.
            </p>
          ) : (
            <div className="space-y-3">
              {suspendedResult.data.map((account) => (
                <Link
                  key={account.id}
                  href={`${basePath}/businesses/${account.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {account.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {account.slug ? `@${account.slug}` : "No slug"} &middot;{" "}
                      {new Date(account.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupportPage() {
  return <AdminSupportPage basePath="/admin" />;
}