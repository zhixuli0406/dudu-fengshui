import { pointInPolygon, polygonCentroid, bbox, rectCenter } from '../geometry'
import { ROOM_ZH, type FloorPlan, type Item, type Room } from '../floorplan'
import { overlaps } from './context'
import type { Finding } from './types'

/** Fraction of `upper` room area that lies above `lower` room (sampled). */
function overlapRatio(upper: Room, lower: Room): number {
  if (upper.polygon.length < 3 || lower.polygon.length < 3) return 0
  const b = bbox(upper.polygon)
  const N = 10
  let inside = 0, total = 0
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const p = { x: b.minX + ((i + 0.5) / N) * (b.maxX - b.minX), y: b.minY + ((j + 0.5) / N) * (b.maxY - b.minY) }
    if (!pointInPolygon(p, upper.polygon)) continue
    total++
    if (pointInPolygon(p, lower.polygon)) inside++
  }
  return total ? inside / total : 0
}

const BEDROOMS = new Set(['bedroom', 'master', 'kids'])
const name = (r: Room) => r.name || ROOM_ZH[r.type]

/**
 * 樓上樓下關係規則。各樓層須以相同外牆原點繪製（addFloor 會複製外牆）。
 * 依 docs/research/03 §2.2／§2.10／§2.8／§5.2 的 PROJ 類規則。
 */
export function crossFloorRules(floors: FloorPlan[]): Finding[] {
  const out: Finding[] = []
  const sorted = [...floors].sort((a, b) => (a.level ?? 0) - (b.level ?? 0))
  for (let k = 1; k < sorted.length; k++) {
    const lower = sorted[k - 1]!, upper = sorted[k]!
    if ((upper.level ?? 0) - (lower.level ?? 0) !== 1) continue
    const fl = (f: FloorPlan) => f.name ?? `L${f.level ?? 0}`
    const push = (f: Omit<Finding, 'itemIds' | 'roomIds'> & Partial<Pick<Finding, 'itemIds' | 'roomIds'>>) => out.push({ itemIds: [], roomIds: [], ...f, floor: `${fl(upper)}／${fl(lower)}` })

    for (const up of upper.rooms) for (const lo of lower.rooms) {
      const r = overlapRatio(up, lo)
      if (r < 0.3) continue
      const pair = `${fl(upper)} ${name(up)} 在 ${fl(lower)} ${name(lo)} 上方（重疊約 ${Math.round(r * 100)}%）`
      if (up.type === 'bathroom' && BEDROOMS.has(lo.type)) push({ ruleId: 'toilet_above_bedroom', name: '廁所在臥室上方', category: '廁所', severity: 'high', affects: ['健康'], explanation: `${pair}。廁所濕氣穢氣壓在睡眠空間之上，主頭部與泌尿健康。`, remedies: ['樓下床位移出廁所投影範圍', '樓上廁所加強防水與排水', '天花板加隔層並保持乾燥'], roomIds: [up.id, lo.id] })
      if (up.type === 'bathroom' && (lo.type === 'kitchen' || lo.type === 'dining')) push({ ruleId: 'toilet_above_kitchen', name: '廁所在廚房／餐廳上方', category: '廁所', severity: 'medium', affects: ['健康'], explanation: `${pair}。穢氣壓在飲食空間之上。`, remedies: ['爐灶與餐桌移出投影範圍', '加強樓上防水'], roomIds: [up.id, lo.id] })
      if (up.type === 'bathroom' && lo.type === 'altar') push({ ruleId: 'toilet_above_altar', name: '廁所在神明廳上方', category: '神位', severity: 'high', affects: ['財運', '健康'], explanation: `${pair}。神位上方為廁所，為大忌。`, remedies: ['神位移位', '樓上廁所改為儲藏或更衣室'], roomIds: [up.id, lo.id] })
      if (up.type === 'kitchen' && BEDROOMS.has(lo.type)) push({ ruleId: 'kitchen_above_bedroom', name: '廚房在臥室上方', category: '廚房', severity: 'low', affects: ['健康'], explanation: `${pair}。火氣與油煙壓在臥室上方，各派看法不一。`, remedies: ['床位避開爐灶投影', '加強排煙'], roomIds: [up.id, lo.id], contested: true })
      if (BEDROOMS.has(up.type) && lo.type === 'kitchen') push({ ruleId: 'bedroom_above_kitchen', name: '臥室在廚房上方', category: '床', severity: 'low', affects: ['健康'], explanation: `${pair}。睡在火氣之上，主燥熱、脾氣急。`, remedies: ['床位避開爐灶正上方', '樓下加強排煙'], roomIds: [up.id, lo.id] })
      if (BEDROOMS.has(up.type) && (lo.type === 'driveway' || lo.type === 'void')) push({ ruleId: 'bedroom_over_void', name: `臥室懸空（下方為${ROOM_ZH[lo.type]}）`, category: '格局', severity: 'medium', affects: ['健康', '財運'], explanation: `${pair}。臥室下方無實體空間，古稱「懸空煞」，主不安穩、財不聚。`, remedies: ['臥室改設於有實體樓層之上', '床位移至下方有實牆處'], roomIds: [up.id, lo.id] })
    }
    const upItems = (t: Item['type']) => upper.items.filter((i) => i.type === t)
    const loItems = (t: Item['type']) => lower.items.filter((i) => i.type === t)
    for (const t of upItems('toilet')) for (const b of loItems('bed')) if (overlaps(t, b)) push({ ruleId: 'toilet_over_bed', name: '馬桶在床正上方', category: '床', severity: 'high', affects: ['健康'], explanation: '樓上馬桶投影直接落在樓下床位，穢氣與水管噪音直壓睡眠。', remedies: ['床位移出投影', '樓上馬桶改位'], itemIds: [t.id, b.id] })
    for (const b of upItems('bed')) for (const s of loItems('stove')) if (overlaps(b, s)) push({ ruleId: 'bed_over_stove', name: '床在爐灶正上方', category: '床', severity: 'medium', affects: ['健康'], explanation: '床位直接在樓下爐灶投影之上，火氣上炎主燥熱、脾氣暴躁。', remedies: ['床位移出爐灶投影'], itemIds: [b.id, s.id] })
    for (const st of upItems('stairs')) for (const tgt of [...loItems('bed'), ...loItems('stove'), ...loItems('altar'), ...loItems('desk')]) if (overlaps(st, tgt)) push({ ruleId: 'stairs_over_item', name: `樓梯壓${{ bed: '床', stove: '灶', altar: '神位', desk: '座位' }[tgt.type as 'bed' | 'stove' | 'altar' | 'desk']}`, category: '樓梯', severity: 'medium', affects: ['健康', '財運'], explanation: '樓梯下方氣流被切割、人來人往震動，壓在床、灶、神位或座位上主不安。', remedies: ['將該物件移出樓梯投影', '樓梯下方封板做櫃體'], itemIds: [st.id, tgt.id] })
    for (const lo of lower.rooms) for (const al of upItems('altar')) if (lo.type === 'bathroom' && lo.polygon.length >= 3 && pointInPolygon(rectCenter(al), lo.polygon)) push({ ruleId: 'altar_over_toilet', name: '神位在廁所上方', category: '神位', severity: 'high', affects: ['財運', '健康'], explanation: '神位下方為廁所，穢氣沖犯。', remedies: ['神位移位'], itemIds: [al.id], roomIds: [lo.id] })
    void polygonCentroid
  }
  return out
}
