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

`engine/orientation.ts` 依 W3C DeviceOrientation 的 Z-X'-Y'' 旋轉矩陣把 alpha／beta／gamma 轉成世界座標：機頂向量 (0,1,0) 的水平投影 = 平放時的方位（β=γ=0 時退化為 360 − α）；鏡頭向量 (0,0,−1) 的水平投影 = 直立時的方位。`flatness = |m33|` 大於 cos 45° 視為平放。螢幕旋轉：`screen.orientation.angle` 是螢幕相對自然方向的逆時針角度（規範），螢幕「上」的方位 = 機頂方位 + angle（推導：機頂朝西、逆時針轉 90° 後螢幕上方為機身右側，指北）；鏡頭方位不受 UI 旋轉影響。iOS 用 `webkitCompassHeading`（機頂方位）＋同樣的螢幕補償，直立時的行為待實機驗證。

## AR 分層

- Tier 1：原生 WebXR `immersive-ar` + hit-test（Chrome Android、Samsung Internet、Quest、visionOS Safari）。Chrome 147+ 另用 `plane-detection` 顯示地板並可 `initiateRoomCapture()`。
- Tier 2：iOS 供應層。`detectAR()` 判斷 iOS 且 `VITE_IOS_XR_SDK_URL` 已設定時，掃描頁提供「在 iPhone 啟動 AR」按鈕，`loadIOSProvider()` 注入 SDK 後等待 `navigator.xr` 出現，之後與 Tier 1 共用 `startARSession`。
- Tier 3：`FloorPlan.underlay` 照片底圖（縮圖 ≤ 1600px JPEG 存 localStorage）＋兩點比例校正；以及相機羅盤疊圖。全平台可用。

## 多樓層

`store.floors[]` 為各層 `FloorPlan`（`name`、`level`，0 = 主層），`plan` 永遠等於 `floors[activeFloor]`。各層以同一外牆原點繪製（新增樓層預設複製外牆）。`runAllFormRules(floors)` 對每層跑單層規則（標記樓層），再以 `crossFloorRules` 對相鄰層（level 差 1）做投影重疊判定（房間重疊率 ≥ 30% 以取樣估算；物件以旋轉矩形 AABB 重疊）。方位與飛星分析以 `mainFloor()`（含大門者，否則 level 0）為準。

## 形勢規則引擎

`buildContext(plan)` 提供中心、方位、房間查找、視線遮擋（線段與所有牆邊相交，端點附近的牆忽略以容許門在牆上）等工具；各規則模組回傳 `Finding[]`，`runFormRules` 去重並依嚴重度排序。分數 = 100 − Σ 權重（高 12、中 6、低 2，各派有別者減半）。
