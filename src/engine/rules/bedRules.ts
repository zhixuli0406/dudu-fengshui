import { dist } from '../geometry'
import { angDiff, facesItem, headPoint, overlaps, screenAng, type PlanContext } from './context'
import type { Finding } from './types'

export function bedRules(ctx: PlanContext): Finding[] {
  const out: Finding[] = []
  const beds = ctx.items('bed')
  const doors = [...ctx.items('door'), ...ctx.items('mainDoor')]
  for (const bed of beds) {
    const room = ctx.roomOf(bed)
    const roomIds = room ? [room.id] : []
    const head = headPoint(ctx, bed)
    const behindHead = ctx.front(bed, bed.h / 2 + 25)

    // 床頭靠窗
    const win = ctx.windowNear(head, 45)
    if (win) {
      out.push({ ruleId: 'bed_head_window', name: '床頭靠窗', category: '床', severity: 'medium', affects: ['健康'],
        explanation: '床頭在窗下，氣流與光線直接干擾頭部，缺乏靠山感，易失眠、頭痛、缺安全感。',
        remedies: ['床頭改靠實牆', '若無法移動，加裝厚窗簾與床頭板', '窗戶加隔音氣密條'], itemIds: [bed.id, win.id], roomIds, marks: [head] })
    } else if (ctx.wallDistance(behindHead) > 30 && ctx.wallDistance(head) > 30) {
      // 床頭無靠
      out.push({ ruleId: 'bed_head_no_wall', name: '床頭無靠（懸空）', category: '床', severity: 'medium', affects: ['健康', '事業'],
        explanation: '床頭沒有靠牆，象徵無靠山，主睡眠不安穩、事業缺乏支持。',
        remedies: ['床頭移至靠實牆', '至少加厚重床頭板或床頭櫃形成靠山'], itemIds: [bed.id], roomIds, marks: [head] })
    }

    // 門沖床
    for (const d of doors) {
      const cd = ctx.centerOf(d)
      if (!facesItem(ctx, d, bed, 500, 22)) continue
      const foot = ctx.back(bed, bed.h / 2)
      const toHead = dist(cd, head), toFoot = dist(cd, foot)
      const part = toHead < toFoot ? '床頭' : '床尾'
      out.push({ ruleId: 'door_rushes_bed', name: `門沖床（${part}）`, category: '床', severity: part === '床尾' ? 'high' : 'medium', affects: ['健康', '婚姻感情'],
        explanation: part === '床尾' ? '門正對床尾，古稱「開門見床、腳對門」為停靈之象，主健康與運勢不佳。' : '門正對床頭，開門時氣流與視線直沖頭部，主睡眠不安、易做惡夢。',
        remedies: ['移動床位離開門的直線', '無法移動時在門與床之間放屏風或高矮櫃', '門加裝門簾並保持關閉'], itemIds: [bed.id, d.id], roomIds, marks: [cd, ctx.centerOf(bed)] })
    }

    // 樑壓床
    for (const beam of ctx.items('beam')) {
      if (!overlaps(beam, bed)) continue
      const overHead = dist(ctx.centerOf(beam), head) < Math.max(beam.w, beam.h) / 2 + 40
      out.push({ ruleId: overHead ? 'beam_over_bed_head' : 'beam_over_bed', name: overHead ? '樑壓床頭' : '樑壓床', category: '樑柱', severity: overHead ? 'high' : 'medium', affects: ['健康'],
        explanation: '橫樑在床的正上方形成壓迫感，長期睡在樑下主頭痛、精神壓力、病痛不斷，壓床頭尤忌。',
        remedies: ['將床移出樑的投影範圍', '以天花板包樑、間接照明拉平視覺', '樑下放置床頭櫃或以布幔遮蔽（民俗）'], itemIds: [bed.id, beam.id], roomIds, marks: [ctx.centerOf(beam)] })
    }

    // 鏡照床
    for (const mirror of ctx.items('mirror')) {
      if (!facesItem(ctx, mirror, bed, 400, 35)) continue
      out.push({ ruleId: 'mirror_faces_bed', name: '鏡子照床', category: '鏡', severity: 'medium', affects: ['健康', '婚姻感情'],
        explanation: '鏡子反射床位，半夜易受驚嚇，也象徵夫妻間多第三者干擾、感情不睦。',
        remedies: ['移動鏡子使其不照到床', '改用可收合的衣櫃內側鏡或加裝布簾', '電視螢幕同理，不用時可遮蓋'], itemIds: [bed.id, mirror.id], roomIds, marks: [ctx.centerOf(mirror), ctx.centerOf(bed)] })
    }

    // 床頭靠廁所牆 / 床對廁所門
    for (const r of ctx.plan.rooms) {
      if (r.type !== 'bathroom' || r.polygon.length < 3) continue
      const nearBathWall = r.polygon.some((_, i) => {
        const a = r.polygon[i]!, b = r.polygon[(i + 1) % r.polygon.length]!
        return distToSegment(behindHead, a, b) < 30 || distToSegment(head, a, b) < 30
      })
      if (nearBathWall && room?.id !== r.id) {
        out.push({ ruleId: 'bed_head_bathroom_wall', name: '床頭靠廁所牆', category: '床', severity: 'medium', affects: ['健康'],
          explanation: '床頭與廁所共用一面牆，濕氣與水管噪音直接影響頭部，主頭部與泌尿系統問題。',
          remedies: ['床頭改靠其他牆面', '該牆加做防潮與隔音層', '床頭與牆之間保留櫃體緩衝'], itemIds: [bed.id], roomIds: [...roomIds, r.id], marks: [head] })
      }
    }
    for (const d of doors) {
      const dr = ctx.roomOf(d) ?? ctx.roomAt(ctx.front(d, 40))
      if (dr?.type !== 'bathroom') continue
      const cd = ctx.centerOf(d), cb = ctx.centerOf(bed)
      if (dist(cd, cb) > 400 || ctx.blocked(cd, cb)) continue
      if (angDiff(d.facing, screenAng(cd, cb)) > 30 && angDiff((d.facing + 180) % 360, screenAng(cd, cb)) > 30) continue
      out.push({ ruleId: 'bed_faces_bathroom_door', name: '床正對廁所門', category: '床', severity: 'high', affects: ['健康'],
        explanation: '廁所門直對床，穢氣與濕氣直沖床位，主健康與睡眠受損。',
        remedies: ['移動床位避開廁所門', '廁所門常關並加門簾', '廁所保持乾燥、放置除濕與植物'], itemIds: [bed.id, d.id], roomIds: [...roomIds, dr.id], marks: [cd, cb] })
    }

    // 床在廚房內（套房）／床對爐灶
    for (const stove of ctx.items('stove')) {
      if (dist(ctx.centerOf(stove), ctx.centerOf(bed)) < 250 && !ctx.blocked(ctx.centerOf(stove), ctx.centerOf(bed))) {
        out.push({ ruleId: 'bed_near_stove', name: '床位緊鄰爐灶', category: '床', severity: 'medium', affects: ['健康'],
          explanation: '爐灶火氣與油煙直接影響床位，主脾氣暴躁、上火、睡眠差（套房常見）。',
          remedies: ['床與灶之間設隔屏或櫃體', '加強抽油煙與通風', '床頭遠離灶的方向'], itemIds: [bed.id, stove.id], roomIds, marks: [ctx.centerOf(stove), ctx.centerOf(bed)] })
      }
    }
  }
  return out
}

function distToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const l2 = dist(a, b) ** 2
  if (l2 === 0) return dist(p, a)
  let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2
  t = Math.max(0, Math.min(1, t))
  return dist(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
}
