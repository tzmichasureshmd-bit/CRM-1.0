"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ThumbsUp, Camera, Link2, Unlink, RefreshCw } from "lucide-react";

interface PageConnection {
  id: string;
  page_id: string;
  page_name: string | null;
  platform: "facebook" | "instagram";
  status: string;
  webhook_status: string | null;
  instagram_account_id: string | null;
  instagram_username: string | null;
  connected_at: string | null;
}

export function MetaLeadsConnect() {
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<PageConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const fetchConnections = useCallback(async () => {
    try {
      const res = await fetch("/api/meta/leads/config", { cache: "no-store" });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setConnections(data.connections ?? []);
    } catch {
      toast.error("Could not load Meta connections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConnections();
  }, [fetchConnections]);

  // Surface the result of the OAuth redirect (loopback).
  useEffect(() => {
    const status = searchParams.get("meta_leads");
    if (!status) return;
    if (status === "connected") {
      toast.success("Facebook account connected");
      void fetchConnections();
    } else if (status === "denied") {
      toast.error("You declined the connection");
    } else if (status === "error") {
      toast.error(
        searchParams.get("reason")
          ? `Connection failed: ${searchParams.get("reason")}`
          : "Meta connection failed",
      );
    }
    // clean the query string
    const url = new URL(window.location.href);
    url.searchParams.delete("meta_leads");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const startConnect = () => {
    setConnecting(true);
    window.location.href = "/api/meta/leads/connect";
  };

  const disconnect = async (platform: "facebook" | "instagram", pageId: string) => {
    const res = await fetch("/api/meta/leads/config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId, platform }),
    });
    if (res.ok) {
      toast.success("Connection removed");
      void fetchConnections();
    } else {
      toast.error("Could not remove connection");
    }
  };

  const facebookPages = connections.filter((c) => c.platform === "facebook");
  const instagramAccounts = connections.filter(
    (c) => c.platform === "instagram" && c.instagram_username,
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Facebook & Instagram Lead Ads
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect a Facebook account to automatically turn lead ad
          submissions on your Pages (and linked Instagram Professional
          accounts) into CRM contacts. Leads appear in the Contacts page
          with their source, Page, campaign and form.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={
            connections.length > 0
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
              : "border-border text-muted-foreground"
          }
        >
          {connections.length > 0 ? "Connected" : "Not connected"}
        </Badge>
        {connections.length > 0 && (
          <Badge
            variant="outline"
            className={
              connections.some((c) => c.webhook_status === "active")
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/40 bg-amber-500/10 text-amber-400"
            }
          >
            Webhook:
            {connections.some((c) => c.webhook_status === "active")
              ? " Active"
              : " Pending"}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={startConnect} disabled={connecting} className="bg-primary hover:bg-primary/90 text-primary-foreground">
          {connecting ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Connect Facebook Account
        </Button>
        <Button
          variant="outline"
          onClick={() => void fetchConnections()}
          disabled={loading}
          className="border-border text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {facebookPages.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ThumbsUp className="size-4 text-[#1877F2]" /> Connected Pages
              </h3>
              {facebookPages.map((p) => (
                <PageRow key={p.id} conn={p} onDisconnect={() => disconnect("facebook", p.page_id)} />
              ))}
            </div>
          )}

          {instagramAccounts.length > 0 && (
            <div className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Camera className="size-4 text-pink-500" /> Instagram Accounts
              </h3>
              {instagramAccounts.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Camera className="size-4 text-pink-500" />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        @{p.instagram_username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.page_name ?? "Instagram Professional account"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnect("instagram", p.page_id)}
                    className="text-muted-foreground hover:text-red-400"
                  >
                    <Unlink className="size-4" /> Disconnect
                  </Button>
                </div>
              ))}
            </div>
          )}

          {connections.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground">
              No Meta pages connected yet. Click “Connect Facebook Account”
              to get started.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function PageRow({
  conn,
  onDisconnect,
}: {
  conn: PageConnection;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-3">
        <ThumbsUp className="size-4 text-[#1877F2]" />
        <div>
          <p className="text-sm font-medium text-foreground">{conn.page_name ?? conn.page_id}</p>
          <p className="text-xs text-muted-foreground">
            {conn.instagram_username ? `Insta: @${conn.instagram_username} · ` : ""}
            {conn.connected_at
              ? `Connected ${new Date(conn.connected_at).toLocaleDateString()}`
              : ""}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-border text-muted-foreground">
          {conn.webhook_status === "active" ? "Webhook active" : "Webhook pending"}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onDisconnect} className="text-muted-foreground hover:text-red-400">
          <Unlink className="size-4" /> Disconnect
        </Button>
      </div>
    </div>
  );
}
