# 🏸 羽球記帳

羽球群組的記帳系統：場次分攤、收支紀錄、餘額，並可產生公開連結分享到 LINE 群組。

技術：React + TypeScript + Vite、Tailwind CSS、TanStack Query、Supabase

## 本機開發

```bash
pnpm install
cp .env.example .env.local   # 填入 Supabase URL 與 publishable key
pnpm dev
```

## 資料庫

Migration 放在 `supabase/migrations/`。

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm db:push      # 套用 migration
pnpm gen:types    # 產生 src/lib/database.types.ts
```

## 權限：共用編輯密碼

- 不做帳號登入。任何人打開網址都能看帳（這個網址就是分享到 LINE 的連結）
- 預設唯讀，點右上角「🔒 唯讀」輸入編輯密碼才能新增、編輯、作廢；解鎖後這台裝置會記住
- 密碼在資料庫端檢查，只存 bcrypt 雜湊；同一個 IP 10 分鐘內錯 10 次會暫停 10 分鐘

**設定或重設密碼**：打開 [supabase/set-password.sql](supabase/set-password.sql)，換成你的密碼後，貼到 Supabase SQL Editor 執行。執行完把 SQL Editor 裡那段刪掉，不要存成 snippet。

## 分攤規則

- 每人場地費 = ⌈場地費 ÷ 出席人數⌉（VIP 也分攤）
- VIP 應付 = 每人場地費；一般應付 = 每人場地費 + 加收（目前 50，在設定頁可改，記為「球費」）
- 買球：直接記一筆「羽球」支出
- 向 VIP 收球款：建立收款單，自訂每人金額（例如 250），收到後逐一勾選，記入「VIP 球款」
