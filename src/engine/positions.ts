import type { Trigram } from './bagua'

/**
 * 住宅文昌位（依坐向／宅卦，八宅系統）。
 * 來源：Ailan 風水研究室〈八宅文昌位〉各坐向頁（docs/research/03 §4.3）。
 * 注意：住宅文昌／個人文昌／流年文昌三套系統互不相容，本表為「住宅文昌」。
 */
export const HOUSE_WENCHANG: Record<Trigram, Trigram[]> = {
  kan: ['gen'],
  li: ['li'],
  zhen: ['qian'],
  dui: ['kun'],
  kun: ['dui'],
  gen: ['kan'],
  xun: ['xun', 'center' as Trigram],
  qian: ['zhen'],
}

/**
 * 住宅暗財位／洩財位（理氣派，依坐向）。
 * 來源：Ailan 風水研究室〈財位另一章〉（docs/research/03 §4.4）。
 * 與形勢派「明財位＝入門斜對角」是兩套不同系統，分開呈現。
 */
export const HOUSE_WEALTH: Record<Trigram, { wealth: Trigram[]; leak: Trigram[]; note: string }> = {
  kan: { wealth: ['kan', 'kun'], leak: ['dui', 'gen'], note: '正北屬水可置魚缸配銅龍；西南屬土宜陶瓷聚寶盆' },
  li: { wealth: ['li', 'gen'], leak: ['dui', 'xun'], note: '正南屬火宜水晶球；東北屬土宜陶瓷聚寶盆' },
  zhen: { wealth: ['zhen', 'qian'], leak: ['kun'], note: '正東屬木宜魚缸或綠色盆栽；西北屬金宜金屬招財神獸' },
  dui: { wealth: ['li', 'qian'], leak: ['gen'], note: '正南屬火宜水晶球；西北屬金宜金屬招財神獸' },
  kun: { wealth: ['zhen', 'kun'], leak: ['li', 'kan'], note: '正東屬木宜魚缸或綠植；西南屬土宜陶瓷聚寶盆' },
  gen: { wealth: ['gen', 'qian'], leak: ['zhen', 'xun'], note: '東北屬土宜陶瓷聚寶盆；西北屬金宜金屬招財神獸' },
  xun: { wealth: ['xun', 'kun'], leak: ['kan'], note: '東南屬木宜魚缸配銅龍或闊葉盆栽；西南屬土宜陶瓷聚寶盆；西北宜設水缸' },
  qian: { wealth: ['qian', 'dui', 'kan'], leak: ['li'], note: '正北屬水宜魚缸配銅龍；西北／正西屬金宜金屬招財神獸；東南宜設水缸' },
}
