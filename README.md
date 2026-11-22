# JustNote Learning

自我學習 PWA：每個課程有「筆記、心智圖、快閃卡、有聲書」四個區塊，內容皆為 Markdown。
資料先存本機（離線可用），連線時同步到 Cloudflare Workers KV。

- 前端：Vite + React + [Arc UI](https://uiarc.dev)（`src/components/arc`）
- PWA：vite-plugin-pwa（precache 全部資源、自動更新）
- 後端：`worker/index.ts`（`/api/sync`，Workers KV）；建置後的靜態檔由 `scripts/gen-assets.mjs` 內嵌進 Worker
- 網域：`learning.finrod.xyz`（見 `wrangler.jsonc`）

## Markdown 格式

| 區塊 | 格式 |
| --- | --- |
| 筆記 | 一般 Markdown（GFM） |
| 心智圖 | 標題層級（`#`）與清單縮排（`-`），由 markmap 轉成心智圖 |
| 快閃卡 | 每行一張卡 `問題 :: 答案`；以 `#` 開頭的行是標籤（例 `#flashcards/iPAS`） |

有聲書：檔案存在 R2（`AUDIO` binding），清單與名稱存在 KV（同筆記）。刪除有聲書會一併刪除 R2 檔案。
上傳與串流端點在 `/api/audio/*`；若設定了 `SYNC_TOKEN`，這些端點也會要求密碼（強烈建議設定，否則任何人都能上傳）。

## 自動部署（Workers Builds）

GitHub `finrod-chen/learning_site` 已連到 Cloudflare Worker `justnote-learning`：推送到 `main` 會自動執行
`npm run build` → `npx wrangler deploy`。設定可在 Cloudflare Dashboard → Workers → justnote-learning → Settings → Builds 調整。

## 開發與部署

```bash
npm install
npm run dev          # 前端開發（無 /api）
npm run build && npx wrangler dev   # 以 Worker + 本機 KV 完整預覽
npm run deploy       # build + wrangler deploy（需 CLOUDFLARE_API_TOKEN）
```

可選：在 Worker 設定 secret `SYNC_TOKEN`（`npx wrangler secret put SYNC_TOKEN`）即可要求同步密碼，
App 會在需要時提示輸入。也可改用 Cloudflare Access 保護整個網域。
