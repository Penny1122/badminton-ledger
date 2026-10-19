-- 活動的場地面數
--
-- sessions.courts：幾面場（1–20），沒填是 null。只是資訊，不影響分攤金額。
--
-- 相容舊版前端：save_session 新增的 p_courts 放在最後，預設 null
--   null → 新增時不設定、編輯時沿用原本的值
--   0    → 清除

alter table public.sessions
  add column courts smallint check (courts between 1 and 20);

drop function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text, text, text);

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
  p_end_time   text default null,
  p_courts     integer default null
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
  v_courts    integer;
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

  -- 面數：null 沿用原本的值（新增時就是沒有），0 清除
  v_courts := case when p_courts is null then v_session.courts else nullif(p_courts, 0) end;
  if v_courts is not null and v_courts not between 1 and 20 then
    raise exception 'invalid_input: 場地面數要在 1 到 20 之間';
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
    insert into public.sessions (kind, played_on, start_time, end_time, venue, courts, court_fee, note)
    values (v_kind, p_played_on, v_start, v_end, v_venue, v_courts, p_court_fee, v_note)
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
        venue = v_venue, courts = v_courts, court_fee = p_court_fee, note = v_note
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

revoke all on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text, text, text, integer) from public;
grant execute on function public.save_session(text, uuid, date, text, integer, text, uuid[], text[], text, text, text, integer) to anon, authenticated;
