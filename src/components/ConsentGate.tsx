import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { Button } from './mds'

/** First-run consent: shown until the user accepts the data notice. */
export function ConsentGate() {
  const consented = useAppStore((s) => s.consentedAt)
  const setConsent = useAppStore((s) => s.setConsent)
  const [open, setOpen] = useState(!consented)
  if (!open || consented) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/30 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className="sheet-enter w-full max-w-md rounded-2xl bg-surface-raised p-5 shadow-[var(--floating-shadow)]">
        <h2 id="consent-title" className="text-base font-medium">使用前請先了解</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">資料留在你的裝置。</span>出生日期、朝向、平面圖與照片都只存在瀏覽器裡，沒有伺服器，不會上傳。</li>
          <li><span className="font-medium text-foreground">感測器與相機只在你按下按鈕時使用。</span>羅盤、定位、相機、AR 都需要你逐次授權，且不會錄製或保存影像。</li>
          <li><span className="font-medium text-foreground">iOS AR 會經過第三方。</span>若使用「在 iPhone 啟動 AR」，頁面會交給 Variant Launch 的 App Clip 開啟，該服務會計算瀏覽次數。</li>
          <li><span className="font-medium text-foreground">這是文化參考，不是專業建議。</span>各派風水說法互有出入；重大裝修、健康或財務決定請諮詢專業人士。</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">完整說明見<Link to="/privacy" className="text-brand underline underline-offset-2" onClick={() => setOpen(false)}>隱私與免責聲明</Link>。</p>
        <div className="mt-4 flex gap-2">
          <Button variant="brand" size="lg" className="flex-1" onClick={() => { setConsent(); setOpen(false) }}>我了解，開始使用</Button>
        </div>
      </div>
    </div>
  )
}
