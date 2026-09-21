/**
 * POST /api/telegram/send
 *
 * Thin adapter for sending Telegram messages from the inbox.
 * Delegates to the unified send core (sendMessageToConversation)
 * which routes telegram conversations through telegram-send.ts.
 *
 * Auth: requires authenticated user with account membership.
 * Rate-limited per user (shared budget with /api/whatsapp/send).
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit, rateLimitResponse, RATE_LIMITS } from '@/lib/rate-limit'
import { sendMessageToConversation, SendMessageError } from '@/lib/whatsapp/send-message'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = checkRateLimit(`send:${user.id}`, RATE_LIMITS.send)
    if (!limit.success) return rateLimitResponse(limit)

    const { data: profile } = await supabase
      .from('profiles')
      .select('account_id')
      .eq('user_id', user.id)
      .maybeSingle()
    const accountId = profile?.account_id as string | undefined
    if (!accountId) {
      return NextResponse.json({ error: 'Your profile is not linked to an account.' }, { status: 403 })
    }

    const body = await request.json()
    const { conversation_id, message_type, content_text, media_url, filename, reply_to_message_id } = body

    if (!conversation_id || !message_type) {
      return NextResponse.json({ error: 'conversation_id and message_type are required' }, { status: 400 })
    }

    // Verify conversation belongs to this account and is a telegram conversation
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('id, platform')
      .eq('id', conversation_id)
      .eq('account_id', accountId)
      .single()

    if (convError || !conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }
    if (conv.platform !== 'telegram') {
      return NextResponse.json({ error: 'This endpoint is for Telegram conversations only' }, { status: 400 })
    }

    try {
      const result = await sendMessageToConversation(supabase, accountId, {
        conversationId: conversation_id,
        messageType: message_type,
        contentText: content_text,
        mediaUrl: media_url,
        filename,
        replyToMessageId: reply_to_message_id,
      })
      return NextResponse.json({ success: true, message_id: result.messageId })
    } catch (err) {
      if (err instanceof SendMessageError) {
        return NextResponse.json({ error: err.message }, { status: err.status })
      }
      throw err
    }
  } catch (err) {
    console.error('[telegram/send] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
