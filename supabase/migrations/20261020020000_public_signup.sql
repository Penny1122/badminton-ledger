-- 公開報名：不用編輯密碼，任何人都可以在活動加入或移除參加人員
--
-- 規則：
--   只能改參加名單，日期、費用等設定還是要密碼
--   已作廢、或已經有人付款的活動不能改（有人付款後名單和金額就固定）
--   活動結束後也可以報名（事後補記臨時來的人）
--   每次名單變動都重新產生應收款，每人金額依新的人數重算（算法同 save_session）
--   新名字會加進名冊（沿用 private.resolve_members）
--   同一個 IP 10 分鐘內最多 30 次，防止惡意亂按
--
-- 回傳格式同其他寫入函式：成功 {"ok": true}；次數太多 {"error": "too_many_requests"}；
-- 資料問題 raise 'invalid_input: ...' / 'not_found'

create table private.public_actions (
  ip          text not null,
  acted_at    timestamptz not null default now()
);

create index public_actions_ip_idx on private.public_actions (ip, acted_at);

-- 呼叫端的 IP（Supabase 經過 Cloudflare，先看 cf-connecting-ip）
create function private.client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    nullif(btrim(split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1)), ''),
    'unknown'
  );
$$;

-- 記一次公開操作；超過次數回傳 false
create function private.allow_public_action()
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_ip    text := private.client_ip();
  v_count integer;
begin
  delete from private.public_actions where acted_at < now() - interval '1 day';

  select count(*) into v_count
  from private.public_actions
  where ip = v_ip and acted_at > now() - interval '10 minutes';

  if v_count >= 30 then
    return false;
  end if;

  insert into private.public_actions (ip) values (v_ip);
  return true;
end;
$$;

-- 用新的參加名單重新產生應收款（呼叫前要先確認沒有人付款）
create function private.rebuild_session_receivables(p_session_id uuid, p_member_ids uuid[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_session   public.sessions;
  v_share     integer;
  v_surcharge integer;
begin
  select * into v_session from public.sessions where id = p_session_id;

  v_share := ceil(v_session.court_fee::numeric / cardinality(p_member_ids))::integer;
  if v_session.kind = 'coaching' then
    v_surcharge := 0;
  else
    select surcharge into v_surcharge from public.settings where id;
  end if;

  delete from public.receivables where session_id = p_session_id;

  insert into public.receivables (session_id, member_id, is_vip, share_amount, surcharge_amount)
  select p_session_id, m.id, m.is_vip, v_share, case when m.is_vip then 0 else v_surcharge end
  from public.members m
  where m.id = any (p_member_ids);
end;
$$;

-- 鎖住活動並確認可以公開修改名單；回傳目前的參加者
create function private.lock_session_for_signup(p_session_id uuid)
returns uuid[]
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.sessions where id = p_session_id and voided_at is null for update;
  if not found then
    raise exception 'not_found';
  end if;
  if exists (select 1 from public.receivables where session_id = p_session_id and paid_at is not null) then
    raise exception 'invalid_input: 已經有人付款，名單已鎖定，請聯絡記帳的人';
  end if;
  return array(select member_id from public.receivables where session_id = p_session_id);
end;
$$;

revoke all on function private.client_ip() from public, anon, authenticated;
revoke all on function private.allow_public_action() from public, anon, authenticated;
revoke all on function private.rebuild_session_receivables(uuid, uuid[]) from public, anon, authenticated;
revoke all on function private.lock_session_for_signup(uuid) from public, anon, authenticated;

-- ============================================================
-- 對外函式（不用密碼）
-- ============================================================

-- 報名：p_member_id（從名冊選）或 p_new_name（第一次來）擇一
create function public.join_session(p_session_id uuid, p_member_id uuid, p_new_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid[];
  v_added   uuid[];
begin
  if not private.allow_public_action() then
    return jsonb_build_object('error', 'too_many_requests');
  end if;

  v_current := private.lock_session_for_signup(p_session_id);

  if p_member_id is not null then
    perform 1 from public.members where id = p_member_id and is_active;
    if not found then
      raise exception 'invalid_input: 名冊裡找不到這個人';
    end if;
    v_added := array[p_member_id];
  else
    if nullif(btrim(p_new_name), '') is null then
      raise exception 'invalid_input: 請輸入名字';
    end if;
    v_added := private.resolve_members(null, array[p_new_name]);
  end if;

  if v_added[1] = any (v_current) then
    return jsonb_build_object('ok', true);
  end if;

  perform private.rebuild_session_receivables(p_session_id, v_current || v_added);
  return jsonb_build_object('ok', true);
end;
$$;

-- 取消報名
create function public.leave_session(p_session_id uuid, p_member_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current uuid[];
begin
  if not private.allow_public_action() then
    return jsonb_build_object('error', 'too_many_requests');
  end if;

  v_current := private.lock_session_for_signup(p_session_id);

  if not p_member_id = any (v_current) then
    return jsonb_build_object('ok', true);
  end if;
  if cardinality(v_current) = 1 then
    raise exception 'invalid_input: 至少要留 1 位參加者';
  end if;

  perform private.rebuild_session_receivables(p_session_id, array_remove(v_current, p_member_id));
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.join_session(uuid, uuid, text) from public;
revoke all on function public.leave_session(uuid, uuid) from public;

grant execute on function public.join_session(uuid, uuid, text) to anon, authenticated;
grant execute on function public.leave_session(uuid, uuid) to anon, authenticated;
