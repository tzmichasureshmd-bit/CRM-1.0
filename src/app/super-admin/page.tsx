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
  Building2,
  Users,
  MessageSquare,
  CreditCard,
  Activity,
  ScrollText,
  FileText,
  ArrowRight,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SuperAdminPage() {
  const supabase = await createClient();

  const { data: user } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("user_id", user?.user?.id ?? "")
    .maybeSingle();

  const [
    accountsResult,
    usersResult,
    contactsResult,
    messagesResult,
    activeSubscriptionsResult,
    conversationsResult,
    recentAccountsResult,
    recentAuditResult,
  ] = await Promise.all([
    supabase.from("accounts").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("messages").select("id", { count: "exact", head: true }),
    supabase
      .from("business_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true }),
    supabase
      .from("accounts")
      .select("id, name, slug, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("audit_log")
      .select("id, actor_email, action, resource_type, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const stats = [
    {
      label: "Total Accounts",
      value: accountsResult.count ?? 0,
      icon: Building2,
      href: "/super-admin/businesses",
    },
    {
      label: "Total Users",
      value: usersResult.count ?? 0,
      icon: Users,
      href: "/super-admin/users",
    },
    {
      label: "Total Contacts",
      value: contactsResult.count ?? 0,
      icon: MessageSquare,
      href: "/super-admin/businesses",
    },
    {
      label: "Total Messages",
      value: messagesResult.count ?? 0,
      icon: FileText,
      href: "/super-admin",
    },
    {
      label: "Active Subscriptions",
      value: activeSubscriptionsResult.count ?? 0,
      icon: CreditCard,
      href: "/super-admin/subscriptions",
    },
    {
      label: "Total Conversations",
      value: conversationsResult.count ?? 0,
      icon: MessageSquare,
      href: "/super-admin",
    },
  ];

  const quickLinks = [
    { label: "Businesses", href: "/super-admin/businesses", icon: Building2 },
    { label: "Users", href: "/super-admin/users", icon: Users },
    { label: "Plans", href: "/super-admin/plans", icon: FileText },
    { label: "Audit Logs", href: "/super-admin/audit", icon: ScrollText },
    { label: "Platform Health", href: "/super-admin/health", icon: Activity },
    {
      label: "Subscriptions",
      href: "/super-admin/subscriptions",
      icon: CreditCard,
    },
  ];

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    suspended: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    deleted: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}. Platform
          overview and management.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="border-border bg-card transition-colors hover:bg-muted/50">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {stat.value.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div>
        <h3 className="mb-3 text-lg font-semibold text-foreground">
          Quick Links
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href + link.label} href={link.href}>
              <Card className="border-border bg-card transition-colors hover:bg-muted/50">
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <link.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {link.label}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Recent Accounts</CardTitle>
            <CardDescription>Last 5 registered businesses</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAccountsResult.data &&
            recentAccountsResult.data.length > 0 ? (
              <div className="space-y-3">
                {recentAccountsResult.data.map((account) => (
                  <Link
                    key={account.id}
                    href={`/super-admin/businesses/${account.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {account.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account.slug
                          ? `@${account.slug}`
                          : "No slug"}{" "}
                        &middot;{" "}
                        {new Date(account.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[account.status ?? "active"] ?? statusColor.active}`}
                    >
                      {account.status ?? "active"}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No accounts yet.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle>Recent Audit Logs</CardTitle>
            <CardDescription>Latest platform activity</CardDescription>
          </CardHeader>
          <CardContent>
            {recentAuditResult.data && recentAuditResult.data.length > 0 ? (
              <div className="space-y-3">
                {recentAuditResult.data.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ScrollText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        <span className="font-medium">
                          {entry.actor_email ?? "System"}
                        </span>{" "}
                        {entry.action}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.resource_type} &middot;{" "}
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No audit log entries yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
