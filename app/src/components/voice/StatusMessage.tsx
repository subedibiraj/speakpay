'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react'
import type { VoiceStage } from '@/hooks/useVoiceCommand'

interface Props {
  stage:        VoiceStage
  message:      string
  retryAttempt: number
  retryWaitMs:  number
  source?:      'model' | 'browser_fallback' | null
  latencyMs?:   number | null
}

const ICONS: Partial<Record<VoiceStage, React.ReactNode>> = {
  processing:    <Loader2 size={14} className="animate-spin text-teal" />,
  model_loading: <RefreshCw size={14} className="animate-spin text-amber" />,
  success:       <CheckCircle2 size={14} className="text-teal" />,
  error:         <XCircle size={14} className="text-red-500" />,
}

export function StatusMessage({ stage, message, retryAttempt, retryWaitMs, source, latencyMs }: Props) {
  const text =
    stage === 'idle'          ? 'माइक थिच्नुहोस् र नेपालीमा बोल्नुहोस्' :
    stage === 'recording'     ? 'सुन्दैछु… रोक्न फेरि थिच्नुहोस्' :
    stage === 'processing'    ? 'विश्लेषण गर्दैछु…' :
    stage === 'model_loading' ? `मोडेल लोड हुँदैछ… (${retryAttempt}/${4})` :
    stage === 'executing'     ? 'कार्यान्वयन गर्दैछु…' :
    message

  return (
    <AnimatePresence mode="wait">
      <motion.div key={stage + message}
        initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        className="flex flex-col items-center gap-1">

        <div className="flex items-center gap-1.5">
          {ICONS[stage]}
          <p className="nepali text-sm text-slate-600 text-center">{text}</p>
        </div>

        {/* Retry progress bar */}
        {stage === 'model_loading' && retryWaitMs > 0 && (
          <motion.div className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden">
            <motion.div className="h-full bg-amber rounded-full"
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: retryWaitMs / 1000, ease: 'linear' }}
            />
          </motion.div>
        )}

        {/* Latency + source badges */}
        {(latencyMs || source === 'browser_fallback') && (
          <div className="flex gap-2 mt-1">
            {latencyMs && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {latencyMs}ms
              </span>
            )}
            {source === 'browser_fallback' && (
              <span className="text-[10px] text-amber bg-amber/10 px-2 py-0.5 rounded-full border border-amber/20">
                Browser fallback
              </span>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
