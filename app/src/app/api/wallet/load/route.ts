import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, voiceCommand } = await req.json()
  if (!amount || amount <= 0 || amount > 100000) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
  }

  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('id, balance')
    .eq('user_id', session.userId)
    .single()

  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })

  const newBalance = Number(wallet.balance) + Number(amount)

  await supabaseAdmin
    .from('wallets')
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq('id', wallet.id)

  await supabaseAdmin.from('transactions').insert({
    wallet_id:     wallet.id,
    type:          'load',
    amount,
    balance_after: newBalance,
    voice_command: voiceCommand ?? null,
  })

  return NextResponse.json({ success: true, newBalance })
}
