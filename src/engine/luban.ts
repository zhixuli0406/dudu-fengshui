import data from '../data/lubanRuler.json'

interface Sub { sub: string; start_cm: number; end_cm: number }
interface Word { index: number; word: string; luck: string; start_cm: number; end_cm: number; sub_divisions?: Sub[] }
interface Ruler { cycle_cm: number; word_cm: number; sub_cm?: number; words: Word[] }

const WEN: Ruler = (data as { wenGongChi: Ruler }).wenGongChi
const DING: Ruler = (data as { dingLanChi: Ruler }).dingLanChi

export interface LubanResult {
  ruler: '文公尺' | '丁蘭尺'
  lengthCm: number
  word: string
  luck: string
  sub?: string
  auspicious: boolean
  /** nearest auspicious ranges (cm) around the input, for suggestions */
  suggestions: { from: number; to: number; word: string; sub?: string }[]
}

/**
 * 魯班尺（文公尺，陽宅門窗家具用）查表：43.2 cm 一循環，八字各 5.4 cm，每字四細分 1.35 cm。
 * 來源：docs/research/03 §3.2。
 */
export function lubanLookup(lengthCm: number, ruler: '文公尺' | '丁蘭尺' = '文公尺'): LubanResult {
  const r = ruler === '文公尺' ? WEN : DING
  const x = ((lengthCm % r.cycle_cm) + r.cycle_cm) % r.cycle_cm
  const w = r.words.find((k) => x >= k.start_cm && x < k.end_cm) ?? r.words[r.words.length - 1]!
  const sub = w.sub_divisions?.find((s) => x >= s.start_cm && x < s.end_cm)?.sub
  const base = lengthCm - x
  const suggestions: LubanResult['suggestions'] = []
  for (const cyc of [-1, 0, 1]) for (const k of r.words) {
    if (k.luck !== '吉') continue
    const from = base + cyc * r.cycle_cm + k.start_cm, to = base + cyc * r.cycle_cm + k.end_cm
    if (to <= 0) continue
    if (Math.abs((from + to) / 2 - lengthCm) <= r.cycle_cm) suggestions.push({ from: round1(from), to: round1(to), word: k.word })
  }
  suggestions.sort((a, b) => Math.abs((a.from + a.to) / 2 - lengthCm) - Math.abs((b.from + b.to) / 2 - lengthCm))
  return { ruler, lengthCm, word: w.word, luck: w.luck, sub, auspicious: w.luck === '吉', suggestions: suggestions.slice(0, 4) }
}

function round1(n: number): number { return Math.round(n * 10) / 10 }
