import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: wallet } = await supabaseAdmin
    .from('wallets')
    .select('balance, updated_at')
    .eq('user_id', session.userId)
    .single()

  if (!wallet) return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
  return NextResponse.json({ balance: wallet.balance, updatedAt: wallet.updated_at })
}
