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
| 空間技術 | DeviceOrientation 羅盤（iOS／Android）、WMM2025 磁偏角、相機羅盤疊圖、WebXR AR hit-test 掃描（含平面偵測與房間掃描）、照片底圖描圖（兩點比例校正）、iOS App Clip 型 WebXR 供應層（可選） |
| 輸出 | 分數儀表、優先處理清單、九宮疊圖、Markdown 匯出、列印 |

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

iOS 上的 AR：Safari 原生不支援 WebXR。預設走「底圖描圖」（拍平面圖照片校正比例後描圖）與「相機羅盤疊圖」；若要真正的 AR 點地板建圖，複製 `.env.example` 為 `.env` 填入 App Clip 型供應層的 SDK 網址（見 `docs/research/05-ios-webar-alternatives.md`），掃描頁會出現「在 iPhone 啟動 AR」按鈕。

### 操作流程

1. 「資料」頁新增家庭成員（出生日期、性別）與房屋建成年。
2. 「羅盤」頁站在大門內側朝外，鎖定讀數後按「設為朝向」。
3. 「平面圖」頁：先點外牆轉角畫外牆 → 拖曳畫房間 → 放置大門、床、灶、桌等物件（箭頭方向有意義，見頁面提示）→ 按「依大門朝向校正北方」。多樓層按「＋樓層（複製外牆）」，各層以同一外牆原點繪製。Android Chrome 可改走首頁的「AR 空間掃描」點地板轉角自動建外牆。
4. 首頁「外局問卷」勾選屋外環境（路沖、壁刀、高壓電塔等）。
5. 「報告」頁看分數、優先建議與各派細節；各派有別的判法（取向依據、灶位）可在「資料」頁切換。

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
