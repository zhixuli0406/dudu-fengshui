# 05 — iOS WebAR 替代方案調研

> 調研日期：**2026-09-05**（所有「今天」「現況」均指此日）
> 對象專案：`dudu-fengshui`（Vite 8 + React 19.2 + TypeScript 6 + three.js 0.185，純靜態 PWA，部署 GitHub Pages 子路徑 `/dudu-fengshui/`）
> 問題：Android Chrome 已用 WebXR `immersive-ar` + hit-test 完成「點地板轉角建平面圖」；**iOS Safari 不支援 WebXR**，需要替代路徑。
> 方法：一手來源（官方文件、定價頁、GitHub API、npm registry、CDN 實測位元組、規範原文）。凡推論必標記，凡查不到必列入 §8。
> 前置：iOS Safari 不支援 WebXR 的完整證據鏈已在 [`04-web-spatial-tech.md` §2.1](./04-web-spatial-tech.md) 建立，本文不重複，只做 2026-09 的複查（見 §4.5）。

---

## 0. 決策摘要

### 0.1 方案矩陣

四個維度：**免費/低成本**、**能自架（GitHub Pages）**、**能取得地板點世界座標**、**整合成本**（相對現有 174 行 WebXR 程式碼）。

| 方案 | 成本 | 自架 | 地板世界座標 | 整合成本 | 綜合 |
|---|---|---|---|---|---|
| **① Variant Launch** | **$0**（3k views/月）→ $99/月 | ✅ 任意主機，登記子網域即可 | ✅ **ARKit 原生 hit-test，直接公制** | **極低**（改 ~30 行） | **★ Tier 1** |
| **② 8th Wall（2026 開源版）** | **$0**（付費層已不存在） | ✅ 官方點名 GitHub Pages | ✅ `XrController.hitTest()`＋`scale:'absolute'`，但**需使用者校正動作** | 高（+6.6 MB、另寫一套 renderer 管線） | ★ Fallback |
| ③ 拍照＋手動點角（A4 參考物） | $0 | ✅ 純前端 | ⚠️ 單張單應性估算，精度低 | 中 | ★ 保底（無相依） |
| ④ AR.js（marker） | $0（MIT） | ✅ | ⚠️ 需印 marker 放地上，自行射線求交 | 中高 | 條件式 |
| ⑤ Zappar / Mattercraft | Dev $12.99/月**非商用**；Pro $315/月 | ❌ **自架僅 Enterprise**；`github.io` 不在授權白名單 | ⚠️ instant world tracking，非真平面 hit-test | 高（r3f wrapper **不相容 React 19**） | ✖ 排除 |
| ⑥ Onirix | 見 §3.2 | 見 §3.2 | 見 §3.2 | — | 見 §3.2 |
| ⑦ AR Quick Look / RoomPlan | $0 | — | ❌ **無任何 web 端資料回傳管道** | — | ✖ 技術上不可能 |
| ⑧ 等 iOS Safari 支援 WebXR | — | — | — | — | ✖ 見 §4.5 |

### 0.2 建議

**Tier 1：Variant Launch。** 理由不是它功能最多，是它**讓現有程式碼幾乎原封不動地在 iOS 上跑起來**——追蹤由 ARKit 負責（公制、免校正），API 是標準 WebXR（`renderer.xr` / `requestHitTestSource` / `select` 全部照用），免費層對個人專案的量級綽綽有餘。要改的只有 reference space 協商（它只給 `local`，沒有 `local-floor`）與 DOM overlay 的 React portal 化。

**Fallback：8th Wall。** 2026-02-28 之後它變成免費＋可自架，補上 Variant Launch 的死角（Safari 無痕、iOS Chrome、各種 in-app browser 都無法觸發 App Clip，但 8th Wall 只需要 `getUserMedia`）。代價是 6.6 MB 與一套獨立的 renderer 管線。

**保底：拍照＋手動點角。** 沒有任何第三方相依、任何裝置都能跑，精度換覆蓋率。風水盤位對「房間長寬比與朝向」的敏感度遠低於對「朝向角度」的敏感度，這條路的誤差多半可接受。

**明確排除：** Zappar（不能自架、React 19 不相容、非商用授權）、AR Quick Look/RoomPlan（無回傳管道）、等 Apple（見 §4.5）。

---
## 1. Variant Launch（launch.variant3d.com）

### 1.1 運作原理：不是 polyfill 模擬，是把整個網頁搬進原生 ARKit 容器

Variant Launch 的 SDK repo（MPL-2.0，公開）自述其血統：

> Based heavily on [webxr-polyfill](https://github.com/immersive-web/webxr-polyfill) and Mozilla's [WebXR iOS](https://github.com/mozilla-mobile/webxr-ios) and Mozilla's [Firefox iOS](https://github.com/mozilla-mobile/firefox-ios)
> —— [github.com/Variant3d/v-launch-sdk/README.md](https://github.com/Variant3d/v-launch-sdk)（查證 2026-09-05；該 repo 最後 push 2026-03-13）

拆解成三段就清楚了：

| 段 | 元件 | 做什麼 |
|---|---|---|
| ① 網頁端 | `https://launchar.app/sdk/v1?key=...` 這支 script | 偵測平台。iOS 且不在 Viewer 內 → 產生 Launch URL；已在 Viewer 內 → 安裝 `navigator.xr` shim |
| ② 轉場 | Apple App Clip（「Variant Launch viewer」） | Safari 彈出 App Clip 卡片，使用者點「Open」，系統下載 Variant 的 viewer |
| ③ 原生端 | viewer 內的 WKWebView + ARKit | ARKit 跑真的 SLAM，位姿與 hit-test 結果經 bridge 餵回 `navigator.xr` shim |

關鍵在於**追蹤是 ARKit 做的，不是 JS 做的**。官網原話：

> "No more low FPS & drift from Javascript tracking libraries. Industry-standard, rock-solid, world tracking via ARCore and ARKit."
> —— [launch.variant3d.com](https://launch.variant3d.com/)（2026-09-05）

對「量房間」這種需要公制精度的任務，這一點是決定性的（見 §2.5 與 §4 的對比）。

### 1.2 iOS 上可用的 WebXR features

官方 compatibility 頁列得很明確（[/docs/webxr-compatibility](https://launch.variant3d.com/docs/webxr-compatibility)，2026-09-05）：

| Feature | 狀態 | 對本專案 |
|---|---|---|
| `immersive-ar` session（位姿追蹤＋相機影像） | Release | ✅ 必要 |
| `local` reference space | Release | ⚠️ **只有 `local`，沒有 `local-floor`** |
| Hit test API | Release | ✅ 核心功能 |
| Transient hit-test API | Release | ✅ |
| Anchors | Release | ✅ 可用來釘住已放好的轉角 |
| DOM Overlay | Release | ⚠️ 是「模擬」的，有 React 陷阱（見 §1.6） |
| Marker tracking | Beta（iOS 限定） | 不需要 |
| **plane-detection** | **未列出＝不支援** | 影響：拿不到 `XRPlane` 地板多邊形 |
| **depth-sensing** | **未列出＝不支援** | 影響：無 |
| **light-estimation** | **未列出＝不支援** | 影響：無 |

官網 FAQ 同一份說法：

> "Launch currently includes camera-tracking, hit-tests, anchors and dom-overlay. We support immersive-ar sessions with the "local" reference space type."

文件另外註明：「Items listed as 'complete' are functional and the API & behaviour will not change. All other areas are subject to breaking changes.」

**`local-floor` 缺席是本專案要動的第一行 code**。現況 `src/ar/arSession.ts` 寫的是 `requiredFeatures: ['hit-test', 'local-floor']` 加 `renderer.xr.setReferenceSpaceType('local-floor')`，在 Variant Launch 下會直接 reject。修法見 §1.7。

### 1.3 整合方式

**SDK 載入** —— 一支 script，沒有 npm 套件（我查過 npm registry，`@variant3d/*`、`variant-launch`、`launch-sdk` 皆無公開發佈，2026-09-05）：

```html
<script src="https://launchar.app/sdk/v1?key=YOUR_SDK_KEY&redirect=true"></script>
```

> "Add this script tag as the first item, or as early as possible in your `<head>`. It should run before your 3D engine code if you want WebXR support available when your other code runs."
> —— [/docs/using-the-sdk](https://launch.variant3d.com/docs/using-the-sdk)

`redirect=true` 會讓 iOS 使用者一進頁面就被丟去 Launch Card。**本專案應該拿掉它**——風水 app 首頁不該一開就跳轉，要等使用者按下「開始掃描」。

我實際打了那個端點驗證它活著（2026-09-05 15:21 UTC）：

```
$ curl -sI 'https://launchar.app/sdk/v1?key=TESTKEY'
HTTP/2 200 ; content-type: application/javascript
$ curl -s 'https://launchar.app/sdk/v1?key=TESTKEY'
console.error('Variant Launch SDK Error: Project not found. Check your SDK key');
```

key 是伺服器端驗證的，錯的 key 拿到的是一支只會 `console.error` 的空 SDK。

**key 從哪來**：Launch Admin 後台 `https://launchar.app/projects`（[launch-examples README](https://github.com/Variant3d/launch-examples/blob/main/threejs/README.md)）。註冊條件官網寫得很直白：「No sales calls. No credit card required. Just 30 seconds to get a free, fully-featured Developer account.」

**網域登記** —— 這題對 GitHub Pages 很關鍵：

> "To use the Variant Launch SDK, your exact subdomain must be authorised via the Launch Admin site. For example, if your AR experience is hosted on `app.example.com`, you must add the full subdomain, not just `example.com`."
> —— [/docs/authorising-domains](https://launch.variant3d.com/docs/authorising-domains)

授權的單位是**子網域**，不是路徑。所以 `https://<user>.github.io/dudu-fengshui/` 要登記的是 `<user>.github.io`，子路徑不影響。副作用：授權一次等於把你 github.io 底下**所有**專案都開放了；如果哪天要嚴格隔離，得買自訂網域。

文件另外允許 `localhost`、內網 IP、codesandbox.io、glitch.me 免登記，但**開發機一定要有 CA 簽發的 SSL 憑證**，self-signed 不行（viewer 的 WKWebView 不讓你按「繼續前往」）。他們自己的範例專案用 `cloudflared tunnel` 解決：

```json
"serve-public": "vite & cloudflared tunnel --url http://localhost:5173"
```
—— [launch-examples/threejs/package.json](https://github.com/Variant3d/launch-examples/blob/main/threejs/package.json)

**Apple Developer 帳號** —— 不需要。App Clip 是 Variant 自己的「Variant Launch viewer」，所有客戶共用同一個 App Clip；你的網頁只是被載進那個 viewer 裡。整份文件從頭到尾沒有任何一處要求開發者提供 Apple 帳號、Team ID、或上傳 App Clip bundle，流程也不可能需要（使用者裝的是 Variant 的 viewer 而非你的 app）。
> ⚠️ 這是從流程推得的結論，官方沒有一句「你不需要 Apple Developer 帳號」的明文。標為**高信心推論**，非直接引用。

**App Clip 怎麼觸發**：

> "On Android the user can tap a button to launch your experience in standard WebXR. On iOS the user must tap an App Clip prompt to launch the experience. You control when the prompt is presented to the user."
> —— 官網 FAQ

不是自動彈出，是使用者被導到 Variant 的 Launch 頁後，Safari 顯示 App Clip 卡片，使用者點「Open App Clip」。限制官方也講得很清楚：

> "To trigger the App Clip prompt, the user must be redirected to a Variant Launch page. The user must also be in a Safari browser session to launch the app."

以及三種失敗情境（[/docs/launching/ios-browsers](https://launch.variant3d.com/docs/launching/ios-browsers)）：
- **Safari 無痕**：「App Clip Launch Card do not show up on Private sessions」→ 降級為「長按按鈕直接開 App Clip」或請使用者複製網址到一般 Safari。
- **iOS Chrome / X / Instagram / LinkedIn 的 in-app browser**：看到的是 Apple 的通用 App Clip 預覽頁，不是你的體驗。
- 官方建議：除非你願意自己寫「請用 Safari 開啟」的導流 UI，否則用預設的 `launchUrl`（Launch Card）流程，他們的卡片會幫你偵測瀏覽器並給指示。

**iOS 版本需求**：官方文件**沒有寫任何最低 iOS 版本**（我逐頁看過 docs 全部 15 頁）。可確定的下界是 App Clip 本身的下界——Apple 官方 API 中繼資料標 `introducedAt: "14.0"`（iOS / iPadOS / Mac Catalyst），來源 [developer.apple.com/tutorials/data/documentation/appclip.json](https://developer.apple.com/tutorials/data/documentation/appclip.json)（2026-09-05）。實際可用版本應該更高（ARKit 版本、viewer 的 deployment target），**未查證**。

另一個 Apple 的行為要記住：「the system removes an App Clip from a device after a period of inactivity」（同上來源）。使用者隔幾週再回來量第二間房，可能要重下載一次 viewer。

### 1.4 定價（2026-09-05 抓取自 [launch.variant3d.com](https://launch.variant3d.com/) 定價區塊）

| 方案 | 月費 | 年費 | 觀看數 | Launch Card | 支援 |
|---|---|---|---|---|---|
| **Developer** | **$0** | — | **3k views/month** | Default（Variant 品牌） | Community Discord |
| Basic | $99 / project | $999 / project | Unlimited | Default | Community Discord |
| Pro | $199 / project | $1999 / project | Unlimited | **Fully customizable** | Priority Email |

要點：

- **免費方案存在，而且是「fully-featured」**——功能沒閹割，只卡在 3,000 views/月。官網 slogan 是「no cost per-view」「Get started for free, then decide your project plan based on the needs & duration of your project.」
- **沒有浮水印**。免費與 Basic 的差別是那張 App Clip 卡片長 Variant 的樣子（"Default Launch Card"），只有 Pro 能完全自訂。AR 體驗本身（相機畫面、你的 3D 內容）沒有任何 Variant 標記。
- 計價單位是 **project**，不是網域也不是 seat。
- **「view」的精確定義、超量後的行為（擋掉？超收？降速？）官網與 docs 都沒寫** → 列入未驗證。以個人專案的量級（一天 100 次都算多）3k/月綽綽有餘。

### 1.5 與 three.js `renderer.xr` 的相容性：完全相容，這是最大賣點

他們自己的 three.js 範例就是**原封不動的 three.js 官方 `webxr_ar_hittest` 範例**——`ARButton.createButton`、`renderer.xr.enabled = true`、`session.requestHitTestSource({space: viewerSpace})`、`frame.getHitTestResults()`、`renderer.xr.getController(0)` 的 `select` 事件，一行沒改：

```js
// github.com/Variant3d/launch-examples/blob/main/threejs/src/main.js（節錄，2026-09-05）
renderer.xr.enabled = true
document.body.appendChild(ARButton.createButton(renderer, {
  requiredFeatures: ["local", "hit-test", "dom-overlay"],
  domOverlay: { root: document.querySelector("#overlay") },
}))
...
session.requestReferenceSpace("viewer").then((refSpace) =>
  session.requestHitTestSource({ space: refSpace }).then((s) => { hitTestSource = s }))
```

範例本身是 Vite 專案，而且 package.json 裡就有 `"subdir-build": "vite build --base=/threejs/"`——**他們自己就在測子路徑部署**。這對 GitHub Pages 的 `/dudu-fengshui/` 是好消息。

專案現有的 `src/ar/arSession.ts` 用的是同一套 API，理論上只要改 reference space 就能跑（見 §1.7）。

### 1.6 已知問題與陷阱

| 問題 | 官方原文 | 對本專案的影響 |
|---|---|---|
| **DOM Overlay 是模擬的，會跟 React 打架** | "DOM Overlay support is emulated in Variant Launch by hiding all other elements on the page other than the DOM Overlay root you specify. For this reason, its best to use a root element that isn't directly created or managed by frameworks like react or vue. Instead consider adding your managed framework component as a child of the DOM Overlay root, or using portals." | ⚠️ **直接命中**。`ScanPage.tsx` 的 overlay root 是 React 的 `<div ref={overlay}>`。要改成 React 外的固定節點 + portal，見 §1.7 |
| 相機畫面被網頁內容蓋住 | "The camera view is currently rendered behind the browser on iOS. This means it can be blocked by web content - ensure that all page elements and the canvas itself are set to transparent." | ⚠️ Tailwind 在 `body` 上鋪了 `theme_color: #1c1917` 系的底色，進 AR 前要把 `body`/`#root` 背景設成 transparent |
| 同網域連結會留在 viewer 內 | 預設同網域連結開在 Launch viewer，跨網域開 Safari；可用 `?vl_link=external` / `internal` 覆寫 | react-router 的 SPA 導航不受影響（沒有真正的 navigation），但若有 `<a href>` 外連要留意 |
| 追蹤品質事件 | `document.addEventListener('vlaunch-ar-tracking', h)`，state 對應 ARKit 的 `normal` / `not-available` / `limited-excessive-motion` / `limited-initializing` / `limited-insufficient-features` / `limited-relocalizing` | ✅ **應該用**。量房間最常見的失敗是「牆面純白無特徵」，`limited-insufficient-features` 可以直接轉成「請對準有紋理的地面／踢腳線」提示 |
| PWA standalone（加到主畫面）能不能用 | **官方沒說** | ⚠️ App Clip 卡片是 Safari 的行為；standalone PWA 不是 Safari 分頁。合理推測**不能**在 standalone 內觸發 App Clip。列入未驗證，需實機測 |
| 專案活躍度 | blog 最後一篇 2023-08-08；但 SDK repo 2026-03-13 有 push、docs 有一頁專為 AI coding agent 寫的說明（明顯是近期產物）、SDK 端點今天仍正常服務 | ⚠️ 產品仍在營運，但對外行銷停擺三年。單一供應商風險要計入 |

### 1.7 最小整合程式碼（針對本專案現況）

**(a) `index.html`** —— 不要加 `redirect=true`，我們要自己控制時機：

```html
<!-- index.html：放在 <head> 最前面，早於任何 module script -->
<script src="https://launchar.app/sdk/v1?key=%VITE_VLAUNCH_KEY%"></script>
```

Vite 的 HTML 可以用 `%ENV%` 佔位，配 `.env`：`VITE_VLAUNCH_KEY=xxxx`。SDK key 是公開可見的（本來就寫在 HTML 裡），不是機密，但仍建議走 env 以便切換 dev/prod 專案。

**(b) 新增 `src/ar/variantLaunch.ts`**：

```ts
/**
 * Variant Launch bridge: gives iOS Safari a real WebXR immersive-ar session
 * by handing the page off to Variant's ARKit-backed App Clip viewer.
 * No-ops everywhere WebXR already works (Android Chrome, Quest, desktop emulators).
 */

interface VLaunchDetail {
  launchRequired: boolean
  webXRStatus: 'unsupported' | 'launch-required' | 'supported'
  launchUrl: string
  directAppClipUrl: string
}

declare global {
  interface Window {
    VLaunch?: { getLaunchUrl: (targetUrl: string) => string }
  }
}

let cached: VLaunchDetail | null = null
let waiter: Promise<VLaunchDetail | null> | null = null

/** Resolves once the Launch SDK reports in, or null if the SDK never loaded (blocked, offline, no key). */
export function vlaunchReady(timeoutMs = 3000): Promise<VLaunchDetail | null> {
  if (cached) return Promise.resolve(cached)
  if (waiter) return waiter
  waiter = new Promise((resolve) => {
    const done = (d: VLaunchDetail | null) => { cached = d; resolve(d) }
    const onInit = (e: Event) => {
      done((e as CustomEvent<VLaunchDetail>).detail)
      window.removeEventListener('vlaunch-initialized', onInit)
    }
    window.addEventListener('vlaunch-initialized', onInit)
    setTimeout(() => { window.removeEventListener('vlaunch-initialized', onInit); done(null) }, timeoutMs)
  })
  return waiter
}

export type ARAvailability =
  | { kind: 'ready' }                       // navigator.xr works right now
  | { kind: 'needs-launch'; launchUrl: string } // iOS: hand off to the App Clip viewer
  | { kind: 'unsupported' }

/**
 * Single entry point for "can we do AR here?".
 * Call this instead of isARSupported() on the scan page.
 */
export async function checkAR(): Promise<ARAvailability> {
  // 1. Native WebXR (Android Chrome, Samsung Internet, Quest, visionOS-if-ever).
  if (navigator.xr) {
    try {
      if (await navigator.xr.isSessionSupported('immersive-ar')) return { kind: 'ready' }
    } catch { /* fall through */ }
  }
  // 2. Variant Launch: only meaningful on iOS, and only outside the viewer.
  const detail = await vlaunchReady()
  if (detail?.launchRequired) {
    // getLaunchUrl lets us land the user straight back on the scan page inside the viewer.
    const target = new URL(window.location.href)
    target.searchParams.set('autostart', '1')
    const url = window.VLaunch?.getLaunchUrl(target.toString()) ?? detail.launchUrl
    return { kind: 'needs-launch', launchUrl: url }
  }
  return { kind: 'unsupported' }
}

/** ARKit tracking-quality feed; only fires inside the Launch viewer. */
export type TrackingState =
  | 'normal' | 'not-available' | 'limited-excessive-motion'
  | 'limited-initializing' | 'limited-insufficient-features' | 'limited-relocalizing'

const TRACKING_HINT: Record<TrackingState, string> = {
  'normal': '',
  'not-available': '追蹤尚未啟動',
  'limited-excessive-motion': '手機移動太快，請放慢',
  'limited-initializing': '正在建立空間定位，請緩慢平移手機',
  'limited-insufficient-features': '畫面特徵不足，請對準地板或有紋理的地方',
  'limited-relocalizing': '正在重新定位，請回到剛才的位置',
}

export function onTracking(cb: (hint: string) => void): () => void {
  const h = (e: Event) => {
    const s = (e as CustomEvent<{ state: TrackingState }>).detail.state
    cb(TRACKING_HINT[s] ?? '')
  }
  document.addEventListener('vlaunch-ar-tracking', h)
  return () => document.removeEventListener('vlaunch-ar-tracking', h)
}
```

**(c) 改 `src/ar/arSession.ts`** —— reference space 要退讓。Variant Launch 只給 `local`，而 `local` 的原點在 session 開始時的**裝置位置**（約腰／胸高），不是地板；`local-floor` 的原點才在地板。量房間只需要地板點的相對位置，所以把絕對高度換成「用第一個 hit-test 結果當地板高度」即可：

```ts
// 之前
const session = await xr.requestSession('immersive-ar', {
  requiredFeatures: ['hit-test', 'local-floor'],
  ...
})
renderer.xr.setReferenceSpaceType('local-floor')

// 之後：優先 local-floor，Variant Launch 上自動退到 local
const REF: XRReferenceSpaceType[] = ['local-floor', 'local']
let session: XRSession | null = null
let refType: XRReferenceSpaceType = 'local-floor'
for (const r of REF) {
  try {
    session = await xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test', r],
      optionalFeatures: ['dom-overlay', 'anchors', 'plane-detection', 'depth-sensing'],
      domOverlay: { root: overlayRoot },
    } as XRSessionInit)
    refType = r
    break
  } catch { /* try next */ }
}
if (!session) throw new Error('無法啟動 AR，請確認相機權限')
renderer.xr.setReferenceSpaceType(refType)

// 之後在 arPointsToPlan 之前，把 y 正規化成「相對地板」：
// local 空間下 y=0 是開場時的裝置高度，不是地板；用所有落點 y 的中位數當地板。
const floorY = median(pts.map((p) => p.y))
const flat = pts.map((p) => ({ ...p, y: p.y - floorY }))
```

平面座標（`arPointsToPlan` 只取 x／z）本來就不受影響——**x/z 在 `local` 和 `local-floor` 下是同一組數字，只有 y 的原點不同**。所以實際要改的只有 reference space 協商，以及任何用到絕對 y 的地方（目前只有繪製連線時的 `p.y + 0.005`，不受影響）。

**(d) DOM overlay root 移出 React**：

```html
<!-- index.html，放在 #root 之外 -->
<div id="ar-overlay"></div>
```

```tsx
// ScanPage.tsx
import { createPortal } from 'react-dom'

const overlayRoot = document.getElementById('ar-overlay')!
// startARSession(overlayRoot, ...) ← 傳這個穩定節點，不是 React 管的 div
// UI 用 portal 掛進去：
return <>
  {/* ...一般頁面 UI... */}
  {running && createPortal(<ScanHud pts={pts} status={status} onFinish={finish} />, overlayRoot)}
</>
```

**(e) 進 AR 前把背景透明化**（對應「camera view rendered behind the browser」）：

```ts
const prev = { body: document.body.style.background, root: document.getElementById('root')!.style.background }
document.body.style.background = 'transparent'
document.getElementById('root')!.style.background = 'transparent'
// session.addEventListener('end', () => { 還原 prev })
```

---

## 2. 8th Wall（Niantic Spatial）—— 2026 年整個變了

### 2.1 ★ 最大變化：託管平台已收攤，產品開源且免費

這一節請整段讀完，因為它推翻了所有 2025 年以前的資料。

`www.8thwall.com` 現在 **302 導向 `8thwall.org`**（我今天實測，`curl -sL -o /dev/null -w '%{url_effective}'`）。新首頁第一句話是：

> "**8th Wall is now open source** — Everything you need to build 3D experiences and WebAR, now free for everyone."
> —— [8thwall.org](https://8thwall.org/)（2026-09-05）

官方 FAQ 的三個關鍵問答（逐字）：

> **Is there a paid tier?**
> "No. All paid subscriptions ended on February 28, 2026 when the hosted platform was retired. The open source tools and distributed engine binary are free to use."
>
> **Do I need an account?**
> "No account is required. Simply download the tools from GitHub and start building. The hosted platform has been retired, so there's no login or account management needed."
>
> **Is everything fully open source?**
> "The XR Engine is distributed as a binary — free to use, including for commercial projects under a limited use license. […] Everything else (Image Targets, Face Effects, Sky Effects, utilities, example projects) is fully open source under the MIT License."

時間表（[/docs/migration/faq](https://8thwall.org/docs/migration/faq)）：

| 日期 | 發生什麼 |
|---|---|
| 2026-02-28 | 平台存取終止。無法登入、建立、編輯、發佈、匯出專案。**所有付費訂閱結束** |
| 2026-02-28 ~ 2027-02-28 | 既有託管專案維持上線但鎖定 |
| 2027-02-28 之後 | 託管服務下線，專案資料依保留政策刪除 |

程式碼實況（GitHub API 查證 2026-09-05）：

- `github.com/8thwall/8thwall` — MIT，**466 stars**，建立於 2026-02-24，**今天（2026-09-05）仍有 push**。活的。
- 引擎二進位走 npm：`@8thwall/engine-binary@1.0.0`，發佈 2026-04-03。

**歷史包袱清乾淨了**：以前的 app key（`apps.8thwall.com/xrweb?appKey=...`）、網域鎖定、每月 view 配額、必須用他們的 Cloud Editor —— **全部沒有了**。

### 2.2 定價與授權

**價格：$0**。沒有任何付費層級可買（平台已關）。

但「免費」不等於「隨便用」。引擎二進位走的是 [XR Engine License Agreement](https://github.com/8thwall/engine/blob/main/LICENSE)（Niantic Spatial, 2026），關鍵在 §1.2：

> "Licensee may not utilize the Software or exercise the rights granted in this Section 1 in connection with any product or service: (1) which is offered for a fee or other consideration, **and** (2) whose value derives, entirely or substantially, from the functionality of the Software."

官方自己的白話版（migration FAQ）：

> **Can I use the engine in a commercial product?**
> "Yes, as long as the value of your product does not derive entirely or substantially from the engine itself.
> ✅ Using the engine as one component of a broader application or experience is permitted
> ❌ Selling the engine itself or an engine-based toolkit is not permitted
> […] In short: if you're selling the experience, not the engine, your use is permitted."

對嘟嘟風水的判讀：現在免費 → 無條件可用。若哪天收費，AR 量房只是整包風水分析的一個元件（八宅、玄空、形勢才是價值主體），**看起來落在允許範圍**，但這是法律灰帶，真要商業化前建議寫信問 Niantic Spatial 或請律師看。不要憑我這段話下商業決定。

**歸屬（attribution）是強制的**，不過網頁專案的門檻很低（[/docs/open-source](https://8thwall.org/docs/open-source)）：

> "As long as these unmodified files are included in your project as-is and are visible with browser devtools, you are in compliance by including both a copyright notice and the license text."

也就是**原封不動地部署 `xr.js`（檔頭已含 Niantic 版權聲明）就算合規**。保險起見可以再在 `index.html` 加官方提供的註解：

```html
<!-- This product includes the XR Engine software developed by Niantic Spatial, Inc.
 Copyright © 2026 Niantic Spatial, Inc. All rights reserved.
 License: https://github.com/8thwall/engine/blob/main/LICENSE -->
```

**沒有視覺浮水印**。dist 裡雖然有 `resources/powered-by.svg`（6 KB），但文件裡的合規要求只講版權聲明與授權文字，沒有要求顯示 logo。

**MIT 版引擎不能用**：官方明說「SLAM is **not** included in the open source release and remains available only through the Distributed Engine Binary」。開源那份只有 Face Effects / Image Targets / Sky Effects。要世界追蹤就一定要用那個限制授權的 binary。

### 2.3 能不能「點地板放標記、拿世界座標」？能，而且有公制模式

**hit-test 等價 API**（[/docs/api/engine/xrcontroller/hittest](https://8thwall.org/docs/api/engine/xrcontroller/hittest)）：

```js
XrController.hitTest(X, Y, includedTypes = [])
// X, Y 為 0~1 的畫面正規化座標，(0,0) 左上、(1,1) 右下
// 回傳 [{ type, position: {x,y,z}, rotation: {x,y,z,w}, distance }]
// type ∈ 'FEATURE_POINT' | 'ESTIMATED_SURFACE' | 'DETECTED_SURFACE' | 'UNSPECIFIED'
```

官方範例：

```js
const hitTestHandler = (e) => {
  const x = e.touches[0].clientX / window.innerWidth
  const y = e.touches[0].clientY / window.innerHeight
  const hitTestResults = XR8.XrController.hitTest(x, y, ['FEATURE_POINT'])
}
```

功能上等價於 WebXR 的 `frame.getHitTestResults()`——甚至多給了 `type` 讓你知道這個點是真的落在偵測到的平面上（`DETECTED_SURFACE`）還是只是特徵點外插（`FEATURE_POINT`），對量測品質把關反而更好。

**公制尺度**（[/docs/api/engine/xrcontroller/configure](https://8thwall.org/docs/api/engine/xrcontroller/configure)）：

```js
XR8.XrController.configure({ scale: 'absolute' })
```
> "`absolute` will return the camera, image targets, etc **in meters**. […] The y-position will depend on the camera's physical height from the ground plane."

**但 absolute scale 要使用者做校正動作**。官方的 Coaching Overlay 預設提示字就是 `'Move device forward and back'`（[/docs/engine/guides/coaching-overlays](https://8thwall.org/docs/engine/guides/coaching-overlays)），還特別註明「Coaching Overlay events are only fired when `scale` is set to `absolute`」。

這是單目 VIO 估尺度的必然代價：8th Wall 是自己用 WASM 跑 SLAM，得靠使用者前後推拉手機產生視差才能解出真實比例。Variant Launch 那條路是 ARKit 直接給公制，**不需要任何校正動作**。對「量房間」這件事，這是兩者最實質的差距。

> ⚠️ 8th Wall absolute scale 的**實際量測誤差官方沒有公佈任何數字**，我也沒找到可信的第三方實測。列入未驗證。

### 2.4 整合到 Vite / React / three.js，能不能自架在 GitHub Pages？

**能自架，官方文件甚至點名 GitHub Pages。** [/docs/getting-started/publishing](https://8thwall.org/docs/getting-started/publishing) 的「Self-Hosting your project」列了 Netlify Drop、Cloudflare Pages、AWS Amplify、Neocities，然後：

> "**GitHub Pages** — GitHub Pages publishes static files from a repository and is a common 'set it and forget it' option."

**載入方式**兩種（[/docs/engine/overview](https://8thwall.org/docs/engine/overview)）：

```html
<!-- CDN -->
<script src="https://cdn.jsdelivr.net/npm/@8thwall/engine-binary@1/dist/xr.js"
        async crossorigin="anonymous" data-preload-chunks="slam"></script>
```

```bash
# npm + 把 dist 複製進自己的 dist（Vite 用 vite-plugin-static-copy）
npm install @8thwall/engine-binary
```
```js
import { XR8Promise } from '@8thwall/engine-binary'
XR8Promise.then((XR8) => XR8.XrController.configure({}))
```

**體積**（jsDelivr API 實測位元組，2026-09-05）：

| 檔案 | 大小 |
|---|---|
| `dist/xr.js` | **1,036,695 B（1.04 MB）** |
| `dist/xr-slam.js` | **5,538,007 B（5.54 MB）** |
| `dist/resources/media-worker.js` | 4,995,543 B（錄影才需要） |
| `dist/xr-face.js` | 7,676,552 B（不需要） |

要世界追蹤就得載 `xr.js` + `xr-slam.js` = **約 6.6 MB**（未壓縮；gzip 後仍是數 MB 級）。對照組：Android 原生 WebXR 是 0 bytes，Variant Launch 的 SDK 是幾十 KB。這是「過重」論點的實際數字。

**three.js 整合是另一套 pipeline，不是 `renderer.xr`**：

```js
XR8.addCameraPipelineModule(XR8.XrController.pipelineModule())     // 6DoF 追蹤
XR8.addCameraPipelineModule(XR8.GlTextureRenderer.pipelineModule()) // 相機影像畫到 canvas
XR8.addCameraPipelineModule(XR8.Threejs.pipelineModule())           // 建立 three.js scene/camera/renderer
XR8.addCameraPipelineModule({ name: 'fengshui', onStart: ..., onUpdate: ... })
XR8.run({ canvas })
const { scene, camera, renderer } = XR8.Threejs.xrScene()
```

注意 [/docs/api/engine/threejs/pipelinemodule](https://8thwall.org/docs/api/engine/threejs/pipelinemodule) 的原文：「**onStart, a three.js renderer and scene are created and configured**」——**8th Wall 自己 new 一個 renderer**。你不能把現有的 `renderer.xr` 那套接過去，只能透過 `xrScene()` 拿它建好的物件。

換算成本專案的工作量：`src/ar/arSession.ts` 那 174 行要**再寫一份平行實作**（不同的 session 生命週期、不同的 hit-test 呼叫、不同的 reticle 更新時機、自己處理 tap→normalized coords）。Variant Launch 那條路只要改 reference space 協商 + overlay portal，大約 30 行。

### 2.5 「只是要在 iOS 量地板多邊形」，8th Wall 過重嗎？

過重。四個具體理由：

1. **6.6 MB 的 WASM/JS**，對照 Variant Launch 幾十 KB + 一次 App Clip 下載。
2. **尺度要使用者校正**（前後推拉手機），而 ARKit 路線直接給公制。量測 app 的第一要務就是尺度可信。
3. **要寫第二套 renderer 邏輯**，現有 174 行 WebXR 程式碼一行都用不上。
4. **維護承諾寫死了**：官方 FAQ 白紙黑字「The engine binary will be maintained **through March 2026** to support a stable transition.」雖然 npm 上的 1.0.0 是 2026-04-03 發的（已超過那個日期），但官方沒有更新過這句承諾。長期依賴一個宣告只維護到某月的閉源二進位，風險要自己承擔。

8th Wall 現在真正的強項在別的地方：Image Targets（辨識實體圖卡）、Face Effects、Sky Effects、以及**在完全沒有 WebXR 也沒有 App Clip 的環境**（iOS Chrome、各種 in-app browser、Safari 無痕）仍能跑 AR——因為它只需要 `getUserMedia`。這正好是 Variant Launch 的死角，所以它是很好的**第二 fallback**，不是第一選擇。
