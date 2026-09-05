import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Empty, ScoreRing } from '../components/ui'
import { useAppStore } from '../store/useAppStore'
import { buildReport, type Report } from '../engine/report'
import { PALACES, TRIGRAMS_CLOCKWISE, type Trigram } from '../engine/bagua'
import { groupZh, WANDERING_STARS } from '../engine/bazhai'
import { NINE_STARS, RATING_ZH } from '../engine/stars'
import { TIMELINESS_ZH } from '../engine/xuankong'
import { palaceLabel } from '../engine/annual'
import { ROOM_ZH, mainFloor } from '../engine/floorplan'
import { SEVERITY_ZH } from '../engine/rules'
import { reportToMarkdown } from '../engine/exportMarkdown'
import { environmentFindings, type EnvironmentQuestion } from '../engine/environment'
import envQuestions from '../data/environmentQuestions.json'

export function ReportPage() {
  const { persons, house, plan, floors, environment } = useAppStore()
  const [tab, setTab] = useState<'summary' | 'bazhai' | 'xuankong' | 'annual' | 'form' | 'element'>('summary')
  const report = useMemo<Report | null>(() => {
    try {
      const mainPlan = mainFloor(floors.length ? floors : [plan])
      const r = buildReport(persons, { facingBearing: house.facingBearing, periodYear: house.periodYear, plan: mainPlan, floors: floors.length ? floors : [plan], stoveMode: house.stoveMode, jianxiangTolerance: house.jianxiangTolerance, replacementMode: house.replacementMode })
      const env = environmentFindings(environment as Record<string, string | boolean | undefined>, envQuestions as EnvironmentQuestion[])
      if (!env.length) return r
      const findings = [...r.form.findings, ...env].sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity])
      const penalty = env.reduce((a, f) => a + ({ high: 12, medium: 6, low: 2 })[f.severity] * (f.contested ? 0.5 : 1), 0)
      const form = Math.max(0, r.form.score - penalty)
      const overall = Math.round(r.scores.bazhai * 0.25 + r.scores.xuankong * 0.25 + r.scores.annual * 0.15 + form * 0.35)
      return { ...r, form: { findings, score: form }, scores: { ...r.scores, form, overall } }
    } catch (e) { console.error(e); return null }
  }, [persons, house.facingBearing, house.periodYear, house.stoveMode, house.jianxiangTolerance, house.replacementMode, plan, floors, environment])

  if (!report) return <div className="p-4"><Empty>無法產生報告，請確認資料。</Empty></div>
  const ready = persons.length > 0 && house.facingSource !== 'none'

  const download = () => {
    const md = reportToMarkdown(report)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fengshui-report-${report.year}.md`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto safe-t">
      <div className="flex items-center justify-between pt-2">
        <h1 className="font-serif text-2xl font-bold text-gold">風水報告</h1>
        <div className="flex gap-2">
          <Button variant="subtle" className="!py-1.5" onClick={() => window.print()}>列印</Button>
          <Button variant="ghost" className="!py-1.5" onClick={download}>匯出 .md</Button>
        </div>
      </div>
      {!ready && (
        <div className="rounded-xl bg-gold/10 border border-gold/40 p-3 text-sm">
          {persons.length === 0 && <div>尚未新增家庭成員，八宅命卦部分將為空。<Link className="underline text-gold ml-1" to="/setup">去新增</Link></div>}
          {house.facingSource === 'none' && <div>尚未量測朝向（目前以預設 {house.facingBearing}° 計算）。<Link className="underline text-gold ml-1" to="/compass">去量測</Link></div>}
          {plan.outline.length < 3 && <div>尚未繪製平面圖，形勢派與方位分析將受限。<Link className="underline text-gold ml-1" to="/plan">去繪製</Link></div>}
          {Object.keys(environment).length === 0 && <div>尚未填寫外局問卷（路沖、壁刀等屋外煞氣）。<Link className="underline text-gold ml-1" to="/environment">去填寫</Link></div>}
        </div>
      )}

      <Card>
        <div className="flex justify-around">
          <ScoreRing score={report.scores.overall} label="總評" size={96} />
          <ScoreRing score={report.scores.bazhai} label="八宅" />
          <ScoreRing score={report.scores.xuankong} label="玄空" />
          <ScoreRing score={report.scores.annual} label="流年" />
          <ScoreRing score={report.scores.form} label="形勢" />
        </div>
        <div className="mt-3 text-sm text-paper/80 grid grid-cols-2 gap-x-3 gap-y-1">
          <div>年份：{report.year} {report.ganzhi}年</div>
          <div>元運：{report.period} 運（{house.periodYear} 年建成）</div>
          <div>朝向：{report.house.facingBearing.toFixed(1)}° 向<span className="font-serif text-gold">{report.house.facing.name}</span></div>
          <div>坐山：坐<span className="font-serif text-gold">{report.house.sitting.name}</span>（{PALACES[report.house.sittingPalace].zh}宅 · {groupZh(report.house.group)}宅）</div>
          <div>格局：{report.xuankong.patternZh}</div>
          <div>正神 {PALACES[report.house.zhengShen].direction} · 零神 {PALACES[report.house.lingShen].direction}</div>
          <div className="col-span-2 text-xs text-paper/60">取向依據：{{ unitDoor: '自家大門', balcony: '陽台／採光面', buildingDoor: '大樓正門' }[house.facingBasis]}（各派有別，換一種依據結果會不同）</div>
        </div>
        {report.house.kongwang && <div className="mt-2 text-xs text-red-300">⚠ 朝向落在{report.house.kongwang === 'major' ? '大空亡' : '小空亡'}線，建議重新量測或以門向微調。</div>}
        {report.house.jianxiang && <div className="mt-1 text-xs text-gold/80">兼向：偏離{report.house.facing.name}山中心 {report.xuankong.chart.jianxiangOffset}°（門檻 {house.jianxiangTolerance}°，各派 3.5°–7° 不一）。{report.xuankong.chart.replacement ? '已改用替卦起星（傳統蔣大鴻／沈氏替星表）；替卦星辰不固，效果不若下卦穩定。' : '目前以下卦排盤，結果僅供參考；可在「資料」頁改為自動替卦。'}</div>}
        {report.xuankong.chart.qixing && <div className="mt-1 text-xs text-emerald-300">{report.xuankong.chart.qixing.kind}（{report.xuankong.chart.qixing.group} 三般卦）— 進階格局，生效以巒頭為條件。</div>}
      </Card>

      <div className="flex gap-1 overflow-x-auto text-xs">
        {([['summary', '重點建議'], ['bazhai', '八宅'], ['xuankong', '玄空飛星'], ['annual', '流年'], ['form', `形勢（${report.form.findings.length}）`], ['element', '五行佈置']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`shrink-0 px-3 py-1.5 rounded-lg ${tab === k ? 'bg-gold text-ink font-semibold' : 'bg-ink-2 text-paper/80'}`}>{l}</button>
        ))}
      </div>

      {tab === 'summary' && (
        <Card title="優先處理事項">
          {report.topActions.length === 0 ? <Empty>目前沒有高優先問題，可看各分頁細節。</Empty> : (
            <ol className="list-decimal pl-5 space-y-2 text-sm">{report.topActions.map((a, i) => <li key={i}>{a}</li>)}</ol>
          )}
          <div className="mt-4 text-sm space-y-1">
            {report.xuankong.notes.map((n, i) => <p key={i} className="text-paper/80">• {n}</p>)}
          </div>
        </Card>
      )}

      {tab === 'bazhai' && (<>
        <Card title="成員命卦">
          {report.persons.length === 0 && <Empty>尚未新增成員</Empty>}
          <ul className="space-y-2 text-sm">
            {report.persons.map((p) => (
              <li key={p.person.id} className="rounded-xl bg-ink p-3">
                <div className="font-semibold">{p.person.name} <Badge tone="gray">{p.birthYear} 年 · 屬{p.zodiac}</Badge> <Badge tone={p.compatible ? 'green' : 'red'}>{groupZh(p.group)}命 {p.compatible ? '與宅相合' : '與宅不合'}</Badge> {p.offendingTaisui && <Badge tone="red">{p.offendingTaisui}</Badge>}</div>
                <div className="text-xs text-paper/70 mt-1">命卦 {PALACES[p.gua].zh}。吉方：{p.bestDirections.map((d) => `${PALACES[d].direction}${WANDERING_STARS[p.stars[d]].zh}`).join('、')}；凶方：{p.worstDirections.map((d) => `${PALACES[d].direction}${WANDERING_STARS[p.stars[d]].zh}`).join('、')}</div>
                {!p.compatible && <div className="text-xs text-gold/80 mt-1">命宅不合時，以「床頭朝向、書桌朝向、灶口朝向」取命卦吉方補救，門位以宅卦為主。</div>}
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`宅卦遊星（${PALACES[report.house.houseGua].zh}宅）`}>
          <div className="grid grid-cols-4 gap-1 text-xs">
            {TRIGRAMS_CLOCKWISE.map((t) => { const s = WANDERING_STARS[report.bazhai.houseStars[t]]; return <div key={t} className={`rounded p-2 ${s.auspicious ? 'bg-jade/15' : 'bg-cinnabar/15'}`}><div className="text-paper/70">{PALACES[t].direction}</div><div className="font-serif text-base">{s.zh}</div></div> })}
          </div>
        </Card>
        <Card title="住宅文昌位與財位（依坐向）">
          <div className="text-sm space-y-1">
            <div>文昌位：<span className="text-gold">{report.bazhai.wenchang.map((t) => (t as string) === 'center' ? '中宮' : PALACES[t].direction).join('、')}</span>（宜放書桌；另有個人文昌與流年四綠位，三套不可混用）</div>
            <div>財位：<span className="text-gold">{report.bazhai.wealth.map((t) => PALACES[t].direction).join('、')}</span>；洩財位：{report.bazhai.wealthLeak.map((t) => PALACES[t].direction).join('、')}（忌放魚缸）</div>
            <div className="text-xs text-paper/60">{report.bazhai.wealthNote}。此為理氣派暗財位，與「入門斜對角明財位」是不同系統。</div>
            {report.bazhai.positionWarnings.map((w, i) => <div key={i} className="text-xs text-red-300">⚠ {w}</div>)}
          </div>
        </Card>
        <Card title="門床灶桌評估">
          {report.bazhai.items.length === 0 && <Empty>平面圖上尚未放置大門、床、爐灶、書桌、神位或馬桶。</Empty>}
          <ul className="space-y-2 text-sm">
            {report.bazhai.items.map((it) => (
              <li key={`${it.itemId}-${it.label}`} className="rounded-xl bg-ink p-3">
                <div className="font-semibold">{it.label} <Badge tone="gray">{it.facingPalace ? `朝${PALACES[it.facingPalace].direction}` : `在${PALACES[it.palace].direction}`}</Badge></div>
                <div className="flex flex-wrap gap-1 mt-1">{it.perPerson.map((pp) => <Badge key={pp.personId} tone={pp.verdict === 'good' ? 'green' : 'red'}>{pp.name}：{pp.note}</Badge>)}</div>
                <div className="text-xs text-paper/70 mt-1">{it.advice}</div>
              </li>
            ))}
          </ul>
        </Card>
      </>)}

      {tab === 'xuankong' && (<>
        <Card title={`${report.period}運 ${report.house.sitting.name}山${report.house.facing.name}向 飛星盤`}>
          <StarGrid report={report} />
          <p className="text-xs text-paper/60 mt-2">每宮：左上山星（主人丁健康）、右上向星（主財）、下方運星。顏色：綠＝吉、紅＝凶。盤面已依平面圖北方旋轉（上＝北）。</p>
        </Card>
        {report.xuankong.palaces.map((p) => (
          <Card key={p.palace} title={<span>{PALACES[p.palace].direction} · 山{p.mountainStar} 向{p.waterStar} <Badge tone={p.combo.rating === 'great' || p.combo.rating === 'good' ? 'green' : p.combo.rating === 'neutral' ? 'gray' : 'red'}>{RATING_ZH[p.combo.rating]}</Badge></span>}>
            <div className="text-sm">{p.combo.note}</div>
            <div className="text-xs text-paper/60 mt-1">向星{TIMELINESS_ZH[p.waterTimeliness]} · 山星{TIMELINESS_ZH[p.mountainTimeliness]} · 流年{NINE_STARS[p.annualStar]!.zh}{p.monthlyStar ? ` · 流月${NINE_STARS[p.monthlyStar]!.zh}` : ''}</div>
            {p.rooms.length > 0 && <div className="text-xs mt-1">此方位房間：{p.rooms.map((r) => r.name || ROOM_ZH[r.type]).join('、')}</div>}
            <ul className="mt-2 space-y-1 text-xs text-paper/80 list-disc pl-4">{p.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
          </Card>
        ))}
      </>)}

      {tab === 'annual' && (<>
        <Card title={`${report.year} ${report.ganzhi}年 流年方位`}>
          <div className="text-sm space-y-1">
            <div>太歲：{report.annual.data.taisui.taisuiMountain}山（{report.annual.data.taisui.zodiac}年）· 歲破：{report.annual.data.taisui.suipoMountain}山 · 三煞：{report.annual.data.taisui.sanshaBranches.join('')}（{PALACES[report.annual.data.taisui.sanshaPalace].direction}）</div>
            <div>犯太歲生肖：{report.annual.data.taisui.offending.map((o) => `${o.zodiac}（${o.type}）`).join('、')}</div>
          </div>
          <ul className="mt-3 space-y-2">
            {report.annual.warnings.map((w, i) => (
              <li key={i} className={`rounded-xl p-3 text-sm ${w.rooms.length ? (w.severity === 'high' ? 'bg-cinnabar/20' : 'bg-gold/10') : 'bg-ink'}`}>
                <div className="font-semibold">{w.title} → {palaceLabel(w.palace)} {w.rooms.length > 0 && <Badge tone="red">{w.rooms.join('、')}</Badge>}</div>
                <div className="text-xs text-paper/70 mt-1">{w.detail}</div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="流年吉星">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {([['八白財星', report.annual.data.babai], ['九紫喜慶', report.annual.data.jiuzi], ['一白桃花', report.annual.data.yibai], ['四綠文昌', report.annual.data.silv], ['六白武曲', report.annual.data.liubai]] as const).map(([l, p]) => <div key={l} className="rounded-lg bg-ink p-2"><Badge tone="gold">{l}</Badge> <span className="ml-1">{palaceLabel(p)}</span></div>)}
          </div>
        </Card>
      </>)}

      {tab === 'form' && (
        <div className="space-y-2">
          {report.form.findings.length === 0 && <Empty>平面圖尚無形勢問題，或尚未放置物件。</Empty>}
          {report.form.findings.map((f, i) => (
            <Card key={i}>
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold">{f.floor && <span className="text-gold/80 mr-1">[{f.floor}]</span>}{f.name}</div>
                <div className="flex gap-1 shrink-0"><Badge tone={f.severity === 'high' ? 'red' : f.severity === 'medium' ? 'gold' : 'gray'}>{SEVERITY_ZH[f.severity]}</Badge>{f.contested && <Badge tone="gray">各派有別</Badge>}</div>
              </div>
              <div className="text-xs text-paper/60 mt-0.5">{f.category} · 影響：{f.affects.join('、')}</div>
              <p className="text-sm mt-2">{f.explanation}</p>
              <ul className="mt-2 text-sm list-disc pl-4 space-y-0.5">{f.remedies.map((r, k) => <li key={k}>{r}</li>)}</ul>
            </Card>
          ))}
        </div>
      )}

      {tab === 'element' && (
        <Card title="八方五行佈置建議">
          <ul className="space-y-2 text-sm">
            {report.elementAdvice.map((e) => (
              <li key={e.palace} className="rounded-xl bg-ink p-3">
                <div className="font-semibold">{PALACES[e.palace].direction}（{PALACES[e.palace].zh}宮 · {e.element}）<span className="text-xs text-paper/60 ml-2">{PALACES[e.palace].family}</span></div>
                <div className="text-xs text-paper/80 mt-1">顏色：{e.colors}｜材質：{e.materials}</div>
                <div className="text-xs text-paper/60 mt-1">{e.tip}</div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-[11px] text-paper/40">本報告為文化參考，各派理論互有出入；重大裝修請諮詢專業人士。</p>
    </div>
  )
}

function StarGrid({ report }: { report: Report }) {
  const grid: (Trigram | 'center')[][] = [['xun', 'li', 'kun'], ['zhen', 'center', 'dui'], ['gen', 'kan', 'qian']]
  const c = report.xuankong.chart
  const rot = -report.house.facingBearing + 180 // keep north up: standard chart already north-up; no rotation needed
  void rot
  return (
    <div className="grid grid-cols-3 gap-1">
      {grid.flat().map((t) => {
        const pe = t === 'center' ? null : report.xuankong.palaces.find((p) => p.palace === t)!
        const tone = pe ? (pe.combo.rating === 'great' || pe.combo.rating === 'good' ? 'bg-jade/20' : pe.combo.rating === 'neutral' ? 'bg-ink' : 'bg-cinnabar/20') : 'bg-ink-3'
        const isSit = t === report.house.sittingPalace, isFace = t === report.xuankong.chart.facingPalace
        return (
          <div key={t} className={`rounded-lg p-2 ${tone} ${isSit || isFace ? 'ring-1 ring-gold' : ''}`}>
            <div className="text-[10px] text-paper/60">{t === 'center' ? '中宮' : PALACES[t].direction}{isSit ? ' 坐' : isFace ? ' 向' : ''}</div>
            <div className="flex justify-between font-serif text-lg"><span>{c.mountainStars[t]}</span><span>{c.waterStars[t]}</span></div>
            <div className="text-center text-xs text-paper/70">{c.periodStars[t]}</div>
          </div>
        )
      })}
    </div>
  )
}
