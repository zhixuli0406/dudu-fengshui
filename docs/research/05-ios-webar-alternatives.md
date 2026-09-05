# 05 — iOS WebAR 替代方案調研

> 調研日期：**2026-09-05**（所有「今天」「現況」均指此日）
> 對象專案：`dudu-fengshui`（Vite 8 + React 19.2 + TypeScript 6 + three.js 0.185，純靜態 PWA，部署 GitHub Pages 子路徑 `/dudu-fengshui/`）
> 問題：Android Chrome 已用 WebXR `immersive-ar` + hit-test 完成「點地板轉角建平面圖」；**iOS Safari 不支援 WebXR**，需要替代路徑。
> 方法：一手來源（官方文件、定價頁、GitHub API、npm registry、CDN 實測位元組、規範原文）。凡推論必標記，凡查不到必列入 §8。
> 前置：iOS Safari 不支援 WebXR 的完整證據鏈已在 [`04-web-spatial-tech.md` §2.1](./04-web-spatial-tech.md) 建立，本文不重複，只做 2026-09 的複查（見 §3.5）。

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
| ⑧ 等 iOS Safari 支援 WebXR | — | — | — | — | ✖ 見 §3.5 |

### 0.2 建議

**Tier 1：Variant Launch。** 理由不是它功能最多，是它**讓現有程式碼幾乎原封不動地在 iOS 上跑起來**——追蹤由 ARKit 負責（公制、免校正），API 是標準 WebXR（`renderer.xr` / `requestHitTestSource` / `select` 全部照用），免費層對個人專案的量級綽綽有餘。要改的只有 reference space 協商（它只給 `local`，沒有 `local-floor`）與 DOM overlay 的 React portal 化。

**Fallback：8th Wall。** 2026-02-28 之後它變成免費＋可自架，補上 Variant Launch 的死角（Safari 無痕、iOS Chrome、各種 in-app browser 都無法觸發 App Clip，但 8th Wall 只需要 `getUserMedia`）。代價是 6.6 MB 與一套獨立的 renderer 管線。

**保底：拍照＋手動點角。** 沒有任何第三方相依、任何裝置都能跑，精度換覆蓋率。風水盤位對「房間長寬比與朝向」的敏感度遠低於對「朝向角度」的敏感度，這條路的誤差多半可接受。

**明確排除：** Zappar（不能自架、React 19 不相容、非商用授權）、AR Quick Look/RoomPlan（無回傳管道）、等 Apple（見 §3.5）。

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

---

## 3. 其他方案

### 3.1 Zappar / Mattercraft（Universal AR SDK）—— 排除

三個獨立的硬阻擋，任一個都足以出局：

| 阻擋 | 細節 |
|---|---|
| **不能自架** | 自架（self-hosting）僅開放給 Enterprise 方案。GitHub Pages 的 `github.io` 不在授權網域白名單內 |
| **授權與價格不合** | Developer $12.99/月 **僅限非商用**；商用要 Pro $315/月 |
| **React 19 相容性** | `@zappar/zappar-react-three-fiber@4.3.0`（2025-12-16）的 `dependencies` 硬釘 `"zustand": "4.1.1"`，與本專案的 `zustand ^5.0.8` 衝突；peerDeps 雖寫 `react: ">=18.0"`，但 wrapper 是對著 R3F v8 寫的，而 React 19 需要 R3F v9 |

`@zappar/zappar-threejs@4.3.0`（MIT，200 KB，2025-12-16）本身是可以裸用的，但 Zappar 的世界追蹤是 **instant world tracking**——把內容放在鏡頭前方一個固定距離的假想平面上，**不是真正的平面偵測 hit-test**。要「點地板轉角取世界座標」，這條路先天就不對。

> npm 版本與相依資料為本人 2026-09-05 直接查 registry 所得；定價、自架限制與白名單為本次調研的另一路查證結果。

### 3.2 Onirix

`onirix.com/pricing` 的價格數字是 JS 動態渲染的，靜態抓不到 → **確切 2026 價格未查證**。但定價頁的靜態文案已經透露結構性問題：

> "Starter licence for **testing, internal development and pre-sales demos**. Professional and Enterprise licences for **commercial**, branding and end-customer use."

也就是免費／入門層**不得商用**，跟 Zappar 同一個形狀。另外定價表把「Custom domains」「Onirix hosting (Studio views)」列為分層計價項目，代表交付偏向他們託管、自訂網域要加錢。

以本專案的四個維度（免費、自架、地板世界座標、低整合成本）來看，它在前兩項就已經比 Variant Launch 和 8th Wall 差，**沒有繼續深挖的價值**。列為不推薦，細部功能未進一步查證。

### 3.3 AR.js —— 只有 marker/影像/GPS，沒有 SLAM 平面偵測

- repo：[AR-js-org/AR.js](https://github.com/AR-js-org/AR.js)，**MIT**，5,985 stars，最後 push 2026-06-21
- 最新 release **3.4.8（2026-03-16）**；npm `@ar-js-org/ar.js@3.4.8`
- 官方 repo description 一字不差：「**Image tracking, Location Based AR, Marker tracking.** All on the Web.」

三種模式**都不是**markerless SLAM。AR.js 沒有平面偵測，也拿不到「使用者站在房間中央、點四個角落」所需的世界座標。直接回答問題：**不適用於自由量房**。

**但 marker 變體值得認真考慮，作為完全免費、零廠商相依的保底。** 邏輯是這樣：

在地板上放一張印好的 A4 marker（已知實際尺寸），AR.js/jsartoolkit 會給出 marker 相對相機的完整位姿矩陣，這個矩陣**自帶公制尺度**（因為你告訴它 marker 有多大）。有了位姿就能定義地板平面，再把使用者的螢幕點擊轉成一條射線，與該平面求交：

```ts
// 概念（three.js）：marker 已定義地板平面，把 tap 打到平面上
const ndc = new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1)
raycaster.setFromCamera(ndc, camera)
// markerRoot 的 XZ 平面就是地板；法線為 markerRoot 的 +Y
const floor = new THREE.Plane().setFromNormalAndCoplanarPoint(
  new THREE.Vector3(0, 1, 0).applyQuaternion(markerRoot.quaternion),
  markerRoot.position)
const hit = new THREE.Vector3()
raycaster.ray.intersectPlane(floor, hit)   // hit = 地板上的世界座標（公尺）
```

這段射線求交**不在 AR.js 的 API 裡，要自己寫**（上面就是全部了，並不長）。

實務限制很硬：**marker 必須全程留在畫面裡**。房間對角超過 3~4 公尺後，marker 在畫面中太小就會追丟，量大房間會很痛苦。定位成「小房間可用、且完全不想依賴任何第三方服務」時的選項。

### 3.4 Apple AR Quick Look / RoomPlan —— 技術上不可能回傳資料

**AR Quick Look：唯一的 web 回傳管道只有一個布林事件。**

Apple 官方文件《Adding an Apple Pay Button or a Custom Action in AR Quick Look》把整條回傳路徑寫得很死：

> "When the user taps the Apple Pay button or custom action button, WebKit sends a DOM message to the `<a>` element of your code that references the 3D asset."

```js
const linkElement = document.getElementById("ar-link");
linkElement.addEventListener("message", function (event) {
  if (event.data == "_apple_ar_quicklook_button_tapped") {
    // Handle the user tap.
  }
}, false);
```
—— [developer.apple.com/documentation/arkit/adding-an-apple-pay-button-or-a-custom-action-in-ar-quick-look](https://developer.apple.com/documentation/arkit/adding-an-apple-pay-button-or-a-custom-action-in-ar-quick-look)（2026-09-05）

能回來的只有 `_apple_ar_quicklook_button_tapped` 這個固定字串。**沒有量測值、沒有點擊位置、沒有幾何、沒有任何 payload。** 網頁→Quick Look 方向可以用 URL 參數（`#callToAction=`、`#custom=`、`#applePayButtonType=`…），Quick Look→網頁方向只有那一個 bit。

⇒ 用 AR Quick Look 量房間再把結果送回網頁，**在 API 層面就不存在**。

**RoomPlan：原生 only。** 它是 iOS 的 Swift framework，沒有任何 web 綁定。要用只有一條路：使用者用第三方 RoomPlan app 掃描 → 匯出檔案 → 在我們的網頁用 `<input type="file">` 讀進來。

> ⚠️ 「哪些 app 有匯出、匯出什麼格式」本次**未查證**（見 §8）。即使可行，這條 UX 也很差（跳出去裝一個 app、掃描、匯出、回來上傳），且要寫 USDZ/PLY 解析器。**不建議**。

### 3.5 iOS 26 Safari 的 WebXR 狀態 —— 仍然不支援

完整證據鏈已在 [`04-web-spatial-tech.md` §2.1](./04-web-spatial-tech.md) 建立（caniuse 原始 JSON、MDN BCD、WebKit standards-positions、Safari 26.0/26.2/26.6 release notes 逐篇查核）。重點複述：

- iOS Safari 26.3–26.6 在 caniuse `webxr.json` 皆為 `n`，**且沒有 `d` 標記**——連預設關閉的旗標都沒有。對照 macOS Safari 是 `n d`（有實驗旗標可開）。
- **WebKit feature status 頁（webkit.org/status/）已下線**，現在只顯示「The WebKit Feature status page has been retired.」→ 2026 年起不能再拿它當依據，要看 standards-positions + Safari release blog。
- WebKit standards-positions **#155「WebXR Device API」至今未表態（Open）**。核心規格連立場都還沒表。
- Safari 26.6（2026-07-27）release notes 全文無任何 WebXR / AR 條目。

**visionOS Safari**：支援 `immersive-vr`；Safari 26.2（2026-02-04）的 blog 標題是「WebXR on visionOS now supports WebGPU」，講的仍是 visionOS。`immersive-ar` 在 visionOS 上是否可用，Apple 從未正式宣告 → 見 §8。

⇒ **「等 Apple」不是方案。** 沒有任何公開訊號指向 iOS Safari 近期會支援 WebXR。

### 3.6 照片量測 fallback（保底方案）

想法：iOS 使用者拍一張地板照片，在照片上手動點四個角，用單應性（homography）把影像座標映回地面平面座標。

**取像**：

```html
<input type="file" accept="image/*" capture="environment" />
```

**尺度來源**：地板上放一張 A4 紙（210 × 297 mm）當已知參考物。使用者先點 A4 的四個角 → 解出影像平面到地面平面的單應矩陣 H 與公制尺度；再點房間四角 → 用同一個 H 換算實際座標。

**函式庫選擇（npm 實測，2026-09-05）**：

| 套件 | 版本 / 日期 | 授權 | unpacked | 評 |
|---|---|---|---|---|
| **`homography`** | 1.8.1 / 2023-12-09 | MIT | **150 KB** | ✅ 純 JS，體積合理。維護停在 2023 |
| `@techstark/opencv-js` | 5.0.0-release.1 / 2026-06-24 | Apache-2.0 | **14.7 MB** | 功能齊全但過重 |

四點對應解單應矩陣是 8 個未知數的線性方程組，**自己寫也就幾十行**（DLT + 高斯消去），不見得需要相依。以本專案已有 `src/engine/geometry.ts` 的情況，自寫可能比引入 150 KB 更乾淨。

**不需要 COOP/COEP**：`homography` 是純 JS 單執行緒，不碰 SharedArrayBuffer。這很重要，因為 GitHub Pages 設不了那些 header（見 §6）。opencv.js 的**單執行緒**建置同樣不需要，只有 threaded 建置才需要 cross-origin isolation。

**精度預期**：單張影像 + 已知參考物的平面測量，誤差主要來自三處——使用者點角的像素誤差、鏡頭桶形畸變未校正、以及「地板真的是平面且 A4 真的貼平」的假設。**沒有找到針對這個具體流程的可信實測數據** → 列入 §8。

但對風水用途要講清楚一件事：**這個誤差多半無所謂。** 八宅與玄空飛星吃的是「房間中心 + 朝向角度 + 各方位落在哪一宮」，對長寬各差幾公分不敏感；真正敏感的是**羅盤角度**（§5 那條公式錯一個正負號就整盤錯 180°）。所以照片量測作為保底是合格的。

---

## 4. 決策矩陣（四維度）

評分：3 = 好，2 = 尚可，1 = 差，0 = 不可行。

| 方案 | 免費/低成本 | 能自架(GH Pages) | 地板點世界座標 | 整合成本(越高越省) | 總分 |
|---|:--:|:--:|:--:|:--:|:--:|
| **Variant Launch** | 3（$0 / 3k views） | 3（登記子網域即可） | **3（ARKit 原生公制）** | **3（改 ~30 行）** | **12** |
| **8th Wall（開源版）** | 3（$0，無付費層） | 3（官方點名 GH Pages） | 2（要使用者校正尺度） | 1（+6.6 MB、另寫管線） | **9** |
| 拍照＋手動點角 | 3 | 3 | 1（單張單應性） | 2 | **9** |
| AR.js（marker） | 3（MIT） | 3 | 2（需 marker 在畫面內） | 1（自寫射線求交） | **9** |
| Onirix | 1（入門層禁商用） | 1 | 2 | 1 | **5** |
| Zappar / Mattercraft | 1（$315/月商用） | **0（僅 Enterprise）** | 1（instant world tracking） | 1（React 19 卡關） | **3** |
| AR Quick Look / RoomPlan | 3 | 3 | **0（無回傳管道）** | 0 | **6→不可行** |

### 排序與建議

**Tier 1 —— Variant Launch。** 四個維度沒有一項是弱項，而且它在「整合成本」與「座標品質」這兩個最重要的維度上都是滿分。決定性理由：**追蹤交給 ARKit**，拿到的是原生公制座標、免校正動作；**API 是標準 WebXR**，現有 174 行程式碼幾乎照用。

**Fallback A —— 8th Wall 開源版。** 補 Variant Launch 的死角：Safari 無痕、iOS Chrome、Instagram/X/LINE 的 in-app browser 都無法觸發 App Clip，但 8th Wall 只要 `getUserMedia` 就能跑。代價是 6.6 MB 與一套獨立 renderer 管線。**建議先不做**，等真實使用者回報「App Clip 開不起來」再補。

**Fallback B —— 拍照＋手動點角。** 零相依、零廠商風險、任何裝置都能跑。**建議跟 Tier 1 一起做**，因為它同時也是桌機使用者和「不想開相機權限」使用者的入口，成本低而覆蓋面最大。

**明確排除**：Zappar（不能自架、React 19 卡關、商用 $315/月）、Onirix（入門層禁商用）、AR Quick Look/RoomPlan（無回傳管道，技術上不可能）、等 Apple 支援 WebXR（無任何訊號）。

### 建議實作順序

1. 先做 **Fallback B（拍照量測）**——沒有外部相依，可立即完成並讓 iOS 使用者馬上有東西可用。
2. 再做 **Tier 1（Variant Launch）**——註冊免費帳號、登記 `<user>.github.io`、加 script tag、改 reference space 協商、overlay 移出 React。
3. **8th Wall 先不碰**，列為觀察項。

---

## 5. ★ `screen.orientation.angle` 的正負號（羅盤修正）

**這一節推翻 [`04-web-spatial-tech.md` §1.6(D)](./04-web-spatial-tech.md) 的結論。** 該處寫的是 `heading − angle`，並自我標註「正負號是推導而非引用，務必實機驗證」。本次用四條平台原始碼把它釘死了：**應該是 `+ angle`。**

### 5.1 規範原文

W3C Screen Orientation（[TR](https://www.w3.org/TR/screen-orientation/) 與 [ED](https://w3c.github.io/screen-orientation/) 文字相同，2026-09-05）：

> **Current orientation angle** — "The angle in degrees that the screen is rotated **counter-clockwise** from its natural orientation as derived from the screen orientation values lists."

**screen orientation values lists**（自然為直式的螢幕）：

| type | angle |
|---|---|
| `portrait-primary` | 0° |
| `landscape-primary` | **90°** |
| `portrait-secondary` | 180° |
| `landscape-secondary` | 270° |

規範只說「螢幕逆時針轉」，**沒有圖、沒有例子說明是「機身逆時針」還是「畫面內容逆時針」**——這正是所有人踩坑的地方（兩者恰好相反）。所以要往下挖到平台實作。

### 5.2 「逆時針 90° → angle 90」：兩條獨立平台證據鏈

**Android 鏈**（AOSP 原始碼，`core/java/android/view/Display.java`，逐字）：

> "The angle is the rotation of the drawn graphics on the screen, which is the opposite direction of the physical rotation of the device. For example, **if the device is rotated 90 degrees counter-clockwise**, to compensate rendering will be rotated by 90 degrees clockwise and thus **the returned value here will be `Surface.ROTATION_90`**."
> —— [aosp-mirror/platform_frameworks_base](https://github.com/aosp-mirror/platform_frameworks_base/blob/master/core/java/android/view/Display.java)

Chromium 把它 1:1 轉成度數（`ui/android/java/src/org/chromium/ui/display/DisplayAndroid.java`）：

```java
public int getRotationDegrees() {
    switch (getRotation()) {
        case Surface.ROTATION_0:   return 0;
        case Surface.ROTATION_90:  return 90;
        case Surface.ROTATION_180: return 180;
        case Surface.ROTATION_270: return 270;
    }
}
```

⇒ **Android Chrome：機身逆時針轉 90° → `screen.orientation.angle === 90`。**

**iOS 鏈**（WebKit 原始碼，三段接力）：

```objc
// Source/WebKit/UIProcess/API/ios/WKWebViewIOS.mm
static WebCore::IntDegrees deviceOrientationForUIInterfaceOrientation(UIInterfaceOrientation o) {
    case UIInterfaceOrientationPortrait:           return 0;
    case UIInterfaceOrientationPortraitUpsideDown: return 180;
    case UIInterfaceOrientationLandscapeLeft:      return -90;
    case UIInterfaceOrientationLandscapeRight:     return 90;
}
```
```objc
// Source/WebKit/UIProcess/ios/WebPageProxyIOS.mm
WebCore::ScreenOrientationType WebPageProxy::toScreenOrientationType(IntDegrees angle) {
    if (angle == -90) return ScreenOrientationType::LandscapeSecondary;
    if (angle == 180) return ScreenOrientationType::PortraitSecondary;
    if (angle ==  90) return ScreenOrientationType::LandscapePrimary;
    return ScreenOrientationType::PortraitPrimary;
}
```
```cpp
// Source/WebCore/page/ScreenOrientation.cpp — 直接實作規範的 values table
if (isPortrait(naturalScreenOrientationType())) {
    case Type::LandscapePrimary:   return 90;
    case Type::LandscapeSecondary: return 270;
}
```

再接上 Apple 對 `UIInterfaceOrientation` 的定義：

> `UIInterfaceOrientation.landscapeRight` — "The device is in landscape mode, with the device upright and the **Home button on the right**."
> —— [developer.apple.com/documentation/uikit/uiinterfaceorientation/landscaperight](https://developer.apple.com/documentation/uikit/uiinterfaceorientation/landscaperight)

Home 鍵在直式時位於**下緣**。要讓下緣跑到**右邊**，機身必須**逆時針**轉 90°（上緣往左）。

⇒ **iOS Safari：機身逆時針轉 90° → `screen.orientation.angle === 90`。**

**兩個平台用完全不同的定義路徑，得到同一個答案。** 順帶澄清一個流傳很廣的誤解：iOS 的 `window.orientation` 與 `screen.orientation.angle` **並沒有正負號相反**——WebKit 的 `toScreenOrientationType()` 就是把 `-90` 對到 `LandscapeSecondary`（= 270°），`90` 對到 `LandscapePrimary`（= 90°），兩者描述的是同一個物理姿態。MDN 對 `window.orientation` 的說法「Positive values are counterclockwise」與此一致（它把主語寫成 viewport 是措辭不精確，物理方向是對的）。

### 5.3 裝置座標系不隨螢幕轉 —— 所以一定要修正

W3C DeviceOrientation Event 規範 §3.1（逐字）：

> "For a mobile device such as a phone or tablet, the device coordinate frame is defined relative to the screen **in its standard orientation, typically portrait**. […] **If the orientation of the screen changes when the device is rotated** or a slide-out keyboard is deployed, **this does not affect the orientation of the coordinate frame relative to the device.**"
> —— [w3.org/TR/orientation-event](https://www.w3.org/TR/orientation-event/)

iOS 的 `webkitCompassHeading` 也是同一個座標系。WebKit 直接把 CoreLocation 的值原封不動傳出，**沒有做任何螢幕方向修正**：

```objc
// Source/WebCore/platform/ios/WebCoreMotionManager.mm
double heading = (m_headingAvailable && newHeading) ? newHeading.magneticHeading : 0;
orientationClient->orientationChanged(alpha, beta, gamma, heading, headingAccuracy);
```

而 CoreLocation 的參考軸，Apple 說得很明確：

> "When computing heading values, the location manager assumes that **the top of the device in portrait mode represents due north (0 degrees) by default**."
> —— [CLLocationManager.headingOrientation](https://developer.apple.com/documentation/corelocation/cllocationmanager/headingorientation)

我也確認過 **WebKit 全庫沒有任何一處設定 `headingOrientation`**（GitHub code search 於 `WebKit/WebKit` 只命中一個 SDK stub 檔，非實際程式碼）→ 永遠是預設的 portrait。

⇒ **`webkitCompassHeading`（iOS）與 `360 − alpha`（Android）給的都是「直式時機身上緣所指的方位」，兩者同一個座標系，都需要同一條修正。**

### 5.4 結論：是 `+ angle`，不是 `− angle`

**具體推導**（手機平放、螢幕朝上，從上方俯視）：

設世界座標 X=東、Y=北、Z=天；裝置軸 y_d = 機身上緣方向，z_d = 螢幕外法線。

取 A = 90 的情形（機身逆時針轉 90°）：
- 機身上緣 y_d 由「北」轉到「西」→ 裝置 heading **H = 270°**
- 系統把畫面反向補正，畫面上的「上」現在落在 x_d 上，而 x_d 此時指向**北** → 畫面上緣代表的方位 = **0°**
- `H + A = 270 + 90 = 360 ≡ 0` ✓
- `H − A = 270 − 90 = 180` ✗（正好差 180°，指到反方向）

再驗 A = 270（機身順時針轉 90°）：上緣指東 → H = 90；畫面上緣仍是北 = 0；`90 + 270 = 360 ≡ 0` ✓

**與 W3C 感測器 polyfill 交叉驗證。** Generic Sensor 規範編輯 Kenneth Christiansen 的參考實作 [kenchris/sensor-polyfills](https://github.com/kenchris/sensor-polyfills/blob/master/src/motion-sensors.js) 把裝置座標系轉成螢幕座標系的做法是：

```js
function deviceToScreen(quaternion) {
  return rotateQuaternionByAxisAngle(quaternion, [0, 0, 1], - orientation.angle * Math.PI / 180);
}
```

繞 z 軸旋轉 **−A**。這跟 three.js r133 `DeviceOrientationControls` 的 `setFromAxisAngle(_zee, - orient)` 是同一件事。

**這就是 04 文件踩到的坑**：那個 `−A` 是**向量／座標系**的旋轉量（右手系，逆時針為正）；而羅盤方位（bearing）是**順時針**遞增的。同一個物理旋轉，換算到 bearing 就要翻號：

> 座標系繞天頂軸旋轉 `−A`（逆時針為正） ⟺ bearing `+A`

所以 polyfill 的 `−angle` 與羅盤公式的 `+angle` **並不矛盾，是同一件事的兩種座標約定**。把 `−` 直接抄進 bearing 公式就會錯 180°（在橫置時）。

**最終公式：**

```ts
/**
 * 螢幕上緣所代表的真實方位。
 *
 * headingDevice: 直式時機身上緣的磁方位
 *   - iOS:     event.webkitCompassHeading（CoreLocation magneticHeading，直式參考軸）
 *   - Android: (360 - event.alpha) % 360
 * angle: screen.orientation.angle —— 機身相對自然方向「逆時針」轉了幾度
 *
 * 正負號依據：機身逆時針轉 A 度 → 機身上緣的 bearing 減少 A → 但畫面內容反向補正 A，
 * 故畫面上緣的 bearing = 機身上緣 bearing + A。
 * 平台證據見 §5.2（AOSP Display.java / Chromium DisplayAndroid / WebKit WKWebViewIOS+
 * WebPageProxyIOS + ScreenOrientation.cpp / Apple UIInterfaceOrientation）。
 */
export function screenHeading(headingDevice: number, angle = screen.orientation?.angle ?? 0): number {
  return (headingDevice + angle + 360) % 360
}
```

**驗證方法（實機，兩分鐘）**：把手機平放、上緣朝北（用實體羅盤或另一支手機對照），此時直式讀數應為 0。維持上緣朝北不動，把手機**逆時針**轉 90°（上緣轉向西）——`screen.orientation.angle` 應變成 **90**，`headingDevice` 應變成約 **270**，而 `screenHeading()` 應仍為約 **0**。若得到 180，就是符號反了。

> ✅ **最省事的做法仍然成立**：manifest 已設 `orientation: 'portrait'`，若再用 `screen.orientation.lock('portrait')` 鎖死，`angle` 恆為 0，整條修正可以不存在。但 `lock()` 需要 fullscreen 或已安裝的 PWA 才會成功（規範的 pre-lock conditions），**在一般 Safari 分頁會被拒絕**，所以修正式仍必須寫對。

---

## 6. GitHub Pages 注意事項

### 6.1 HTTPS 與 secure context —— 沒問題

`*.github.io` 由 GitHub 提供憑證並強制 HTTPS。`getUserMedia`、`DeviceOrientationEvent`、WebXR 都只在 secure context 可用，這個條件滿足。

### 6.2 Permissions-Policy 設不了 —— 但對頂層文件無影響

GitHub Pages 是純靜態託管，**不能設定任何自訂回應 header**（沒有 `_headers`、沒有 `netlify.toml`、沒有 nginx conf）。這聽起來嚇人，實際上不影響本專案，理由是 Permissions Policy 的**預設允許清單**：

`camera`、`xr-spatial-tracking`、`accelerometer`、`gyroscope`、`magnetometer` 的預設值都是 **`self`**。`self` 涵蓋「同源的頂層文件」——我們的頁面就是頂層同源文件，**預設就被允許**，不需要任何 header 去開啟它。

Permissions-Policy header 的用途是**收緊**權限，或是**授權給跨來源 iframe**。我們兩者都不需要。

⇒ 唯一會踩到的情境是：**別人把我們的頁面嵌進他站的 `<iframe>`**。那時對方必須寫 `<iframe allow="camera; xr-spatial-tracking; gyroscope; accelerometer; magnetometer">`，而這是**對方的 HTML 屬性，不是我們的 header**，同樣不受 GitHub Pages 限制。

### 6.3 設不了 COOP/COEP —— 只影響 SharedArrayBuffer

`crossOriginIsolated` 需要 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`，GitHub Pages 給不了。

**影響範圍**：只有需要 `SharedArrayBuffer` 的東西——opencv.js 的**多執行緒**建置、ffmpeg.wasm 等。

**本專案完全不受影響**：three.js、Variant Launch、8th Wall engine、`homography`、單執行緒 opencv.js 都不需要 SharedArrayBuffer。

若日後真的需要，社群方案是 service worker 注入 header 的 `coi-serviceworker` 這類 hack，但它會和 `vite-plugin-pwa` 自己註冊的 service worker 打架 → **不建議**。

### 6.4 子路徑部署與 PWA scope

專案頁的網址是 `https://<user>.github.io/dudu-fengshui/`，**所有路徑相關設定都要帶上這個 base**：

```ts
// vite.config.ts
export default defineConfig({
  base: '/dudu-fengshui/',          // ← 目前沒有，必須加
  plugins: [
    react(), tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        // 這三個都要是完整子路徑
        id: '/dudu-fengshui/',
        start_url: '/dudu-fengshui/',
        scope: '/dudu-fengshui/',
        name: '嘟嘟風水',
        short_name: '嘟嘟風水',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1c1917',
        background_color: '#1c1917',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/dudu-fengshui/index.html',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
})
```

```tsx
// main.tsx —— react-router 也要知道 base
<BrowserRouter basename="/dudu-fengshui">
```

**Service Worker scope 規則**：註冊在 `/dudu-fengshui/sw.js` 的 SW 只能控制 `/dudu-fengshui/` 底下的頁面。這對我們**正好**——同一個 `github.io` 帳號下的其他專案不會互相干擾。

**SPA 深層路由**：GitHub Pages 沒有 rewrite，直接開 `/dudu-fengshui/scan` 會 404。標準解法是把 `index.html` 複製一份成 `404.html`（GitHub Pages 會用它當 fallback）：

```json
"build": "tsc -b && vite build && cp dist/index.html dist/404.html"
```

> 替代方案是改用 `HashRouter`，網址會變成 `/#/scan`。對 PWA 與分享連結而言 `BrowserRouter` + `404.html` 體驗較好，建議用前者。

**`.nojekyll`**：若用 `actions/upload-pages-artifact` 部署則不經 Jekyll，理論上不需要；但 Vite 產出的 `assets/` 不以底線開頭，本來就不受 Jekyll 影響。加一個空的 `public/.nojekyll` 當保險成本為零。

> ⚠️ 以下三項本次**未逐一查證原始文件**（見 §8）：GitHub Pages 對 `.webmanifest` 的 MIME type、`404.html` fallback 的官方文件出處、以及 2026 年官方推薦的部署 Action 版本組合。實作時請對照 [vite.dev/guide/static-deploy](https://vite.dev/guide/static-deploy.html#github-pages) 現行文件。

### 6.5 對三個 API 的總結

| API | GitHub Pages 上可用？ | 說明 |
|---|---|---|
| `getUserMedia`（相機） | ✅ | HTTPS 滿足；`camera` 預設 `self` |
| `DeviceOrientationEvent` | ✅ | 同上；iOS 仍需使用者手勢觸發 `requestPermission()` |
| WebXR `immersive-ar` | ✅（Android） | `xr-spatial-tracking` 預設 `self`，頂層文件不需 header |
| Variant Launch | ✅ | 需在後台登記 `<user>.github.io`；子路徑不影響 |
| 8th Wall | ✅ | 官方文件明列 GitHub Pages 為建議自架選項 |
| `SharedArrayBuffer` | ❌ | 設不了 COOP/COEP。本專案不需要 |

---

## 7. 來源清單

**Variant Launch**（全部 2026-09-05 抓取）
- https://launch.variant3d.com/ —— 定價、FAQ、feature 清單
- https://launch.variant3d.com/docs/getting-started
- https://launch.variant3d.com/docs/webxr-compatibility —— feature 支援表
- https://launch.variant3d.com/docs/using-the-sdk —— script tag、`vlaunch-initialized`、`vlaunch-ar-tracking`
- https://launch.variant3d.com/docs/authorising-domains —— 子網域授權規則
- https://launch.variant3d.com/docs/launching/ios-browsers —— Safari／無痕／in-app browser 行為
- https://launch.variant3d.com/docs/launching/handling-links
- https://launch.variant3d.com/docs/troubleshooting/dom-overlay —— React 陷阱
- https://launch.variant3d.com/docs/troubleshooting/no-camera —— 背景透明化
- https://launch.variant3d.com/docs/ai-agent-docs
- https://github.com/Variant3d/v-launch-sdk —— MPL-2.0，polyfill 血統
- https://github.com/Variant3d/launch-examples —— three.js/Vite 範例
- `curl -sI 'https://launchar.app/sdk/v1?key=TESTKEY'` —— 端點存活實測

**8th Wall**（全部 2026-09-05）
- https://8thwall.org/ —— 開源公告、FAQ、付費層終止
- https://8thwall.org/docs/migration/faq —— 時間表、授權白話版、維護承諾
- https://8thwall.org/docs/open-source —— 歸屬要求、binary vs MIT 差異
- https://8thwall.org/docs/engine/overview —— 載入方式
- https://8thwall.org/docs/api/engine/xrcontroller/hittest
- https://8thwall.org/docs/api/engine/xrcontroller/configure —— `scale: 'absolute'`
- https://8thwall.org/docs/api/engine/threejs/pipelinemodule / xrscene
- https://8thwall.org/docs/engine/guides/coaching-overlays —— 尺度校正動作
- https://8thwall.org/docs/getting-started/publishing —— 點名 GitHub Pages
- https://github.com/8thwall/8thwall —— MIT，466 stars
- https://github.com/8thwall/engine/blob/main/LICENSE —— XR Engine License Agreement
- https://registry.npmjs.org/@8thwall/engine-binary + https://data.jsdelivr.com/v1/packages/npm/@8thwall/engine-binary@1.0.0 —— 版本與實測位元組

**規範**
- https://www.w3.org/TR/screen-orientation/ 、 https://w3c.github.io/screen-orientation/
- https://www.w3.org/TR/orientation-event/ —— 座標系不隨螢幕轉、A.1 worked example
- https://www.w3.org/TR/orientation-sensor/ 、 https://www.w3.org/TR/generic-sensor/

**平台原始碼／文件**
- https://github.com/aosp-mirror/platform_frameworks_base/blob/master/core/java/android/view/Display.java
- https://github.com/chromium/chromium/blob/main/ui/android/java/src/org/chromium/ui/display/DisplayAndroid.java
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/ScreenOrientation.cpp
- https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/API/ios/WKWebViewIOS.mm
- https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/WebPageProxyIOS.mm
- https://github.com/WebKit/WebKit/blob/main/Source/WebCore/platform/ios/WebCoreMotionManager.mm
- https://developer.apple.com/documentation/uikit/uiinterfaceorientation/landscaperight
- https://developer.apple.com/documentation/corelocation/cllocationmanager/headingorientation
- https://developer.apple.com/documentation/appclip （API metadata: `introducedAt 14.0`）
- https://developer.apple.com/documentation/arkit/adding-an-apple-pay-button-or-a-custom-action-in-ar-quick-look
- https://github.com/kenchris/sensor-polyfills/blob/master/src/motion-sensors.js

**其他**
- https://github.com/AR-js-org/AR.js （MIT，5,985★，v3.4.8 / 2026-03-16）
- https://www.onirix.com/pricing/ （靜態文案；價格為 JS 渲染，未取得）
- npm registry：`homography@1.8.1`、`@techstark/opencv-js@5.0.0-release.1`、`@zappar/zappar-react-three-fiber@4.3.0`
- 本專案既有調研：`docs/research/04-web-spatial-tech.md` §1.6、§2.1、§4.1

---

## 8. 未驗證 / 不確定事項

### 高影響（會改變實作或需要實機驗證）

1. **`screen.orientation.angle` 的 `+` 號未經實機驗證。** §5 的四條平台原始碼證據鏈很強，但終究是「讀碼推導」。§5.4 附了兩分鐘的實機驗證步驟，**上線前必須實測**。這條錯了整個羅盤差 180°。
2. **Variant Launch 在 PWA standalone（加到主畫面）能否觸發 App Clip：未知。** 官方文件完全沒提。App Clip 卡片是 Safari 分頁的行為，合理推測 standalone 內不會出現 → 若成立，iOS 使用者必須在 Safari 分頁裡掃描，這會改變 UX 設計。**必須實機測。**
3. **Variant Launch 的最低 iOS 版本：官方未載明。** 只能確定 App Clip 本身自 iOS 14.0 起（Apple API metadata）。實際下界（ARKit 版本、viewer deployment target）未知。
4. **`github.io` 能否成功登記為 Variant Launch 授權網域：未實測。** 文件規則（登記完整子網域）看起來允許，但 `github.io` 在 Public Suffix List 上，部分服務會拒絕這類網域。**註冊後第一件事就是驗證這個。**
5. **8th Wall absolute scale 的實際量測誤差：官方無數據，第三方實測也沒找到。**
6. **不需要 Apple Developer 帳號**：這是從流程推得的高信心結論（使用者安裝的是 Variant 自己的 viewer），但官方沒有明文。

### 中影響

7. **Variant Launch「view」的精確定義與超量行為**（擋掉／超收／降速）：官網與 docs 皆未說明。
8. **8th Wall 引擎二進位的長期維護**：官方 FAQ 寫「maintained **through March 2026**」，但 npm 上 1.0.0 是 2026-04-03 發佈的，這句承諾未見更新。實際維護狀態不明。
9. **8th Wall 授權 §1.2 對「風水 app 收費」的適用性**：官方白話版說「賣體驗不是賣引擎就可以」，看起來允許，但屬法律灰帶。真要商業化前應正式詢問 Niantic Spatial。
10. **Onirix 的 2026 確切價格與功能**：定價頁為 JS 渲染，靜態抓不到。只確認了「入門層禁商用、自訂網域與託管分層計價」的結構。
11. **GitHub Pages 的 `.webmanifest` MIME type、`404.html` fallback 的官方文件出處、2026 年推薦的部署 Action 版本組合**：本次未逐一查證原始文件。

### 低影響

12. **RoomPlan 匯出流程**：哪些第三方 app 支援匯出、匯出什麼格式，未查證（該方案已因 UX 過差而不建議）。
13. **照片量測（單應性 + A4 參考物）的實際精度**：未找到針對此流程的可信實測數據。
14. **visionOS Safari 的 `immersive-ar` 支援狀態**：Apple 從未正式宣告，BCD 也無 visionOS 欄位（沿用 04 文件的判定）。
15. **Variant Launch 的商業存續性**：blog 停在 2023-08，但 SDK repo 2026-03 有 push、docs 有近期新增頁面、端點正常服務。單一供應商風險無法量化。

### 方法論限制

- 本次調研的 WebSearch 額度在開始前已耗盡，全部資料改以 **WebFetch / curl 直接抓取已知 URL + GitHub API + npm registry API + jsDelivr API** 取得。優點是拿到的都是一手原文與實測位元組；缺點是**無法做廣度發現**——可能存在本文完全沒提到的方案。
- 所有「逐字引用」皆來自當日抓取的頁面文字，未經二手轉述。
