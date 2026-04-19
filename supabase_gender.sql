-- Sexo do afiliado (male | female) — usado para adaptar textos no painel e emails
-- Rodar UMA VEZ no SQL Editor do Supabase

alter table public.affiliates
  add column if not exists gender text check (gender in ('male', 'female') or gender is null);
