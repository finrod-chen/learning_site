import type { Course, Item } from './types'
import flashcards from '../../seed/flashcards.md?raw'
import mindmap from '../../seed/mindmap.md?raw'

export const SEED_COURSE_ID = 'seed-ipas-net-zero'

const guide = `# 如何使用這個課程

每個課程有三個區塊，內容都以 **Markdown** 撰寫。

## 筆記
一般的 Markdown 文件，支援標題、清單、表格、程式碼與引用。

## 心智圖
用標題層級與清單縮排描述階層，系統會自動畫成可縮放、可展開的心智圖。

\`\`\`markdown
# 主題
## 分支一
- 重點 A
  - 細節
## 分支二
- 重點 B
\`\`\`

## 快閃卡
每一行寫一張卡片，用 \`::\` 分隔問題與答案。第一行可以放標籤。

\`\`\`markdown
#flashcards/iPAS
京都議定書生效年份 :: 2005年2月16日
\`\`\`

## 小技巧
- 在編輯器寫完內容後，可以按「儲存」旁的箭頭，選擇存成筆記、心智圖或快閃卡。
- 在手機上可以把網站「加到主畫面」，離線也能複習。
- 資料會先存在本機，連線時自動同步到雲端。
`

const t = 1

export const seedCourse: Course = {
  id: SEED_COURSE_ID,
  name: 'iPAS淨零碳管理規畫師初級',
  createdAt: t,
  updatedAt: t,
}

export const seedItems: Item[] = [
  { id: 'seed-ipas-guide', courseId: SEED_COURSE_ID, type: 'note', title: '如何使用這個課程', content: guide, createdAt: t + 2, updatedAt: t },
  { id: 'seed-ipas-mindmap', courseId: SEED_COURSE_ID, type: 'mindmap', title: '考點心智圖', content: mindmap.trim() + '\n', createdAt: t + 1, updatedAt: t },
  { id: 'seed-ipas-flashcards', courseId: SEED_COURSE_ID, type: 'flashcards', title: '考點快閃卡', content: flashcards.trim() + '\n', createdAt: t, updatedAt: t },
]
