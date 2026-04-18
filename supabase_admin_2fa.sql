-- 2FA no login de admin + garantir so 1 conta admin + atualizar senha
-- Rodar UMA VEZ no SQL Editor do Supabase

-- 1) Tabela de codigos de acesso admin
create table if not exists public.admin_login_codes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  attempts int not null default 0,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_codes_affiliate on public.admin_login_codes(affiliate_id, created_at desc);
create index if not exists idx_admin_codes_active on public.admin_login_codes(affiliate_id) where used_at is null;

-- 2) Remove is_admin de qualquer outra conta que tenha
update public.affiliates set is_admin = false where coupon_code <> 'ADMIN' and is_admin = true;

-- 3) Atualiza senha da conta ADMIN para 69088510 (hash bcrypt calculado no servidor)
update public.affiliates
set password_hash = '$2b$10$ll4jZQfQYZcgfecfKQpdxuycWt8cO4Br7QcVW2ui3iDurR3V9X0wa',
    is_admin = true,
    active = true,
    blocked = false,
    deleted_at = null,
    approval_status = 'approved',
    approval_seen_at = coalesce(approval_seen_at, now())
where coupon_code ilike 'ADMIN';
