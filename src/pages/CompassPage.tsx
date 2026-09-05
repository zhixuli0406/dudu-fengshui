import { useMemo, useState } from 'react'
import { CompassDial } from '../components/CompassDial'
import { Badge, Button, Card } from '../components/ui'
import { useCompass } from '../hooks/useCompass'
import { useDeclination } from '../hooks/useDeclination'
import { useAppStore } from '../store/useAppStore'
import { mountainOf, kongwangOf } from '../engine/mountains24'
import { palaceOfBearing, sittingOf } from '../engine/direction'
import { PALACES } from '../engine/bagua'
import { CameraCompassOverlay } from '../ar/CameraCompassOverlay'

export function CompassPage() {
  const compass = useCompass()
  const decl = useDeclination()
  const { settings, setSettings, house, setHouse } = useAppStore()
  const [locked, setLocked] = useState<number | null>(null)
  const [camera, setCamera] = useState(false)

  const trueHeading = useMemo(() => {
    if (compass.heading == null) return null
    return settings.useTrueNorth ? ((compass.heading + settings.declination) % 360 + 360) % 360 : compass.heading
  }, [compass.heading, settings.useTrueNorth, settings.declination])

  const shown = locked ?? trueHeading
  const m = shown != null ? mountainOf(shown) : null
  const kw = shown != null ? kongwangOf(shown) : null

  const lock = () => { if (trueHeading != null) setLocked(trueHeading) }
  const useAsFacing = () => {
    if (shown == null) return
    setHouse({ facingBearing: Math.round(shown * 10) / 10, facingSource: 'compass' })
  }

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto safe-t">
      <h1 className="font-serif text-2xl font-bold text-gold pt-2">羅盤量向</h1>
      <p className="text-sm text-paper/70">手機平放、螢幕朝上，站在大門內側，機頂對準屋外方向。遠離金屬門框、電器 1 公尺以上；讀數飄動時以 8 字形晃動手機校正。</p>

      {compass.status === 'need-permission' && (
        <Button onClick={compass.requestPermission} className="w-full">啟用羅盤感測器</Button>
      )}
      {compass.status === 'unsupported' && (
        <div className="rounded-xl bg-cinnabar/15 border border-cinnabar/40 p-3 text-sm">此裝置或瀏覽器沒有方向感測器（桌機常見）。請改用手機開啟本頁，或到「資料」頁手動輸入朝向度數。</div>
      )}
      {compass.status === 'denied' && (
        <div className="rounded-xl bg-cinnabar/15 border border-cinnabar/40 p-3 text-sm">感測器權限被拒絕。iOS 請到「設定 → Safari → 動作與方向存取」開啟後重新載入。</div>
      )}

      {camera ? (
        <CameraCompassOverlay heading={trueHeading} onClose={() => setCamera(false)} />
      ) : (
        <div className="flex justify-center"><CompassDial heading={trueHeading} marker={locked} size={Math.min(360, typeof window !== 'undefined' ? window.innerWidth - 48 : 320)} /></div>
      )}

      <Card>
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-4xl font-bold tabular-nums">{shown == null ? '--' : shown.toFixed(1)}°</div>
            <div className="text-sm text-paper/70 mt-1">
              {m && <>向 <span className="text-gold font-serif text-lg">{m.name}</span>山（{PALACES[m.palace].zh}宮 · {PALACES[palaceOfBearing(shown!)].direction}）· 坐 <span className="text-gold font-serif text-lg">{mountainOf(sittingOf(shown!)).name}</span>山</>}
            </div>
          </div>
          <div className="text-right space-y-1">
            {compass.accuracy != null && <Badge tone={compass.accuracy <= 15 ? 'green' : 'red'}>精度 ±{Math.round(compass.accuracy)}°</Badge>}
            {compass.status === 'active' && <div><Badge tone={compass.absolute ? 'green' : 'gray'}>{compass.absolute ? '磁力計' : '相對值'}</Badge> <Badge tone="gray">{compass.mode === 'flat' ? '平放：機頂方向' : '直立：鏡頭方向'}</Badge></div>}
            {locked != null && <div><Badge tone="gold">已鎖定</Badge></div>}
          </div>
        </div>
        {kw && <div className="mt-2 text-xs text-red-300">⚠ 此角度落在{kw === 'major' ? '大空亡（八卦交界）' : '小空亡（二十四山交界）'}線上，玄空以此立向不吉，請微調門向或以相鄰山為準。</div>}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Button variant="subtle" onClick={lock} disabled={trueHeading == null}>{locked == null ? '鎖定讀數' : '重新讀取'}</Button>
          <Button onClick={useAsFacing} disabled={shown == null}>設為朝向</Button>
          <Button variant="ghost" onClick={() => setCamera((c) => !c)}>{camera ? '關閉鏡頭' : 'AR 鏡頭'}</Button>
        </div>
        {locked != null && <p className="text-xs text-paper/50 mt-2">鎖定後可再按「重新讀取」回到即時值。</p>}
        <p className="text-xs text-paper/60 mt-2">目前朝向設定：{house.facingBearing.toFixed(1)}°（{{ compass: '羅盤', manual: '手動', ar: 'AR', none: '尚未設定' }[house.facingSource]}）</p>
      </Card>

      <Card title="磁偏角（真北校正）">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.useTrueNorth} onChange={(e) => setSettings({ useTrueNorth: e.target.checked })} />
          以真北顯示（讀數 + 磁偏角 {settings.declination >= 0 ? '+' : ''}{settings.declination.toFixed(2)}°）
        </label>
        <div className="flex gap-2 mt-2 items-center">
          <Button variant="subtle" onClick={decl.locate} disabled={decl.busy}>{decl.busy ? '定位中…' : '用 GPS 自動計算（WMM2025）'}</Button>
          <input type="number" step="0.1" className="w-24 rounded-lg bg-ink border border-ink-3 px-2 py-1.5 text-sm" value={settings.declination} onChange={(e) => setSettings({ declination: Number(e.target.value) || 0 })} />
        </div>
        {decl.error && <div className="text-xs text-red-300 mt-1">{decl.error}</div>}
        {settings.location && <div className="text-xs text-paper/50 mt-1">位置 {settings.location.lat.toFixed(3)}, {settings.location.lon.toFixed(3)}</div>}
        <p className="text-xs text-paper/60 mt-2">傳統羅盤直接用磁北定向，多數風水師沿用；若要對照建築圖或地圖（真北），請勾選真北。台灣約西偏 5°，兩者相差不到一個山頭，但接近山界時會影響判讀。</p>
      </Card>
    </div>
  )
}
