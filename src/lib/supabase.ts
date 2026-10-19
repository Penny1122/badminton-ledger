import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  throw new Error('缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_PUBLISHABLE_KEY，請檢查 .env.local')
}

// TODO: 連結 Supabase 專案後執行 `npm run gen:types`，改成 createClient<Database>
export const supabase = createClient(url, key)
