import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  icon: ComponentType<{ className?: string }>
  delta?: { sign: number; label: string }
  subtitle?: string
  iconBg?: string
  cardBg?: string
  children?: ReactNode
}

export function MetricCard({ title, value, icon: Icon, delta, subtitle, iconBg, cardBg, children }: MetricCardProps) {
  return (
    <div className={cn(
      'flex items-center gap-4 rounded-2xl border border-border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg',
      cardBg ?? 'bg-card',
    )}>
      {/* Icon */}
      <div className={cn(
        'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
        iconBg ?? 'bg-primary/10 text-primary',
      )}>
        <Icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-muted-foreground leading-none">{title}</p>
        <p className="mt-1.5 text-[26px] leading-none font-bold tabular-nums text-foreground tracking-tight">
          {value}
        </p>
        {delta ? (
          <DeltaRow sign={delta.sign} label={delta.label} />
        ) : subtitle ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const isUp = sign > 0
  const isDown = sign < 0
  const Arrow = isUp ? ArrowUp : isDown ? ArrowDown : Minus
  return (
    <div className="mt-2 flex items-center gap-1.5">
      <span className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold',
        isUp && 'bg-success/15 text-success',
        isDown && 'bg-destructive/15 text-destructive',
        !isUp && !isDown && 'bg-muted text-muted-foreground',
      )}>
        <Arrow className="h-2.5 w-2.5" aria-hidden />
        {isUp ? '+' : ''}{Math.abs(sign)}%
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  )
}
