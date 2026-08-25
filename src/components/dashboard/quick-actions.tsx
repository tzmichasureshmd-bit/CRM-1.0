"use client"

import Link from 'next/link'
import { UserPlus, Briefcase, Radio, Zap } from 'lucide-react'
import type { ComponentType } from 'react'

import { useTranslations } from 'next-intl'

interface Action {
  labelKey: string
  href: string
  icon: ComponentType<{ className?: string }>
  tint: string
  bg: string
}

const ACTIONS: Action[] = [
  { labelKey: 'newContact', href: '/contacts', icon: UserPlus, tint: 'text-primary', bg: 'bg-primary/10' },
  { labelKey: 'newDeal', href: '/pipelines', icon: Briefcase, tint: 'text-blue-500', bg: 'bg-blue-500/10' },
  { labelKey: 'newBroadcast', href: '/broadcasts/new', icon: Radio, tint: 'text-amber-500', bg: 'bg-amber-500/10' },
  { labelKey: 'newAutomation', href: '/automations/new', icon: Zap, tint: 'text-violet-500', bg: 'bg-violet-500/10' },
]

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions')
  
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTIONS.map((a) => {
        const Icon = a.icon
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/20 hover:bg-muted/50 hover:shadow-sm"
          >
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${a.bg} ${a.tint} transition-transform group-hover:scale-105`}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">{t(a.labelKey as string)}</span>
          </Link>
        )
      })}
    </div>
  )
}
