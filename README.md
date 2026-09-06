# 嘟嘟風水（dudu-fengshui）

輸入家人出生年、量測房屋朝向、畫出平面圖，就能得到八宅、玄空飛星、流年、形勢派四合一的室內風水分析與具體化解建議。手機上可用羅盤直接量向、用相機疊圖看二十四山，Android Chrome 還能用 AR 點地板轉角自動建出外牆。

這是一個純前端的 PWA，所有計算在瀏覽器完成，資料只存在你的裝置（localStorage），沒有後端、不上傳任何資料。

## 功能

| 模組 | 內容 |
|---|---|
| 八宅派 | 命卦（立春為界）、東西四命／宅、八遊星、門／床頭／灶座灶口／書桌／神位／馬桶逐項吉凶 |
| 玄空飛星 | 三元九運、運／山／向盤（下卦與替卦）、旺山旺向等格局、七星打劫、81 組合吉凶、正零神、兼向與空亡提示 |
| 流年 | 年／月飛星、五黃二黑三碧七赤位置、太歲歲破三煞、犯太歲生肖、對應到你的房間 |
| 形勢派 | 由平面圖幾何自動判定 50 餘條禁忌（穿堂煞、門沖床、樑壓床、鏡照床、開門見灶、水火相沖、廁所居中、火燒天門、缺角…），多樓層時另判樓上樓下關係（廁所在臥室上方、床在灶上方…），附化解方法；另有 38 題外局問卷與 204 條規則庫可查 |
| 空間技術 | DeviceOrientation 羅盤（iOS／Android）、WMM2025 磁偏角、相機羅盤疊圖、WebXR AR 掃描（外牆→房間→門窗三階段，自動生成平面圖；Chrome 平面偵測）、照片底圖描圖（兩點比例校正）、iOS 經 Variant Launch App Clip |
| 隱私 | 純前端、資料只存本機 localStorage；首次使用同意聲明；「隱私與免責」頁可一鍵刪除全部資料 |
| 輸出 | 總評與分項分數、優先處理清單、九宮疊圖、分享用 PNG（平面圖＋分析層）、完整報告長圖 PNG、Markdown 文字版 |

## 安裝

需求：Node.js 20 以上（開發時使用 24）。

```bash
git clone <repo> dudu-fengshui
cd dudu-fengshui
npm install
```

## 使用

```bash
npm run dev      # 開發伺服器（--host 已開，手機連同網段 IP 測試；感測器需 HTTPS 或 localhost）
npm test         # vitest，引擎單元測試
npm run build    # tsc + vite build → dist/
npm run preview  # 預覽 dist
```

手機測試感測器時，Safari／Chrome 要求安全來源：用 `localhost` 或部署到 HTTPS。最快的方式是 `npx vite --host` 後用 ngrok／Cloudflare Tunnel 建 HTTPS 轉發。

iOS 上的 AR：Safari 原生不支援 WebXR。預設走「底圖描圖」（拍平面圖照片校正比例後描圖）與「相機羅盤疊圖」。若要真正的 AR 點地板建圖，用 [Variant Launch](https://launch.variant3d.com)（App Clip 檢視器，免費 Developer 方案每月 3,000 views）：

1. 建立 Launch 專案取得 SDK key，在 Launch Admin 登記精確主機名（GitHub Pages 是 `zhixuli0406.github.io`；localhost 免登記）。
2. 本機：複製 `.env.example` 為 `.env` 填 `VITE_VARIANT_LAUNCH_KEY`。GitHub Pages：到 repo Settings → Secrets 新增 `VARIANT_LAUNCH_KEY`，工作流會在建置時注入。
3. iPhone 用 Safari 開掃描頁，按「在 iPhone 啟動 AR（App Clip）」。Launch 檢視器提供 hit-test、anchors、DOM overlay；不提供平面偵測與深度。

### 操作流程

最短路徑是首頁的「跟師傅走一遍」（`/start`）：師傅到門口，一次問一題。先問這是公寓／大樓的一戶、樓中樓還是透天（決定要看幾層）；大門朝哪用手機羅盤直接量（畫面先告訴你站哪裡）；再問誰當家、還有誰、房子幾年蓋的，問完先揭曉宅卦、財位、文昌位與命卦合不合。接著建圖：手機支援 AR（Android Chrome、iPhone 經 App Clip）就拿鏡頭跟師傅走一圈，點外牆轉角、房間角落、門窗與家具的位置，朝向由牆面自動判斷；不支援就站在門口描一下房子、在草圖上塗出房間、每間房選家具靠哪面牆。多層住家逐層建。然後每間房回一段評語，最後給分數、最要緊的三件事與今年要避的方位。每題都有台階（不知道、先跳過、用畫的）。完整流程如下：


1. 「資料」：新增家庭成員（出生日期、性別）、房屋朝向（可按「用羅盤量」）、建成年與判法設定。
2. 「平面圖」：預設走精靈（大小→大門→朝向→塗房間→家具靠牆，約一分鐘），完成後可到「微調」細修。其他來源：空間掃描（Android Chrome 或 iPhone App Clip）沿房子走一圈點外牆轉角、各房間角落與門窗，自動生成；拍照描圖（拍建商平面圖，兩點校正比例後描）；或手繪。之後放床、灶、桌等物件並用「依大門朝向校正北方」。多樓層在「更多」面板新增。
3. 「屋外環境」：勾選路沖、壁刀、高壓電塔等問卷。
4. 「報告」：預設「怎麼做」（白話摘要＋由簡到繁的行動清單），「進階分析」有分數與八宅、飛星、流年、形勢、五行分頁；「分享圖」產出單層分析圖，「下載」產出完整報告長圖。

## 部署（GitHub Pages）

推到 `main` 即由 `.github/workflows/deploy.yml` 測試、建置並發佈到 GitHub Pages（`https://<user>.github.io/dudu-fengshui/`）。子路徑由 `BASE_PATH` 環境變數注入（本機預設 `/`）。GitHub Pages 為 HTTPS，羅盤、相機與 WebXR 皆可用。

自架替代：`docker build -t dudu-fengshui . && docker run -p 8080:8080 dudu-fengshui`（nginx 靜態站，含 SPA fallback 與 Permissions-Policy）。

## 文件

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)：分層、座標約定、排盤演算法、規則引擎設計
- [docs/research/](docs/research/)：風水知識與 Web 空間技術調研（含來源與各派分歧）
- [CHANGELOG.md](CHANGELOG.md)

## 免責

本工具依傳統典籍與坊間通則整理，屬文化參考，各派說法不一之處在介面標示「各派有別」。不構成醫療、法律或投資建議。

## License

MIT
