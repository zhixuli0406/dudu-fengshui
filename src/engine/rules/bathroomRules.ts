import { dist, pointInPolygon } from '../geometry'
import type { PlanContext } from './context'
import type { Finding } from './types'

export function bathroomRules(ctx: PlanContext): Finding[] {
  const out: Finding[] = []
  const baths = ctx.plan.rooms.filter((r) => r.type === 'bathroom' && r.polygon.length >= 3)
  const span = Math.min(ctx.bounds.maxX - ctx.bounds.minX, ctx.bounds.maxY - ctx.bounds.minY)

  for (const b of baths) {
    // 廁所居中
    if (pointInPolygon(ctx.center, b.polygon)) {
      out.push({ ruleId: 'bathroom_center', name: '廁所在宅中心（穢氣居中）', category: '廁所', severity: 'high', affects: ['健康', '財運'],
        explanation: '中宮為全宅氣場核心，廁所居中主穢氣擴散全屋、家人健康與財運皆受影響，且通風不易。',
        remedies: ['廁所保持乾燥、常關門、加裝強力抽風', '放置粗鹽、黃金葛或土種植物吸穢', '大型裝修時考慮移位'], itemIds: [], roomIds: [b.id], marks: [ctx.center] })
    }
    // 廁所方位
    const c = polygonCenter(b.polygon)
    const palace = ctx.palaceOf(c)
    if (palace === 'gen' || palace === 'kun') {
      out.push({ ruleId: 'bathroom_ghost_gate', name: `廁所在${palace === 'gen' ? '東北（表鬼門）' : '西南（裏鬼門）'}`, category: '廁所', severity: 'low', affects: ['健康'],
        explanation: '東北艮、西南坤為陰陽交界之「鬼門線」，日式家相與部分中式流派忌廁所設於此；此說各派不一。',
        remedies: ['加強通風採光與清潔', '放置陶瓷或黃色系物品安定土氣', '不必過度緊張，以清潔乾燥為要'], itemIds: [], roomIds: [b.id], marks: [c], contested: true, source: '家相學／坊間' })
    }
    if (palace === 'qian') {
      out.push({ ruleId: 'bathroom_northwest', name: '廁所在西北（乾宮）', category: '廁所', severity: 'low', affects: ['事業', '健康'],
        explanation: '西北乾宮代表男主人與貴人，廁所在此主男主人事業與頭部健康受影響。',
        remedies: ['保持乾燥清潔，門常關', '放置金屬或白色物品補金氣', '廁所內避免紅色'], itemIds: [], roomIds: [b.id], marks: [c] })
    }
    // 馬桶對門
    for (const toilet of ctx.items('toilet').filter((t) => pointInPolygon(ctx.centerOf(t), b.polygon))) {
      for (const d of ctx.items('door')) {
        const cd = ctx.centerOf(d), ct = ctx.centerOf(toilet)
        if (dist(cd, ct) > 250) continue
        const dr = ctx.roomOf(d) ?? ctx.roomAt(ctx.front(d, 40))
        if (dr?.id !== b.id) continue
        const ang = Math.abs((((d.facing - screenAng(cd, ct)) % 360) + 360) % 360)
        if (Math.min(ang, 360 - ang) > 25) continue
        out.push({ ruleId: 'toilet_faces_door', name: '馬桶正對廁所門', category: '廁所', severity: 'low', affects: ['健康'],
          explanation: '開門即見馬桶，穢氣直出，也影響隱私與觀感。',
          remedies: ['馬桶改側向或移位', '門內加裝門簾或矮隔屏', '門常關'], itemIds: [toilet.id, d.id], roomIds: [b.id], marks: [cd, ct] })
      }
    }
    void span
  }
  return out
}

function polygonCenter(poly: { x: number; y: number }[]): { x: number; y: number } {
  return { x: poly.reduce((a, p) => a + p.x, 0) / poly.length, y: poly.reduce((a, p) => a + p.y, 0) / poly.length }
}

function screenAng(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const d = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI
  return ((d % 360) + 360) % 360
}
