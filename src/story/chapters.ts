import { PALACES, type Trigram } from '../engine/bagua'
import { groupZh, WANDERING_STARS } from '../engine/bazhai'
import { ROOM_ZH, type FloorPlan, type Room } from '../engine/floorplan'
import { polygonCentroid } from '../engine/geometry'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { palaceLabel } from '../engine/annual'
import type { Report } from '../engine/report'
import { buildActions, type ActionItem } from '../engine/advice'
import { buildContext } from '../engine/rules'

/** Where the camera goes for a chapter. */
export type CameraCue =
  | { kind: 'orbit' }
  | { kind: 'door' }
  | { kind: 'room'; roomId: string }
  | { kind: 'top'; overlay: 'annual' | 'bazhai' | 'wealth' | 'none' }

export interface Chapter {
  id: string
  /** short label for the table of contents */
  label: string
  title: string
  /** what the master says in the speech bubble (one line) */
  bubble: string
  /** narrative paragraphs in the master's voice */
  paragraphs: string[]
  /** concrete to-dos (plain) */
  todos: string[]
  cue: CameraCue
  /** palaces to highlight on the floor */
  highlight?: Trigram[]
  roomId?: string
}

const ROOM_ORDER: Room['type'][] = ['entry', 'living', 'master', 'bedroom', 'kids', 'study', 'kitchen', 'dining', 'bathroom', 'altar', 'balcony', 'storage', 'other', 'corridor', 'driveway', 'void']

/** Build the narrated tour from a report and the plan it was made from. */
export function buildChapters(report: Report, plan: FloorPlan, masterName = '嘟嘟師傅'): Chapter[] {
  const actions = buildActions(report)
  const primary = report.persons.find((p) => p.person.primary) ?? report.persons[0]
  const ctx = buildContext(plan)
  const chapters: Chapter[] = []
  const you = primary ? primary.person.name : '你'

  // 0 封面／序
  chapters.push({
    id: 'cover', label: '序', title: '先站在門口', cue: { kind: 'orbit' },
    bubble: '房子先整體看一遍，再一間一間走。',
    paragraphs: [
      `我是${masterName}。看房子我不急著進門，先繞一圈看形，再站到門口看向。`,
      `這間房子朝${PALACES[report.xuankong.chart.facingPalace].direction}，向${report.house.facing.name}山，坐${report.house.sitting.name}，是${PALACES[report.house.houseGua].zh}宅，屬${groupZh(report.house.group)}宅。${report.year} 年走 ${report.period} 運，玄空盤是「${report.xuankong.patternZh}」。`,
      primary ? `${you}是${groupZh(primary.group)}命。${primary.compatible ? '人和房子同一組，先天就順，接下來看的是細節。' : '人和房子分屬東西四兩組，這不代表不能住，床頭和書桌朝自己的吉方就補得回來，等一下我會指給你看。'}` : '你還沒告訴我家裡有誰。填了出生年，我才能看床頭和書桌該朝哪裡。',
    ],
    todos: [], highlight: [],
  })

  // 1 大門
  const mainDoor = plan.items.find((i) => i.type === 'mainDoor')
  const doorItem = report.bazhai.items.find((i) => i.itemType === 'mainDoor')
  const doorFindings = report.form.findings.filter((f) => mainDoor && f.itemIds.includes(mainDoor.id))
  const doorParas: string[] = []
  if (mainDoor) {
    const pal = ctx.palaceOfItem(mainDoor)
    doorParas.push(`門是氣口。你家的大門開在${PALACES[pal].direction}方，宅卦看這一方是「${WANDERING_STARS[report.bazhai.houseStars[pal]].zh}」。`)
    if (doorItem) {
      const bad = doorItem.perPerson.filter((p) => p.verdict === 'bad')
      doorParas.push(bad.length ? `對${bad.map((b) => b.name).join('、')}來說這是凶方（${bad.map((b) => WANDERING_STARS[b.star].zh).join('、')}）。門改不了，就在門內做玄關，讓氣轉個彎再進屋。` : `對家裡每個人這方位都算吉方，門口保持明亮乾淨就好。`)
    }
    for (const f of doorFindings) doorParas.push(`${f.explanation}${f.remedies[0] ? `我的建議：${f.remedies[0]}。` : ''}`)
  } else {
    doorParas.push('平面圖上還沒放大門。門是整間房子最重要的一個點，回去補上，我才能看門向。')
  }
  chapters.push({ id: 'door', label: '大門', title: '門口這一站', cue: { kind: 'door' }, bubble: mainDoor ? '門口看得出一家人的進出習慣。' : '大門呢？', paragraphs: doorParas, todos: actionsFor(actions, (a) => a.id.startsWith('bz_door') || doorFindings.some((f) => a.id.startsWith(f.ruleId))), highlight: mainDoor ? [ctx.palaceOfItem(mainDoor)] : [] })

  // 2..n rooms
  const rooms = [...plan.rooms].filter((r) => r.polygon.length >= 3).sort((a, b) => ROOM_ORDER.indexOf(a.type) - ROOM_ORDER.indexOf(b.type))
  for (const r of rooms) {
    const name = r.name || ROOM_ZH[r.type]
    const pal = ctx.palaceOf(polygonCentroid(r.polygon))
    const pe = report.xuankong.palaces.find((p) => p.palace === pal)!
    const roomFindings = report.form.findings.filter((f) => f.roomIds.includes(r.id) || plan.items.some((i) => i.roomId === r.id && f.itemIds.includes(i.id)))
    const roomItems = report.bazhai.items.filter((it) => plan.items.find((i) => i.id === it.itemId)?.roomId === r.id)
    const paras: string[] = []
    paras.push(`${name}在房子的${PALACES[pal].direction}方，${PALACES[pal].zh}宮，管${PALACES[pal].family}。這一宮的飛星是山${pe.mountainStar}向${pe.waterStar}，${RATING_ZH[pe.combo.rating]}；今年流年${NINE_STARS[pe.annualStar]!.zh}到這裡。`)
    if (pe.annualStar === 5) paras.push('五黃是今年最凶的一顆，這間房今年不要動土裝修，也少放紅色的東西。')
    if (pe.annualStar === 2) paras.push('二黑是病符，這間房今年多開窗、保持乾淨，不要長時間躺著不動。')
    if (pe.annualStar === 8 || pe.annualStar === 9) paras.push(`${NINE_STARS[pe.annualStar]!.zh}是今年的好星，這間房多用、多亮燈，是好事。`)
    for (const it of roomItems) {
      const bad = it.perPerson.filter((p) => p.verdict === 'bad')
      const good = it.perPerson.filter((p) => p.verdict === 'good')
      if (bad.length) paras.push(`${it.label.replace(/（.+）/, '')}${it.facingPalace ? `朝${PALACES[it.facingPalace].direction}` : `在${PALACES[it.palace].direction}`}，對${bad.map((b) => b.name).join('、')}是「${WANDERING_STARS[bad[0]!.star].zh}」，${it.itemType === 'bed' ? '睡久了不安穩。' : it.itemType === 'desk' ? '坐久了不專心。' : '不太合。'}`)
      else if (good.length) paras.push(`${it.label.replace(/（.+）/, '')}的方向對${good.map((g) => g.name).join('、')}是吉方，這一點不用改。`)
    }
    for (const f of roomFindings.slice(0, 4)) paras.push(`${f.explanation}`)
    if (!roomItems.length && !roomFindings.length) paras.push(`這間房沒放家具，我看不出擺設。回去放上${r.type === 'kitchen' ? '爐灶' : r.type === 'bathroom' ? '馬桶' : r.type === 'study' ? '書桌' : ['master', 'bedroom', 'kids'].includes(r.type) ? '床' : '沙發'}，我再仔細看。`)
    const todos = actionsFor(actions, (a) => (a.where ? a.where.includes(name) : false) || roomFindings.some((f) => a.id.startsWith(f.ruleId)) || roomItems.some((it) => a.id.includes(it.itemId)))
    chapters.push({ id: `room_${r.id}`, label: name, title: `走進${name}`, cue: { kind: 'room', roomId: r.id }, bubble: roomBubble(r.type, roomFindings.length, roomItems.some((it) => it.perPerson.some((p) => p.verdict === 'bad'))), paragraphs: paras, todos, highlight: [pal], roomId: r.id })
  }

  // 流年
  const a = report.annual.data
  const annualParas = [
    `${report.year} ${report.ganzhi}年，太歲在${a.taisui.taisuiMountain}山，歲破在${a.taisui.suipoMountain}山，三煞在${a.taisui.sanshaBranches.join('')}。今年${palaceLabel(a.wuhuang)}是五黃，${palaceLabel(a.erhei)}是二黑，這兩處不動土、不釘釘子、保持安靜。`,
    `好的星也要用：八白財星在${palaceLabel(a.babai)}，九紫在${palaceLabel(a.jiuzi)}，這兩處多走動、多亮燈。`,
  ]
  const hitRooms = report.annual.warnings.filter((w) => w.rooms.length)
  if (hitRooms.length) annualParas.push(`落到你家房間的有：${hitRooms.map((w) => `${w.title.split('（')[0]}在${w.rooms.join('、')}`).join('；')}。`)
  if (a.taisui.offending.length && report.persons.length) {
    const hit = report.persons.filter((p) => p.offendingTaisui)
    if (hit.length) annualParas.push(`${hit.map((p) => `${p.person.name}屬${p.zodiac}，今年${p.offendingTaisui}`).join('；')}，凡事穩一點，別在太歲方久坐久臥。`)
  }
  chapters.push({ id: 'annual', label: '流年', title: '從屋頂往下看今年', cue: { kind: 'top', overlay: 'annual' }, bubble: '風水每年會換，今年要避的是這兩處。', paragraphs: annualParas, todos: actionsFor(actions, (x) => x.source === '流年'), highlight: [a.wuhuang, a.erhei].filter((p): p is Trigram => p !== 'center') })

  // 財位文昌
  const wealthParas = [
    `依坐向，你家的財位在${report.bazhai.wealth.map((t) => PALACES[t].direction).join('、')}，${report.bazhai.wealthNote}。洩財位在${report.bazhai.wealthLeak.map((t) => PALACES[t].direction).join('、')}，魚缸不要放那裡。`,
    `文昌位在${report.bazhai.wenchang.map((t) => (t as string) === 'center' ? '中宮' : PALACES[t as Trigram].direction).join('、')}，家裡有人讀書考試，書桌放這裡。`,
    ...report.bazhai.positionWarnings,
  ]
  chapters.push({ id: 'wealth', label: '財位', title: '財位與文昌位', cue: { kind: 'top', overlay: 'wealth' }, bubble: '這兩個位置，記起來。', paragraphs: wealthParas, todos: [], highlight: [...report.bazhai.wealth, ...report.bazhai.wenchang.filter((t) => (t as string) !== 'center')] as Trigram[] })

  // 總結
  const top = actions.filter((x) => x.priority === 1).slice(0, 3)
  const nowCount = actions.filter((x) => x.effort === 'now').length
  chapters.push({
    id: 'summary', label: '總結', title: '走完一圈', cue: { kind: 'orbit' }, bubble: top.length ? '先做這幾件，其他慢慢來。' : '這間房子沒什麼大問題。',
    paragraphs: [
      `整體我給 ${report.scores.overall} 分。${report.scores.overall >= 75 ? '底子不錯。' : report.scores.overall >= 50 ? '有幾處值得動手。' : '有幾個明顯的問題，但都有解法。'}`,
      top.length ? `最要緊的是：${top.map((t) => t.title).join('；')}。` : '沒有需要優先處理的大問題。',
      nowCount ? `清單裡有 ${nowCount} 件今天就能做，不用花錢。做完再看要不要添購或搬家具。` : '需要做的事都在清單裡，照難易度排好了。',
      '風水各派說法不同，我說的以八宅、玄空和形勢派為主，當參考就好。房子住得舒服，才是最重要的。',
    ],
    todos: top.map((t) => `${t.title}：${t.how[0]!.text}`), highlight: [],
  })
  return chapters
}

function actionsFor(actions: ActionItem[], pred: (a: ActionItem) => boolean): string[] {
  return actions.filter(pred).slice(0, 4).map((a) => `${a.title}：${a.how[0]!.text}`)
}

function roomBubble(type: Room['type'], findings: number, badItem: boolean): string {
  if (findings === 0 && !badItem) return '這間沒什麼問題。'
  if (findings >= 3) return '這間要注意的比較多。'
  switch (type) {
    case 'master': case 'bedroom': case 'kids': return '睡覺的地方最要緊。'
    case 'kitchen': return '灶是財庫，仔細看。'
    case 'bathroom': return '廁所看乾不乾淨、對不對門。'
    case 'study': return '書桌背後要有靠。'
    default: return '看看這間。'
  }
}
