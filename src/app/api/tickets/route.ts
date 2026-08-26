import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getCurrentAccount()

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')

    let query = ctx.supabase
      .from('tickets')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }
    if (priority) {
      query = query.eq('priority', priority)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch tickets:', error)
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
    }

    return NextResponse.json({ tickets: data ?? [] })
  } catch (err) {
    return toErrorResponse(err)
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getCurrentAccount()

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { subject, description, contact_id, priority, assigned_to } = body

    if (!subject || typeof subject !== 'string') {
      return NextResponse.json({ error: 'subject is required' }, { status: 400 })
    }

    // Auto-increment ticket_number within the account
    const { data: lastTicket } = await ctx.supabase
      .from('tickets')
      .select('ticket_number')
      .eq('account_id', ctx.accountId)
      .order('ticket_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextNumber = ((lastTicket?.ticket_number as number) ?? 0) + 1

    const { data, error } = await ctx.supabase
      .from('tickets')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        contact_id: contact_id || null,
        subject: subject.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        ticket_number: nextNumber,
        priority: typeof priority === 'string' ? priority : 'medium',
        assigned_to: typeof assigned_to === 'string' ? assigned_to : null,
        status: 'open',
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed to create ticket:', error)
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    return NextResponse.json({ ticket: data }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}
