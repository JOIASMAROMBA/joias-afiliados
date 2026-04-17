-- Tabela de inscricoes de push notification por afiliada
-- Rode UMA VEZ no SQL Editor do Supabase

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);

create index if not exists idx_push_subs_affiliate on public.push_subscriptions(affiliate_id);
