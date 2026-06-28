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

## 6. Decisão de Rollout — 28/06/2026 (operador)

**Decisão tomada pelo operador:** o motor shadow será **descontinuado como gate por tenant**. O destino final é cobrança real (live) universal a partir do segundo tenant em diante. O shadow permanece **apenas no Respeite o Homem como "laboratório permanente"**, adormecido, e só é reativado quando uma nova IA / novo modelo / nova chave de serviço entra no sistema (gate de validação de preço unitário, não gate de tenant).

**Pré-condição obrigatória para o cutover live universal:**
Antes de desligar o shadow no Respeite o Homem e abrir cobrança real para os demais tenants, **todos os motores operacionais com `service_pricing` ativo precisam estar realmente rodando em produção no Respeite o Homem pelo menos uma vez**, para que o preço unitário canônico seja confirmado contra a fatura real do provedor.

## 7. Mapa das 35 chaves não validadas (28/06/2026)

Levantamento cruzando `service_pricing` (49 ativas) × `service_usage_events` no tenant piloto. Classificação por uso real no sistema:

### Grupo 1 — Em uso ativo (validar via uso natural)

Motores reais que rodam no dia-a-dia do tenant piloto. **Não são fallback.** Validação acontece sozinha conforme o uso real ocorre.

- `gemini-2.5-flash.*` — motor primário do Auxiliar de Comando (Central de Comando → Assistente) e do TPR de Vendas WhatsApp.
- `whisper-1.per_minute` — transcrição de áudio inbound no WhatsApp (`ai-support-transcribe`).
- `email-auth-send` / `email-system-send` / `email-marketing-send` — três fluxos distintos de e-mail (reset senha, sistema, campanhas).
- `firecrawl-scrape-page` / `firecrawl-crawl-site` — Importador Guiado e clonagem de páginas IA.
- `command-insights-generate` — cron semanal (segunda-feira) dos insights da Central de Comando.

### Grupo 2 — Fallback dentro de hierarquia já validada (NÃO disparar sintético)

Chaves que **só disparam se o motor primário falhar**. Não compensa shadow sintético. Marcar como `pending_validation` na `service_pricing` e auditar apenas no primeiro uso real.

- `gpt-4o.*` / `gpt-5.2.*` (variantes não exercitadas) — fallback do Gemini no `provider-router`.
- `openai.gpt-image-1.*` — fallback 1 do Unified Image Engine (primário é `fal.gpt-image-1.5.*`).
- `dall-e-3.*` — fallback 2 do Unified Image Engine (último recurso, legado).
- `fal.sora-2.*` — rota alternativa do Unified Video Engine, não promovida no v1.

### Grupo 3 — Side-effect real (validar só com uso intencional)

Chaves cujo disparo sintético geraria efeito real no mundo (NF-e na Sefaz, vídeo publicado, vídeo de alto custo). **Proibido disparo sintético.**

- **NF-e (7 chaves):** `nfe-emit`, `nfe-cancel`, `nfe-cce`, `nfe-inutilizar`, `nfe-status-query`, `nfe-email-send`, `focus-nfe-sync`. Validação acoplada ao tema **Fiscal de Marketplaces** (aguarda primeira venda real).
- **YouTube:** `platform.youtube_upload`. Validação só com publicação real intencional pelo operador.
- **Vídeo IA caro:** `fal.veo-3.1.per_second.4k.standard.audio|noaudio`, `fal.kling-avatar-v2-pro.per_second`. Disparam só quando o operador rodar geração intencional desses tiers.

### Grupo 4 — Volume insuficiente (já em uso, falta acumular)

Chaves que já dispararam <10 vezes. Vão completar shadow naturalmente.

- `fal.kling-video.per_second.pro`
- `fal.gpt-image-1.5.medium_1024x1536`
- `email-transactional-send`
- `gemini-2.5-flash.*` (variantes específicas com baixo volume)

## 8. Bloqueios reais para fechar o Motor (atualizado em 28/06/2026)

O Motor não pode ser declarado "fechado" enquanto os motores operacionais do Grupo 3 não tiverem ao menos uma execução real em produção no Respeite o Homem para confirmar o preço canônico. Lista de motores operacionais pendentes de produção real no tenant piloto:

| Motor | Estado atual no Respeite o Homem | Bloqueio |
|-------|----------------------------------|----------|
| NF-e (7 chaves) | Aguardando primeira venda real de marketplace (tema "Fiscal de Marketplaces") | Acoplado ao fluxo de pedido marketplace |
| YouTube Upload | Nunca rodou | Aguardando publicação intencional |
| Vídeo IA (Veo 3.1 4K, Kling Avatar V2 Pro) | Nunca rodou | Aguardando geração intencional pelo operador |

**Enquanto essa lista não zerar:**
- Shadow permanece ativo no Respeite o Homem para essas chaves.
- Cobrança real (live universal) NÃO é aberta para os demais tenants.
- Demais decisões do Bloco D (D2, D3, D4) podem avançar em paralelo se o operador autorizar — não estão acopladas a essa lista.

## 9. Protocolo "Shadow como Laboratório Permanente"

Mesmo após a abertura da cobrança real universal, a infraestrutura de shadow **permanece adormecida no código e ativa apenas no tenant Respeite o Homem**. Gatilhos obrigatórios para reativar shadow:

1. Implementação de **nova IA / novo modelo / novo provider** no sistema.
2. **Substituição** de um motor existente (ex: trocar Gemini Flash por outra família).
3. **Mudança de preço unitário** declarada pelo provedor em chave já ativa.

Em qualquer um desses casos, o procedimento padrão é:
1. Adicionar a chave nova/alterada em `tenant_credit_motor_config.shadow_service_keys` do Respeite o Homem.
2. Acumular pelo menos 10 eventos shadow com 0 erros e delta < 5%.
3. Promover live universalmente (não por tenant — diretamente em `service_pricing` como preço canônico confirmado).
4. Remover do shadow do Respeite o Homem.

Esse protocolo precisa ser lembrado a cada nova integração de IA/modelo — registrado também em `mem://features/platform/motor-creditos-shadow-laboratorio-permanente`.

## 10. Próximo passo imediato

1. **Bloco prioritário:** destravar os motores operacionais do Grupo 3 (NF-e, YouTube, Vídeo 4K) em produção real no Respeite o Homem. Isso é pré-requisito para o cutover live universal.
2. **Em paralelo (com GO do operador):** apresentar D2 (reprecificação), D3 (PTAX Bacen) e D4 (aposentar `tenant_ai_usage`) no formato canônico.
3. **Após Grupo 3 completo:** executar cutover — desligar shadow do Respeite o Homem (exceto modo laboratório), abrir cobrança real para os demais tenants.
