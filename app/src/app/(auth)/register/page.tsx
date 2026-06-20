'use client'
import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { VoiceButton } from '@/components/voice/VoiceButton'
import { createRecorder, transcribeBlob } from '@/lib/asr'
import { speak, cancel, preloadVoices } from '@/lib/tts'
import { extractPhoneNumber, extractPIN } from '@/lib/nlp'

type RegState = 
  | 'idle' 
  | 'recording_name' 
  | 'processing_name' 
  | 'recording_phone' 
  | 'processing_phone' 
  | 'recording_pin1' 
  | 'processing_pin1'
  | 'recording_pin2'
  | 'processing_pin2'
  | 'registering'

export default function RegisterPage() {
  const [mode, setMode] = useState<'voice' | 'text'>('voice')
  const [started, setStarted] = useState(false) // Blocks until tap
  
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [pin1, _setPin1] = useState('')
  const [pin2, setPin2] = useState('')
  const [error, setError] = useState('')
  const [regState, setRegState] = useState<RegState>('idle')
  const [loading, setLoading] = useState(false)
  
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null)
  const pin1Ref = useRef('')
  const setPin1 = (v: string) => { pin1Ref.current = v; _setPin1(v) }

  useEffect(() => {
    preloadVoices()
    return () => cancel()
  }, [])

  const handleTranscribe = async (blob: Blob) => {
    const result = await transcribeBlob(blob, { allowFallback: true })
    return result.transcript
  }

  const startName = async () => {
    cancel(); setError(''); setRegState('recording_name')
    recorderRef.current = createRecorder(async (blob) => {
      setRegState('processing_name')
      try {
        const text = await handleTranscribe(blob)
        if (text.length > 2) {
          setFullName(text); setRegState('idle'); 
          await speak('धन्यवाद। अब आफ्नो दश अंकको फोन नम्बर भन्नुहोस्।')
          startPhone()
        } else {
          throw new Error()
        }
      } catch {
        setError('नाम बुझिएन।'); setRegState('idle'); 
        await speak('नाम बुझिएन। फेरि भन्नुहोस्।')
        startName()
      }
    })
    try { await recorderRef.current.start() } catch { setError('माइक्रोफोन अस्वीकार।'); setRegState('idle') }
  }

  const startPhone = async () => {
    cancel(); setError(''); setRegState('recording_phone')
    recorderRef.current = createRecorder(async (blob) => {
      setRegState('processing_phone')
      try {
        const text = await handleTranscribe(blob)
        const extracted = extractPhoneNumber(text)
        if (extracted) {
          setPhone(extracted); setRegState('idle'); 
          await speak('अब तपाईंको ६ अंकको गोप्य PIN भन्नुहोस्।')
          startPin1()
        } else {
          throw new Error()
        }
      } catch {
        setError('फोन नम्बर बुझिएन।'); setRegState('idle'); 
        await speak('फोन नम्बर बुझिएन। फेरि भन्नुहोस्।')
        startPhone()
      }
    })
    try { await recorderRef.current.start() } catch { setError('माइक्रोफोन अस्वीकार।'); setRegState('idle') }
  }

  const startPin1 = async () => {
    cancel(); setError(''); setRegState('recording_pin1')
    recorderRef.current = createRecorder(async (blob) => {
      setRegState('processing_pin1')
      try {
        const text = await handleTranscribe(blob)
        const extracted = extractPIN(text)
        if (extracted) {
          setPin1(extracted); setRegState('idle'); 
          await speak('पुष्टिको लागि त्यही PIN फेरि भन्नुहोस्।')
          startPin2()
        } else {
          throw new Error()
        }
      } catch {
        setError('PIN बुझिएन।'); setRegState('idle'); 
        await speak('PIN बुझिएन। फेरि भन्नुहोस्।')
        startPin1()
      }
    })
    try { await recorderRef.current.start() } catch { setError('माइक्रोफोन अस्वीकार।'); setRegState('idle') }
  }

  const startPin2 = async () => {
    cancel(); setError(''); setRegState('recording_pin2')
    recorderRef.current = createRecorder(async (blob) => {
      setRegState('processing_pin2')
      try {
        const text = await handleTranscribe(blob)
        const extracted = extractPIN(text)
        if (extracted) {
          setPin2(extracted)
          if (extracted !== pin1Ref.current) {
            setError('PIN मेल खाएन।'); setPin1(''); setPin2(''); setRegState('idle'); 
            await speak('तपाईंले भनेको PIN मेल खाएन। सुरुदेखि PIN भन्नुहोस्।')
            startPin1()
          } else {
            register(fullName, phone, pin1Ref.current)
          }
        } else {
          throw new Error()
        }
      } catch {
        setError('PIN बुझिएन।'); setRegState('idle'); 
        await speak('PIN बुझिएन। फेरि भन्नुहोस्।')
        startPin2()
      }
    })
    try { await recorderRef.current.start() } catch { setError('माइक्रोफोन अस्वीकार।'); setRegState('idle') }
  }

  const register = async (name: string, ph: string, p: string) => {
    setRegState('registering'); setLoading(true)
    if (mode === 'voice') await speak('खाता दर्ता गर्दैछु।')
    
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: name, phone: ph, pin: p }),
      })
      const d = await r.json()
      if (r.ok) {
        localStorage.setItem('speakpay_user', JSON.stringify(d.user))
        if (mode === 'voice') await speak('खाता सफलतापूर्वक दर्ता भयो।')
        setTimeout(() => { window.location.href = '/dashboard' }, 2000)
      } else {
        const msg = d.error === 'Phone already registered' ? 'यो फोन नम्बर पहिले नै दर्ता छ।' : d.error
        setError(msg); setRegState('idle'); setLoading(false)
        if (mode === 'voice') await speak(msg)
      }
    } catch {
      setError('सर्भर त्रुटि।'); setRegState('idle'); setLoading(false)
    }
  }

  const beginVoiceFlow = async () => {
    setStarted(true)
    await speak('नयाँ खाता बनाउन, तपाईंको पूरा नाम भन्नुहोस्।')
    startName()
  }

  const isRecording = regState.startsWith('recording_')
  const isProcessing = regState.startsWith('processing_') || regState === 'registering'

  return (
    <div className="min-h-screen bg-teal flex items-center justify-center p-4 relative">
      
      {/* Tap Anywhere Overlay for Voice Mode */}
      <AnimatePresence>
        {mode === 'voice' && !started && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={beginVoiceFlow}
            className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center cursor-pointer"
          >
            <div className="w-32 h-32 rounded-full bg-teal/20 animate-pulse flex items-center justify-center mb-6">
              <span className="text-5xl">👆</span>
            </div>
            <h2 className="text-3xl text-white font-semibold mb-2">Tap Anywhere</h2>
            <p className="nepali text-slate-300 text-lg">आवाज सुरु गर्न स्क्रिनमा थिच्नुहोस्</p>
            
            <button onClick={(e) => { e.stopPropagation(); setMode('text') }}
              className="absolute top-4 right-4 text-xs bg-slate-800 px-3 py-1.5 rounded-full text-slate-300 hover:text-white transition z-50">
              ⌨️ किबोर्ड प्रयोग गर्नुहोस्
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="card w-full max-w-sm p-8 flex flex-col items-center relative">
        
        <button onClick={() => { setMode(m => m === 'voice' ? 'text' : 'voice'); cancel() }}
          className="absolute top-4 right-4 text-xs bg-slate-800/20 px-3 py-1.5 rounded-full text-slate-100 hover:text-white hover:bg-slate-800/40 transition z-40">
          {mode === 'voice' ? '⌨️ किबोर्ड' : '🎤 आवाज'}
        </button>

        <div className="text-center mb-8 mt-2">
          <h1 className="display text-3xl text-teal font-semibold">SpeakPay</h1>
          <p className="nepali text-slate-500 text-sm mt-1">नयाँ खाता बनाउनुहोस्</p>
        </div>

        {mode === 'voice' ? (
          <div className="flex flex-col items-center justify-center space-y-8 w-full">
            <VoiceButton stage={isProcessing ? 'processing' : isRecording ? 'recording' : 'idle'} onStart={() => {}} onStop={() => recorderRef.current?.stop()} />
            <div className="text-center w-full">
              <p className="nepali text-lg text-white font-medium min-h-[28px]">
                {regState === 'idle' && !fullName && 'तपाईंको पूरा नाम भन्नुहोस्'}
                {regState === 'recording_name' && 'नाम सुन्दैछु…'}
                {regState === 'idle' && fullName && !phone && 'फोन नम्बर भन्नुहोस्'}
                {regState === 'recording_phone' && 'फोन नम्बर सुन्दैछु…'}
                {regState === 'idle' && phone && !pin1 && '६ अंकको PIN भन्नुहोस्'}
                {regState === 'recording_pin1' && 'PIN सुन्दैछु…'}
                {regState === 'idle' && pin1 && !pin2 && 'पुष्टिको लागि फेरि PIN भन्नुहोस्'}
                {regState === 'recording_pin2' && 'दोस्रो PIN सुन्दैछु…'}
                {isProcessing && regState !== 'registering' && 'प्रशोधन गर्दैछु…'}
                {regState === 'registering' && 'दर्ता गर्दैछु…'}
              </p>
              {error && <p className="nepali text-red-500 text-sm mt-2">{error}</p>}
            </div>
            <div className="w-full space-y-2 bg-glass-light border border-slate-200/20 rounded-xl p-4">
               <div className="flex justify-between items-center"><span className="nepali text-slate-200 text-sm">नाम:</span><span className="text-white font-medium">{fullName || '---'}</span></div>
               <div className="flex justify-between items-center"><span className="nepali text-slate-200 text-sm">फोन:</span><span className="text-white font-mono">{phone || '---'}</span></div>
               <div className="flex justify-between items-center"><span className="nepali text-slate-200 text-sm">PIN:</span><span className="text-white font-mono">{pin1 ? '••••••' : '---'}</span></div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 w-full">
            {[
              { label:'पूरा नाम', value:fullName, set:setFullName, type:'text', ph:'राम बहादुर श्रेष्ठ' },
              { label:'फोन नम्बर', value:phone, set:setPhone, type:'tel', ph:'98XXXXXXXX' },
              { label:'PIN (६ अंक)', value:pin1, set:setPin1, type:'password', ph:'••••••', max:6 },
              { label:'PIN पुनः लेख्नुहोस्', value:pin2, set:setPin2, type:'password', ph:'••••••', max:6 },
            ].map(f => (
              <div key={f.label}>
                <label className="nepali text-xs text-slate-500 font-medium mb-1.5 block">{f.label}</label>
                <input type={f.type} value={f.value} onChange={e => f.set(e.target.value)} maxLength={f.max} placeholder={f.ph}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal" />
              </div>
            ))}
            {error && <p className="nepali text-red-500 text-sm text-center">{error}</p>}
            <button onClick={() => {
              if (!fullName || !phone || pin1.length !== 6) { setError('सबै विवरण भर्नुहोस्।'); return }
              if (pin1 !== pin2) { setError('PIN मेल खाएन।'); return }
              register(fullName, phone, pin1)
            }} disabled={loading}
              className="w-full bg-teal text-white rounded-xl py-3 font-medium nepali hover:bg-teal-light transition disabled:opacity-60 mt-2">
              {loading ? 'दर्ता गर्दैछु…' : 'खाता बनाउनुहोस्'}
            </button>
          </div>
        )}

        <p className="text-center text-sm text-slate-300 mt-8 nepali">
          खाता छ? <a href="/login" className="text-white font-medium hover:underline">प्रवेश गर्नुहोस्</a>
        </p>
      </motion.div>
    </div>
  )
}
