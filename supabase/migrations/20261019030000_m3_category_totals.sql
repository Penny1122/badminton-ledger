-- M3：各分類累計金額（不含作廢），首頁的「球款水位」用
-- 球款水位 = VIP 球款 + 球費 − 羽球支出

create view public.category_totals
with (security_invoker = true)
as
select
  c.id as category_id,
  c.type,
  c.system_key,
  coalesce(sum(t.amount), 0)::bigint as total
from public.categories c
left join public.transactions t on t.category_id = c.id and t.voided_at is null
group by c.id;
