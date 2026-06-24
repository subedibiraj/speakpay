'use client'
import { motion } from 'framer-motion'
import { ArrowLeft, Download, Database, Cpu, Activity, BarChart3, TrendingDown } from 'lucide-react'
import Link from 'next/link'

export default function ReportPage() {
  return (
    <div className="min-h-screen flex flex-col relative z-0">
      {/* ── Header ── */}
      <header className="bg-glass border-b border-glass-border px-6 py-4 flex items-center justify-between shadow-float sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 rounded-full bg-white/5 hover:bg-white/10 transition text-slate-300">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <p className="text-teal-light text-sm font-medium">Research Project</p>
            <h1 className="display text-xl font-semibold text-white">SpeakPay ASR Benchmark</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl mx-auto w-full space-y-6">
        
        {/* ── Overview ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <h2 className="text-2xl text-white font-bold tracking-tight">Domain-Adaptive LoRA Fine-Tuning of Whisper for Low-Resource Nepali Financial Speech</h2>
          <p className="text-slate-400 text-sm leading-relaxed">
            SpeakPay utilizes a highly optimized Automatic Speech Recognition (ASR) architecture fine-tuned specifically for Nepali financial nomenclature. This report summarizes the dataset methodology and the empirical benchmarking results of our custom Low-Rank Adaptation (LoRA) model against the zero-shot baseline.
          </p>
        </motion.div>

        {/* ── Dataset Stats ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 } }} className="grid grid-cols-2 gap-3">
          <div className="card p-4 bg-gradient-to-br from-ink-800 to-ink-900 border border-glass-border">
            <Database size={20} className="text-teal mb-2" />
            <p className="text-3xl font-bold text-white mb-1">403</p>
            <p className="text-xs text-slate-400">Total Utterances</p>
          </div>
          <div className="card p-4 bg-gradient-to-br from-ink-800 to-ink-900 border border-glass-border">
            <Activity size={20} className="text-amber-400 mb-2" />
            <p className="text-3xl font-bold text-white mb-1">237</p>
            <p className="text-xs text-slate-400">Unique Numerals</p>
          </div>
        </motion.div>

        {/* ── Dataset Breakdown ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.2 } }} className="card p-5 space-y-4 border border-glass-border">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <BarChart3 size={16} className="text-teal" />
            NepFinSpeech-403 Distribution
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Send Commands', count: 193, color: 'bg-teal' },
              { label: 'Balance Queries', count: 61, color: 'bg-blue-500' },
              { label: 'Load Commands', count: 56, color: 'bg-purple-500' },
              { label: 'Other Financial', count: 93, color: 'bg-slate-500' }
            ].map((item, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="text-slate-400">{item.count}</span>
                </div>
                <div className="w-full bg-ink-900 rounded-full h-1.5 overflow-hidden">
                  <div className={`${item.color} h-full rounded-full`} style={{ width: `${(item.count / 403) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Benchmark Results ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.3 } }} className="card overflow-hidden border border-glass-border">
          <div className="p-5 border-b border-glass-border bg-ink-900/50">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Cpu size={16} className="text-teal" />
              Empirical Results
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-ink-900/50 text-slate-400 border-b border-glass-border">
                <tr>
                  <th className="px-5 py-3 font-medium">Model</th>
                  <th className="px-5 py-3 font-medium text-right">WER ↓</th>
                  <th className="px-5 py-3 font-medium text-right">CER ↓</th>
                  <th className="px-5 py-3 font-medium text-right">NumAcc ↑</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-glass-border">
                <tr className="bg-ink-800 text-slate-300">
                  <td className="px-5 py-4 font-medium">Whisper large-v2 (zero-shot)</td>
                  <td className="px-5 py-4 text-right">131.04%</td>
                  <td className="px-5 py-4 text-right">78.09%</td>
                  <td className="px-5 py-4 text-right">0.0%</td>
                </tr>
                <tr className="bg-teal/10 text-white font-medium relative">
                  <td className="px-5 py-4 flex items-center gap-2">
                    NepFinSpeech LoRA <span className="text-[10px] uppercase tracking-wide bg-teal text-ink-900 px-1.5 py-0.5 rounded font-bold">Ours</span>
                  </td>
                  <td className="px-5 py-4 text-right text-teal-light">42.58%</td>
                  <td className="px-5 py-4 text-right text-teal-light">16.95%</td>
                  <td className="px-5 py-4 text-right text-teal-light">73.9%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ── Key Finding Highlight ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.4 } }} 
          className="card p-5 bg-gradient-to-r from-teal/20 to-transparent border-l-4 border-l-teal">
          <div className="flex items-start gap-3">
            <TrendingDown size={24} className="text-teal shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold mb-1">67.5% Relative WER Reduction</p>
              <p className="text-sm text-slate-300 leading-relaxed">
                The LoRA fine-tuning resulted in an improvement on 59 out of 60 individual test utterances. The model demonstrates unprecedented numerical accuracy for spoken Nepali financial sums.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Action Buttons ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.5 } }} className="flex gap-3 pt-2 pb-10">
          <a href="/speakpay_report.pdf" download
            className="flex-1 flex items-center justify-center gap-2 bg-white text-ink-900 py-3 rounded-xl font-semibold hover:bg-slate-200 transition">
            <Download size={18} />
            Download Full Paper (PDF)
          </a>
        </motion.div>

      </main>
    </div>
  )
}
