-- Sistema de aprovacao de afiliadas
-- Rodar UMA VEZ no SQL Editor do Supabase

-- 1) Colunas de aprovacao
alter table public.affiliates
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists approval_seen_at timestamptz;

-- 2) Marca TODAS as afiliadas existentes como aprovadas (ja estao usando o sistema)
update public.affiliates
set approval_status = 'approved',
    approved_at = coalesce(approved_at, created_at, now()),
    approval_seen_at = coalesce(approval_seen_at, now())
where approval_status = 'pending';

-- 3) Indice para listar as pending rapido
create index if not exists idx_affiliates_approval on public.affiliates(approval_status);
