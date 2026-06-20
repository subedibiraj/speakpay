'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [pin,   setPin]   = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!phone || pin.length !== 6) { setError('फोन नम्बर र ६ अंकको PIN आवश्यक छ।'); return }
    setLoading(true); setError('')
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin }),
    })
    const d = await r.json()
    if (r.ok) {
      localStorage.setItem('speakpay_user', JSON.stringify(d.user))
      window.location.href = '/dashboard'
    } else {
      setError(d.error === 'Invalid credentials' ? 'गलत फोन नम्बर वा PIN।' : d.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="card w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="display text-3xl text-teal font-semibold">SpeakPay</h1>
          <p className="nepali text-slate-400 text-sm mt-1">आफ्नो खातामा प्रवेश गर्नुहोस्</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="nepali text-xs text-slate-500 font-medium mb-1.5 block">
              फोन नम्बर
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
          </div>
          <div>
            <label className="nepali text-xs text-slate-500 font-medium mb-1.5 block">
              PIN (६ अंक)
            </label>
            <input type="password" value={pin} onChange={e => setPin(e.target.value)}
              maxLength={6} placeholder="••••••"
              className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
            />
          </div>

          {error && <p className="nepali text-red-500 text-sm text-center">{error}</p>}

          <button onClick={submit} disabled={loading}
            className="w-full bg-teal text-white rounded-xl py-3 font-medium nepali hover:bg-teal-light transition disabled:opacity-60 mt-2">
            {loading ? 'लोड हुँदैछ…' : 'प्रवेश गर्नुहोस्'}
          </button>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6 nepali">
          नयाँ खाता?{' '}
          <a href="/register" className="text-teal hover:underline">दर्ता गर्नुहोस्</a>
        </p>
      </motion.div>
    </div>
  )
}
