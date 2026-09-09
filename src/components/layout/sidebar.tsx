"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import {
  Bell,
  Bot,
  Calendar,
  ChevronDown,
  Crown,
  GitBranch,
  Images,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Phone,
  PiggyBank,
  Radio,
  Reply,
  Settings,
  Shield,
  StickyNote,
  Ticket,
  User,
  UserCog,
  Users,
  CreditCard,
  Code,
  UsersRound,
  Workflow,
  X,
  Zap,
  Timer,
  BarChart3,
  Share2,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; labelKey: string; className: string }
> = {
  owner: {
    icon: Crown,
    labelKey: "roleOwner",
    className: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  admin: {
    icon: Shield,
    labelKey: "roleAdmin",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  agent: {
    icon: UserCog,
    labelKey: "roleAgent",
    className: "border-border bg-muted text-foreground",
  },
  viewer: {
    icon: User,
    labelKey: "roleViewer",
    className: "border-border bg-card text-muted-foreground",
  },
};

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  beta?: boolean;
}

interface NavSection {
  labelKey: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navSections: NavSection[] = [
  {
    labelKey: "sectionConversations",
    items: [
      { href: "/inbox", labelKey: "inbox", icon: MessageSquare },
      { href: "/contacts", labelKey: "contacts", icon: Users },
    ],
    defaultOpen: true,
  },
  {
    labelKey: "sectionMarketing",
    items: [
      { href: "/campaigns", labelKey: "campaigns", icon: Megaphone },
      { href: "/broadcasts", labelKey: "broadcasts", icon: Radio },
      { href: "/templates", labelKey: "templates", icon: Layers },
    ],
    defaultOpen: true,
  },
  {
    labelKey: "sectionAutomation",
    items: [
      { href: "/automations", labelKey: "automations", icon: Zap },
      { href: "/automations/flows", labelKey: "automationFlows", icon: Workflow },
      { href: "/automations/bot-builder", labelKey: "botFlowBuilder", icon: Bot, beta: true },
      { href: "/automations/followups", labelKey: "aiFollowups", icon: Reply },
      { href: "/automations/calls", labelKey: "bulkAiCalls", icon: Phone },
      { href: "/automations/quick-replies", labelKey: "quickReplies", icon: StickyNote },
      { href: "/automations/keyboard-triggers", labelKey: "keyboardTriggers", icon: Timer },
      { href: "/automations/appointments", labelKey: "appointments", icon: Calendar },
      { href: "/automations/tickets", labelKey: "tickets", icon: Ticket },
    ],
    defaultOpen: true,
  },
  {
    labelKey: "sectionGrowth",
    items: [
      { href: "/pipelines", labelKey: "pipelines", icon: GitBranch },
      { href: "/reports", labelKey: "reports", icon: BarChart3 },
      { href: "/save-money", labelKey: "saveMoney", icon: PiggyBank },
    ],
  },
  {
    labelKey: "sectionSystem",
    items: [
      { href: "/notifications", labelKey: "notifications", icon: Bell },
      { href: "/media-library", labelKey: "mediaLibrary", icon: Images },
      { href: "/api", labelKey: "apiDeveloper", icon: Code },
    ],
  },
];

const bottomNavItems = [
  { href: "/billing", labelKey: "billing", icon: CreditCard },
  { href: "/settings", labelKey: "settings", icon: Settings },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

const SECTION_STORAGE_KEY = "wacrm-sidebar-sections";

function loadSectionState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSectionState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

import { useTranslations } from "next-intl";

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut } = useAuth();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  const showAccountStrip =
    !profileLoading &&
    !!account?.name &&
    account.name !== profile?.full_name;

  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>(() => {
    const saved = loadSectionState();
    const initial: Record<string, boolean> = {};
    for (const section of navSections) {
      initial[section.labelKey] = saved[section.labelKey] ?? (section.defaultOpen ?? false);
    }
    return initial;
  });

  useEffect(() => {
    saveSectionState(sectionsOpen);
  }, [sectionsOpen]);

  const toggleSection = useCallback((key: string) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    onClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label={t("closeMenu")}
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden",
          open
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card",
          "transition-transform duration-200 ease-out will-change-transform",
          open ? "translate-x-0" : "-translate-x-full",
          "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none",
          "lg:shadow-[1px_0_0_0_rgba(0,0,0,0.04)]",
        )}
        aria-label="Primary"
      >
        {/* Logo / Brand */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm shadow-primary/20">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground">
                {t("title")}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("subtitle")}
              </span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMenu")}
            className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {/* Dashboard - always visible, no section */}
          <ul className="flex flex-col gap-0.5">
            {[
              { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
              { href: "/social-media", labelKey: "socialMedia", icon: Share2 },
            ].map((item) => {
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 transition-colors" />
                    <span className="flex-1">{t(item.labelKey as string)}</span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="my-3 border-t border-border/60" />

          {/* Collapsible sections */}
          <div className="flex flex-col gap-1">
            {navSections.map((section) => {
              const isOpen = sectionsOpen[section.labelKey] ?? false;
              const hasActiveChild = section.items.some(
                (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
              );
              return (
                <div key={section.labelKey}>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.labelKey)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                      hasActiveChild
                        ? "text-primary/80 hover:text-primary"
                        : "text-muted-foreground/60 hover:text-muted-foreground",
                    )}
                    aria-expanded={isOpen}
                  >
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180",
                      )}
                    />
                    <span className="flex-1 text-left">{t(section.labelKey)}</span>
                    {section.items.some((item) => item.href === "/inbox" && totalUnread > 0) && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                        {totalUnread > 9 ? "9+" : totalUnread}
                      </span>
                    )}
                  </button>
                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-200 ease-in-out",
                      isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0",
                    )}
                  >
                    <ul className="flex flex-col gap-0.5 py-1 pl-2">
                      {section.items.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          (item.href !== "/dashboard" && pathname.startsWith(item.href));
                        const showUnreadDot =
                          item.href === "/inbox" && totalUnread > 0 && !isActive;
                        const showNotificationBadge =
                          item.href === "/notifications" && unreadNotifications > 0;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              className={cn(
                                "group flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150",
                                isActive
                                  ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              <item.icon className="h-4 w-4 shrink-0 transition-colors" />
                              <span className="flex-1">{t(item.labelKey as string)}</span>
                              {item.beta && (
                                <span
                                  aria-label={t("beta")}
                                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300"
                                >
                                  {t("beta")}
                                </span>
                              )}
                              {showUnreadDot && (
                                <span
                                  aria-label={t("unreadConversations", { count: totalUnread })}
                                  className="relative flex h-2 w-2"
                                >
                                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                                </span>
                              )}
                              {showNotificationBadge && (
                                <span
                                  aria-label={t("unreadNotifications", { count: unreadNotifications })}
                                  className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                                >
                                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                                </span>
                              )}
                              {isActive && (
                                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="my-3 border-t border-border/60" />

          {/* Bottom nav items */}
          <ul className="flex flex-col gap-0.5">
            {bottomNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-primary/10 text-primary shadow-sm shadow-primary/5"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0 transition-colors" />
                    {t(item.labelKey as string)}
                    {isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-border p-3">
          {showAccountStrip && account?.name ? (
            <div className="mb-2 flex items-center gap-2 px-3 text-xs text-muted-foreground">
              <UsersRound className="size-3.5 shrink-0" />
              <span className="truncate" title={account.name}>
                {account.name}
              </span>
              {accountRole ? (
                (() => {
                  const meta = ROLE_CHIP[accountRole];
                  const Icon = meta.icon;
                  return (
                    <span
                      className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${meta.className}`}
                    >
                      <Icon className="size-3" />
                      {t(meta.labelKey as string)}
                    </span>
                  );
                })()
              ) : null}
            </div>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none data-popup-open:bg-muted/60">
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? t("defaultAvatar")}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    "U"}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {profile?.full_name ?? t("defaultUser")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {profile?.email ?? ""}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-popover text-popover-foreground ring-border"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <User className="size-4" />
                {t("menuProfile")}
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onClose}
                    className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                  />
                }
              >
                <Settings className="size-4" />
                {t("menuSettings")}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              >
                <LogOut className="size-4" />
                {t("menuSignOut")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
