// ══════════════════════════════════════════════════════════════════════
// SpeakPay NLP Engine v2
// Two-stage pipeline:
//   Stage 1 — Fast rule-based pre-filter (catches ~80% of commands)
//   Stage 2 — Weighted feature classifier with confidence scoring
// ══════════════════════════════════════════════════════════════════════

export type IntentAction = 'send' | 'load' | 'balance' | 'unknown'

export interface ParsedIntent {
  action:     IntentAction
  amount?:    number
  recipient?: string
  raw:        string
  confidence: number   // 0–1
  method:     'rule' | 'classifier' | 'fallback'
}

const NEP_DIGIT: Record<string,string> = {
  '०':'0','१':'1','२':'2','३':'3','४':'4',
  '५':'5','६':'6','७':'7','८':'8','९':'9'
}

// Nepali spoken number words → digit
const NEP_WORD_DIGIT: Record<string,string> = {
  'शून्य':'0','सुन्ना':'0',
  'एक':'1','एउटा':'1',
  'दुई':'2','दुइ':'2',
  'तीन':'3','तिन':'3',
  'चार':'4',
  'पाँच':'5','पांच':'5',
  'छ':'6',
  'सात':'7',
  'आठ':'8',
  'नौ':'9','नऊ':'9',
}

/**
 * Full normalization pipeline for ASR transcripts:
 * 1. Convert Nepali digit characters (०-९) → ASCII (0-9)
 * 2. Convert Nepali spoken number words → ASCII digits
 * 3. Collapse all whitespace so "९ ८ ० १" becomes "9801"
 */
export function normalizeNumerals(s: string): string {
  return s.replace(/[०-९]/g, d => NEP_DIGIT[d] ?? d)
}

function normalizeForDigitExtraction(text: string): string {
  let s = text
  // Step 1: Replace Nepali digit characters with ASCII
  s = s.replace(/[०-९]/g, d => NEP_DIGIT[d] ?? d)
  // Step 2: Replace Nepali spoken number words with digits
  for (const [word, digit] of Object.entries(NEP_WORD_DIGIT)) {
    s = s.replace(new RegExp(word, 'g'), digit)
  }
  // Step 3: Strip all whitespace so "9 8 0 1 2 3 4 5 6 7" → "9801234567"
  s = s.replace(/\s+/g, '')
  return s
}

function extractAmount(text: string): number | null {
  const normalized = normalizeForDigitExtraction(text)
  const matches = [...normalized.matchAll(/\d+/g)]
    .map(m => parseInt(m[0]))
    .filter(n => n > 0 && n <= 10_000_000)
    .sort((a,b) => b - a)
  return matches[0] ?? null
}

export function extractPhoneNumber(text: string): string | null {
  const normalized = normalizeForDigitExtraction(text)
  // Match any sequence of exactly 10 digits starting with 9
  const match = normalized.match(/9\d{9}/)
  return match ? match[0] : null
}

export function extractPIN(text: string): string | null {
  const normalized = normalizeForDigitExtraction(text)
  // Match any sequence of exactly 4-6 digits
  const match = normalized.match(/\d{4,6}/)
  return match ? match[0].slice(0, 6).padStart(6, '0') : null
}

function extractRecipient(text: string): string | null {
  const phone = text.match(/9[6-9]\d{8}/)
  if (phone) return phone[0]
  const namePatterns = [
    /(\S+(?:\s+\S+)?)\s*लाई/,
    /(\S+(?:\s+\S+)?)\s*को\s+(?:खाता|इसेवा|ईसेवा|खल्ती)/,
  ]
  for (const p of namePatterns) {
    const m = text.match(p)
    if (m?.[1] && m[1].length > 1 && !m[1].match(/^[0-9]+$/))
      return m[1].trim()
  }
  return null
}

const FEATURES: Record<IntentAction, string[]> = {
  send:    ['पठाउ','पठाउनुहोस्','पठा','ट्रान्सफर','transfer','send','लाई','को खातामा'],
  load:    ['लोड','load','जम्मा','थप','हाल','deposit','topup','खातामा हाल'],
  balance: ['ब्यालेन्स','balance','बाँकी','कति छ','खाता हेर','जाँच','check'],
  unknown: [],
}

function classifyByFeatures(text: string): { action: IntentAction; score: number } {
  const scores: Record<IntentAction, number> = { send:0, load:0, balance:0, unknown:0 }
  const t = text.toLowerCase()
  for (const [action, keywords] of Object.entries(FEATURES)) {
    if (action === 'unknown') continue
    for (const kw of keywords)
      if (t.includes(kw.toLowerCase()))
        scores[action as IntentAction] += kw.length > 4 ? 2 : 1
  }
  if (extractRecipient(text)) scores.send += 1.5
  const amt = extractAmount(text)
  if (amt && !extractRecipient(text)) scores.load += 0.5
  const best  = Object.entries(scores).sort(([,a],[,b]) => b - a)[0]
  const total = Object.values(scores).reduce((a,b) => a+b, 0)
  return { action: best[0] as IntentAction, score: total > 0 ? best[1]/total : 0 }
}

export function parseIntent(transcript: string): ParsedIntent {
  const t = transcript.trim()

  // Stage 1: High-confidence rules
  if (/ब्यालेन्स|बाँकी\s*कति|खाता\s*हेर/.test(t))
    return { action:'balance', raw:t, confidence:0.95, method:'rule' }

  if (/(?:लोड|जम्मा|हाल|थप|deposit|topup)/.test(t)) {
    const amount = extractAmount(t)
    if (amount) return { action:'load', amount, raw:t, confidence:0.92, method:'rule' }
  }

  if (/पठाउ|पठाइ|ट्रान्सफर|transfer|send/.test(t)) {
    const amount    = extractAmount(t)
    const recipient = extractRecipient(t)
    if (amount && recipient)
      return { action:'send', amount, recipient, raw:t, confidence:0.93, method:'rule' }
    if (amount)
      return { action:'send', amount, recipient:'unknown', raw:t, confidence:0.75, method:'rule' }
  }

  // Stage 2: Feature classifier
  const { action, score } = classifyByFeatures(t)
  if (score >= 0.4 && action !== 'unknown') {
    const amount    = extractAmount(t)
    const recipient = action === 'send' ? (extractRecipient(t) ?? 'unknown') : undefined
    return {
      action,
      ...(amount    !== null      ? { amount }    : {}),
      ...(recipient !== undefined ? { recipient } : {}),
      raw: t, confidence: Math.min(0.85, score), method: 'classifier',
    }
  }

  return { action:'unknown', raw:t, confidence:0, method:'fallback' }
}

export function toConfirmation(intent: ParsedIntent): string {
  switch (intent.action) {
    case 'send':    return `${intent.recipient ?? 'प्राप्तकर्ता'}लाई रु ${intent.amount?.toLocaleString()} पठाउने हो?`
    case 'load':    return `खातामा रु ${intent.amount?.toLocaleString()} लोड गर्ने हो?`
    case 'balance': return 'ब्यालेन्स हेर्ने हो?'
    default:        return 'माफ गर्नुस्, फेरि भन्नुहोस्।'
  }
}

// WER — word edit distance
export function computeWER(hypothesis: string, reference: string): number {
  const h = hypothesis.trim().split(/\s+/)
  const r = reference.trim().split(/\s+/)
  if (r.length === 0) return h.length === 0 ? 0 : 1
  const dp = Array.from({ length: r.length+1 }, (_,i) =>
    Array.from({ length: h.length+1 }, (_,j) => i===0 ? j : j===0 ? i : 0))
  for (let i=1; i<=r.length; i++)
    for (let j=1; j<=h.length; j++)
      dp[i][j] = r[i-1]===h[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[r.length][h.length] / r.length
}

// Number accuracy — critical metric for financial ASR
export function numberAccuracy(hypothesis: string, reference: string): number {
  const re      = /[०-९]+|[0-9]+/g
  const refNums = [...reference.matchAll(re)].map(m => m[0])
  if (refNums.length === 0) return 1
  const hypNums = new Set([...hypothesis.matchAll(re)].map(m => m[0]))
  return refNums.filter(n => hypNums.has(n)).length / refNums.length
}
