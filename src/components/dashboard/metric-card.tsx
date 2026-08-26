import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  icon: ComponentType<{ className?: string }>
  delta?: {
    sign: number
    label: string
  }
  subtitle?: string
  iconBg?: string
  children?: ReactNode
}

export function MetricCard({ title, value, icon: Icon, delta, subtitle, iconBg, children }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card p-5 transition-all duration-200 hover:border-border hover:shadow-md hover:shadow-black/5">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200",
            iconBg ?? "bg-primary/10 text-primary",
            "group-hover:scale-110",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-3 text-[28px] leading-none font-bold tabular-nums text-foreground tracking-tight">
        {value}
      </p>
      {delta ? <DeltaRow sign={delta.sign} label={delta.label} /> : subtitle ? (
        <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
      {children}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-emerald-500'
      : sign < 0
      ? 'text-red-400'
      : 'text-muted-foreground'
  const bgTone =
    sign > 0
      ? 'bg-emerald-500/10'
      : sign < 0
      ? 'bg-red-400/10'
      : 'bg-muted'
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus
  return (
    <div className="mt-2.5 flex items-center gap-1.5">
      <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", tone, bgTone)}>
        <Arrow className="h-3 w-3" aria-hidden />
        <span className="tabular-nums">{Math.abs(sign)}</span>
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
