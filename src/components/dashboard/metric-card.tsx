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
      'flex items-center gap-4 rounded-2xl border border-white/60 p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/8',
      cardBg ?? 'bg-white',
    )}>
      {/* Icon */}
      <div className={cn(
        'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl',
        iconBg ?? 'bg-[#3462EE]/10 text-[#3462EE]',
      )}>
        <Icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-[#667085] leading-none">{title}</p>
        <p className="mt-1.5 text-[26px] leading-none font-bold tabular-nums text-[#172033] tracking-tight">
          {value}
        </p>
        {delta ? (
          <DeltaRow sign={delta.sign} label={delta.label} />
        ) : subtitle ? (
          <p className="mt-1.5 text-xs text-[#667085]">{subtitle}</p>
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
        isUp && 'bg-emerald-100 text-emerald-700',
        isDown && 'bg-red-100 text-red-600',
        !isUp && !isDown && 'bg-gray-100 text-gray-500',
      )}>
        <Arrow className="h-2.5 w-2.5" aria-hidden />
        {isUp ? '+' : ''}{Math.abs(sign)}%
      </span>
      <span className="text-[11px] text-[#667085]">{label}</span>
    </div>
  )
}
