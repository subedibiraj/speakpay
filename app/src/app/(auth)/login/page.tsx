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
  const [phone, setPhone] = useState('')
  const [pin,   setPin]   = useState('')
  const [error, setError] = useState('')
  const [authState, setAuthState] = useState<AuthState>('idle')
  
  const recorderRef = useRef<ReturnType<typeof createRecorder> | null>(null)

  useEffect(() => {
    preloadVoices()
    // Auto-prompt on mount
    speak('आफ्नो खातामा प्रवेश गर्न, बटन थिच्नुहोस् र आफ्नो दश अंकको फोन नम्बर भन्नुहोस्।')
    return () => cancel()
  }, [])

  const startPhoneRecording = async () => {
    cancel()
    setError('')
    setAuthState('recording_phone')
    speak('सुन्दैछु…')
    
    recorderRef.current = createRecorder(async (blob) => {
      setAuthState('processing_phone')
      try {
        const result = await transcribeBlob(blob, { allowFallback: true })
        const extracted = extractPhoneNumber(result.transcript)
        
        if (extracted) {
          setPhone(extracted)
          setAuthState('idle')
          speak('अब फेरि बटन थिच्नुहोस् र तपाईंको ६ अंकको PIN भन्नुहोस्।')
        } else {
          setError('फोन नम्बर बुझिएन। फेरि भन्नुहोस्।')
          setAuthState('idle')
          speak('फोन नम्बर बुझिएन। फेरि भन्नुहोस्।')
        }
      } catch (err) {
        setError('त्रुटि भयो।')
        setAuthState('idle')
        speak('त्रुटि भयो।')
      }
    })

    try {
      await recorderRef.current.start()
    } catch {
      setError('माइक्रोफोन पहुँच अस्वीकार।')
      setAuthState('idle')
    }
  }

  const startPinRecording = async () => {
    cancel()
    setError('')
    setAuthState('recording_pin')
    speak('सुन्दैछु…')
    
    recorderRef.current = createRecorder(async (blob) => {
      setAuthState('processing_pin')
      try {
        const result = await transcribeBlob(blob, { allowFallback: true })
        const extracted = extractPIN(result.transcript)
        
        if (extracted) {
          setPin(extracted)
          authenticate(phone, extracted)
        } else {
          setError('PIN बुझिएन। फेरि भन्नुहोस्।')
          setAuthState('idle')
          speak('PIN बुझिएन। फेरि भन्नुहोस्।')
        }
      } catch (err) {
        setError('त्रुटि भयो।')
        setAuthState('idle')
        speak('त्रुटि भयो।')
      }
    })

    try {
      await recorderRef.current.start()
    } catch {
      setError('माइक्रोफोन पहुँच अस्वीकार।')
      setAuthState('idle')
    }
  }

  const authenticate = async (ph: string, p: string) => {
    setAuthState('authenticating')
    speak('खाता जाँच गर्दैछु…')
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ph, pin: p }),
    })
    const d = await r.json()
    if (r.ok) {
      localStorage.setItem('speakpay_user', JSON.stringify(d.user))
      speak('प्रवेश सफल भयो।')
      setTimeout(() => { window.location.href = '/dashboard' }, 1500)
    } else {
      const msg = d.error === 'Invalid credentials' ? 'गलत फोन नम्बर वा PIN।' : d.error
      setError(msg)
      setPhone('')
      setPin('')
      setAuthState('idle')
      speak(msg + ' फेरि फोन नम्बर भन्न सुरु गर्नुहोस्।')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
  }

  const isRecording = authState.startsWith('recording_')
  const isProcessing = authState.startsWith('processing_') || authState === 'authenticating'

  const handleVoiceAction = () => {
    if (isRecording) {
      stopRecording()
    } else if (!phone) {
      startPhoneRecording()
    } else if (!pin) {
      startPinRecording()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
        className="card w-full max-w-sm p-8 flex flex-col items-center">
        <div className="text-center mb-8">
          <h1 className="display text-3xl text-teal font-semibold">SpeakPay</h1>
          <p className="nepali text-slate-400 text-sm mt-1">आफ्नो खातामा प्रवेश गर्नुहोस्</p>
        </div>

        <div className="flex flex-col items-center justify-center space-y-8 w-full">
          <VoiceButton 
            stage={isProcessing ? 'processing' : isRecording ? 'recording' : 'idle'}
            onStart={handleVoiceAction}
            onStop={handleVoiceAction}
          />
          
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

          {/* Visual confirmation of parsed data */}
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

        <p className="text-center text-sm text-slate-400 mt-8 nepali">
          नयाँ खाता?{' '}
          <a href="/register" className="text-teal hover:underline">दर्ता गर्नुहोस्</a>
        </p>
      </motion.div>
    </div>
  )
}
