-- 羽球群組記帳：初始 schema
-- 金額一律以「新台幣元」整數儲存；日期以台北時區為準。

create type public.txn_type as enum ('income', 'expense');

-- ---------------------------------------------------------------------------
-- 管理員：只有列在這張表的帳號能讀寫資料
-- ---------------------------------------------------------------------------
create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- ---------------------------------------------------------------------------
-- 群組設定（固定只有一列）
-- ---------------------------------------------------------------------------
create table public.settings (
  id          boolean primary key default true check (id),
  group_name  text not null default '羽球團',
  surcharge   integer not null default 40 check (surcharge >= 0),  -- 非 VIP 每次加收（球費）
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 收支分類
-- system_key 標記系統自動記帳會用到的分類，程式靠它找分類，不靠名稱
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  type        public.txn_type not null,
  name        text not null,
  system_key  text unique,
  sort_order  integer not null default 0,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (id, type),   -- 讓 transactions 用複合外鍵確保分類類型一致
  unique (type, name)
);

-- ---------------------------------------------------------------------------
-- 成員名冊（不需要帳號）
-- ---------------------------------------------------------------------------
create table public.members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  is_vip     boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 打球場次
-- ---------------------------------------------------------------------------
create table public.sessions (
  id         uuid primary key default gen_random_uuid(),
  played_on  date not null,
  venue      text,
  court_fee  integer not null check (court_fee > 0),
  note       text,
  voided_at  timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 帳目（實際收付的現金流）
-- ---------------------------------------------------------------------------
create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  type          public.txn_type not null,
  category_id   uuid not null,
  amount        integer not null check (amount > 0),
  occurred_on   date not null default (now() at time zone 'Asia/Taipei')::date,
  note          text,
  session_id    uuid references public.sessions (id),
  receivable_id uuid,  -- 外鍵在 receivables 建立後補上
  receipt_path  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  voided_at     timestamptz,
  void_reason   text,
  foreign key (category_id, type) references public.categories (id, type)
);

-- ---------------------------------------------------------------------------
-- 收款單：不屬於場次的批次收款，例如「向 VIP 收球款，每人 250」
-- 金額由記帳者決定，不和任何一筆買球支出綁定
-- ---------------------------------------------------------------------------
create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  category_id  uuid not null references public.categories (id),  -- 收到錢時記入的收入分類
  collected_on date not null default (now() at time zone 'Asia/Taipei')::date,
  note         text,
  voided_at    timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 應收款：每次打球每人應付、或收款單裡每人應付
-- 收到錢時填 paid_at，並產生對應的收入帳目（transactions.receivable_id）
-- ---------------------------------------------------------------------------
create table public.receivables (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid references public.sessions (id),
  collection_id    uuid references public.collections (id),
  member_id        uuid references public.members (id),
  guest_name       text,                                       -- 不在名冊的臨打
  is_vip           boolean not null default false,             -- 建立當下的快照
  share_amount     integer not null check (share_amount >= 0), -- 場地分攤或收款單金額
  surcharge_amount integer not null default 0 check (surcharge_amount >= 0), -- 加收球費
  amount_due       integer generated always as (share_amount + surcharge_amount) stored,
  paid_at          timestamptz,
  created_at       timestamptz not null default now(),
  check (num_nonnulls(session_id, collection_id) = 1),
  check (num_nonnulls(member_id, guest_name) = 1)
);

alter table public.transactions
  add constraint transactions_receivable_id_fkey
  foreign key (receivable_id) references public.receivables (id);

create index transactions_occurred_on_idx on public.transactions (occurred_on desc);
create index transactions_session_id_idx on public.transactions (session_id);
create index transactions_receivable_id_idx on public.transactions (receivable_id);
create index receivables_session_id_idx on public.receivables (session_id);
create index receivables_collection_id_idx on public.receivables (collection_id);
create index receivables_member_id_idx on public.receivables (member_id);

-- ---------------------------------------------------------------------------
-- updated_at 自動更新
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger transactions_touch before update on public.transactions
  for each row execute function public.touch_updated_at();
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- 餘額摘要
-- balance：已收 − 已付（手上的現金）
-- outstanding：尚未收到的應收款（不含已作廢的場次或收款單）
-- ---------------------------------------------------------------------------
create view public.ledger_summary
with (security_invoker = true)
as
select
  coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0)::bigint as balance,
  (
    select coalesce(sum(r.amount_due), 0)::bigint
    from public.receivables r
    left join public.sessions s on s.id = r.session_id
    left join public.collections c on c.id = r.collection_id
    where r.paid_at is null
      and s.voided_at is null
      and c.voided_at is null
  ) as outstanding
from public.transactions t
where t.voided_at is null;

-- ---------------------------------------------------------------------------
-- RLS：只有管理員能存取；公開分享頁之後改走 security definer RPC
-- ---------------------------------------------------------------------------
alter table public.admins       enable row level security;
alter table public.settings     enable row level security;
alter table public.categories   enable row level security;
alter table public.members      enable row level security;
alter table public.sessions     enable row level security;
alter table public.transactions enable row level security;
alter table public.collections  enable row level security;
alter table public.receivables  enable row level security;

create policy "admins read self" on public.admins
  for select to authenticated using (user_id = (select auth.uid()));

create policy "admin all" on public.settings
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.categories
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.members
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.sessions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.transactions
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.collections
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin all" on public.receivables
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 初始資料
-- ---------------------------------------------------------------------------
insert into public.settings default values;

insert into public.categories (type, name, system_key, sort_order) values
  ('income',  '場地分攤', 'court_share', 10),
  ('income',  '球費',     'ball_fee',    20),
  ('income',  'VIP 球款', 'vip_ball',    30),
  ('income',  '贊助',     null,          40),
  ('income',  '其他收入', null,          90),
  ('expense', '場地費',   'court_fee',   10),
  ('expense', '羽球',     'shuttlecock', 20),
  ('expense', '飲水',     null,          30),
  ('expense', '器材',     null,          40),
  ('expense', '聚餐',     null,          50),
  ('expense', '其他支出', null,          90);
