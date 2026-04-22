# CHECKPOINT — Integração Loja Integrada concluída

**Data:** 2026-04-22
**Sessão:** integração completa da API da Loja Integrada + reversão automática de vendas canceladas/devolvidas + filtro no painel.

Este arquivo é um snapshot de tudo que foi construído/alterado nesta sessão. Lê este arquivo primeiro em futuras conversas para recuperar contexto completo.

---

## 1. Status final

✅ **Integração 100% operacional.** Vendas pagas com cupom de afiliada caem automaticamente no painel em ≤ 5 min. Se o pedido for cancelado/devolvido em ≤ 8 dias, a comissão é reversada automaticamente (retorna saldo da afiliada).

**Testes end-to-end validados:**
- Pedido 7303 (CAMILA15) → inseriu em `sales`, R$25 no blocked_balance ✅
- Pedido 7304 (CAMILA15) → alterado pra PGTO DEVOLVIDO → `reversed_at` marcado, saldo descontado, some da lista ✅
- Backfill automático de 6 vendas históricas com cupom (PIKACHU x4, JIMMY x2) ✅

---

## 2. Chaves da Loja Integrada (em Vercel env vars)

```
LOJA_INTEGRADA_API_KEY = 5c7a0a15f82bb7067f5c          ← Chave de API (20 chars)
LOJA_INTEGRADA_APP_KEY = 42329db9-91c0-42f1-8942-790f5a342f8a   ← Chave de Aplicação (UUID)
WEBHOOK_SECRET         = joiasmaromba_wh_9f3k2x8p      ← já existente
```

**Histórico:** o usuário tinha só a chave de aplicação (UUID). A chave de API (`5c7a0a15...`) só foi obtida no dia 2026-04-22 quando a LI forneceu. Antes disso, o teste `loja-integrada-test` retornava "Chave de Api não encontrada" porque o UUID estava nos dois slots por engano.

Modo de auth vencedor (descoberto via diagnóstico): **`query`** — ambas chaves como query params `?chave_api=...&chave_aplicacao=...`. Os outros 4 modos (bearer, headers) retornam 401.

---

## 3. Arquitetura da integração

### Ingestão: pull sync (não há webhook)

A Loja Integrada **não expõe webhook de pedidos no painel padrão** do lojista — tentamos localizar essa configuração e não existe. A solução adotada é **pull sync com cron da Vercel**.

**Endpoint:** [app/api/sync-loja-integrada/route.js](app/api/sync-loja-integrada/route.js)

**Fluxo:**
1. `GET /api/sync-loja-integrada` autoriza via:
   - Query `?secret=<WEBHOOK_SECRET>` (chamada manual), OU
   - Header `user-agent: vercel-cron/1.0` (chamada automática do cron)
2. Primeira call: `GET /pedido/search/?data_inicio=YYYY-MM-DD&limit=1` → retorna `total_count`
3. Segunda call: `GET /pedido/search/?data_inicio=...&limit=50&offset=<total-50>` → pega os 50 mais recentes (LI retorna ASC, **não aceita order_by em id nem data_pedido**, então usamos offset invertido)
4. Array invertido no JS pra iterar do mais novo pro mais antigo
5. Para cada pedido:
   - Se status cancelado/devolvido/disputa → tenta reversão
   - Se status pago → faz **fetch detalhe** em `/pedido/{id}/` (cupom só vem completo no detalhe, não no search) → extrai cupom → procura afiliada → insere em `sales`

**Cron:** [vercel.json](vercel.json)
```json
{ "crons": [{ "path": "/api/sync-loja-integrada?hours=2", "schedule": "*/5 * * * *" }] }
```

A cada 5 min, janela de 2h (margem de segurança contra falhas).

### Ingestão: webhook push (fallback)

[app/api/webhook/loja-integrada/route.js](app/api/webhook/loja-integrada/route.js) existe há tempo mas **não está em uso** — a LI não chama. O código está mantido caso a LI um dia ofereça webhook. Já tem a mesma lógica de reversão integrada.

---

## 4. Regra de negócio: reversão em 8 dias

**Implementada nesta sessão.** Quando um pedido já creditado muda para:
- CANCELADO
- PGTO DEVOLVIDO (código LI: `pagamento_devolvido`)
- DISPUTA / CHARGEBACK
- ESTORNADO / REEMBOLSADO

E o `sales.created_at` é ≤ 8 dias atrás → o sync marca `reversed_at = now()` e `reversed_reason = <codigo>`.

**Após 8 dias:** saldo já migrou de `blocked_balance` → `available_balance` (view libera em 8d). Nesse caso a reversão **não ocorre** e o sync retorna `skipped: "reversal: past 8-day hold"`.

Status que mantêm o crédito (não mexem): `pedido_enviado`, `pedido_separacao`, `pedido_concluido`, `entregue`.

---

## 5. Mudanças no banco (SQL já rodado)

Arquivo: [supabase_sales_reversal.sql](supabase_sales_reversal.sql) — **rodado no Supabase em 2026-04-22** com sucesso ("Success. No rows returned").

Alterações:
```sql
-- Colunas novas em sales
alter table public.sales
  add column if not exists reversed_at timestamp with time zone,
  add column if not exists reversed_reason text;

create index if not exists idx_sales_external_order_id on public.sales (external_order_id);
create index if not exists idx_sales_reversed_at on public.sales (reversed_at);

-- View affiliate_balance atualizada:
-- released_sales e blocked_sales agora filtram "and reversed_at is null"
-- Assim vendas reversadas saem automaticamente do saldo.
```

**View final** (em [supabase_sales_reversal.sql](supabase_sales_reversal.sql)): ambos os pots (released + blocked) excluem linhas com `reversed_at is not null`.

---

## 6. Endpoints novos/alterados nesta sessão

| Endpoint | Arquivo | O que faz |
|---|---|---|
| `GET /api/sync-loja-integrada` | [app/api/sync-loja-integrada/route.js](app/api/sync-loja-integrada/route.js) | Pull sync + reversão. Aceita auth via `?secret=` ou header `user-agent: vercel-cron`. |
| `POST /api/webhook/loja-integrada` | [app/api/webhook/loja-integrada/route.js](app/api/webhook/loja-integrada/route.js) | Webhook push (inativo). Lógica de reversão adicionada. |
| `GET /api/admin/loja-integrada-test` | [app/api/admin/loja-integrada-test/route.js](app/api/admin/loja-integrada-test/route.js) | Diagnóstico: tenta 4 modos de auth e retorna qual funciona + sample_order + total_orders. |
| `GET /api/admin/loja-integrada-order?id=NNNN` | [app/api/admin/loja-integrada-order/route.js](app/api/admin/loja-integrada-order/route.js) | **Novo nesta sessão.** Dump de um pedido específico em 4 endpoints da LI (usado pra debugar onde o cupom está no payload). |

### Lógica crítica no sync

**`extractCouponCode(order)`** — precisa lidar com 3 formatos:
- `order.cupom_desconto` como **objeto** `{codigo: "CAMILA15", ...}` (endpoint `/pedido/{id}/`)
- Como **string URI** `/api/v1/cupom/NNNN` (ignorar)
- Como **string plain** `"CAMILA15"`

**`fetchOrderDetail(id)`** — chamada extra em `/pedido/{id}/` feita só para pedidos pagos novos (pós-dedup), porque `/pedido/search/` retorna cupom_desconto vazio ou como URI.

**`isPaidStatus(order)` / `isReversedStatus(order)`** — `order.situacao` é objeto `{aprovado, cancelado, codigo, nome}`. Funções aceitam objeto **ou** string (LI pode devolver ambos dependendo do endpoint).

**Paginação invertida:**
```js
const total = head?.data?.meta?.total_count || 0;
const offset = Math.max(0, total - 50);
```
LI rejeita `order_by=-id`, `order_by=-data_pedido`. Com offset invertido + `limit=50` pegamos os 50 últimos, depois reverter no JS.

---

## 7. Arquivos alterados no painel

[app/painel/page.js:202](app/painel/page.js#L202) — query de `sales` filtra `.is('reversed_at', null)`. Efeito:
- Contador "SUAS VENDAS > VENDAS" não conta reversadas
- "Última venda no seu cupom" mostra só a última **validada**
- Toast "VENDA NOVA" continua disparando via realtime channel (linha 178) — ao re-fetchar pós-evento, já aplica o filtro

---

## 8. Commits desta sessão (ordem cronológica)

```
7a8c662  Loja Integrada sync: remove filtro situacao=pago (API rejeita) e filtra status aprovado via JS
29d92b6  Loja Integrada sync: ordena por data_pedido DESC, limit 100, cron Vercel a cada 5min
bcae416  Loja Integrada sync: limit de volta para 50 (API rejeita acima disso)
44e3802  Loja Integrada sync: order_by=-id (campo data_pedido nao existe na API)
25b43d2  Loja Integrada sync: substitui order_by por paginacao invertida
08f7247  Reversao automatica de vendas canceladas/devolvidas dentro de 8 dias
b534fef  Admin: endpoint diagnostico /api/admin/loja-integrada-order?id=NNNN
8c9c4c0  Loja Integrada sync: fetch detalhe do pedido para ler cupom completo
f9bbec9  Painel: lista de vendas ignora vendas reversadas
```

Todos em `main`. Auto-deploy Vercel em cada push.

---

## 9. Quirks da API Loja Integrada (aprendidos nesta sessão)

1. **Dois tipos de chave:**
   - `chave_api`: string curta tipo `5c7a0a15f82bb7067f5c` (20 chars)
   - `chave_aplicacao`: UUID `42329db9-91c0-...`
   - Inverter os dois causa 401 com mensagem "Chave de Api não encontrada"

2. **Auth:** apenas `query` funciona (`?chave_api=...&chave_aplicacao=...`). Headers (`Authorization: chave_api X, chave_aplicacao Y`) e bearer retornam 401. Código mantém 5 modos em fallback para robustez.

3. **Filtros rejeitados em `/pedido/search/`:**
   - `situacao=pago` → "does not allow filtering"
   - `numero=N` → "does not allow filtering"
   - `order_by=-id` → "field does not allow ordering"
   - `order_by=-data_pedido` → "No matching 'data_pedido' field for ordering"
   - `limit > 50` → "deve ficar entre 0 e 50"

4. **Filtros aceitos:** `data_inicio=YYYY-MM-DD`, `limit=N` (≤50), `offset=N`.

5. **`/pedido/search/` vs `/pedido/{id}/`:**
   - Search retorna cupom_desconto vazio/URI (shallow)
   - Detail retorna cupom_desconto como objeto completo `{codigo, valor, ...}`
   - **Solução:** fetch detalhe pra pedidos pagos novos

6. **Resposta da LI tem shape:**
   ```json
   { "meta": { "total_count": 7304, "limit": 50, "offset": 7254, "next": "...", "previous": null }, "objects": [...] }
   ```

7. **Webhook nativo no painel LI: não existe** (ao menos não acessível ao lojista nesse plano).

---

## 10. Como testar manualmente (cola no navegador como admin logado)

### Diagnóstico da chave
```
https://afiliadojoias.com.br/api/admin/loja-integrada-test
```
Esperado: `ok: true, winner: "query", total_orders_in_store: N`.

### Forçar sync (janela 24h)
```
https://afiliadojoias.com.br/api/sync-loja-integrada?secret=joiasmaromba_wh_9f3k2x8p&hours=24
```
Retorna JSON com `inserted`, `reversed`, `skipped`, `errored` + detalhes por pedido.

### Debug de um pedido específico
```
https://afiliadojoias.com.br/api/admin/loja-integrada-order?id=7303
```
Dump do pedido em 4 endpoints da LI. Útil quando `skipped: "no coupon"` parece errado.

### Ver cron ativo
Vercel Dashboard → Project `joias-afiliados-12hf` → **Crons** (lateral esquerda). Deve listar `/api/sync-loja-integrada?hours=2` com "Every 5 minutes".

---

## 11. Tempos de propagação

| Evento | Tempo máximo até refletir no painel |
|---|---|
| Pedido marcado como PAGO na LI | ~5 min (próximo cron) |
| Pedido mudou para CANCELADO/PGTO DEVOLVIDO | ~5 min (próximo cron) |
| Afiliada abre/recarrega painel | instantâneo |
| Realtime channel (painel já aberto) | instantâneo após insert/update |

---

## 12. Pendências / Ideias futuras (não em andamento)

- Se quiser baixar para 1 min, editar `vercel.json`: `"schedule": "*/1 * * * *"`. Vai consumir mais chamadas à LI mas cabe no plano Pro da Vercel.
- Admin também lista vendas — se quiser esconder reversadas lá também (hoje o admin VÊ reversadas pra auditoria — intencional).
- Se a LI um dia criar webhook nativo, o endpoint [webhook/loja-integrada/route.js](app/api/webhook/loja-integrada/route.js) já está pronto (só configurar a URL + secret na LI).
- LI retorna `data_expiracao` no pedido (6 dias após `data_criacao`). Poderia ser usado para auto-cancelar pedidos não pagos, mas é responsabilidade da LI, não nossa.

---

## 13. Como retomar em futuras conversas

**Ao iniciar nova conversa, ler nesta ordem:**
1. [CLAUDE.md](CLAUDE.md) — instruções arquiteturais gerais
2. [PROJETO_SNAPSHOT.md](PROJETO_SNAPSHOT.md) — snapshot geral do projeto (data: 2026-04-20)
3. **Este arquivo** — delta de integração LI + reversão (2026-04-22)
4. `MEMORY.md` em `~/.claude/projects/...` — preferências do usuário (ex: uma pergunta por vez)

**Teste rápido para validar que tudo continua funcionando:**
```
https://afiliadojoias.com.br/api/admin/loja-integrada-test
```
Se retornar `ok: true`, a integração está viva.
