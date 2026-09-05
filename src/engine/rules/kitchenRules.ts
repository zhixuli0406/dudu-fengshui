import { dist } from '../geometry'
import { angDiff, faceEachOther, facesItem, overlaps, screenAng, type PlanContext } from './context'
import type { Finding } from './types'

export function kitchenRules(ctx: PlanContext): Finding[] {
  const out: Finding[] = []
  const stoves = ctx.items('stove')
  const doors = [...ctx.items('door'), ...ctx.items('mainDoor')]
  for (const stove of stoves) {
    const room = ctx.roomOf(stove)
    const roomIds = room ? [room.id] : []
    const cs = ctx.centerOf(stove)

    // 開門見灶：任何門直對爐灶
    for (const d of doors) {
      if (!facesItem(ctx, d, stove, 600, 20)) continue
      const isMain = d.type === 'mainDoor'
      out.push({ ruleId: isMain ? 'main_door_sees_stove' : 'door_sees_stove', name: isMain ? '大門直見爐灶' : '門直對爐灶（開門見灶）', category: '廚房', severity: isMain ? 'high' : 'medium', affects: ['財運', '健康'],
        explanation: '爐灶為財庫，門直沖爐灶主財氣外洩、家人易有口舌與火氣。',
        remedies: ['調整爐灶位置離開門的直線', '廚房門加裝門簾或改推拉門', '門與灶之間放置櫃體或屏風'], itemIds: [d.id, stove.id], roomIds, marks: [ctx.centerOf(d), cs] })
    }

    // 水火相沖：灶與水槽／冰箱相對或緊鄰
    for (const wet of [...ctx.items('sink'), ...ctx.items('fridge')]) {
      const cw = ctx.centerOf(wet)
      const d = dist(cs, cw)
      const facing = faceEachOther(ctx, stove, wet, 300, 35)
      // edge gap ≈ centre distance − half extents（來源門檻：< 60cm 命中、60–90cm 輕微）
      const gap = d - (Math.max(stove.w, stove.h) + Math.max(wet.w, wet.h)) / 2
      const sameSide = angDiff(stove.facing, wet.facing) < 45
      const adjacent = sameSide && gap < 90
      if (!facing && !adjacent) continue
      const zh = wet.type === 'sink' ? '水槽' : '冰箱'
      const sev: 'medium' | 'low' = facing || gap < 60 ? 'medium' : 'low'
      out.push({ ruleId: facing ? 'stove_faces_water' : 'stove_adjacent_water', name: facing ? `爐灶正對${zh}（水火相沖）` : `爐灶緊鄰${zh}（水火相沖，間距約 ${Math.max(0, Math.round(gap))} 公分）`, category: '廚房', severity: sev, affects: ['健康', '婚姻感情'],
        explanation: '爐灶屬火、水槽冰箱屬水，相對或間距不足為水火相沖，主家人腸胃、口角與夫妻不和。各家門檻 30–90 公分不一，本程式以 60 公分為命中、90 公分為安全。',
        remedies: ['灶與水槽／冰箱之間保留 60–90 公分以上的檯面，或以木質（木通關）隔開', '相對時可在中間放置木質工作檯或植物', '冰箱改放廚房他側'], itemIds: [stove.id, wet.id], roomIds, marks: [cs, cw] })
    }

    // 灶後靠窗／灶後無靠
    const behind = ctx.back(stove, Math.min(stove.w, stove.h) / 2 + 20)
    const win = ctx.windowNear(behind, 40) ?? ctx.windowNear(ctx.back(stove, stove.h / 2), 40)
    if (win) {
      out.push({ ruleId: 'stove_back_window', name: '爐灶背後是窗', category: '廚房', severity: 'medium', affects: ['財運', '健康'],
        explanation: '灶後無實牆、面對窗戶，火苗易受風影響，象徵財庫無靠、財來財去。',
        remedies: ['爐灶移至靠實牆處', '窗戶改為固定式或加裝擋風玻璃', '灶後加裝背板'], itemIds: [stove.id, win.id], roomIds, marks: [behind] })
    } else if (ctx.wallDistance(behind) > 40) {
      out.push({ ruleId: 'stove_no_backing', name: '爐灶背後無靠（中島灶）', category: '廚房', severity: 'low', affects: ['財運'],
        explanation: '中島式爐灶四面無靠，煮食時背後空虛，傳統認為財庫不穩；現代廚房可用設計補救。',
        remedies: ['以中島後方矮櫃或吧台形成靠山', '主要烹煮改用靠牆爐具', '中島僅作備餐用途'], itemIds: [stove.id], roomIds, marks: [behind], contested: true })
    }

    // 灶對廁所門
    for (const d of doors) {
      const dr = ctx.roomOf(d) ?? ctx.roomAt(ctx.front(d, 40))
      if (dr?.type !== 'bathroom') continue
      const cd = ctx.centerOf(d)
      if (dist(cd, cs) > 400 || ctx.blocked(cd, cs)) continue
      if (angDiff(d.facing, screenAng(cd, cs)) > 30 && angDiff((d.facing + 180) % 360, screenAng(cd, cs)) > 30) continue
      out.push({ ruleId: 'stove_faces_bathroom', name: '爐灶正對廁所門', category: '廚房', severity: 'high', affects: ['健康'],
        explanation: '廁所穢氣直沖烹煮之處，衛生與風水皆不宜，主消化系統疾病。',
        remedies: ['廁所門常關並加門簾', '爐灶移位避開門線', '之間設置櫃體阻隔'], itemIds: [stove.id, d.id], roomIds: [...roomIds, dr.id], marks: [cd, cs] })
    }

    // 樑壓灶
    for (const beam of ctx.items('beam')) {
      if (!overlaps(beam, stove)) continue
      out.push({ ruleId: 'beam_over_stove', name: '樑壓爐灶', category: '樑柱', severity: 'medium', affects: ['健康', '財運'],
        explanation: '爐灶上方有樑壓，主女主人健康與家中財庫受壓。',
        remedies: ['爐灶移出樑下', '以天花包樑或櫃體修飾'], itemIds: [stove.id, beam.id], roomIds, marks: [ctx.centerOf(beam)] })
    }

    // 廚房／爐灶方位：西北（火燒天門）、中宮
    const palace = ctx.palaceOfItem(stove)
    if (palace === 'qian') {
      out.push({ ruleId: 'stove_in_northwest', name: '爐灶在西北（火燒天門）', category: '廚房', severity: 'medium', affects: ['健康', '事業'],
        explanation: '西北乾宮代表男主人與頭部，屬金，爐火在此為火剋金，古稱「火燒天門」，主男主人健康、事業受損。',
        remedies: ['爐灶改置東、東南（木生火）方位', '無法更動時以土（黃色、陶瓷）通關洩火生金', '減少該處明火使用、改用 IH 爐'], itemIds: [stove.id], roomIds, marks: [cs] })
    }
    const centerDist = dist(cs, ctx.center)
    const span = Math.min(ctx.bounds.maxX - ctx.bounds.minX, ctx.bounds.maxY - ctx.bounds.minY)
    if (centerDist < span * 0.15) {
      out.push({ ruleId: 'stove_in_center', name: '爐灶在宅中心（火燒心）', category: '廚房', severity: 'medium', affects: ['健康'],
        explanation: '中宮為全宅心臟，爐火在此主家人心血管、脾氣火爆。',
        remedies: ['爐灶移離中宮', '中央區域改作餐廳或客廳'], itemIds: [stove.id], roomIds, marks: [cs] })
    }
  }

  // 廚房與廁所相鄰（共用牆）
  const kitchens = ctx.plan.rooms.filter((r) => r.type === 'kitchen')
  const baths = ctx.plan.rooms.filter((r) => r.type === 'bathroom')
  for (const k of kitchens) for (const b of baths) {
    if (!sharesWall(k.polygon, b.polygon)) continue
    out.push({ ruleId: 'kitchen_adjacent_bathroom', name: '廚房與廁所相鄰', category: '廚房', severity: 'low', affects: ['健康'],
      explanation: '廚房屬火、廁所屬水，共用牆面為水火相鄰，且穢氣易影響飲食區。',
      remedies: ['共用牆加強防水與通風', '爐灶不靠廁所那面牆', '廁所門不對廚房'], itemIds: [], roomIds: [k.id, b.id] })
  }
  return out
}

function sharesWall(a: { x: number; y: number }[], b: { x: number; y: number }[]): boolean {
  if (a.length < 3 || b.length < 3) return false
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]!, a2 = a[(i + 1) % a.length]!
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j]!, b2 = b[(j + 1) % b.length]!
      const horizA = Math.abs(a1.y - a2.y) < 1, horizB = Math.abs(b1.y - b2.y) < 1
      const vertA = Math.abs(a1.x - a2.x) < 1, vertB = Math.abs(b1.x - b2.x) < 1
      if (horizA && horizB && Math.abs(a1.y - b1.y) < 25) {
        const ov = Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) - Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x))
        if (ov > 80) return true
      }
      if (vertA && vertB && Math.abs(a1.x - b1.x) < 25) {
        const ov = Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) - Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y))
        if (ov > 80) return true
      }
    }
  }
  return false
}
