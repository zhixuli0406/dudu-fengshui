import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Camera, LocateFixed, Lock, Unlock } from 'lucide-react'
import { CompassDial } from '../components/CompassDial'
import { Page, PageHeader } from '../components/AppShell'
import { Badge, Button, Input } from '../components/mds'
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
  const { settings, setSettings, setHouse } = useAppStore()
  const [locked, setLocked] = useState<number | null>(null)
  const [camera, setCamera] = useState(false)
  const nav = useNavigate()
  const [params] = useSearchParams()
  const returnTo = params.get('return') ?? '/report'

  const trueHeading = useMemo(() => {
    if (compass.heading == null) return null
    return settings.useTrueNorth ? ((compass.heading + settings.declination) % 360 + 360) % 360 : compass.heading
  }, [compass.heading, settings.useTrueNorth, settings.declination])
  const shown = locked ?? trueHeading
  const m = shown != null ? mountainOf(shown) : null
  const kw = shown != null ? kongwangOf(shown) : null
  const useAsFacing = () => { if (shown == null) return; setHouse({ facingBearing: Math.round(shown * 10) / 10, facingSource: 'compass' }); nav(returnTo) }

  return (
    <>
      <PageHeader title="羅盤量向" back={returnTo} />
      <Page className="space-y-5">
        <p className="text-sm text-muted-foreground">手機平放、螢幕朝上，站在大門內側，機頂對準屋外。遠離金屬門框與電器 1 公尺以上；讀數飄動時以 8 字形晃動手機校正。</p>

        {compass.status === 'need-permission' && <Button variant="brand" size="lg" className="w-full" onClick={compass.requestPermission}>啟用方向感測器</Button>}
        {compass.status === 'unsupported' && <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">這台裝置沒有方向感測器（桌機常見）。請改用手機開啟，或回上一頁直接輸入朝向度數。</div>}
        {compass.status === 'denied' && <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">感測器權限被拒絕。iOS 請到「設定」的 Safari 開啟「動作與方向存取」後重新載入。</div>}

        {camera ? <CameraCompassOverlay heading={trueHeading} onClose={() => setCamera(false)} /> : (
          <div className="flex justify-center"><CompassDial heading={trueHeading} marker={locked} size={Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 48 : 320)} /></div>
        )}

        <div className="rounded-xl border border-surface-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-mono text-4xl tabular-nums">{shown == null ? '--' : Math.round(shown)}°</div>
              {m && <div className="mt-1 text-sm">向 {m.name}山（{PALACES[m.palace].zh}宮，{PALACES[palaceOfBearing(shown!)].direction}），坐 {mountainOf(sittingOf(shown!)).name}山</div>}
            </div>
            <div className="flex flex-col items-end gap-1">
              {compass.accuracy != null && <Badge variant={compass.accuracy <= 15 ? 'good' : 'destructive'}>精度 ±{Math.round(compass.accuracy)}°</Badge>}
              {compass.status === 'active' && <Badge variant={compass.stability < 3 ? 'good' : compass.stability < 8 ? 'warning' : 'destructive'}>{compass.stability < 3 ? '讀數穩定' : compass.stability < 8 ? '略有飄動' : '飄動大，請遠離金屬並 8 字校正'}</Badge>}
              {compass.status === 'active' && <Badge variant="ghost">{compass.mode === 'flat' ? '平放：機頂方向' : '直立：鏡頭方向'}{compass.absolute ? '' : '（相對值，無磁北）'}</Badge>}
            </div>
          </div>
          {kw && <p className="mt-2 text-xs text-destructive">此角度落在{kw === 'major' ? '大空亡（八卦交界）' : '小空亡（二十四山交界）'}線上，玄空以此立向不吉，請微調門向或以相鄰山為準。</p>}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => setLocked(locked == null ? trueHeading : null)} disabled={trueHeading == null && locked == null}>{locked == null ? <Lock /> : <Unlock />}{locked == null ? '鎖定' : '解鎖'}</Button>
            <Button variant="outline" onClick={() => setCamera((c) => !c)}><Camera />{camera ? '關閉鏡頭' : '鏡頭'}</Button>
            <Button variant="brand" onClick={useAsFacing} disabled={shown == null}>設為朝向</Button>
          </div>
        </div>

        <details className="rounded-xl border border-surface-border bg-surface">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">磁偏角與真北</summary>
          <div className="space-y-3 border-t border-surface-border px-4 py-3 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-[var(--brand)]" checked={settings.useTrueNorth} onChange={(e) => setSettings({ useTrueNorth: e.target.checked })} />以真北顯示（讀數 {settings.declination >= 0 ? '+' : ''}{settings.declination.toFixed(2)}°）</label>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={decl.locate} disabled={decl.busy}><LocateFixed />{decl.busy ? '定位中' : '用 GPS 計算'}</Button>
              <Input type="number" step="0.1" className="w-24" value={settings.declination} onChange={(e) => setSettings({ declination: Number(e.target.value) || 0 })} />
            </div>
            {decl.error && <p className="text-xs text-destructive">{decl.error}</p>}
            <p className="text-xs text-muted-foreground">傳統羅盤直接用磁北定向，多數風水師沿用；要對照建築圖或地圖時才切換真北。台灣約西偏 5°。</p>
          </div>
        </details>
      </Page>
    </>
  )
}
