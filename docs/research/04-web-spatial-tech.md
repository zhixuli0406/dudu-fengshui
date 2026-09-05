# 04 — Web 端空間技術調研（羅盤／AR／平面圖）

> 專案：dudu-fengshui（Vite + React 19 + TypeScript + three.js，PWA 靜態站）
> 調研日期：**2026-09-05**
> 方法：全部結論以一手來源查證——MDN browser-compat-data 原始 JSON、caniuse 原始資料檔、
> Chrome Platform Status API、Chrome 官方 release notes、Chromium 原始碼 `runtime_enabled_features.json5`、
> WebKit 官方 blog 與 standards-positions、immersive-web spec 原始檔、three.js GitHub 原始碼、
> npm registry API、NOAA NCEI 官方地磁 API。**未經查證者一律列入 §7「未驗證」，不寫進正文當事實。**

---

## 0. 決策摘要

### 0.1 支援矩陣

圖例：✅ 預設可用｜⚠️ 需 flag／限定裝置／有重大限制｜❌ 不可用

| 能力 | Chrome Android<br>(stable 153) | Safari iOS<br>(26.6) | Safari macOS | Meta Quest<br>Browser | Firefox | 來源 |
|---|---|---|---|---|---|---|
| **WebXR `immersive-ar`** | ✅ M81 | ❌ **完全無** | ⚠️ 實驗旗標 | ✅ | ⚠️ `dom.vr.webxr.enabled` | [1][2][3] |
| WebXR hit-test | ✅ M81 | ❌ | ❌ | ✅ | ❌ | [1] |
| WebXR anchors | ✅ M79/M85 註a | ❌ | ❌ | ✅ | ❌ | [1][4] |
| WebXR dom-overlay | ✅ M83 | ❌ | ❌ | ✅ | ❌ | [1] |
| WebXR **plane-detection** | ✅ **M147**（2026-04） | ❌ | ❌ | ✅ 31.2 | ❌ | [1][4][5][6] |
| WebXR `initiateRoomCapture()` | ✅ M147 | ❌ | ❌ | ✅ 31.2 | ❌ | [4][7] |
| WebXR depth-sensing | ✅ M90 | ❌ | ❌ | ✅ 33.3 | ❌ | [1][4] |
| WebXR mesh-detection | ❌ **未實作** | ❌ | ❌ | ✅ 31.2 | ❌ | [4][5] |
| WebXR light-estimation | ✅ M90 | ❌ | ❌ | ✅ | ❌ | [1] |
| WebXR camera-access | ✅ M107 | ❌ **WebKit 明確反對** | ❌ | ✅ | ❌ | [1][3] |
| `deviceorientation` 事件 | ✅ | ✅ 4.2+ | ✅ | ✅ | ✅ | [4] |
| `DeviceOrientationEvent.absolute` | ✅ | ❌ **false** | ❌ | — | ✅ | [4] |
| `deviceorientationabsolute` 事件 | ✅ | ❌ | ❌ | — | ⚠️ | [4] |
| `webkitCompassHeading` | ❌ | ✅ iOS 專有 | ❌ | — | ❌ | §1 |
| **`DeviceOrientationEvent.requestPermission()`** | ✅ **M151**（2026-07） | ✅ iOS 14.5+ | ❌ n/a | — | 開發中 | [4][8][9] |
| Permissions API `query()` | ✅ | ✅ Safari 16 | ✅ 16 | ✅ | ✅ | [4] |
| ├ `geolocation` / `camera` | ✅ | ✅ 16 | ✅ 16 | ✅ | ✅ | [4] |
| └ `magnetometer` / `gyroscope` / `accelerometer` | ✅ | ❌ | ❌ | ✅ | — | [4] |
| `getUserMedia`（含 PWA standalone） | ✅ | ✅ **iOS 13.4+** | ✅ | ✅ | ✅ | [4][10] |
| Geolocation API | ✅ | ✅ | ✅ | ✅ | ✅ | [4] |
| AR Quick Look（USDZ） | ❌ | ✅ iOS 12+ | ❌ | ❌ | ❌ | [11] |

註a：Chrome Platform Status 記 anchors 為 M79，MDN BCD 的 `XRAnchor` / `XRFrame.createAnchor` 記 M85。兩者矛盾，實作面以 **M85** 較可信。

### 0.2 一句話結論

**iOS 沒有 WebXR，而且短期不會有。** Android Chrome 則在 2026 年變得非常完整——連 plane detection 和 `initiateRoomCapture()` 都已在 M147 預設出貨。
所以本專案必須做成 **「羅盤為核心、AR 為加分」** 的架構，而不是「AR 為核心」。

### 0.3 建議實作策略（三層）

#### Tier 1 — 全平台基礎（iOS + Android + 桌機都能跑，佔產品價值 80%）

| 功能 | 用什麼 API | 備註 |
|---|---|---|
| 羅盤定向（量坐向） | `deviceorientation` 事件 + iOS `webkitCompassHeading` + Android `deviceorientationabsolute`；**無條件 feature-detect `DeviceOrientationEvent.requestPermission()`** | Chrome M151 起也需要授權，不再是 iOS 專屬（§1.3） |
| 螢幕旋轉修正 | `screen.orientation.angle` | §1.6-D 公式（⚠️ 正負號未驗證） |
| 磁偏角校正（磁北→真北） | Geolocation 取經緯度 → WMM2025 計算 | 台灣約 **西偏 4.3–5.1°**（§1.9，NOAA 一手數據） |
| 定位 | Geolocation API（`enableHighAccuracy: true`，**務必自設 `timeout`**，預設是 `Infinity`） | |
| 2D 平面圖編輯 | **react-konva 19.2.6 + konva 10.3.3** | React 19 就緒、9/4 才發版、gzip 93KB |
| 幾何運算（面積／立極／點在宮內） | **自寫卡氏公式**（shoelace + 面積形心 + ray-casting） | 不要用 Turf，理由見 §3.3 |
| 曆法／干支／節氣／九星 | **lunar-typescript 1.8.6** | 內建 `NineStar`，連玄空九星都有（§3.4） |
| 相機疊圖「偽 AR 羅盤」 | `getUserMedia({video:{facingMode:{exact:'environment'}}})` + `deviceorientation` + canvas/three.js | iOS PWA standalone 自 13.4 起可用 |
| 照片平面圖透視校正 | `@techstark/opencv-js` 5.0.0-release.1 的 `getPerspectiveTransform` | 或純手動拖四角點 |

#### Tier 2 — Android Chrome 真 AR（漸進增強，M147+ 才給）

| 功能 | 用什麼 API |
|---|---|
| 進入 AR | `navigator.xr.isSessionSupported('immersive-ar')` → `ARButton.createButton(renderer, {...})` |
| 點地板放九宮 | `hit-test`：`session.requestHitTestSource({space})` → `frame.getHitTestResults()` |
| **自動取得地板多邊形** | `plane-detection`：`frame.detectedPlanes` → `plane.orientation === 'horizontal'` + `plane.semanticLabel === 'floor'` → `plane.polygon` |
| **請裝置主動掃房間** | `await session.initiateRoomCapture()` |
| 錨定九宮不飄移 | `anchors`：`frame.createAnchor()` |
| AR 中顯示 HTML UI | `dom-overlay`（`ARButton` 會自動加） |
| React 綁定 | `@react-three/xr` 6.6.30 的 `useXRPlanes('floor')` / `useXRHitTest()` / `useXRAnchor()` |

⚠️ **不要直接用 `three/addons/webxr/XRPlanes.js`**——它把 `plane.polygon` 退化成 AABB 包圍盒，丟掉真實房型。房型要精確就自己用 polygon 建 `ShapeGeometry`（§2.6、§5.4）。
⚠️ **`ARButton` 會強制 `setReferenceSpaceType('local')`**，而九宮貼地板通常想要 `local-floor`（原點在地板高度）。要 `local-floor` 得自己寫 button（§2.6）。
⚠️ **Renderer 用 `WebGLRenderer`，不要用 WebGPU**——WebGPU + WebXR 需要瀏覽器提供 `XRGPUBinding`，在 Chromium 仍是 `experimental`（§2.7）。

#### Tier 3 — 實驗性／不建議依賴

| 功能 | 現況 |
|---|---|
| `depth-sensing` 遮擋 | Chrome M90 預設開，但**硬體門檻未證實**（§7-1），必須以 `session.enabledFeatures` 執行期偵測 |
| `mesh-detection` | **Quest 專屬**，Chrome 完全沒實作。不要規劃 |
| `camera-access` | Chrome M107 可用，但 **WebKit 立場為 oppose**，永遠不會跨平台 |
| iOS 原生掃描橋接 | RoomPlan 需 LiDAR + 得發原生 App；Polycam / magicplan 有 API。屬「另一個產品」，非 PWA 範疇（§2.9） |
| WebGPU renderer | 等 `XRGPUBinding` 脫離 experimental 再說 |

---

## 1. 羅盤與方位

### 1.1 支援表（MDN browser-compat-data 原始 JSON，2026-09-05）

| 功能 | Chrome | Chrome Android | Firefox | Safari 桌機 | **Safari iOS** | Samsung |
|---|---|---|---|---|---|---|
| `DeviceOrientationEvent` | 7 | mirror | 6 | **17** | 4.2 | 1.0 |
| `deviceorientation` 事件 | 7 | mirror | 6 | 17 | 4.2 | mirror |
| **`deviceorientationabsolute` 事件** | **50** | mirror | **110** | **false** | **false** | mirror |
| `.absolute` 屬性 | 7 | mirror | 6 | 17 | **false** ← 見下 | mirror |
| `.alpha` / `.beta` / `.gamma` | 7 | mirror | 6 | 17 | 4.2 | mirror |
| `DeviceOrientationEvent.requestPermission()` | **151–152**（見 §1.3） | mirror | false | false | **14.5** | mirror |
| `DeviceMotionEvent.requestPermission()` | 同上 | mirror | false | false | 14.5 | mirror |

BCD 對 Chrome 條目的原文附註：
> "Before version 50, Chrome provided absolute values instead of relative values for this event. Developers still needing absolute values may use the `deviceorientationabsolute` event."

> ⚠️ **iOS 上 `event.absolute` 是 `undefined` 而非 `false`。** 這不是 BCD 筆誤，是 WebKit 的 IDL 直接把它編譯掉：
> ```webidl
> #if defined(WTF_PLATFORM_IOS_FAMILY) && WTF_PLATFORM_IOS_FAMILY
>     [ImplementedAs=compassHeading]  readonly attribute unrestricted double? webkitCompassHeading;
>     [ImplementedAs=compassAccuracy] readonly attribute unrestricted double? webkitCompassAccuracy;
> #else
>     readonly attribute boolean? absolute;
> #endif
> ```
> 來源：`Source/WebCore/dom/DeviceOrientationEvent.idl`
> **⇒ feature detection 要用 `'webkitCompassHeading' in event`，不要用 `event.absolute === false` 判斷 iOS。**

### 1.2 `webkitCompassHeading` 給的是磁北，不是真北 —— 一手證據

MDN 只在 `DeviceOrientationEvent` 頁面用 `{{Non-Standard_Inline}}` 列了兩個 bullet，**沒有獨立頁面、沒有相容性資料、也沒說是真北還是磁北**（`webkitcompassheading/index.md` 實測 404，BCD grep 無結果）。

權威答案在 WebKit 原始碼 `Source/WebCore/platform/ios/WebCoreMotionManager.mm`：

```objc
double heading = (m_headingAvailable && newHeading) ? newHeading.magneticHeading : 0;
double headingAccuracy = (m_headingAvailable && newHeading) ? newHeading.headingAccuracy : -1;
```

WebKit 取的是 `CLHeading.magneticHeading`，**不是** `trueHeading`。

Apple 官方對這兩個值的定義：

| 屬性 | Apple 原文 |
|---|---|
| `magneticHeading` | "The heading (measured in degrees) relative to **magnetic north**." 「`0` = 指向磁北，`90` = 指向東，`180` = 指向南」 |
| `headingAccuracy` | "The maximum deviation (measured in degrees) between the reported heading and the true geomagnetic heading." **「負值代表回報的 heading 無效，可能發生在裝置未校正或有強烈局部磁場干擾時。」** |
| `trueHeading`（WebKit **未使用**） | "relative to the geographic North Pole" |

→ 值域 **0–360，0 = 磁北，順時針遞增**。

**另一個關鍵細節：iOS 的 heading 永遠以「直立(portrait)時的機頂」為基準。**
Apple `headingOrientation` 文件：「the location manager assumes that the **top of the device in portrait mode** represents due north (0 degrees) by default」，
而 WebKit 原始碼 grep `headingOrientation` → **0 hits**，代表 WebKit 從不設定它。
**⇒ 螢幕轉橫向時 `webkitCompassHeading` 不會跟著轉，要自己用 `screen.orientation.angle` 修正。**

**為什麼 iOS 的 `alpha` 不能當羅盤用**：WebKit 呼叫的是無參數的 `[m_motionManager startDeviceMotionUpdates]`，即 Core Motion 預設的 `CMAttitudeReferenceFrameXArbitraryZVertical`——X 軸是**任意**的。W3C 規格自己也註明相對方位「similar to the `xArbitraryZVertical` option for Core Motion」。**iOS 上只有 `webkitCompassHeading` 是絕對的。**

### 1.3 權限：`requestPermission()` 在 2026 年已不再是 iOS 專屬

W3C 規格（`https://w3c.github.io/deviceorientation/` §4、§6.1）：

```webidl
static Promise<PermissionState> requestPermission(optional boolean absolute = false);
```

規格演算法重點：
- 請求的權限集合為 `« "accelerometer", "gyroscope" »`；**`absolute` 為 true 時追加 `"magnetometer"`**（羅盤 app 理應傳 `true`）
- 若權限狀態為 `"prompt"` 且**沒有 transient activation** → **reject with `NotAllowedError`** ⇒ **必須在使用者手勢內呼叫**
- 介面標註 `[Exposed=Window, SecureContext]` ⇒ **必須 HTTPS**

> ⚠️ **但兩家實作都不吃 `absolute` 參數**。WebKit 與 Blink 的 IDL 都是無參數的 `static Promise<...> requestPermission();`。傳了也沒用。

**🔴 重大變更：Chrome 也開始要求授權了。**

| 證據 | 內容 |
|---|---|
| Chromium `runtime_enabled_features.json5` | `name: "DeviceOrientationRequestPermission", status: "stable"` → 已預設開啟 |
| chromestatus feature `5915984063889408` | `desktop_first: 151`, `android_first: 151`, intent_stage 5 (Ship), `shipping_year: 2026`, `first_enterprise_notification_milestone: 153` |
| **Chrome 官方 release notes `developer.chrome.com/release-notes/151`** | 正文列出「DeviceOrientation events permission request API — Lets web developers call `DeviceOrientationEvent.requestPermission()` and `DeviceMotionEvent.requestPermission()`… return a promise that resolves to either granted or denied」 |
| MDN BCD | 記 **152**（由「Updates for Chrome 152 **beta**」commit 加入） |
| Chrome Android 151 首次 stable | **2026-07-15**（v151.0.7922.29） |

該 feature 的 `interop_compat_risks` 原文，說明了未來方向：
> "…**Eventually will intend to move to an Ask-by-default state. In this latest stage, websites that register event listeners will not receive motion or orientation events until they call `requestPermission()`.**"

> **版本號的小矛盾**：chromestatus 與 Chrome 151 release notes 都指向 **151**；MDN BCD 記 **152**。兩者一致的部分是「現行 stable（153）已具備」。確切首發版本列入 §7 未驗證。

Safari 立場為 "Shipped/Shipping"（iOS 早已有）；Firefox "In development"（mozilla/standards-positions #1428）。

**⇒ 結論：2026 年的 compass hook 必須無條件 feature-detect `requestPermission`，不能寫成 `if (isIOS)`。**

`Permissions-Policy`（BCD）：`accelerometer` / `gyroscope` Chrome 88、`magnetometer` Chrome 66；Firefox / Safari 皆 false。預設 allowlist 為 `'self'`，iframe 內嵌需 `allow="accelerometer; gyroscope; magnetometer"`。

### 1.4 Android Chrome：用哪個事件、也是磁北

證據鏈（全為一手）：

1. **Chrome 50 起 `deviceorientation` 改為相對。** chromestatus feature `5661106970296320` 摘要原文：
   > "make 'deviceorientation' relative by default — now compatible with Safari on iOS, better usability (no drift) for VR applications, **not reliant on magnetometer** hence no interference in the presence of magnetic fields. — **add dedicated 'deviceorientationabsolute' event for AR applications.**"
2. **Blink 把 `deviceorientationabsolute` 對應到 `ABSOLUTE_ORIENTATION_EULER_ANGLES`**（`device_orientation_event_pump.cc`）。同檔案還顯示：**若相對感測器不可用（無陀螺儀），會 fallback 到絕對感測器**，此時 `event.absolute` 會是 `true`。
3. **Android 上 `ABSOLUTE_ORIENTATION_QUATERNION` → `Sensor.TYPE_ROTATION_VECTOR`**（`PlatformSensor.java`）。
4. **Android 官方對 `TYPE_ROTATION_VECTOR` 的座標系定義**：
   > "**Y is tangential to the ground at the device's current location and points towards magnetic north.**"

**⇒ Android Chrome 的絕對方位也是磁北，與 iOS 一致。**

回答原始問題：
- 哪個事件有絕對 heading？→ **`deviceorientationabsolute`**（Chrome 50+、Firefox 110+；**Safari 全平台不支援**）
- 純 `deviceorientation` 在 Android 上 `absolute` 會是 `true` 嗎？→ **正常情況不會**（Chrome 50 起為相對）；**但無陀螺儀的裝置會 fallback 成絕對，此時為 `true`**。程式碼必須兩種都處理。

### 1.5 ★ 磁北 vs 真北：對風水的意涵（好消息）

**iOS 的 `webkitCompassHeading` 與 Android 的 `deviceorientationabsolute` 給的都是磁北。**

傳統羅盤的「地盤正針」本來就是磁針量測，指的就是磁北。所以要重現二十四山盤面，**直接用瀏覽器原始讀數即可，不必做任何轉換**——這在跨平台一致性上是個難得的好消息。

只有在提供「真北模式」（對應地圖、建照圖、Google Maps 座向）時才需要加回磁偏角：

```
真北方位 = 磁北方位 + D          （D 東偏為正）
台北 D = −5.06°  ⇒  真北讀數比磁北讀數小約 5 度
```

> ⚠️ **不要混為一談**：三合盤的「天盤縫針」「人盤中針」各偏 7.5°，那是**盤面刻度的人為偏移**，與地球磁偏角是兩回事。
> UI 建議明確標示目前是「磁北（傳統磁針）」還是「真北（地圖座向）」並提供切換。

### 1.6 heading 計算數學（含一個關鍵陷阱）

#### (A) 平放 —— 羅盤該用這個

W3C 規格 §1 Introduction **原文**：
> "A device lying flat on a horizontal surface with the top of the screen pointing West has the following orientation: `{ alpha: 90, beta: 0, gamma: 0 }`.
> **To get the compass heading, one would simply subtract alpha from 360 degrees.** As the device is turned on the horizontal surface, the compass heading is (360 − alpha)."

規格 §3.1 註解：「**alpha is in the opposite sense to a compass heading**」。

```js
const heading = (360 - alpha) % 360;   // 平放羅盤，穩定
```

#### (B) 直立（AR）—— W3C 附錄 A.1

規格附錄 A.1「Calculating compass heading」逐字：

```js
var degtorad = Math.PI / 180;

function compassHeading( alpha, beta, gamma ) {
  var _x = beta  ? beta  * degtorad : 0;
  var _y = gamma ? gamma * degtorad : 0;
  var _z = alpha ? alpha * degtorad : 0;

  var cX = Math.cos( _x ), cY = Math.cos( _y ), cZ = Math.cos( _z );
  var sX = Math.sin( _x ), sY = Math.sin( _y ), sZ = Math.sin( _z );

  var Vx = - cZ * sY - sZ * sX * cY;
  var Vy = - sZ * sY + cZ * sX * cY;

  var compassHeading = Math.atan( Vx / Vy );

  if      ( Vy < 0 ) { compassHeading += Math.PI; }
  else if ( Vx < 0 ) { compassHeading += 2 * Math.PI; }

  return compassHeading * ( 180 / Math.PI );
}
```
規格明言此式算的是「垂直於螢幕、指向螢幕背面」的向量的水平投影方位（AR 用途），且**前提是 β 與 γ 不同時為零**。

#### 🔴 陷阱：這段廣為流傳的程式碼在羅盤平放時回傳 `NaN`

實際數值驗證結果：

| alpha | beta | gamma | A.1 結果 | `(360−alpha)%360` |
|---|---|---|---|---|
| 0 / 45 / 90 / 180 / 270 / 359 | **0** | **0** | **NaN**（Vx=0, Vy=0 → `atan(0/0)`） | 0 / 315 / 270 / 180 / 90 / 1 |
| 0 / 90 / 180 / 270 | 1° | 0 | 0 / 270 / 180 / 90 ✓ | 相同 ✓ |

**羅盤本來就是平放使用的**——照抄 A.1 會讓核心功能直接失效。
npm 上的 `kompas@1.0.0` 就是原封不動用 A.1，並用 `!Number.isNaN(heading)` 靜默吞掉，結果是**平放時完全不發事件**。

**⇒ 平放用 `(360 − alpha)`，直立才用 A.1，或直接改用四元數／旋轉矩陣。**

#### (C) 四元數法（避開 gimbal lock）

> `DeviceOrientationControls` **已於 three.js r134 移除**（Migration Guide：「## 133 → 134 — `DeviceOrientationControls` has been removed.」）。以下是 r133 最後版本的原始碼，仍是最好的參考實作：

```js
const _zee = new Vector3( 0, 0, 1 );
const _q1  = new Quaternion( - Math.sqrt( 0.5 ), 0, 0, Math.sqrt( 0.5 ) ); // -PI/2 around x

const setObjectQuaternion = function ( quaternion, alpha, beta, gamma, orient ) {
  _euler.set( beta, alpha, - gamma, 'YXZ' );                     // 'ZXY' for the device, but 'YXZ' for us
  quaternion.setFromEuler( _euler );                              // orient the device
  quaternion.multiply( _q1 );                                     // camera looks out the back of the device
  quaternion.multiply( _q0.setFromAxisAngle( _zee, - orient ) );  // adjust for screen orientation
};
```

WebKit 內部同樣是先組 ZXY 旋轉矩陣再解 Tait-Bryan 角，`WebCoreMotionManager.mm` 有完整的 R[9] 矩陣與 `R[8] > 0 / < 0 / == 0` 三分支奇異點處理，可直接當範本。

#### (D) `screen.orientation.angle` 修正

W3C Screen Orientation 規格：
> "**Current orientation angle**: The angle in degrees that the screen is rotated **counter-clockwise** from its natural orientation."

支援度（BCD）：Chrome 38 / Firefox 43 / **Safari 16.4 / iOS Safari 16.4** → 今日可安全使用。
`window.orientation`（three.js r133 用的那個）BCD 標記 **deprecated**，桌機三大瀏覽器皆 false → **不要用**。

W3C DeviceOrientation §3.1 明定裝置座標系**不隨螢幕旋轉改變**：
> "If the orientation of the screen changes when the device is rotated…, **this does not affect the orientation of the coordinate frame relative to the device**."

```js
const headingDevice = isIOS ? e.webkitCompassHeading : (360 - e.alpha) % 360;
const headingScreen = (headingDevice - (screen.orientation?.angle ?? 0) + 360) % 360;
```

> ⚠️ **這條修正式的正負號是推導而非引用**（W3C 沒有給這條公式）。推導依據：`angle` 為螢幕相對機身**逆時針**旋轉度數，而羅盤方位**順時針**遞增，故取減號；方向與 three.js 的 `setFromAxisAngle(_zee, -orient)` 一致。**務必實機驗證。**
> **最省事的做法：把 app 鎖成 portrait**（或把錶盤畫在裝置座標系），這條修正就完全不需要，也就沒有正負號 bug 的風險。

### 1.7 桌機／無感測器的 fallback

**沒有找到權威規範或官方指引在講這件事**（列入 §7）。可驗證的事實只有：

- 桌機三大瀏覽器普遍無磁力計；註冊 `deviceorientation` 後可能**永遠不觸發**。
- ⚠️ `window.DeviceOrientationEvent` 在桌機 Chrome **是存在的** → **不能只靠 feature detection，必須設 timeout 判定「無感測器」**。

實務可行的 fallback（**建議，非查證所得**）：手動轉盤輸入／地圖點選朝向／`Geolocation.coords.heading`（僅移動中有效）。

`kompas@1.0.0`（MIT，2025-06-13）的 capability 選擇順序可作為 pattern 參考：
```js
const DO_EVENT = 'ondeviceorientationabsolute' in window
    ? 'deviceorientationabsolute' : 'deviceorientation';
// 讀值優先序：ev.compassHeading → ev.webkitCompassHeading → (ev.absolute && 算式)
```

### 1.8 Generic Sensor API 能取代嗎？——不能

| 介面 | Chrome | Chrome Android | Firefox | Safari | Safari iOS |
|---|---|---|---|---|---|
| `Sensor` | 67 | mirror | **false** | **false** | **false** |
| `AbsoluteOrientationSensor` | 67 | mirror | **false** | **false** | **false** |
| `RelativeOrientationSensor` | 67 | mirror | **false** | **false** | **false** |
| `OrientationSensor` | 67 | mirror | **false** | **false** | **false** |
| `Magnetometer` | **56，但仍鎖在 `#enable-experimental-web-platform-features` 旗標後**（BCD `status.experimental: true`） | mirror | **false** | **false** | **false** |

**判定：不可行。** iOS 完全不支援 → PWA 在 iPhone 上無路可走；`Magnetometer` 連在 Chrome 都還在旗標後面。
**`DeviceOrientationEvent` 仍是 2026 年唯一可攜的羅盤路徑。**

### 1.9 磁偏角（WMM2025）

#### (a) 模型現況

NOAA NCEI 官方頁面原文：
> "The current version (**WMM2025**) was released on **December 17, 2024**, and will remain valid until late 2029."
> "the current model expires on **December 31, 2029**." 輸入日期範圍 **2025.0 to 2030.0**

- **係數檔直接下載**：`https://www.ncei.noaa.gov/sites/default/files/2024-12/WMM2025COF.zip`（HTTP 200，42,887 bytes）
  內含 `WMM.COF`、`WMM2025.COF`、`WMM2025_TestValues.txt`、`README-WMM-COEFS.txt`
- 檔頭實測：`2025.0            WMM-2025     11/13/2024`，共 93 行（1 檔頭 + 90 係數 + 終止符），**degree/order 12**
- 官方測試值：`https://www.ncei.noaa.gov/sites/default/files/2025-02/WMM2025_TEST_VALUES.txt`
- **WMMHR**（高解析度版）存在，degree 15。對羅盤 app 屬 overkill，且 JS 生態無現成套件。

#### (b) 台灣磁偏角 —— NOAA 官方 API 實測（兩個獨立來源交叉驗證）

呼叫 `https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination?lat1=..&lon1=..&model=WMM&startYear=2026&startMonth=9&startDay=5&resultFormat=json&key=zNEw7`
回應 `"model": "WMM-2025"`，日期 2026.6768：

| 城市 | 緯度 | 經度 | **磁偏角** | 方向 | 年變化 | 不確定度 |
|---|---|---|---|---|---|---|
| **台北** | 25.03 | 121.56 | **−5.057°** | **西偏 W** | −0.0376 °/yr | ±0.30° |
| 花蓮 | 23.98 | 121.60 | −4.818° | 西偏 W | −0.0378 °/yr | ±0.30° |
| 台中 | 24.15 | 120.68 | −4.737° | 西偏 W | −0.0353 °/yr | ±0.30° |
| 澎湖馬公 | 23.57 | 119.58 | −4.452° | 西偏 W | −0.0322 °/yr | ±0.30° |
| 金門 | 24.43 | 118.32 | −4.441° | 西偏 W | −0.0287 °/yr | ±0.30° |
| 高雄 | 22.63 | 120.30 | −4.346° | 西偏 W | −0.0343 °/yr | ±0.30° |

台北隨時間漂移：2025.0 = −4.994°、2026-09-05 = −5.057°、2027-01-01 = −5.069°、2029-01-01 = −5.144°、2030.0 = −5.182°

> ★ **台灣是西偏（W），不是東偏。** 這點常被弄錯，以上為 NOAA 官方 API 直接回傳值。
> 獨立交叉驗證：另以官方 `WMM2025.COF` + `pygeomag` 自行計算台北得 **−5.0572°**，先以 NOAA 官方 100 筆測試值驗證計算引擎（**max diff 0.0050°，0 筆失敗**）。兩來源吻合到小數第 5 位。

> 💡 **實務建議**：整個 WMM2025 週期（2025–2030）台北都在 −5.0° ~ −5.2° 之間。
> 若不想引入任何函式庫，**硬編 `-5.1` 全期誤差 < 0.11°**，遠小於模型本身的 ±0.30° 不確定度，更遠小於手機磁力計實際 ±10° 的誤差。
> 但要涵蓋全台（−4.3° ~ −5.1°，跨度 0.7°）或未來擴及海外，就用套件。

#### (c) npm 套件比較（全部實測 tarball，並用 NOAA 官方 100 筆測試值數值驗證）

| 套件 | 版本 | 發布日 | 週下載 | 授權 | **內嵌 WMM epoch** | 對 NOAA 100 筆測試值 | 判定 |
|---|---|---|---|---|---|---|---|
| **`magvar`** | **2.2.0** | 2026-08-14 | 5,570 | **MIT** | **2025** ✅ | **max diff 0.0000°，0 fail（逐筆完全吻合）** | ✅ **首選** |
| **`geomagnetism`** | **0.2.0** | 2024-12-22 | 59,002 | Apache-2.0 | **2025** ✅（另含 2020/2015v2/2015） | max diff 0.0050°，0 fail | ✅ 次選 |
| `geomag` | 1.0.0 | 2020-07-19 | 1,320 | MIT | **2020** ❌ | 未測 | ❌ **過期**（WMM2020 已於 2025-01-01 失效） |
| `@cristianob/geomagnetism` | 0.2.0 | 2024-12-17 | 53 | Apache-2.0 | 2025（upstream fork） | 未測 | ⚠️ 無理由捨 upstream |
| `@wemap/geomagnetism` | 0.1.2 | 2023-01-10 | 17 | Apache-2.0 | **2015** ❌ | 未測 | ❌ 嚴重過期 |
| `geomagnetism-no-path` | 0.1.0 | 2019-08-22 | 16 | Apache-2.0 | **2015** ❌ | 未測 | ❌ 嚴重過期 |
| `wmm` | 1.0.1 | 2022-04-25 | 2 | ISC | **無**（整包 306 bytes，內容是 `function arr(a,b){return a+b}`） | — | ❌ **佔名垃圾包** |
| `qibla-compass` | 1.0.1 | 2026-03-15 | 7 | MIT | **無模型**——執行時 fetch NOAA API，離線退回粗略緯度帶查表 | — | ❌ **PWA 離線不可用** |
| `world-magnetic-model` | — | — | — | — | — | — | ❌ **npm 上不存在** |
| `@ngdc/wmm` | — | — | — | — | — | — | ❌ 搜尋不到 |

**瀏覽器可用性（對 Vite/PWA 關鍵）**：兩個可用套件 grep `require('fs')` / `require('path')` / `__dirname` / `readFileSync` → **皆 0 hits**，純運算、無 Node 內建相依，可直接進瀏覽器 bundle。

**體積實測**：

| | 原始 | gzip |
|---|---|---|
| `magvar` 全部 src（3 檔） | 13.3 KB | **3.8 KB** |
| `geomagnetism` 程式碼 + wmm-2025.json | — | **6.0 KB** |

**選型結論**

- **`magvar@2.2.0` — 首選。** MIT、最小（3.8 KB gzip）、**唯一對 100 筆官方測試值逐筆完全吻合**、只含 2025 一個 epoch、repo 活躍（最後推送 2026-08-02）、有 `exports` map、超出效期會 `console.warn`。
  API：`magvar(lat, lon, alt?, when?)` / `magneticField(...)`，**正值 = 東偏**。
- **`geomagnetism@0.2.0` — 次選。** 下載量高 10 倍、附 `.d.ts`、會依日期自動選 epoch。缺點：`index.js` 會 `require` 全部 4 個 epoch 的 JSON（多 ~11 KB 進 bundle）；純 CJS（無 `module` / `exports` / `type` 欄位，須靠 Vite 的 CJS 預打包）；repo 自 2024-12-22 起無新推送。

**若要自己實作**：球諧展開流程為（1）時間內插 `g(t) = g(t₀) + ġ·(t−t₀)`，t₀ = 2025.0；（2）大地座標→地心球座標（WGS-84）；（3）Schmidt semi-normalized 連帶 Legendre 函數；（4）求 X'(北)/Y'(東)/Z'(下) 再旋轉回大地座標；（5）**`D = atan2(Y, X)`**。
參考實作：NOAA 官方 C 版；Python [`pygeomag`](https://github.com/boxpet/pygeomag)（MIT，內含的 `WMM_2025.COF` 實測與 NOAA 官方檔 byte-identical）；
⚠️ JS 的 [`geomagJS`](https://github.com/cmweiss/geomagJS) 最後推送 2019-07-17 → **WMM2015，已過期，別用**。

### 1.10 羅盤校正 UX

#### (a) 有沒有偵測校正狀態的 Web API？

**`compassneedscalibration` 事件已從規格移除，且從未有任何瀏覽器實作。**

一手證據：
1. W3C 規格 Changes 章節逐字：「**Remove the `oncompassneedscalibration` event**」
2. 移除的 PR 本文逐字：**「There are no implementations of this event.」**——[w3c/deviceorientation#107](https://github.com/w3c/deviceorientation/pull/107)（2023-03-22 merged），修掉 [issue #38](https://github.com/w3c/deviceorientation/issues/38)
3. BCD `Window.json` / `DeviceOrientationEvent.json` grep `calibrat` → **0 hits**
4. MDN `window/compassneedscalibration_event/index.md` → **404**
5. WebKit `GlobalEventHandlers.idl` / `EventNames.h` 等 → 各 **0 hits**

#### (b) 各平台實際拿得到的訊號

| 平台 | 訊號 | 語意 |
|---|---|---|
| **iOS Safari** | **`event.webkitCompassAccuracy`** | 正值 = 與磁北的最大偏差度數（越小越準，典型 ±10）；**負值 = 讀數無效（未校正或強磁干擾）** |
| **Android Chrome** | **無** | `deviceorientationabsolute` 沒有任何 accuracy 欄位（Blink IDL 只有 alpha/beta/gamma/absolute + requestPermission） |
| Android 原生層（**未暴露給 web**） | `SENSOR_STATUS_ACCURACY_HIGH/MEDIUM/LOW/UNRELIABLE`、`TYPE_ROTATION_VECTOR` 的 `values[4]` | `LOW` = 「需要對環境校正」；`UNRELIABLE` = 「不可信任，需要校正」 |

**⇒ 唯一可用的檢查是 iOS 的一行：**

```js
const accuracy = e.webkitCompassAccuracy;
if (accuracy == null || accuracy < 0) showCalibrationPrompt();   // 讀數無效
else if (accuracy > 15)              showLowAccuracyWarning();   // 誤差過大（門檻為經驗值，非規格）
```

#### (c) 能不能叫出 iOS 系統的 8 字校正畫面？——不能

Apple `locationManagerShouldDisplayHeadingCalibration(_:)` 文件原文：
> "If you return [true] from this method, Core Location displays the heading calibration alert… **The calibration alert prompts the user to move the device in a particular pattern** so that Core Location can distinguish between the Earth's magnetic field and any local magnetic fields."
> "If you return [false] **or do not provide an implementation for it in your delegate, Core Location does not display the heading calibration alert.**"

WebKit 原始碼 grep `shouldDisplayHeadingCalibration` → **0 hits**。
**⇒ 網頁永遠叫不出系統校正畫面，只能自己畫提示 UI。**

（這段 Apple 文件同時也是「8 字手勢」在官方語彙中的權威描述——"move the device in a particular pattern"。）

#### (d) 實務建議

**有 API 依據的**：
1. iOS：`webkitCompassAccuracy < 0` → 顯示 8 字校正動畫（唯一有依據的判斷）
2. Android：**無 API**，只能無條件在首次使用時顯示一次校正引導
3. 兩平台都提示「遠離金屬、磁鐵、手機殼磁扣、電腦」——依據是 Apple 文件明示的 "strong interference from local magnetic fields"

**未查證的啟發式（folklore，見 §7）**：比對陀螺儀積分的相對 heading 與磁力計絕對 heading 的漂移量、偵測讀數抖動幅度。社群廣泛使用，但**找不到任何一手來源支持**。

---

## 2. AR 與空間掃描

### 2.1 iOS Safari 到底支不支援 `immersive-ar`？——結論：不支援，而且連旗標都沒有

這是最常被誤傳的一點，逐一列出一手證據：

**證據 A — caniuse 原始資料檔**
`https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/webxr.json`（抓取 2026-09-05）：

| 瀏覽器 | 最近版本的值 | 解讀 |
|---|---|---|
| `ios_saf` | 26.3=`n`, 26.4=`n`, 26.5=`n`, **26.6=`n`** | `n` = 不支援。**沒有 `d` 標記**，代表連「預設關閉的旗標」都沒有 |
| `safari`（macOS） | 26.5/26.6/27/TP = `n d` + note#3 | `d` = disabled by default。note#3：「Can be enabled in Safari with the `WebXR Device API` experimental feature」 |
| `chrome` | 151–154 = `a`（partial） | |
| `and_chr` | 151 = `a` | |
| `samsung` | 27–30 = `a` | |
| `firefox` | 154–157 = `n d` + note#2 | 旗標 `dom.vr.webxr.enabled` |
| `edge` | 148–151 = `a` | |

全球使用率 `usage_perc_a` = **75.54%**，`usage_perc_y` = 0（沒有任何瀏覽器算「完整支援」）。規格狀態 `cr`（Candidate Recommendation）。

> **注意這個對比**：macOS Safari 有實驗旗標可以開，**iOS Safari 連旗標都沒有**。這是 caniuse 資料裡明確可見的差別，不是推測。

**證據 B — MDN browser-compat-data**
所有 XR 介面（`XRSystem`、`XRSession`、`XRFrame`、`XRHitTestSource`、`XRPlane`、`XRAnchor`、`XRDepthInformation`、`XRLightProbe`、`XRCamera`）的 `safari` 皆為 `false`，`safari_ios` 為 `mirror`（跟隨 safari，即同為 false）。

**證據 C — WebKit 官方管道（重要：狀態頁已下線）**
- `https://webkit.org/status/` 現在只顯示 **「The WebKit Feature status page has been retired.」**，導向 MDN / caniuse / WebKit Standards Positions。
  → **2026 年起「以 WebKit 功能狀態頁為準」這個做法本身已經失效**，得改看 standards-positions + Safari release blog。
- WebKit standards-positions（`https://github.com/WebKit/standards-positions/issues`）：

| Issue | 標題 | 立場 | 狀態 |
|---|---|---|---|
| #155 | WebXR Device API | **未表態** | Open |
| #608 | WebXR Plane Detection Module | 未表態 | Open |
| #503 | WebXR Depth Sensing Module | 未表態（標註 concerns: complexity / privacy） | Open |
| #601 | WebXR Layers API | support | Closed |
| #395 | WebXR Hand Input L1 | support | Closed |
| #37 | WebXR Raw Camera Access | **oppose** | Closed |

  → 核心的 WebXR Device API **連立場都還沒表**。

- Safari release blog 逐篇查核：
  - **Safari 26.0**（2025-09-15，`webkit.org/blog/17333/`）：visionOS 26 新增 `<model>` 元素、Apple Immersive Video、APMP 投影格式。**全文未提 WebXR `immersive-ar`**。
  - **Safari 26.2**（2026-02-04，`webkit.org/blog/17640/`）：「WebXR on visionOS now supports WebGPU」——只講 visionOS。
  - **Safari 26.6**（2026-07-27，`webkit.org/blog/18178/`，涵蓋 iOS/iPadOS/visionOS/macOS 26.6）：**全文無任何 WebXR / AR / DeviceOrientation 條目**。

**證據 D — visionOS Safari**
visionOS Safari 支援 WebXR `immersive-vr`，但 **AR 模組（`immersive-ar`）未啟用**。這點在 §7 標為部分未驗證（BCD 沒有 visionOS 欄位，caniuse 也不分列），可確定的是 Apple 官方 blog 從未宣告 `immersive-ar` 可用。

### 2.2 Chrome 各模組出貨狀況（Chrome Platform Status API，2026-09-05）

環境基準：**Chrome stable = 153.0.8010.27**（Android 與 Windows 同版，`versionhistory.googleapis.com`）。

| 模組 | 狀態 | 里程碑 | chromestatus ID |
|---|---|---|---|
| WebXR AR Module | Enabled by default | 81 | 5450241148977152 |
| WebXR Hit-test | Enabled by default | 81 | 4755348300759040 |
| WebXR Anchors | Enabled by default | 79（BCD 記 85） | 5129925015109632 |
| WebXR DOM Overlay | Enabled by default | 83 | 6048666307526656 |
| WebXR Depth API | Enabled by default | 90（android） | 5742647199137792 |
| WebXR AR Lighting Estimation | Enabled by default | 90 | 5704707957850112 |
| WebXR Raw Camera Access | Enabled by default | 107（android） | 5759984304390144 |
| WebXR Hand Input L1 | Enabled by default | 131 | 6290425179275264 |
| WebXR `enabledFeatures` | Enabled by default | 111 | 5082665189900288 |
| **WebXR Plane Detection** | **已出貨** | **147** | 5177993049800704 |
| WebXR Layers | 147 | 147 | 6634466544058368 |
| WebXR Image Tracking | No active development | — | 6548327782940672 |
| WebXR/WebGPU integration | No active development | — | 5077077997649920 |
| WebXR dynamic viewport scaling | 旗標（88） | — | 5640976515203072 |
| **mesh-detection / XRMesh** | **Chrome 無此條目（查詢 0 筆）** | — | — |

**Chrome Android 上這些全部預設開啟，不需要 flag、不需要 Origin Trial。**

### 2.3 plane-detection 到底出貨了沒？——出了，Chrome 147

這題 chromestatus 給了矛盾訊號，值得記錄查證過程：

- chromestatus feature `5177993049800704` 的 `status.text` 仍寫 **"Proposed"**，`is_released` 為 **false**；
- 但同一筆的 ship stage（stage_type 260）記 `desktop_first: 147, android_first: 147`，`shipping_year: 2026`，`feature_type: "Chromium catches up"`；
- 另有一筆 2019 年的舊條目 `5732397976911872`「WebXR Plane Detection API」status = Origin trial, android=77（早已結束，容易誤導）。

三份決定性證據把它定案為**已出貨**：

1. **Chrome 官方 release notes**：`https://developer.chrome.com/release-notes/147` 正文列出
   「WebXR Plane Detection — The WebXR Plane Detection API lets sites retrieve the set of planes detected in the user's environment…」
2. **chromestatus API 依里程碑查詢**：`/api/v0/features?milestone=147` 把「WebXR Plane Detection」歸在 **"Enabled by default"** 分類下。
3. **Chromium 原始碼**（決定性）：`third_party/blink/renderer/platform/runtime_enabled_features.json5`
   ```json5
   { name: "WebXRPlaneDetection", depends_on: ["WebXR"], status: "stable" },      // ← 正式版預設開啟
   { name: "WebXRMeshDetection",  depends_on: ["WebXR"], status: "experimental" }, // ← 需旗標
   ```
4. **MDN BCD** 交叉確認：`XRPlane` / `XRPlane.polygon` / `XRPlane.orientation` / `XRPlane.semanticLabel` / `XRPlaneSet` / `XRFrame.detectedPlanes` / `XRSession.initiateRoomCapture` 全部 = `chrome: 147`、`chrome_android: mirror`、`oculus: 31.2`、`safari: false`、`firefox: false`。

Chrome Android 147 首次進入 stable：**2026-03-25**（v147.0.7727.24，Google version history API）。現役 stable 已是 153，等於**現在的 Android 使用者普遍具備此能力**。

> ⚠️ 文件落後於實作：MDN **沒有** `XRPlane` 與 `XRFrame.detectedPlanes` 的說明頁（實測 404），只有 BCD 相容性資料。寫 code 要直接讀 spec IDL。

### 2.4 房間掃描：`initiateRoomCapture()` 與 `XRPlane`

**Plane Detection 的 WebIDL**（`https://github.com/immersive-web/plane-detection/blob/main/index.bs`）：

```webidl
enum XRPlaneOrientation { "horizontal", "vertical" };

[Exposed=Window]
interface XRPlane {
    [SameObject] readonly attribute XRSpace planeSpace;
    readonly attribute FrozenArray<DOMPointReadOnly> polygon;
    readonly attribute XRPlaneOrientation? orientation;
    readonly attribute DOMHighResTimeStamp lastChangedTime;
    readonly attribute DOMString? semanticLabel;
};

interface XRPlaneSet { /* Set-like: has(), size, entries(), values(), forEach() */ };

partial interface XRFrame   { readonly attribute XRPlaneSet detectedPlanes; };
partial interface XRSession { Promise<undefined> initiateRoomCapture(); };
```

**`XRSession.initiateRoomCapture()`** 是本專案「掃描房間」需求的官方入口。Spec 原文：
> 「will ask the XR device to capture the current room layout. It is up to the XR device if this will replace or augment the set of tracked planes.」

支援度：**Chrome 147+、Quest Browser 31.2+**（MDN BCD `api/XRSession.json`）。MDN 尚無說明頁。

兩個實作要點：
1. `plane.polygon` 的座標在 **planeSpace 的局部座標系**，spec 明定 **planeSpace 的 Y 軸即平面法向量**，所以水平面（地板）的多邊形落在 XZ 平面上——這就是為什麼官方範例只取 `point.x` 與 `point.z`。
2. 找地板：`plane.orientation === 'horizontal'` 加上 `plane.semanticLabel === 'floor'`。

### 2.5 mesh-detection：Quest 專屬，Chrome 沒有

- MDN BCD `XRFrame.detectedMeshes`：`chrome: false`、`chrome_android: mirror`、**`oculus: 31.2`**、`safari: false`、`firefox: false`。
- BCD 中**不存在** `XRMesh.json` / `XRMeshSet.json`（實測 404）。
- Chromium `WebXRMeshDetection` = `status: "experimental"`，且**沒有對應的 chromestatus 出貨條目**，代表沒有出貨計畫。
- Spec repo `https://github.com/immersive-web/real-world-meshing` 最後推送 2026-02-02，README 幾近空白。
- Spec 頁面確認存活：`https://immersive-web.github.io/real-world-meshing/` →「WebXR Mesh Detection Module」，`XRMesh` ×21、`detectedMeshes` ×5。

→ **本專案不能依賴 mesh-detection。**

### 2.6 three.js 現況（r185）

| 項目 | 值 | 來源 |
|---|---|---|
| npm `three` latest | **0.185.1** | registry.npmjs.org（發佈 2026-07-01T14:04Z） |
| GitHub release tag | **r185**（2026-07-01） | api.github.com releases/latest |
| repo 活躍度 | ★115,142，最後推送 2026-09-05（當日） | api.github.com |
| License | MIT | |
| 週下載 | 15,193,062 | |
| **內建 TypeScript 型別** | **無**（`types` / `typings` 欄位皆不存在，`exports` 無 types condition） | package.json 實測 |
| `@types/three` | **0.185.4**（2026-08-04，MIT） | 仍然必要 |
| `@types/webxr` | 0.5.24 | **`@types/three` 已把它列為 dependency（`>=0.5.17`），不必手動安裝** |

`exports` 對應：`.` → `build/three.module.js`（WebGL）；`./webgpu` → `build/three.webgpu.js`；`./addons/*` → `examples/jsm/*`；`./tsl`。

**`examples/jsm/webxr/` 實際檔案清單**（GitHub Contents API，`dev` 分支）：
```
ARButton.js  VRButton.js  XRButton.js  WebGLXRFallback.js
XRPlanes.js  XREstimatedLight.js
XRControllerModelFactory.js  XRHandModelFactory.js
XRHandMeshModel.js  XRHandPrimitiveModel.js
OculusHandModel.js  OculusHandPointerModel.js  Text2D.js
```
→ `ARButton.js` 仍在。**沒有** anchors 或 depth 的封裝類別，那兩者要寫原生 API。

**官方 AR 範例只有 5 個**（`examples/files.json` 的 `webxr` 分類）：

| 功能 | 範例 | 原始碼 |
|---|---|---|
| Hit test | [webxr_ar_hittest](https://threejs.org/examples/#webxr_ar_hittest) | [GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_hittest.html) |
| Plane detection | [webxr_ar_plane_detection](https://threejs.org/examples/#webxr_ar_plane_detection) | [GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_plane_detection.html) |
| Light estimation | [webxr_ar_lighting](https://threejs.org/examples/#webxr_ar_lighting) | [GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_lighting.html) |
| Camera access | [webxr_ar_camera_access](https://threejs.org/examples/#webxr_ar_camera_access) | [GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_camera_access.html) |
| 基本 AR | [webxr_ar_cones](https://threejs.org/examples/#webxr_ar_cones) | [GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_cones.html) |

**沒有 anchors 範例，沒有獨立的 AR depth 範例。** 深度感測唯一官方示範在 VR 分類的 `webxr_xr_dragging_custom_depth.html`。

**`renderer.xr`（WebXRManager）實際 API**（讀 `src/renderers/webxr/WebXRManager.js` 原始碼，非文件頁）：
- 屬性：`enabled`（預設 false）、`isPresenting`、`cameraAutoUpdate`
- 方法：`setReferenceSpaceType(v)`（**預設 `local-floor`**）、`getReferenceSpace()`、`setReferenceSpace()`、`getSession()`、`setSession()`（async）、`getFrame()`、`getCamera()`、`getBinding()`、`getBaseLayer()`、`getEnvironmentBlendMode()`、`getDepthTexture()`、`hasDepthSensing()`、`getDepthSensingMesh()`、`getCameraTexture(xrCamera)`、`getFoveation()`/`setFoveation()`、`setAnimationLoop()`
- 事件：`sessionstart`、`sessionend`、**`planesdetected`**

> 官方文件頁 `threejs.org/docs/#api/en/renderers/webxr/WebXRManager` **未列出** `getDepthTexture` / `hasDepthSensing` / `getCameraTexture` / `getBinding` / `getBaseLayer`。以原始碼為準。

**`ARButton.createButton(renderer, sessionInit)` 的三個隱藏行為**（讀原始碼）：
1. 若未傳 `domOverlay`，**自動**建立含關閉鈕的 overlay div 並 `optionalFeatures.push('dom-overlay')`；
2. session 開始時**強制** `renderer.xr.setReferenceSpaceType('local')`（覆寫 WebXRManager 的 `local-floor` 預設）；
3. 結束後若有 `navigator.xr.offerSession` 就主動 offer。

**`XRPlanes.js` 的重大限制**：它對每個 plane 只取 polygon 的 **AABB 包圍盒**（min/max of x,z）做成薄 `BoxGeometry`——**真實多邊形被丟棄**。要精確貼合不規則房型，必須自己用 `plane.polygon` 建 `ShapeGeometry`。

### 2.7 Renderer 選擇：用 WebGLRenderer，不要用 WebGPU

- WebGPURenderer **尚未成為預設**：主 entry 仍是 WebGL，WebGPU 走獨立 entry `three/webgpu`。
- r185 才首次為 WebGPU 加上 WebXR 支援（PR #33583 / #33497）。
- 但 r185 同時新增的 `WebGLXRFallback.js` 揭露了真實狀況：
  ```js
  if ( session !== null && renderer.backend.isWebGPUBackend === true
       && typeof globalThis.XRGPUBinding === 'undefined' ) {
      return switchToFallbackRenderer( session, renderer );
  }
  ```
  `XRGPUBinding` 在 Chromium 對應 `WebXRGPUBinding`，狀態 **experimental**（需旗標）；chromestatus「WebXR/WebGPU integration」= **No active development**。
- → 對一個要穩定投影九宮飛星的 app，AR 啟動瞬間重建 renderer 是不必要的風險。**用 `WebGLRenderer`。**

### 2.8 React 整合

| 套件 | 版本 | 發佈 | peerDependencies | License |
|---|---|---|---|---|
| `@react-three/fiber` | **9.7.0** | 2026-07-31 | `react: ">=19 <19.3"`, `react-dom: ">=19 <19.3"`, `three: ">=0.156"` | MIT |
| `@react-three/xr` | **6.6.30** | 2026-05-29 | `react: ">=18"`, `@react-three/fiber: ">=8"`, `three: "*"` | SEE LICENSE IN LICENSE（repo pmndrs/xr，★2,607） |

> ⚠️ **R3F v9 的 React 上限鎖在 `<19.3`**。原因是 R3F 內含 react-reconciler，而 React 19.2.x 升級了內部 reconciler 且不向下相容。升 React 時要注意這個天花板。v10 目前只有 canary。

**`@react-three/xr` 實際 export 的 hooks**（讀 `packages/react/xr/src/` 原始碼）：

| 檔案 | 匯出 |
|---|---|
| `hit-test.tsx` | `useXRHitTestSource()`, **`useXRHitTest()`**, `useXRRequestHitTest()`, `<XRHitTest>` |
| `plane.tsx` | **`useXRPlanes(semanticLabel?)`**, **`useXRPlaneGeometry(plane, disposeBuffer?)`**, `<XRPlaneModel>` |
| `mesh.tsx` | `useXRMeshes()`, `useXRMeshGeometry()`, `<XRMeshModel>` |
| `anchor.tsx` | **`useXRAnchor()`**, `useRequestXRAnchor()`, `useXRPersistentAnchor()`, `useRequestXRPersistentAnchor()`, `useLoadXRPersistentAnchor()`, `useDeleteXRPersistentAnchor()` |
| `dom-overlay.tsx` | `<XRDomOverlay>` |

→ hit-test、planes、anchors、mesh、dom-overlay **全部有一級 hook**。`useXRPlanes('floor')` 可直接依語意標籤過濾，`useXRPlaneGeometry` 直接把 `XRPlane.polygon` 轉成 `BufferGeometry`——正是本專案要的。深度感測**沒有**專屬 hook。

### 2.9 沒有 WebXR 時的 fallback

#### (a) `<model-viewer>` / AR Quick Look —— 只能看，拿不到任何空間資料

`@google/model-viewer` **4.3.1**（2026-06-04，Apache-2.0）。

AR 相關 API：屬性 `ar` / `ar-modes`（`webxr`｜`scene-viewer`｜`quick-look`）/ `ar-scale` / `ar-placement`（`floor`｜`wall`）/ `ios-src` / `xr-environment`；方法 `activateAR()`（須在同步 user gesture 內）；屬性 `canActivateAR`；事件 `ar-status` / `ar-tracking` / `quick-look-button-tapped`。

**關鍵：AR session 不回傳任何空間資料給 JS。** `ar-status` 的 payload 型別就只是：
```ts
export interface ARStatusDetails { status: ARStatus; }
```
一個列舉字串，沒有座標、沒有平面、沒有尺寸。原始碼中不存在把 hit-test 或 plane 資料往外拋的路徑。

> **易混淆處**：model-viewer 確實有 `positionAndNormalFromPoint()` / `surfaceFromPoint()` / `queryHotspot()` 會回傳世界座標——但那是對**已載入的 glTF 模型自身網格**做 raycast（用來放 hotspot），**與真實世界的 AR 平面無關**，且 Quick Look 模式下完全用不上（那時渲染根本不在網頁裡）。

**AR Quick Look 能不能取得房間幾何？不能，完全不行。**
- 觸發：`<a rel="ar" href="model.usdz">`；格式 USDZ / `.reality`；需求 iOS 12+。
- 支援：實景放置、縮放、動畫、音訊、自訂橫幅、Apple Pay 橫幅。
- **唯一回傳通道**是 `document.addEventListener('_apple_ar_quicklook_button_tapped', …)`——只帶「按鈕被按了」這一個位元，不帶測量值、不帶平面幾何、不帶世界座標。
- AR Quick Look 是**黑箱檢視器**：網頁丟 USDZ 進去，系統接管全螢幕，結束後網頁什麼也拿不到。**這條路死透了。**

#### (b) 「偽 AR 羅盤」：getUserMedia + DeviceOrientation + three.js 疊圖

**這是 iOS 上唯一真正可行的網頁內 AR 路徑。**

| 檢查項 | 結果 | 來源 |
|---|---|---|
| iOS Safari 支援 `getUserMedia` | ✅ iOS 11+ | BCD `api/MediaDevices.json` |
| **PWA 加到主畫面（standalone）能用相機** | ✅ **iOS 13.4+（2020-03）** | WebKit bug [185448](https://bugs.webkit.org/show_bug.cgi?id=185448) **RESOLVED FIXED** |
| `facingMode: {exact:'environment'}` | ✅ 標準約束 | MDN getUserMedia |
| 需 HTTPS | ✅ 僅限 secure context | MDN |
| 切換鏡頭 | ⚠️ 切換前要先對舊 track 呼叫 `stop()` | MDN |
| `deviceorientation` | ✅ iOS Safari 4.2+ | BCD `api/Window.json` |

**能力上限（誠實說明）**：這套只給你「相機畫面 + 裝置姿態」。**沒有平面偵測、沒有深度、沒有 6DoF 位置追蹤、沒有比例尺。**
它能做的是「羅盤式疊圖」——把九宮飛星依方位角疊在相機畫面上。對風水 app **恰好夠用**（羅盤定向本來就是核心體驗）。但它做不到「掃描房間產生平面圖」。

#### (c) 照片透視校正 / 手動繪製 —— 全平台通用，成本最低

| 用途 | 方案 | 版本 |
|---|---|---|
| 透視校正（homography） | **`@techstark/opencv-js`**（`getPerspectiveTransform` / `warpPerspective` / `findHomography`） | **5.0.0-release.1**，2026-06-24，Apache-2.0 |
| 同上（舊，勿用） | `opencv.js` | 1.2.1，2022-05-12，已停更 4 年 |

**建議**：讓使用者拍一張平面圖照片（或建商圖），在 canvas 上拖四個角點，用 `getPerspectiveTransform` 做透視校正得到正射平面圖，再疊九宮格。這條路**在所有平台都能用**，不依賴任何 AR 能力。
競品 **Luopan（Manh Nguyen）** 的「POLAR RULER (立極)」就是這個做法（把羅盤疊在照片或平面圖上，可拖曳／旋轉／縮放／鎖圖層），驗證了它的市場可接受度。

#### (d) iOS 原生掃描橋接（屬「另一個產品」，非 PWA 範疇）

**Apple RoomPlan**（`developer.apple.com/documentation/roomplan`）：
- iOS 16+，**需 LiDAR**（iPhone 12 Pro 以上 Pro 機型、iPad Pro 2020+）
- **無 Web API**，純 Swift / ARKit
- `CapturedRoom` 含 `walls` / `doors` / `windows` / `openings` / `objects` / `floors` / `sections`，每個帶 `transform` 與 `dimensions`
- ★ **`CapturedRoom` 遵循 `Codable`** → 可直接 `JSONEncoder` 序列化成 JSON。這是**參數化房間結構**（牆的位置與長寬），不是三角網格——對「畫平面圖 + 疊九宮」比 USDZ 網格好用得多
- 匯出：`export(to:metadataURL:exportOptions:)`，`USDExportOptions` 含 `.mesh` / `.parametric` / `.model`

Apple **測距儀（Measure）** App：只能截圖存照片，**無結構化資料匯出**。

第三方：**Polycam**（有 Floor Plan 模式 + Content API，需申請）、**magicplan**（有公開 API 文件 `apidocs.magicplan.app`）。細節見 §7 未驗證。

### 2.10 Geolocation 與 Permissions

**Geolocation `PositionOptions`**：

| 成員 | 預設 | 注意 |
|---|---|---|
| `enableHighAccuracy` | `false` | 行動裝置會啟用 GPS；代價是變慢、耗電 |
| `timeout` | **`Infinity`** | ⚠️ 預設是「等到有結果為止」，**一定要自己設**，否則可能永久掛住 |
| `maximumAge` | `0` | `0` = 禁用快取強制重取 |

`GeolocationCoordinates.accuracy` 單位為公尺，**95% 信心水準**。MDN 未記載行動裝置的典型數值（見 §7）。僅限 HTTPS，受 `Permissions-Policy: geolocation` 管制。

**Permissions API — Safari 支援極為有限**（`navigator.permissions.query()`，Safari 16+）：

| permission name | Chrome Android | Safari / iOS |
|---|---|---|
| `geolocation` / `camera` / `microphone` | ✅ | ✅ 16 |
| `notifications` / `screen-wake-lock` | ✅ | ✅ 16.4 |
| `push` | ✅ | ✅ 17 |
| `storage-access` | ✅ 120 | ✅ 26.2 |
| **`accelerometer` / `gyroscope` / `magnetometer`** | ✅ | ❌ |
| `clipboard-read` / `midi` / `persistent-storage` / `background-sync` … | ✅ | ❌ |

`Permissions.request()` / `.revoke()` 在 **Safari 全不支援**，只有 `query()` 能用。

**有沒有 deviceorientation 的 permission name？沒有。** BCD 完整清單與 MDN 文件列出的 21 個名稱中都沒有 `deviceorientation` / `devicemotion`。取得裝置方位權限的唯一途徑是 `DeviceOrientationEvent.requestPermission()`（§1.3），它不走 Permissions API。

**`xr-spatial-tracking` 不是 permission name**，它是 **Permissions-Policy 的 feature 名稱**（用於 iframe `allow="xr-spatial-tracking"`）。這兩者常被混淆。

---

## 3. 2D 平面圖編輯

### 3.1 Canvas / SVG 函式庫比較

全部資料取自 npm registry API + bundlephobia + GitHub API，2026-09-05。

| 套件 | 版本 | 發佈日 | gzip | 週下載 | License | 內建型別 | GitHub |
|---|---|---|---|---|---|---|---|
| **`konva`** | **10.3.3** | **2026-09-04** | 54.0 KB | 2,835,653 | MIT | ✅ | ★14,757，推送 2026-09-04，open issues **0** |
| **`react-konva`** | **19.2.6** | **2026-09-04** | 39.3 KB | 2,235,562 | MIT | ✅ | ★6,408，推送 2026-09-04，open issues **0** |
| `fabric` | 7.4.0 | 2026-05-18 | 89.7 KB | 959,499 | MIT | ✅ | — |
| `pixi.js` | 8.20.1 | 2026-08-26 | 252.2 KB | 1,057,119 | MIT | ✅ | — |
| `@pixi/react` | 8.0.5 | 2025-12-01 | — | 86,954 | MIT | ✅ | — |
| `two.js` | 0.8.24 | 2026-08-29 | 47.9 KB | 24,542 | MIT | ✅ | — |
| `paper` | 0.12.18 | **2024-07-17** | 82.2 KB | 190,115 | MIT | ✅ | 停滯 2 年 |

**React 19 相容性（實測 peerDependencies 字串）**：

| 套件 | peerDependencies |
|---|---|
| **`react-konva@19.2.6`** | `react: "^19.2.0"`, `react-dom: "^19.2.0"`, `konva: "^8.0.1 \|\| ^7.2.5 \|\| ^9.0.0 \|\| ^10.0.0"` |
| `@pixi/react@8.0.5` | `react: ">=19.0.0"`, `pixi.js: "^8.2.6"` |

> `react-konva` 的主版號直接跟隨 React（19.x），**已是 React 19 專屬版本**，不需要任何 workaround。

### 3.2 推薦：react-konva

理由：

1. **維護狀態最好**——konva 與 react-konva 都在 **2026-09-04（調研前一天）** 發版，且 **open issues 都是 0**。這在 canvas 函式庫裡極罕見。
2. **React 19 原生就緒**，peer dep 直接寫死 `^19.2.0`。
3. **體積合理**：konva + react-konva 合計 gzip 約 93 KB，比 pixi.js 單獨的 252 KB 小得多。平面圖編輯器不需要 WebGL 級的繪圖效能。
4. **內建拖曳與變形**：`draggable` 屬性、`Transformer` 元件、`dragBoundFunc`（可用來做貼齊格線／貼齊牆面），這些正是平面圖編輯要的。
5. Fabric.js 也是合理選項（成熟、體積中等），但 API 是命令式的，與 React 的宣告式模型較不契合；Paper.js **已停滯兩年**，排除。

> 未查證項目：konva 的多點觸控 pinch-zoom 品質、`@pixi/react` 與 React 19 的實際整合細節，未做實機測試（見 §7）。

### 3.3 ★ 幾何運算：不要用 Turf

| 套件 | 版本 | 發佈日 | gzip | License | 備註 |
|---|---|---|---|---|---|
| `@turf/turf` | 7.4.0 | 2026-08-03 | 134.2 KB | MIT | 全量包 |
| `@turf/area` | 7.4.0 | 2026-08-03 | 1.1 KB | MIT | ⚠️ 見下 |
| `@turf/centroid` | 7.4.0 | 2026-08-03 | 0.9 KB | MIT | ⚠️ 見下 |
| `@turf/boolean-point-in-polygon` | 7.4.0 | 2026-08-03 | 1.7 KB | MIT | |
| `polygon-clipping` | 0.15.7 | 2023-12-18 | 8.5 KB | MIT | 停滯 |
| `polyclip-ts` | 0.16.8 | 2024-12-17 | 14.5 KB | MIT | polygon-clipping 的 TS 分支 |
| `@flatten-js/core` | 1.6.14 | 2026-08-18 | 21.5 KB | MIT | 純平面幾何，維護中 |
| `martinez-polygon-clipping` | 0.8.1 | 2025-12-07 | 5.5 KB | MIT | 布林運算，體積最小 |
| `earcut` | 3.2.3 | 2026-07-02 | 4.0 KB | ISC | 三角化（three.js 生態常用） |
| `polybooljs` | 1.2.2 | 2024-03-18 | — | MIT | 無型別 |
| `robust-point-in-polygon` | 1.0.3 | **2015-01-29** | — | MIT | 11 年未更新 |
| `poly2tri` | 1.5.0 | **2017-04-17** | — | BSD-3 | 週下載僅 2,028 |

#### ★ 決定性查證：Turf 假設的是 WGS84 經緯度，不是公尺卡氏座標

讀 `packages/turf-area/index.ts` 原始碼：

```ts
import { earthRadius } from "@turf/helpers";
/**
 * Calculates the **geodesic** area in square meters of one or more polygons.
 */
```

`@turf/area` 內部用 `earthRadius` 跑球面 ringArea 公式，**把座標當成 WGS84 經緯度**。
拿去算一個以公尺為單位的卡氏平面圖，會得到完全荒謬的數字。**不能用。**

再讀 `packages/turf-centroid/index.ts`：

```ts
coordEach(geojson, function (coord) { xSum += coord[0]; ySum += coord[1]; len++; }, true);
return point([xSum / len, ySum / len], options.properties);
```

`@turf/centroid` 只是**所有頂點的算術平均**，**不是面積加權形心**。
對風水的「立極」（找房屋幾何中心）來說這是錯的——頂點密集的那一側會把中心拉過去。不規則格局（L 型、缺角屋）誤差尤其明顯。

真正的多邊形形心在 `@turf/center-of-mass`（文件明指採 Centroid of Polygon 公式，且為平面運算，不涉 earthRadius）。

#### 建議：自寫卡氏公式，零依賴

平面圖的需求（小型卡氏多邊形、單位公尺、要面積／形心／點在多邊形內／線段相交）用課本公式即可，比任何函式庫都小、都準、也不會踩到地理座標假設：

```ts
type Pt = { x: number; y: number };

/** 有號面積（shoelace）。正 = 逆時針。取 abs 得面積 (m²) */
export function polygonArea(pts: Pt[]): number {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
  }
  return a / 2;
}

/** 面積加權形心 —— 這才是「立極點」 */
export function polygonCentroid(pts: Pt[]): Pt {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const f = pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    a += f;
    cx += (pts[j].x + pts[i].x) * f;
    cy += (pts[j].y + pts[i].y) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-12) {           // 退化多邊形 → 退回頂點平均
    const n = pts.length;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n,
             y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/** 點在多邊形內（ray casting） */
export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > p.y) !== (yj > p.y) &&
        p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}
```

**只有在需要多邊形布林運算時**（例如求「九宮格 ∩ 房屋輪廓」的實際重疊面積，用來判斷缺角率）才引入函式庫，此時選 **`martinez-polygon-clipping`**（5.5 KB gzip，最小）或 **`polyclip-ts`**（TS 原生）。

#### 實測驗證（本文附的程式碼已在 Node 實跑過）

以一間 10m×8m、右上角缺 4m×3m 的 L 型屋為測試案例（面積 68 m²）：

| 檢驗 | 結果 |
|---|---|
| `polygonArea` 矩形 10×8 | 80 ✅ |
| `polygonArea` L 型 | 68 ✅ |
| `polygonCentroid` L 型 | (4.470588, 3.558824) —— **與解析解逐位吻合** ✅ |
| `pointInPolygon` 缺角處 (8,7) | `false` ✅（正確判定在屋外） |
| 退化多邊形（三點共線） | 回退為頂點平均，不回傳 `NaN` ✅ |

★ **同一個 L 型屋，用 Turf `centroid` 的「頂點平均」算法會得到 (5.333, 4.333)，與正確立極點相差 1.159 公尺。**
一間 10 公尺寬的房子，立極點偏掉超過 1 公尺——九宮格整個位移，飛星判讀全錯。這就是 §3.3 開頭那個警告的實際代價。

同時實跑驗證了 §1.6 的 W3C 附錄 A.1 陷阱：`A1(alpha=90, beta=0, gamma=0)` 回傳 **`NaN`**，`A1(90, 90, 0)` 回傳 270.00 正常。
以及 §5.1 的螢幕旋轉與磁偏角換算：heading 10° + `angle` 90° → 280°；磁北 0° + 台北 D(−5.06°) → 真北 354.94°。

### 3.4 曆法：lunar-typescript（內建九星，重大加分）

| 套件 | 版本 | 發佈日 | gzip | 週下載 | License | 型別 | GitHub |
|---|---|---|---|---|---|---|---|
| **`lunar-typescript`** | **1.8.6** | 2025-11-05 | 98.2 KB | 66,388 | MIT | ✅ | ★370，推送 2026-08-13 |
| `lunar-javascript` | 1.7.7 | 2025-11-05 | — | 40,654 | MIT | ❌ | — |
| `tyme4ts` | 1.5.2 | 2026-06-12 | 71.5 KB | 14,698 | MIT | ✅ | ★495，推送 2026-08-17 |

**`tyme4ts` 是同作者（6tail）的後繼作品**，README 自述：
> 「Tyme是一个非常强大的日历工具库，**可以看作 Lunar 的升级版**，拥有更优的设计和扩展性」

節氣演算法引自壽星天文曆（[sxwnl](https://github.com/sxwnl/sxwnl)）。星數已反超（495 vs 370），體積也較小。

#### 真實 API（從 `src/lib/Lunar.ts` 原始碼抽取，共 212 個方法簽名——非憑記憶）

**干支年（★ 飛星年盤的關鍵）**

```ts
import { Solar } from 'lunar-typescript';

const lunar = Solar.fromYmd(2026, 9, 5).getLunar();

lunar.getYearInGanZhi()          // 以「正月初一」為界
lunar.getYearInGanZhiByLiChun()  // ★ 以「立春」為界 ← 飛星年盤用這個
lunar.getYearInGanZhiExact()     // 立春當日精確到時辰
```

同族方法：`getYearGanByLiChun()`、`getYearZhiByLiChun()`、`getYearShengXiaoByLiChun()`、`getYearXunByLiChun()`、`getYearXunKongByLiChun()`、`getYearGanIndexByLiChun()`、`getYearZhiIndexByLiChun()`

> ★ **這解決了飛星年盤的年界問題**：`getYearInGanZhi()` 用農曆正月初一為界，`getYearInGanZhiByLiChun()` 用立春為界。**飛星年盤必須用後者**——每年 1/1 到立春之間（約 2/4）這段期間兩者會給出不同的干支年，是最容易出錯的地方。

**二十四節氣**

```ts
lunar.getJieQiTable()      // Record<string, Solar> ← 全年節氣對照表（含精確時刻）
lunar.getJieQi()           // string
lunar.getJieQiList()       // string[]
lunar.getNextJieQi(wholeDay = false)     // JieQi
lunar.getPrevJieQi(wholeDay = false)     // JieQi
lunar.getCurrentJieQi()                  // JieQi | null
lunar.getNextJie() / getPrevJie() / getCurrentJie()   // 只取「節」
lunar.getNextQi() / getPrevQi() / getCurrentQi()      // 只取「氣」
```

`LunarYear` 層級：`LunarYear.fromYear(n)` → `getGanZhi()`、`getJieQiJulianDays(): number[]`、`getMonthsInYear()`、`next(n)`

**月／日／時干支**：`getMonthInGanZhi()`、`getMonthInGanZhiExact()`、`getDayInGanZhi()`、`getDayInGanZhiExact()`、`getDayInGanZhiExact2()`、`getTimeInGanZhi()`

#### ★★ 重大發現：內建 `NineStar`，連玄空九星都有

`src/lib/NineStar.ts` 是完整的九星類別：

```ts
lunar.getYearNineStar(sect = 2)   // NineStar
lunar.getMonthNineStar(sect = 2)  // NineStar
lunar.getDayNineStar()            // NineStar
lunar.getTimeNineStar()           // NineStar
```

`NineStar` 的方法：

```ts
getNumber()          // 一~九
getColor()           // 紫白（白/黑/碧/綠/黃/赤/白/白/紫）
getWuXing()          // 五行
getPosition()        // 方位
getPositionDesc()    // 方位描述（正東、東南…）
getNameInXuanKong()  // ★ 貪狼/巨門/祿存/文曲/廉貞/武曲/破軍/左輔/右弼 ← 正是玄空九星
getLuckInXuanKong()  // 玄空吉凶
getNameInBeiDou()    // 天樞/天璇/天璣/天權/玉衡/開陽/搖光/洞明/隱元
getNameInQiMen()     // 天蓬/天芮/天沖/天輔/天禽/天心/天柱/天任/天英
getNameInTaiYi()     // 太乙/攝提/軒轅/招搖/天符/青龍/咸池/太陰/天乙
getLuckInQiMen() / getYinYangInQiMen() / getTypeInTaiYi()
```

另有現成的吉神方位：`getDayPositionCai()`（財神）、`getDayPositionXi()`（喜神）、`getDayPositionFu()`（福神）、`getDayPositionYangGui()` / `getDayPositionYinGui()`（陽／陰貴神）、`getDayPositionTai()`（胎神）、`getDayPositionTaiSui()` / `getYearPositionTaiSui()`（太歲）。

**⇒ 年／月／日／時飛星與吉神方位不必自己實作。** 這對本專案是重大的開發量節省。

#### 選型建議

**先用 `lunar-typescript@1.8.6`**，理由是 `NineStar` API 已驗證可直接對應玄空九星需求，且週下載量是 tyme4ts 的 4.5 倍（生態成熟、踩坑資訊多）。
`tyme4ts` 設計較新、體積小 27%、作者主推，可列為日後遷移目標——但**遷移前要先確認它有等價的九星 API**（本次未查證，見 §7）。

> ⚠️ **時區**：兩者的時區處理未查證（見 §7）。`Solar.fromDate(new Date())` 會吃 JS 的本地時區。台灣為 UTC+8，與中國曆法計算基準一致，但**部署在 UTC 的伺服器或使用者裝置時區異常時會算錯日界與時辰**。建議一律用 `Solar.fromYmdHms(...)` 明確傳入 UTC+8 的年月日時分秒，不要依賴 `new Date()`。

### 3.5 現成 open-source 平面圖編輯器：沒有可用的

GitHub API 搜尋（多組關鍵字，依星數排序）結果：

| repo | ★ | 最後推送 | 封存 | License | 判定 |
|---|---|---|---|---|---|
| `cvdlab/react-planner` | 1,475 | **2024-04-20** | 否 | MIT | ❌ 見下 |
| `ekymo/homeRoughEditor` | 393 | 2024-07-21 | 否 | MIT | ⚠️ 停滯 |
| `TangSY/aedifex` | 71 | **2026-09-01** | 否 | MIT | ⚠️ 活躍但太小 |
| `jakeNiemiec/react-floorplanner` | 16 | 2017-11-15 | 否 | MIT | ❌ 已死 |
| `fedepaj/arcada-planner` | 8 | 2026-03-22 | 否 | MIT | ⚠️ 太小 |
| `Niush/floorplanjs` | 7 | 2023-09-18 | **已封存** | — | ❌ |
| `luxvitae-eco/SweetHome3DJS` | 6 | 2025-11-16 | 否 | NOASSERTION | ⚠️ 授權不明 |
| `marceloclp/react-floorplan-editor` | 3 | 2023-05-15 | 否 | 無 | ❌ |

**`react-planner`（星數最高者）的 package.json 實測**：

```json
"react": "16.8.5",  "react-dom": "16.8.5",
"three": "0.94.0",  "webpack": "4.29.6"
```
v2.0.6，MIT，**104 個 open issues**，最後推送 2024-04-20。
React 16 + three r94（現在是 **r185**）+ webpack 4 —— **無法直接用於 React 19 + Vite**，要用等於整包重寫。

> **誠實結論：OSS 平面圖編輯器沒有可直接採用的成熟選項。**
> 星數過百的兩個都停在 2024 年、技術棧過時；2026 年仍活躍的（aedifex ★71）規模太小、成熟度未知。
> **建議自建**——用 react-konva 從零做一個「拉多邊形頂點 + 貼齊格線」的簡化編輯器，範圍遠小於通用平面圖工具（不需要門窗、家具、3D 視圖），實際工作量比 fork 任何一個都低。

---

## 4. 其他

### 4.1 iOS PWA（standalone）對相機／感測器的限制

| 檢查項 | 結果 | 來源 |
|---|---|---|
| standalone 模式能用 `getUserMedia` | ✅ **能，自 iOS 13.4（2020-03）** | WebKit bug [185448](https://bugs.webkit.org/show_bug.cgi?id=185448)「getUserMedia not working in apps added to home screen that run in standalone mode」→ **RESOLVED FIXED** |
| standalone 模式能用 `DeviceOrientationEvent.requestPermission()` | **未直接查證**（見 §7） | — |
| `deviceorientation` 事件本身 | ✅ iOS Safari 4.2+ | BCD |
| 需 HTTPS | ✅ 兩者皆僅限 secure context | W3C / MDN |
| iOS 上第三方瀏覽器 / WKWebView | ⚠️ BCD 標 `mirror`，但 bug 185448 討論串註明 WKWebView 是**另一個獨立議題** | WebKit bug |
| 相機與 deviceorientation 同時使用是否衝突 | **未找到任何官方文件記載此限制，也未找到反證** | §7 |

> ⚠️ 已知的實務風險（列入待實機驗證）：iOS PWA 在 standalone 模式下，權限 prompt 的行為與 Safari 分頁不完全一致；且 PWA 被系統回收後重啟，先前授予的 device orientation 權限是否保留，**本次未查證**。

### 4.2 競品調查

資料來源：iTunes Search API（`entity=software`，`country=tw` / `us`，實際回傳記錄）＋各站 HTTP 實測。

#### iOS App

| 名稱 | 開發者 | 收費 | 版本／更新 | 評分(數) | 羅盤 | 平面圖 | AR | 飛星深度 |
|---|---|---|---|---|---|---|---|---|
| **風水羅盤 - AR羅庚飛星排盤、AI風水師** | Wonton Games Ltd | 免費+IAP | v1.3.0 / **2026-06-05**（上架 2025-12） | 3.0 (2) | ✅ | — | ✅ **唯一確認的 AR** | 九運飛星、山向運星 |
| **戶型圖立極尺 Lite** | QUANTILE TECHNOLOGY (HK) | 免費+廣告+IAP | v2.1.31 / 2026-08-19（上架 2025-12） | — (0) | — | ✅ **核心功能** | — | 八宅＋玄空＋流年飛星＋陽宅四要＋缺角 |
| **玄空飛星專業版** | Tom Software Cafe Ltd | **NT$790** 買斷 | v3.5.7 / 2024-12-18（上架 **2009**） | 3.33 (3) | ✅ 電子羅庚 | — | — | 一至九運正／兼向、反伏吟、城門、年月飛星 |
| 玄空飛星羅經 | Ka Lok Cheng | NT$790 | v0.9.40 / **2018-04-05** | 4.4 (10) | ✅ | — | — | **已停更 8 年** |
| Flying Star Feng Shui Chart | takeshi satou | **NT$320** | v2.24.0 / 2026-07-11 | — (0) | — | — | — | 英／日 飛星排盤 |
| **Luopan: Feng Shui Compass** | Manh Nguyen（越南） | 免費+IAP | v2.9.0 / 2026-07-10 | 5.0 (4) | ✅ 24山／透地60龍／穿山72龍 | ✅ **POLAR RULER 立極**：羅盤疊照片／平面圖，可拖曳旋轉縮放鎖圖層 | — | 中等 |
| 巨峰风水罗盘 | 学成 黄 | 免費 | v2026.9.0 / 2026-08-25 | **4.70 (300)** | ✅ | — | — | 含奇門遁甲 |
| Chinese Feng Shui Tool Kit | Hai Nam Trinh | 免費 | v8.8.8.9.9 / 2025-09-25 | 4.65 (**1,634**) | ✅ | — | — | 英文區評分數最高 |
| **RoomFlow - Feng Shui Design** | New Monkey Labs LLC | 免費+IAP | v1.2.3 / 2026-04-13（上架 2025-09） | 4.5 (98) | — | ⚠️ 上傳圖片 AI 分析 | — | **AI 導向**，非傳統排盤 |
| Feng Shui Design by FengFlow | Pol Gurri Perez | 免費+IAP | v1.2 / 2026-08-10 | 4.26 (61) | — | ⚠️ 照片 AI | — | AI 導向 |
| 星僑風水羅盤 (New) | NccSoft（台灣） | 免費 | v4.9 / 2026-08-04 | 3.29 (14) | ✅ | — | — | 台灣老牌命理軟體商 |
| 風水羅盤（First Bird） | First Bird Design | 免費 | v1.0 / **2016-02-11** | 3.43 (21) | ✅ | — | — | **已死** |
| 專業風水羅盤-立極消砂納水 | 思慧 余 | 免費 | v1.0.2 / **2016-08-19** | 4.44 (43) | ✅ | — | — | **已死** |
| 阿祖拉年飛星 | Jason Chin | 免費 | v1.4.2 / **2021-01-09** | — (0) | — | — | — | **已死** |

（另有 風水羅盤指南針 4.47/91、风水罗盘-买房租房 4.60/141、風水羅盤-八卦指南針 4.60/73、智能風水羅庚、易仙 AI 羅盤、人人風水、Fengshui Theory 4.74/87、HarmonySpace 4.20/138、Bagua Compass Tools 3.77/126、Feng Shui: AI Vision、Glow Space、Feng-Shui Compass 等，功能大同小異。）

#### Web 站（HTTP 實測）

| URL | HTTP | 標題 | 風水／飛星內容 |
|---|---|---|---|
| `https://www.lnka.tw/` | 200 | 靈匣網｜八字詳批·紫微十二宮·星座本命盤 | 命中「八宅／排盤／風水」 |
| `https://suanming.tw/` | 200 | 算命 SUANMING · 線上免費命理工具 \| 用現代設計,理解千年命理 | ★ **「風水／飛星／玄空／羅盤／八宅」全部 0 命中** |
| `https://www.china95.net/paipan/` | 200 | 元亨利貞（**GB2312 編碼，抓取為亂碼**） | — |
| `https://www.geomancy.net/` | 200 | FengShui.Geomancy.Net | 英文老牌站 |
| `https://www.zhouyi.cc/` | 200 | 易安居吉祥網 | 首頁僅 2,467 bytes |
| `https://fs.sxtwl.com/` | **timeout** | — | — |
| `https://www.buyiju.com/` | **500** | — | — |
| `https://paipan.51240.com/` | **451 Unavailable For Legal Reasons** | — | — |
| `https://www.aa123.tw/` | **403** | — | — |

#### 分析

**1. AR 風水確實存在，但極不成熟。**
只找到 **一款**：「風水羅盤 - AR羅庚飛星排盤、AI風水師」（Wonton Games，2025-12 上架）。
它宣稱「利用鏡頭將虛擬羅盤疊加實景，精準顯示二十四山方位」——注意這正是本文 §2.9(b) 描述的**「偽 AR 羅盤」模式**（相機疊圖），不是空間掃描。
**上架 9 個月只累積 2 則評分** → 尚未被市場驗證。這個賽道是空的，但也還沒被證明有需求。

**2. 全部是原生 App，沒有一個像樣的 Web 競品。**
中文排盤站技術停留在 2000 年代——`china95.net` 至今仍以 **GB2312** 編碼輸出（抓取直接亂碼），是最硬的證據；另有 4 個站台 timeout / 500 / 403 / 451，可用性極差。

**3. 最關鍵的市場空隙（有證據）**：
`suanming.tw` 是設計現代的台灣命理站（Next.js，涵蓋八字／紫微／塔羅／數字學／黃曆／農民曆…），
但實測「風水／飛星／玄空／羅盤／八宅」關鍵字 **全部 0 命中**。
**⇒ 「現代化設計的線上命理工具」在台灣已有人做且做得不錯，但完全沒有碰風水這一塊。** 這是本專案最明確的切入點。

**4. 定價區間**：
- 專業排盤 App 買斷：**NT$320 – NT$790**（Flying Star Chart NT$320、玄空飛星專業版 NT$790、玄空飛星羅經 NT$790）
- 羅盤工具：清一色**免費 + IAP / 廣告**
- 新一代 AI 風水 App（RoomFlow、FengFlow、AI Vision）：免費 + IAP 訂閱
- ⇒ 買斷制存在於「專業排盤」這個定位，且能撐到 NT$790。

**5. 「平面圖 + 立極」已被驗證是真需求**：
兩款不同市場的 App 都獨立做了這件事——
「戶型圖立極尺 Lite」（HK，把八宅／玄空／流年飛星疊在自家戶型圖上，還能標床位／灶位／缺角）
與 Luopan 的「POLAR RULER (LẬP CỰC)」（越南，把羅盤疊在照片或平面圖上）。
**且兩者都是用「疊在既有圖片上」而非 AR 掃描** —— 印證了本文 §2.9(c) 的建議路線。

**6. 明顯死亡的產品**：風水羅盤 (First Bird, 2016)、專業風水羅盤 (2016)、阿祖拉年飛星 (2021)、玄空飛星羅經 (2018，但仍在收 NT$790)。

---

## 5. 可直接使用的程式碼片段

> 以下片段的 API 名稱全部來自本文已查證的一手來源。
> ⚠️ 標記為「推導」的部分（螢幕旋轉正負號）**必須實機驗證**。

### 5.1 跨平台 compass heading hook（React 19 + TS）

涵蓋：`requestPermission`（iOS + Chrome 151+）、iOS `webkitCompassHeading`、Android `deviceorientationabsolute`、
平放 vs 直立、螢幕旋轉修正、校正狀態、無感測器 timeout、磁北→真北轉換。

```ts
// src/hooks/useCompass.ts
import { useCallback, useEffect, useRef, useState } from 'react';

export type CompassStatus =
  | 'idle'          // 尚未請求
  | 'unsupported'   // 此裝置／瀏覽器沒有方位事件
  | 'denied'        // 使用者拒絕授權
  | 'no-sensor'     // 授權了但 timeout 內沒有任何事件（多半是桌機）
  | 'ok';

export interface CompassReading {
  /** 磁北方位角 0–360，順時針。已修正螢幕旋轉。 */
  magneticHeading: number;
  /** 真北方位角；未提供 declination 時等於 magneticHeading */
  trueHeading: number;
  /** iOS: webkitCompassAccuracy（度）。負值或 null = 讀數無效。Android 恆為 null */
  accuracy: number | null;
  /** 讀數是否可信（僅 iOS 能判斷；Android 一律回 true） */
  reliable: boolean;
  source: 'ios-compass' | 'absolute' | 'relative-fallback';
}

// 這兩個型別在標準 DOM lib 裡沒有，要自己補
interface IOSDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
  webkitCompassAccuracy?: number;
}
type PermissionRequestable = {
  requestPermission?: () => Promise<'granted' | 'denied' | 'prompt'>;
};

const NO_SENSOR_TIMEOUT_MS = 3000;

export function useCompass(declinationDeg = 0) {
  const [status, setStatus] = useState<CompassStatus>('idle');
  const [reading, setReading] = useState<CompassReading | null>(null);
  const gotEventRef = useRef(false);

  const handler = useCallback((raw: DeviceOrientationEvent) => {
    const e = raw as IOSDeviceOrientationEvent;
    gotEventRef.current = true;

    let magneticHeading: number;
    let source: CompassReading['source'];

    if (typeof e.webkitCompassHeading === 'number') {
      // --- iOS：唯一的絕對方位來源，且已是「磁北」 ---
      // WebKit 取的是 CLHeading.magneticHeading（見 §1.2）
      magneticHeading = e.webkitCompassHeading;
      source = 'ios-compass';
    } else if (e.alpha != null) {
      // --- Android / 其他：alpha 與羅盤方位反向（W3C §3.1）---
      // 平放時 (360 - alpha) 穩定；W3C 附錄 A.1 的公式在 beta=gamma=0 時會回傳 NaN（見 §1.6）
      magneticHeading = (360 - e.alpha) % 360;
      source = e.absolute === true ? 'absolute' : 'relative-fallback';
    } else {
      return;
    }

    // --- 螢幕旋轉修正 ---
    // ⚠️ 正負號為推導（§1.6-D）：screen.orientation.angle 是「逆時針」度數，
    //    羅盤方位順時針遞增，故相減。務必實機驗證，或直接鎖 portrait 迴避。
    const screenAngle = screen.orientation?.angle ?? 0;
    magneticHeading = (magneticHeading - screenAngle + 360) % 360;

    const accuracy =
      typeof e.webkitCompassAccuracy === 'number' ? e.webkitCompassAccuracy : null;

    setReading({
      magneticHeading,
      // 真北 = 磁北 + D（D 東偏為正）。台北 D ≈ −5.06 ⇒ 真北讀數較小（§1.5）
      trueHeading: (magneticHeading + declinationDeg + 360) % 360,
      accuracy,
      reliable: accuracy === null ? true : accuracy >= 0,
      source,
    });
    setStatus('ok');
  }, [declinationDeg]);

  /** ⚠️ 必須從使用者手勢（click/tap）同步呼叫，否則 iOS 會 reject NotAllowedError */
  const start = useCallback(async (): Promise<CompassStatus> => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setStatus('unsupported');
      return 'unsupported';
    }

    // ★ 2026 年關鍵：requestPermission 已不是 iOS 專屬。
    //   Chrome 151+ 也實作了（§1.3）。必須 feature-detect，不能寫 if (isIOS)。
    const DOE = window.DeviceOrientationEvent as unknown as PermissionRequestable;
    if (typeof DOE.requestPermission === 'function') {
      try {
        // 註：規格有 requestPermission(absolute) 參數，但 WebKit 與 Blink 都不吃，傳了無效
        const res = await DOE.requestPermission();
        if (res !== 'granted') {
          setStatus('denied');
          return 'denied';
        }
      } catch {
        // 沒有 transient activation 時會丟 NotAllowedError
        setStatus('denied');
        return 'denied';
      }
    }

    // Android/Firefox 用 deviceorientationabsolute（Chrome 50+ / FF 110+）；
    // Safari 不支援該事件，會落到 deviceorientation + webkitCompassHeading
    const eventName =
      'ondeviceorientationabsolute' in window
        ? 'deviceorientationabsolute'
        : 'deviceorientation';

    gotEventRef.current = false;
    window.addEventListener(eventName, handler as EventListener, true);

    // ⚠️ window.DeviceOrientationEvent 在桌機 Chrome 也存在，
    //    所以 feature detection 不夠，必須用 timeout 判定「沒有感測器」（§1.7）
    window.setTimeout(() => {
      if (!gotEventRef.current) setStatus('no-sensor');
    }, NO_SENSOR_TIMEOUT_MS);

    return 'ok';
  }, [handler]);

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler as EventListener, true);
      window.removeEventListener('deviceorientation', handler as EventListener, true);
    };
  }, [handler]);

  return { status, reading, start };
}
```

使用方式（**注意 `start()` 必須在 click handler 內**）：

```tsx
const { status, reading, start } = useCompass(-5.06); // 台北磁偏角

<button onClick={() => void start()}>開始定向</button>

{status === 'ok' && reading && (
  <>
    <p>磁北 {reading.magneticHeading.toFixed(1)}°（傳統磁針）</p>
    <p>真北 {reading.trueHeading.toFixed(1)}°（地圖座向）</p>
    {!reading.reliable && <CalibrationPrompt />} {/* 8 字校正動畫 */}
  </>
)}
{status === 'no-sensor' && <ManualDialInput />}
{status === 'denied'    && <p>需要方位權限才能使用羅盤</p>}
```

### 5.2 磁偏角計算（magvar）

```bash
npm i magvar
```

```ts
// src/lib/declination.ts
import magvar from 'magvar';

/** 回傳磁偏角（度）。正 = 東偏，負 = 西偏。台北約 -5.06 */
export function getDeclination(lat: number, lon: number, when = new Date()): number {
  // magvar(lat, lon, altitude?, when?)；模型為 WMM2025，有效期 2025.0–2030.0
  return magvar(lat, lon, 0, when);
}

/** 取得使用者位置並算磁偏角；失敗時退回台北常數 */
export async function resolveDeclination(): Promise<number> {
  const TAIPEI_FALLBACK = -5.06;
  if (!('geolocation' in navigator)) return TAIPEI_FALLBACK;

  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false, // 磁偏角只需公里級精度，不必開 GPS
        timeout: 8000,             // ⚠️ 預設是 Infinity，一定要自己設（§2.10）
        maximumAge: 24 * 60 * 60 * 1000,
      })
    );
    return getDeclination(pos.coords.latitude, pos.coords.longitude);
  } catch {
    return TAIPEI_FALLBACK;
  }
}
```

> 只做台灣市場、又想省 3.8 KB 的話，直接 `const DECLINATION = -5.06;` 即可——
> 全台跨度僅 0.7°、整個 WMM2025 週期漂移不到 0.2°，都遠小於手機磁力計 ±10° 的實際誤差（§1.9-b）。

### 5.3 three.js AR hit-test 最小範例

逐字取自官方 `examples/webxr_ar_hittest.html`：

```ts
import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;                 // ← 必要
renderer.setAnimationLoop(animate);
document.body.appendChild(renderer.domElement);

document.body.appendChild(
  ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] })
);

// 準心：用 matrix 直接驅動，所以要關掉自動更新
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial()
);
reticle.matrixAutoUpdate = false;
reticle.visible = false;
scene.add(reticle);

let hitTestSource: XRHitTestSource | null = null;
let hitTestSourceRequested = false;

// ⚠️ animate 的第二個參數 frame 只有在 XR session 中才有值
function animate(timestamp: number, frame?: XRFrame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace()!;
    const session = renderer.xr.getSession()!;

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource!({ space: viewerSpace })!.then((source) => {
          hitTestSource = source;
        });
      });
      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const results = frame.getHitTestResults(hitTestSource);
      if (results.length) {
        reticle.visible = true;
        reticle.matrix.fromArray(results[0].getPose(referenceSpace)!.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }
  renderer.render(scene, camera);
}

// 放置九宮盤時這樣解構 reticle 的 matrix：
// reticle.matrix.decompose(jiugong.position, jiugong.quaternion, jiugong.scale);
```

### 5.4 取得地板多邊形（plane detection，Chrome 147+）

⚠️ **不要用 `three/addons/webxr/XRPlanes.js`**——它只取 polygon 的 AABB 包圍盒（§2.6）。
以下是自己讀真實多邊形的寫法：

```ts
document.body.appendChild(
  ARButton.createButton(renderer, {
    requiredFeatures: ['plane-detection'],
    optionalFeatures: ['anchors', 'local-floor'],
  })
);

interface FloorPolygon { points: { x: number; z: number }[]; matrix: THREE.Matrix4; }

const matrix = new THREE.Matrix4();

renderer.xr.addEventListener('planesdetected', (event: any) => {
  const frame: XRFrame = event.data;                    // three.js 把 XRFrame 放在 event.data
  const referenceSpace = renderer.xr.getReferenceSpace()!;
  const floors: FloorPolygon[] = [];

  // @ts-expect-error detectedPlanes 尚未進入標準 DOM 型別
  for (const plane of frame.detectedPlanes as Set<any>) {
    // 找地板：水平面 + 語意標籤 floor
    if (plane.orientation !== 'horizontal') continue;
    if (plane.semanticLabel && plane.semanticLabel !== 'floor') continue;

    const pose = frame.getPose(plane.planeSpace, referenceSpace);
    if (!pose) continue;
    matrix.fromArray(pose.transform.matrix);

    // plane.polygon 在 planeSpace 局部座標；spec 定義 planeSpace 的 Y 軸即法向量，
    // 所以水平面的多邊形落在 XZ 平面上（§2.4）
    floors.push({
      points: plane.polygon.map((p: DOMPointReadOnly) => ({ x: p.x, z: p.z })),
      matrix: matrix.clone(),
    });
  }

  if (floors.length) rebuildJiuGong(floors[0]);          // 疊九宮飛星
});

// 主動請裝置掃描房間（Chrome 147+ / Quest 31.2+）
async function scanRoom() {
  const session = renderer.xr.getSession() as any;
  if (typeof session?.initiateRoomCapture === 'function') {
    await session.initiateRoomCapture();
  }
}
```

把地板多邊形轉成 three.js 幾何：

```ts
function polygonToShape(points: { x: number; z: number }[]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach((p, i) => (i === 0 ? shape.moveTo(p.x, p.z) : shape.lineTo(p.x, p.z)));
  shape.closePath();
  return shape;
}
```

### 5.5 能力偵測（決定給使用者哪一層體驗）

```ts
export type ArTier = 'webxr-full' | 'webxr-basic' | 'pseudo-ar' | 'manual';

export async function detectArTier(): Promise<ArTier> {
  if (!('xr' in navigator)) return await hasCamera() ? 'pseudo-ar' : 'manual';

  const xr = (navigator as any).xr;
  const arSupported = await xr.isSessionSupported('immersive-ar').catch(() => false);
  if (!arSupported) return await hasCamera() ? 'pseudo-ar' : 'manual';

  // 用 optionalFeatures 開 session 後讀 session.enabledFeatures 才是可靠的判斷。
  // 光靠 isSessionSupported 無法得知個別模組是否可用（尤其 depth-sensing 的硬體門檻未知，§7）
  return 'webxr-basic';
}

export function readEnabledFeatures(session: XRSession): string[] {
  // WebXR enabledFeatures：Chrome 111+
  return ((session as any).enabledFeatures as string[]) ?? [];
}

async function hasCamera(): Promise<boolean> {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.some((d) => d.kind === 'videoinput');
}
```

### 5.6 建議的 npm 套件清單

```jsonc
{
  "dependencies": {
    "three": "0.185.1",              // r185，2026-07-01，MIT
    "lunar-typescript": "1.8.6",     // 干支/節氣/★九星，MIT
    "magvar": "2.2.0",               // WMM2025 磁偏角，MIT，3.8KB gzip
    "konva": "10.3.3",               // 2026-09-04
    "react-konva": "19.2.6",         // peer react ^19.2.0
    "react": "^19.2.0"               // ⚠️ 若要用 R3F，上限是 <19.3
  },
  "devDependencies": {
    "@types/three": "0.185.4"        // three 不內建型別；此包已帶 @types/webxr >=0.5.17
  },
  "optionalDependencies": {
    "@react-three/fiber": "9.7.0",   // 只在要用 R3F 宣告式寫法時
    "@react-three/xr": "6.6.30",     // useXRPlanes / useXRHitTest / useXRAnchor
    "@techstark/opencv-js": "5.0.0-release.1",  // 照片平面圖透視校正
    "martinez-polygon-clipping": "0.8.1"        // 只在需要多邊形布林運算時
  }
}
```

**刻意不採用**：
- `@turf/*` —— 假設 WGS84 經緯度，且 `centroid` 不是面積形心（§3.3）
- `geomag` / `@wemap/geomagnetism` / `geomagnetism-no-path` —— WMM2020／2015，已過期
- `wmm` —— 306 bytes 的佔名垃圾包
- `kompas` —— 平放時因 NaN 而不發事件（§1.6）
- `paper` —— 停滯 2 年
- `react-planner` —— React 16 + three r94 + webpack 4

---

## 6. 來源清單

全部於 **2026-09-05** 抓取查證。決策摘要表格中的 `[n]` 對應此處編號。

### 支援度資料（矩陣的主要依據）

| # | 來源 | URL |
|---|---|---|
| [1] | Chrome Platform Status API | `https://chromestatus.com/api/v0/features?q=WebXR` ／ `/api/v0/features/{id}` ／ `?milestone=147` |
| [2] | caniuse 原始資料檔（WebXR） | `https://raw.githubusercontent.com/Fyrd/caniuse/main/features-json/webxr.json` |
| [3] | WebKit Standards Positions | `https://github.com/WebKit/standards-positions/issues`（#155 / #608 / #503 / #601 / #395 / #37） |
| [4] | MDN browser-compat-data 原始 JSON | `https://raw.githubusercontent.com/mdn/browser-compat-data/main/api/{XRPlane,XRPlaneSet,XRFrame,XRSession,DeviceOrientationEvent,DeviceMotionEvent,Window,ScreenOrientation,Sensor,AbsoluteOrientationSensor,Magnetometer,MediaDevices,Permissions,Geolocation}.json` |
| [5] | Chromium `runtime_enabled_features.json5` | `https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/platform/runtime_enabled_features.json5` |
| [6] | Chrome 147 release notes（plane-detection 出貨） | `https://developer.chrome.com/release-notes/147` |
| [7] | WebXR Plane Detection Module spec | `https://immersive-web.github.io/plane-detection/` ／ `https://github.com/immersive-web/plane-detection/blob/main/index.bs` |
| [8] | Chrome 151 release notes（DeviceOrientation requestPermission 出貨） | `https://developer.chrome.com/release-notes/151` |
| [9] | chromestatus：DeviceOrientation Events permission request API | `https://chromestatus.com/feature/5915984063889408` |
| [10] | WebKit bug 185448（PWA standalone 相機） | `https://bugs.webkit.org/show_bug.cgi?id=185448` |
| [11] | Apple AR Quick Look | `https://developer.apple.com/augmented-reality/quick-look/` |

### 規格

- W3C DeviceOrientation and Motion — `https://w3c.github.io/deviceorientation/`
- W3C Screen Orientation — `https://w3c.github.io/screen-orientation/`
- W3C Orientation Sensor — `https://www.w3.org/TR/orientation-sensor/`｜Magnetometer — `https://w3c.github.io/magnetometer/`
- `compassneedscalibration` 移除紀錄 — `https://github.com/w3c/deviceorientation/pull/107`（2023-03-22 merged）／ `issues/38`
- WebXR Depth Sensing — `https://immersive-web.github.io/depth-sensing/`
- WebXR Mesh Detection — `https://immersive-web.github.io/real-world-meshing/`
- WebXR Raw Camera Access — `https://immersive-web.github.io/raw-camera-access`
- WebXR Hit Test — `https://immersive-web.github.io/hit-test/`｜Anchors — `https://immersive-web.github.io/anchors/`｜DOM Overlays — `https://immersive-web.github.io/dom-overlays/`

### WebKit / Safari

- `https://webkit.org/status/` —— **已退休**，導向 MDN / caniuse / standards-positions
- Safari 26.0 features — `https://webkit.org/blog/17333/webkit-features-in-safari-26-0/`（2025-09-15）
- Safari 26.2 features — `https://webkit.org/blog/17640/webkit-features-for-safari-26-2/`（2026-02-04）
- Safari 26.6 features — `https://webkit.org/blog/18178/webkit-features-for-safari-26-6/`（2026-07-27）
- `WebCoreMotionManager.mm`（iOS 羅盤行為的權威來源）— `https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/platform/ios/WebCoreMotionManager.mm`
- `DeviceOrientationEvent.idl` — `https://raw.githubusercontent.com/WebKit/WebKit/main/Source/WebCore/dom/DeviceOrientationEvent.idl`
- WebKit bug 195329（Device Orientation 權限 API）— `https://bugs.webkit.org/show_bug.cgi?id=195329`

### Chromium

- `device_orientation_event_pump.cc` — `https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/modules/device_orientation/device_orientation_event_pump.cc`
- `device_orientation_event.idl` — 同路徑 `/device_orientation_event.idl`
- `PlatformSensor.java` — `https://chromium.googlesource.com/chromium/src/+/refs/heads/main/services/device/generic_sensor/android/java/src/org/chromium/device/sensors/PlatformSensor.java`
- `platform_sensor_provider_android.cc` — 同目錄
- chromestatus：deviceorientation 改為相對 — `https://chromestatus.com/feature/5661106970296320`
- Chrome 版本歷史 — `https://versionhistory.googleapis.com/v1/chrome/platforms/android/channels/stable/versions`

### 平台文件

- Apple CLHeading（`magneticHeading` / `trueHeading` / `headingAccuracy`）— `https://developer.apple.com/documentation/corelocation/clheading`
- Apple `headingOrientation` — `https://developer.apple.com/documentation/corelocation/cllocationmanager/headingorientation`
- Apple `locationManagerShouldDisplayHeadingCalibration(_:)` — `https://developer.apple.com/documentation/corelocation/cllocationmanagerdelegate/locationmanagershoulddisplayheadingcalibration(_:)`
- Apple RoomPlan — `https://developer.apple.com/documentation/roomplan`
- Android `SensorEvent`（TYPE_ROTATION_VECTOR 座標系）— `https://developer.android.com/reference/android/hardware/SensorEvent`
- Android `SensorManager` — `https://developer.android.com/reference/android/hardware/SensorManager`

### NOAA / WMM

- WMM 產品頁 — `https://www.ncei.noaa.gov/products/world-magnetic-model`
- **係數檔 WMM2025COF.zip** — `https://www.ncei.noaa.gov/sites/default/files/2024-12/WMM2025COF.zip`（42,887 bytes）
- 官方測試值 — `https://www.ncei.noaa.gov/sites/default/files/2025-02/WMM2025_TEST_VALUES.txt`
- **磁偏角 API** — `https://www.ngdc.noaa.gov/geomag-web/calculators/calculateDeclination`
  ⚠️ 主機必須是 **`www.ngdc.noaa.gov`**；`www.ncei.noaa.gov/geomag-web/...` 會回 404。demo key `zNEw7` 可用。
- 計算器頁 — `https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml`

### three.js

- npm — `https://registry.npmjs.org/three`（0.185.1）｜releases — `https://api.github.com/repos/mrdoob/three.js/releases/latest`（r185）
- `examples/jsm/webxr/` — `https://github.com/mrdoob/three.js/tree/dev/examples/jsm/webxr`
- `XRPlanes.js` — `https://github.com/mrdoob/three.js/blob/dev/examples/jsm/webxr/XRPlanes.js`
- `ARButton.js` — `https://github.com/mrdoob/three.js/blob/dev/examples/jsm/webxr/ARButton.js`
- `WebXRManager.js` — `https://raw.githubusercontent.com/mrdoob/three.js/dev/src/renderers/webxr/WebXRManager.js`
- `webxr_ar_hittest.html` — `https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_hittest.html`
- `webxr_ar_plane_detection.html` — `https://github.com/mrdoob/three.js/blob/dev/examples/webxr_ar_plane_detection.html`
- Migration Guide（r134 移除 DeviceOrientationControls）— `https://github.com/mrdoob/three.js/wiki/Migration-Guide`
- r133 `DeviceOrientationControls.js` — `https://raw.githubusercontent.com/mrdoob/three.js/r133/examples/jsm/controls/DeviceOrientationControls.js`

### 函式庫

- `magvar` — `https://www.npmjs.com/package/magvar`｜`https://github.com/dpyeates/magvar`
- `geomagnetism` — `https://www.npmjs.com/package/geomagnetism`｜`https://github.com/naturalatlas/geomagnetism`
- `pygeomag`（參考實作）— `https://github.com/boxpet/pygeomag`
- `geomagJS`（**WMM2015，已過期，勿用**）— `https://github.com/cmweiss/geomagJS`
- `kompas` — `https://www.npmjs.com/package/kompas`
- `lunar-typescript` — `https://github.com/6tail/lunar-typescript`｜文件 `https://6tail.cn/calendar/api.html`
- `tyme4ts` — `https://github.com/6tail/tyme4ts`｜文件 `https://6tail.cn/tyme.html`
- `konva` / `react-konva` — `https://github.com/konvajs/konva`｜`https://github.com/konvajs/react-konva`
- `@react-three/fiber` / `@react-three/xr` — `https://github.com/pmndrs/react-three-fiber`｜`https://github.com/pmndrs/xr`
- Turf 原始碼（座標系查證）— `https://raw.githubusercontent.com/Turfjs/turf/master/packages/turf-area/index.ts`、`turf-centroid/index.ts`、`turf-center-of-mass/index.ts`
- `react-planner`（過時證據）— `https://raw.githubusercontent.com/cvdlab/react-planner/master/package.json`
- `@google/model-viewer` — `https://modelviewer.dev/docs/`｜`https://github.com/google/model-viewer`
- `@techstark/opencv-js` — `https://www.npmjs.com/package/@techstark/opencv-js`

### 競品

- iTunes Search API — `https://itunes.apple.com/search?term=...&country=tw&entity=software`
- 各競品 App Store 頁面 URL 見 §4.2 表格
- Web 站台實測：lnka.tw、suanming.tw、china95.net、zhouyi.cc、geomancy.net、fs.sxtwl.com、buyiju.com、paipan.51240.com、aa123.tw

---

## 7. 未驗證 / 不確定事項

**以下項目沒有取得一手證據，不得當作事實使用。** 需要時請實機驗證或另行查證。

### 高影響（會改變實作決策）

| # | 項目 | 狀態 |
|---|---|---|
| 1 | **`depth-sensing` 的硬體門檻** | 是否所有 ARCore 裝置都能用，或只限有 ToF/LiDAR 的機型。ARCore 有 depth-from-motion 軟體方案，但**找不到 Chrome 官方對硬體門檻的明文聲明**。**必須以 `session.enabledFeatures` 執行期偵測，不可假設。** |
| 2 | **`screen.orientation.angle` 修正式的正負號** | **是推導，不是引用。** W3C 沒有給這條公式。推導依據（`angle` = 逆時針、heading = 順時針）與 three.js `setFromAxisAngle(_zee, -orient)` 一致，但**務必實機驗證**。§5.1 的 hook 已標註。**建議直接鎖 portrait 迴避此風險。** |
| 3 | **iOS PWA standalone 下 `DeviceOrientationEvent.requestPermission()` 的行為** | 未直接查證。已確認的只有 `getUserMedia` 在 standalone 可用（iOS 13.4+）。另外：PWA 被系統回收重啟後，先前授予的方位權限是否保留，**未查證**。 |
| 4 | **iOS 相機與 deviceorientation 同時使用是否互相干擾** | **找不到任何官方文件或 bug tracker 記載此限制，也找不到反證。** 「偽 AR 羅盤」路線的關鍵風險，**必須實機驗證**。 |
| 5 | **`lunar-typescript` / `tyme4ts` 的時區處理** | 未查證。`Solar.fromDate(new Date())` 會吃 JS 本地時區。建議一律用 `Solar.fromYmdHms(...)` 明確傳 UTC+8，不要依賴 `new Date()`。 |
| 6 | **`tyme4ts` 是否有等價的九星 API** | 未查證。若日後要從 lunar-typescript 遷移，**必須先確認**。 |

### 版本號矛盾（不影響「現在可用」的判斷）

| # | 項目 | 狀態 |
|---|---|---|
| 7 | **Chrome `requestPermission()` 的確切首發版本** | chromestatus 與 **Chrome 151 release notes** 都指向 **151**；MDN BCD 記 **152**（由「Updates for Chrome 152 **beta**」commit 加入）。兩者一致的是「現行 stable 153 已具備」。 |
| 8 | **iOS `requestPermission()` 首發版本** | BCD 記 **14.5**，與社群廣傳的「iOS 13+」不符。WebKit bug 195329 建立於 2019-03-05、RESOLVED FIXED、最後變更 2020-07-08 → 時間軸偏向 iOS 13。**無法確認 BCD 的 14.5 是修正還是筆誤。** |
| 9 | **WebXR Anchors 出貨版本** | chromestatus 記 **79**，MDN BCD 的 `XRAnchor` / `XRFrame.createAnchor` 記 **85**。傾向 85，未進一步查證。 |

### 規範／慣例層面（無權威來源）

| # | 項目 | 狀態 |
|---|---|---|
| 10 | **桌機無感測器的 fallback 業界作法** | **無權威來源。** §1.7 的建議（手動轉盤／地圖點選／`coords.heading`）是推論。 |
| 11 | **羅盤校正偵測的啟發式** | 比對陀螺儀積分 heading 與磁力計 heading 的漂移量、偵測讀數抖動等，社群廣泛使用但**找不到任何一手來源或規格支持**。判定為 folklore。§1.10 中 `accuracy > 15` 的門檻也是經驗值，非規格。 |
| 12 | **Google Maps / Apple 指南針的 8 字校正 UX 官方說明頁** | **取不到**（support.google.com / support.apple.com 皆為 JS 渲染，抓下的 HTML grep `calibrat` 命中 0）。§1.10 引用的 Apple `locationManagerShouldDisplayHeadingCalibration` 開發者文件是唯一拿到的一手描述。 |
| 13 | **Geolocation 在行動裝置的典型精度數值** | MDN 只定義單位（公尺）與信心水準（95%），**未給經驗值**。網路流傳的「GPS 5–10m / WiFi 20–50m」無一手來源佐證。 |

### MDN 與實作不一致（已以實作為準）

| # | 項目 | 處理 |
|---|---|---|
| 14 | **Earth frame Y 軸是真北還是磁北** | MDN 說「positive toward **true north**（the North Pole, **not magnetic north**）」；W3C 規格註解卻說絕對方位「similar to the **xMagneticNorthZVertical** option for Core Motion」。**實作證據（WebKit `magneticHeading` + Chromium → Android `TYPE_ROTATION_VECTOR`）一致指向磁北。本文以實作為準，並判定 MDN 該句與實作不符。** |
| 15 | **iOS 取用 `webkitCompassHeading` 是否需要定位權限** | WebKit `WebCoreMotionManager.mm` grep `authoriz` / `requestWhenInUse` / `CLAuthorization` → **0 hits**，未見任何授權請求。但**未實機測試**，也未排除 WebKit 他處另有 gate。 |

### 未查證的周邊項目

| # | 項目 |
|---|---|
| 16 | **visionOS Safari 的 WebXR 支援細節** —— BCD 無 visionOS 欄位，caniuse 也不分列。可確定的只有 Apple 官方 blog 從未宣告 `immersive-ar` 可用。 |
| 17 | **iOS 26 是否有新的房間掃描能力** —— 未查證 WWDC 2026 相關 session。 |
| 18 | **Polycam 完整匯出格式與 Content API 條款** —— 只從首頁確認有 Floor Plan 模式、GLTF/FBX 匯出、需申請的 Content API；`learn.poly.cam/exporting` 回 404。 |
| 19 | **magicplan 完整匯出格式** —— 官網只提到 Xactimate 匯出；API 文件站 `apidocs.magicplan.app` 未實際抓取。 |
| 20 | **Canvas by Occipital / Matterport / RoomScan 的匯出格式與 API** —— 未逐一查證。 |
| 21 | **瀏覽器內攝影測量 / SfM 函式庫** —— 未調查。 |
| 22 | **konva 多點觸控 pinch-zoom 的實際品質、`@pixi/react` 與 React 19 的整合細節** —— 未做實機測試。 |
| 23 | **`geomag` / `@wemap/geomagnetism` / `geomagnetism-no-path` 的數值行為** —— 只驗證嵌入 epoch（2020 / 2015 / 2015），未跑數值測試（epoch 已過期，判定 stale 即足夠）。 |
| 24 | **WMMHR 的 JS 生態** —— 只確認模型存在（NOAA，degree 15），未查證是否有任何 JS 實作。 |
| 25 | **`full-tilt` 函式庫** —— **已不存在**。`github.com/richtr/Full-Tilt` API 回空、GitHub 搜尋 `total_count: 0`、npm 無 `fulltilt` 套件。改以 `kompas` 與 three.js r133 作為參考實作。 |
| 26 | **Firefox / Safari 對 Generic Sensor API 的官方 standards-position** —— 只查到 Mozilla 對 requestPermission 的 position（issue 1428）。 |
| 27 | **`aedifex`（★71，2026-09-01 活躍）的實際成熟度** —— 根目錄 package.json 為 monorepo root，僅見 typescript 6.0.3，未深入評估。 |

### 方法論限制

- **WebSearch 額度在調研中途用盡（200/200）**，後段全部改用 WebFetch / curl 直擊已知的一手 URL 與各平台 API（npm registry、GitHub API、chromestatus API、Google version history API、MDN BCD raw JSON、Chromium googlesource、W3C spec 的 `index.bs` 原始檔、NOAA geomag API、iTunes Search API）。
  這實際上**提高**了證據品質——BCD 與 Chromium 原始碼比搜尋結果摘要可靠得多——但代價是 §7-18 ~ §7-21 的周邊 survey 未能完成。
- **WebFetch 的頁面摘要由小模型產生，曾出現年份錯誤**。凡版本號與日期，一律改以 npm / GitHub / chromestatus API 的結構化欄位覆核；本文表格中的數字皆來自 API 或原始碼，非頁面摘要。
- 台北磁偏角經**兩個獨立來源**交叉驗證（NOAA 官方 API 回傳 −5.05719；官方 COF + pygeomag 自算 −5.0572，且該計算引擎先通過 NOAA 官方 100 筆測試值，max diff 0.0050°）。
