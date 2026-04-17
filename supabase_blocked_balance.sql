-- Atualiza a view affiliate_balance para separar saldo disponivel (vendas com 8+ dias)
-- do saldo bloqueado (vendas com menos de 8 dias).
-- Rodar no SQL Editor do Supabase uma vez.

create or replace view public.affiliate_balance as
with
  released_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where created_at <= now() - interval '8 days'
    group by affiliate_id
  ),
  blocked_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where created_at > now() - interval '8 days'
    group by affiliate_id
  ),
  paid_wd as (
    select affiliate_id, sum(amount) as total
    from public.withdrawals
    where status = 'paid'
    group by affiliate_id
  ),
  pending_wd as (
    select affiliate_id, sum(amount) as total
    from public.withdrawals
    where status = 'pending'
    group by affiliate_id
  )
select
  a.id,
  greatest(
    coalesce(rs.total, 0) - coalesce(pw.total, 0) - coalesce(pend.total, 0),
    0
  ) as available_balance,
  coalesce(bs.total, 0) as blocked_balance,
  coalesce(pend.total, 0) as pending_withdrawals
from public.affiliates a
left join released_sales rs on rs.affiliate_id = a.id
left join blocked_sales bs on bs.affiliate_id = a.id
left join paid_wd pw on pw.affiliate_id = a.id
left join pending_wd pend on pend.affiliate_id = a.id;
