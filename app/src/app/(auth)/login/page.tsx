'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { VoiceButton } from '@/components/voice/VoiceButton'
import { createRecorder, transcribeBlob } from '@/lib/asr'
import { speak, cancel, preloadVoices } from '@/lib/tts'
import { extractPhoneNumber, extractPIN } from '@/lib/nlp'

type AuthState = 
  | 'idle' 
  | 'recording_phone' 
  | 'processing_phone' 
  | 'recording_pin' 
  | 'processing_pin' 
  | 'authenticating'

export default function LoginPage() {
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const [phone, setPhone] = useState('')
  const [pin,   setPin]   = useState('')
  const [error, setError] = useState('')
  const [authState, setAuthState] = useState<AuthState>('idle')
  const [loading, setLoading] = useState(false)
  
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null)

  useEffect(() => {
    if (mode === 'voice') {
      preloadVoices()
      speak('आफ्नो खातामा प्रवेश गर्न, बटन थिच्नुहोस् र आफ्नो दश अंकको फोन नम्बर भन्नुहोस्।')
    } else {
      cancel()
    }
    return () => cancel()
  }, [mode])

  const startPhoneRecording = async () => {
    cancel(); setError(''); setAuthState('recording_phone'); speak('सुन्दैछु…')
    recorderRef.current = createRecorder(async (blob) => {
      setAuthState('processing_phone')
      try {
        const result = await transcribeBlob(blob, { allowFallback: true })
        const extracted = extractPhoneNumber(result.transcript)
        if (extracted) {
          setPhone(extracted); setAuthState('idle'); speak('अब फेरि बटन थिच्नुहोस् र तपाईंको ६ अंकको PIN भन्नुहोस्।')
        } else {
          setError('फोन नम्बर बुझिएन।'); setAuthState('idle'); speak('फोन नम्बर बुझिएन। फेरि भन्नुहोस्।')
        }
      } catch (err) {
        setError('ASR त्रुटि भयो।'); setAuthState('idle'); speak('त्रुटि भयो।')
      }
    })
    try { await recorderRef.current.start() } catch { setError('माइक्रोफोन अस्वीकार।'); setAuthState('idle') }
  }

  const startPinRecording = async () => {
    cancel(); setError(''); setAuthState('recording_pin'); speak('सुन्दैछु…')
    recorderRef.current = createRecorder(async (blob) => {
      setAuthState('processing_pin')
      try {
        const result = await transcribeBlob(blob, { allowFallback: true })
        const extracted = extractPIN(result.transcript)
        if (extracted) {
          setPin(extracted); authenticate(phone, extracted)
        } else {
          setError('PIN बुझिएन।'); setAuthState('idle'); speak('PIN बुझिएन। फेरि भन्नुहोस्।')
        }
      } catch (err) {
        setError('ASR त्रुटि भयो।'); setAuthState('idle'); speak('त्रुटि भयो।')
      }
    })
    try { await recorderRef.current.start() } catch { setError('माइक्रोफोन अस्वीकार।'); setAuthState('idle') }
  }

  const authenticate = async (ph: string, p: string) => {
    setAuthState('authenticating')
    setLoading(true)
    if (mode === 'voice') speak('खाता जाँच गर्दैछु…')
    
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: ph, pin: p }),
      })
      const d = await r.json()
      if (r.ok) {
        localStorage.setItem('speakpay_user', JSON.stringify(d.user))
        if (mode === 'voice') speak('प्रवेश सफल भयो।')
        setTimeout(() => { window.location.href = '/dashboard' }, 1500)
      } else {
        const msg = d.error === 'Invalid credentials' ? 'गलत फोन नम्बर वा PIN।' : d.error
        setError(msg)
        setPhone(''); setPin(''); setAuthState('idle'); setLoading(false)
        if (mode === 'voice') speak(msg + ' फेरि फोन नम्बर भन्न सुरु गर्नुहोस्।')
      }
    } catch {
      setError('सर्भर त्रुटि।')
      setAuthState('idle'); setLoading(false)
    }
  }

  const handleVoiceAction = () => {
    if (authState.startsWith('recording_')) recorderRef.current?.stop()
    else if (!phone) startPhoneRecording()
    else if (!pin) startPinRecording()
  }

  const isRecording = authState.startsWith('recording_')
  const isProcessing = authState.startsWith('processing_') || authState === 'authenticating'

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="card w-full max-w-sm p-8 flex flex-col items-center relative">
        
        {/* Mode Toggle */}
        <button onClick={() => setMode(m => m === 'voice' ? 'text' : 'voice')}
          className="absolute top-4 right-4 text-xs bg-slate-800 px-3 py-1.5 rounded-full text-slate-300 hover:text-white transition">
          {mode === 'voice' ? '⌨️ किबोर्ड' : '🎤 आवाज'}
        </button>

        <div className="text-center mb-8">
          <h1 className="display text-3xl text-teal font-semibold">SpeakPay</h1>
          <p className="nepali text-slate-400 text-sm mt-1">आफ्नो खातामा प्रवेश गर्नुहोस्</p>
        </div>

        {mode === 'voice' ? (
          <div className="flex flex-col items-center justify-center space-y-8 w-full">
            <VoiceButton stage={isProcessing ? 'processing' : isRecording ? 'recording' : 'idle'} onStart={handleVoiceAction} onStop={handleVoiceAction} />
            <div className="text-center w-full">
              <p className="nepali text-lg text-white font-medium min-h-[28px]">
                {authState === 'idle' && !phone && 'फोन नम्बर भन्नुहोस्'}
                {authState === 'recording_phone' && 'फोन नम्बर सुन्दैछु…'}
                {authState === 'processing_phone' && 'प्रशोधन गर्दैछु…'}
                {authState === 'idle' && phone && !pin && '६ अंकको PIN भन्नुहोस्'}
                {authState === 'recording_pin' && 'PIN सुन्दैछु…'}
                {authState === 'processing_pin' && 'प्रशोधन गर्दैछु…'}
                {authState === 'authenticating' && 'प्रवेश गर्दैछु…'}
              </p>
              {error && <p className="nepali text-red-500 text-sm mt-2">{error}</p>}
            </div>
            <div className="w-full space-y-2 bg-glass-light border border-glass-border rounded-xl p-4">
               <div className="flex justify-between items-center">
                  <span className="nepali text-slate-400 text-sm">फोन नम्बर:</span>
                  <span className="text-white font-mono">{phone || '---'}</span>
               </div>
               <div className="flex justify-between items-center">
                  <span className="nepali text-slate-400 text-sm">PIN:</span>
                  <span className="text-white font-mono">{pin ? '••••••' : '---'}</span>
               </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <div>
              <label className="nepali text-xs text-slate-500 font-medium mb-1.5 block">फोन नम्बर</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="98XXXXXXXX"
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
            </div>
            <div>
              <label className="nepali text-xs text-slate-500 font-medium mb-1.5 block">PIN (६ अंक)</label>
              <input type="password" value={pin} onChange={e => setPin(e.target.value)} maxLength={6} placeholder="••••••"
                className="w-full bg-glass border border-glass-border rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
            </div>
            {error && <p className="nepali text-red-500 text-sm text-center">{error}</p>}
            <button onClick={() => authenticate(phone, pin)} disabled={loading}
              className="w-full bg-teal text-white rounded-xl py-3 font-medium nepali hover:bg-teal-light transition disabled:opacity-60 mt-2">
              {loading ? 'लोड हुँदैछ…' : 'प्रवेश गर्नुहोस्'}
            </button>
          </div>
        )}

        <p className="text-center text-sm text-slate-400 mt-8 nepali">
          नयाँ खाता? <a href="/register" className="text-teal hover:underline">दर्ता गर्नुहोस्</a>
        </p>
      </motion.div>
    </div>
  )
}
