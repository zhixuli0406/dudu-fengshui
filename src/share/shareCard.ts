import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { WANDERING_STARS } from '../engine/bazhai'
import { ITEM_ZH, ROOM_ZH, type FloorPlan } from '../engine/floorplan'
import { bbox, polygonCentroid, rectCorners, type Point } from '../engine/geometry'
import type { Report } from '../engine/report'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { runFormRules } from '../engine/rules'
import { groupZh } from '../engine/bazhai'
import { palaceLabel } from '../engine/annual'

export type ShareKind = 'palace' | 'bazhai' | 'stars' | 'annual' | 'form'
export const SHARE_KIND_ZH: Record<ShareKind, string> = { palace: '方位九宮', bazhai: '八宅遊星', stars: '玄空飛星', annual: '流年飛星', form: '形勢問題' }

const W = 1080, H = 1350
const C = {
  bg: '#f7f7f8', ink: '#18181b', muted: '#71717a', line: '#d4d4d8', surface: '#ffffff',
  brand: '#2e8f6e', bad: '#c2410c', good: 'rgba(46,143,110,0.16)', badFill: 'rgba(194,65,12,0.14)', neutral: 'rgba(113,113,122,0.08)',
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const FONT = "-apple-system, 'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', system-ui, sans-serif"

const ROOM_FILL: Record<string, string> = {
  living: 'rgba(214,179,92,0.18)', master: 'rgba(59,130,246,0.18)', bedroom: 'rgba(59,130,246,0.14)', kids: 'rgba(59,130,246,0.10)', study: 'rgba(46,143,110,0.16)',
  kitchen: 'rgba(217,72,59,0.14)', dining: 'rgba(214,179,92,0.22)', bathroom: 'rgba(120,130,150,0.25)', entry: 'rgba(214,179,92,0.08)', balcony: 'rgba(46,143,110,0.08)',
  altar: 'rgba(217,72,59,0.10)', storage: 'rgba(113,113,122,0.16)', corridor: 'rgba(113,113,122,0.08)', driveway: 'rgba(24,24,27,0.25)', void: 'rgba(24,24,27,0.4)', other: 'rgba(113,113,122,0.10)',
}

function polar(c: Point, r: number, deg: number): Point {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }
}

/** Per-palace text + tone for the chosen layer. */
function palaceInfo(report: Report, kind: ShareKind): Record<Trigram, { lines: string[]; tone: 'good' | 'bad' | 'neutral' }> {
  const out = {} as Record<Trigram, { lines: string[]; tone: 'good' | 'bad' | 'neutral' }>
  const primary = report.persons.find((p) => p.person.primary) ?? report.persons[0]
  for (const t of TRIGRAMS_CLOCKWISE) {
    const p = report.xuankong.palaces.find((x) => x.palace === t)!
    if (kind === 'bazhai' && primary) {
      const star = primary.stars[t]
      out[t] = { lines: [WANDERING_STARS[star].zh], tone: WANDERING_STARS[star].auspicious ? 'good' : 'bad' }
    } else if (kind === 'stars') {
      out[t] = { lines: [`${p.mountainStar} ${p.waterStar}`, `運 ${p.periodStar}`], tone: p.combo.rating === 'great' || p.combo.rating === 'good' ? 'good' : p.combo.rating === 'neutral' ? 'neutral' : 'bad' }
    } else if (kind === 'annual') {
      out[t] = { lines: [NINE_STARS[p.annualStar]!.zh], tone: [5, 2, 3, 7].includes(p.annualStar) ? 'bad' : [8, 9, 1, 6, 4].includes(p.annualStar) ? 'good' : 'neutral' }
    } else {
      out[t] = { lines: [], tone: 'neutral' }
    }
  }
  return out
}

export interface ShareOptions { kind: ShareKind; plan: FloorPlan; report: Report; siteUrl?: string; personName?: string }

/** Build a 1080×1350 SVG string: header, plan with overlay, notes, scores, disclaimer. */
export function buildShareSvg({ kind, plan, report, siteUrl = 'zhixuli0406.github.io/dudu-fengshui' }: ShareOptions): string {
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`)
  parts.push(`<rect width="${W}" height="${H}" fill="${C.bg}"/>`)
  // header
  parts.push(`<text x="60" y="88" font-size="40" font-weight="600" fill="${C.ink}">嘟嘟風水</text>`)
  parts.push(`<text x="60" y="130" font-size="26" fill="${C.muted}">${esc(SHARE_KIND_ZH[kind])}｜${report.year} ${esc(report.ganzhi)}年 ${report.period} 運</text>`)
  parts.push(`<text x="${W - 60}" y="88" font-size="24" fill="${C.muted}" text-anchor="end">向${esc(report.house.facing.name)} 坐${esc(report.house.sitting.name)}，${esc(PALACES[report.house.houseGua].zh)}宅（${esc(groupZh(report.house.group))}宅）</text>`)
  parts.push(`<text x="${W - 60}" y="126" font-size="24" fill="${C.muted}" text-anchor="end">${esc(report.xuankong.patternZh)}${report.xuankong.chart.replacement ? '（替卦）' : ''}</text>`)
  parts.push(`<line x1="60" y1="156" x2="${W - 60}" y2="156" stroke="${C.line}" stroke-width="2"/>`)

  drawPlan(parts, plan, report, kind, 60, 180, W - 120, 720)

  // notes
  let y = 180 + 720 + 56
  const notes: string[] = []
  const primary = report.persons.find((p) => p.person.primary) ?? report.persons[0]
  if (kind === 'bazhai') notes.push(primary ? `${primary.person.name}：命卦${PALACES[primary.gua].zh}，${groupZh(primary.group)}命，${primary.compatible ? '與宅相合' : '與宅不合'}。綠為吉方，紅為凶方。` : '尚未新增成員，請先於「資料」頁新增。')
  if (kind === 'stars') { notes.push('每宮：山星 向星／運星。綠為吉組合，紅為凶組合。'); const worst = [...report.xuankong.palaces].sort((a, b) => a.score - b.score)[0]; if (worst) notes.push(`${PALACES[worst.palace].direction}方 ${worst.mountainStar}${worst.waterStar}（${RATING_ZH[worst.combo.rating]}）：${worst.combo.note}`) }
  if (kind === 'annual') { const a = report.annual.data; notes.push(`${report.year} 年五黃在${PALACES[a.wuhuang as Trigram]?.direction ?? '中宮'}，二黑在${PALACES[a.erhei as Trigram]?.direction ?? '中宮'}，八白財星在${PALACES[a.babai as Trigram]?.direction ?? '中宮'}，九紫在${PALACES[a.jiuzi as Trigram]?.direction ?? '中宮'}。`); notes.push(`太歲${a.taisui.taisuiMountain}山，歲破${a.taisui.suipoMountain}山，三煞${a.taisui.sanshaBranches.join('')}。`) }
  if (kind === 'palace') notes.push('八方位以宅中心為原點，上方為平面圖方向；紅線為北。')
  const findings = kind === 'form' ? runFormRules(plan) : []
  if (kind === 'form') { const top = findings.slice(0, 5); notes.push(top.length ? `偵測到 ${findings.length} 項：` : '未偵測到形勢問題。'); for (const f of top) notes.push(`・${f.name}（${{ high: '高', medium: '中', low: '低' }[f.severity]}）${f.remedies[0] ? `：${f.remedies[0]}` : ''}`) }
  for (const n of notes) { for (const line of wrap(n, 40)) { parts.push(`<text x="60" y="${y}" font-size="26" fill="${C.ink}">${esc(line)}</text>`); y += 38 } }

  // scores
  const sy = H - 200
  parts.push(`<line x1="60" y1="${sy - 40}" x2="${W - 60}" y2="${sy - 40}" stroke="${C.line}" stroke-width="2"/>`)
  parts.push(`<text x="60" y="${sy + 30}" font-size="84" font-weight="600" fill="${report.scores.overall >= 75 ? C.brand : report.scores.overall >= 50 ? C.ink : C.bad}">${report.scores.overall}</text>`)
  parts.push(`<text x="60" y="${sy + 66}" font-size="22" fill="${C.muted}">總評</text>`)
  const cols: [string, number][] = [['八宅', report.scores.bazhai], ['玄空', report.scores.xuankong], ['流年', report.scores.annual], ['形勢', report.scores.form]]
  cols.forEach(([l, v], i) => {
    const x = 300 + i * 190
    parts.push(`<text x="${x}" y="${sy + 24}" font-size="44" font-weight="500" fill="${v >= 75 ? C.brand : v >= 50 ? C.ink : C.bad}">${v}</text>`)
    parts.push(`<text x="${x}" y="${sy + 60}" font-size="22" fill="${C.muted}">${l}</text>`)
  })
  parts.push(`<text x="60" y="${H - 56}" font-size="20" fill="${C.muted}">文化參考，各派說法互有出入，不構成醫療、法律、財務或工程建議。</text>`)
  parts.push(`<text x="${W - 60}" y="${H - 56}" font-size="20" fill="${C.muted}" text-anchor="end">${esc(siteUrl)}</text>`)
  parts.push('</svg>')
  return parts.join('')
}


/** Draw the plan (rooms, outline, overlay for `kind`, items, form marks) into a box. */
function drawPlan(parts: string[], plan: FloorPlan, report: Report, kind: ShareKind, AX: number, AY: number, AW: number, AH: number): void {
  parts.push(`<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="16" fill="${C.surface}" stroke="${C.line}" stroke-width="2"/>`)
  const outline = plan.outline.length >= 3 ? plan.outline : fallbackOutline(plan)
  const b = bbox(outline)
  const pad = 90
  let scale = Math.min((AW - pad * 2) / Math.max(1, b.maxX - b.minX), (AH - pad * 2) / Math.max(1, b.maxY - b.minY))
  // the overlay circle (radius ≈ half diagonal × 1.12 for the north label) must stay inside the box
  const diag = Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2
  const maxR = Math.min(AW, AH) / 2 - 36
  if (diag * scale * 1.12 > maxR) scale = maxR / (diag * 1.12)
  const ox = AX + (AW - (b.maxX - b.minX) * scale) / 2 - b.minX * scale
  const oy = AY + (AH - (b.maxY - b.minY) * scale) / 2 - b.minY * scale
  const P = (p: Point) => `${(ox + p.x * scale).toFixed(1)},${(oy + p.y * scale).toFixed(1)}`
  const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale
  const center = polygonCentroid(outline)
  const cx = X(center.x), cy = Y(center.y)
  const R = (Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2) * scale
  const fs = Math.max(18, Math.min(26, R / 10))

  for (const r of plan.rooms) {
    if (r.polygon.length < 3) continue
    parts.push(`<polygon points="${r.polygon.map(P).join(' ')}" fill="${ROOM_FILL[r.type] ?? ROOM_FILL.other}" stroke="${C.muted}" stroke-width="1.5"/>`)
    const c = polygonCentroid(r.polygon)
    parts.push(`<text x="${X(c.x)}" y="${Y(c.y) - fs * 1.4}" font-size="${fs * 0.8}" fill="${C.ink}" text-anchor="middle" opacity="0.85">${esc(r.name || ROOM_ZH[r.type])}</text>`)
  }
  parts.push(`<polygon points="${outline.map(P).join(' ')}" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>`)

  if (kind !== 'form') {
    const info = palaceInfo(report, kind)
    for (const t of TRIGRAMS_CLOCKWISE) {
      const a0 = PALACES[t].bearing - 22.5 - plan.northOffset, a1 = PALACES[t].bearing + 22.5 - plan.northOffset
      const p0 = polar({ x: cx, y: cy }, R, a0), p1 = polar({ x: cx, y: cy }, R, a1)
      const i = info[t]
      const fill = i.tone === 'good' ? C.good : i.tone === 'bad' ? C.badFill : C.neutral
      parts.push(`<path d="M ${cx} ${cy} L ${p0.x} ${p0.y} A ${R} ${R} 0 0 1 ${p1.x} ${p1.y} Z" fill="${fill}" stroke="${C.muted}" stroke-opacity="0.5" stroke-dasharray="8 6" stroke-width="1.5"/>`)
      const mid = polar({ x: cx, y: cy }, R * 0.74, (a0 + a1) / 2)
      parts.push(`<text x="${mid.x}" y="${mid.y}" font-size="${fs}" font-weight="500" fill="${C.ink}" text-anchor="middle">${esc(PALACES[t].zh)}·${esc(PALACES[t].direction)}</text>`)
      i.lines.forEach((l, k) => parts.push(`<text x="${mid.x}" y="${mid.y + fs * (1.2 + k * 1.05)}" font-size="${fs * 0.9}" fill="${i.tone === 'bad' ? C.bad : i.tone === 'good' ? C.brand : C.muted}" text-anchor="middle">${esc(l)}</text>`))
    }
    const n = polar({ x: cx, y: cy }, R * 1.06, -plan.northOffset)
    parts.push(`<line x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="${C.bad}" stroke-opacity="0.6" stroke-width="2"/><text x="${n.x}" y="${n.y - 8}" font-size="${fs}" fill="${C.bad}" text-anchor="middle">N</text>`)
  }
  for (const it of plan.items) {
    const corners = rectCorners(it).map(P).join(' ')
    parts.push(`<polygon points="${corners}" fill="${C.surface}" stroke="${C.ink}" stroke-width="1.5" opacity="0.9"/>`)
    const c = { x: it.x + it.w / 2, y: it.y + it.h / 2 }
    parts.push(`<text x="${X(c.x)}" y="${Y(c.y) + fs * 0.32}" font-size="${Math.min(fs * 0.85, Math.max(it.w, it.h) * scale * 0.5)}" fill="${C.ink}" text-anchor="middle">${esc(ITEM_ZH[it.type][0]!)}</text>`)
  }
  if (kind === 'form') {
    for (const f of runFormRules(plan)) {
      if (!f.marks?.length) continue
      if (f.marks.length >= 2) parts.push(`<line x1="${X(f.marks[0]!.x)}" y1="${Y(f.marks[0]!.y)}" x2="${X(f.marks[1]!.x)}" y2="${Y(f.marks[1]!.y)}" stroke="${C.bad}" stroke-width="4" stroke-dasharray="12 8"/>`)
      else parts.push(`<circle cx="${X(f.marks[0]!.x)}" cy="${Y(f.marks[0]!.y)}" r="${fs}" fill="none" stroke="${C.bad}" stroke-width="4"/>`)
    }
  }
  // 財位／文昌位／洩財位 tags (依坐向, report.bazhai)
  const tags: { t: Trigram; label: string; fill: string }[] = []
  for (const t of report.bazhai.wealth) tags.push({ t, label: '財位', fill: C.brand })
  for (const t of report.bazhai.wenchang) if ((t as string) !== 'center') tags.push({ t, label: '文昌', fill: '#2563eb' })
  for (const t of report.bazhai.wealthLeak) tags.push({ t, label: '洩財', fill: C.muted })
  const perPalace = new Map<Trigram, string[]>()
  for (const g of tags) perPalace.set(g.t, [...(perPalace.get(g.t) ?? []), g.label])
  for (const [t, labels] of perPalace) {
    const mid = polar({ x: cx, y: cy }, R * 0.56, PALACES[t].bearing - plan.northOffset)
    const tw = labels.length * fs * 2.1 + fs * 0.6
    parts.push(`<rect x="${mid.x - tw / 2}" y="${mid.y - fs * 0.8}" width="${tw}" height="${fs * 1.5}" rx="${fs * 0.75}" fill="${C.surface}" stroke="${C.line}" stroke-width="1.5" opacity="0.95"/>`)
    labels.forEach((l, i) => {
      const color = tags.find((g) => g.t === t && g.label === l)!.fill
      parts.push(`<text x="${mid.x - tw / 2 + fs * 0.3 + i * fs * 2.1 + fs * 1.05}" y="${mid.y + fs * 0.32}" font-size="${fs * 0.85}" font-weight="500" fill="${color}" text-anchor="middle">${esc(l)}</text>`)
    })
  }

}


/** Full report as one tall image (width 1080). Returns the SVG and its height. */
export function buildReportSvg({ plan, report, siteUrl = 'zhixuli0406.github.io/dudu-fengshui', kind = 'annual' }: ShareOptions & { kind?: ShareKind }): { svg: string; height: number } {
  const parts: string[] = []
  let y = 0
  const text = (str: string, x: number, size: number, opts: { fill?: string; weight?: number; anchor?: 'start' | 'end' | 'middle' } = {}) => {
    parts.push(`<text x="${x}" y="${y}" font-size="${size}" ${opts.weight ? `font-weight="${opts.weight}"` : ''} fill="${opts.fill ?? C.ink}" ${opts.anchor ? `text-anchor="${opts.anchor}"` : ''}>${esc(str)}</text>`)
  }
  const para = (str: string, size = 26, chars = 38, fill = C.ink, indent = 60) => { for (const line of wrap(str, chars)) { y += size * 1.45; text(line, indent, size, { fill }) } }
  const section = (title: string) => { y += 64; parts.push(`<line x1="60" y1="${y - 40}" x2="${W - 60}" y2="${y - 40}" stroke="${C.line}" stroke-width="2"/>`); text(title, 60, 34, { weight: 600 }); y += 12 }

  // header
  y = 88; text('嘟嘟風水分析報告', 60, 40, { weight: 600 })
  text(`${report.year} ${report.ganzhi}年，${report.period} 運`, W - 60, 26, { fill: C.muted, anchor: 'end' })
  y = 130; text(`向${report.house.facing.name}（${report.house.facingBearing.toFixed(1)}°）坐${report.house.sitting.name}，${PALACES[report.house.houseGua].zh}宅（${groupZh(report.house.group)}宅），${report.xuankong.patternZh}${report.xuankong.chart.replacement ? '（替卦）' : ''}`, 60, 26, { fill: C.muted })
  y = 156; parts.push(`<line x1="60" y1="${y}" x2="${W - 60}" y2="${y}" stroke="${C.line}" stroke-width="2"/>`)

  // scores
  y = 250
  parts.push(`<text x="60" y="${y}" font-size="84" font-weight="600" fill="${report.scores.overall >= 75 ? C.brand : report.scores.overall >= 50 ? C.ink : C.bad}">${report.scores.overall}</text>`)
  parts.push(`<text x="60" y="${y + 36}" font-size="22" fill="${C.muted}">總評</text>`)
  const cols: [string, number][] = [['八宅', report.scores.bazhai], ['玄空', report.scores.xuankong], ['流年', report.scores.annual], ['形勢', report.scores.form]]
  cols.forEach(([l, v], i) => {
    const x = 300 + i * 190
    parts.push(`<text x="${x}" y="${y - 6}" font-size="44" font-weight="500" fill="${v >= 75 ? C.brand : v >= 50 ? C.ink : C.bad}">${v}</text>`)
    parts.push(`<text x="${x}" y="${y + 30}" font-size="22" fill="${C.muted}">${l}</text>`)
  })

  // plan
  y = 320
  text(`平面圖（${SHARE_KIND_ZH[kind]}）`, 60, 34, { weight: 600 })
  y += 20
  drawPlan(parts, plan, report, kind, 60, y, W - 120, 640)
  y += 640

  // top actions
  section('優先處理')
  if (!report.topActions.length) para('目前沒有高優先問題。', 26, 38, C.muted)
  report.topActions.forEach((a, i) => para(`${i + 1}. ${a}`))

  // persons
  section('成員命卦')
  if (!report.persons.length) para('尚未新增成員。', 26, 38, C.muted)
  for (const p of report.persons) para(`${p.person.name}：命卦${PALACES[p.gua].zh}，${groupZh(p.group)}命，${p.compatible ? '與宅相合' : '與宅不合'}。吉方 ${p.bestDirections.map((d) => `${PALACES[d].direction}${WANDERING_STARS[p.stars[d]].zh}`).join('、')}${p.offendingTaisui ? `。今年${p.offendingTaisui}` : ''}`)
  for (const it of report.bazhai.items) { const bad = it.perPerson.filter((x) => x.verdict === 'bad'); if (bad.length) para(`・${it.label}：${bad.map((b) => `${b.name} ${b.note}`).join('；')}`, 24, 42, C.bad) }

  // star grid
  section(`飛星盤（${report.period}運 ${report.house.sitting.name}山${report.house.facing.name}向）`)
  const grid: (Trigram | 'center')[][] = [['xun', 'li', 'kun'], ['zhen', 'center', 'dui'], ['gen', 'kan', 'qian']]
  const cell = 150, gx = 60, gy = y + 10
  grid.forEach((row, r) => row.forEach((t, c) => {
    const x0 = gx + c * cell, y0 = gy + r * cell
    const pe = t === 'center' ? null : report.xuankong.palaces.find((p) => p.palace === t)!
    const fill = pe ? (pe.combo.rating === 'great' || pe.combo.rating === 'good' ? C.good : pe.combo.rating === 'neutral' ? C.surface : C.badFill) : C.neutral
    const ring = t === report.house.sittingPalace || t === report.xuankong.chart.facingPalace
    parts.push(`<rect x="${x0}" y="${y0}" width="${cell - 6}" height="${cell - 6}" rx="10" fill="${fill}" stroke="${ring ? C.brand : C.line}" stroke-width="${ring ? 3 : 1.5}"/>`)
    parts.push(`<text x="${x0 + 10}" y="${y0 + 26}" font-size="18" fill="${C.muted}">${t === 'center' ? '中宮' : PALACES[t].direction}${t === report.house.sittingPalace ? ' 坐' : t === report.xuankong.chart.facingPalace ? ' 向' : ''}</text>`)
    parts.push(`<text x="${x0 + 18}" y="${y0 + 84}" font-size="44" fill="${C.ink}">${report.xuankong.chart.mountainStars[t]}</text>`)
    parts.push(`<text x="${x0 + cell - 24}" y="${y0 + 84}" font-size="44" fill="${C.ink}" text-anchor="end">${report.xuankong.chart.waterStars[t]}</text>`)
    parts.push(`<text x="${x0 + (cell - 6) / 2}" y="${y0 + 128}" font-size="22" fill="${C.muted}" text-anchor="middle">${report.xuankong.chart.periodStars[t]}</text>`)
  }))
  // notes beside the grid
  let ny = gy + 30
  const noteX = gx + cell * 3 + 30
  for (const n of report.xuankong.notes.slice(0, 4)) { for (const line of wrap(n, 22)) { parts.push(`<text x="${noteX}" y="${ny}" font-size="22" fill="${C.ink}">${esc(line)}</text>`); ny += 32 } ny += 8 }
  y = Math.max(gy + cell * 3, ny) + 10
  const worst = [...report.xuankong.palaces].sort((a, b) => a.score - b.score).slice(0, 3)
  for (const w of worst) para(`・${PALACES[w.palace].direction} ${w.mountainStar}${w.waterStar}（${RATING_ZH[w.combo.rating]}）：${w.combo.note}`, 24, 42)

  // annual
  section(`${report.year} 流年`)
  const a = report.annual.data
  para(`太歲${a.taisui.taisuiMountain}山（${a.taisui.zodiac}年），歲破${a.taisui.suipoMountain}山，三煞${a.taisui.sanshaBranches.join('')}。犯太歲：${a.taisui.offending.map((o) => `${o.zodiac}（${o.type}）`).join('、')}`)
  for (const w of report.annual.warnings) para(`・${w.title}在${palaceLabel(w.palace)}${w.rooms.length ? `（${w.rooms.join('、')}）` : ''}${w.rooms.length ? `：${w.detail.split('；')[0]}` : ''}`, 24, 42, w.rooms.length ? C.bad : C.muted)

  // findings
  section(`形勢問題（${report.form.findings.length}）`)
  if (!report.form.findings.length) para('未偵測到形勢問題。', 26, 38, C.muted)
  for (const f of report.form.findings.slice(0, 14)) para(`・${f.floor ? `[${f.floor}] ` : ''}${f.name}（${{ high: '高', medium: '中', low: '低' }[f.severity]}${f.contested ? '，各派有別' : ''}）：${f.remedies[0] ?? ''}`, 24, 42, f.severity === 'high' ? C.bad : C.ink)
  if (report.form.findings.length > 14) para(`…另有 ${report.form.findings.length - 14} 項，見網頁版報告。`, 22, 42, C.muted)

  // footer
  y += 70
  parts.push(`<line x1="60" y1="${y - 30}" x2="${W - 60}" y2="${y - 30}" stroke="${C.line}" stroke-width="2"/>`)
  text('文化參考，各派說法互有出入，不構成醫療、法律、財務或工程建議。', 60, 20, { fill: C.muted })
  text(siteUrl, W - 60, 20, { fill: C.muted, anchor: 'end' })
  y += 50
  const height = Math.ceil(y)
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" font-family="${FONT}"><rect width="${W}" height="${height}" fill="${C.bg}"/>`
  return { svg: head + parts.join('') + '</svg>', height }
}

function fallbackOutline(plan: FloorPlan): Point[] {
  const pts = [...plan.rooms.flatMap((r) => r.polygon), ...plan.items.flatMap((i) => rectCorners(i))]
  if (!pts.length) return [{ x: 0, y: 0 }, { x: 800, y: 0 }, { x: 800, y: 600 }, { x: 0, y: 600 }]
  const b = bbox(pts)
  return [{ x: b.minX, y: b.minY }, { x: b.maxX, y: b.minY }, { x: b.maxX, y: b.maxY }, { x: b.minX, y: b.maxY }]
}

function wrap(text: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += n) out.push(text.slice(i, i + n))
  return out.length ? out : ['']
}

/** Rasterise an SVG string to a PNG blob. */
export async function svgToPng(svg: string, width = W, height = H, scale = 2): Promise<Blob> {
  // Stay under common canvas limits (≈16.7M px on iOS Safari).
  scale = Math.min(scale, Math.sqrt(16_000_000 / (width * height)))
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('SVG 轉圖失敗')); img.src = url })
    const canvas = document.createElement('canvas')
    canvas.width = width * scale; canvas.height = height * scale
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (!blob) throw new Error('無法產生 PNG')
    return blob
  } finally { URL.revokeObjectURL(url) }
}

/** Web Share with file when available, else download. Returns how it was delivered. */
export async function shareOrDownload(blob: Blob, filename: string, title: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file], title }); return 'shared' } catch (e) { if ((e as Error).name === 'AbortError') return 'shared' }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  return 'downloaded'
}
