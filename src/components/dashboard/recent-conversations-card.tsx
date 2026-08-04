"use client";

import { Loader2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";
import type { RecentConversation } from "@/lib/dashboard/types";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface RecentConversationsCardProps {
  conversations: RecentConversation[];
  loading: boolean;
}

const STATUS_COLORS: Record<RecentConversation["status"], string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground",
};

export function RecentConversationsCard({
  conversations,
  loading,
}: RecentConversationsCardProps) {
  const t = useTranslations("Dashboard.page");

  const displayName = (c: RecentConversation) =>
    c.contact?.name || c.contact?.phone || t("unknown");

  const initials = (name: string) =>
    name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "•";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">
          {t("noRecentConversations")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("noRecentConversationsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((conv) => {
        const name = displayName(conv);
        const isUnread = conv.unread_count > 0;

        return (
          <button
            key={conv.id}
            onClick={() => {
              window.location.href = `/inbox?c=${conv.id}`;
            }}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/50",
              conv.status === "open" && isUnread && "bg-muted/50",
            )}
          >
            <Avatar className="h-8 w-8 shrink-0">
              {conv.contact?.avatar_url ? (
                <img
                  src={conv.contact.avatar_url}
                  alt={name}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <AvatarFallback className="bg-muted text-xs">
                  {initials(name)}
                </AvatarFallback>
              )}
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-sm font-medium",
                    isUnread ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {name}
                </span>
                {conv.last_message_at && (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(conv.last_message_at), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>

              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                {conv.last_message_text || t("noMessagesYet")}
              </p>

              <div className="mt-1 flex items-center gap-1.5">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    STATUS_COLORS[conv.status],
                  )}
                  title={conv.status}
                />
                {isUnread && (
                  <span className="inline-flex items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {conv.unread_count}
                  </span>
                )}
                {conv.assigned_agent_id && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    {t("assigned")}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
