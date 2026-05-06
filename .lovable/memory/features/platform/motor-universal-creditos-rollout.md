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
- **Lote 3 (último entregue):**
  - `ai-support-chat`: cobrança POR TURNO em tokens reais OpenAI (in+out separados, jobId `${newMessage.id}:in/out`).
  - `creative-video-generate`: cobrança por segundo pelo tier (`tier=premium`→kling pro, `audio_native`→veo audio, default→veo fast noaudio).
  - `ai-page-architect`: aceita `tenantId` no body e cobra Gemini Flash; callers atualizados (`src/pages/Pages.tsx`, `src/components/builder/HomeStructureDialog.tsx`).

## Próximo lote (pendente — retomar daqui)
1. **`creative-image-generate`** — já tem motor v2 LIVE validado (A3.3, ledger v2 ativo via `live-v2.ts`); migrar para o padrão `chargeAfter` se aplicável e remover hardcodes residuais.
2. **`ads-autopilot-creative-generate`** — cobrança por imagem/variação gerada.
3. Demais funções de mídia: `media-generate-video`, `media-video-generate`, `creative-generate`, `creative-process`, `meta-ads-creatives`.

## Decisões pendentes do usuário
- Definir quais planos (Gratuito/Básico/Médio/Completo) terão acesso a quais features e quantos créditos bônus mensais cada um recebe.
- Compra de créditos extras = soma ao saldo atual do tenant (já confirmado conceitualmente).
