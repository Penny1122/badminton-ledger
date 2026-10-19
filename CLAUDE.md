# 羽球記帳（badminton-ledger）

羽球群組的公基金記帳網站：記錄活動（打球、教練課）的分攤與收款、收支帳目、餘額，並分享到 LINE 群組。
使用者是群組的記帳者（一個人），群組成員透過網址唯讀瀏覽、自己報名活動。介面全部是繁體中文、手機優先。

- 正式網站：Vercel，`main` 分支自動部署；`develop` 分支產生 Preview 部署
- 資料庫：Supabase（project ref `ravmxvoqovcosslfdujv`），**只有一個資料庫，正式和開發共用**
- GitHub：`Penny1122/badminton-ledger`

## 技術與指令

React 19 + TypeScript + Vite、Tailwind CSS v4、TanStack Query、React Router v7、supabase-js、dayjs。套件管理用 **pnpm**。

```bash
pnpm dev          # 本機開發（http://localhost:5173），連的是正式資料庫
pnpm build        # tsc 型別檢查 + 建置；改完一定要跑
pnpm lint         # oxlint；editMode.tsx 的 only-export-components 警告是已知的，可忽略
pnpm db:push      # 套用 supabase/migrations 到 Supabase（會問 y/n，可用 `echo y |`）
pnpm exec supabase db query --linked -f <file.sql>   # 對正式資料庫執行 SQL（測試用，見下方）
```

`.env.local`（不進 git）放 `VITE_SUPABASE_URL`、`VITE_SUPABASE_PUBLISHABLE_KEY`；Vercel 的環境變數也是這兩個。

## 權限模型（最重要）

**不做帳號登入**，和使用者的另一個專案「麻將計分」同一套做法：

- 任何人都能**讀**所有資料表（RLS 對 anon 只開 select）。網址本身就是分享到 LINE 的連結
- 所有**寫入**都經過 `security definer` 的資料庫函式（RPC），函式第一件事是 `private.check_password(p_password)` 檢查共用的編輯密碼
- 密碼只存 bcrypt 雜湊在 `private.settings`；同 IP 10 分鐘錯 10 次暫停。設定／重設密碼用 `supabase/set-password.sql`（畫面上沒有改密碼功能）
- 前端解鎖後把密碼存 localStorage（`badminton.editPassword`），只是方便，不是安全機制
- 例外：**公開報名** `join_session` / `leave_session` 不用密碼（見下方規則），用 `private.allow_public_action()` 限制同 IP 10 分鐘 30 次

寫入函式的回傳慣例：
- 成功 `{"ok": true, ...}`
- 密碼問題回傳（不是 raise）`{"error": "invalid_password" | "too_many_attempts" | "password_not_set" | "too_many_requests"}`。不能 raise，否則交易回滾會把失敗次數也回滾
- 資料問題 `raise exception 'invalid_input: <給使用者看的中文訊息>'`、`'not_found'`、`'linked_transaction'`
- 前端 `src/lib/api.ts` 的 `callWrite()` 把這些轉成 `ApiError`

## 業務規則

**活動（`sessions`）**，`kind` 是 `play`（打球）或 `coaching`（教練課），建立後不能改：
- 打球：每人 = ⌈場地費 ÷ 人數⌉（無條件進位到元，VIP 也分攤）；非 VIP 另加 `settings.surcharge`（目前 50，在「設定 → 群組設定」改，只影響之後建立的活動；記為「球費」）
- 教練課：每人 = ⌈教練費 ÷ 人數⌉，不收球費。金額沿用 `court_fee` 欄位
- 建立活動時自動記一筆支出（打球「場地費」、教練課「教練費」），因為打完就付給球館／教練
- 每位參加者一筆應收款 `receivables`；勾選已付款時自動記收入：打球記「場地分攤」＋「球費」兩筆，教練課記「教練課分攤」一筆；取消勾選把那幾筆收入作廢
- **已經有人付款**：只能改日期、時間、場地、面數、備註；費用和名單鎖定、不能作廢、公開報名關閉
- 時間選填；結束比開始早代表**跨日**（22:00–01:00），只有相等才擋
- `courts`（幾面場）、`venue`（場地名稱文字）只是資訊，不影響金額
- 前端試算 `perPersonShare()` 要和資料庫算法一致

**公開報名**：任何人可以在活動加入（從名冊選或輸入新名字）或移除參加者，條件是活動沒作廢、沒有人付款；活動結束後也可以（補記臨時來的人）。每次變動都重新產生應收款、重算金額。新名字會進名冊。

**收款單（`collections`）**：向一群人收固定金額，主要是「VIP 球款」（每人 200–300，不和買球支出綁定）。收到錢勾選，記一筆收入到收款單的分類。

**成員（`members`）**：名字唯一，`is_vip`，`is_active`（停用不刪除）。應收款存建立當下的 `is_vip` 快照。第一次來的人輸入名字就自動進名冊。

**帳目（`transactions`）**：金額一律正整數（新台幣元）。錯帳用「作廢」（`voided_at`），不實體刪除。活動或收款單自動產生的帳目（有 `session_id` / `collection_id` / `receivable_id`）不能手動修改。

**分類（`categories`）**：有 `system_key` 的是系統分類，程式靠 key 找分類、不靠名稱，可以改名但不能封存：
`court_share`（場地分攤）、`ball_fee`（球費）、`vip_ball`（VIP 球款）、`coach_share`（教練課分攤）、`court_fee`（場地費）、`shuttlecock`（羽球）、`coach_fee`（教練費）。

**首頁數字**：實際餘額 = 未作廢收入 − 支出（`ledger_summary` view）；待收款 = 未付的應收款（不含作廢活動／收款單）；球款水位 = VIP 球款 + 球費 − 羽球支出（`category_totals` view）。

**常用場地（`venues`）**：名稱＋Google 地圖連結。活動只存場地名稱文字，分享時用名稱對到地圖連結；刪除常用場地不影響舊活動。

## 程式結構

```
src/
  main.tsx                 路由（React Router）
  index.css                顏色 token（深淺色）
  lib/
    supabase.ts            client
    api.ts                 callWrite()、ApiError、錯誤訊息
    ledger.ts              所有型別、讀取 hooks（useXxx）、寫入函式 —— 和資料庫對接都在這裡
    editMode.tsx           解鎖狀態（password、canEdit、unlock、lock）
    useEditAction.ts       執行需要密碼的寫入；密碼失效時回到唯讀並帶到 /unlock
    usePublicAction.ts     不需要密碼的寫入（公開報名）
    shareText.ts           活動分享到 LINE 的文字
    format.ts              金額、日期、時間範圍格式
    theme.ts               深淺色切換
  components/              AppLayout（標題列、返回鍵、底部分頁）、ReceivableList、MemberPicker、SignupPanel、ShareButtons、TimeSelect…
  pages/                   一頁一個檔案
supabase/
  migrations/              依時間排序，已套用的不要再改，改動一律新增一個 migration
  set-password.sql         設定編輯密碼
```

底部分頁：首頁 `/`、帳務 `/transactions`、活動 `/sessions`（含收款單分頁）、設定 `/settings`（成員名冊、常用場地、分類管理、群組設定）。畫面上叫「活動」「帳務」，程式和資料表沿用 `sessions`、`transactions`。

## 慣例

- **顏色只用語意 token**（`bg-surface`、`text-muted`、`text-accent-ink`、`text-danger`、`text-warn`…，定義在 `src/index.css`），不要直接寫 `slate-500`、`emerald-600`。預設深色，`<html class="dark">`
- 程式註解用繁體中文，說明「為什麼」
- 需要密碼的頁面包在 `<RequireEdit>`；唯讀時隱藏編輯按鈕，不要只靠停用
- 寫入後 `useEditAction` / `usePublicAction` 會 `invalidateQueries()` 全部重新載入
- `useSearchParams` 的 `setSearchParams` 連續呼叫兩次，第二次會用舊網址蓋掉第一次；一次改多個參數要合在同一次呼叫（見 `TransactionsPage` 的 `setParam`）
- 金額顯示用 `formatTWD()`；日期 `formatDay()` → `10/19（一）`
- Windows 環境，git 會有 CRLF 警告，可忽略

## 改資料庫的流程

1. 新增 migration 檔（`supabase/migrations/<yyyymmddhhmmss>_<名稱>.sql`），不要改已套用的檔案
2. **向下相容**：正式網站（`main`）可能還是舊版前端。改 RPC 參數時，新參數放最後並給 `default null`（null 代表「沿用原本的值」），舊的呼叫方式要能照常運作。改參數要先 `drop function` 舊簽名再 `create`，並重新 `revoke ... from public` / `grant execute ... to anon, authenticated`
3. **推之前先測**：把 migration 內容和測試包在 `begin; ... rollback;` 裡，用 `pnpm exec supabase db query --linked -f <file>` 跑，確認結果後才 `pnpm db:push`。測試裡用 `update private.settings set password_hash = ...` 換成測試密碼，rollback 後會復原
4. 推之前告訴使用者會影響正式資料庫
5. `supabase db reset --linked` 等破壞性指令會被 Claude Code 自動模式擋下，請使用者自己執行

## Git 流程

- 開發一律在 **`develop`**；使用者說要上線時才把 `develop` 合併到 `main`
- commit 訊息用英文，結尾加 `Co-Authored-By`
- 改完先 `pnpm build`，請使用者在 `pnpm dev` 上試過再 commit

## 已決定不做

- 收據照片上傳（`transactions.receipt_path` 欄位保留不用）
- 帳號登入、LINE 登入
- 自動推播到 LINE 群組（LINE 官方帳號主動推播依群組人數計費，免費額度很快用完）；改成新增活動後跳出「分享到 LINE」
