'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Download } from 'lucide-react'

export default function LoadPage() {
  const [amount, setAmount] = useState('')
  const [status, setStatus] = useState<'idle'|'loading'|'success'|'error'>('idle')
  const [msg, setMsg] = useState('')

  const handleLoad = async () => {
    if (!amount) return
    setStatus('loading')
    try {
      const r = await fetch('/api/wallet/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(amount) })
      })
      if (r.ok) {
        setStatus('success')
        setMsg(`रु ${amount} सफलतापूर्वक लोड भयो।`)
        setTimeout(() => window.location.href='/dashboard', 2000)
      } else {
        setStatus('error')
        setMsg('त्रुटि भयो।')
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
        <h1 className="text-xl font-semibold text-center text-white mb-6 mt-4 nepali">लोड गर्नुहोस्</h1>
        
        <div className="space-y-4">
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

          <button onClick={handleLoad} disabled={status==='loading'}
            className="w-full bg-teal text-white rounded-xl py-3 font-medium flex justify-center items-center gap-2 hover:bg-teal-light transition disabled:opacity-50 mt-4 nepali">
            {status === 'loading' ? 'लोड गर्दै...' : <><Download size={16}/> लोड गर्नुहोस्</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
