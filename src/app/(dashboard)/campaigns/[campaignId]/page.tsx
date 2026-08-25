'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Campaign detail lives in the broadcast detail page (shared sending
// engine + per-recipient delivery ladder). This route keeps the
// /campaigns/[campaignId] URL addressable and hands off to it.

export default function CampaignDetailRedirect() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (campaignId) {
      router.replace(`/broadcasts/${campaignId}`);
    }
  }, [campaignId, router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
