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

type Stage = 'idle' | 'recording' | 'processing' | 'confirm' | 'executing' | 'done' | 'error'

export default function Dashboard() {
  const [balance,    setBalance]    = useState<number | null>(null)
  const [userName,   setUserName]   = useState('')
  const [stage,      setStage]      = useState<Stage>('idle')
  const [transcript, setTranscript] = useState('')
  const [intent,     setIntent]     = useState<Intent | null>(null)
  const [message,    setMessage]    = useState('')
  const [txs,        setTxs]        = useState<Tx[]>([])
  const [showHistory,setShowHistory]= useState(false)

  const mediaRef    = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const audioRef    = useRef<HTMLAudioElement | null>(null)

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
  const speak = (text: string) => {
    if (typeof window === 'undefined') return
    const u = new SpeechSynthesisUtterance(text)
    u.lang  = 'ne-NP'
    u.rate  = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }

  // ── Announce balance ─────────────────────────────────────────
  const announceBalance = () => {
    if (balance !== null) speak(`तपाईंको ब्यालेन्स रुपैयाँ ${balance} छ।`)
  }

  // ── Start recording ──────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); processAudio() }
      mediaRef.current = mr
      mr.start()
      setStage('recording')
      speak('सुन्दैछु…')
    } catch {
      setMessage('माइक्रोफोन पहुँच अस्वीकार।')
      setStage('error')
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setStage('processing')
  }

  // ── Process audio via /api/transcribe ────────────────────────
  const processAudio = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const fd   = new FormData()
    fd.append('audio', blob, 'command.wav')

    try {
      const r = await fetch('/api/transcribe', { method: 'POST', body: fd })
      if (r.status === 503) {
        setMessage('मोडेल लोड हुँदैछ, कृपया २० सेकेन्ड पछि फेरि प्रयास गर्नुहोस्।')
        setStage('error'); return
      }
      const d = await r.json()
      setTranscript(d.transcript)
      setIntent(d.intent)

      if (d.intent.action === 'balance') {
        await fetchBalance()
        setStage('done')
        setMessage(`ब्यालेन्स: रु ${balance}`)
        speak(`तपाईंको ब्यालेन्स रुपैयाँ ${balance} छ।`)
      } else if (d.intent.action === 'unknown') {
        setMessage('माफ गर्नुस्, फेरि भन्नुहोस्।')
        setStage('error')
        speak('माफ गर्नुस्, फेरि भन्नुहोस्।')
      } else {
        setStage('confirm')
        const msg = d.intent.action === 'send'
          ? `${d.intent.recipient}लाई रु ${d.intent.amount} पठाउने हो?`
          : `खातामा रु ${d.intent.amount} लोड गर्ने हो?`
        speak(msg)
      }
    } catch {
      setMessage('त्रुटि भयो। फेरि प्रयास गर्नुहोस्।')
      setStage('error')
    }
  }

  // ── Execute confirmed intent ─────────────────────────────────
  const executeIntent = async () => {
    if (!intent) return
    setStage('executing')

    if (intent.action === 'send') {
      const r = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientPhone: intent.recipient,
          amount: intent.amount,
          voiceCommand: transcript,
        }),
      })
      const d = await r.json()
      if (r.ok) {
        setBalance(d.newBalance)
        setMessage(`रु ${intent.amount} ${d.recipient}लाई सफलतापूर्वक पठाइयो।`)
        speak(`रु ${intent.amount} सफलतापूर्वक पठाइयो।`)
        setStage('done')
        fetchTxs()
      } else {
        const errMsg = d.error === 'insufficient_funds'
          ? 'अपर्याप्त ब्यालेन्स।'
          : d.error === 'recipient_not_found'
          ? 'प्राप्तकर्ता फेला परेन।'
          : 'पठाउन असफल भयो।'
        setMessage(errMsg); speak(errMsg); setStage('error')
      }
    } else if (intent.action === 'load') {
      const r = await fetch('/api/wallet/load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: intent.amount, voiceCommand: transcript }),
      })
      const d = await r.json()
      if (r.ok) {
        setBalance(d.newBalance)
        setMessage(`रु ${intent.amount} सफलतापूर्वक लोड भयो।`)
        speak(`रु ${intent.amount} सफलतापूर्वक लोड भयो।`)
        setStage('done')
        fetchTxs()
      } else {
        setMessage('लोड असफल भयो।'); setStage('error')
      }
    }
  }

  const reset = () => {
    setStage('idle'); setTranscript(''); setIntent(null); setMessage('')
  }

  return (
    <div className="min-h-screen flex flex-col relative z-0">
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
            {stage === 'recording' && (
              <>
                <span className="absolute inset-0 rounded-full bg-teal/20 animate-ping" />
                <span className="absolute inset-[-12px] rounded-full border-2 border-teal/30 animate-pulse" />
              </>
            )}
            <button
              onClick={stage === 'idle' || stage === 'done' || stage === 'error'
                ? startRecording
                : stage === 'recording' ? stopRecording : undefined}
              disabled={stage === 'processing' || stage === 'executing'}
              aria-label={stage === 'recording' ? 'रोक्नुहोस्' : 'बोल्न सुरु गर्नुहोस्'}
              className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-float transition-all
                ${stage === 'recording'
                  ? 'bg-red-500 hover:bg-red-600 scale-110'
                  : 'bg-teal hover:bg-teal-light'
                } text-white disabled:opacity-50`}>
              {stage === 'recording' ? <MicOff size={28}/> : <Mic size={28}/>}
            </button>
          </div>

          {/* Waveform during recording */}
          {stage === 'recording' && (
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
              {stage === 'recording'  && 'सुन्दैछु… रोक्न फेरि थिच्नुहोस्'}
              {stage === 'processing' && 'विश्लेषण गर्दैछु…'}
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

          {/* Confirmation prompt */}
          {stage === 'confirm' && intent && (
            <motion.div initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
              className="w-full space-y-3">
              <div className="bg-amber/10 border border-amber/30 rounded-xl p-3 text-center">
                <p className="nepali text-sm font-medium text-amber-800">
                  {intent.action === 'send'
                    ? `${intent.recipient}लाई रु ${intent.amount} पठाउने हो?`
                    : `खातामा रु ${intent.amount} लोड गर्ने हो?`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={executeIntent}
                  className="flex-1 bg-teal text-white rounded-xl py-3 font-medium nepali hover:bg-teal-light transition">
                  हो, पुष्टि गर्नुहोस्
                </button>
                <button onClick={reset}
                  className="flex-1 bg-ink-800 text-slate-300 rounded-xl py-3 font-medium nepali hover:bg-ink-900 transition border border-glass-border">
                  रद्द गर्नुहोस्
                </button>
              </div>
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

        {/* ── Research demo link ── */}
        <motion.a href="/demo" initial={{ opacity:0 }} animate={{ opacity:1, transition:{ delay:0.3 }}}
          className="card p-4 flex items-center justify-between hover:border-teal/40 transition group">
          <div>
            <p className="font-medium text-white text-sm">ASR बेन्चमार्क डेमो</p>
            <p className="text-xs text-slate-400 mt-0.5">तीन मोडेलको तुलना गर्नुहोस्</p>
          </div>
          <span className="text-teal group-hover:translate-x-1 transition-transform">→</span>
        </motion.a>
      </main>
    </div>
  )
}
