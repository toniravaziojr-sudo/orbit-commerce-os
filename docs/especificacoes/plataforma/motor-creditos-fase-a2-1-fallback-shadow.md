# Motor de Créditos — Fase A2.1: Fallback Shadow IA Imagem

**Status:** 🟡 Implementada — gate desligado para todos os tenants (a ativar em prompt separado)
**Versão:** `0.1.0`
**Data:** 2026-05-06
**Pré-requisito:** [Fase A2 — Reserva Sombra](./motor-creditos-fase-a2-reserva-sombra.md) validada
**Relacionada:** [Fase A1 — Pré-Router Sidecar](./motor-creditos-fase-a1-pre-router-sidecar.md), [Fase 3B — Shadow](./motor-creditos-fase-3b-shadow.md)

## 1. Objetivo

Cobrir o **gap conhecido** da Fase A2: jobs de IA Imagem cujo vencedor real é **Gemini / OpenAI / Lovable** (ou qualquer Fal sem pricing) não emitiam evento algum em `service_usage_events`, ficando **invisíveis** ao motor.

A2.1 registra um **evento shadow separado** para esses casos, **sem pricing numérico** e **sem qualquer mutação financeira**, apenas para observabilidade administrativa e preparação da Fase A3 Fal-only.

## 2. Princípios

- **status='shadow'** — não cria status novo. Reaproveita a constraint existente (`service_usage_events_status_check`).
- **cost_owner='platform'** + **tenant_id** real — permitido por `chk_sue_owner_tenant`.
- **service_key** placeholder textual `fallback.<provider>.<model_slug>.unpriced` — não há FK para `service_pricing`.
- **Zero numerismo financeiro** — sem `cost_usd_snap`, `sell_usd_snap`, `credits`, `shadow_reserve/capture/release`.
- **Zero mutação** — wallet, `credit_ledger`, `service_pricing`, `tenant_credit_motor_config` jamais tocados em runtime.
- **Não substitui A2** — A2 (Fal `medium_1024` com pricing) continua emitindo o evento normal.

## 3. Auditoria de constraints

Confirmada antes da implementação:

| Constraint | Resultado |
|---|---|
| `service_usage_events_status_check` | `shadow` permitido ✅ |
| `chk_sue_owner_tenant` | `cost_owner='platform' AND tenant_id NOT NULL AND status='shadow'` permitido ✅ |
| `chk_sue_ledger_owner` | `platform` exige `credit_ledger_id IS NULL` ✅ (zero risco) |
| FK em `service_key` | **Inexistente** — placeholder livre ✅ |
| `service_key` NOT NULL | Placeholder textual obrigatório ✅ |

## 4. Gate

```
tenant_credit_motor_config.metadata.fallback_shadow_enabled = true
tenant_credit_motor_config.metadata.fallback_shadow_version = '0.1.0'
```

Helper: `isFallbackShadowEnabled(meta)` em `supabase/functions/_shared/credits/fallback-shadow.ts`.
Retorna `true` **só** com as duas chaves corretas.

**Estado atual:** gate **desligado para todos os tenants**. Ativação será feita em prompt separado para o tenant Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`) após validação da implementação.

## 5. Funções (módulo `_shared/credits/fallback-shadow.ts`)

| Função | Tipo | Responsabilidade |
|---|---|---|
| `isFallbackShadowEnabled(meta)` | pura | Avalia gate |
| `normalizeProviderForFallback(raw)` | pura | gemini/google/nano-banana → `gemini`; openai/gpt-image/dall → `openai`; lovable → `lovable`; fal* → `fal` |
| `slugifyModelForFallback(model)` | pura | `[a-z0-9.-]`, fallback `unknown-model` |
| `resolveFallbackServiceKey(provider, model)` | pura | `fallback.<provider>.<slug>.unpriced` |
| `buildFallbackShadowMetadata(input)` | pura | Monta payload `metadata` (sem numerismo) |
| `recordFallbackShadowEvent(supabase, args)` | I/O | INSERT em `service_usage_events` |

## 6. Contrato do evento

```sql
INSERT INTO service_usage_events (
  tenant_id, cost_owner, service_key, category, provider,
  units_json, status, origin_function, metadata
) VALUES (
  <tenant_id>,
  'platform',
  'fallback.gemini.gemini-2.5-flash-image.unpriced',  -- exemplo
  'ai_image',
  'gemini',
  '{"images": 1}'::jsonb,
  'shadow',
  'creative-image-generate',
  <metadata>
);
```

`credit_ledger_id`, `reservation_ledger_id`, `platform_cost_ledger_id` permanecem NULL.

### 6.1 metadata (campos obrigatórios)

```json
{
  "motor_version": "v2",
  "mode": "shadow",
  "is_fallback_event": true,
  "fallback_shadow_version": "0.1.0",
  "pricing_status": "missing",
  "unpriced": true,
  "no_billing": true,
  "no_wallet_mutation": true,
  "no_ledger_mutation": true,
  "absorbed_by_platform": true,
  "is_internal_shadow": true,
  "creative_job_id": "<uuid>",
  "variation_index": 1,
  "predicted_provider": "fal",
  "predicted_model": "fal-ai/gpt-image-1/edit-image",
  "predicted_service_key": "fal.gpt-image-1.5.per_image.medium_1024",
  "actual_provider": "gemini",
  "actual_model": "gemini-2.5-flash-image",
  "actual_service_key": null,
  "winner_provider": "gemini",
  "winner_model": "gemini-2.5-flash-image",
  "fallback_reason": "winner_not_fal",
  "providers_requested": ["openai", "gemini"],
  "enable_fallback": true,
  "pricing_missing_reason": "no_service_pricing_row_for_model",
  "live_behavior": "block_without_pricing",
  "admin_visibility": true
}
```

**Não pode conter:** `cost_usd_snap`, `sell_usd_snap`, `credits`, `shadow_reserve`, `shadow_capture`, `shadow_release`.

## 7. Quando dispara (regra do edge `creative-image-generate`)

Após `recordImageShadowV2` (por variação), se `motorGates.fallbackShadowEnabled === true`:

1. Normaliza `result.actualProvider`.
2. **Cobertura A2** = (existe `shadowReservationMeta`) **E** (provider normalizado = `fal`).
3. Se **NÃO coberta por A2**, chama `recordFallbackShadowEvent` com:
   - `fallback_reason='winner_not_fal'` se provider ≠ fal
   - `fallback_reason='fal_without_pricing_match'` se provider = fal mas A2 não emitiu
   - `fallback_reason='winner_outside_a2_scope'` se A2 emitiu mas provider real divergiu

Falhas no INSERT são engolidas com `console.warn` estruturado — **nunca quebram a geração**.

## 8. Convivência A2 ↔ A2.1

| Aspecto | A2 | A2.1 |
|---|---|---|
| Quando | Vencedor = Fal `medium_1024` com pricing | Vencedor fora de cobertura A2 |
| service_key | `fal.gpt-image-1.5.per_image.medium_1024` | `fallback.<p>.<m>.unpriced` |
| Pricing snapshot | Sim | Não |
| Wallet/ledger | Intocados | Intocados |
| Substitui A2? | — | **Não** |

## 9. Comportamento futuro em A3 Fal-only (regra de design — não implementada)

1. Pré-router prevê Fal `medium_1024` → reserve real.
2. Sucesso → capture.
3. Fal falha → release + erro amigável. **Não tenta** Gemini/OpenAI/Lovable em live.
4. Pipeline tentaria fallback sem pricing → **bloqueio em live** (`live_behavior='block_without_pricing'`) + evento A2.1.

Mensagem conceitual ao usuário: *"Não foi possível gerar a imagem no momento porque o provedor principal está indisponível. Tente novamente em alguns instantes."*

## 10. Visibilidade admin

Filtro: `WHERE metadata->>'is_fallback_event' = 'true'`.

Painel futuro (estensão de `/platform/external-costs`): aba **"Fallbacks IA não precificados"** com total/provider/modelo/tenant/job_id/`fallback_reason`/ação recomendada (`Cadastrar pricing` ou `Manter bloqueado`).

## 11. Critérios de saída A2.1

- ≥3 eventos reais de fallback shadow OU 1 evento real + testes técnicos cobrindo Gemini/OpenAI/Lovable
- 100% `cost_owner='platform'`, `pricing_status='missing'`, `unpriced=true`
- 100% sem mutação em `tenant_credit_wallets` / `credit_ledger`
- 0 eventos com `sell_usd_snap`/`credits`
- 0 visibilidade ao tenant
- A2 (Fal `medium_1024`) continua emitindo evento normal — regressão zero

## 12. Testes (`fallback-shadow_test.ts`)

8 testes cobrindo: gate, normalização de provider, slug, resolveFallbackServiceKey (prefixo/sufixo), invariantes do metadata (sem cost/sell/credits), insert ok via mock e tolerância a falha. Todos passando junto com os 11 testes da A2 (19/19).

## 13. Riscos

| Risco | Mitigação |
|---|---|
| Confundir placeholder com service_key real | Prefixo reservado `fallback.`; nunca incluir em `live_service_keys`/`shadow_service_keys` |
| Volume inflar tabela | Filtros admin por `is_fallback_event`; índice futuro se necessário |
| Gate ligado por engano sem versão | Helper exige **as duas** chaves corretas |
| Insert falha e quebra job | try/catch interno e externo, log warn estruturado |

## 14. Próximos passos

1. **Próximo prompt (EXECUÇÃO):** ativar gate apenas para Respeite o Homem + 1 geração real para validar evento + auditar invariantes.
2. **Médio prazo:** estender painel admin de custos com aba de fallbacks não precificados.
3. **Longo prazo:** se decisão de produto for permitir fallback live, cadastrar pricing oficial Gemini/OpenAI/Lovable e promover a `live_service_keys`.
