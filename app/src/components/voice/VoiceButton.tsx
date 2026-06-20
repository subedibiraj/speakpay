'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Loader2 } from 'lucide-react'
import type { VoiceStage } from '@/hooks/useVoiceCommand'

interface Props {
  stage:    VoiceStage
  onStart:  () => void
  onStop:   () => void
  disabled?: boolean
}

const RING_COLORS: Partial<Record<VoiceStage, string>> = {
  recording:     'bg-red-500/20',
  model_loading: 'bg-amber/20',
}

export function VoiceButton({ stage, onStart, onStop, disabled }: Props) {
  const isRecording = stage === 'recording'
  const isProcessing = stage === 'processing' || stage === 'model_loading' || stage === 'executing'
  const isIdle = stage === 'idle' || stage === 'success' || stage === 'error'

  const handleClick = () => {
    if (isRecording) onStop()
    else if (isIdle)  onStart()
  }

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      {/* Pulse rings */}
      <AnimatePresence>
        {isRecording && (
          <>
            {[0, 1].map(i => (
              <motion.span key={i}
                className={`absolute inset-0 rounded-full ${RING_COLORS.recording}`}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.8 + i * 0.4, opacity: 0 }}
                transition={{ duration: 1.4, delay: i * 0.7, repeat: Infinity, ease: 'easeOut' }}
              />
            ))}
          </>
        )}
      </AnimatePresence>

      <button
        onClick={handleClick}
        disabled={disabled || isProcessing}
        aria-label={isRecording ? 'रेकर्डिङ रोक्नुहोस्' : 'भाषण सुरु गर्नुहोस्'}
        aria-pressed={isRecording}
        aria-live="polite"
        className={[
          'relative z-10 w-20 h-20 rounded-full flex items-center justify-center',
          'shadow-float transition-all duration-200 focus-visible:outline-none',
          'focus-visible:ring-4 focus-visible:ring-teal/40',
          isRecording  ? 'bg-red-500 hover:bg-red-600 scale-110'      : '',
          isProcessing ? 'bg-slate-300 cursor-not-allowed'             : '',
          isIdle       ? 'bg-teal hover:bg-teal-light hover:scale-105' : '',
          'text-white disabled:opacity-60',
        ].join(' ')}
      >
        {isProcessing
          ? <Loader2 size={28} className="animate-spin" />
          : isRecording
          ? <MicOff size={28} />
          : <Mic size={28} />
        }
      </button>
    </div>
  )
}
