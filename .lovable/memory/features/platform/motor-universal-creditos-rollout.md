---
name: Motor Universal de Créditos — Rollout em Andamento
description: Status, padrão e próximos lotes da migração para o Motor Universal de Créditos (cobrança real por consumo)
type: feature
---

# Motor Universal de Créditos — Rollout

## Padrão técnico
- Helper postpaid: `supabase/functions/_shared/credits/charge-after.ts` (`chargeAfter`).
- Reserve+capture imediato, idempotente, com flag `motor_v2_enabled` por tenant via `isMotorEnabledForTenant`.
- Falhas de cobrança NUNCA bloqueiam a operação (apenas log). Tenant piloto: **respeite-o-homem**.
- Helper síncrono pré-pago (token-based ANTES da chamada): `_shared/credits/with-motor.ts` (`withCreditMotor`) — usado em `ai-generate-embedding` e `ai-product-description`.
- Painel admin: `/platform/external-costs` → aba **Economia por tenant** (RPC `admin_tenant_economics`).

## Service keys principais
- OpenAI chat: `openai.gpt-5.2.per_1m_tokens_in/out`, `openai.gpt-4o.per_1m_tokens_in/out`.
- Gemini: `gemini.gemini-2.5-flash.per_1m_tokens_in/out`.
- Imagens: `fal.gpt-image-1.5.per_image.{quality}_{size}`.
- Vídeo: `fal.kling-video.per_second.pro` | `fal.veo-3.1.per_second.standard.audio` | `fal.veo-3.1.per_second.fast.noaudio`.
- E-mail/WhatsApp/NFe/Whisper/Firecrawl: chaves dedicadas (já em produção).

## Lotes migrados (concluídos)
- **IA core:** `ai-generate-embedding`, `ai-product-description`, `generate-seo`, `ai-block-fill`, `ai-essential-pages`, `ai-landing-page-generate`.
- **Ads:** `ads-autopilot-strategist`, `ads-autopilot-guardian`.
- **Comunicação:** `send-system-email`, `email-send`, `meta-whatsapp-send` (template marketing/utility/auth), `ai-support-transcribe` (Whisper por minuto).
- **Fiscal:** `fiscal-emit` (só se autorizada), `fiscal-cancel`, `fiscal-cce`, `fiscal-inutilizar`, `fiscal-send-nfe-email`, `fiscal-check-status`, `fiscal-sync-focus-nfe`.
- **Scrape:** `firecrawl-scrape` (com `tenant_id` no body via `GuidedImportWizard`).
- **Lote 3:**
  - `ai-support-chat`: cobrança POR TURNO em tokens reais OpenAI (in+out separados, jobId `${newMessage.id}:in/out`).
  - `creative-video-generate`: cobrança por segundo pelo tier.
  - `ai-page-architect`: aceita `tenantId` no body e cobra Gemini Flash.

## Etapa A4 — Painel admin com margem líquida (2026-05-06, ENTREGUE)
- Nova tabela `public.tenant_infra_monthly_costs` (tenant, reference_month dia 1, cost_brl, source manual/estimated/imported, notes, created_by). RLS platform_admin only. UNIQUE (tenant_id, reference_month). Trigger valida dia 1 do mês.
- RPC `admin_tenant_economics` estendida com `infra_cost_brl`, `net_margin_brl`, `net_margin_pct` (proporcional ao período via interseção de meses). FX snapshot 5.5 alinhado a D5.
- `TenantEconomicsTab` agora exibe 6 cards (custo provedor / receita / margem bruta / custo infra / margem líquida / eventos) e 2 colunas novas na tabela.
- Seed inicial: Respeite o Homem mês 2026-05 com R$ 200,00 source `estimated`.
- Edição: por enquanto manual via SQL. UI inline de edição = pendência futura.

## Próximo lote (pendente — retomar daqui)
1. **`creative-image-generate`** — confirmar live v2 sem duplicidade (já tem live-v2 ativo via `live-v2.ts`); padronizar via `chargeAfter` se aplicável e remover hardcodes residuais.
2. **`ads-autopilot-creative-generate`** — cobrança por imagem/variação gerada (`fal.gpt-image-1.5.per_image.*`).
3. Demais funções de mídia: `media-generate-video`, `media-video-generate`, `creative-generate`, `creative-process`, `meta-ads-creatives`.

## Problemas conhecidos a auditar
- **`tenant_ai_usage` zerado para Respeite o Homem** mesmo com 305 turnos do agente IA nos últimos 30 dias. Provável regressão: `ai-support-chat` cobra via `chargeAfter` no `credit_ledger` mas não escreve mais em `tenant_ai_usage` (tabela legada). Decisão pendente: aposentar a tabela ou restaurar paridade. Sem ação até diagnóstico formal.

## Decisões pendentes do usuário
- Definir quais planos (Gratuito/Básico/Médio/Completo) terão acesso a quais features e quantos créditos bônus mensais cada um recebe.
- Compra de créditos extras = soma ao saldo atual do tenant (já confirmado conceitualmente).
- UI inline de edição de `tenant_infra_monthly_costs` na aba "Economia por tenant".
