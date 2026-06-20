import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { recipientPhone, amount, voiceCommand } = await req.json()

  if (!recipientPhone || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Get sender wallet
  const { data: senderWallet } = await supabaseAdmin
    .from('wallets')
    .select('id, balance')
    .eq('user_id', session.userId)
    .single()

  if (!senderWallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  if (senderWallet.balance < amount) {
    return NextResponse.json({ error: 'insufficient_funds' }, { status: 400 })
  }

  // Get recipient (try exact phone match first, then fuzzy name match)
  let recipient = null;
  
  if (recipientPhone.match(/^\d+$/)) {
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .eq('phone', recipientPhone)
      .single()
    recipient = data
  } else {
    // It's a name like "राम" or "सिता", do a partial search
    const { data } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .ilike('full_name', `%${recipientPhone}%`)
      .limit(1)
      .single()
    recipient = data
  }

  if (!recipient) return NextResponse.json({ error: 'recipient_not_found' }, { status: 404 })

  const { data: recipientWallet } = await supabaseAdmin
    .from('wallets')
    .select('id')
    .eq('user_id', recipient.id)
    .single()

  if (!recipientWallet) return NextResponse.json({ error: 'recipient_not_found' }, { status: 404 })

  // Atomic transfer via DB function
  const { data: result } = await supabaseAdmin.rpc('transfer_funds', {
    p_from_wallet_id: senderWallet.id,
    p_to_wallet_id:   recipientWallet.id,
    p_amount:         amount,
    p_voice_command:  voiceCommand ?? null,
  })

  if (!result?.success) {
    return NextResponse.json({ error: result?.error ?? 'Transfer failed' }, { status: 400 })
  }

  return NextResponse.json({
    success:      true,
    newBalance:   result.from_balance,
    recipient:    recipient.full_name,
    amount,
    txId:         result.tx_id,
  })
}
