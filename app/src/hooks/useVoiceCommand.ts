// ══════════════════════════════════════════════════════════════════════
// useVoiceCommand — core hook for the entire voice interaction loop
// ══════════════════════════════════════════════════════════════════════
'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { createRecorder, transcribeBlob, ASRResult } from '@/lib/asr'
import { speak, cancel, preloadVoices } from '@/lib/tts'
import { ParsedIntent, toConfirmation } from '@/lib/nlp'

export type VoiceStage =
  | 'idle'
  | 'recording'
  | 'processing'    // waiting for HF API
  | 'model_loading' // HF cold start — show spinner + retry count
  | 'confirm'
  | 'executing'
  | 'success'
  | 'error'

export interface VoiceState {
  stage:        VoiceStage
  transcript:   string
  intent:       ParsedIntent | null
  message:      string
  retryAttempt: number
  retryWaitMs:  number
  latencyMs:    number | null
  source:       'model' | 'browser_fallback' | null
}

const INITIAL: VoiceState = {
  stage: 'idle', transcript: '', intent: null,
  message: '', retryAttempt: 0, retryWaitMs: 0,
  latencyMs: null, source: null,
}

export function useVoiceCommand(onSuccess?: (intent: ParsedIntent) => void) {
  const [state,  setState]  = useState<VoiceState>(INITIAL)
  const recorderRef         = useRef<ReturnType<typeof createRecorder> | null>(null)

  useEffect(() => { preloadVoices() }, [])

  const reset = useCallback(() => {
    cancel()
    setState(INITIAL)
  }, [])

  const startRecording = useCallback(async () => {
    cancel()
    setState(s => ({ ...s, stage: 'recording', transcript: '', intent: null, message: '' }))
    speak('सुन्दैछु…')

    recorderRef.current = createRecorder(async (blob) => {
      setState(s => ({ ...s, stage: 'processing' }))
      try {
        const result: ASRResult = await transcribeBlob(blob, {
          allowFallback: true,
          onRetry: (attempt, waitMs) => {
            setState(s => ({ ...s, stage: 'model_loading', retryAttempt: attempt, retryWaitMs: waitMs }))
            speak('मोडेल लोड हुँदैछ, कृपया प्रतीक्षा गर्नुहोस्।')
          },
        })

        const { intent, transcript, latencyMs, source } = result
        setState(s => ({ ...s, transcript, intent, latencyMs, source }))

        if (intent.action === 'unknown' || intent.confidence < 0.4) {
          const msg = 'माफ गर्नुस्, फेरि भन्नुहोस्।'
          setState(s => ({ ...s, stage: 'error', message: msg }))
          speak(msg)
          return
        }

        if (intent.action === 'balance') {
          setState(s => ({ ...s, stage: 'success', message: 'ब्यालेन्स हेर्दैछु…' }))
          onSuccess?.(intent)
          return
        }

        const confirmation = toConfirmation(intent)
        setState(s => ({ ...s, stage: 'confirm', message: confirmation }))
        speak(confirmation)
      } catch (err: any) {
        const msg = err.message === 'model_unavailable'
          ? 'मोडेल उपलब्ध छैन। पछि फेरि प्रयास गर्नुहोस्।'
          : 'त्रुटि भयो। फेरि प्रयास गर्नुहोस्।'
        setState(s => ({ ...s, stage: 'error', message: msg }))
        speak(msg)
      }
    })

    try {
      await recorderRef.current.start()
    } catch {
      setState(s => ({ ...s, stage: 'error', message: 'माइक्रोफोन पहुँच अस्वीकार।' }))
    }
  }, [onSuccess])

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const confirm = useCallback((onConfirm: () => Promise<void>) => {
    setState(s => ({ ...s, stage: 'executing' }))
    onConfirm()
      .then(() => {
        setState(s => ({ ...s, stage: 'success' }))
      })
      .catch((err: Error) => {
        setState(s => ({ ...s, stage: 'error', message: err.message }))
        speak(err.message)
      })
  }, [])

  return { state, startRecording, stopRecording, confirm, reset }
}
