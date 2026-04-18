-- Tabela de ganhadores de recompensas (rastreia quem atingiu cada meta e quem ja foi notificado)
-- Rodar UMA VEZ no SQL Editor do Supabase

create table if not exists public.reward_winners (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards(id) on delete cascade,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  achieved_at timestamptz not null default now(),
  notified_at timestamptz,
  notified_by uuid,
  created_at timestamptz not null default now(),
  unique (reward_id, affiliate_id)
);

create index if not exists idx_reward_winners_reward on public.reward_winners(reward_id);
create index if not exists idx_reward_winners_affiliate on public.reward_winners(affiliate_id);
create index if not exists idx_reward_winners_pending on public.reward_winners(notified_at) where notified_at is null;
