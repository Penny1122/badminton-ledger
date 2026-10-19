-- 設定（或重設）編輯密碼
-- 1. 把第 11 行單引號裡的文字換成你的密碼（至少 8 個字元，單引號要保留）
-- 2. 在 Supabase 後台 SQL Editor 執行
-- 3. 執行完把 SQL Editor 裡這段查詢刪掉，不要存成 snippet
--
-- 忘記密碼時也用這段重設。重設後，其他裝置會在下次開啟或寫入時回到唯讀。

insert into private.settings (id, password_hash)
values (
  true,
  extensions.crypt('在這裡填密碼', extensions.gen_salt('bf', 10))
)
on conflict (id) do update
set password_hash = excluded.password_hash,
    password_changed_at = now();
