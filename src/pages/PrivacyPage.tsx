import { Page, PageHeader } from '../components/AppShell'
import { Button } from '../components/mds'
import { useAppStore } from '../store/useAppStore'

export function PrivacyPage() {
  const resetAll = useAppStore((s) => s.resetAll)
  const consentedAt = useAppStore((s) => s.consentedAt)
  return (
    <>
      <PageHeader title="隱私與免責聲明" back />
      <Page className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-base font-medium">我們蒐集什麼</h2>
          <p className="mt-2 text-muted-foreground">本工具是純前端網頁，沒有後端伺服器、沒有帳號、沒有分析追蹤碼。你輸入的所有內容都只存在你這台裝置的瀏覽器儲存空間（localStorage）：</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>家庭成員的稱呼、出生日期與性別（用於計算命卦）</li>
            <li>房屋朝向、建成年、取向設定</li>
            <li>你繪製的平面圖、匯入的照片縮圖（縮小後的 JPEG，僅在本機）</li>
            <li>外局問卷的答案</li>
            <li>定位（僅在你按下「用 GPS 自動計算」時取得一次，用來算磁偏角；只存經緯度到小數第三位）</li>
          </ul>
          <p className="mt-2 text-muted-foreground">清除瀏覽器資料或按下方「刪除全部資料」即可完全移除。</p>
        </section>
        <section>
          <h2 className="text-base font-medium">感測器、相機與 AR</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>羅盤使用裝置方向感測器，只在羅盤頁與掃描頁運作，離開頁面即停止。</li>
            <li>相機畫面只在螢幕上即時顯示，不錄製、不儲存、不上傳。</li>
            <li>Android Chrome 的 AR 由瀏覽器原生 WebXR 提供，資料不離開裝置。</li>
            <li>iPhone 的 AR 需要第三方服務 <span className="text-foreground">Variant Launch</span>（Variant 3D Ltd）：按下「在 iPhone 啟動 AR」後，頁面會在其 App Clip 檢視器內開啟，該服務會記錄瀏覽次數以計算免費額度，並可能依其隱私政策蒐集裝置資訊。若不想使用，請改用「底圖描圖」或手繪。</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-medium">網站託管</h2>
          <p className="mt-2 text-muted-foreground">本站部署於 GitHub Pages。GitHub 可能依其政策記錄存取紀錄（IP、瀏覽器資訊）。本站本身不設任何 cookie。</p>
        </section>
        <section>
          <h2 className="text-base font-medium">免責聲明</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>本工具依傳統典籍與公開資料整理八宅、玄空飛星、形勢派等規則，屬文化與民俗參考，不具科學驗證。</li>
            <li>各派說法互有出入，介面標示「各派有別」者表示沒有單一正確答案；設定不同判法會得到不同結果。</li>
            <li>分數與建議不構成醫療、法律、財務、建築或工程建議。裝修、動土、購屋等決定請諮詢合格專業人士。</li>
            <li>羅盤讀數受金屬與電器干擾，AR 量測有誤差；重要尺寸請以實際丈量為準。</li>
            <li>本站以現狀提供，作者不對使用結果負任何責任。</li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-medium">資料來源</h2>
          <p className="mt-2 text-muted-foreground">規則與表格的出處、可信度分級與各派分歧，完整記錄在專案的調研文件（GitHub：zhixuli0406/dudu-fengshui，docs/research）。</p>
        </section>
        <section className="rounded-xl border border-surface-border bg-surface p-4">
          <div className="text-sm font-medium">刪除全部資料</div>
          <p className="mt-1 text-xs text-muted-foreground">移除這台裝置上的成員、房屋、平面圖、照片與問卷答案。{consentedAt && `（同意時間：${new Date(consentedAt).toLocaleString('zh-TW')}）`}</p>
          <Button variant="destructive" className="mt-3" onClick={() => { if (confirm('確定刪除本機所有資料？此動作無法復原。')) { resetAll(); location.href = import.meta.env.BASE_URL } }}>刪除全部資料</Button>
        </section>
      </Page>
    </>
  )
}
