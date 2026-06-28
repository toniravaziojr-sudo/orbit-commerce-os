# Motor de Créditos — Auditoria Oficial (28/06/2026)

**Status:** Documento oficial do sistema (Layer 3 — plataforma).
**Finalidade:** Consolidar o estado atual do Motor Universal de Créditos após o fechamento da Fase F2, registrar pendências reais para o fechamento do tema e estabelecer o backlog disciplinado de hardening.
**Substitui:** o "checkpoint informal" anterior que vivia apenas em memória de chat.

---

## 1. Plano original (resumo)

O Motor Universal de Créditos foi planejado para ser a **única fonte de verdade** de consumo de IA, mídia, comunicação, scrape, fiscal e demais serviços externos cobrados por tenant. Substitui o modelo legado de `tenant_ai_usage` por:

- `credit_ledger` — movimentos reais de crédito por tenant (reserva, captura, estorno).
- `credit_wallet` — saldo agregado por tenant.
- `service_pricing` — preço canônico por chave de serviço (`service_key`).
- `service_usage_events` — telemetria detalhada de cada chamada (status `shadow`/`captured`/`failed`).
- `platform_cost_ledger` — custo de plataforma (NÃO repassado ao tenant) para serviços onde o custo é da plataforma e não do cliente final.
- `tenant_credit_motor_config` — flag `motor_v2_enabled` por tenant para rollout controlado.

Helpers oficiais:
- `_shared/credits/charge-after.ts` (`chargeAfter`) — postpaid.
- `_shared/credits/with-motor.ts` (`withCreditMotor`) — pré-pago.
- `_shared/credits/media-shadow-event.ts` + `media-service-key-resolver.ts` — shadow de mídia.
- `_shared/credits/platform-cost.ts` (`recordPlatformCost`) — custo de plataforma.

---

## 2. Estado atual (28/06/2026)

### 2.1 Fases concluídas

| Fase | Escopo | Status |
|------|--------|--------|
| F1 | Telemetria `chargeAfter` em `service_usage_events` | ✅ ativa |
| F2.1 – F2.6 | `platform_cost_ledger` + edges piloto (emails, insights, learnings) | ✅ ativo |
| F2.7 – F2.11 | Migração das edges remanescentes para `recordPlatformCost` | ✅ ativo |
| F2.12 | Regra estrutural WhatsApp/Meta — mensagens/templates Meta NÃO são cobrados pela plataforma; somente custos de plataforma (IA/processamento) entram no ledger | ✅ ativo |
| F2.13.1 | Agenda (`agenda-process-command`) cobrando IA via `chargeAfter` | ✅ ativo |
| F2.13.2.C-CODE | Hardening de PII, sanitização de logs e stop-write de `raw_payload` no WhatsApp | ✅ ativo |

### 2.2 Métricas reais do banco

- `credit_ledger`: **1.127 movimentos**.
- `service_usage_events`: **799 capturados** + **176 em shadow**.
- `platform_cost_ledger`: **7 linhas** (origem: `command-insights-generate` e `send-system-email`).
- `service_pricing`: **49 chaves ativas**.
- `tenant_credit_motor_config`: **1 tenant** com `motor_v2_enabled=true` (Respeite o Homem).

### 2.3 Cobertura de rollout

- **Live shadow:** Respeite o Homem (única flag v2 ativa).
- **Live cobrando de verdade:** nenhum tenant.

---

## 3. Pendências reais para "fechar" o tema

### 3.1 Bloco D — 4 decisões estratégicas (aguardando GO do operador)

Cada decisão abaixo exige confirmação explícita antes de execução. Nenhuma é técnica — todas envolvem mudança de contexto de negócio.

#### D1. Rollout v2 do shadow para live por categoria
- **Como funciona hoje:** Respeite o Homem tem `motor_v2_enabled=true`, mas todos os eventos ainda caem em `shadow` (telemetria sem cobrança real).
- **Proposta para validação:** promover por categoria isolada (`email` e `ai_text` primeiro, no Respeite o Homem, por 14 dias em live) com critérios objetivos: `delta_pct < 5%`, volume ≥ 30 eventos/dia, zero erros.
- **Resultado final:** Motor passa a cobrar de verdade nas categorias promovidas; demais permanecem em shadow.

#### D2. Reprecificação dos pacotes 15K / 50K
- **Como funciona hoje:** preços fixos definidos na ativação inicial do Motor.
- **Problema:** Risco R9 documentado em `motor-creditos.md` — câmbio (USD/BRL) e markup podem ter desalinhado a margem dos pacotes vendidos.
- **Proposta:** revisar `credit_packages` + tabela de margem por chave.
- **Resultado final:** pacotes alinhados com a margem-alvo atual.

#### D3. Câmbio Fase 2 — PTAX Bacen automático
- **Como funciona hoje:** câmbio fixo R$ 5,50 (manual) usado em conversões `service_pricing`.
- **Proposta:** integrar Bacen PTAX (cron diário) para alimentar `fx_rates`.
- **Resultado final:** preços canônicos em BRL sempre sincronizados com PTAX D-1.

#### D4. Reconciliação `tenant_ai_usage` (legada)
- **Como funciona hoje:** `tenant_ai_usage` continua existindo mas não é atualizada pelo Motor v2.
- **Decisão binária:** (a) aposentar a tabela e migrar painéis para `credit_ledger` (recomendação técnica — fonte única) ou (b) restaurar paridade gravando em ambas.
- **Resultado final (a):** uma única fonte de verdade, sem ambiguidade de relatório.

### 3.2 Bloco B — Backlog de hardening (não-bloqueante)

Itens registrados como backlog disciplinado. Reforços de segurança que não bloqueiam o fechamento do Motor — só entram em execução com GO explícito.

1. HMAC SHA-256 definitivo em todos os webhooks de entrada.
2. Validação `x-hub-signature-256` em todos os webhooks Meta (WhatsApp + Ads).
3. Sanitização de `last_error` em 5 conectores OAuth (token leak risk).
4. Header `Authorization: Bearer` no healthcheck WhatsApp.
5. Hardening de logs admin (filtro de PII em `core_audit_log` e `system_email_logs`).
6. Auditoria de `agenda_authorized_phones` (rotação de tokens e validade).

### 3.3 Bloco C — Auditorias técnicas reativas

Só puxar quando o caso de uso real chegar.

- **Granularidade / minimum charge:** revisar quando aparecer reclamação de proporcionalidade ou caso Click-to-WhatsApp Ads exigir cobrança fracionada.
- **Extração estruturada do webhook WhatsApp:** revisar quando F2.12 (stop-write de payload bruto) gerar lacuna de auditoria que exija parsing estruturado.

---

## 4. Falsos positivos descartados nesta auditoria

Itens que apareceram em checkpoints anteriores e foram revalidados como **não procedentes** em 28/06/2026:

| Item | Verificação | Conclusão |
|------|-------------|-----------|
| Cron `generate-weekly-insights` retornando 401 | Edge não existe. O cron real é `weekly-command-insights` (jobid 56) chamando `command-insights-generate`. Últimas 5 execuções: todas `succeeded`. | Falso positivo. Remover do backlog. |
| `get_auth_user_email` permission denied em `/platform/emails` | RPC está corretamente revogada de `anon`/`authenticated` por design (migração `20260428032743`). Uso restrito a RLS de `platform_admins` e `system_email_logs`. Sem erro ativo. | Falso positivo. Remover do backlog. |

---

## 5. Restrições firmes (anti-regressão)

- Toda promoção de categoria do shadow para live exige PLANNER → GO → execução por categoria isolada.
- Nunca processar mais de 1 tenant em janela de promoção sem confirmação explícita do operador.
- Nunca apagar linha real de `platform_cost_ledger` ou `credit_ledger` (apenas estornar via novos movimentos).
- Mensagens e templates Meta (WhatsApp + Ads) NÃO entram no ledger de cobrança ao tenant — apenas custos de plataforma (IA, processamento, mídia gerada).
- `tenant_ai_usage` legada não pode ser usada como fonte de relatório enquanto a decisão D4 não for tomada.
- Qualquer alteração em `service_pricing` exige registro em `service_pricing_audit` (já automatizado por trigger — não desabilitar).

---

## 6. Próximo passo imediato

Apresentar ao operador, uma a uma, as 4 decisões do Bloco D no formato canônico (Como funciona hoje / Problema / O que eu faria / Resultado final) e aguardar confirmação antes de executar qualquer rollout.
