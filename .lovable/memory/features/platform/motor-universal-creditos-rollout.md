---
name: Motor Universal de Créditos — Rollout em Andamento
description: Status, padrão e próximos lotes da migração para o Motor Universal de Créditos (cobrança real por consumo)
type: feature
---

# Motor Universal de Créditos — Rollout

## Padrão técnico
- Helper postpaid: `supabase/functions/_shared/credits/charge-after.ts` (`chargeAfter`).
- Reserve+capture imediato, idempotente, com flag `motor_v2_enabled` por tenant via `isMotorEnabledForTenant`.
- **F1 (2026-05-07):** `chargeAfter` agora também grava `service_usage_events` status='captured', cost_owner='tenant', com `credit_ledger_id` preenchido. Idempotência garantida por UNIQUE parcial `uq_sue_credit_ledger_id`. Falhas de telemetria NUNCA quebram a cobrança.
- Falhas de cobrança NUNCA bloqueiam a operação (apenas log). Tenant piloto: **respeite-o-homem**.
- Helper síncrono pré-pago (token-based ANTES da chamada): `_shared/credits/with-motor.ts` (`withCreditMotor`) — usado em `ai-generate-embedding` e `ai-product-description`.
- Helper de **shadow para mídia (Fase 3C)**: `_shared/credits/media-shadow-event.ts` + resolver puro `_shared/credits/media-service-key-resolver.ts`. Padrão idêntico ao `creative-image-generate` (Fase 3B): cost_owner='platform', status='shadow', gate por `shadow_service_keys`, idempotência determinística, NUNCA toca wallet/ledger.
- Painel admin: `/platform/external-costs` → aba **Economia por tenant** (RPC `admin_tenant_economics`).

## Service keys principais
- OpenAI chat: `openai.gpt-5.2.per_1m_tokens_in/out`, `openai.gpt-4o.per_1m_tokens_in/out`.
- Gemini: `gemini.gemini-2.5-flash.per_1m_tokens_in/out`.
- Imagens: `fal.gpt-image-1.5.per_image.{quality}_{size}`.
- Vídeo: `fal.kling-video.per_second.pro` | `fal.kling-avatar-v2-pro.per_second` | `fal.veo-3.1.per_second.{fast|standard|4k.standard}.{audio|noaudio}`.
- E-mail/WhatsApp/NFe/Whisper/Firecrawl: chaves dedicadas (já em produção).

## Lotes migrados (concluídos)
- **IA core:** `ai-generate-embedding`, `ai-product-description`, `generate-seo`, `ai-block-fill`, `ai-essential-pages`, `ai-landing-page-generate`.
- **Ads:** `ads-autopilot-strategist`, `ads-autopilot-guardian`.
- **Comunicação:** `send-system-email`, `email-send`, `meta-whatsapp-send` (template marketing/utility/auth), `ai-support-transcribe` (Whisper por minuto).
- **Fiscal:** `fiscal-emit` (só se autorizada), `fiscal-cancel`, `fiscal-cce`, `fiscal-inutilizar`, `fiscal-send-nfe-email`, `fiscal-check-status`, `fiscal-sync-focus-nfe`.
- **Scrape:** `firecrawl-scrape` (com `tenant_id` no body via `GuidedImportWizard`).
- **Lote 3:** `ai-support-chat` (turno OpenAI in/out), `creative-video-generate` (segundo por tier), `ai-page-architect` (Gemini Flash).

## Etapa A4 — Painel admin com margem líquida (2026-05-06, ENTREGUE)
- Tabela `tenant_infra_monthly_costs` + RPC `admin_tenant_economics` com margem líquida.
- `TenantEconomicsTab`: 6 cards + colunas custo infra / margem líquida.

## Fase 3C — Shadow IA Vídeo (2026-05-07, EM ROLLOUT SHADOW)
- Edges plugadas: `creative-process` (path async, `pollJobInBackground` em `kling-i2v-pro`).
- Resolver canônico `_shared/credits/media-service-key-resolver.ts` traduz `model_id` interno (kling-i2v-pro, kling-avatar*, veo31-text-video, gpt-image-bg) → `service_key` canônica + `units_json`.
- Modelos sem pricing canônico (`pixverse-*`, `f5-tts`, `sync-lipsync`, `kling-avatar-mascot-std`) retornam `null` → skip controlado com log estruturado.
- Tenant piloto recebeu em `shadow_service_keys`: `fal.kling-video.per_second.pro`, `fal.kling-avatar-v2-pro.per_second`, `fal.veo-3.1.per_second.{fast|standard}.{audio|noaudio}`.
- **Fora desta fase:** `ads-autopilot-creative-generate` (delega para `creative-image-generate` — herda shadow), `meta-ads-creatives` (não gera mídia), `media-generate-video` (apenas enfileira; geração real cai no `creative-process`).
- **Promoção live:** só após janela de 7 dias com ≥10 eventos shadow por chave e 0 erros (mesma régua da Fase 3).

## Próximo lote
1. Validar shadow de vídeo no piloto após primeira execução real de `product_video`/`ugc_ai_video`.
2. Auditar `tenant_ai_usage` zerado para Respeite o Homem (`ai-support-chat`).
3. Avaliar promoção live após janela.

## Problemas conhecidos a auditar
- **`tenant_ai_usage` zerado para Respeite o Homem** mesmo com 305 turnos — `ai-support-chat` cobra via `chargeAfter` no `credit_ledger` mas não escreve em `tenant_ai_usage` (tabela legada). Decisão pendente: aposentar tabela ou restaurar paridade.

## Decisões pendentes do usuário
- Definir planos × features × créditos bônus mensais.
- UI inline de edição de `tenant_infra_monthly_costs`.
