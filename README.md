# JustNote Learning

自我學習 PWA：每個課程有「筆記、心智圖、快閃卡、題庫、有聲書」五個區塊，內容皆為 Markdown。
資料先存本機（離線可用），連線時同步到 Cloudflare Workers KV。

- 前端：Vite + React + [coss ui](https://coss.com/ui)（Tailwind CSS v4 + Base UI，元件在 `src/components/ui`，設計權杖在 `src/styles.css`）
- PWA：vite-plugin-pwa（precache 全部資源、自動更新）
- 後端：`worker/index.ts`（`/api/sync`，Workers KV）；建置後的靜態檔由 `scripts/gen-assets.mjs` 內嵌進 Worker
- 網域：`learning.finrod.xyz`（見 `wrangler.jsonc`）

## Markdown 格式

| 區塊 | 格式 |
| --- | --- |
| 筆記 | 一般 Markdown（GFM） |
| 心智圖 | 標題層級（`#`）與清單縮排（`-`），由 markmap 轉成心智圖 |
| 快閃卡 | 每行一張卡 `問題 :: 答案`；以 `#` 開頭的行是標籤（例 `#flashcards/iPAS`） |

題庫：每題 `1. 題目`、`(A)`～`(D)` 選項、`答案: C`、可選的 `主題: …`、`解析: …`（`解析(AI):` 會顯示「AI 草稿」標籤）。
支援練習模式（即時對答案）、模擬考（計時、交卷計分）、錯題本、標記、歷次成績，錯題可一鍵轉成快閃卡。
- **混合測驗**：跨多份題庫混合出題（可只選某一科）。
- **弱點分析**：依主題統計正確率並列出「優先加強」；預建題庫的主題對照在 `src/lib/topics.ts`，自己的題目可用 `主題: 名稱` 一行指定。
- **間隔重複**：答錯的題目與快閃卡依 SM-2 簡化版排程（`src/lib/srs.ts`），首頁「今日複習」彙整今天到期的項目；錯題連續記得 21 天後畢業。
作答進度存在 KV 的 `progress`，會跨裝置同步。預建 115 年第 1、2 次初級公告試題各兩科（共 200 題）；
解析為 AI 草稿，僅供參考，法規與數據請以公告為準。

有聲書：檔案存在 R2（`AUDIO` binding），清單與名稱存在 KV（同筆記）。刪除有聲書會一併刪除 R2 檔案。
上傳與串流端點在 `/api/audio/*`；若設定了 `SYNC_TOKEN`，這些端點也會要求密碼（強烈建議設定，否則任何人都能上傳）。

倒數：課程頁可自訂名稱與日期（報名日、考試日、放榜日…），課程頁與首頁卡片顯示還剩幾天。
倒數、作答進度與複習排程都是小型同步文件，存在 KV 的 `progress`（id 前綴 `cd:`、`srs:`、`mix:`）。

## 自動部署（Workers Builds）

GitHub `finrod-chen/learning_site` 已連到 Cloudflare Worker `justnote-learning`：推送到 `main` 會自動執行
`npm run build` → `npx wrangler deploy`。設定可在 Cloudflare Dashboard → Workers → justnote-learning → Settings → Builds 調整。

## 介面元件（coss ui）

元件來自 coss ui registry，可用 shadcn CLI 新增：`npx shadcn@latest add @coss/<name>`。
`src/ui/kit.tsx` 是專案自己的薄包裝（分段控制、選單、帶標籤的輸入／進度／開關），讓頁面程式碼維持簡潔。
深色模式以 `<html class="dark">` 切換。

## 開發與部署

```bash
npm install
npm run dev          # 前端開發（無 /api）
npm run build && npx wrangler dev   # 以 Worker + 本機 KV 完整預覽
npm run deploy       # build + wrangler deploy（需 CLOUDFLARE_API_TOKEN）
```

可選：在 Worker 設定 secret `SYNC_TOKEN`（`npx wrangler secret put SYNC_TOKEN`）即可要求同步密碼，
App 會在需要時提示輸入。也可改用 Cloudflare Access 保護整個網域。
