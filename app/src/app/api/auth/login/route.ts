import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase'
import { signToken, setSessionCookie } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { phone, pin } = await req.json()

  if (!phone || !pin) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, phone, full_name, pin_hash')
    .eq('phone', phone)
    .single()

  if (!user) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const valid = await bcrypt.compare(pin, user.pin_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const token = await signToken({ userId: user.id, phone: user.phone })
  const res   = NextResponse.json({
    user: { id: user.id, phone: user.phone, fullName: user.full_name }
  })
  res.cookies.set(setSessionCookie(token))
  return res
}
