import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { phone, fullName, pin } = await req.json()

  if (!phone || !fullName || !pin || pin.length !== 6) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Check duplicate phone
  const { data: existing } = await supabaseAdmin
    .from('users').select('id').eq('phone', phone).single()
  if (existing) {
    return NextResponse.json({ error: 'Phone already registered' }, { status: 409 })
  }

  const pinHash = await bcrypt.hash(pin, 10)

  // Create user
  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .insert({ phone, full_name: fullName, pin_hash: pinHash })
    .select().single()

  if (userErr || !user) {
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }

  // Create wallet with ₹100 welcome balance
  await supabaseAdmin
    .from('wallets')
    .insert({ user_id: user.id, balance: 100.00 })

  const token = await signToken({ userId: user.id, phone: user.phone })
  const res   = NextResponse.json({
    user: { id: user.id, phone: user.phone, fullName: user.full_name }
  })
  res.cookies.set(setSessionCookie(token))
  return res
}
