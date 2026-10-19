-- 教練課場次
--
-- 場次多一個種類 kind：'play'（打球）或 'coaching'（教練課）
--   打球：每人 = ⌈場地費 ÷ 人數⌉，非 VIP 加收球費；記「場地費」支出、「場地分攤」＋「球費」收入
--   教練課：每人 = ⌈教練費 ÷ 人數⌉，VIP 和一般一樣，不收球費；記「教練費」支出、「教練課分攤」收入
-- 金額沿用 sessions.court_fee 欄位（教練課時存的是教練費）。種類建立後不能改。
--
-- 相容舊版前端：save_session 的 p_kind 放在最後且預設 null（新增時視為打球、編輯時沿用原本的種類）

alter table public.sessions
  add column kind text not null default 'play' check (kind in ('play', 'coaching'));

insert into public.categories (type, name, system_key, sort_order) values
  ('income',  '教練課分攤', 'coach_share', 35),
  ('expense', '教練費',     'coach_fee',   15);

-- ============================================================
-- save_session：多一個 p_kind，參數不同要先刪掉舊的
-- ============================================================

drop function public.save_session(text, uuid, date, text, integer, text, uuid[], text[]);

-- 新增（p_id 為 null）或編輯場次
-- p_member_ids：從名冊選的出席者；p_new_names：第一次來、要新增到名冊的名字
-- p_court_fee：打球是場地費，教練課是教練費
create function public.save_session(
  p_password   text,
  p_id         uuid,
  p_played_on  date,
  p_venue      text,
  p_court_fee  integer,
  p_note       text,
  p_member_ids uuid[],
  p_new_names  text[],
  p_kind       text default null
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
  v_kind      text := p_kind;
  v_fee_label text;
  v_ids       uuid[];
  v_share     integer;
  v_surcharge integer;
  v_session   public.sessions;
  v_id        uuid;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if p_id is not null then
    select * into v_session from public.sessions where id = p_id and voided_at is null for update;
    if not found then
      raise exception 'not_found';
    end if;
    if v_kind is not null and v_kind <> v_session.kind then
      raise exception 'invalid_input: 場次種類建立後不能改';
    end if;
    v_kind := v_session.kind;
  end if;
  v_kind := coalesce(v_kind, 'play');
  if v_kind not in ('play', 'coaching') then
    raise exception 'invalid_input: 場次種類不正確';
  end if;
  v_fee_label := case v_kind when 'coaching' then '教練費' else '場地費' end;

  if p_played_on is null then
    raise exception 'invalid_input: 缺少日期';
  end if;
  if p_court_fee is null or p_court_fee <= 0 then
    raise exception 'invalid_input: %要大於 0', v_fee_label;
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
  if v_kind = 'coaching' then
    v_surcharge := 0;
  else
    select surcharge into v_surcharge from public.settings where id;
  end if;

  if p_id is null then
    insert into public.sessions (kind, played_on, venue, court_fee, note)
    values (v_kind, p_played_on, v_venue, p_court_fee, v_note)
    returning id into v_id;

    insert into public.transactions (type, category_id, amount, occurred_on, note, session_id)
    values (
      'expense',
      (select id from public.categories
       where system_key = case v_kind when 'coaching' then 'coach_fee' else 'court_fee' end),
      p_court_fee, p_played_on, v_venue, v_id
    );
  else
    v_id := v_session.id;

    if exists (select 1 from public.receivables where session_id = v_id and paid_at is not null) then
      if p_court_fee <> v_session.court_fee
         or array(select unnest(v_ids) order by 1)
            <> array(select member_id from public.receivables where session_id = v_id order by 1) then
        raise exception 'invalid_input: 已經有人付款，%和出席名單不能改；要改請先取消勾選付款', v_fee_label;
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

revoke all on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text) from public;
grant execute on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text) to anon, authenticated;

-- ============================================================
-- set_receivable_paid：教練課的收入記到「教練課分攤」
-- ============================================================

create or replace function public.set_receivable_paid(p_password text, p_id uuid, p_paid boolean)
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
      from (values
        (case v_session.kind when 'coaching' then 'coach_share' else 'court_share' end, v_r.share_amount),
        ('ball_fee', v_r.surcharge_amount)
      ) as x (key, amount)
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
