import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getCurrentAccount()

    const { searchParams } = request.nextUrl
    const status = searchParams.get('status')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = ctx.supabase
      .from('appointments')
      .select('*')
      .eq('account_id', ctx.accountId)
      .order('scheduled_at', { ascending: true })

    if (status) {
      query = query.eq('status', status)
    }
    if (dateFrom) {
      query = query.gte('scheduled_at', dateFrom)
    }
    if (dateTo) {
      query = query.lte('scheduled_at', dateTo)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to fetch appointments:', error)
      return NextResponse.json({ error: 'Failed to fetch appointments' }, { status: 500 })
    }

    return NextResponse.json({ appointments: data ?? [] })
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

    const { contact_id, title, description, scheduled_at, duration_minutes, location, notes } = body

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }
    if (!scheduled_at || typeof scheduled_at !== 'string') {
      return NextResponse.json({ error: 'scheduled_at is required' }, { status: 400 })
    }

    const { data, error } = await ctx.supabase
      .from('appointments')
      .insert({
        account_id: ctx.accountId,
        user_id: ctx.userId,
        contact_id: contact_id || null,
        title: title.trim(),
        description: typeof description === 'string' ? description.trim() || null : null,
        scheduled_at,
        duration_minutes: typeof duration_minutes === 'number' ? duration_minutes : null,
        location: typeof location === 'string' ? location.trim() || null : null,
        notes: typeof notes === 'string' ? notes.trim() || null : null,
        status: 'scheduled',
      })
      .select('*')
      .single()

    if (error) {
      console.error('Failed to create appointment:', error)
      return NextResponse.json({ error: 'Failed to create appointment' }, { status: 500 })
    }

    return NextResponse.json({ appointment: data }, { status: 201 })
  } catch (err) {
    return toErrorResponse(err)
  }
}
