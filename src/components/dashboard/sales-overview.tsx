"use client"

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Users, Target, DollarSign, Trophy, TrendingUp, Layers } from 'lucide-react'
import { BarChart } from '@/components/tremor/bar-chart'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Skeleton } from '@/components/dashboard/skeleton'
import { formatCurrency } from '@/lib/currency'
import type { SalesOverviewResponse } from '@/lib/dashboard/types'

interface SalesOverviewProps {
  defaultCurrency: string
}

export function SalesOverview({ defaultCurrency }: SalesOverviewProps) {
  const t = useTranslations('Dashboard.salesOverview')
  const [data, setData] = useState<SalesOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/dashboard/sales-overview', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active) setData(d)
      })
      .catch((err) => console.error('[dashboard] sales overview failed:', err))
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const cards = data?.cards
  const hasDeals = (data?.dealsByMonth ?? []).some(
    (m) => m.open > 0 || m.won > 0 || m.lost > 0,
  )
  const hasSources = (data?.sources ?? []).some((s) => s.count > 0)

  return (
    <section className="space-y-4">
      {/* Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading || !cards ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricMini
              icon={Users}
              iconBg="bg-blue-500/10 text-blue-500"
              label={t('totalLeads')}
              value={cards.totalLeads.toLocaleString()}
            />
            <MetricMini
              icon={Target}
              iconBg="bg-emerald-500/10 text-emerald-500"
              label={t('qualifiedLeads')}
              value={cards.qualifiedLeads.toLocaleString()}
            />
            <MetricMini
              icon={DollarSign}
              iconBg="bg-amber-500/10 text-amber-500"
              label={t('openPipelineValue')}
              value={formatCurrency(cards.openDealsValue, defaultCurrency)}
            />
            <MetricMini
              icon={Trophy}
              iconBg="bg-violet-500/10 text-violet-500"
              label={t('wonValue')}
              value={formatCurrency(cards.wonDealsValue, defaultCurrency)}
              sub={
                cards.winRate !== null
                  ? t('winRate', { rate: cards.winRate })
                  : t('winRateEmpty', { fallback: '—' })
              }
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <TrendingUp className="h-4 w-4 text-primary" />
                {t('dealsByMonth')}
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('dealsByMonthHint')}
              </p>
            </div>
          </div>
          {loading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : !hasDeals ? (
            <EmptyState
              icon={Layers}
              title={t('noDeals')}
              hint={t('noDealsHint')}
            />
          ) : (
            <BarChart
              data={data.dealsByMonth}
              index="label"
              categories={[t('chartOpen'), t('chartWon'), t('chartLost')]}
              colors={['amber', 'emerald', 'fuchsia']}
              valueFormatter={(value) => `${value} deals`}
              type="stacked"
              showLegend
              className="h-64"
            />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Layers className="h-4 w-4 text-primary" />
            {t('leadSources')}
          </h3>
          {loading || !data ? (
            <Skeleton className="h-64 w-full" />
          ) : !hasSources ? (
            <EmptyState
              icon={Users}
              title={t('noSources')}
              hint={t('noSourcesHint')}
            />
          ) : (
            <SourceList sources={data.sources} t={t} />
          )}
        </div>
      </div>
    </section>
  )
}

interface SourceListProps {
  sources: { key: string; count: number }[]
  t: ReturnType<typeof useTranslations<'Dashboard.salesOverview'>>
}

function SourceList({ sources, t }: SourceListProps) {
  const total = sources.reduce((sum, s) => sum + s.count, 0)
  return (
    <ul className="space-y-3">
      {sources.map((s) => {
        const pct = total > 0 ? Math.round((s.count / total) * 100) : 0
        return (
          <li key={s.key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                {t(`source.${s.key}`, {
                  fallback: s.key.charAt(0).toUpperCase() + s.key.slice(1),
                })}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {s.count.toLocaleString()} · {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/80 transition-all"
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function MetricMini({
  icon: Icon,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-xl font-bold tabular-nums text-foreground">
            {value}
          </p>
          {sub && (
            <p className="truncate text-[11px] text-muted-foreground">{sub}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          <div className="h-5 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  )
}