# Changelog

本專案遵循 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)，版本號依 [Semantic Versioning](https://semver.org/lang/zh-TW/)。

## [Unreleased]

### Added
- 替卦（起星）：兼向超過門檻（3.5°／4.5°／6° 可選）時自動改用傳統蔣大鴻／沈氏替星表排盤，並標示「替而不替」；可設定一律下卦僅提示。
- 七星打劫（離宮真打劫／坎宮假打劫）盤面條件判定，標示為進階格局。
- 多樓層平面圖：樓層切換、複製外牆新增樓層、層序；樓上樓下規則（廁所在臥室／廚房／神明廳上方、馬桶在床上方、床在灶上方、樓梯壓床灶神位、臥室懸空於騎樓／挑空）。
- 高度資訊：樑深（≥ 30 cm 加重）、天花板淨高、吊燈／吊扇壓床座。
- GitHub Pages 部署（GitHub Actions，`BASE_PATH` 子路徑、SPA 404 fallback、PWA scope）。
- 平面圖「底圖」模式：匯入建商平面圖或手繪草圖照片（iPhone 相機可直接拍），點兩個已知距離校正比例後描圖；底圖可調透明度、旋轉、移除。這是 iOS 沒有 WebXR 時的通用替代路徑。
- iOS AR 供應層抽象（`src/ar/providers.ts`）：以環境變數 `VITE_IOS_XR_PROVIDER`／`VITE_IOS_XR_SDK_URL` 掛載 App Clip 型 WebXR polyfill（如 Variant Launch），掛載後沿用同一套 hit-test 掃描流程。

### Changed
- 部署目標由 Cloud Run 改為 GitHub Pages；Dockerfile 保留作為自架選項。

## [0.1.0] - 2026-09-05

### Added
- 純 TypeScript 風水引擎：五行生剋、後天八卦、二十四山（含空亡）、八宅命卦與八遊星、玄空飛星排盤（運／山／向盤、旺山旺向等格局、合十、伏吟反吟、三般卦）、九星 81 組合吉凶、流年／流月飛星、太歲歲破三煞與犯太歲。
- 形勢派規則引擎：從平面圖幾何自動判定穿堂煞、門對門、門沖床、樑壓床、鏡照床、開門見灶、水火相沖、廁所居中、火燒天門、缺角、書桌背門、神位背廁等 40 餘條規則，附化解建議與嚴重度。
- 報告組合器：八宅／玄空／流年／形勢四維度評分與優先處理清單，可匯出 Markdown 與列印。
- Web 端 UI（Vite + React 19 + Tailwind 4，PWA）：成員與房屋資料、即時羅盤（iOS `webkitCompassHeading` 與 Android `deviceorientationabsolute`，螢幕旋轉修正、WMM2025 磁偏角）、相機＋羅盤疊圖、SVG 平面圖編輯器（外牆、房間、19 種物件、九宮扇形／方格疊圖、煞線標示）、WebXR AR 地板轉角掃描（hit-test，附平面偵測顯示）、風水知識庫頁。
- 外局問卷（38 題，路沖／反弓／壁刀／天斬／電塔…）併入報告形勢分頁與評分。
- 風水知識庫頁：八宅遊星表、九星、二十四山、五行、三元九運，以及自調研報告解析的形勢派規則庫 204 條（可依類別篩選、搜尋）。
- 住宅文昌位／暗財位／洩財位（依坐向）與「廁所／廚房落財位或文昌位」提醒；魯班尺（文公尺）尺寸查表。
- 各派有別的判法做成設定：取向依據（自家大門／陽台採光面／大樓正門）、灶位判法（座凶向吉／全在吉方）。
- 對照 4 張公開飛星盤（108 個數字）與結構不變量（排列、鏡像、天人同盤、5-5 不同宮）的迴歸測試；`scripts/verify_flying_star.py` 為調研時的獨立 Python 驗證器。
- 部署：Dockerfile（nginx 靜態站，Cloud Run 相容），映像已本機建置並以容器實測。
