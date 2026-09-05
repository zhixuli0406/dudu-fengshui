import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { Badge, Button, Card, Field, inputCls, Empty } from '../components/ui'
import { analyzePerson, groupZh, WANDERING_STARS } from '../engine/bazhai'
import { fengshuiYearOf, ganzhiOfYear } from '../engine/calendar'
import { PALACES } from '../engine/bagua'
import { periodOfYear } from '../engine/xuankong'
import { mountainOf } from '../engine/mountains24'

export function SetupPage() {
  const { persons, addPerson, removePerson, updatePerson, house, setHouse } = useAppStore()
  const [name, setName] = useState('')
  const [birth, setBirth] = useState('1990-01-01')
  const [gender, setGender] = useState<'male' | 'female'>('male')

  const submit = () => {
    if (!birth) return
    addPerson({ name: name.trim() || `成員${persons.length + 1}`, birthDate: birth, gender })
    setName('')
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto safe-t">
      <h1 className="font-serif text-2xl font-bold text-gold pt-2">基本資料</h1>

      <Card title="家庭成員（八宅命卦）">
        {persons.length === 0 && <Empty>尚未新增成員。命卦以出生年（立春為界）與性別計算。</Empty>}
        <ul className="space-y-2 mb-3">
          {persons.map((p) => {
            const by = fengshuiYearOf(new Date(p.birthDate + 'T12:00:00')).year
            const r = analyzePerson(by, p.gender)
            const gz = ganzhiOfYear(by)
            return (
              <li key={p.id} className="rounded-xl bg-ink p-3 flex items-start gap-3">
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {p.name} <Badge tone="gray">{p.gender === 'male' ? '男' : '女'}</Badge>
                    {p.primary && <Badge tone="gold">主要</Badge>}
                  </div>
                  <div className="text-xs text-paper/60 mt-0.5">{p.birthDate}（{gz.stem}{gz.branch}年 · 屬{gz.zodiac}，立春後算 {by} 年）</div>
                  <div className="text-sm mt-1">命卦 <span className="text-gold font-serif font-bold">{PALACES[r.gua].zh}</span> · {groupZh(r.group)}命 · 吉方：{r.bestDirections.map((d) => `${PALACES[d].direction}(${WANDERING_STARS[r.stars[d]].zh})`).join('、')}</div>
                </div>
                <div className="flex flex-col gap-1">
                  {!p.primary && <button className="text-xs text-gold" onClick={() => persons.forEach((x) => updatePerson(x.id, { primary: x.id === p.id }))}>設為主要</button>}
                  <button className="text-xs text-red-300" onClick={() => removePerson(p.id)}>移除</button>
                </div>
              </li>
            )
          })}
        </ul>
        <div className="grid grid-cols-2 gap-2">
          <Field label="姓名／稱呼"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例：爸爸" /></Field>
          <Field label="性別">
            <select className={inputCls} value={gender} onChange={(e) => setGender(e.target.value as 'male' | 'female')}>
              <option value="male">男</option><option value="female">女</option>
            </select>
          </Field>
          <Field label="出生日期（國曆）"><input type="date" className={inputCls} value={birth} onChange={(e) => setBirth(e.target.value)} /></Field>
          <div className="flex items-end mb-3"><Button onClick={submit} className="w-full">新增成員</Button></div>
        </div>
      </Card>

      <Card title="房屋資料">
        <div className="grid grid-cols-2 gap-2">
          <Field label="建成年（定元運）" hint={`元運：${periodOfYear(house.periodYear)} 運。玄空以建成年定運，換運不重新起盤；若曾大幅翻修（改換天心）可填翻修年。`}>
            <input type="number" className={inputCls} value={house.periodYear} onChange={(e) => setHouse({ periodYear: Number(e.target.value) || house.periodYear })} />
          </Field>
          <Field label="朝向（度，0=北 90=東）" hint={`向 ${mountainOf(house.facingBearing).name}山 · 來源：${{ compass: '羅盤', manual: '手動', ar: 'AR', none: '尚未量測' }[house.facingSource]}`}>
            <input type="number" min={0} max={359} className={inputCls} value={Math.round(house.facingBearing)} onChange={(e) => setHouse({ facingBearing: ((Number(e.target.value) % 360) + 360) % 360, facingSource: 'manual' })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="取向依據（各派有別）" hint="門為氣口是各派共同承認的基礎，預設自家大門；換一種依據結果會不同。">
            <select className={inputCls} value={house.facingBasis} onChange={(e) => setHouse({ facingBasis: e.target.value as typeof house.facingBasis })}>
              <option value="unitDoor">自家大門朝向</option>
              <option value="balcony">陽台／最大採光面</option>
              <option value="buildingDoor">整棟大樓正門</option>
            </select>
          </Field>
          <Field label="灶位判法（各派有別）" hint="「座凶向吉」坊間廣傳但古籍出處未驗證；「全在吉方」為多數可查來源主張。">
            <select className={inputCls} value={house.stoveMode} onChange={(e) => setHouse({ stoveMode: e.target.value as typeof house.stoveMode })}>
              <option value="allGood">灶座與灶口皆宜吉方</option>
              <option value="seatBadFaceGood">灶座壓凶方、灶口向吉方</option>
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="兼向門檻（各派有別）" hint="偏離山中心超過此角度即為兼向，需替卦起星。">
            <select className={inputCls} value={house.jianxiangTolerance} onChange={(e) => setHouse({ jianxiangTolerance: Number(e.target.value) })}>
              <option value={3.5}>3.5°（玄空館）</option>
              <option value={4.5}>4.5°（沈氏，預設）</option>
              <option value={6}>6°（高端風水網）</option>
            </select>
          </Field>
          <Field label="兼向時排盤" hint="替卦採傳統蔣大鴻／沈氏替星表（子癸甲申貪狼…）。">
            <select className={inputCls} value={house.replacementMode} onChange={(e) => setHouse({ replacementMode: e.target.value as typeof house.replacementMode })}>
              <option value="auto">自動改用替卦起星</option>
              <option value="never">一律下卦（僅提示）</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-paper/60">「朝向」＝站在大門內側面向屋外時的方向；坐向為其相反。建議到「羅盤」頁實測。元運以入住年為主，若整棟重新裝修可改用裝修年。</p>
      </Card>
    </div>
  )
}
