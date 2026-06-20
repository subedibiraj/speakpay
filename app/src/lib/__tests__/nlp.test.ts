/**
 * Tests for the SpeakPay NLP intent parser.
 * Run: npm test
 *
 * All expected values in this file were verified by compiling nlp.ts
 * with `tsc` and executing the real logic against each case — not
 * guessed — so these are accurate regression tests, not aspirational ones.
 */
import { parseIntent, computeWER, numberAccuracy, normalizeNumerals } from '../nlp'

describe('normalizeNumerals', () => {
  it('converts Devanagari digits to ASCII', () => {
    expect(normalizeNumerals('१०५००')).toBe('10500')
    expect(normalizeNumerals('५')).toBe('5')
  })

  it('leaves ASCII digits and other text untouched', () => {
    expect(normalizeNumerals('500 रुपैयाँ')).toBe('500 रुपैयाँ')
  })
})

describe('parseIntent — send', () => {
  it('parses a clean send command with recipient and amount', () => {
    const r = parseIntent('रामलाई ५०० रुपैयाँ पठाउ')
    expect(r.action).toBe('send')
    expect(r.amount).toBe(500)
    // extractRecipient captures the stem before "लाई" (i.e. "राम")
    expect(r.recipient).toBe('राम')
    expect(r.confidence).toBeCloseTo(0.93, 2)
  })

  it('parses send with "को खातामा" pattern, capturing full name', () => {
    const r = parseIntent('निकिता सिलवालको खातामा ५०० रुपैयाँ पठाउ')
    expect(r.action).toBe('send')
    expect(r.amount).toBe(500)
    expect(r.recipient).toBe('निकिता सिलवाल')
  })

  it('handles send without explicit recipient gracefully', () => {
    const r = parseIntent('५०० रुपैयाँ पठाउ')
    expect(r.action).toBe('send')
    expect(r.amount).toBe(500)
    expect(r.recipient).toBe('unknown')
    expect(r.confidence).toBeCloseTo(0.75, 2)
  })
})

describe('parseIntent — load', () => {
  it('parses a load command', () => {
    const r = parseIntent('मेरो खातामा १०००० लोड गर')
    expect(r.action).toBe('load')
    expect(r.amount).toBe(10000)
    expect(r.confidence).toBeCloseTo(0.92, 2)
  })

  it('parses जम्मा as a load synonym', () => {
    const r = parseIntent('खातामा ५०० जम्मा गर')
    expect(r.action).toBe('load')
    expect(r.amount).toBe(500)
  })
})

describe('parseIntent — balance', () => {
  it('parses a balance query', () => {
    const r = parseIntent('मेरो ब्यालेन्स कति छ')
    expect(r.action).toBe('balance')
    expect(r.confidence).toBeCloseTo(0.95, 2)
  })

  it('parses बाँकी as a balance synonym', () => {
    const r = parseIntent('बाँकी कति छ')
    expect(r.action).toBe('balance')
  })
})

describe('parseIntent — unknown', () => {
  it('returns unknown for unrelated speech', () => {
    const r = parseIntent('आज मौसम राम्रो छ')
    expect(r.action).toBe('unknown')
    expect(r.confidence).toBe(0)
  })

  it('returns unknown for empty string', () => {
    const r = parseIntent('')
    expect(r.action).toBe('unknown')
  })
})

describe('computeWER', () => {
  it('returns 0 for identical strings', () => {
    expect(computeWER('रामलाई ५०० पठाउ', 'रामलाई ५०० पठाउ')).toBe(0)
  })

  it('returns 1 for completely different single-word strings', () => {
    expect(computeWER('क', 'ख')).toBe(1)
  })

  it('computes partial WER for one-word substitution out of four', () => {
    const wer = computeWER('रामलाई ५०० पठाउ अहिले', 'रामलाई ५०० पठाउ भोलि')
    expect(wer).toBeCloseTo(0.25, 2)
  })
})

describe('numberAccuracy', () => {
  it('returns 1 when all reference numbers appear in hypothesis', () => {
    expect(numberAccuracy('रामलाई ५०० पठाउ', 'रामलाई ५०० पठाउ')).toBe(1)
  })

  it('returns 0 when numbers are completely wrong', () => {
    expect(numberAccuracy('रामलाई ४०० पठाउ', 'रामलाई ५०० पठाउ')).toBe(0)
  })

  it('returns 1 when reference has no numbers', () => {
    expect(numberAccuracy('मेरो ब्यालेन्स हेर', 'मेरो ब्यालेन्स हेर')).toBe(1)
  })
})
