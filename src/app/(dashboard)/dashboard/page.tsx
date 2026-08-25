"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { formatCurrency } from '@/lib/currency'
import { OnboardingBanner } from '@/components/onboarding/onboarding-banner'
import {
  MessageSquare,
  UserPlus,
  DollarSign,
  Send,
  WifiOff,
  Calendar,
  Users,
  TrendingUp,
} from 'lucide-react'

import {
  loadActivity,
  loadConversationsSeries,
  loadMetrics,
  loadPipelineDonut,
  loadRecentConversations,
  loadResponseTime,
} from '@/lib/dashboard/queries'
import type {
  ActivityItem,
  ConversationsSeriesPoint,
  MetricsBundle,
  PipelineDonutData,
  ResponseTimeSummary,
  RecentConversation,
} from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { QuickActions } from '@/components/dashboard/quick-actions'
import { ConversationsChart } from '@/components/dashboard/conversations-chart'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { ResponseTimeChart } from '@/components/dashboard/response-time-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { RecentConversationsCard } from '@/components/dashboard/recent-conversations-card'

import { useTranslations } from 'next-intl'

type RangeDays = 7 | 30 | 90

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export default function DashboardPage() {
  const t = useTranslations('Dashboard.page')
  const { defaultCurrency, accountId, profile } = useAuth()
  const [metrics, setMetrics] = useState<MetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [range, setRange] = useState<RangeDays>(30)
  const [series, setSeries] = useState<Record<RangeDays, ConversationsSeriesPoint[] | null>>({
    7: null,
    30: null,
    90: null,
  })
  const [seriesLoading, setSeriesLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [responseTime, setResponseTime] = useState<ResponseTimeSummary | null>(null)
  const [responseTimeLoading, setResponseTimeLoading] = useState(true)

  const [activity, setActivity] = useState<ActivityItem[] | null>(null)
  const [activityLoading, setActivityLoading] = useState(true)

  const [recentConversations, setRecentConversations] = useState<RecentConversation[] | null>(null)
  const [recentLoading, setRecentLoading] = useState(true)

  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null)

  const [totalContacts, setTotalContacts] = useState<number | null>(null)
  const [totalConversations, setTotalConversations] = useState<number | null>(null)
  const [unassignedCount, setUnassignedCount] = useState<number | null>(null)
  const [overdueFollowUpsCount, setOverdueFollowUpsCount] = useState<number | null>(null)

  const loadAll = useCallback(() => {
    const db = createClient()

    void loadMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    void loadConversationsSeries(db, 30)
      .then((s) => setSeries((prev) => ({ ...prev, 30: s })))
      .catch((err) => console.error('[dashboard] series failed:', err))
      .finally(() => setSeriesLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    void loadResponseTime(db)
      .then((r) => setResponseTime(r))
      .catch((err) => console.error('[dashboard] response time failed:', err))
      .finally(() => setResponseTimeLoading(false))

     void loadActivity(db, 50)
      .then((a) => setActivity(a))
      .catch((err) => console.error('[dashboard] activity failed:', err))
      .finally(() => setActivityLoading(false))

    void loadRecentConversations(db, 6)
      .then((r) => setRecentConversations(r))
      .catch((err) => console.error('[dashboard] recent convs failed:', err))
      .finally(() => setRecentLoading(false))

    void (async () => {
      try {
        const { count } = await db
          .from('contacts')
          .select('id', { count: 'exact', head: true })
        setTotalContacts(count ?? 0)
      } catch {
        setTotalContacts(0)
      }
    })()

    void (async () => {
      try {
        const { count } = await db
          .from('conversations')
          .select('id', { count: 'exact', head: true })
        setTotalConversations(count ?? 0)
      } catch {
        setTotalConversations(0)
      }
    })()

    void (async () => {
      try {
        const { count } = await db
          .from('conversations')
          .select('id', { count: 'exact', head: true })
          .is('assigned_agent_id', null)
          .neq('status', 'closed')
        setUnassignedCount(count ?? 0)
      } catch {
        setUnassignedCount(0)
      }
    })()

    void (async () => {
      try {
        const now = new Date().toISOString()
        const { count } = await db
          .from('follow_ups')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .lt('due_date', now)
        setOverdueFollowUpsCount(count ?? 0)
      } catch {
        setOverdueFollowUpsCount(0)
      }
    })()
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  useEffect(() => {
    const checkConnection = async () => {
      if (!accountId) {
        setWhatsappConnected(false)
        return
      }

      const db = createClient()
      const { data } = await db
        .from('whatsapp_config')
        .select('status')
        .eq('account_id', accountId)
        .maybeSingle()

      setWhatsappConnected(data?.status === 'connected')
    }
    void checkConnection()
  }, [accountId])

  const handleRangeChange = useCallback(
    (r: RangeDays) => {
      setRange(r)
      if (series[r] !== null) return
      setSeriesLoading(true)
      const db = createClient()
      loadConversationsSeries(db, r)
        .then((s) => setSeries((prev) => ({ ...prev, [r]: s })))
        .catch((err) => console.error('[dashboard] series failed:', err))
        .finally(() => setSeriesLoading(false))
    },
    [series],
  )

  const firstName = profile?.full_name?.split(' ')[0] ?? t('there')

  return (
    <div className="space-y-6">
      <OnboardingBanner />

      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('description')}
          </p>
        </div>
        {whatsappConnected !== null && (
          <div className="flex items-center gap-2 text-xs">
            {whatsappConnected ? (
              <>
                <span className="flex h-2 w-2">
                  <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-emerald-500 font-medium">WhatsApp Connected</span>
              </>
            ) : (
              <Link
                href="/settings?tab=whatsapp"
                className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 transition-colors"
              >
                <WifiOff className="h-3.5 w-3.5" />
                <span className="font-medium">Connect WhatsApp</span>
              </Link>
            )}
          </div>
        )}
      </div>

      {whatsappConnected === false && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <WifiOff className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {t('whatsappNotConnected')}
            </p>
            <p className="text-xs text-muted-foreground">
              Connect your WhatsApp Business account to start receiving and sending messages.
            </p>
          </div>
          <Link
            href="/settings?tab=whatsapp"
            className="shrink-0 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
          >
            {t('connectNow')}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title={t('activeConversations')}
              value={metrics.activeConversations.current.toLocaleString()}
              icon={MessageSquare}
              delta={{
                sign: metrics.activeConversations.previous,
                label: deltaLabel(
                  metrics.activeConversations.previous, 
                  t('newTodayVsYesterday'), 
                  t('noChange', { suffix: t('newTodayVsYesterday') })
                ),
              }}
            />
            <MetricCard
              title={t('newContactsToday')}
              value={metrics.newContactsToday.current.toLocaleString()}
              icon={UserPlus}
              delta={{
                sign:
                  metrics.newContactsToday.current - metrics.newContactsToday.previous,
                label: deltaLabel(
                  metrics.newContactsToday.current - metrics.newContactsToday.previous,
                  t('vsYesterday'),
                  t('noChange', { suffix: t('vsYesterday') })
                ),
              }}
            />
            <MetricCard
              title={t('openDealsValue')}
              value={formatCurrency(metrics.openDealsValue, defaultCurrency)}
              icon={DollarSign}
              subtitle={t('openDeals', { count: metrics.openDealsCount })}
            />
            <MetricCard
              title={t('messagesSentToday')}
              value={metrics.messagesSentToday.current.toLocaleString()}
              icon={Send}
              delta={{
                sign:
                  metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                label: deltaLabel(
                  metrics.messagesSentToday.current - metrics.messagesSentToday.previous,
                  t('vsYesterday'),
                  t('noChange', { suffix: t('vsYesterday') })
                ),
              }}
            />
          </>
        )}
      </div>

      <QuickActions />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label={t('totalContacts')}
          value={totalContacts}
          loading={metricsLoading}
        />
        <StatCard
          icon={MessageSquare}
          label={t('totalConversations')}
          value={totalConversations}
          loading={metricsLoading}
        />
        <StatCard
          icon={Calendar}
          label={t('todaysFollowUps')}
          value={metrics?.followUpsToday.current ?? null}
          loading={metricsLoading}
        />
        <StatCard
          icon={TrendingUp}
          label={t('openDealsCountLabel')}
          value={metrics?.openDealsCount ?? null}
          loading={metricsLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/inbox?filter=unassigned" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
            <Users className="h-4 w-4 text-orange-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('unassignedConversations')}</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {unassignedCount !== null ? unassignedCount.toLocaleString() : '—'}
            </p>
          </div>
        </Link>
        <Link href="/inbox?filter=followups" className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 hover:bg-muted/50 transition-colors">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
            <Calendar className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('overdueFollowUps')}</p>
            <p className="text-lg font-bold tabular-nums text-foreground">
              {overdueFollowUpsCount !== null ? overdueFollowUpsCount.toLocaleString() : '—'}
            </p>
          </div>
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold text-foreground">{t('recentConversations')}</h2>
        <RecentConversationsCard
          conversations={recentConversations ?? []}
          loading={recentLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <ConversationsChart
            series={series}
            loading={seriesLoading}
            range={range}
            onRangeChange={handleRangeChange}
          />
        </div>
        <div className="h-full lg:col-span-2">
          <PipelineDonut
            data={pipeline}
            loading={pipelineLoading}
            currency={defaultCurrency}
          />
        </div>
      </div>

      <ResponseTimeChart data={responseTime} loading={responseTimeLoading} />

      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  )
}

// ------------------------------------------------------------

function deltaLabel(delta: number, suffix: string, noChangeLabel: string): string {
  if (delta === 0) return noChangeLabel
  const sign = delta > 0 ? '+' : ''
  return `${sign}${delta.toLocaleString()} ${suffix}`
}

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | null
  loading: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <div className="mt-1 h-5 w-12 animate-pulse rounded bg-muted" />
        ) : (
          <p className="text-lg font-bold tabular-nums text-foreground">
            {(value ?? 0).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  )
}
