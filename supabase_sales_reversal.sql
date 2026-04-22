-- Reversao automatica de vendas: quando pedido muda para CANCELADO / PGTO DEVOLVIDO / PGTO EM DISPUTA
-- dentro da janela de 8 dias apos a venda, marca reversed_at e a comissao sai do saldo da afiliada.
-- Rodar no SQL Editor do Supabase uma vez.

-- 1) Colunas de auditoria em sales
alter table public.sales
  add column if not exists reversed_at timestamp with time zone,
  add column if not exists reversed_reason text;

create index if not exists idx_sales_external_order_id on public.sales (external_order_id);
create index if not exists idx_sales_reversed_at on public.sales (reversed_at);

-- 2) Atualiza view affiliate_balance para excluir vendas reversadas dos dois pots (released + blocked)
create or replace view public.affiliate_balance as
with
  released_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where created_at <= now() - interval '8 days'
      and reversed_at is null
    group by affiliate_id
  ),
  blocked_sales as (
    select affiliate_id, sum(commission_earned) as total
    from public.sales
    where created_at > now() - interval '8 days'
      and reversed_at is null
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
