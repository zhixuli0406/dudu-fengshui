import { PALACES, TRIGRAMS_CLOCKWISE } from './bagua'
import { groupZh, WANDERING_STARS } from './bazhai'
import { ROOM_ZH } from './floorplan'
import { palaceLabel } from './annual'
import type { Report } from './report'
import { RATING_ZH, NINE_STARS } from './stars'
import { SEVERITY_ZH } from './rules'

export function reportToMarkdown(r: Report): string {
  const L: string[] = []
  L.push(`# 風水分析報告（${r.year} ${r.ganzhi}年）`, '')
  L.push(`- 產生時間：${r.generatedAt}`)
  L.push(`- 朝向：${r.house.facingBearing.toFixed(1)}° 向${r.house.facing.name}，坐${r.house.sitting.name}（${PALACES[r.house.houseGua].zh}宅 · ${groupZh(r.house.group)}宅）`)
  L.push(`- 元運：${r.period} 運；格局：${r.xuankong.patternZh}${r.xuankong.chart.replacement ? '（替卦起星）' : ''}${r.xuankong.chart.qixing ? `；${r.xuankong.chart.qixing.kind}` : ''}`)
  L.push(`- 分數：總評 ${r.scores.overall} ／ 八宅 ${r.scores.bazhai} ／ 玄空 ${r.scores.xuankong} ／ 流年 ${r.scores.annual} ／ 形勢 ${r.scores.form}`, '')
  L.push('## 優先處理', '')
  r.topActions.forEach((a, i) => L.push(`${i + 1}. ${a}`))
  L.push('', '## 八宅', '')
  for (const p of r.persons) L.push(`- ${p.person.name}（${p.birthYear} 年 ${p.person.gender === 'male' ? '男' : '女'}）：命卦 ${PALACES[p.gua].zh}，${groupZh(p.group)}命，${p.compatible ? '與宅相合' : '與宅不合'}；吉方 ${p.bestDirections.map((d) => `${PALACES[d].direction}${WANDERING_STARS[p.stars[d]].zh}`).join('、')}`)
  L.push('')
  L.push('| 方位 | 宅卦遊星 |', '|---|---|')
  for (const t of TRIGRAMS_CLOCKWISE) L.push(`| ${PALACES[t].direction} | ${WANDERING_STARS[r.bazhai.houseStars[t]].zh} |`)
  L.push('')
  for (const it of r.bazhai.items) L.push(`- ${it.label}：${it.perPerson.map((pp) => `${pp.name} ${pp.note}${pp.verdict === 'good' ? '（吉）' : '（凶）'}`).join('；')}。${it.advice}`)
  L.push('', '## 玄空飛星', '')
  L.push('| 方位 | 運 | 山 | 向 | 組合 | 流年 |', '|---|---|---|---|---|---|')
  for (const p of r.xuankong.palaces) L.push(`| ${PALACES[p.palace].direction} | ${p.periodStar} | ${p.mountainStar} | ${p.waterStar} | ${RATING_ZH[p.combo.rating]}：${p.combo.note} | ${NINE_STARS[p.annualStar]!.zh} |`)
  L.push('')
  r.xuankong.notes.forEach((n) => L.push(`- ${n}`))
  L.push('', '## 流年', '')
  L.push(`- 太歲 ${r.annual.data.taisui.taisuiMountain}山、歲破 ${r.annual.data.taisui.suipoMountain}山、三煞 ${r.annual.data.taisui.sanshaBranches.join('')}`)
  for (const w of r.annual.warnings) L.push(`- ${w.title} → ${palaceLabel(w.palace)}${w.rooms.length ? `（${w.rooms.join('、')}）` : ''}：${w.detail}`)
  L.push('', '## 形勢派檢查', '')
  if (!r.form.findings.length) L.push('（無）')
  for (const f of r.form.findings) {
    L.push(`### ${f.floor ? `[${f.floor}] ` : ''}${f.name}（${SEVERITY_ZH[f.severity]}${f.contested ? '，各派有別' : ''}）`, '', f.explanation, '')
    f.remedies.forEach((x) => L.push(`- ${x}`))
    L.push('')
  }
  L.push('## 五行佈置', '')
  for (const e of r.elementAdvice) L.push(`- ${PALACES[e.palace].direction}（${e.element}）：顏色 ${e.colors}；材質 ${e.materials}`)
  L.push('', `> 房間：${r.xuankong.palaces.flatMap((p) => p.rooms.map((x) => `${x.name || ROOM_ZH[x.type]}@${PALACES[p.palace].direction}`)).join('、') || '無'}`)
  L.push('', '> 本報告為文化參考，不構成專業建議。')
  return L.join('\n')
}
