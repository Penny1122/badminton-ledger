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

## 建立管理員帳號（只需做一次）

1. Supabase Dashboard → Authentication → Users → **Add user**，輸入 Email 和密碼，勾選 Auto Confirm
2. Authentication → Sign In / Providers → 關閉 **Allow new users to sign up**
3. SQL Editor 執行（換成剛建立的 user id）：

   ```sql
   insert into public.admins (user_id) values ('<user-id>');
   ```

## 分攤規則

- 每人場地費 = ⌈場地費 ÷ 出席人數⌉（VIP 也分攤）
- VIP 應付 = 每人場地費；一般應付 = 每人場地費 + 加收（預設 40，記為「球費」）
- 買球：直接記一筆「羽球」支出
- 向 VIP 收球款：建立收款單，自訂每人金額（例如 250），收到後逐一勾選，記入「VIP 球款」
