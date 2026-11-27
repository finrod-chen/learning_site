# 在 JustNote Learning 使用此 Skill

此專案的 App 有「視覺學習」區塊（每個課程的第 3 個分頁），把 Skill 產出的單檔 HTML 顯示在沙箱 iframe 中。
依 `SKILL.md` 製作解說時，請另外遵守下列與本專案相關的約定。

## 交付格式
- **單一、自給自足的 HTML 檔**（不需要 build）。大小請控制在 **500 KB 以內**（App 與 KV 的內容上限是 600 KB）。
- 一個主題一個檔案：`visuals/<主題>.html`。導覽動畫與動手試（explorer）放在同一檔，用頁首的模式切換按鈕切換。App 以 iframe `srcDoc` 載入，相對連結無法使用，所以不要拆成兩個檔案。
- 版面要在 375px 寬度可讀：窄螢幕時加大 SVG 文字，或改用較窄的 viewBox。
- 在 App 內是用 `<iframe sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox">` 顯示：
  - 沒有 `allow-same-origin`，頁面不能讀取 App 的資料或 cookie，也不能呼叫 App 的 API。
  - 不要依賴 `localStorage`、`document.cookie`、`fetch` 到本站、`window.top`、表單送出。
  - 外部連結請用 `target="_blank" rel="noopener"`（來源清單的連結）。
- **不要依賴外部資源才能運作**。字型請用系統字型（本專案字型是 Inter 加系統中文字型），圖形一律內嵌 SVG；App 要能離線顯示。

## 主題（淺色／深色）
App 會把 `data-theme="light|dark"` 寫在 `<html>`，並在切換主題時以 `postMessage({ jnTheme: 'dark' })` 通知 iframe（App 會自動注入接收程式，不需要自己寫）。
Skill 範例已支援 `data-theme`，沿用即可。顏色請用 CSS 變數，並同時檢查淺色與深色。

## 語言與內容
- 標題、說明文字、提示（tooltip）、來源清單都用**正體中文**。專有名詞保留英文縮寫（CBAM、NDC、ITMOs…）並在第一次出現時說明。
- iPAS 淨零碳規劃管理師的內容以**考試公告當時的法規為準**；數字、日期、門檻要標明年份或版本，與題庫標準答案不同時要明說。
- 依 `SKILL.md` 的準確性規定：每個事實都要有實際開啟閱讀過的來源，無法查證的標「未於來源中查證」，簡化處要在頁面上標示。
- 各主題完成後，請把與它相關的題庫主題（`src/lib/topics.ts`）列在說明裡，方便學習者接著練習。

## 加入 App
1. 在課程的「視覺學習」分頁按「新增視覺學習」，貼上 HTML 或載入 `.html` 檔，儲存。
2. 或放進 `seed/` 當作預建內容（需要時再做，會增加首次載入的大小）。
