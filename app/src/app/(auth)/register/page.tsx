'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'

export default function RegisterPage() {
  const [phone,    setPhone]    = useState('')
  const [fullName, setFullName] = useState('')
  const [pin,      setPin]      = useState('')
  const [pin2,     setPin2]     = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const submit = async () => {
    if (!phone || !fullName || pin.length !== 6) {
      setError('सबै विवरण भर्नुहोस्।'); return
    }
    if (pin !== pin2) { setError('PIN मेल खाएन।'); return }
    setLoading(true); setError('')
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, fullName, pin }),
    })
    const d = await r.json()
    if (r.ok) {
      localStorage.setItem('speakpay_user', JSON.stringify(d.user))
      window.location.href = '/dashboard'
    } else {
      setError(d.error === 'Phone already registered'
        ? 'यो फोन नम्बर पहिले नै दर्ता छ।' : d.error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-teal flex items-center justify-center p-4">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="card w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <h1 className="display text-3xl text-teal font-semibold">SpeakPay</h1>
          <p className="nepali text-slate-500 text-sm mt-1">नयाँ खाता बनाउनुहोस्</p>
        </div>

        <div className="space-y-4">
          {[
            { label:'पूरा नाम', value:fullName, set:setFullName, type:'text',     ph:'राम बहादुर श्रेष्ठ' },
            { label:'फोन नम्बर', value:phone,    set:setPhone,    type:'tel',      ph:'98XXXXXXXX' },
            { label:'PIN (६ अंक)', value:pin,   set:setPin,      type:'password', ph:'••••••', max:6 },
            { label:'PIN पुनः लेख्नुहोस्', value:pin2, set:setPin2, type:'password', ph:'••••••', max:6 },
          ].map(f => (
            <div key={f.label}>
              <label className="nepali text-xs text-slate-500 font-medium mb-1.5 block">{f.label}</label>
              <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)}
                maxLength={f.max} placeholder={f.ph}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal"
              />
            </div>
          ))}

          {error && <p className="nepali text-red-500 text-sm text-center">{error}</p>}

          <button onClick={submit} disabled={loading}
            className="w-full bg-teal text-white rounded-xl py-3 font-medium nepali hover:bg-teal-light transition disabled:opacity-60 mt-2">
            {loading ? 'दर्ता गर्दैछु…' : 'खाता बनाउनुहोस्'}
          </button>
        </div>

        <p className="text-center text-sm text-slate-400 mt-6 nepali">
          खाता छ?{' '}
          <a href="/login" className="text-teal hover:underline">प्रवेश गर्नुहोस्</a>
        </p>
      </motion.div>
    </div>
  )
}
