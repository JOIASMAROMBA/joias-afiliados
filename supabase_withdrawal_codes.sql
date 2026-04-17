-- Tabela de codigos de confirmacao de saque (2FA por email)
-- Rodar no SQL Editor do Supabase uma vez.

create table if not exists public.withdrawal_codes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  code text not null,
  pix_type text not null,
  pix_key text not null,
  amount numeric not null,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_withdrawal_codes_affiliate on public.withdrawal_codes(affiliate_id, created_at desc);
create index if not exists idx_withdrawal_codes_active on public.withdrawal_codes(affiliate_id) where used_at is null;
