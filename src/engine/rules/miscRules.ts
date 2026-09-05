import { dist, pointInPolygon } from '../geometry'
import { angDiff, facesItem, overlaps, screenAng, type PlanContext } from './context'
import type { Finding } from './types'

/** 書桌、沙發、神位、鏡對門、樓梯、魚缸、柱角 */
export function miscRules(ctx: PlanContext): Finding[] {
  const out: Finding[] = []
  const doors = [...ctx.items('door'), ...ctx.items('mainDoor')]

  // 書桌 / 辦公桌
  for (const desk of ctx.items('desk')) {
    const room = ctx.roomOf(desk)
    const roomIds = room ? [room.id] : []
    const cd = ctx.centerOf(desk)
    const behind = ctx.back(desk, desk.h / 2 + 30)
    for (const d of doors) {
      const dc = ctx.centerOf(d)
      if (dist(dc, cd) > 500 || ctx.blocked(dc, cd)) continue
      const dirToDoor = screenAng(cd, dc)
      // 背門：門在座位背後方向
      if (angDiff((desk.facing + 180) % 360, dirToDoor) < 40) {
        out.push({ ruleId: 'desk_back_to_door', name: '書桌／座位背門', category: '書房', severity: 'medium', affects: ['事業', '學業', '人際'],
          explanation: '座位背對門，身後有人進出無法察覺，主缺乏安全感、易犯小人、專注力差。',
          remedies: ['桌子轉向，讓座位斜對門而不正對', '無法調整時在桌上放小鏡子或以高椅背形成靠山', '門加裝門簾'], itemIds: [desk.id, d.id], roomIds, marks: [dc, cd] })
      } else if (facesItem(ctx, d, desk, 400, 20)) {
        out.push({ ruleId: 'desk_faces_door', name: '書桌正對門（門沖桌）', category: '書房', severity: 'low', affects: ['學業', '事業'],
          explanation: '門直沖座位，氣流與干擾直衝而來，不易專注。',
          remedies: ['桌子側移離開門線', '門與桌之間放置矮櫃或植物'], itemIds: [desk.id, d.id], roomIds, marks: [dc, cd] })
      }
    }
    const win = ctx.windowNear(behind, 40)
    if (win) {
      out.push({ ruleId: 'desk_back_to_window', name: '座位背窗（背後無靠）', category: '書房', severity: 'low', affects: ['事業', '學業'],
        explanation: '座位背後是窗，光線從背後來且無實牆，象徵靠山空虛、貴人不足。',
        remedies: ['桌子轉向使背後為實牆', '窗戶加百葉或厚窗簾', '高椅背補靠山'], itemIds: [desk.id, win.id], roomIds, marks: [behind] })
    }
    for (const beam of ctx.items('beam')) if (overlaps(beam, desk)) {
      out.push({ ruleId: 'beam_over_desk', name: '樑壓書桌', category: '樑柱', severity: 'medium', affects: ['學業', '事業', '健康'],
        explanation: '座位上方有樑，主壓力大、思緒不清、頭痛。', remedies: ['桌子移出樑下', '天花包樑或以燈槽修飾'], itemIds: [desk.id, beam.id], roomIds, marks: [ctx.centerOf(beam)] })
    }
    // 對廁所門
    for (const d of doors) {
      const dr = ctx.roomOf(d) ?? ctx.roomAt(ctx.front(d, 40))
      if (dr?.type !== 'bathroom') continue
      const dc = ctx.centerOf(d)
      if (dist(dc, cd) > 350 || ctx.blocked(dc, cd)) continue
      if (angDiff(desk.facing, screenAng(cd, dc)) > 35) continue
      out.push({ ruleId: 'desk_faces_bathroom', name: '座位面對廁所門', category: '書房', severity: 'low', affects: ['學業', '事業'],
        explanation: '工作或讀書時正對廁所門，穢氣與視覺干擾影響專注。', remedies: ['桌子轉向', '廁所門常關加門簾'], itemIds: [desk.id, d.id], roomIds: [...roomIds, dr.id], marks: [dc, cd] })
    }
  }

  // 沙發
  for (const sofa of ctx.items('sofa')) {
    const room = ctx.roomOf(sofa)
    const roomIds = room ? [room.id] : []
    const behind = ctx.back(sofa, sofa.h / 2 + 30)
    for (const d of doors) {
      const dc = ctx.centerOf(d), cs = ctx.centerOf(sofa)
      if (dist(dc, cs) > 500 || ctx.blocked(dc, cs)) continue
      if (angDiff((sofa.facing + 180) % 360, screenAng(cs, dc)) < 35) {
        out.push({ ruleId: 'sofa_back_to_door', name: '沙發背門', category: '客廳', severity: 'low', affects: ['人際', '財運'],
          explanation: '沙發背對大門或房門，主人坐時背後無法掌握動靜，主缺乏安全感、易犯小人。',
          remedies: ['沙發改為面向或側對門', '沙發後放置矮櫃或屏風形成靠山'], itemIds: [sofa.id, d.id], roomIds, marks: [dc, cs] })
      }
    }
    if (ctx.wallDistance(behind) > 60 && !ctx.windowNear(behind, 40)) {
      out.push({ ruleId: 'sofa_no_backing', name: '沙發背後無靠', category: '客廳', severity: 'low', affects: ['事業', '人際'],
        explanation: '沙發後方空曠無牆，象徵無靠山，主事業與人際缺乏支持。',
        remedies: ['沙發靠牆擺放', '沙發後加矮櫃、長桌或屏風'], itemIds: [sofa.id], roomIds, marks: [behind] })
    }
    for (const beam of ctx.items('beam')) if (overlaps(beam, sofa)) {
      out.push({ ruleId: 'beam_over_sofa', name: '樑壓沙發', category: '樑柱', severity: 'low', affects: ['健康'],
        explanation: '沙發上方有樑，久坐者易感壓迫、肩頸不適。', remedies: ['沙發移出樑下', '天花包樑修飾'], itemIds: [sofa.id, beam.id], roomIds, marks: [ctx.centerOf(beam)] })
    }
  }

  // 神位
  for (const altar of ctx.items('altar')) {
    const room = ctx.roomOf(altar)
    const roomIds = room ? [room.id] : []
    const ca = ctx.centerOf(altar)
    const behind = ctx.back(altar, altar.h / 2 + 30)
    for (const r of ctx.plan.rooms) {
      if (r.polygon.length < 3) continue
      if (r.type === 'bathroom' && pointInPolygon(behind, r.polygon)) {
        out.push({ ruleId: 'altar_backs_bathroom', name: '神位背靠廁所', category: '神位', severity: 'high', affects: ['健康', '財運'],
          explanation: '神位後方為廁所，穢氣沖犯神明，為神位大忌。', remedies: ['神位移至背靠實牆且後方非廁所／廚房之處', '無法移動時神位後加裝實木背板並保持廁所乾淨'], itemIds: [altar.id], roomIds: [...roomIds, r.id], marks: [ca] })
      }
      if (r.type === 'kitchen' && pointInPolygon(behind, r.polygon)) {
        out.push({ ruleId: 'altar_backs_kitchen', name: '神位背靠廚房', category: '神位', severity: 'medium', affects: ['健康'],
          explanation: '神位後方為爐灶所在，火氣沖犯，主家人脾氣暴躁、不安寧。', remedies: ['神位移位', '神位後加實木背板'], itemIds: [altar.id], roomIds: [...roomIds, r.id], marks: [ca] })
      }
    }
    for (const d of doors) {
      const dr = ctx.roomOf(d) ?? ctx.roomAt(ctx.front(d, 40))
      if (dr?.type !== 'bathroom' && dr?.type !== 'kitchen') continue
      const dc = ctx.centerOf(d)
      if (dist(dc, ca) > 500 || ctx.blocked(dc, ca)) continue
      if (angDiff(altar.facing, screenAng(ca, dc)) > 30) continue
      out.push({ ruleId: 'altar_faces_bathroom_or_kitchen', name: `神位正對${dr.type === 'bathroom' ? '廁所' : '廚房'}門`, category: '神位', severity: 'high', affects: ['健康', '財運'],
        explanation: '神位面對廁所或廚房門，為沖煞，主家運不順。', remedies: ['神位轉向或移位', '該門常關加門簾'], itemIds: [altar.id, d.id], roomIds: [...roomIds, dr.id], marks: [dc, ca] })
    }
    for (const beam of ctx.items('beam')) if (overlaps(beam, altar)) {
      out.push({ ruleId: 'beam_over_altar', name: '樑壓神位', category: '神位', severity: 'high', affects: ['健康', '財運'],
        explanation: '神位上方有樑壓，主家運受壓、諸事不順。', remedies: ['神位移出樑下', '天花包樑'], itemIds: [altar.id, beam.id], roomIds, marks: [ctx.centerOf(beam)] })
    }
    if (ctx.wallDistance(behind) > 40 || ctx.windowNear(behind, 40)) {
      out.push({ ruleId: 'altar_no_backing', name: '神位背後無靠或靠窗', category: '神位', severity: 'medium', affects: ['財運', '健康'],
        explanation: '神位背後應為實牆，靠窗或懸空主家運不穩。', remedies: ['神位移至實牆前', '背後加實木背板'], itemIds: [altar.id], roomIds, marks: [behind] })
    }
    const mainDoor = ctx.items('mainDoor')[0]
    if (mainDoor && angDiff(altar.facing, (mainDoor.facing + 180) % 360) > 135) {
      out.push({ ruleId: 'altar_reversed', name: '神位與宅向相反（倒頭廳）', category: '神位', severity: 'medium', affects: ['財運', '健康'],
        explanation: '神桌坐向應與房屋坐向一致（面朝大門方向）；反背為「倒頭廳」，傳統認為家運顛倒。',
        remedies: ['神位轉為與宅向一致', '無法調整時至少不背對大門'], itemIds: [altar.id, mainDoor.id], roomIds, marks: [ca], source: 'Ailan 風水研究室' })
    }
    const bedroomNear = ctx.plan.rooms.find((r) => ['bedroom', 'master', 'kids'].includes(r.type) && r.polygon.length >= 3 && pointInPolygon(ca, r.polygon))
    if (bedroomNear) {
      out.push({ ruleId: 'altar_in_bedroom', name: '神位設於臥室', category: '神位', severity: 'medium', affects: ['健康', '婚姻感情'],
        explanation: '臥室為私密之所，神位設於此對神明不敬，也影響睡眠。', remedies: ['神位移至客廳或獨立神明廳', '暫時以布簾遮蔽'], itemIds: [altar.id], roomIds: [bedroomNear.id], marks: [ca] })
    }
  }

  // 鏡對門
  for (const mirror of ctx.items('mirror')) {
    for (const d of doors) {
      if (!facesItem(ctx, mirror, d, 400, 25)) continue
      const isMain = d.type === 'mainDoor'
      out.push({ ruleId: isMain ? 'mirror_faces_main_door' : 'mirror_faces_door', name: isMain ? '鏡子正對大門' : '鏡子正對房門', category: '鏡', severity: isMain ? 'medium' : 'low', affects: ['財運', '人際'],
        explanation: isMain ? '鏡子正對大門會把進門的財氣、貴人氣反射出去，也易使人受驚。' : '鏡子對房門，開門即見自己，易受驚且氣場反射不聚。',
        remedies: ['鏡子移至側牆', '改用門後可收合或加布簾的鏡子'], itemIds: [mirror.id, d.id], roomIds: [], marks: [ctx.centerOf(mirror), ctx.centerOf(d)] })
    }
  }

  // 樓梯在中宮
  for (const s of ctx.items('stairs')) {
    if (dist(ctx.centerOf(s), ctx.center) < 120 || pointInPolygon(ctx.center, cornersOf(ctx, s))) {
      out.push({ ruleId: 'stairs_center', name: '樓梯在宅中心', category: '樓梯', severity: 'medium', affects: ['健康', '財運'],
        explanation: '中宮為心臟，樓梯在此主氣場被切割，家人易有心血管與情緒問題。', remedies: ['樓梯下方保持整潔明亮，不堆雜物', '中宮以暖光與土色安定', '大改時考慮移位'], itemIds: [s.id], roomIds: [], marks: [ctx.center] })
    }
  }

  // 魚缸
  for (const aq of ctx.items('aquarium')) {
    const room = ctx.roomOf(aq)
    if (room && ['bedroom', 'master', 'kids'].includes(room.type)) {
      out.push({ ruleId: 'aquarium_in_bedroom', name: '魚缸置於臥室', category: '格局', severity: 'low', affects: ['健康', '婚姻感情'],
        explanation: '臥室宜靜，魚缸馬達聲與濕氣干擾睡眠，水氣過旺亦不利感情。', remedies: ['魚缸移至客廳', '臥室改放小型乾式擺設'], itemIds: [aq.id], roomIds: [room.id] })
    }
    if (room?.type === 'kitchen') {
      out.push({ ruleId: 'aquarium_in_kitchen', name: '魚缸置於廚房', category: '格局', severity: 'low', affects: ['財運'],
        explanation: '廚房屬火，魚缸屬水，水火相沖。', remedies: ['魚缸移至客廳明堂處'], itemIds: [aq.id], roomIds: [room.id] })
    }
    for (const stove of ctx.items('stove')) if (dist(ctx.centerOf(stove), ctx.centerOf(aq)) < 200) {
      out.push({ ruleId: 'aquarium_near_stove', name: '魚缸緊鄰爐灶', category: '廚房', severity: 'low', affects: ['財運', '健康'],
        explanation: '水火相沖，且濕氣影響爐火。', remedies: ['兩者距離拉開 2 公尺以上'], itemIds: [aq.id, stove.id], roomIds: [] })
    }
  }

  // 柱角沖床／沖沙發
  for (const col of ctx.items('column')) {
    for (const target of [...ctx.items('bed'), ...ctx.items('sofa'), ...ctx.items('desk')]) {
      const d = dist(ctx.centerOf(col), ctx.centerOf(target))
      if (d > Math.max(target.w, target.h) / 2 + 80) continue
      out.push({ ruleId: 'column_corner_rush', name: `柱角沖${target.type === 'bed' ? '床' : target.type === 'sofa' ? '沙發' : '書桌'}（角煞）`, category: '樑柱', severity: 'low', affects: ['健康'],
        explanation: '突出的柱角尖角對著床、沙發或座位，形成角煞，主刀傷、頭痛與不安。',
        remedies: ['以櫃體或植物遮蔽柱角', '柱角包圓或以布幔柔化', '家具移離柱角'], itemIds: [col.id, target.id], roomIds: [] })
    }
  }
  return out
}

function cornersOf(ctx: PlanContext, r: { x: number; y: number; w: number; h: number }): { x: number; y: number }[] {
  void ctx
  return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]
}
