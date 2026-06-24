'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, MicOff, Send, Download, History, LogOut, Volume2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

type TxType = 'send' | 'receive' | 'load'
interface Tx { id: string; type: TxType; amount: number; balance_after: number; created_at: string; voice_command?: string }
interface Intent {
  action: 'send' | 'load' | 'balance' | 'unknown'
  amount?: number
  recipient?: string
  raw: string
}

import { createRecorder, transcribeBlob } from '@/lib/asr'
import { extractPIN } from '@/lib/nlp'

type Stage = 'idle' | 'recording_command' | 'processing_command' | 'confirm' | 'recording_pin' | 'processing_pin' | 'executing' | 'done' | 'error'

export default function Dashboard() {
  const [balance,    setBalance]    = useState<number | null>(null)
  const [userName,   setUserName]   = useState('')
  const [stage,      setStage]      = useState<Stage>('idle')
  const [transcript, setTranscript] = useState('')
  const [intent,     setIntent]     = useState<Intent | null>(null)
  const [message,    setMessage]    = useState('')
  const [txs,        setTxs]        = useState<Tx[]>([])
  const [showHistory,setShowHistory]= useState(false)
  const [toast,      setToast]      = useState<{title:string, body:string} | null>(null)

  const recorderRef = useRef<{ start:()=>void, stop:()=>void } | null>(null)

  // ── Fetch balance ────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    const r = await fetch('/api/wallet/balance')
    if (r.ok) { const d = await r.json(); setBalance(d.balance) }
  }, [])

  const fetchTxs = useCallback(async () => {
    const r = await fetch('/api/wallet/transactions')
    if (r.ok) { const d = await r.json(); setTxs(d.transactions) }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('speakpay_user')
    if (stored) { const u = JSON.parse(stored); setUserName(u.fullName ?? u.phone) }
    fetchBalance()
    fetchTxs()
  }, [fetchBalance, fetchTxs])

  // ── Text-to-speech ───────────────────────────────────────────
  const speak = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve()
      const u = new SpeechSynthesisUtterance(text)
      u.lang  = 'ne-NP'
      u.rate  = 0.9
      u.onend = () => resolve()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(u)
    })
  }

  // ── Announce balance ─────────────────────────────────────────
  const announceBalance = () => {
    if (balance !== null) speak(`तपाईंको ब्यालेन्स रुपैयाँ ${balance} छ।`)
  }

  // ── Start recording ──────────────────────────────────────────
  const startRecordingCommand = async () => {
    setStage('recording_command')
    await speak('सुन्दैछु…')
    recorderRef.current = createRecorder(async (blob) => {
      setStage('processing_command')
      try {
        const result = await transcribeBlob(blob, { allowFallback: true })
        setTranscript(result.transcript)
        setIntent(result.intent)
        
        if (result.intent.action === 'balance') {
          await fetchBalance()
          setStage('done')
          setMessage(`ब्यालेन्स: रु ${balance}`)
          speak(`तपाईंको ब्यालेन्स रुपैयाँ ${balance} छ।`)
        } else if (result.intent.action === 'unknown') {
          setMessage('माफ गर्नुस्, फेरि भन्नुहोस्।')
          setStage('error')
          speak('माफ गर्नुस्, फेरि भन्नुहोस्।')
        } else {
          setStage('confirm')
          const msg = result.intent.action === 'send'
            ? `${result.intent.recipient}लाई रु ${result.intent.amount} पठाउने हो? पुष्टि गर्न आफ्नो ६ अंकको PIN भन्नुहोस्।`
            : `खातामा रु ${result.intent.amount} लोड गर्ने हो? पुष्टि गर्न आफ्नो ६ अंकको PIN भन्नुहोस्।`
          await speak(msg)
          startRecordingPin(result.intent, result.transcript)
        }
      } catch {
        setMessage('त्रुटि भयो। फेरि प्रयास गर्नुहोस्।')
        setStage('error')
      }
    })
    recorderRef.current.start()
  }

  const startRecordingPin = (currentIntent: Intent, currentTranscript: string) => {
    setStage('recording_pin')
    recorderRef.current = createRecorder(async (blob) => {
      setStage('processing_pin')
      try {
        const result = await transcribeBlob(blob, { forceBrowserASR: true, allowFallback: true })
        const pin = extractPIN(result.transcript)
        if (pin) {
          executeIntent(currentIntent, currentTranscript, pin)
        } else {
          setMessage('PIN बुझिएन। फेरि प्रयास गर्नुहोस्।')
          setStage('error')
          speak('PIN बुझिएन। फेरि प्रयास गर्नुहोस्।')
        }
      } catch {
        setMessage('त्रुटि भयो। फेरि प्रयास गर्नुहोस्।')
        setStage('error')
      }
    })
    recorderRef.current.start()
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
  }

  // ── Execute confirmed intent ─────────────────────────────────
  const executeIntent = async (intentToExec: Intent, voiceCmd: string, pin: string) => {
    setStage('executing')

    if (intentToExec.action === 'send') {
      const r = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: intentToExec.recipient,
          amount: intentToExec.amount,
          voiceCommand: voiceCmd,
          pin,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        setBalance(d.newBalance)
        setMessage(`रु ${intentToExec.amount} ${d.recipient}लाई सफलतापूर्वक पठाइयो।`)
        speak(`रु ${intentToExec.amount} सफलतापूर्वक पठाइयो।`)
        setStage('done')
        fetchTxs()
        
        // System Notification
        setToast({ title: 'SpeakPay Alert', body: `तपाईंको खाताबाट रु ${intentToExec.amount} ${d.recipient} लाई पठाइयो। नयाँ ब्यालेन्स रु ${d.newBalance} छ।` })
        setTimeout(() => setToast(null), 5000)
      } else {
        const errMsg = d.error === 'insufficient_funds'
          ? 'अपर्याप्त ब्यालेन्स।'
          : d.error === 'recipient_not_found'
          ? 'प्राप्तकर्ता फेला परेन।'
          : d.error === 'Invalid PIN'
          ? 'गलत PIN।'
          : 'पठाउन असफल भयो।'
        setMessage(errMsg); speak(errMsg); setStage('error')
      }
    } else if (intentToExec.action === 'load') {
      const r = await fetch('/api/wallet/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: intentToExec.amount, voiceCommand: voiceCmd, pin }),
      })
      const d = await r.json()
      if (r.ok) {
        setBalance(d.newBalance)
        setMessage(`रु ${intentToExec.amount} सफलतापूर्वक लोड भयो।`)
        speak(`रु ${intentToExec.amount} सफलतापूर्वक लोड भयो।`)
        setStage('done')
        fetchTxs()
        
        // System Notification
        setToast({ title: 'SpeakPay Alert', body: `तपाईंको खातामा रु ${intentToExec.amount} लोड गरियो। नयाँ ब्यालेन्स रु ${d.newBalance} छ।` })
        setTimeout(() => setToast(null), 5000)
      } else {
        const errMsg = d.error === 'Invalid PIN' ? 'गलत PIN।' : 'लोड असफल भयो।'
        setMessage(errMsg); speak(errMsg); setStage('error')
      }
    }
  }

  const reset = () => {
    setStage('idle'); setTranscript(''); setIntent(null); setMessage('')
  }

  return (
    <div className="min-h-screen flex flex-col relative z-0">
      
      {/* ── System Notification ── */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: -50, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -50, x: '-50%' }}
            className="fixed top-6 left-1/2 z-50 w-[90%] max-w-sm bg-white rounded-2xl shadow-xl p-4 flex gap-3 items-start">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-green-600">💬</span>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{toast.title}</p>
              <p className="text-slate-600 text-xs mt-0.5 leading-relaxed nepali">{toast.body}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <header className="bg-glass border-b border-glass-border px-6 py-4 flex items-center justify-between shadow-float">
        <div>
          <p className="text-teal-light text-sm font-medium nepali">नमस्ते,</p>
          <h1 className="display text-xl font-semibold">{userName}</h1>
        </div>
        <div className="flex gap-3">
          <button onClick={announceBalance} aria-label="ब्यालेन्स सुन्नुहोस्"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <Volume2 size={18} />
          </button>
          <button onClick={async () => {
            await fetch('/api/auth/login', { method: 'DELETE' })
            localStorage.removeItem('speakpay_user')
            window.location.href = '/login'
          }} aria-label="लगआउट" className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-md mx-auto w-full space-y-4">
        {/* ── Balance card ── */}
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
          className="card p-6 bg-gradient-to-br from-teal to-teal-dark text-white">
          <p className="text-white/70 text-sm nepali">कुल ब्यालेन्स</p>
          <p className="display text-4xl font-semibold mt-1">
            {balance === null ? '—' : `रु ${balance.toLocaleString()}`}
          </p>
          <div className="flex gap-2 mt-4">
            <a href="/send"
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-xl px-4 py-2 text-sm font-medium transition">
              <Send size={14}/> <span className="nepali">पठाउनुहोस्</span>
            </a>
            <a href="/load"
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 rounded-xl px-4 py-2 text-sm font-medium transition">
              <Download size={14}/> <span className="nepali">लोड गर्नुहोस्</span>
            </a>
          </div>
        </motion.div>

        {/* ── Voice command hub ── */}
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0, transition:{ delay:0.1 }}}
          className="card p-6 flex flex-col items-center gap-4">
          <p className="text-slate-600 text-sm nepali text-center">
            बोलेर आदेश दिनुहोस्
          </p>

          {/* Main voice button */}
          <div className="relative flex items-center justify-center">
            {(stage === 'recording_command' || stage === 'recording_pin') && (
              <>
                <span className="absolute inset-0 rounded-full bg-teal/20 animate-ping" />
                <span className="absolute inset-[-12px] rounded-full border-2 border-teal/30 animate-pulse" />
              </>
            )}
            <button
              onClick={stage === 'idle' || stage === 'done' || stage === 'error'
                ? startRecordingCommand
                : (stage === 'recording_command' || stage === 'recording_pin') ? stopRecording : undefined}
              disabled={stage === 'processing_command' || stage === 'processing_pin' || stage === 'executing' || stage === 'confirm'}
              aria-label={(stage === 'recording_command' || stage === 'recording_pin') ? 'रोक्नुहोस्' : 'बोल्न सुरु गर्नुहोस्'}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-float transition-all
                ${(stage === 'recording_command' || stage === 'recording_pin')
                  ? 'bg-red-500 hover:bg-red-600 scale-110'
                  : 'bg-teal hover:bg-teal-light'
                } text-white disabled:opacity-50`}>
              {(stage === 'recording_command' || stage === 'recording_pin') ? <MicOff size={28}/> : <Mic size={28}/>}
            </button>
          </div>

          {/* Waveform during recording */}
          {(stage === 'recording_command' || stage === 'recording_pin') && (
            <div className="flex items-center gap-1 h-8">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="waveform-bar h-full"
                  style={{ animationDelay: `${i*0.1}s` }} />
              ))}
            </div>
          )}

          {/* Status text */}
          <AnimatePresence mode="wait">
            <motion.p key={stage}
              initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
              className="text-sm text-slate-500 text-center nepali min-h-[1.5rem]">
              {stage === 'idle'       && 'माइक थिच्नुहोस् र नेपालीमा बोल्नुहोस्'}
              {stage === 'recording_command'  && 'आदेश सुन्दैछु…'}
              {stage === 'recording_pin'      && 'PIN सुन्दैछु…'}
              {(stage === 'processing_command' || stage === 'processing_pin') && 'विश्लेषण गर्दैछु…'}
              {stage === 'confirm'    && 'पुष्टि गर्दै…'}
              {stage === 'executing'  && 'कार्यान्वयन गर्दैछु…'}
              {stage === 'error'      && message}
              {stage === 'done'       && message}
            </motion.p>
          </AnimatePresence>

          {/* Transcript display */}
          {transcript && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              className="w-full bg-glass border border-glass-border rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">तपाईंले भन्नुभयो:</p>
              <p className="nepali text-sm text-slate-200">{transcript}</p>
            </motion.div>
          )}

          {(stage === 'done' || stage === 'error') && (
            <button onClick={reset}
              className="text-teal text-sm nepali hover:underline">
              फेरि प्रयास गर्नुहोस्
            </button>
          )}

          {/* Example commands */}
          {stage === 'idle' && (
            <div className="w-full mt-2">
              <p className="text-xs text-slate-400 mb-2 text-center">उदाहरण आदेशहरू:</p>
              <div className="space-y-1.5">
                {[
                  'रामलाई ५०० रुपैयाँ पठाउ',
                  'खातामा १०००  रुपैयाँ लोड गर',
                  'मेरो ब्यालेन्स कति छ',
                ].map(ex => (
                  <p key={ex} className="nepali text-xs text-slate-400 bg-glass rounded-lg px-3 py-2 border border-glass-border">
                    "{ex}"
                  </p>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* ── Recent transactions ── */}
        <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0, transition:{ delay:0.2 }}}
          className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-glass-border">
            <h2 className="font-medium text-white nepali">भर्खरका लेनदेन</h2>
            <button onClick={() => setShowHistory(!showHistory)}
              className="text-teal text-sm nepali flex items-center gap-1">
              <History size={14}/> सबै
            </button>
          </div>
          {txs.slice(0, showHistory ? 20 : 5).map(tx => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-3 border-b border-glass-border last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold
                  ${tx.type === 'receive' || tx.type === 'load' ? 'bg-teal' : 'bg-slate-400'}`}>
                  {tx.type === 'receive' ? '↓' : tx.type === 'load' ? '+' : '↑'}
                </div>
                <div>
                  <p className="nepali text-sm text-slate-200 capitalize">
                    {tx.type === 'send' ? 'पठाइयो' : tx.type === 'receive' ? 'प्राप्त' : 'लोड'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(tx.created_at).toLocaleDateString('ne-NP')}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-semibold text-sm ${tx.type === 'send' ? 'text-slate-200' : 'text-teal-light'}`}>
                  {tx.type === 'send' ? '-' : '+'}रु {tx.amount}
                </p>
                <p className="text-xs text-slate-400">रु {tx.balance_after}</p>
              </div>
            </div>
          ))}
          {txs.length === 0 && (
            <p className="nepali text-sm text-slate-400 text-center py-6">कुनै लेनदेन छैन।</p>
          )}
        </motion.div>

        {/* ── Research Data Link ── */}
        <motion.a href="/report" initial={{ opacity:0 }} animate={{ opacity:1, transition:{ delay:0.3 }}}
          className="card p-4 flex items-center justify-between hover:border-teal/40 transition group">
          <div>
            <p className="font-medium text-white text-sm">अनुसन्धान डाटा र रिपोर्ट</p>
            <p className="text-xs text-slate-400 mt-0.5">तथ्याङ्क र बेन्चमार्क हेर्नुहोस्</p>
          </div>
          <span className="text-teal group-hover:translate-x-1 transition-transform">→</span>
        </motion.a>
      </main>
    </div>
  )
}
