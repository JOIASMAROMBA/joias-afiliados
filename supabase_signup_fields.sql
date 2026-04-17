-- Campos de perfil do afiliado: colunas individuais em vez de JSON enfiado em "instagram"
-- Rodar UMA VEZ no SQL Editor do Supabase

alter table public.affiliates
  add column if not exists whatsapp text,
  add column if not exists age text,
  add column if not exists facebook text,
  add column if not exists tiktok text,
  add column if not exists social_outro text,
  add column if not exists platforms jsonb;
