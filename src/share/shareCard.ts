import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { WANDERING_STARS } from '../engine/bazhai'
import { ITEM_ZH, ROOM_ZH, type FloorPlan } from '../engine/floorplan'
import { bbox, polygonCentroid, rectCorners, type Point } from '../engine/geometry'
import type { Report } from '../engine/report'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { runFormRules } from '../engine/rules'
import { groupZh } from '../engine/bazhai'

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

  // plan area
  const AX = 60, AY = 180, AW = W - 120, AH = 720
  parts.push(`<rect x="${AX}" y="${AY}" width="${AW}" height="${AH}" rx="16" fill="${C.surface}" stroke="${C.line}" stroke-width="2"/>`)
  const outline = plan.outline.length >= 3 ? plan.outline : fallbackOutline(plan)
  const b = bbox(outline)
  const pad = 90
  const scale = Math.min((AW - pad * 2) / Math.max(1, b.maxX - b.minX), (AH - pad * 2) / Math.max(1, b.maxY - b.minY))
  const ox = AX + (AW - (b.maxX - b.minX) * scale) / 2 - b.minX * scale
  const oy = AY + (AH - (b.maxY - b.minY) * scale) / 2 - b.minY * scale
  const P = (p: Point) => `${(ox + p.x * scale).toFixed(1)},${(oy + p.y * scale).toFixed(1)}`
  const X = (x: number) => ox + x * scale, Y = (y: number) => oy + y * scale
  const center = polygonCentroid(outline)
  const cx = X(center.x), cy = Y(center.y)
  const R = (Math.hypot(b.maxX - b.minX, b.maxY - b.minY) / 2) * scale
  const fs = Math.max(18, Math.min(26, R / 10))

  // rooms
  for (const r of plan.rooms) {
    if (r.polygon.length < 3) continue
    parts.push(`<polygon points="${r.polygon.map(P).join(' ')}" fill="${ROOM_FILL[r.type] ?? ROOM_FILL.other}" stroke="${C.muted}" stroke-width="1.5"/>`)
    const c = polygonCentroid(r.polygon)
    parts.push(`<text x="${X(c.x)}" y="${Y(c.y) - fs * 1.4}" font-size="${fs * 0.8}" fill="${C.ink}" text-anchor="middle" opacity="0.85">${esc(r.name || ROOM_ZH[r.type])}</text>`)
  }
  parts.push(`<polygon points="${outline.map(P).join(' ')}" fill="none" stroke="${C.ink}" stroke-width="4" stroke-linejoin="round"/>`)

  // overlay
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

  // items
  for (const it of plan.items) {
    const corners = rectCorners(it).map(P).join(' ')
    parts.push(`<polygon points="${corners}" fill="${C.surface}" stroke="${C.ink}" stroke-width="1.5" opacity="0.9"/>`)
    const c = { x: it.x + it.w / 2, y: it.y + it.h / 2 }
    parts.push(`<text x="${X(c.x)}" y="${Y(c.y) + fs * 0.32}" font-size="${Math.min(fs * 0.85, Math.max(it.w, it.h) * scale * 0.5)}" fill="${C.ink}" text-anchor="middle">${esc(ITEM_ZH[it.type][0]!)}</text>`)
  }
  // findings marks
  const findings = kind === 'form' ? runFormRules(plan) : []
  if (kind === 'form') {
    for (const f of findings) {
      if (!f.marks?.length) continue
      if (f.marks.length >= 2) parts.push(`<line x1="${X(f.marks[0]!.x)}" y1="${Y(f.marks[0]!.y)}" x2="${X(f.marks[1]!.x)}" y2="${Y(f.marks[1]!.y)}" stroke="${C.bad}" stroke-width="4" stroke-dasharray="12 8"/>`)
      else parts.push(`<circle cx="${X(f.marks[0]!.x)}" cy="${Y(f.marks[0]!.y)}" r="${fs}" fill="none" stroke="${C.bad}" stroke-width="4"/>`)
    }
  }

  // notes
  let y = AY + AH + 56
  const notes: string[] = []
  const primary = report.persons.find((p) => p.person.primary) ?? report.persons[0]
  if (kind === 'bazhai') notes.push(primary ? `${primary.person.name}：命卦${PALACES[primary.gua].zh}，${groupZh(primary.group)}命，${primary.compatible ? '與宅相合' : '與宅不合'}。綠為吉方，紅為凶方。` : '尚未新增成員，請先於「資料」頁新增。')
  if (kind === 'stars') { notes.push('每宮：山星 向星／運星。綠為吉組合，紅為凶組合。'); const worst = [...report.xuankong.palaces].sort((a, b) => a.score - b.score)[0]; if (worst) notes.push(`${PALACES[worst.palace].direction}方 ${worst.mountainStar}${worst.waterStar}（${RATING_ZH[worst.combo.rating]}）：${worst.combo.note}`) }
  if (kind === 'annual') { const a = report.annual.data; notes.push(`${report.year} 年五黃在${PALACES[a.wuhuang as Trigram]?.direction ?? '中宮'}，二黑在${PALACES[a.erhei as Trigram]?.direction ?? '中宮'}，八白財星在${PALACES[a.babai as Trigram]?.direction ?? '中宮'}，九紫在${PALACES[a.jiuzi as Trigram]?.direction ?? '中宮'}。`); notes.push(`太歲${a.taisui.taisuiMountain}山，歲破${a.taisui.suipoMountain}山，三煞${a.taisui.sanshaBranches.join('')}。`) }
  if (kind === 'palace') notes.push('八方位以宅中心為原點，上方為平面圖方向；紅線為北。')
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
