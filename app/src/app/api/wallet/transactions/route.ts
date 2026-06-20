import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: wallet } = await supabaseAdmin
    .from('wallets').select('id').eq('user_id', session.userId).single()
  if (!wallet) return NextResponse.json({ transactions: [] })

  const { data: txs } = await supabaseAdmin
    .from('transactions')
    .select('id, type, amount, balance_after, note, voice_command, created_at')
    .eq('wallet_id', wallet.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ transactions: txs ?? [] })
}
