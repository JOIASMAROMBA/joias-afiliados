-- CORRECAO da view affiliate_balance: combina as duas regras que existiam separadas
-- 1) Vendas com source = 'fixed_payment' (fixo mensal) vao direto pro saldo disponivel (sem hold de 8 dias)
-- 2) Vendas com reversed_at preenchido (canceladas/devolvidas em <=8 dias) saem do saldo
--
-- Rodar UMA VEZ no SQL Editor do Supabase. Substitui a view criada por supabase_sales_reversal.sql.

create or replace view public.affiliate_balance as
with
  released_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where reversed_at is null
      and (created_at <= now() - interval '8 days' or source = 'fixed_payment')
    group by affiliate_id
  ),
  blocked_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where reversed_at is null
      and created_at > now() - interval '8 days'
      and source <> 'fixed_payment'
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
