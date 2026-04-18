-- Fixo mensal de afiliados (patrocinados)
-- Rodar UMA VEZ no SQL Editor do Supabase

-- 1) Coluna source em sales (para marcar pagamentos de fixo mensal como disponivel imediatamente)
alter table public.sales
  add column if not exists source text not null default 'sale';

-- 2) Tabela de regras de fixo mensal
create table if not exists public.monthly_fixed_payments (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount numeric not null check (amount > 0),
  payday int not null check (payday >= 1 and payday <= 31),
  recurring boolean not null default true,
  active boolean not null default true,
  notes text,
  last_paid_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_fixed_payments_affiliate on public.monthly_fixed_payments(affiliate_id);
create index if not exists idx_fixed_payments_active on public.monthly_fixed_payments(active) where active = true;

-- 3) Atualiza view affiliate_balance: pagamentos com source='fixed_payment' entram no saldo disponivel na hora
drop view if exists public.affiliate_balance cascade;

create view public.affiliate_balance as
with
  released_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where created_at <= now() - interval '8 days' or source = 'fixed_payment'
    group by affiliate_id
  ),
  blocked_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where created_at > now() - interval '8 days' and source <> 'fixed_payment'
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
