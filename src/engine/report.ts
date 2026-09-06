import { PALACES, TRIGRAMS_CLOCKWISE, type Palace, type Trigram } from './bagua'
import { analyzePerson, guaGroup, WANDERING_STARS, wanderingStar, type BazhaiPersonResult, type Gender, type WanderingStar } from './bazhai'
import { palaceOfBearing, sittingOf } from './direction'
import { ELEMENT_ATTRS, ELEMENT_ZH, generatedBy, relation } from './fiveElements'
import { ITEM_ZH, ROOM_ZH, type FloorPlan, type Item, type Room } from './floorplan'
import { polygonCentroid } from './geometry'
import { kongwangOf, type Mountain } from './mountains24'
import { annualAfflictions, monthlyChart, palaceLabel, type AnnualAfflictions } from './annual'
import { buildContext, formScore, runAllFormRules, type Finding } from './rules'
import { combo, NINE_STARS, RATING_SCORE, RATING_ZH, type Combo } from './stars'
import { flyingStarChart, isJianXiang, PATTERN_ZH, periodOfYear, timeliness, TIMELINESS_ZH, zhengLingShen, type FlyingStarChart, type Timeliness } from './xuankong'
import { fengshuiYearOf, ganzhiOfYear } from './calendar'
import { HOUSE_WEALTH, HOUSE_WENCHANG } from './positions'

export interface Person {
  id: string
  name: string
  /** Gregorian birth date ISO (yyyy-mm-dd) */
  birthDate: string
  gender: Gender
  primary?: boolean
  /** bedroom room id, optional */
  roomId?: string
}

export interface HouseInput {
  /** facing bearing, degrees clockwise from north (true north; UI already applied declination) */
  facingBearing: number
  /** 灶位判法（各派有別）：座凶向吉 or 全在吉方；預設 allGood */
  stoveMode?: 'seatBadFaceGood' | 'allGood'
  /** 兼向門檻與替卦模式 */
  jianxiangTolerance?: number
  replacementMode?: 'auto' | 'never'
  /** 所有樓層（含 plan）；未提供則視為單層 */
  floors?: FloorPlan[]
  /** year used to fix the 元運 (入住年或建造年) */
  periodYear: number
  plan: FloorPlan
  /** lunar month (1–12) for monthly stars, optional */
  lunarMonth?: number
}

export interface ItemEval {
  itemId: string
  itemType: Item['type']
  label: string
  /** location palace */
  palace: Trigram
  /** facing palace when relevant */
  facingPalace?: Trigram
  perPerson: { personId: string; name: string; star: WanderingStar; verdict: 'good' | 'bad' | 'neutral'; note: string }[]
  advice: string
}

export interface PalaceEval {
  palace: Trigram
  periodStar: number
  mountainStar: number
  waterStar: number
  combo: Combo
  waterTimeliness: Timeliness
  mountainTimeliness: Timeliness
  annualStar: number
  monthlyStar?: number
  rooms: Room[]
  items: Item[]
  advice: string[]
  /** -2..2 */
  score: number
}

export interface Report {
  generatedAt: string
  year: number
  ganzhi: string
  period: number
  house: {
    facingBearing: number
    sittingBearing: number
    facing: Mountain
    sitting: Mountain
    sittingPalace: Trigram
    houseGua: Trigram
    group: 'east' | 'west'
    kongwang: 'major' | 'minor' | null
    jianxiang: boolean
    zhengShen: Trigram
    lingShen: Trigram
  }
  persons: (BazhaiPersonResult & { person: Person; birthYear: number; zodiac: string; compatible: boolean; offendingTaisui?: string })[]
  bazhai: { items: ItemEval[]; score: number; houseStars: Record<Trigram, WanderingStar>; wenchang: Trigram[]; wealth: Trigram[]; wealthLeak: Trigram[]; wealthNote: string; positionWarnings: string[] }
  xuankong: { chart: FlyingStarChart; palaces: PalaceEval[]; score: number; patternZh: string; notes: string[] }
  annual: { data: AnnualAfflictions; warnings: { palace: Palace; title: string; detail: string; rooms: string[]; severity: 'high' | 'medium' | 'low' }[]; score: number }
  form: { findings: Finding[]; score: number }
  elementAdvice: { palace: Trigram; element: string; colors: string; materials: string; tip: string }[]
  scores: { bazhai: number; xuankong: number; annual: number; form: number; overall: number }
  topActions: string[]
}

const GOOD: ReadonlySet<WanderingStar> = new Set(['shengqi', 'tianyi', 'yannian', 'fuwei'])

export function buildReport(persons: Person[], house: HouseInput, now = new Date()): Report {
  const fy = fengshuiYearOf(now)
  const year = fy.year
  const period = periodOfYear(house.periodYear)
  const facingBearing = ((house.facingBearing % 360) + 360) % 360
  const sittingBearing = sittingOf(facingBearing)
  const chart = flyingStarChart(facingBearing, period, { jianxiangTolerance: house.jianxiangTolerance ?? 4.5, replacement: house.replacementMode ?? 'auto' })
  const sittingPalace = chart.sittingPalace
  const houseGua = sittingPalace
  const houseStars = starMapOf(houseGua)
  const { zheng, ling } = zhengLingShen(period)

  const annual = annualAfflictions(year)
  const monthly = house.lunarMonth ? monthlyChart(ganzhiOfYear(year).branch, house.lunarMonth) : undefined

  const ctx = buildContext(house.plan)
  const personResults = persons.map((p) => {
    const birthYear = fengshuiYearOf(new Date(p.birthDate + 'T12:00:00')).year
    const r = analyzePerson(birthYear, p.gender)
    const zodiac = ganzhiOfYear(birthYear).zodiac
    const off = annual.taisui.offending.find((o) => o.zodiac === zodiac)
    return { ...r, person: p, birthYear, zodiac, compatible: r.group === guaGroup(houseGua), offendingTaisui: off ? `${off.type}太歲` : undefined }
  })

  // ---- 八宅 item evaluation
  const items: ItemEval[] = []
  const evalFor = (item: Item, mode: 'location' | 'facing', wantGood: boolean, label: string, advice: string) => {
    const palace = ctx.palaceOfItem(item)
    const facingPalace = palaceOfBearing(ctx.facingBearing(item.facing))
    const target = mode === 'facing' ? facingPalace : palace
    const perPerson = personResults.map((pr) => {
      const star = wanderingStar(pr.gua, target)
      const good = GOOD.has(star)
      const verdict: 'good' | 'bad' | 'neutral' = good === wantGood ? 'good' : 'bad'
      const note = `${WANDERING_STARS[star].zh}（${WANDERING_STARS[star].keyword.split('，')[0]}）`
      return { personId: pr.person.id, name: pr.person.name, star, verdict, note }
    })
    items.push({ itemId: item.id, itemType: item.type, label, palace, facingPalace: mode === 'facing' ? facingPalace : undefined, perPerson, advice })
  }
  for (const d of ctx.items('mainDoor')) evalFor(d, 'location', true, '大門方位', '大門宜開在命卦的生氣、天醫、延年、伏位方；若在凶方，可在門內設玄關、門上掛山海鎮或以顏色五行化解。')
  for (const b of ctx.items('bed')) evalFor(b, 'facing', true, `床頭朝向（${roomName(ctx.roomOf(b))}）`, '床頭宜朝命卦吉方（天醫主健康、延年主感情、生氣主活力）；夫妻命卦不同時以主要休息者或男主人為準，或床頭朝雙方共同吉方。')
  const seatBad = house.stoveMode === 'seatBadFaceGood'
  for (const s of ctx.items('stove')) {
    evalFor(s, 'location', !seatBad, '灶座（爐灶位置）', seatBad ? '【座凶向吉派】灶座宜壓凶方（絕命、五鬼、六煞、禍害），以火壓煞。此說坊間廣傳但古籍出處未驗證，可在「資料」頁切換判法。' : '【全吉方派】灶宜置於天醫、生氣、延年、伏位方，避開五鬼、絕命（易安居、Nova Masters 等來源）。可在「資料」頁切換為「座凶向吉」判法。')
    evalFor(s, 'facing', true, '灶口朝向', '灶口（爐灶開關面）宜朝吉方，天醫方主健康、生氣方主旺財。現代爐具「火門」定義各派不一，本程式以開關面為準。')
  }
  for (const d of ctx.items('desk')) evalFor(d, 'facing', true, `書桌／座位朝向（${roomName(ctx.roomOf(d))}）`, '座位面向宜朝生氣（升遷）、伏位（穩定）、天醫（貴人）方（八宅古籍層）。注意：現代台港風水師多不以八宅星定書桌，而以住宅文昌位或流年四綠位為主，請對照「住宅文昌位」一節。')
  for (const a of ctx.items('altar')) {
    evalFor(a, 'location', true, '神位位置', '神位宜坐吉方；背後實牆、前方明亮開闊（八宅古籍層）。現代台港實務多以「坐山要實＋避流年煞方（五黃、三煞、太歲）」定神位，八宅星僅供參考。')
    evalFor(a, 'facing', true, '神位朝向', '神位宜向吉方，不對廁所、廚房、臥室門。')
  }
  for (const t of ctx.items('toilet')) evalFor(t, 'location', false, '馬桶／廁所位置', '廁所宜在凶方，以穢壓煞；若在吉方，保持乾燥常關門並以植物化解。')
  const bazhaiScore = scoreItems(items)
  const wenchang = HOUSE_WENCHANG[houseGua]
  const wealthInfo = HOUSE_WEALTH[houseGua]
  const positionWarnings: string[] = []
  for (const r of house.plan.rooms) {
    if (r.polygon.length < 3) continue
    const t = ctx.palaceOf(polygonCentroid(r.polygon))
    const name = r.name || ROOM_ZH[r.type]
    if (r.type === 'bathroom' && wealthInfo.wealth.includes(t)) positionWarnings.push(`${name}落在住宅財位（${PALACES[t].direction}），主財氣受污；保持乾燥常關門，可放土種植物化解。`)
    if (r.type === 'bathroom' && wenchang.includes(t)) positionWarnings.push(`${name}落在住宅文昌位（${PALACES[t].direction}），不利學業考運；文昌改採個人文昌或流年四綠位。`)
    if (r.type === 'kitchen' && wealthInfo.wealth.includes(t)) positionWarnings.push(`${name}落在住宅財位（${PALACES[t].direction}），火燒財庫；灶旁避免堆雜物並保持整潔。`)
    if ((r.type === 'study' || r.type === 'kids') && wenchang.includes(t)) positionWarnings.push(`${name}落在住宅文昌位（${PALACES[t].direction}），利讀書考試，宜放書桌並保持明亮。`)
  }
  for (const aq of ctx.items('aquarium')) {
    const t = ctx.palaceOfItem(aq)
    if (wealthInfo.leak.includes(t)) positionWarnings.push(`魚缸放在洩財位（${PALACES[t].direction}），宜移至財位（${wealthInfo.wealth.map((w) => PALACES[w].direction).join('／')}）。`)
  }

  // ---- 玄空 per palace
  const palaces: PalaceEval[] = TRIGRAMS_CLOCKWISE.map((t) => {
    const m = chart.mountainStars[t], w = chart.waterStars[t], p = chart.periodStars[t]
    const c = combo(m, w)
    const a = annual.chart[t]
    const rooms = house.plan.rooms.filter((r) => r.polygon.length >= 3 && ctx.palaceOf(polygonCentroid(r.polygon)) === t)
    const its = house.plan.items.filter((i) => ctx.palaceOfItem(i) === t)
    const advice: string[] = []
    const wt = timeliness(w, period), mt = timeliness(m, period)
    advice.push(`向星${NINE_STARS[w]!.zh}（${TIMELINESS_ZH[wt]}）主財；山星${NINE_STARS[m]!.zh}（${TIMELINESS_ZH[mt]}）主丁。`)
    if (wt === 'wang' || wt === 'sheng') advice.push(`向星當旺或生氣：此方宜開門、設窗、活動頻繁，可放水景或魚缸催財。`)
    if (mt === 'wang' || mt === 'sheng') advice.push(`山星當旺或生氣：此方宜作臥室、書房，或放高櫃、實牆、山石催丁旺健康。`)
    if (c.rating === 'bad' || c.rating === 'terrible') advice.push(`組合不利：${NINE_STARS[m]!.remedy}`)
    if (a === 5) advice.push('流年五黃到此：今年此方忌動土、裝修與久坐久臥，放銅葫蘆或六帝錢化解。')
    if (a === 2) advice.push('流年二黑病符到此：保持整潔明亮，放金屬物品洩土氣，避免當臥室久臥。')
    if (a === 3) advice.push('流年三碧到此：忌放綠植與水，宜紅色物洩木，避免爭執。')
    if (a === 7) advice.push('流年七赤到此：留意盜賊、口舌與刀傷，宜藍黑色小水景洩金。')
    if (a === 8) advice.push('流年八白財星到此：宜明亮、常活動、可放紅色或土色物品催旺。')
    if (a === 9) advice.push('流年九紫喜慶星到此：宜紅色、燈光、植物，主喜事與姻緣。')
    if (a === 1) advice.push('流年一白桃花／人緣星到此：宜整潔明亮，可放水景催貴人。')
    if (a === 4) advice.push('流年四綠文昌到此：宜設書桌、放四支富貴竹或文昌塔。')
    if (a === 6) advice.push('流年六白武曲到此：利事業權威，宜金屬、白色，忌紅色剋金。')
    const score = RATING_SCORE[c.rating] + (wt === 'wang' || wt === 'sheng' ? 1 : wt === 'sha' || wt === 'si' ? -1 : 0) + (a === 5 ? -1 : a === 2 ? -0.5 : a === 8 || a === 9 ? 0.5 : 0)
    return { palace: t, periodStar: p, mountainStar: m, waterStar: w, combo: c, waterTimeliness: wt, mountainTimeliness: mt, annualStar: a, monthlyStar: monthly?.[t], rooms, items: its, advice, score }
  })
  const xuankongScore = scoreXuankong(palaces, chart)

  // ---- 流年 warnings
  const warnings: Report['annual']['warnings'] = []
  const roomsIn = (p: Palace) => (p === 'center' ? house.plan.rooms.filter((r) => r.polygon.length >= 3 && ctx.roomAt(ctx.center)?.id === r.id) : palaces.find((x) => x.palace === p)?.rooms ?? [])
  const mainDoorPalace = ctx.items('mainDoor')[0] ? ctx.palaceOfItem(ctx.items('mainDoor')[0]!) : undefined
  const pushWarn = (p: Palace, title: string, detail: string, severity: 'high' | 'medium' | 'low') => {
    const rs = roomsIn(p).map((r) => r.name || ROOM_ZH[r.type])
    if (p !== 'center' && mainDoorPalace === p) rs.unshift('大門')
    warnings.push({ palace: p, title, detail, rooms: rs, severity: rs.length ? severity : 'low' })
  }
  pushWarn(annual.wuhuang, '五黃廉貞（正關煞）', '今年最凶方，忌動土、裝修、釘釘子；宜靜不宜動，可放金屬銅葫蘆、六帝錢洩土氣，忌紅色與土黃色。', 'high')
  pushWarn(annual.erhei, '二黑巨門（病符）', '主疾病，尤其腸胃與婦女病；保持乾淨明亮，以金屬（銅鈴、金屬鐘）洩之，忌長期臥床於此。', 'medium')
  pushWarn(annual.sanbi, '三碧祿存（是非）', '主口舌、官非、盜賊；忌放綠植與水，宜紅色地毯或暖光洩木。', 'medium')
  pushWarn(annual.qichi, '七赤破軍（退氣）', '主破財、盜賊、口舌；宜藍黑色小水景洩金，門窗留意防盜。', 'low')
  pushWarn(annual.taisui.branch === '子' ? 'kan' : palaceOfBearing(annual.taisui.taisuiBearing), `太歲方（${annual.taisui.taisuiMountain}山）`, '太歲頭上不動土：此方忌裝修敲打與坐向沖犯；宜安靜整潔。', 'medium')
  pushWarn(palaceOfBearing(annual.taisui.suipoBearing), `歲破方（${annual.taisui.suipoMountain}山）`, '與太歲相沖之方，忌動土與長時間面對；床頭、座位避免朝此方。', 'medium')
  pushWarn(annual.taisui.sanshaPalace, `三煞方（${annual.taisui.sanshaBranches.join('')}）`, '三煞方忌動土、忌坐（坐三煞），可向三煞不可坐三煞；動工前需擇日化解。', 'medium')
  const annualScore = Math.max(0, 100 - warnings.reduce((a, w) => a + (w.rooms.length ? (w.severity === 'high' ? 18 : w.severity === 'medium' ? 8 : 3) : 0), 0))

  // ---- 形勢
  const synthetic = !!house.plan.synthetic
  const findings = synthetic ? [] : runAllFormRules(house.floors && house.floors.length ? house.floors : [house.plan])
  const fScore = synthetic ? 70 : formScore(findings)

  // ---- 五行佈置建議
  const elementAdvice = TRIGRAMS_CLOCKWISE.map((t) => {
    const el = PALACES[t].element
    const gen = generatedBy(el)
    const attrs = ELEMENT_ATTRS[el]
    const genAttrs = ELEMENT_ATTRS[gen]
    return {
      palace: t,
      element: ELEMENT_ZH[el],
      colors: [...attrs.colors, ...genAttrs.colors.slice(0, 2)].join('、'),
      materials: [...attrs.materials.slice(0, 3), ...genAttrs.materials.slice(0, 2)].join('、'),
      tip: `${PALACES[t].direction}方屬${ELEMENT_ZH[el]}，宜用${ELEMENT_ZH[el]}與${ELEMENT_ZH[gen]}（生${ELEMENT_ZH[el]}）的顏色材質；忌${ELEMENT_ZH[controlOf(el)]}屬性過重。`,
    }
  })

  const scores = {
    bazhai: bazhaiScore,
    xuankong: xuankongScore,
    annual: annualScore,
    form: fScore,
    overall: synthetic ? Math.round(bazhaiScore * 0.4 + xuankongScore * 0.35 + annualScore * 0.25) : Math.round(bazhaiScore * 0.25 + xuankongScore * 0.25 + annualScore * 0.15 + fScore * 0.35),
  }

  const topActions = buildTopActions(findings, items, warnings, palaces)

  return {
    generatedAt: now.toISOString(),
    year, ganzhi: fy.ganzhi, period,
    house: {
      facingBearing, sittingBearing, facing: chart.facing, sitting: chart.sitting, sittingPalace, houseGua, group: guaGroup(houseGua),
      kongwang: kongwangOf(facingBearing), jianxiang: isJianXiang(facingBearing, house.jianxiangTolerance ?? 4.5), zhengShen: zheng, lingShen: ling,
    },
    persons: personResults,
    bazhai: { items, score: bazhaiScore, houseStars, wenchang, wealth: wealthInfo.wealth, wealthLeak: wealthInfo.leak, wealthNote: wealthInfo.note, positionWarnings },
    xuankong: { chart, palaces, score: xuankongScore, patternZh: PATTERN_ZH[chart.pattern], notes: chart.patternNotes },
    annual: { data: annual, warnings, score: annualScore },
    form: { findings, score: fScore },
    elementAdvice,
    scores,
    topActions,
  }
}

function starMapOf(base: Trigram): Record<Trigram, WanderingStar> {
  const out = {} as Record<Trigram, WanderingStar>
  for (const t of TRIGRAMS_CLOCKWISE) out[t] = wanderingStar(base, t)
  return out
}

function controlOf(el: keyof typeof ELEMENT_ATTRS) {
  const r = (Object.keys(ELEMENT_ATTRS) as (keyof typeof ELEMENT_ATTRS)[]).find((k) => relation(k, el) === 'controls')!
  return r
}

function roomName(r?: Room): string {
  return r ? r.name || ROOM_ZH[r.type] : '未指定房間'
}

function scoreItems(items: ItemEval[]): number {
  if (!items.length) return 70
  let total = 0, n = 0
  for (const it of items) for (const p of it.perPerson) { total += p.verdict === 'good' ? 1 : 0; n++ }
  return Math.round(40 + 60 * (n ? total / n : 0.5))
}

function scoreXuankong(palaces: PalaceEval[], chart: FlyingStarChart): number {
  let s = 60
  if (chart.pattern === 'wangshan-wangxiang') s += 20
  else if (chart.pattern === 'shangshan-xiashui') s -= 15
  else s += 5
  for (const p of palaces) {
    const weight = p.rooms.some((r) => ['master', 'bedroom', 'kids'].includes(r.type)) || p.items.some((i) => i.type === 'mainDoor') ? 2 : p.rooms.length ? 1 : 0.3
    s += p.score * weight * 2
  }
  return Math.max(5, Math.min(98, Math.round(s)))
}

function buildTopActions(findings: Finding[], items: ItemEval[], warnings: Report['annual']['warnings'], palaces: PalaceEval[]): string[] {
  const acts: string[] = []
  for (const f of findings.filter((x) => x.severity === 'high').slice(0, 3)) acts.push(`${f.name}：${f.remedies[0]}`)
  for (const it of items) {
    const bad = it.perPerson.filter((p) => p.verdict === 'bad')
    if (bad.length && acts.length < 5) acts.push(`${it.label}落在${bad.map((b) => `${b.name}的${WANDERING_STARS[b.star].zh}`).join('、')}：${it.advice.split('；')[0]}`)
  }
  for (const w of warnings.filter((x) => x.rooms.length && x.severity === 'high')) if (acts.length < 6) acts.push(`${w.title}在${palaceLabel(w.palace)}（${w.rooms.join('、')}）：${w.detail.split('；')[0]}`)
  const worst = [...palaces].sort((a, b) => a.score - b.score)[0]
  if (worst && worst.score < -1 && acts.length < 7) acts.push(`${PALACES[worst.palace].direction}方飛星組合${RATING_ZH[worst.combo.rating]}（${worst.mountainStar}${worst.waterStar}）：${worst.combo.note}`)
  return acts
}

export { ITEM_ZH }
