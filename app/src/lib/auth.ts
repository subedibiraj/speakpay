import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE = 'speakpay_token'
const TTL    = 60 * 60 * 24 * 7 // 7 days

export async function signToken(payload: { userId: string; phone: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET)
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as { userId: string; phone: string }
  } catch {
    return null
  }
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export function setSessionCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: TTL,
    path: '/',
  }
}

export function clearSessionCookie() {
  return { name: COOKIE, value: '', maxAge: 0, path: '/' }
}
