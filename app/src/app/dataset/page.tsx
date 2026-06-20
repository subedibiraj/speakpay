'use client'
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Play, Search, BarChart2, ExternalLink } from 'lucide-react'

// Embed first 50 samples inline so the page works without HF API
// The full 403-sample dataset is on HuggingFace
import SAMPLES_RAW from './samples.json'

interface Sample {
  id:         string
  url:        string
  transcript: string
  intent:     'send' | 'load' | 'balance' | 'other'
}

const INTENT_COLORS = {
  send:    { bg: 'bg-teal/10',   border: 'border-teal/20',   text: 'text-teal-light',  label: 'पठाउनुहोस्' },
  load:    { bg: 'bg-amber/10',  border: 'border-amber/20',  text: 'text-amber',       label: 'लोड'         },
  balance: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', label: 'ब्यालेन्स' },
  other:   { bg: 'bg-white/5',   border: 'border-white/10',  text: 'text-slate-400',   label: 'अन्य'         },
}

function classifyIntent(t: string): Sample['intent'] {
  if (/पठाउ|ट्रान्सफर|transfer/.test(t)) return 'send'
  if (/लोड|जम्मा|हाल/.test(t))          return 'load'
  if (/ब्यालेन्स|बाँकी|कति/.test(t))    return 'balance'
  return 'other'
}

export default function DatasetPage() {
  const [query,  setQuery]  = useState('')
  const [filter, setFilter] = useState<string>('all')
  const [playing, setPlaying] = useState<string | null>(null)

  const samples: Sample[] = useMemo(() =>
    (SAMPLES_RAW as Array<{ audio_id: string; url: string; transcript: string }>)
      .slice(0, 50)
      .map(s => ({
        id:         s.audio_id,
        url:        s.url,
        transcript: s.transcript,
        intent:     classifyIntent(s.transcript),
      })),
    []
  )

  const filtered = useMemo(() =>
    samples.filter(s => {
      const matchesFilter = filter === 'all' || s.intent === filter
      const matchesQuery  = !query || s.transcript.includes(query) || s.id.includes(query)
      return matchesFilter && matchesQuery
    }),
    [samples, query, filter]
  )

  const stats = useMemo(() => {
    const counts = { send: 0, load: 0, balance: 0, other: 0 }
    samples.forEach(s => counts[s.intent]++)
    return counts
  }, [samples])

  const playAudio = (url: string, id: string) => {
    setPlaying(id)
    const audio = new Audio(url)
    audio.onended = () => setPlaying(null)
    audio.onerror = () => setPlaying(null)
    audio.play()
  }

  return (
    <div className="min-h-screen bg-ink text-white px-5 py-10 max-w-3xl mx-auto">
      <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }}>
        <a href="/demo" className="text-slate-500 text-sm hover:text-slate-300 mb-6 block">
          ← Back to demo
        </a>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="display text-3xl font-semibold">NepFinSpeech</h1>
            <p className="text-slate-400 text-sm mt-1">
              403 transcribed Nepali financial voice commands
            </p>
          </div>
          <a href="https://huggingface.co/datasets/YOUR_USERNAME/NepFinSpeech"
            target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition">
            <ExternalLink size={12}/> Full dataset on HF
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-6">
          {Object.entries(stats).map(([intent, count]) => {
            const c = INTENT_COLORS[intent as Sample['intent']]
            return (
              <div key={intent}
                className={`rounded-xl border ${c.border} ${c.bg} p-3 text-center`}>
                <p className={`text-xl font-semibold ${c.text}`}>{count}</p>
                <p className="nepali text-xs text-slate-400 mt-0.5">{c.label}</p>
              </div>
            )
          })}
        </div>

        {/* Search + filter */}
        <div className="flex gap-2 mt-5">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="खोज्नुहोस्…"
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-teal/40 nepali"
            />
          </div>
          <div className="flex gap-1.5">
            {['all','send','load','balance','other'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-2 rounded-xl border transition nepali ${
                  filter === f
                    ? 'bg-teal/10 border-teal/30 text-teal-light'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                }`}>
                {f === 'all' ? 'सबै' :
                 f === 'send' ? 'पठाउनुहोस्' :
                 f === 'load' ? 'लोड' :
                 f === 'balance' ? 'ब्यालेन्स' : 'अन्य'}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Showing {filtered.length} of 50 preview samples (full 403 on Hugging Face)
        </p>

        {/* Sample list */}
        <div className="mt-3 space-y-2">
          {filtered.map((s, i) => {
            const c = INTENT_COLORS[s.intent]
            return (
              <motion.div key={s.id}
                initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                transition={{ delay: Math.min(i, 15) * 0.03 }}
                className={`rounded-xl border ${c.border} p-3 flex items-center gap-3`}>

                <button
                  onClick={() => playAudio(s.url, s.id)}
                  aria-label={`${s.id} सुन्नुहोस्`}
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition ${
                    playing === s.id
                      ? 'bg-teal text-white'
                      : `${c.bg} ${c.text} hover:bg-teal/20`
                  }`}>
                  <Play size={14} fill="currentColor" />
                </button>

                <div className="flex-1 min-w-0">
                  <p className="nepali text-sm text-slate-200 leading-relaxed">{s.transcript}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{s.id}</p>
                </div>

                <span className={`text-[11px] px-2 py-0.5 rounded-full border ${c.border} ${c.text} flex-shrink-0 nepali`}>
                  {c.label}
                </span>
              </motion.div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <p className="text-center text-slate-500 text-sm mt-10 nepali">
            कुनै नमूना फेला परेन।
          </p>
        )}
      </motion.div>
    </div>
  )
}
