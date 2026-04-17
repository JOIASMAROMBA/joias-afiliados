-- Soft-delete de afiliadas.
-- Rodar no SQL Editor do Supabase uma vez.

-- 1) Coluna deleted_at em affiliates
alter table public.affiliates
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid,
  add column if not exists deletion_reason text;

create index if not exists idx_affiliates_deleted_at on public.affiliates(deleted_at);

-- 2) Atualiza affiliate_balance para ignorar deletadas (saldo nao aparece em listas)
-- mas continua calculando corretamente para quando for restaurada.
drop view if exists public.affiliate_balance cascade;

create view public.affiliate_balance as
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
