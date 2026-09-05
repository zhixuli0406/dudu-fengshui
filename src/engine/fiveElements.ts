/** 五行 (Five Elements) and their generative / controlling relations. */
export type Element = 'wood' | 'fire' | 'earth' | 'metal' | 'water'

export const ELEMENTS: readonly Element[] = ['wood', 'fire', 'earth', 'metal', 'water'] as const

export const ELEMENT_ZH: Record<Element, string> = {
  wood: '木',
  fire: '火',
  earth: '土',
  metal: '金',
  water: '水',
}

/** 相生 (generates): 木生火、火生土、土生金、金生水、水生木 */
const GENERATES: Record<Element, Element> = {
  wood: 'fire',
  fire: 'earth',
  earth: 'metal',
  metal: 'water',
  water: 'wood',
}

/** 相剋 (controls): 木剋土、土剋水、水剋火、火剋金、金剋木 */
const CONTROLS: Record<Element, Element> = {
  wood: 'earth',
  earth: 'water',
  water: 'fire',
  fire: 'metal',
  metal: 'wood',
}

export type Relation =
  | 'same' // 比和
  | 'generates' // a 生 b（a 洩氣）
  | 'generatedBy' // b 生 a（a 得生）
  | 'controls' // a 剋 b（a 耗）
  | 'controlledBy' // b 剋 a（a 受剋）

export const RELATION_ZH: Record<Relation, string> = {
  same: '比和',
  generates: '相生（我生）',
  generatedBy: '相生（生我）',
  controls: '相剋（我剋）',
  controlledBy: '相剋（剋我）',
}

/** Relation of `a` relative to `b`. */
export function relation(a: Element, b: Element): Relation {
  if (a === b) return 'same'
  if (GENERATES[a] === b) return 'generates'
  if (GENERATES[b] === a) return 'generatedBy'
  if (CONTROLS[a] === b) return 'controls'
  return 'controlledBy'
}

export function generates(a: Element): Element {
  return GENERATES[a]
}

export function controls(a: Element): Element {
  return CONTROLS[a]
}

/** The element that generates `a` (生我者). */
export function generatedBy(a: Element): Element {
  return (Object.keys(GENERATES) as Element[]).find((k) => GENERATES[k] === a)!
}

/** The element that controls `a` (剋我者). */
export function controlledBy(a: Element): Element {
  return (Object.keys(CONTROLS) as Element[]).find((k) => CONTROLS[k] === a)!
}

/** Is relation favourable for `a`? (same or generatedBy) */
export function isFavourable(rel: Relation): boolean {
  return rel === 'same' || rel === 'generatedBy'
}

/** Colours / materials associated with each element, used by the advice generator. */
export const ELEMENT_ATTRS: Record<
  Element,
  { colors: string[]; materials: string[]; shapes: string; direction: string; season: string }
> = {
  wood: { colors: ['綠', '青', '淺藍'], materials: ['木', '竹', '藤', '棉麻', '植物'], shapes: '長方、直立', direction: '東、東南', season: '春' },
  fire: { colors: ['紅', '紫', '橙', '粉'], materials: ['燈光', '蠟燭', '皮革', '塑膠'], shapes: '三角、尖形', direction: '南', season: '夏' },
  earth: { colors: ['黃', '土黃', '米', '棕'], materials: ['陶瓷', '石材', '磚', '水晶'], shapes: '方形、扁平', direction: '中央、東北、西南', season: '四季末' },
  metal: { colors: ['白', '金', '銀', '灰'], materials: ['金屬', '銅', '不鏽鋼'], shapes: '圓形、弧形', direction: '西、西北', season: '秋' },
  water: { colors: ['黑', '深藍', '藍'], materials: ['玻璃', '鏡面', '水景', '魚缸'], shapes: '波浪、不規則', direction: '北', season: '冬' },
}
