import { dist } from '../geometry'
import { angDiff, faceEachOther, facesItem, screenAng, type PlanContext } from './context'
import type { Finding } from './types'

export function doorRules(ctx: PlanContext): Finding[] {
  const out: Finding[] = []
  const mains = ctx.items('mainDoor')
  const doors = ctx.items('door')
  const windows = ctx.items('window')
  const allDoors = [...mains, ...doors]

  // 穿堂煞：大門直對窗／陽台門，中間無遮擋
  for (const m of mains) {
    for (const w of [...windows, ...doors.filter((d) => ctx.roomOf(d)?.type === 'balcony')]) {
      const cm = ctx.centerOf(m), cw = ctx.centerOf(w)
      const d = dist(cm, cw)
      if (d < 150 || d > 2000) continue
      if (angDiff(m.facing, screenAng(cm, cw)) > 12) continue
      if (ctx.blocked(cm, cw)) continue
      out.push({
        ruleId: 'chuan_tang_sha', name: '穿堂煞（前門直通後窗／陽台）', category: '門', severity: 'high', affects: ['財運', '健康'],
        explanation: '大門進來的氣直接穿過屋子從對面窗戶或陽台洩出，不聚氣，古稱「前通後通、人財兩空」。',
        remedies: ['在大門與窗之間設玄關屏風、櫃體或加裝門簾，讓動線轉折', '對面窗戶改用厚窗簾或半透光貼膜並常關', '玄關放高度超過視線的綠色植物擋煞'],
        itemIds: [m.id, w.id], roomIds: [], marks: [cm, cw], source: '陽宅三要／坊間通論',
      })
    }
  }

  // 大門對廁所門 / 大門對房門 / 大門對廚房門
  for (const m of mains) {
    for (const d of doors) {
      if (!faceEachOther(ctx, m, d, 600, 20)) continue
      const room = ctx.roomOf(d) ?? ctx.roomAt(ctx.front(d, 40))
      const type = room?.type
      if (type === 'bathroom') {
        out.push({ ruleId: 'main_door_to_bathroom', name: '大門對廁所門', category: '門', severity: 'high', affects: ['健康', '財運'],
          explanation: '開門即見廁所，穢氣迎門，主財運與健康受損，也影響進門觀感。',
          remedies: ['廁所門常關並加裝門簾（長度過膝）', '大門內設屏風或玄關櫃阻隔視線', '廁所內保持通風乾燥，放黃金葛或粗鹽'],
          itemIds: [m.id, d.id], roomIds: room ? [room.id] : [], marks: [ctx.centerOf(m), ctx.centerOf(d)] })
      } else if (type === 'kitchen') {
        out.push({ ruleId: 'main_door_to_kitchen', name: '大門對廚房門（開門見灶）', category: '門', severity: 'medium', affects: ['財運', '健康'],
          explanation: '大門直對廚房門，財氣入門即被火氣沖散，古稱「開門見灶，錢財多耗」。',
          remedies: ['廚房門加裝門簾或改為推拉門並常關', '大門內設玄關屏風', '調整爐灶位置避開門的直線'],
          itemIds: [m.id, d.id], roomIds: room ? [room.id] : [], marks: [ctx.centerOf(m), ctx.centerOf(d)] })
      } else if (type === 'bedroom' || type === 'master' || type === 'kids') {
        out.push({ ruleId: 'main_door_to_bedroom', name: '大門對臥室門', category: '門', severity: 'medium', affects: ['健康', '婚姻感情'],
          explanation: '大門直沖臥室門，外氣直入私密空間，主睡眠不安、隱私外洩、口舌是非。',
          remedies: ['臥室門常關並掛門簾', '大門與臥室門之間設屏風或玄關櫃', '床位避開門的直線'],
          itemIds: [m.id, d.id], roomIds: room ? [room.id] : [], marks: [ctx.centerOf(m), ctx.centerOf(d)] })
      }
    }
  }

  // 房門對房門（門沖）
  for (let i = 0; i < doors.length; i++) for (let j = i + 1; j < doors.length; j++) {
    const a = doors[i]!, b = doors[j]!
    if (!faceEachOther(ctx, a, b, 400, 20)) continue
    const ra = ctx.roomOf(a) ?? ctx.roomAt(ctx.front(a, 40)), rb = ctx.roomOf(b) ?? ctx.roomAt(ctx.front(b, 40))
    const types = [ra?.type, rb?.type]
    const hasBath = types.includes('bathroom')
    const hasKitchen = types.includes('kitchen')
    const bedroomTypes = new Set(['bedroom', 'master', 'kids'])
    const hasBed = types.some((t) => t && bedroomTypes.has(t))
    if (hasBath && hasBed) {
      out.push({ ruleId: 'bedroom_door_to_bathroom_door', name: '臥室門對廁所門', category: '門', severity: 'high', affects: ['健康'],
        explanation: '廁所濕氣穢氣直沖臥室，主居住者易有泌尿、腸胃或婦科問題。',
        remedies: ['兩門皆常關、廁所門加門簾', '廁所保持乾燥通風，可置抽濕機', '床位避開門線'], itemIds: [a.id, b.id], roomIds: [ra?.id, rb?.id].filter(Boolean) as string[], marks: [ctx.centerOf(a), ctx.centerOf(b)] })
    } else if (hasBath && hasKitchen) {
      out.push({ ruleId: 'kitchen_door_to_bathroom_door', name: '廚房門對廁所門（水火相沖）', category: '門', severity: 'medium', affects: ['健康', '財運'],
        explanation: '廚房屬火、廁所屬水，兩門相對為水火相沖，穢氣亦入廚房，影響飲食衛生與財運。',
        remedies: ['兩門常關、廁所門加門簾', '廚房門可改推拉門', '之間放置植物或屏風'], itemIds: [a.id, b.id], roomIds: [ra?.id, rb?.id].filter(Boolean) as string[], marks: [ctx.centerOf(a), ctx.centerOf(b)] })
    } else {
      out.push({ ruleId: 'door_to_door', name: '門對門（門沖）', category: '門', severity: 'low', affects: ['人際'],
        explanation: '兩門相對，古稱「門對門，口舌相爭」，主家人之間易起爭執、隱私不足。',
        remedies: ['其中一門加裝門簾', '門上或門側掛五帝錢（民俗）', '調整動線，不要同時開兩門'], itemIds: [a.id, b.id], roomIds: [ra?.id, rb?.id].filter(Boolean) as string[], marks: [ctx.centerOf(a), ctx.centerOf(b)] })
    }
  }

  // 開門見梯／電梯
  for (const m of mains) {
    for (const s of [...ctx.items('stairs'), ...ctx.items('elevator')]) {
      const cs = ctx.centerOf(s)
      const outsideProbe = ctx.back(m, 80)
      const insideProbe = ctx.front(m, 80)
      const near = dist(cs, ctx.centerOf(m)) < 400
      if (!near) continue
      const facingIt = angDiff(m.facing, screenAng(ctx.centerOf(m), cs)) < 30 || angDiff((m.facing + 180) % 360, screenAng(ctx.centerOf(m), cs)) < 30
      if (!facingIt) continue
      void outsideProbe; void insideProbe
      const isLift = s.type === 'elevator'
      out.push({ ruleId: isLift ? 'main_door_to_elevator' : 'main_door_to_stairs', name: isLift ? '大門對電梯（開口煞）' : '大門對樓梯（牽牛煞）', category: '樓梯', severity: 'medium', affects: ['財運', '安全'],
        explanation: isLift ? '電梯門開合如口，正對大門為「開口煞」，氣場不穩、主財來財去。' : '大門正對樓梯，向下的樓梯洩財、向上的樓梯壓迫，皆不利聚氣。',
        remedies: ['門內設玄關屏風或地墊轉折動線', '門檻或門內放置五帝錢（民俗）', '門口放置矮盆栽緩衝'], itemIds: [m.id, s.id], roomIds: [], marks: [ctx.centerOf(m), cs] })
    }
  }

  // 房門對窗（小穿堂）
  for (const d of doors) {
    for (const w of windows) {
      if (!facesItem(ctx, d, w, 800, 10)) continue
      const room = ctx.roomOf(d) ?? ctx.roomAt(ctx.front(d, 40))
      if (!room || ctx.roomAt(ctx.centerOf(w))?.id !== room.id) continue
      out.push({ ruleId: 'door_to_window', name: '房門直對窗', category: '窗', severity: 'low', affects: ['健康', '財運'],
        explanation: '房門與窗成一直線，氣流直進直出不停留，該房不易聚氣、睡眠品質差。',
        remedies: ['窗戶加厚窗簾', '門與窗之間放置矮櫃或植物', '床或桌避開此直線'], itemIds: [d.id, w.id], roomIds: [room.id], marks: [ctx.centerOf(d), ctx.centerOf(w)] })
    }
  }

  void allDoors
  return out
}
