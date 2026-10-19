-- M1：分類與帳目的寫入函式
--
-- 和初始 schema 相同的規則：先檢查編輯密碼，密碼問題回傳 {"error": ...}。
-- 資料不合法時 raise exception（前端已先驗證，正常不會發生）：
--   'invalid_input: <訊息>'   資料不正確
--   'not_found'               找不到資料
--   'linked_transaction'      場次或收款單自動產生的帳目，不能在這裡修改

-- ============================================================
-- 分類
-- ============================================================

-- 新增（p_id 為 null）或改名。類型建立後不能改，舊帳目才不會對不上
create function public.save_category(p_password text, p_id uuid, p_type public.txn_type, p_name text)
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
    raise exception 'invalid_input: 分類名稱需為 1 到 20 個字';
  end if;

  begin
    if p_id is null then
      if p_type is null then
        raise exception 'invalid_input: 缺少分類類型';
      end if;
      insert into public.categories (type, name, sort_order)
      values (
        p_type,
        v_name,
        coalesce((select max(sort_order) from public.categories where type = p_type), 0) + 10
      )
      returning id into v_id;
    else
      update public.categories set name = v_name where id = p_id
      returning id into v_id;
      if v_id is null then
        raise exception 'not_found';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'invalid_input: 已經有同名的分類';
  end;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 封存或還原。封存的分類不能再選，但舊帳目照常顯示
-- 系統分類（有 system_key）會被自動記帳用到，不能封存
create function public.set_category_archived(p_password text, p_id uuid, p_archived boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status     text := private.check_password(p_password);
  v_system_key text;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  select system_key into v_system_key from public.categories where id = p_id;
  if not found then
    raise exception 'not_found';
  end if;
  if p_archived and v_system_key is not null then
    raise exception 'invalid_input: 系統分類不能封存';
  end if;

  update public.categories
  set archived_at = case when p_archived then coalesce(archived_at, now()) end
  where id = p_id;

  return jsonb_build_object('ok', true);
end;
$$;

-- 依陣列順序重新排序同一類型的分類
create function public.reorder_categories(p_password text, p_type public.txn_type, p_ids uuid[])
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

  update public.categories c
  set sort_order = t.ord * 10
  from unnest(p_ids) with ordinality as t (id, ord)
  where c.id = t.id and c.type = p_type;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 帳目
-- ============================================================

-- 找不到可以修改的手動帳目時，分辨是「不存在／已作廢」還是「自動產生的」
create function private.raise_not_editable(p_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.transactions
    where id = p_id and (session_id is not null or receivable_id is not null)
  ) then
    raise exception 'linked_transaction';
  end if;
  raise exception 'not_found';
end;
$$;

revoke all on function private.raise_not_editable(uuid) from public, anon, authenticated;

-- 新增（p_id 為 null）或編輯一筆手動記的帳目
create function public.save_transaction(
  p_password    text,
  p_id          uuid,
  p_type        public.txn_type,
  p_category_id uuid,
  p_amount      integer,
  p_occurred_on date,
  p_note        text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status   text := private.check_password(p_password);
  v_note     text := nullif(btrim(p_note), '');
  v_category public.categories;
  v_old_cat  uuid;
  v_id       uuid;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if p_type is null then
    raise exception 'invalid_input: 缺少收支類型';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_input: 金額要大於 0';
  end if;
  if p_occurred_on is null then
    raise exception 'invalid_input: 缺少日期';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'invalid_input: 備註最多 200 個字';
  end if;

  select * into v_category from public.categories where id = p_category_id;
  if not found or v_category.type <> p_type then
    raise exception 'invalid_input: 分類不正確';
  end if;

  if p_id is not null then
    select category_id into v_old_cat from public.transactions where id = p_id;
  end if;
  -- 封存的分類不能選；編輯時維持原本的分類則可以
  if v_category.archived_at is not null and v_category.id is distinct from v_old_cat then
    raise exception 'invalid_input: 這個分類已封存';
  end if;

  if p_id is null then
    insert into public.transactions (type, category_id, amount, occurred_on, note)
    values (p_type, p_category_id, p_amount, p_occurred_on, v_note)
    returning id into v_id;
  else
    update public.transactions
    set type = p_type,
        category_id = p_category_id,
        amount = p_amount,
        occurred_on = p_occurred_on,
        note = v_note
    where id = p_id
      and voided_at is null
      and session_id is null
      and receivable_id is null
    returning id into v_id;

    if v_id is null then
      perform private.raise_not_editable(p_id);
    end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 作廢：不實體刪除，保留稽核軌跡
create function public.void_transaction(p_password text, p_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := private.check_password(p_password);
  v_reason text := nullif(btrim(p_reason), '');
  v_id     uuid;
begin
  if v_status <> 'ok' then
    return jsonb_build_object('error', v_status);
  end if;

  if v_reason is not null and length(v_reason) > 200 then
    raise exception 'invalid_input: 作廢原因最多 200 個字';
  end if;

  update public.transactions
  set voided_at = now(),
      void_reason = v_reason
  where id = p_id
    and voided_at is null
    and session_id is null
    and receivable_id is null
  returning id into v_id;

  if v_id is null then
    perform private.raise_not_editable(p_id);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- 權限：函式預設對 public 開放執行；明確限定給 anon / authenticated
-- ============================================================

revoke all on function public.save_category(text, uuid, public.txn_type, text) from public;
revoke all on function public.set_category_archived(text, uuid, boolean) from public;
revoke all on function public.reorder_categories(text, public.txn_type, uuid[]) from public;
revoke all on function public.save_transaction(text, uuid, public.txn_type, uuid, integer, date, text) from public;
revoke all on function public.void_transaction(text, uuid, text) from public;

grant execute on function public.save_category(text, uuid, public.txn_type, text) to anon, authenticated;
grant execute on function public.set_category_archived(text, uuid, boolean) to anon, authenticated;
grant execute on function public.reorder_categories(text, public.txn_type, uuid[]) to anon, authenticated;
grant execute on function public.save_transaction(text, uuid, public.txn_type, uuid, integer, date, text) to anon, authenticated;
grant execute on function public.void_transaction(text, uuid, text) to anon, authenticated;
