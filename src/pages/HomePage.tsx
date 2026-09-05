import { Link } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { Card, Badge } from '../components/ui'
import { fengshuiYearOf } from '../engine/calendar'
import { periodOfYear } from '../engine/xuankong'
import { annualAfflictions, palaceLabel } from '../engine/annual'

export function HomePage() {
  const persons = useAppStore((s) => s.persons)
  const house = useAppStore((s) => s.house)
  const plan = useAppStore((s) => s.plan)
  const fy = fengshuiYearOf(new Date())
  const period = periodOfYear(fy.year)
  const a = annualAfflictions(fy.year)
  const steps = [
    { to: '/setup', title: '1. 基本資料', desc: '家庭成員出生年、性別，入住年份', done: persons.length > 0 },
    { to: '/compass', title: '2. 量測坐向', desc: '站在大門內朝外，用羅盤鎖定朝向', done: house.facingSource !== 'none' },
    { to: '/plan', title: '3. 繪製平面圖', desc: '畫外牆與房間，放上門、床、灶、桌', done: plan.outline.length >= 3 && plan.items.length > 0 },
    { to: '/report', title: '4. 看報告', desc: '八宅、玄空飛星、流年、形勢四合一', done: false },
  ]
  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto safe-t">
      <header className="pt-4 pb-2">
        <h1 className="font-serif text-3xl font-bold text-gold">嘟嘟風水</h1>
        <p className="text-paper/70 text-sm mt-1">八宅 × 玄空飛星 × 形勢派，一站式室內風水分析與建議。手機可用羅盤與 AR 掃描。</p>
      </header>

      <Card title={`${fy.year} ${fy.ganzhi}年 · 下元${period}運`}>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-ink p-2"><Badge tone="red">五黃</Badge> <span className="ml-1">{palaceLabel(a.wuhuang)}</span></div>
          <div className="rounded-lg bg-ink p-2"><Badge tone="red">二黑</Badge> <span className="ml-1">{palaceLabel(a.erhei)}</span></div>
          <div className="rounded-lg bg-ink p-2"><Badge tone="gold">八白財</Badge> <span className="ml-1">{palaceLabel(a.babai)}</span></div>
          <div className="rounded-lg bg-ink p-2"><Badge tone="gold">九紫喜</Badge> <span className="ml-1">{palaceLabel(a.jiuzi)}</span></div>
          <div className="rounded-lg bg-ink p-2 col-span-2"><Badge tone="blue">太歲</Badge> <span className="ml-1">{a.taisui.taisuiMountain}山（{a.taisui.zodiac}）· 歲破 {a.taisui.suipoMountain}山 · 三煞 {a.taisui.sanshaBranches.join('')}</span></div>
        </div>
      </Card>

      <div className="space-y-2">
        {steps.map((s) => (
          <Link key={s.to} to={s.to} className="flex items-center gap-3 rounded-2xl bg-ink-2 border border-ink-3/60 p-4 hover:border-gold/50">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm ${s.done ? 'bg-jade text-paper' : 'bg-ink-3 text-paper/60'}`}>{s.done ? '✓' : '·'}</span>
            <div className="flex-1">
              <div className="font-semibold">{s.title}</div>
              <div className="text-xs text-paper/60">{s.desc}</div>
            </div>
            <span className="text-paper/40">›</span>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Link to="/environment" className="rounded-2xl bg-ink-2 border border-ink-3/60 p-4 hover:border-gold/50">
          <div className="text-2xl">🏙️</div>
          <div className="font-semibold mt-1">外局問卷</div>
          <div className="text-xs text-paper/60">路沖、壁刀、天斬等屋外環境勾選</div>
        </Link>
        <Link to="/scan" className="rounded-2xl bg-ink-2 border border-ink-3/60 p-4 hover:border-gold/50">
          <div className="text-2xl">📡</div>
          <div className="font-semibold mt-1">AR 空間掃描</div>
          <div className="text-xs text-paper/60">Android Chrome 可用 WebXR 點地板角落自動建圖</div>
        </Link>
        <Link to="/knowledge" className="rounded-2xl bg-ink-2 border border-ink-3/60 p-4 hover:border-gold/50">
          <div className="text-2xl">📚</div>
          <div className="font-semibold mt-1">風水知識庫</div>
          <div className="text-xs text-paper/60">八宅、飛星、二十四山、化解物查表</div>
        </Link>
      </div>
      <p className="text-[11px] text-paper/40 leading-relaxed">本工具依傳統風水典籍與坊間通則整理，屬文化參考，不構成任何醫療、法律或投資建議。各派說法不一之處已標示「各派有別」。</p>
    </div>
  )
}
