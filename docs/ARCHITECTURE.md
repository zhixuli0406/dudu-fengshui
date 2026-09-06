# 架構說明

## 分層

```
src/engine/        純 TypeScript，無 DOM 依賴，vitest 覆蓋
  fiveElements.ts  五行生剋
  bagua.ts         後天八卦、洛書數、飛行順序
  mountains24.ts   二十四山、陰陽、空亡
  direction.ts     角度／方位換算
  calendar.ts      立春年界、干支（lunar-typescript）
  bazhai.ts        命卦、八遊星（大遊年歌訣驅動）
  xuankong.ts      三元九運、飛星盤、格局判定
  annual.ts        流年／流月飛星、太歲三煞
  stars.ts         九星屬性、81 組合
  geometry.ts      多邊形、線段、射線工具
  floorplan.ts     平面圖資料模型（cm，y 向下）
  rules/           形勢派規則（每條規則＝幾何條件 → Finding）
  positions.ts     住宅文昌位／財位表（依坐向）
  environment.ts   外局問卷 → Finding
  report.ts        報告組合與評分
  exportMarkdown.ts
src/data/          demoPlan、environmentQuestions.json、formRulesCatalog.json（204 條）、lubanRuler.json — 由 `node scripts/sync-research-data.mjs` 從 docs/research/*.json 同步產生
scripts/           sync-research-data.mjs、verify_flying_star.py（調研時的獨立排盤驗證器，Python）
src/hooks/         useCompass（感測器）、useDeclination（GPS + WMM）
src/ar/            WebXR hit-test 掃描、相機羅盤疊圖、providers.ts（AR 能力偵測與 iOS 供應層載入）
src/lib/           image.ts（照片縮圖）
src/components/    CompassDial、PlanEditor、NineGridOverlay、ui
src/pages/         Home / Setup / Compass / Plan / Scan / Report / Knowledge
src/store/         zustand + localStorage 持久化
```

## 設計系統

沿用 DuDuClaw MDS：`src/index.css` 定義 OKLCH 語義 token（`--app-shell`／`--page-canvas`／`--surface`／`--surface-raised` 四層、`--brand` 玉綠同時作為「吉」、`--destructive` 玫紅作為「凶」、五行色只用於宮位淡色），`@theme inline` 映射成 Tailwind utility；dark 走 `.dark` class（main.tsx 依 `prefers-color-scheme` 切換）。元件在 `src/components/mds/`（button／badge／card／input／segmented／empty／field），頁面只組合元件；圖示用 lucide-react 具名匯入，禁 emoji；字重只用 400／500。`AppShell` 提供固定底部導覽（首頁／資料／平面圖／報告／更多）與 `PageHeader`。

## 座標與方位約定

- 平面圖座標：公分，螢幕座標系（x 向右、y 向下）。
- `plan.northOffset`：平面圖「上方」對應的羅盤方位（度）。點的方位 = `atan2(dx, −dy) + northOffset`。
- 物件 `facing`（螢幕角度，0 = 上、順時針）：門＝開進屋內方向；床＝床頭方向；灶＝灶口（開關面）方向；桌／沙發＝人面向；鏡＝鏡面法線；神位＝面向。
- 房屋朝向 `facingBearing`：站在大門內側向外看的羅盤方位；坐向為其 +180°。宅卦取坐山所在卦。
- 玄空以「地盤正針」二十四山，每山 15°，子山中心 0°。磁北／真北由使用者選擇（預設磁北，與傳統羅盤一致）。

## 飛星排盤演算法

1. 運盤：運星入中順飛（洛書路徑 中→乾→兌→艮→離→坎→坤→震→巽）。
2. 山盤：取運盤「坐山宮」之星入中；順逆看該星本宮中與坐山同元（地／天／人）之山的陰陽。星為 5 時看坐山本身陰陽。
3. 向盤：同理以向山計算。
4. 格局：當運山星到坐且向星到向＝旺山旺向；反之上山下水；同到向／坐＝雙星到向／到坐。九運下卦無旺山旺向（僅雙星局），為理論上的必然（推導見 xuankong.test.ts）。
5. 兼向（偏離山中心 > 門檻，預設 4.5°，可選 3.5°／6°）時依設定改用替卦：入中數改為「同元取山」之替星（傳統蔣大鴻／沈氏表：子癸甲申→1、壬卯乙未坤→2、乾亥辰巽巳戌→6、酉辛丑艮丙→7、寅午庚丁→9），順逆仍依該山陰陽；替星等於本宮數者「替而不替」。
6. 七星打劫：當運雙星會於離宮（真）或坎宮（假），且該宮與同組二宮（離震乾／坎巽兌）山、向星各屬同一三般卦，且不犯伏吟；生效仍以巒頭為條件。

## 各派有別的處理

依 docs/research 的分歧清單，不硬編單一答案：取向依據、灶位判法為使用者設定；連珠三般卦、死煞分界、兼向門檻、鬼門線廁所等在文案標示「各派有別」；化解物品一律「原則（五行洩化）在前、坊間物品在後」。

## 羅盤方位

`engine/orientation.ts` 依 W3C DeviceOrientation 的 Z-X'-Y'' 旋轉矩陣把 alpha／beta／gamma 轉成世界座標：機頂向量 (0,1,0) 的水平投影 = 平放時的方位（β=γ=0 時退化為 360 − α）；鏡頭向量 (0,0,−1) 的水平投影 = 直立時的方位。`flatness = |m33|` 大於 cos 45° 視為平放。螢幕旋轉：`screen.orientation.angle` 是螢幕相對自然方向的逆時針角度（規範），螢幕「上」的方位 = 機頂方位 + angle（推導：機頂朝西、逆時針轉 90° 後螢幕上方為機身右側，指北）；鏡頭方位不受 UI 旋轉影響。iOS 用 `webkitCompassHeading`（機頂方位）＋同樣的螢幕補償，直立時的行為待實機驗證。來源仲裁：一旦收到絕對事件（`deviceorientationabsolute`、`absolute===true` 或 `webkitCompassHeading`）就忽略相對 `deviceorientation`，兩者混用會讓指針在兩個方向間擺盪。`engine/headingFilter.ts`：單位圓上的時間常數 EMA（τ=500 ms）、離群值閘門（>35° 需連續 4 筆才跟隨）、近 12 筆的圓形標準差作為穩定度；`unwrapAngle` 讓表盤旋轉角連續以配合 CSS 過渡。

## AR 掃描流程

`startARSession` 以階段狀態機捕捉：`outline`（外牆多邊形）→ `room`（每個房間一個多邊形，帶類型標籤）→ `opening`（大門／房門／窗的點）。overlay root 掛 `beforexrselect` 阻止 UI 點擊觸發 XR `select`。Chrome 平面偵測時，水平面取最大且高度 < 0.4 m 者為地板，垂直面投影成牆線供小地圖參考。`ScanPage.finish()` 把多邊形轉成 cm、以外牆最小點歸零、修正為順時針，門窗依最近外牆邊取法線（朝屋內）作為 facing，大門存在時以其反向＋北偏角設定房屋朝向。

## AR 分層

- Tier 1：原生 WebXR `immersive-ar` + hit-test（Chrome Android、Samsung Internet、Quest、visionOS Safari）。Chrome 147+ 另用 `plane-detection` 顯示地板並可 `initiateRoomCapture()`。
- Tier 2：iOS 用 Variant Launch。`main.tsx` 在 iOS 且 `VITE_VARIANT_LAUNCH_KEY` 存在時提早注入 `https://launchar.app/sdk/v1?key=…`（不帶 `redirect=true`，由掃描頁決定何時交棒）；SDK 觸發 `vlaunch-initialized`，`detail.webXRStatus` 為 `supported`（已在 Launch 檢視器內，直接走 Tier 1）／`launch-required`（按鈕以 `launchUrl` 交棒 App Clip）／`unsupported`。`startARSession` 只硬性要求 `hit-test`，`local-floor` 為選配（Launch 檢視器可能只給 `local`），參考空間依 `session.enabledFeatures` 決定。Variant Launch 的 DOM overlay 是「隱藏 overlay root 以外所有元素」模擬的，故 overlay root 為 React 樹外的 `#ar-overlay-root`，UI 以 `createPortal` 渲染；session 期間 `html.ar-active` 讓 body／#root 背景透明（iOS 相機在網頁後方）；`vlaunch-ar-tracking` 狀態轉成中文提示（特徵不足→對準有紋理地面）。Zappar 因自架僅限 Enterprise 且 github.io 不在授權白名單而排除；8th Wall（2026 起開源免費、可自架）為第二 fallback，但需 6.6 MB 與另一套 renderer 管線、尺度需使用者校正，故未整合。
- Tier 3：`FloorPlan.underlay` 照片底圖（縮圖 ≤ 1600px JPEG 存 localStorage）＋兩點比例校正；以及相機羅盤疊圖。全平台可用。

## 師傅來看房（/start，lite 模式）

`guide/script.ts` 是純狀態機：`StepId`（intro／door／owner／more／built／reveal／size／paint／furniture／roomVerdict／summary）、`nextStep`／`prevStep` 回傳 `Move { id, pendingId }`（房間迴圈：paint 之後依 `roomStops` 的順序（主臥→臥室→小孩房→廚房→書房→廁所→客廳…）每間房先問 furniture（有關鍵家具才問）再給 roomVerdict，走完進 summary）、`progressOf`（固定七格脊椎）、屋齡分桶 `BUILT_CHOICES`。進度與目前房間（`stepId`、`pendingId`、`introSeen`）存在 store 的 `lite`，重整不會掉。建圖沿用精靈的 `wizard` 狀態，`engine/wizardPlan.ts` 的 `deriveWizardPlan(wizard, facingBearing)` 把尺寸、塗格、大門位置推成正式 `FloorPlan`（大門固定在草圖下牆，`northOffset` 依羅盤朝向），塗好即 `setFloors`；家具靠牆用 `placeAgainstWall` 直接寫進 store 的 plan（所以使用者自己畫的圖也能走同一段）。方位選擇一律用羅盤（`guide/DoorCompass.tsx`）或草圖上的牆，不用九宮格；揭曉頁的財位圖是 `guide/PalaceRose.tsx` 羅盤玫瑰。`guide/Scene.tsx` 是對話節拍（`useTypewriter` 逐字、點一下加速、講完才出選項、選項可帶一句回話）；`pages/StartPage.tsx` 只負責把每個 step 畫出來。文案原則：一題一畫面、師傅口吻、每題一行「為什麼要問」、每題有台階、中途揭曉（不把價值留到最後）。


`engine/lite.ts`：`LiteRoom { type, palace, facing? }` 只記房間在哪一宮與關鍵家具朝向；`synthesizePlan(facing, rooms)` 合成 9×9 m 北上示意屋（大門在朝向那一側、房間佔對應宮位的 3×3 格、家具置中並依 facing 轉向，`plan.synthetic = true`）。`store.resolveAnalysisPlan()` 在沒有真實平面圖時回傳示意屋；`buildReport` 對 synthetic 跳過形勢規則並改用三維度加權。

## 平面圖精靈

`engine/wizard.ts`：`outlineFromDims`（方形／L 形外牆）、`doorOnWall`（門貼牆、朝屋內）、`gridCells`（外牆內的格子）、`cellsToRooms`（同類相鄰格子 flood-fill，`unionCells` 以邊界邊配對串成直角多邊形，失敗時退回逐格矩形）、`placeAgainstWall`（依物件慣例決定 facing：床頭／書桌朝牆，灶口／馬桶／沙發／神位背牆）、`roomDoorTowards`（房門開在朝屋中心那面牆）。精靈狀態存在 store `wizard`，完成時以 `setFloors` 寫入單一樓層。

## 多樓層

`store.floors[]` 為各層 `FloorPlan`（`name`、`level`，0 = 主層），`plan` 永遠等於 `floors[activeFloor]`。各層以同一外牆原點繪製（新增樓層預設複製外牆）。`runAllFormRules(floors)` 對每層跑單層規則（標記樓層），再以 `crossFloorRules` 對相鄰層（level 差 1）做投影重疊判定（房間重疊率 ≥ 30% 以取樣估算；物件以旋轉矩形 AABB 重疊）。方位與飛星分析以 `mainFloor()`（含大門者，否則 level 0）為準。

## 行動清單（一般使用者視角）

`engine/advice.ts` 把報告轉成 `ActionItem[]`：形勢／外局 finding 的每條化解以關鍵字分級（`classifyRemedy`：裝修 > 搬動 > 小添購 > 免費），項目歸入最簡單那級並保留更徹底的做法；八宅凶方、有房間的流年煞方、凶飛星組合另產生項目。`PLAIN` 表把規則 id 翻成白話標題與一句原因。`plainSummary` 產生摘要段落。

## 師傅看房（story）

`story/chapters.ts` 從 Report＋FloorPlan 產生章節（序、大門、每個房間、流年、財位、總結），每章有鏡頭指令（orbit／door／room／top）、對話泡泡、段落與待辦，文案用師傅第一人稱，測試檢查沒有「不是…而是」與破折號。`story/house3d.ts` 以 three.js 把平面圖建成 3D（cm→m，plan (x,y)→world (x,0,y)；外牆 BoxGeometry、隔間較矮較透、門窗貼牆、家具依高度表、facing 轉 rotation.y、Canvas sprite 標籤；八宮扇形 RingGeometry 貼地可上色與強調），鏡頭以 lerp 追目標位置，封面自動環繞。`pages/StoryPage.tsx` 是全螢幕深色劇場，底部導覽在此路由隱藏。

## 分享圖

`src/share/shareCard.ts` 以字串組出 SVG：`buildShareSvg` 為 1080×1350 單層分享卡，`buildReportSvg` 為高度依內容伸縮的完整報告長圖（共用 `drawPlan`），`svgToPng` 用 `<img>`＋canvas 轉 PNG（2×，總像素上限 1,600 萬以符合 iOS canvas 限制），`shareOrDownload` 優先 Web Share（files），否則下載。只用系統字型，SVG 作為圖片繪入 canvas 時才能正確顯示中文。

## 形勢規則引擎

`buildContext(plan)` 提供中心、方位、房間查找、視線遮擋（線段與所有牆邊相交，端點附近的牆忽略以容許門在牆上）等工具；各規則模組回傳 `Finding[]`，`runFormRules` 去重並依嚴重度排序。分數 = 100 − Σ 權重（高 12、中 6、低 2，各派有別者減半）。
