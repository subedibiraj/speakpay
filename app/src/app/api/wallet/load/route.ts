import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, voiceCommand, pin } = await req.json()
  if (!amount || amount <= 0 || amount > 100000 || !pin) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, pin_hash')
    .eq('id', session.userId)
    .single()

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const validPin = await bcrypt.compare(pin, user.pin_hash)
  if (!validPin) {
    return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 })
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
