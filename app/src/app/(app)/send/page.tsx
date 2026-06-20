'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Send } from 'lucide-react'

export default function SendPage() {
  const [phone, setPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [msg, setMsg] = useState('')

  const handleSend = async () => {
    if (!phone || !amount) return
    setStatus('loading')
    try {
      const r = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientPhone: phone, amount: Number(amount) })
      })
      const d = await r.json()
      if (r.ok) {
        setStatus('success')
        setMsg(`रु ${amount} सफलतापूर्वक पठाइयो।`)
        setTimeout(() => window.location.href='/dashboard', 2000)
      } else {
        setStatus('error')
        setMsg(d.error === 'recipient_not_found' ? 'प्राप्तकर्ता फेला परेन।' : d.error === 'insufficient_funds' ? 'अपर्याप्त ब्यालेन्स।' : 'त्रुटि भयो।')
      }
    } catch {
      setStatus('error')
      setMsg('सर्भर त्रुटि।')
    }
  }

  return (
    <div className="min-h-screen p-4 flex justify-center items-center">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} className="card w-full max-w-sm p-6 relative">
        <a href="/dashboard" className="absolute top-4 left-4 text-slate-400 hover:text-white transition">
          <ArrowLeft size={20} />
        </a>
        <h1 className="text-xl font-semibold text-center text-white mb-6 mt-4 nepali">पठाउनुहोस्</h1>
        
        <div className="space-y-4">
          <div>
            <label className="nepali text-xs text-slate-400 mb-1 block">प्राप्तकर्ताको फोन नम्बर वा नाम</label>
            <input type="text" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="98XXXXXXXX वा राम" 
              className="w-full bg-glass border border-glass-border rounded-xl p-3 text-white focus:outline-none focus:border-teal text-sm" />
          </div>
          <div>
            <label className="nepali text-xs text-slate-400 mb-1 block">रकम (रु)</label>
            <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="500" 
              className="w-full bg-glass border border-glass-border rounded-xl p-3 text-white focus:outline-none focus:border-teal text-sm" />
          </div>
          
          {msg && (
            <p className={`text-sm text-center nepali ${status==='success'?'text-teal':'text-red-400'}`}>
              {msg}
            </p>
          )}

          <button onClick={handleSend} disabled={status==='loading'}
            className="w-full bg-teal text-white rounded-xl py-3 font-medium flex justify-center items-center gap-2 hover:bg-teal-light transition disabled:opacity-50 mt-4 nepali">
            {status === 'loading' ? 'पठाउँदै...' : <><Send size={16}/> पठाउनुहोस्</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
