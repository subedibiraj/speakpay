'use client'
import { useState, useRef } from 'react'
import { Mic, MicOff, BarChart2, BookOpen, Github, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { computeWER, numberAccuracy } from '@/lib/nlp'

interface LiveResult {
  transcript: string
  latencyMs:  number
  source:     string
}

export default function DemoPage() {
  const [recording,    setRecording]    = useState(false)
  const [processing,   setProcessing]   = useState(false)
  const [result,       setResult]       = useState<LiveResult | null>(null)
  const [reference,    setReference]    = useState('')
  const [wer,          setWer]          = useState<number | null>(null)
  const [numAcc,       setNumAcc]       = useState<number | null>(null)
  const [error,        setError]        = useState('')
  const [retryMsg,     setRetryMsg]     = useState('')

  const mediaRef  = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    setError(''); setResult(null); setWer(null); setNumAcc(null); setRetryMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = () => { stream.getTracks().forEach(t => t.stop()); runTranscription() }
      mediaRef.current = mr; mr.start()
      setRecording(true)
    } catch {
      setError('Microphone access denied.')
    }
  }

  const stopRecording = () => {
    mediaRef.current?.stop()
    setRecording(false); setProcessing(true)
  }

  const runTranscription = async () => {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const fd   = new FormData()
    fd.append('audio', blob, 'demo.wav')

    // Retry loop for HF cold start
    let attempts = 0
    while (attempts <= 4) {
      try {
        const t0  = Date.now()
        const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
        const ms  = Date.now() - t0

        if (res.status === 503) {
          attempts++
          const wait = 5000 * Math.pow(1.5, attempts - 1)
          setRetryMsg(`Model loading… retry ${attempts}/4 (${Math.round(wait/1000)}s)`)
          await new Promise(r => setTimeout(r, wait))
          continue
        }

        if (!res.ok) { setError(`API error ${res.status}`); break }

        const d = await res.json()
        const liveResult: LiveResult = { transcript: d.transcript, latencyMs: ms, source: 'domain_lora' }
        setResult(liveResult)
        setRetryMsg('')

        // Compute WER if reference provided
        if (reference.trim()) {
          setWer(computeWER(d.transcript, reference) * 100)
          setNumAcc(numberAccuracy(d.transcript, reference) * 100)
        }
        break
      } catch {
        setError('Transcription failed.')
        break
      }
    }
    setProcessing(false)
  }

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="max-w-2xl mx-auto px-5 pt-12 pb-16">
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-teal/20 text-teal-light text-xs font-medium px-3 py-1 rounded-full border border-teal/20">
              Live Research Demo
            </span>
            <a href="https://github.com/subedibiraj/speakpay" target="_blank"
              className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition">
              <Github size={14}/> Code
            </a>
          </div>

          <h1 className="display text-4xl font-semibold leading-tight">
            Nepali Financial ASR<br/>
            <span className="text-teal-light">Benchmark</span>
          </h1>
          <p className="text-slate-400 mt-3 text-sm leading-relaxed max-w-lg">
            Domain-adaptive LoRA fine-tuning of Whisper large-v2 on{' '}
            <strong className="text-white">NepFinSpeech-403</strong>  - 
            the first financial-domain Nepali speech corpus.
            Speak a Nepali financial command and see live transcription.
          </p>

          {/* Nav pills */}
          <div className="flex gap-2 mt-5 flex-wrap">
            {[
              { href: '/dataset',  icon: <BookOpen size={12}/>, label: 'Browse Dataset'    },
              { href: '/analysis', icon: <BarChart2 size={12}/>, label: 'Error Analysis'    },
              { href: 'https://huggingface.co/datasets/birajsubedi/NepFinSpeech',
                icon: null, label: '🤗 HuggingFace', external: true },
            ].map(l => (
              <a key={l.label} href={l.href} target={l.external ? '_blank' : undefined}
                className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-xs transition">
                {l.icon}{l.label}
              </a>
            ))}
          </div>

          {/* Benchmark table */}
          <div className="mt-8 rounded-2xl border border-white/10 overflow-hidden">
            <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
              <BarChart2 size={14} className="text-teal-light"/>
              <span className="text-sm font-medium">Results  -  NepFinSpeech Test Set (N=61)</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 text-xs border-b border-white/5">
                  <th className="text-left px-5 py-3">Model</th>
                  <th className="text-right px-4 py-3">WER% ↓</th>
                  <th className="text-right px-4 py-3">CER% ↓</th>
                  <th className="text-right px-4 py-3">NumAcc% ↑</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label:'Whisper large-v2 (zero-shot)',    wer:'129.9', cer:'92.3', num:'0.0',   ours:false },
                  { label:'General Nepali fine-tune',         wer:'N/A',  cer:'N/A',  num:'N/A',   ours:false },
                  { label:'NepFinSpeech LoRA (ours)',         wer:'42.6', cer:'17.0', num:'73.9',  ours:true  },
                ].map((row,i) => (
                  <tr key={i} className={`border-t border-white/5 ${row.ours ? 'bg-teal/8' : ''}`}>
                    <td className="px-5 py-3 text-slate-200 text-sm">
                      {row.label}
                      {row.ours && <span className="ml-2 text-teal-light text-xs">← ours</span>}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono text-sm ${row.ours ? 'text-teal-light font-semibold' : 'text-slate-400'}`}>{row.wer}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm ${row.ours ? 'text-teal-light font-semibold' : 'text-slate-400'}`}>{row.cer}</td>
                    <td className={`px-4 py-3 text-right font-mono text-sm ${row.ours ? 'text-teal-light font-semibold' : 'text-slate-400'}`}>{row.num}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-600 px-5 py-2 border-t border-white/5">
              NumAcc = fraction of Nepali numerals correctly recognised  -  the critical metric for payment apps.
            </p>
          </div>

          {/* Live demo */}
          <div className="mt-6 rounded-2xl border border-white/10 p-6">
            <h2 className="font-medium mb-1">Try it live</h2>
            <p className="text-slate-400 text-xs mb-5">
              Speak any Nepali financial command. Optionally enter the reference text to compute live WER.
            </p>

            {/* Reference input for live WER */}
            <div className="mb-4">
              <label className="text-xs text-slate-500 mb-1.5 block nepali">
                Reference transcript (optional  -  for live WER calculation)
              </label>
              <input value={reference} onChange={e => setReference(e.target.value)}
                placeholder="रामलाई ५०० रुपैयाँ पठाउ"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm nepali placeholder-slate-700 focus:outline-none focus:border-teal/40"
              />
            </div>

            {/* Mic button */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {recording && (
                  <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                )}
                <button onClick={recording ? stopRecording : startRecording}
                  disabled={processing}
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all
                    ${recording ? 'bg-red-500 scale-110' : 'bg-teal hover:bg-teal-light'}
                    disabled:opacity-50 text-white shadow-float`}>
                  {processing ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  ) : recording ? <MicOff size={22}/> : <Mic size={22}/>}
                </button>
              </div>

              <p className="text-sm text-slate-400">
                {retryMsg    || (recording ? 'Recording… click to stop' :
                 processing  ? 'Processing…' : 'Click to start recording')}
              </p>
              {error && (
                <p className="flex items-center gap-1.5 text-red-400 text-sm">
                  <AlertTriangle size={14}/>{error}
                </p>
              )}
            </div>

            {/* Result */}
            <AnimatePresence>
              {result && (
                <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
                  className="mt-5 space-y-3">
                  <div className="rounded-xl border border-teal/20 bg-teal/5 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-teal-light">
                        SpeakPay model (NepFinSpeech LoRA)
                      </span>
                      <span className="text-xs text-slate-400">{result.latencyMs}ms</span>
                    </div>
                    <p className="nepali text-sm text-slate-100 leading-relaxed">
                      {result.transcript || '(empty)'}
                    </p>
                  </div>

                  {/* Live WER display */}
                  {(wer !== null || numAcc !== null) && (
                    <div className="grid grid-cols-2 gap-3">
                      {wer !== null && (
                        <div className="rounded-xl border border-white/10 p-3 text-center">
                          <p className={`text-xl font-semibold font-mono ${
                            wer < 20 ? 'text-teal-light' : wer < 40 ? 'text-amber' : 'text-red-400'
                          }`}>{wer.toFixed(1)}%</p>
                          <p className="text-xs text-slate-500 mt-0.5">WER (this utterance)</p>
                        </div>
                      )}
                      {numAcc !== null && (
                        <div className="rounded-xl border border-white/10 p-3 text-center">
                          <p className={`text-xl font-semibold font-mono ${
                            numAcc === 100 ? 'text-teal-light' : numAcc >= 50 ? 'text-amber' : 'text-red-400'
                          }`}>{numAcc.toFixed(0)}%</p>
                          <p className="text-xs text-slate-500 mt-0.5">Number accuracy</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dataset stats */}
          <div className="mt-6 rounded-2xl border border-white/10 p-5 grid grid-cols-3 gap-4 text-center">
            {[
              { n:'403',  label:'Transcribed utterances' },
              { n:'237',  label:'Unique Nepali numerals' },
              { n:'3',    label:'Intent classes' },
            ].map(s => (
              <div key={s.label}>
                <p className="display text-2xl text-teal-light">{s.n}</p>
                <p className="text-xs text-slate-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <a href="/dashboard" className="text-teal-light text-sm hover:underline">
              ← Back to wallet
            </a>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
