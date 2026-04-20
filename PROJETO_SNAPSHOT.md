# PROJETO SNAPSHOT — Joias Maromba Afiliados

Documento completo do projeto em **2026-04-20**. Complementa [CLAUDE.md](CLAUDE.md) com detalhes de features implementadas, estrutura, quirks e contexto histórico.

---

## 1. Identidade

| | |
|---|---|
| **Nome** | Joias Maromba Afiliados |
| **Domínio produção** | https://afiliadojoias.com.br |
| **Domínio Vercel fallback** | https://joias-afiliados-12hf.vercel.app |
| **Loja principal** | https://joiasmaromba.com.br (Loja Integrada) |
| **Git** | https://github.com/JOIASMAROMBA/joias-afiliados |
| **Branch principal** | `main` — auto-deploy na Vercel a cada push |
| **Admin default** | cupom: `ADMIN` / senha: `69088510` / email: `renanforumn@gmail.com` |

---

## 2. Modelo de negócio

- Afiliadas vendem joias usando um **cupom exclusivo** (ex: `MARIA10`) aplicado na Loja Integrada.
- Cada venda paga com o cupom gera uma **comissão fixa** (default R$25, personalizável por afiliada via `affiliates.commission_value`).
- Vendas caem na tabela `sales` via dois caminhos: **webhook push** (tempo real) e **pull sync** (backup).
- Afiliadas podem **sacar** o saldo disponível (após hold de 8 dias) via PIX.
- **Patrocinadas** (`is_sponsored = true`) recebem **fixo mensal** além das comissões + tem regras de postagem (obrigações).
- Metas/recompensas: afiliadas ganham prêmios em dinheiro ou não-monetários ao atingir N vendas no ciclo de 30 dias.

---

## 3. Stack técnica

```
Next.js 14 App Router (plain JavaScript, sem TypeScript)
React 18.3
Supabase (DB Postgres + Storage + Realtime + RLS)
bcryptjs (senhas)
jsonwebtoken (cookie de sessão)
Resend (emails transacionais)
web-push (push notifications nativas via PWA + service worker)
Vercel (host + deploy contínuo)
Registro.br (DNS do afiliadojoias.com.br)
```

Estilo: **inline `style={{...}}` puro** + keyframes em `app/globals.css` + `<style>` inline. Sem Tailwind, sem biblioteca de UI. Paleta rígida: dourado `#FFD700` / `#C9A961` / `#E8CF8B` sobre preto `#000`. Textos em **pt-BR**, códigos de erro em snake_case inglês.

---

## 4. Estrutura de arquivos

### Páginas (`app/`)
```
app/
  layout.js                    Root layout + manifest + service worker register
  page.js                      Home pública
  login/page.js                Login
  cadastro/page.js             Signup com gênero, whatsapp, idade, redes sociais
  esqueci-senha/page.js        Reset via email
  como-funciona/page.js        Página institucional
  painel/page.js               Dashboard da afiliada (~69KB, monolítico)
  admin/page.js                Dashboard do admin (~89KB, monolítico)
```

### API Routes (`app/api/`)

**Auth**
```
auth/login             POST   login com cupom+senha, rate limit, bcrypt + legacy plaintext migration
auth/logout            POST   limpa cookie
auth/session           GET    retorna user do cookie JWT
auth/signup            POST   cadastro de afiliada (status=pending)
auth/forgot-password   POST   envia email com token (Resend)
auth/check-coupon      GET    valida unicidade do cupom
auth/accept-terms      POST   registra aceite dos Termos de Uso
auth/admin-verify      POST   2FA por email pra admin logar
```

**Profile (afiliada)**
```
profile/update                 POST   edita nome/email/whatsapp/social/PIX (cupom bloqueado)
profile/avatar                 POST   upload de avatar (Storage)
profile/mark-approval-seen     POST   marca que viu a tela de aprovada
```

**Saques**
```
withdrawals/request-code       POST   envia 2FA code por email (valido 10min)
withdrawals/create             POST   cria saque validando o code
admin/withdrawals/update       POST   aprova/recusa/paga
admin/withdrawals/upload-receipt POST upload de comprovante
```

**Vendas**
```
webhook/loja-integrada         POST   webhook (dedup por external_order_id)
sync-loja-integrada            GET    pull de vendas (cron/manual)
admin/sales/manual-insert      POST   insere vendas manualmente pelo admin (product_value=null)
```

**Materiais**
```
materials/folders              GET    lista pastas (com file_count, fetch-all + JS-filter)
materials/files                GET    lista arquivos de uma pasta (bypass PostgREST bug)
admin/materials/folder         POST   cria/edita/deleta pasta
admin/materials/upload         POST   upload de foto/video (max 50MB)
admin/materials/file           POST   action: delete | update (link/note) | cleanup_orphans
```

**Recompensas**
```
admin/rewards/save             POST   cria/edita recompensa (com audience: affiliate|sponsored|both)
admin/rewards/toggle           POST   ativa/desativa
admin/rewards/delete           POST   deleta
admin/rewards/winners          POST   notifica vencedor por email
```

**Notificações push**
```
push/subscribe                 POST   salva subscription no DB
push/unsubscribe               POST   remove subscription
```

**Notificações in-app**
```
notifications/list             GET    lista notificações do user
notifications/dismiss          POST   marca como lida
```

**Admin geral**
```
admin/affiliate/update         POST   edita dados de uma afiliada
admin/affiliates/approve       POST   aprova/rejeita signup pendente
admin/affiliates/delete        POST   soft delete (60 dias)
admin/affiliates/restore       POST   restaura afiliada deletada
admin/affiliates/history       GET    histórico completo
admin/ban                      POST   banir/desbanir
admin/fixed                    POST   CRUD de monthly_fixed_payments
admin/obligations/update       POST   edita obrigações de postagem
admin/notify                   POST   dispara push pra uma afiliada
admin/loja-integrada-test      GET    diagnóstico das chaves Loja Integrada
```

**Posts**
```
posts/create                   POST   registra prova de postagem
```

### Libs (`lib/`)
```
supabase.js            cliente anon (browser, real-time)
supabase-admin.js      cliente service role (server, RLS bypass)
auth.js                verifyPassword (bcrypt + migração legacy), requireSession, requireAdmin
email.js               templates Resend (reset, saque, aprovação, código admin, ganhador)
push.js                envio de web-push (VAPID)
rate-limit.js          login throttle por IP/cupom
milestones.js          ladder hardcoded de bônus: 10→R$50 ... 200→VIAGEM
```

### Componentes (`components/`)
```
BonusPopup.js      modal de celebração ao atingir milestone
SaleToast.js       toast "VENDA NOVA +R$25" no painel
```

### SQL migrations (rodadas manualmente no Supabase)
```
supabase_push_setup.sql             push_subscriptions
supabase_blocked_balance.sql        view affiliate_balance (hold 8 dias)
supabase_soft_delete.sql            deleted_at columns
supabase_withdrawal_codes.sql       2FA code de saque
supabase_approval_system.sql        approval_status, approval_seen_at
supabase_signup_fields.sql          whatsapp, age, facebook, tiktok, social_outro, platforms
supabase_fixed_monthly.sql          monthly_fixed_payments + source
supabase_admin_2fa.sql              admin_login_codes + senha ADMIN
supabase_reward_winners.sql         reward_winners
supabase_gender.sql                 gender column
supabase_material_files_rpc.sql     RPC admin_delete_material_file + _v2
```

---

## 5. Banco de dados

### Tabelas
- `affiliates` — usuárias (cupom, senha bcrypt, commission_value, is_sponsored, is_admin, blocked, approval_status, gender, whatsapp, age, facebook, tiktok, social_outro, platforms, deleted_at, avatar_url, accepted_terms_at, approval_seen_at, etc)
- `sales` — vendas (external_order_id UNIQUE, affiliate_id, coupon_code, product_value, buyer_name, created_at)
- `withdrawals` — saques (amount, pix_key, pix_type, status, receipt_url, etc)
- `posts` — provas de postagem
- `posting_obligations` — regras de postagem dos patrocinados
- `rewards` — metas configuráveis pelo admin (target_type, target_value, reward_title, reward_value_money, audience: affiliate|sponsored|both)
- `reward_winners` — quem atingiu meta, notified_at, achieved_at
- `material_folders` — pastas de materiais
- `material_files` — fotos/vídeos (url, file_type, folder_id, link, note)
- `monthly_fixed_payments` — fixo mensal dos patrocinados (amount, payment_day, active, source)
- `login_attempts` — logs pro rate limit
- `push_subscriptions` — endpoints web-push por afiliada
- `admin_login_codes` — códigos 2FA admin (email)
- `withdrawal_codes` — códigos 2FA saque
- `notifications` — notificações in-app

### Views
- `affiliate_balance` — saldo (disponível liberado > 8 dias + bloqueado a liberar)
- `affiliate_metrics` — agregados
- `recent_posts` — feed
- `monthly_sales` — agregado por mês
- `monthly_top_affiliate` — vencedor por mês

### RPCs (PL/pgSQL)
- `admin_delete_material_file(p_id uuid)` — deleta uma linha com `security definer`
- `admin_delete_material_file_v2(p_id text)` — versão que retorna `{deleted, existed}` para diagnosticar

---

## 6. Autenticação — dupla

1. **Cookie JWT `joias_session`** (httpOnly, 30d, assinado com `AUTH_JWT_SECRET`) — usado pelas API routes via `requireSession`/`requireAdmin`.
2. **localStorage** (`affiliate_id`, `affiliate_name`, `affiliate_coupon`) — usado pelas páginas client para roteamento antes de API calls.

Se localStorage existe mas cookie expirou, API retorna 401 → client limpa localStorage e redireciona pra `/login`.

Senhas em bcrypt. `lib/auth.js:19` `verifyPassword` tem **caminho legado de plaintext**: se `password_hash` não começa com `$2a/$2b/$2y$`, compara como plaintext e marca `needsRehash`. Login então grava bcrypt.

Rate limit: 10 falhas/5min por IP, 5 falhas/15min por cupom.

Lookups de cupom sempre com `.ilike('coupon_code', coupon)` (case-insensitive).

**Admin 2FA**: ao logar como ADMIN, código de 6 dígitos é enviado pro `renanforumn@gmail.com` (10min).

---

## 7. Vendas — duas ingestões

Ambas autenticam via `?secret=WEBHOOK_SECRET` (comparação timing-safe `safeEqual`) e deduplicam por `external_order_id`.

### `/api/webhook/loja-integrada` (push)
Recebe webhook da Loja Integrada. Só processa status: `pago/paid/aprovado/approved/faturado/concluido`. Extrai cupom de múltiplos shapes possíveis (`cupom`, `cupom_desconto`, `cupons[]`, `descontos[]`).

### `/api/sync-loja-integrada` (pull)
Busca pedidos via API Loja Integrada. Tenta **5 modos de auth em sequência** (query params, header variants, bearer) porque docs são inconsistentes. Chaves em `LOJA_INTEGRADA_API_KEY` + `LOJA_INTEGRADA_APP_KEY`.

**Vendas manuais** (`/api/admin/sales/manual-insert`): `product_value = null`, `external_order_id = 'manual-' + timestamp`, `buyer_name = 'Inserção manual'`. O saldo ainda é creditado pela comissão.

---

## 8. Saldo bloqueado + saques

View `affiliate_balance` calcula:
- `available_balance` = comissões de vendas > 8 dias atrás
- `blocked_balance` = comissões de vendas ≤ 8 dias atrás
- `total_withdrawn` = soma de saques pagos

**Saque com 2FA**: afiliada clica em Sacar → API gera código 6 dígitos, envia por email, salva em `withdrawal_codes` (10min de validade) → afiliada digita → API valida e cria `withdrawals` com status `pending`.

Admin aprova: upload de comprovante (JPG/PDF) → status `paid`.

---

## 9. Painel da afiliada — features

- **Saldos** (disponível + a liberar), com modal "Datas de liberação" mostrando cada venda e quando libera
- **Toast "VENDA NOVA +R$25"** em tempo real via Supabase channel
- **Push notification** (PWA): botão "ATIVAR NOTIFICAÇÕES" cadastra subscription
- **Histórico de saques** com comprovante baixável
- **Perfil editável** (cupom bloqueado)
- **Prêmios/Metas**: ciclo de 30 dias a partir do cadastro, foguete 🚀 sobe conforme atinge milestones. Mostra só recompensas filtradas pela audiência (affiliate|sponsored|both)
- **Top 1/Top 10 do mês**: popup celebrativo quando atinge
- **Materiais**: pastas → grid de arquivos → clique abre viewer elegante com preview + link (botão Copiar) + observação em callout dourado + baixar
- **Obrigações de postagem** (só patrocinadas): calendário com dias vermelhos pros dias que falhou
- **Fixo mensal** (só patrocinadas): card com glitter dourado "LIBERADO TODO DIA X"
- **Termos de Uso** + **Termos de Conduta** (modais no rodapé)
- **Contato** (modal)
- **Textos adaptados ao gênero**: "aprovada"/"aprovado", "banida"/"banido" etc via helper `g(male, female)`
- **Tela de aprovação pendente**: bloqueia tudo com overlay até admin aprovar
- **Modal parabéns**: ao aprovar, confete + mensagem; uma vez só (approval_seen_at)

---

## 10. Admin dashboard — features

Abas em ordem:
1. **Visão Geral** — KPIs, Ranking de cupons no mês (barras horizontais com filtro mês/ano), Evolução de vendas (torres mensais), Top 10 afiliados (filtro mês/ano), Pagamentos pendentes, filtros HOJE/7/15/30/mês/ano, filtro Todos/Afiliados/Patrocinados
2. **Postagens** — feed tempo real + ranking "quem mais posta"
3. **Afiliados** — listagem, aprovação pendente, editar, soft delete 60d, restaurar
4. **Vendas** — lista + extrato calendário + filtros de data
5. **Recompensas** — 2 sub-abas (Metas e Prêmios / Ganhadores). Metas separadas em Afiliados/Patrocinados. Ganhadores com botão Notificar + contato WhatsApp/email
6. **Obrigações** — patrocinados em alerta de postagem
7. **Material** — pastas + upload + botão lápis (✎) pra editar link/observação por arquivo + 🧹 Limpar órfãos
8. **Pagamentos** — saldo a pagar (só afiliadas com 30+ dias e saldo > 0)
9. **Saques** — processar, upload comprovante, extrato calendário, filtros data
10. **Cadastros** — ver cadastros pendentes
11. **Vendas Manual** — buscar afiliada por cupom/nome, +/- contador, ADD com confirmação. Bloco "Última inserção manual" + "Você parou aqui" (persiste em localStorage)
12. **Fixo Mensal** — CRUD do fixo mensal dos patrocinados
13. **Notificar** — disparar push push customizada pra uma afiliada

Modal de edição de arquivo: preto+dourado, campos Link + Observação (1000 chars), salva via PATCH REST (contorna bug PostgREST).

---

## 11. Emails (Resend)

Domínio verificado: `afiliadojoias.com.br` (DKIM/SPF/DMARC no Registro.br).
Remetente: `Joias Maromba <noreply@afiliadojoias.com.br>` (via `EMAIL_FROM`).

Templates (em `lib/email.js`, todos com `emailShell` preto+dourado "PROGRAMA DE AFILIADOS"):
- `buildResetPasswordEmail` — reset de senha
- `buildWithdrawalCodeEmail` — 2FA do saque
- `buildWithdrawalCreatedEmail` — confirmação
- `buildApprovalEmail` / `buildRejectionEmail` — aprovação/rejeição (adaptam gênero)
- `buildAdminCodeEmail` — 2FA admin
- `buildRewardWinnerEmail` — ganhador de meta

---

## 12. Push notifications

Stack: **Web Push API + Service Worker + VAPID**.

- `public/sw.js` intercepta push e mostra notification
- `public/manifest.json` declara como PWA standalone
- `lib/push.js` usa web-push com chaves VAPID (env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). As chaves têm `.trim()` porque vieram com `\n` da Vercel
- Tabela `push_subscriptions` guarda endpoint/keys por afiliada
- Webhook de venda dispara `sendPushToAffiliate` com título "VENDA NOVA +R$25,00"

---

## 13. Materiais — o drama do PostgREST

**Bug descoberto**: o client JS do Supabase tem inconsistência com `.eq('id', uuid)`, `.in('id', [...])` e `.match()` — às vezes retorna vazio mesmo tendo linha no DB.

**Soluções aplicadas**:
- GET `/api/materials/files`: fetch all sem filtro + JS filter
- GET `/api/materials/folders`: fetch all `material_files` + JS group
- DELETE `/api/admin/materials/file`: tenta 3 métodos em sequência
  1. RPC `admin_delete_material_file_v2(p_id text)` com `security definer`
  2. Client `.delete().eq()`
  3. REST fetch direto
  4. Se linha não existe (idempotente): retorna ok
- UPDATE: PATCH REST direto, com fallback client
- Action `cleanup_orphans`: HEAD em cada URL, deleta linhas cujo storage sumiu

Badges 🔗 / 💬 no card mostram se arquivo tem link/nota.

---

## 14. Header de segurança (CSP)

`next.config.js` define CSP estrito:
- `connect-src`: só `*.supabase.co` (REST+wss) e `api.awsli.com.br`
- `img-src`: `'self' data: blob: https:`
- `frame-ancestors 'none'`

Se integrar novo API externo no browser, **precisa atualizar CSP** ou request é bloqueado.

---

## 15. Variáveis de ambiente

### Obrigatórias
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTH_JWT_SECRET
WEBHOOK_SECRET
```

### Opcionais
```
LOJA_INTEGRADA_API_KEY        Pull sync de vendas (caiu Nov/2025, aguarda retorno)
LOJA_INTEGRADA_APP_KEY
RESEND_API_KEY                Emails transacionais
EMAIL_FROM                    "Joias Maromba <noreply@afiliadojoias.com.br>"
VAPID_PUBLIC_KEY              Web push
VAPID_PRIVATE_KEY
VAPID_SUBJECT                 "mailto:renanforumn@gmail.com"
```

---

## 16. Deploy

- Push em `main` → Vercel rebuild em ~1min → produção
- Domínio `afiliadojoias.com.br` aponta via CNAME pra Vercel (Registro.br)
- Sem staging/preview forçado. O preview automático da Vercel existe por branch mas não é usado no fluxo
- Sem CI/CD além da própria Vercel. Sem testes automatizados, sem lint script

---

## 17. Convenções

- Português pt-BR em UI
- Códigos de erro em snake_case inglês (`invalid_credentials`, `rate_limited`, `not_found`)
- Cupons sempre maiúsculos em storage e display (`.toUpperCase()`)
- Dinheiro: número de reais, display `R$ X,XX`
- Datas: `toLocaleDateString('pt-BR')`
- Cores: `#FFD700` (dourado principal), `#C9A961` / `#E8CF8B` (dourado escuro/claro), `#000` (fundo), `#1A1A1A` (card escuro), `#10B981` (verde sucesso), `#EF4444` (vermelho alerta)
- Caminho de import: relativo (`../../../../lib/...`), apesar de existir alias `@/*` no `jsconfig.json`
- Componentes admin/painel são **monolíticos propositais** — editar continua inline, não extrair
- Sem TypeScript
- Sem testes
- Commits em pt-BR com co-author `Claude Opus 4.7 (1M context)`

---

## 18. Histórico de features (ordem aproximada)

1. Login/signup básico + admin panel
2. Webhook Loja Integrada + ingestão de vendas
3. Materiais (pastas + upload)
4. Saques + comprovante
5. PWA + push notification "VENDA NOVA"
6. Vendas Manual (admin)
7. Saldo bloqueado com hold 8d
8. Soft delete afiliadas
9. 2FA saque (email)
10. Templates de email redesenhados (black+gold)
11. Bloqueio de edição de cupom no perfil
12. Sistema de aprovação (pending/approved/rejected + confete)
13. Fixo Mensal (patrocinados)
14. Admin 2FA email + senha 8 dígitos
15. Domínio customizado `afiliadojoias.com.br` + DKIM/SPF/DMARC
16. Ganhadores de recompensa + email + contato
17. Ciclo de 30 dias (prêmios)
18. Campo gender no signup + textos adaptados
19. Termos de Uso com stamp "VOCÊ JÁ ASSINOU"
20. Obrigações de postagem com "DIA DE / POSTAR"
21. Materiais: upload/display, ARQUIVOS JÁ ADICIONADOS collapsible
22. Último inserção manual + "Você parou aqui"
23. Bloco Ranking de cupons no mês (barras horizontais)
24. Top 10 afiliados com filtro mês/ano
25. Materiais: link + observação por arquivo + viewer elegante
26. Recompensas separadas por audiência (affiliate/sponsored)

---

## 19. Quirks e armadilhas

- **PostgREST bug**: `.eq('id', ...)`, `.in('id', [...])`, `.match()` às vezes retornam empty. Sempre fetch-all + JS-filter quando aplicável, ou RPC com `security definer`
- **VAPID keys**: vêm com `\n` no final quando pegas da Vercel; `lib/push.js` faz `.trim()`
- **Duplicação auth** (JWT + localStorage) — ao refatorar, mexer nos dois lugares
- **CSP bloqueia APIs novas no browser** — atualizar `connect-src`
- **Sem migrations automáticas** — mudança de schema = rodar SQL manualmente no Supabase SQL Editor
- **Hardcoded milestones vs rewards table** — os dois coexistem; ladder em `lib/milestones.js` dispara BonusPopup, tabela `rewards` define o que aparece na lista
- **Caching**: routes têm `export const dynamic = 'force-dynamic'`; GETs de material usam `?t=Date.now()` + `cache: 'no-store'`
- **Realtime**: painel escuta `sales`, `rewards`, `withdrawals`, `posting_obligations`, `affiliates`. Se adicionar tabela nova que afeta UI, assinar aqui

---

## 20. Próximos pendentes/ideias (nada em andamento)

- Auditoria de spacing/padding no painel (identificado: touch targets < 44px, `.fixed-monthly-sub` 7.6px mobile, modal de saque apertado)
- Possível PWA → Capacitor (app nativo iOS/Android) — ~7-14 dias + approval das stores
- Página de jogos (placeholder) — fácil de adicionar como nova rota
- LOJA_INTEGRADA_APP_KEY com erro "Chave de Aplicação não encontrada" (deferrido)

---

*Documento gerado automaticamente em 2026-04-20. Atualizar quando features grandes forem adicionadas.*
