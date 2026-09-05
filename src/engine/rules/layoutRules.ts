import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../bagua'
import { pointInPolygon, polygonArea, polygonCentroid } from '../geometry'
import type { RoomType } from '../floorplan'
import type { PlanContext } from './context'
import type { Finding } from './types'

/** 缺角、房中房、中宮用途、房間方位宜忌 */
export function layoutRules(ctx: PlanContext): Finding[] {
  const out: Finding[] = []
  const outline = ctx.plan.outline
  if (outline.length >= 4) {
    const { minX, minY, maxX, maxY } = ctx.bounds
    const w = maxX - minX, h = maxY - minY
    // sample bbox grid; per palace sector, fraction outside outline
    const N = 40
    const counts: Record<Trigram, { total: number; out: number }> = Object.fromEntries(TRIGRAMS_CLOCKWISE.map((t) => [t, { total: 0, out: 0 }])) as never
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const p = { x: minX + ((i + 0.5) / N) * w, y: minY + ((j + 0.5) / N) * h }
      const rel = Math.hypot((p.x - ctx.center.x) / (w / 2), (p.y - ctx.center.y) / (h / 2))
      if (rel < 0.45) continue // ignore inner zone
      const t = ctx.palaceOf(p)
      counts[t].total++
      if (!pointInPolygon(p, outline)) counts[t].out++
    }
    for (const t of TRIGRAMS_CLOCKWISE) {
      const c = counts[t]
      if (!c.total) continue
      const ratio = c.out / c.total
      if (ratio > 0.4) {
        const p = PALACES[t]
        out.push({ ruleId: `missing_corner_${t}`, name: `${p.direction}方缺角（${p.zh}宮）`, category: '格局', severity: ratio > 0.6 ? 'medium' : 'low', affects: affectOfPalace(t),
          explanation: `${p.zh}宮代表${p.family}、${p.body}；此方位缺角約 ${Math.round(ratio * 100)}%，主對應家庭成員運勢與健康較弱。`,
          remedies: [`在${p.direction}方放置${p.element === 'wood' ? '綠色植物' : p.element === 'fire' ? '紅色或燈光' : p.element === 'earth' ? '陶瓷或黃色擺設' : p.element === 'metal' ? '金屬或白色擺設' : '藍黑色或小水景'}補足該宮五行`, '該方位牆面掛鏡或明亮照明延伸空間感（鏡不可對門床）', '缺角處若為陽台可規劃為使用空間'],
          itemIds: [], roomIds: [], contested: ratio < 0.6 })
      }
    }
  }

  // 房中房：臥室內含另一封閉房間（更衣室／衛浴）且面積 > 1/3
  const rooms = ctx.plan.rooms.filter((r) => r.polygon.length >= 3)
  for (const outer of rooms) {
    if (!['bedroom', 'master'].includes(outer.type)) continue
    for (const inner of rooms) {
      if (inner.id === outer.id || !['storage', 'other', 'bathroom'].includes(inner.type)) continue
      if (!inner.polygon.every((p) => pointInPolygon(p, outer.polygon) || onEdge(p, outer.polygon))) continue
      const ratio = polygonArea(inner.polygon) / Math.max(1, polygonArea(outer.polygon))
      if (ratio > 0.25) {
        out.push({ ruleId: 'room_in_room', name: '房中房（臥室內另有大房間）', category: '格局', severity: 'low', affects: ['婚姻感情'],
          explanation: '臥室內包含面積超過四分之一的封閉房間（更衣室／衛浴），古稱「房中房，必有二房」，主感情易生變。',
          remedies: ['內房改為開放式或拆除門片', '減少內房使用比例', '此說屬民俗，以動線舒適為先'], itemIds: [], roomIds: [outer.id, inner.id], contested: true })
      }
    }
  }

  // 中宮用途
  const centerRoom = ctx.roomAt(ctx.center)
  if (centerRoom?.type === 'kitchen') {
    out.push({ ruleId: 'kitchen_center', name: '廚房在宅中心', category: '廚房', severity: 'medium', affects: ['健康'],
      explanation: '廚房火氣居中宮，主家人心臟、血壓與情緒問題，油煙亦擴散全屋。', remedies: ['中央區域改為餐廳', '加強排煙', '爐灶盡量靠邊'], itemIds: [], roomIds: [centerRoom.id], marks: [ctx.center] })
  }
  if (centerRoom?.type === 'storage') {
    out.push({ ruleId: 'storage_center', name: '儲藏室在宅中心', category: '格局', severity: 'low', affects: ['健康', '財運'],
      explanation: '中宮堆放雜物、陰暗不通風，主氣場沉滯。', remedies: ['中宮保持明亮整潔', '改作開放式書房或餐廳'], itemIds: [], roomIds: [centerRoom.id], marks: [ctx.center] })
  }

  // 房間方位宜忌
  for (const r of rooms) {
    const c = polygonCentroid(r.polygon)
    const t = ctx.palaceOf(c)
    const adv = ROOM_PALACE_ADVICE[r.type]?.[t]
    if (adv && adv.level === 'avoid') {
      out.push({ ruleId: `room_palace_${r.type}_${t}`, name: `${roomZh(r.type)}位於${PALACES[t].direction}（${adv.title}）`, category: '格局', severity: 'low', affects: adv.affects,
        explanation: adv.why, remedies: adv.remedies, itemIds: [], roomIds: [r.id], marks: [c], contested: adv.contested })
    }
  }
  return out
}

function onEdge(p: { x: number; y: number }, poly: { x: number; y: number }[]): boolean {
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!
    const l2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2
    if (l2 === 0) continue
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
    t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(p.x - (a.x + t * (b.x - a.x)), p.y - (a.y + t * (b.y - a.y)))
    if (d < 3) return true
  }
  return false
}

function affectOfPalace(t: Trigram): Finding['affects'] {
  switch (t) {
    case 'qian': return ['事業', '健康']
    case 'kun': return ['婚姻感情', '健康']
    case 'zhen': return ['子女', '事業']
    case 'xun': return ['財運', '子女']
    case 'kan': return ['事業', '健康']
    case 'li': return ['人際', '健康']
    case 'gen': return ['子女', '財運']
    case 'dui': return ['子女', '人際']
  }
}

interface Advice { level: 'good' | 'ok' | 'avoid'; title: string; why: string; affects: Finding['affects']; remedies: string[]; contested?: boolean }

export const ROOM_PALACE_ADVICE: Partial<Record<RoomType, Partial<Record<Trigram, Advice>>>> = {
  kitchen: {
    qian: { level: 'avoid', title: '火燒天門', why: '西北屬金主男主人，廚火在此火剋金，不利男主人健康與事業。', affects: ['健康', '事業'], remedies: ['以土通關：黃色、陶瓷', '改用 IH 爐減少明火', '加強通風'] },
    xun: { level: 'good', title: '木生火', why: '「廚房建在東南可以，但是建在西北就不行」——東南木生火，廚房佳位。', affects: [], remedies: [] },
  },
  kids: {
    qian: { level: 'avoid', title: '小孩住乾宮', why: '西北代表權威、厚重，兒童房在此容易讓孩子早熟，不利學習與成長（100 室內設計）。', affects: ['子女', '人際'], remedies: ['兒童房改用東、東南（清晨有陽光、屬木利成長）', '若無法調整，房內用綠色、木質與充足光線'] },
    zhen: { level: 'good', title: '兒童房宜東', why: '清晨能接受到陽光，五行屬木利成長。', affects: [], remedies: [] },
    xun: { level: 'good', title: '兒童房宜東南', why: '清晨能接受到陽光，五行屬木利成長。', affects: [], remedies: [] },
  },
}

function roomZh(t: RoomType): string {
  const m: Record<RoomType, string> = { living: '客廳', bedroom: '臥室', master: '主臥', kids: '兒童房', study: '書房', kitchen: '廚房', dining: '餐廳', bathroom: '廁所', entry: '玄關', balcony: '陽台', altar: '神明廳', storage: '儲藏室', corridor: '走道', driveway: '騎樓／車道', void: '挑空', other: '房間' }
  return m[t]
}
