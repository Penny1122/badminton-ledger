-- M2：成員名冊、場次記帳、收款單、群組設定
--
-- 規則：
--   每人場地費 = ⌈場地費 ÷ 出席人數⌉（VIP 也分攤）；非 VIP 另外加收 settings.surcharge（球費）
--   臨打第一次來時輸入名字，自動存進名冊，所以應收款一律有 member_id（guest_name 保留不用）
--   建立場次時自動記一筆「場地費」支出（打完就付給球館）
--   勾選已付款時自動記收入：場次記「場地分攤」＋「球費」兩筆，收款單記一筆到收款單的分類
--   取消勾選會把那幾筆收入作廢
--   已經有人付款的場次或收款單：只能改日期、場地（標題）、備註；不能作廢
--
-- 錯誤格式同 M1：密碼問題回傳 {"error": ...}；資料問題 raise 'invalid_input: ...' / 'not_found'

-- 重新產生應收款時會刪掉舊的；已作廢的收入仍保留 session_id，不會變成可以手動修改的帳目
alter table public.transactions
  drop constraint transactions_receivable_id_fkey,
  add constraint transactions_receivable_id_fkey
    foreign key (receivable_id) references public.receivables (id) on delete set null;

-- 收款單的收入也記上 collection_id，作廢後仍看得出來源
alter table public.transactions
  add column collection_id uuid references public.collections (id);

create index transactions_collection_id_idx on public.transactions (collection_id);

alter table public.sessions add column void_reason text;

-- ============================================================
-- 名冊排序用：每位成員最近一次出席的日期與次數
-- ============================================================

create view public.member_stats
with (security_invoker = true)
as
select
  m.id as member_id,
  max(s.played_on) as last_played_on,
  count(s.id)::integer as sessions_count
from public.members m
left join public.receivables r on r.member_id = m.id and r.session_id is not null
left join public.sessions s on s.id = r.session_id and s.voided_at is null
group by m.id;

-- ============================================================
-- 群組設定
-- ============================================================

create function public.update_settings(p_password text, p_group_name text, p_surcharge integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
  v_name   text := btrim(p_group_name);
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if v_name is null or length(v_name) not between 1 and 30 then
    raise exception 'invalid_input: 群組名稱需為 1 到 30 個字';
  end if;
  if p_surcharge is null or p_surcharge < 0 then
    raise exception 'invalid_input: 加收金額不可為負';
  end if;

  update public.settings set group_name = v_name, surcharge = p_surcharge where id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 成員
-- ============================================================

create function public.save_member(
  p_password  text,
  p_id        uuid,
  p_name      text,
  p_is_vip    boolean,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
  v_name   text := btrim(p_name);
  v_id     uuid;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if v_name is null or length(v_name) not between 1 and 20 then
    raise exception 'invalid_input: 名字需為 1 到 20 個字';
  end if;

  begin
    if p_id is null then
      insert into public.members (name, is_vip, is_active)
      values (v_name, coalesce(p_is_vip, false), coalesce(p_is_active, true))
      returning id into v_id;
    else
      update public.members
      set name = v_name,
          is_vip = coalesce(p_is_vip, is_vip),
          is_active = coalesce(p_is_active, is_active)
      where id = p_id
      returning id into v_id;
      if v_id is null then
        raise exception 'not_found';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'invalid_input: 已經有同名的成員';
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 已選的成員 id ＋ 新輸入的名字 → 成員 id 陣列（不重複）
-- 新名字若已在名冊（包括停用的）就沿用並重新啟用，否則新增為非 VIP
create function private.resolve_members(p_member_ids uuid[], p_new_names text[])
returns uuid[]
language plpgsql
set search_path = ''
as $$
declare
  v_names text[];
  v_ids   uuid[];
begin
  select coalesce(array_agg(distinct btrim(n)), '{}') into v_names
  from unnest(coalesce(p_new_names, '{}')) as n
  where btrim(n) <> '';

  if exists (select 1 from unnest(v_names) as n where length(n) > 20) then
    raise exception 'invalid_input: 名字最多 20 個字';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_member_ids, '{}')) as x (id)
    where not exists (select 1 from public.members m where m.id = x.id)
  ) then
    raise exception 'invalid_input: 有成員不存在';
  end if;

  insert into public.members (name)
  select n from unnest(v_names) as n
  on conflict (name) do update set is_active = true;

  select coalesce(array_agg(distinct id), '{}') into v_ids
  from (
    select m.id from public.members m where m.id = any (coalesce(p_member_ids, '{}'))
    union
    select m.id from public.members m where m.name = any (v_names)
  ) as t;

  return v_ids;
end;
$$;

revoke all on function private.resolve_members(uuid[], text[]) from public, anon, authenticated;

-- ============================================================
-- 場次
-- ============================================================

-- 新增（p_id 為 null）或編輯場次
-- p_member_ids：從名冊選的出席者；p_new_names：第一次來、要新增到名冊的名字
create function public.save_session(
  p_password   text,
  p_id         uuid,
  p_played_on  date,
  p_venue      text,
  p_court_fee  integer,
  p_note       text,
  p_member_ids uuid[],
  p_new_names  text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status    text := private.check_password(p_password);
  v_venue     text := nullif(btrim(p_venue), '');
  v_note      text := nullif(btrim(p_note), '');
  v_ids       uuid[];
  v_share     integer;
  v_surcharge integer;
  v_session   public.sessions;
  v_id        uuid;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if p_played_on is null then
    raise exception 'invalid_input: 缺少日期';
  end if;
  if p_court_fee is null or p_court_fee <= 0 then
    raise exception 'invalid_input: 場地費要大於 0';
  end if;
  if v_venue is not null and length(v_venue) > 30 then
    raise exception 'invalid_input: 場地最多 30 個字';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'invalid_input: 備註最多 200 個字';
  end if;

  v_ids := private.resolve_members(p_member_ids, p_new_names);
  if cardinality(v_ids) = 0 then
    raise exception 'invalid_input: 至少要有 1 位出席者';
  end if;

  v_share := ceil(p_court_fee::numeric / cardinality(v_ids))::integer;
  select surcharge into v_surcharge from public.settings where id;

  if p_id is null then
    insert into public.sessions (played_on, venue, court_fee, note)
    values (p_played_on, v_venue, p_court_fee, v_note)
    returning id into v_id;

    insert into public.transactions (type, category_id, amount, occurred_on, note, session_id)
    values (
      'expense',
      (select id from public.categories where system_key = 'court_fee'),
      p_court_fee, p_played_on, v_venue, v_id
    );
  else
    select * into v_session from public.sessions where id = p_id and voided_at is null for update;
    if not found then
      raise exception 'not_found';
    end if;
    v_id := v_session.id;

    if exists (select 1 from public.receivables where session_id = v_id and paid_at is not null) then
      if p_court_fee <> v_session.court_fee
         or array(select unnest(v_ids) order by 1)
            <> array(select member_id from public.receivables where session_id = v_id order by 1) then
        raise exception 'invalid_input: 已經有人付款，場地費和出席名單不能改；要改請先取消勾選付款';
      end if;
    end if;

    update public.sessions
    set played_on = p_played_on, venue = v_venue, court_fee = p_court_fee, note = v_note
    where id = v_id;

    update public.transactions
    set amount = p_court_fee, occurred_on = p_played_on, note = v_venue
    where session_id = v_id and receivable_id is null and type = 'expense' and voided_at is null;

    -- 沒有人付款時才會走到這裡改名單或金額，直接重新產生應收款
    if exists (select 1 from public.receivables where session_id = v_id and paid_at is not null) then
      return jsonb_build_object('ok', true, 'id', v_id);
    end if;
    delete from public.receivables where session_id = v_id;
  end if;

  insert into public.receivables (session_id, member_id, is_vip, share_amount, surcharge_amount)
  select v_id, m.id, m.is_vip, v_share, case when m.is_vip then 0 else v_surcharge end
  from public.members m
  where m.id = any (v_ids);

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create function public.void_session(p_password text, p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  perform 1 from public.sessions where id = p_id and voided_at is null for update;
  if not found then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.receivables where session_id = p_id and paid_at is not null) then
    raise exception 'invalid_input: 已經有人付款，請先取消勾選付款再作廢';
  end if;
  if v_reason is not null and length(v_reason) > 200 then
    raise exception 'invalid_input: 作廢原因最多 200 個字';
  end if;

  update public.sessions set voided_at = now(), void_reason = v_reason where id = p_id;

  update public.transactions
  set voided_at = now(), void_reason = coalesce(v_reason, '場次作廢')
  where session_id = p_id and voided_at is null;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 收款單（例如 VIP 球款，每人固定金額）
-- ============================================================

create function public.save_collection(
  p_password     text,
  p_id           uuid,
  p_title        text,
  p_collected_on date,
  p_amount       integer,
  p_note         text,
  p_member_ids   uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status     text := private.check_password(p_password);
  v_title      text := btrim(p_title);
  v_note       text := nullif(btrim(p_note), '');
  v_ids        uuid[];
  v_collection public.collections;
  v_id         uuid;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if v_title is null or length(v_title) not between 1 and 30 then
    raise exception 'invalid_input: 標題需為 1 到 30 個字';
  end if;
  if p_collected_on is null then
    raise exception 'invalid_input: 缺少日期';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_input: 每人金額要大於 0';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'invalid_input: 備註最多 200 個字';
  end if;

  v_ids := private.resolve_members(p_member_ids, null);
  if cardinality(v_ids) = 0 then
    raise exception 'invalid_input: 至少要選 1 個人';
  end if;

  if p_id is null then
    insert into public.collections (title, category_id, collected_on, note)
    values (v_title, (select id from public.categories where system_key = 'vip_ball'), p_collected_on, v_note)
    returning id into v_id;
  else
    select * into v_collection from public.collections where id = p_id and voided_at is null for update;
    if not found then
      raise exception 'not_found';
    end if;
    v_id := v_collection.id;

    update public.collections
    set title = v_title, collected_on = p_collected_on, note = v_note
    where id = v_id;

    if exists (select 1 from public.receivables where collection_id = v_id and paid_at is not null) then
      if exists (select 1 from public.receivables where collection_id = v_id and share_amount <> p_amount)
         or array(select unnest(v_ids) order by 1)
            <> array(select member_id from public.receivables where collection_id = v_id order by 1) then
        raise exception 'invalid_input: 已經有人付款，金額和名單不能改；要改請先取消勾選付款';
      end if;
      return jsonb_build_object('ok', true, 'id', v_id);
    end if;

    delete from public.receivables where collection_id = v_id;
  end if;

  insert into public.receivables (collection_id, member_id, is_vip, share_amount)
  select v_id, m.id, m.is_vip, p_amount
  from public.members m
  where m.id = any (v_ids);

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create function public.void_collection(p_password text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  perform 1 from public.collections where id = p_id and voided_at is null for update;
  if not found then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.receivables where collection_id = p_id and paid_at is not null) then
    raise exception 'invalid_input: 已經有人付款，請先取消勾選付款再作廢';
  end if;

  update public.collections set voided_at = now() where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 勾選／取消勾選付款
-- ============================================================

create function public.set_receivable_paid(p_password text, p_id uuid, p_paid boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status     text := private.check_password(p_password);
  v_r          public.receivables;
  v_name       text;
  v_session    public.sessions;
  v_collection public.collections;
  v_today      date := (now() at time zone 'Asia/Taipei')::date;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  select * into v_r from public.receivables where id = p_id for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_r.session_id is not null then
    select * into v_session from public.sessions where id = v_r.session_id;
    if v_session.voided_at is not null then
      raise exception 'not_found';
    end if;
  else
    select * into v_collection from public.collections where id = v_r.collection_id;
    if v_collection.voided_at is not null then
      raise exception 'not_found';
    end if;
  end if;

  select name into v_name from public.members where id = v_r.member_id;

  if p_paid then
    if v_r.paid_at is not null then
      return jsonb_build_object('ok', true);
    end if;

    update public.receivables set paid_at = now() where id = p_id;

    if v_r.session_id is not null then
      insert into public.transactions (type, category_id, amount, occurred_on, note, session_id, receivable_id)
      select 'income', c.id, x.amount, v_today, v_name, v_r.session_id, p_id
      from (values ('court_share', v_r.share_amount), ('ball_fee', v_r.surcharge_amount)) as x (key, amount)
      join public.categories c on c.system_key = x.key
      where x.amount > 0;
    else
      insert into public.transactions (type, category_id, amount, occurred_on, note, collection_id, receivable_id)
      values (
        'income', v_collection.category_id, v_r.share_amount, v_today,
        v_collection.title || '・' || v_name, v_collection.id, p_id
      );
    end if;
  else
    if v_r.paid_at is null then
      return jsonb_build_object('ok', true);
    end if;

    update public.receivables set paid_at = null where id = p_id;

    update public.transactions
    set voided_at = now(), void_reason = '取消勾選付款'
    where receivable_id = p_id and voided_at is null;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 手動帳目：收款單產生的收入也不能手動修改（M1 只檢查 session_id、receivable_id）
-- ============================================================

create or replace function private.raise_not_editable(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.transactions
    where id = p_id and (session_id is not null or receivable_id is not null or collection_id is not null)
  ) then
    raise exception 'linked_transaction';
  end if;
  raise exception 'not_found';
end;
$$;

-- ============================================================
-- 權限
-- ============================================================

revoke all on function public.update_settings(text, text, integer) from public;
revoke all on function public.save_member(text, uuid, text, boolean, boolean) from public;
revoke all on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[]) from public;
revoke all on function public.void_session(text, uuid, text) from public;
revoke all on function public.save_collection(text, uuid, text, date, integer, text, uuid[]) from public;
revoke all on function public.void_collection(text, uuid) from public;
revoke all on function public.set_receivable_paid(text, uuid, boolean) from public;

grant execute on function public.update_settings(text, text, integer) to anon, authenticated;
grant execute on function public.save_member(text, uuid, text, boolean, boolean) to anon, authenticated;
grant execute on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[]) to anon, authenticated;
grant execute on function public.void_session(text, uuid, text) to anon, authenticated;
grant execute on function public.save_collection(text, uuid, text, date, integer, text, uuid[]) to anon, authenticated;
grant execute on function public.void_collection(text, uuid) to anon, authenticated;
grant execute on function public.set_receivable_paid(text, uuid, boolean) to anon, authenticated;
