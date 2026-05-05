# Motor Universal de Créditos — Comando Central

> **Camada:** Layer 2/3 — Especificação de Plataforma  
> **Status:** Ativo (Fase 2A — camada operacional preparada, sem cutover)  
> **Última atualização:** 2026-05-04  
> **Fonte de verdade para:** regra de débito de créditos, ledger, idempotência, política de cobrança plataforma vs tenant, reserva/captura/refund, workers/crons pagos.

---

## 1. Problema atual

A plataforma já possui infraestrutura de créditos:

- `credit_wallet` — carteira por tenant (`balance_credits`, `reserved_credits`, `lifetime_purchased`, `lifetime_consumed`).
- `credit_ledger` — extrato imutável (atualmente **0 linhas**).
- `credit_packages` — 4 pacotes ativos para compra.
- `ai_pricing` — catálogo versionado (30 linhas).
- `ai_model_pricing` — catálogo legado (4 linhas, a ser deprecado).
- RPCs `consume_credits`, `reserve_credits`, `check_credit_balance`.

**Lacuna crítica:** nenhuma das edge functions pagas (~70 mapeadas) chama o motor hoje. O custo externo (IA, e-mail, fiscal, WhatsApp, scrape) é absorvido integralmente pela plataforma. Não há rastreabilidade financeira por tenant, por categoria ou por provedor.

## 2. Objetivos do Motor

1. Debitar créditos do tenant sempre que um serviço pago for consumido em seu nome.
2. Registrar todo consumo em ledger imutável.
3. Calcular custo real da plataforma em USD e snapshot em BRL no momento da transação.
4. Calcular valor vendido (sell) em USD/BRL e margem.
5. Bloquear chamada externa quando o tenant não tiver saldo (bloqueio duro).
6. Suportar reserva, captura, liberação e reembolso.
7. Manter consistência transacional entre `credit_wallet` e `credit_ledger`.
8. Distinguir custo do tenant de custo absorvido pela plataforma.
9. Garantir que workers/crons/filas tenham `tenant_id` confiável ou sejam classificados como custo de plataforma.
10. Servir de fonte para relatórios admin (consumo por tenant/categoria/provedor, margem, reconciliação).

## 3. Modelo financeiro

### 3.1 Conceitos canônicos

| Campo | Significado |
|---|---|
| `cost_usd` | Custo real pago ao provedor externo (nunca exposto ao tenant). |
| `markup_pct` | Margem aplicada por categoria (vem do catálogo, não hardcoded). |
| `sell_usd` | Valor de venda ao tenant em USD = `cost_usd × (1 + markup_pct)`. |
| `credits_charged` | Créditos debitados = `ceil(sell_usd / 0.01)`, respeitando `min_credits_charge` do catálogo. |
| `fx_rate_usd_brl` | Câmbio snapshot no momento da transação. |
| `cost_brl_snapshot` | `cost_usd × fx_rate` — congelado na linha do ledger. |
| `sell_brl_snapshot` | `sell_usd × fx_rate` — congelado na linha do ledger. |

**Regra fundamental:** 1 crédito = US$ 0,01 em valor de venda. O tenant nunca vê `cost_usd`, `markup`, `margem` nem detalhes do catálogo.

### 3.2 Decisões aprovadas (Fase 0)

| # | Decisão | Valor aprovado |
|---|---|---|
| D1 | Markup default | 50% |
| D2 | Markup IA vídeo | 80% |
| D3 | Markup E-mail | 100% |
| D4 | Markup Fiscal | 30% |
| D5 | Câmbio Fase 1 | R$ 5,50 / US$ 1,00 (configurável por platform_admin) |
| D6 | Câmbio Fase 2 | Fonte oficial (Bacen PTAX) — futura |
| D7 | Saldo insuficiente | Bloqueio duro. Não chamar provedor externo. |
| D8 | WhatsApp Fase 1 | Cobrança por **template enviado** (intermediário). |
| D9 | WhatsApp Fase 2 | Cobrança por **janela/conversa de 24h** (modelo financeiro correto). |
| D10 | Plano Gratuito | 0 créditos mensais. |
| D11 | Trial | 200 créditos de cortesia. |
| D12 | E-mails de auth/recovery/onboarding plataforma | Custo absorvido pela plataforma. Não debitar tenant. |
| D13 | E-mails transacionais do tenant + e-mails marketing | Cobrados do tenant. |
| D14 | Custos de plataforma | Registrados em estrutura separada (`cost_owner='platform'`) — não aparecem no extrato do tenant nem alteram a carteira. |

**Markup nunca é hardcoded.** A RPC futura deve ler `markup_pct` do catálogo de preços por (`category`, `service_key`, `effective_from`).

## 4. Política de saldo insuficiente — bloqueio duro

1. Antes de chamar qualquer provedor pago, o motor faz **preflight de saldo** (ou reserva).
2. Se `balance_credits - reserved_credits < credits_required`, a operação **não chama o provedor**.
3. Resposta padrão (200 OK + `success:false`):

   ```json
   {
     "success": false,
     "error_code": "INSUFFICIENT_CREDITS",
     "credits_required": 320,
     "credits_available": 80,
     "credits_missing": 240,
     "buy_url": "/account/credits?tab=buy"
   }
   ```

4. **Proibido** debitar parcial, debitar pós-cobrança "best effort", ou tolerar saldo negativo na Fase 1.
5. Tolerância de saldo negativo é decisão futura — não está aprovada nesta fase.

## 5. Custo plataforma vs custo tenant

| Cenário | `cost_owner` | Wallet do tenant? | Aparece no extrato do tenant? |
|---|---|---|---|
| IA, fiscal, e-mail tenant, WhatsApp, scrape solicitados pelo tenant | `tenant` | Debita | Sim |
| E-mail de signup, recovery, magic link, onboarding plataforma | `platform` | Não toca | Não |
| Cron interno sem `tenant_id` confiável (insights de plataforma, monitoramento) | `platform` | Não toca | Não |
| Worker de fila herdando `tenant_id` do job de origem | `tenant` | Debita | Sim |

Custos `platform` são registrados em estrutura separada (futuro: `platform_cost_ledger` ou flag `cost_owner` no próprio `credit_ledger` com `tenant_id` nulo + RLS adequada). A decisão estrutural exata fica para Fase 1.

**Regra:** custo de plataforma **nunca** entra na carteira do tenant nem em queries de extrato do tenant. RLS deve impedir leitura cruzada.

## 6. Ledger imutável

1. `credit_ledger` é append-only. Sem `UPDATE`, sem `DELETE`.
2. Correções são feitas por novas linhas:
   - `transaction_type='refund'` — devolve créditos ao tenant.
   - `transaction_type='adjust'` — ajuste manual de platform_admin (com auditoria obrigatória).
3. Cada linha guarda snapshot de `cost_usd`, `sell_usd`, `fx_rate`, `cost_brl`, `sell_brl`, `markup_pct`, `balance_before`, `balance_after`. Mudanças futuras de câmbio ou catálogo **não alteram** linhas antigas.
4. Wallet é derivada de `SUM(credits_delta)` do ledger. Reconciliação periódica obrigatória.

## 7. Idempotência

1. Toda operação paga deve fornecer `idempotency_key`.
2. Formato recomendado: `<tenant_id>:<feature>:<request_hash>` ou `<tenant_id>:<job_id>:<step>`.
3. **Hoje:** `credit_ledger.idempotency_key` é UNIQUE global. Aceitável, mas exige prefixo manual com `tenant_id` para evitar colisão entre tenants.
4. **Fase 1 obriga:** garantia estrutural via UNIQUE composto `(tenant_id, idempotency_key)`. Prefixo manual é fallback, não substituto.
5. Reentrada idempotente: segunda chamada com mesma key retorna sucesso silencioso sem novo débito nem nova chamada ao provedor.

## 8. Reserva / captura / liberação / reembolso

| Operação | Quando usar | Comportamento |
|---|---|---|
| `estimate(units)` | Mostrar custo previsto na UI antes de executar. | Cálculo puro, não debita. |
| `reserve(credits, key)` | Operações longas (vídeo IA, batch scrape, streaming chat). | Move créditos para `reserved_credits`. Bloqueia se saldo insuficiente. |
| `capture(reservation_key, actual_credits)` | Final da operação com custo real apurado. | Debita `actual_credits` do reservado, libera o excesso. |
| `release(reservation_key)` | Cancelamento antes de executar. | Devolve reserva integral, sem débito. |
| `charge(credits, key)` | Operações curtas e determinísticas (imagem única, e-mail único). | Reserva + captura atômico. |
| `refund(ledger_id, reason)` | Erro pós-débito (5xx do provedor, falha pós-cobrança). | Cria linha `refund` revertendo créditos. |

**Streaming de IA texto:** reservar pelo `max_tokens × preço_out`, capturar `actual_tokens` no `finally`, liberar diferença imediatamente.

**Vídeo IA:** reserva obrigatória com 110% da estimativa (margem para variação de duração). Bloqueio duro.

**Refund automático:** ativado quando provedor retorna 5xx ou falha verificável após débito. Falhas 4xx (input inválido) não geram refund automático — exigem revisão admin.

## 9. Workers, crons e filas

1. Todo worker que consome serviço pago **deve** carregar `tenant_id` do job de origem.
2. Crons que rodam para a plataforma (insights, monitoramento, sync global) **devem** ser classificados como `cost_owner='platform'`.
3. **Proibido** consumir serviço pago sem classificação explícita. Funções não classificadas são bloqueadas no registry de funções pagas (ver `funcoes-pagas.md`).
4. Detalhes operacionais: `docs/especificacoes/plataforma/workers-crons-pagos.md`.

## 10. WhatsApp — Fase 1 e Fase 2

### Fase 1 (intermediária — modelo simplificado)

- Cobrar por **template enviado** (`type=template` em `meta-whatsapp-send`).
- Mensagens de texto livre dentro de janela aberta pelo cliente: **gratuitas** nesta fase.
- Justificativa: simples de implementar, custo previsível, evita bloqueios de UX em conversas ativas.
- Limitação reconhecida: não reflete fielmente o modelo da Meta (que cobra por janela 24h).

### Fase 2 (modelo financeiro correto — obrigatória)

- Cobrar por **janela/conversa de 24h** por par `(tenant_id, wa_id, category)`.
- Estrutura futura prevista: `whatsapp_conversation_windows (id, tenant_id, wa_id, category, opened_at, expires_at, charged_ledger_id)`.
- Categorias Meta: marketing, utility, authentication, service.
- Inbound (cliente → tenant): grátis.
- Outbound dentro de janela ativa: cobra apenas a abertura da janela.
- Outbound fora de janela: abre nova janela e cobra.

**Documentação obrigatória:** Fase 1 é intermediária. O modelo correto é Fase 2. A migração Fase 1 → Fase 2 deve ser planejada antes de cobranças em produção atingirem volume relevante.

## 11. Riscos críticos

| # | Risco | Mitigação |
|---|---|---|
| R1 | Cutover sem ledger histórico — primeiro mês pode parecer abusivo aos lojistas. | Período de "warm-up" com créditos de cortesia + comunicação prévia. |
| R2 | Markup hardcoded 1.5× na RPC `consume_credits` atual. | Substituir por leitura de catálogo na Fase 3 antes de qualquer plug em produção. |
| R3 | WhatsApp Fase 1 sub-cobra conversas longas e sobre-cobra mensagens isoladas. | Aceito como intermediário. Migração para Fase 2 obrigatória. |
| R4 | Crons sem `tenant_id` continuam absorvendo silenciosamente. | Auditoria 1×1 antes da Fase 7 (workers/crons). |
| R5 | Câmbio fixo defasa em desvalorização cambial. | Fase 2 com Bacen PTAX. |
| R6 | Reserva de streaming superestimada frustra UX (saldo "some" e volta). | Release imediato no `finally` + UI explica reserva temporária. |
| R7 | Catálogo público com `cost_usd`/`markup` exposto via RLS. | RLS estrita: leitura pública limitada a campos sanitizados. Custo real e markup só `is_platform_admin()`. |
| R8 | Idempotency_key sem `tenant_id` permite colisão entre tenants. | UNIQUE composto `(tenant_id, idempotency_key)` na Fase 1. |
| R9 | Pacotes em BRL desalinhados com câmbio + bônus + margem. | Reanalisar `credit_packages` com base em câmbio aprovado e markup antes da Fase 2 de UI. |

## 12. Critérios para avançar para Fase 1

Antes de iniciar Fase 1 (fundação de banco e contratos):

- [ ] Este documento aprovado pelo usuário.
- [ ] `catalogo-precos-creditos.md` criado e aprovado.
- [ ] `funcoes-pagas.md` criado com registry inicial.
- [ ] `workers-crons-pagos.md` criado.
- [ ] `ux-creditos-lojista.md` criado.
- [ ] `ux-admin-creditos-custos.md` criado.
- [ ] `custos-externos.md` atualizado com referência ao motor.
- [ ] `mapa-ui.md` atualizado com previsão de `/account/credits`.
- [ ] Decisão sobre estrutura para `cost_owner='platform'` (coluna no ledger vs tabela separada) — pendente para abertura da Fase 1.
- [ ] Decisão sobre estratégia de evolução `ai_pricing` → `service_pricing` (rename, view de compatibilidade ou tabela nova) — pendente para abertura da Fase 1.

## 13. Documentos relacionados

- `docs/especificacoes/plataforma/catalogo-precos-creditos.md`
- `docs/especificacoes/plataforma/funcoes-pagas.md`
- `docs/especificacoes/plataforma/workers-crons-pagos.md`
- `docs/especificacoes/sistema/ux-creditos-lojista.md`
- `docs/especificacoes/plataforma/ux-admin-creditos-custos.md`
- `docs/especificacoes/transversais/custos-externos.md`
- `docs/especificacoes/transversais/mapa-ui.md`

---

## 14. Fase 2A — Camada operacional (executada, sem cutover)

A Fase 2A entregou a fundação operacional do motor v2 sem plugar nenhuma edge function paga em produção, sem ativar nenhum tenant e sem alterar nenhum pacote de créditos. v1 continua sendo o motor real em uso.

### 14.1 RPCs v2 criadas (9)

| RPC | Finalidade | Acesso |
|---|---|---|
| `estimate_credits_internal(category, service_key, units, model, variant)` | Cálculo administrativo, retorna `cost_usd`, `markup`, `sell_usd`, `credits`, `cost_brl`, `sell_brl`. Usa catálogo `service_pricing` + `fx_rates`. | service_role / platform_admin |
| `estimate_credits_public(category, service_key, units, model, variant)` | Versão sanitizada para tenant: retorna apenas `credits` e `approx_brl`. Sem custo, sem markup, sem fx. | authenticated (tenant) |
| `check_credit_balance_v2(tenant_id, credits_required)` | Verifica `balance - reserved >= required`. Não muta estado. | service_role |
| `reserve_credits_v2(tenant_id, credits, idempotency_key, metadata, expires_minutes)` | Reserva créditos. Aumenta `reserved_credits`. `credits_delta=0` no ledger. Bloqueio duro se saldo insuficiente. | service_role |
| `capture_reservation(reservation_id, actual_credits, metadata)` | Finaliza reserva: debita `actual_credits`, libera diferença. Vínculo via `reference_ledger_id`. | service_role |
| `release_reservation(reservation_id, reason, metadata)` | Cancela reserva integralmente. Vínculo via `reference_ledger_id`. | service_role |
| `charge_credits_v2(tenant_id, credits, idempotency_key, metadata)` | Débito direto (reserve+capture atômico) para operações curtas. | service_role |
| `refund_credits(consume_or_capture_ledger_id, credits, reason, metadata)` | Reembolso pós-débito. Linha `refund` com `reference_ledger_id`. | service_role |
| `record_platform_cost(category, provider, service_key, cost_usd, metadata)` | Registra custo absorvido pela plataforma em `platform_cost_ledger`. Não toca wallet. | service_role |

**Diferença `internal` vs `public`:** `estimate_credits_internal` expõe `cost_usd`, `markup_pct`, `sell_usd`, `fx_rate` — uso admin/relatórios. `estimate_credits_public` retorna apenas `credits` e `approx_brl` arredondado — único caminho permitido para o tenant/frontend.

### 14.2 Segurança das RPCs mutáveis

- `EXECUTE` revogado para `PUBLIC`, `anon` e `authenticated` em: `reserve_credits_v2`, `capture_reservation`, `release_reservation`, `charge_credits_v2`, `refund_credits`, `record_platform_cost`, `check_credit_balance_v2`, `estimate_credits_internal`.
- Chamada exclusivamente via `service_role` em edge functions internas (helper universal).
- Tenant **nunca** chama RPC mutável diretamente. Frontend só consome `estimate_credits_public` e leituras sanitizadas (wallet, view do ledger).

### 14.3 Helper universal — `supabase/functions/_shared/credits/charge.ts`

Único ponto de entrada para edge functions consumirem o motor v2. Funções exportadas:

- `estimateCredits` — wrapper de `estimate_credits_internal`.
- `checkBalance` — wrapper de `check_credit_balance_v2`.
- `reserveCredits` — wrapper de `reserve_credits_v2`.
- `chargeCredits` — wrapper de `charge_credits_v2`.
- `captureReservation` — wrapper de `capture_reservation`.
- `releaseReservation` — wrapper de `release_reservation`.
- `refundCredits` — wrapper de `refund_credits`.
- `recordPlatformCost` — wrapper de `record_platform_cost`.
- `buildIdempotencyKey(parts[])` — geração canônica de chave.
- `normalizeCreditError(err)` — normalização de erros para envelope `{ success:false, error_code, ... }`.

Suporta modos `live` e `shadow` (configuráveis via `tenant_credit_motor_config`).

### 14.4 Semântica do ledger v2

| transaction_type | balance_credits | reserved_credits | credits_delta | reference_ledger_id | metadata.motor_version |
|---|---|---|---|---|---|
| `reserve` | inalterado | aumenta | `0` | NULL | `'v2'` (+ `metadata.reserved_credits`) |
| `release` | inalterado | reduz | `0` | aponta para `reserve` | `'v2'` |
| `capture` | reduz | reduz pelo total reservado | negativo | aponta para `reserve` | `'v2'` |
| `consume` | reduz | inalterado | negativo | NULL | `'v2'` |
| `refund` | aumenta | inalterado | positivo | aponta para `consume`/`capture` | `'v2'` |

**`reference_ledger_id`** é o vínculo estrutural oficial entre `reserve` ↔ `capture`/`release` e entre `consume`/`capture` ↔ `refund`. Reconciliação e cron de órfãs **não** dependem de `metadata` ou `job_id` para identificar finalização.

### 14.5 Política de overflow em capture

- `capture_reservation` **nunca** gera saldo negativo.
- Se `actual_credits > reserved`, captura no máximo o reservado.
- Excesso é registrado em `metadata.overage_uncollected_credits` na linha de `capture`.
- Alerta/log para revisão admin quando overage > 0.

### 14.6 Shadow mode

- Estrutura preparada via `tenant_credit_motor_config(tenant_id, category, mode)` com `mode in ('off','shadow','live')`.
- Em `shadow`: helper calcula custo/créditos via v2 e registra `service_usage_events` com `status='shadow'`. **Não** muta `credit_wallet`, **não** cria linha financeira em `credit_ledger`.
- Permite comparar v1 vs v2 sem risco de cobrança duplicada.
- Tabela criada vazia. Nenhum tenant ativado. Nenhuma categoria em `live`.

### 14.7 Hardening do `fx_rates`

- Leitura para `authenticated` removida.
- Acesso restrito a `platform_admin` / `service_role`.
- Tenant nunca lê tabela bruta. Vê BRL apenas via `credit_ledger_tenant_view` (snapshot já calculado) ou `estimate_credits_public` (`approx_brl`).

### 14.8 Padronização de `metadata.source`

- `metadata.source` é a chave oficial para registrar origem de backfill, sistema gerador ou fluxo emissor de uma linha de ledger.
- Substitui qualquer referência anterior a `metadata.origin_table`. Esta forma fica obsoleta — qualquer referência futura a `origin_table` em código novo deve ser refatorada para `source` antes de plug.

### 14.9 Estrutura de dados adicional

Campos novos em `credit_ledger`: `reference_ledger_id` (FK self), `operation_status`, `reservation_expires_at`.  
Campos novos em `service_usage_events`: `updated_at` (com trigger), `reservation_ledger_id`.  
Tabela nova: `tenant_credit_motor_config` (admin-only).

### 14.10 Estado de rollout pós-Fase 2A

- ❌ Nenhuma edge function paga foi plugada no motor v2.
- ❌ `youtube-upload` continua em v1.
- ❌ Nenhum tenant ativado em `tenant_credit_motor_config`.
- ❌ Nenhum cutover.
- ❌ Pacotes de crédito (15K/50K) não foram alterados.
- ✅ Cron de reservas órfãs ativo, restrito a v2 (ver `workers-crons-pagos.md` §8).

### 14.11 Pendências para Fase 2B / Fase 3

- **Fase 2B:** seed do catálogo não-IA (`email`, `fiscal`, `whatsapp`, `scrape`); UI admin de `service_pricing`; auditar provider fiscal real (Focus NFe vs Nuvem Fiscal) antes de seedar `fiscal`.
- **Fase 3:** plug real das edge functions pagas no motor v2, começando por `youtube-upload`; ativar shadow mode em tenant piloto; depois `live` por categoria.
- **Fase comercial posterior:** reprecificação de pacotes 15K/50K conforme câmbio + markup atualizados.

---

## Fase 3 — Primeiro plug em shadow mode (youtube-upload)

**Status:** Ativo desde 2026-05-04. Piloto: Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).

### Decisões aprovadas

- `youtube-upload` continua usando RPCs v1 (`check_credit_balance`, `reserve_credits`, `consume_credits`) como **única** fonte de cobrança real.
- Motor v2 roda em **modo paralelo** (shadow), apenas calculando créditos via `estimate_credits_internal` e gravando em `service_usage_events` com `status='shadow'`.
- v2 **não** altera `credit_wallet` e **não** insere linhas financeiras em `credit_ledger`.
- Falha do v2 nunca propaga para o usuário (try/catch silencioso, log `WARN`).

### Service pricing

- `service_key`: `platform.youtube_upload`
- `category`: `platform_internal` (nova categoria, monetização interna sem custo externo direto)
- `provider`: `youtube`, `unit`: `upload`, `display_name`: `YouTube Upload`
- `metadata.pricing_model`: `fixed_credits` — base 16, +1 thumbnail, +2 captions (espelha v1)
- `metadata.placeholder=true`, `metadata.approved_for_live=false`, `metadata.shadow_only=true`
- `cost_usd=0.005` é apenas placeholder técnico; não representa venda em créditos para este caso (cálculo usa `fixed_credits`).

### Ativação por tenant

`tenant_credit_motor_config` ganhou as colunas `shadow_service_keys` e `live_service_keys` (text[]).
A ativação shadow é **por service_key**, não por categoria, sempre que tecnicamente possível.

```text
motor_v2_enabled       = false
shadow_categories      = []
live_categories        = []
shadow_service_keys    = ['platform.youtube_upload']
live_service_keys      = []
```

### Critérios de divergência

- `delta_abs = |v2_credits − v1_credits|`
- `delta_pct = delta_abs / v1_credits × 100`
- `≤ 1%` ideal; `> 5%` marca `metadata.divergence_alert=true`. Erro v2 marca `metadata.shadow_error=true`.
- Divergência **não bloqueia** o usuário.

### Idempotência shadow

Chave determinística: `youtube-upload-shadow-v2:{tenant_id}:{video_id ou job_id}`. Retry não duplica evento (verificação prévia em `service_usage_events`).

### Rollback

Remover `platform.youtube_upload` de `shadow_service_keys` no tenant. v1 continua intacto. Eventos shadow são preservados para auditoria.

### Janela de avaliação

7 dias antes de avaliar GO/NO-GO para live. Critério provisório de live: 0 erros v2 + |delta_pct médio| ≤ 1% em ≥50 eventos.

---

## Fase 3B — Piloto shadow v2 de IA Imagem (2026-05)

### Contexto
O piloto anterior (`youtube-upload`) ficou pausado por ausência de OAuth ativo. A Fase 3B usa **IA Imagem** como novo piloto prático de shadow mode v2, começando exclusivamente pelo edge `creative-image-generate` e apenas para caminhos **Fal.AI / gpt-image-1.5**.

### Decisões estruturais (correções transversais do motor v2)
1. `service_usage_events.status` agora aceita o valor oficial `'shadow'`, junto com os demais (`estimated`, `reserved`, `captured`, `released`, `refunded`, `failed`).
2. `chk_sue_owner_tenant` foi ajustada para permitir a combinação `cost_owner='platform'` + `tenant_id NOT NULL` **somente** quando `status='shadow'`. Para qualquer outro status essa combinação continua proibida.
3. Eventos shadow são **observabilidade interna da plataforma**: `cost_owner='platform'` impede que o tenant veja o evento; o `tenant_id` real permanece preenchido para análise admin (filtro por tenant, relatórios, auditoria). RLS já existente em `service_usage_events` continua bloqueando leitura tenant para `cost_owner='platform'`.

### Particularidades de IA Imagem
- IA Imagem **não possui cobrança v1** real hoje. Logo, o shadow v2 calibra preços futuros sem `delta_pct` contra v1.
- O shadow registra apenas `metadata.v2_credits_estimated`, `metadata.v1_credits=null`, `metadata.provider_cost_source='service_pricing_estimate'`.
- Custo USD, markup e margem **não** vão em metadata; o tenant nunca vê custo real.

### Regra de não-duplicação
- O shadow é executado **somente após** geração concluída, upload no Storage e persistência do job. **Nunca** chama o provedor uma segunda vez.
- Falha no shadow vira `WARN` e **não** afeta a geração.

### Escopo plugado nesta fase
- Edge: `creative-image-generate` apenas.
- Provider: Fal.AI / gpt-image-1.5 apenas.
- Demais providers (`gemini`, `openai legacy`, `lovable`) retornam **skip controlado** com `skip_reason` claro. Pricing de Gemini/Nano Banana fica como pendência futura (ver `catalogo-precos-creditos.md`).
- v2 shadow **não** chama `charge_credits_v2`, **não** chama `reserve_credits_v2`, **não** chama `capture_reservation`, **não** altera `credit_wallet`, **não** cria `credit_ledger` financeiro.

### Tenant piloto
- `Respeite o Homem` (`d1a4d0ed-8842-495e-b741-540a9a345b25`).
- `motor_v2_enabled=false`. `live_service_keys=[]`. `shadow_service_keys` recebe as 8 chaves Fal.AI ativas + `platform.youtube_upload` preservada.

### Idempotência
- Chave determinística via `buildImageShadowIdempotencyKey({tenant, job, variation_index, service_key, provider_response_id})`. Retry da mesma geração não duplica `service_usage_events`.
