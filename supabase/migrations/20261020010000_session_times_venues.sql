-- 活動的開始／結束時間、常用場地（名稱＋Google 地圖連結）
--
-- 場次仍然只存場地名稱（sessions.venue 文字），不用外鍵：
-- 常用場地改名或刪除不影響舊活動；分享時再用名稱對到地圖連結。
--
-- 相容舊版前端：save_session 新增的 p_start_time、p_end_time 放在最後，預設 null
--   null       → 新增時不設定、編輯時沿用原本的時間
--   ''         → 清除
--   'HH:MM'    → 設定

alter table public.sessions
  add column start_time time,
  add column end_time   time,
  add constraint sessions_time_order check (start_time is null or end_time is null or end_time > start_time);

-- ============================================================
-- 常用場地
-- ============================================================

create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(btrim(name)) between 1 and 30),
  map_url    text check (map_url is null or (map_url ~ '^https?://' and length(map_url) <= 500)),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.venues enable row level security;

create policy "anyone can read" on public.venues for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.venues from anon, authenticated;

-- 新增（p_id 為 null）或修改
create function public.save_venue(p_password text, p_id uuid, p_name text, p_map_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
  v_name   text := btrim(p_name);
  v_url    text := nullif(btrim(p_map_url), '');
  v_id     uuid;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if v_name is null or length(v_name) not between 1 and 30 then
    raise exception 'invalid_input: 場地名稱需為 1 到 30 個字';
  end if;
  if v_url is not null and (v_url !~ '^https?://' or length(v_url) > 500) then
    raise exception 'invalid_input: 地圖連結要是 https:// 開頭的網址';
  end if;

  begin
    if p_id is null then
      insert into public.venues (name, map_url, sort_order)
      values (v_name, v_url, coalesce((select max(sort_order) from public.venues), 0) + 10)
      returning id into v_id;
    else
      update public.venues set name = v_name, map_url = v_url where id = p_id
      returning id into v_id;
      if v_id is null then
        raise exception 'not_found';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'invalid_input: 已經有同名的場地';
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

create function public.delete_venue(p_password text, p_id uuid)
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

  delete from public.venues where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- save_session：多兩個時間參數，參數不同要先刪掉舊的
-- ============================================================

drop function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text);

create function public.save_session(
  p_password   text,
  p_id         uuid,
  p_played_on  date,
  p_venue      text,
  p_court_fee  integer,
  p_note       text,
  p_member_ids uuid[],
  p_new_names  text[],
  p_kind       text default null,
  p_start_time text default null,
  p_end_time   text default null
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
  v_start     time;
  v_end       time;
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
      raise exception 'invalid_input: 活動種類建立後不能改';
    end if;
    v_kind := v_session.kind;
  end if;
  v_kind := coalesce(v_kind, 'play');
  if v_kind not in ('play', 'coaching') then
    raise exception 'invalid_input: 活動種類不正確';
  end if;
  v_fee_label := case v_kind when 'coaching' then '教練費' else '場地費' end;

  -- 時間：null 沿用原本的值（新增時就是沒有），空字串清除
  begin
    v_start := case when p_start_time is null then v_session.start_time else nullif(btrim(p_start_time), '')::time end;
    v_end   := case when p_end_time   is null then v_session.end_time   else nullif(btrim(p_end_time), '')::time end;
  exception when others then
    raise exception 'invalid_input: 時間格式不正確';
  end;
  if v_start is not null and v_end is not null and v_end <= v_start then
    raise exception 'invalid_input: 結束時間要晚於開始時間';
  end if;

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
    insert into public.sessions (kind, played_on, start_time, end_time, venue, court_fee, note)
    values (v_kind, p_played_on, v_start, v_end, v_venue, p_court_fee, v_note)
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
    set played_on = p_played_on, start_time = v_start, end_time = v_end,
        venue = v_venue, court_fee = p_court_fee, note = v_note
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

-- ============================================================
-- 權限
-- ============================================================

revoke all on function public.save_venue(text, uuid, text, text) from public;
revoke all on function public.delete_venue(text, uuid) from public;
revoke all on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text, text, text) from public;

grant execute on function public.save_venue(text, uuid, text, text) to anon, authenticated;
grant execute on function public.delete_venue(text, uuid) to anon, authenticated;
grant execute on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text, text, text) to anon, authenticated;
