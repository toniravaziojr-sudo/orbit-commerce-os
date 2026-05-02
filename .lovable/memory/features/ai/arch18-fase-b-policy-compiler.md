---
name: Onda 18 Fase B — Policy Compiler (EffectivePolicy + source_trace)
description: Compilador central que funde base (invariantes) + ai_support_config (tenant) + ai_channel_config (canal) em um único EffectivePolicy com source_trace por campo. ai-support-chat consome a policy como fonte central de persona/tom/limites/forbidden/use_emojis/system_prompt; invariantes da plataforma NÃO podem ser sobrescritos.
type: feature
---

## Regra (vinculante)

A partir da Fase B, o handler `ai-support-chat` DEVE compilar `EffectivePolicy` via `compileEffectivePolicy()` (em `_shared/sales-pipeline/policy-compiler.ts`) imediatamente após carregar `ai_support_config` e `ai_channel_config`, e DEVE consumir `effectivePolicy.*.value` para os seguintes campos no momento de montar o system prompt e gates de canal:

- `personality_name`, `personality_tone`, `greeting_style`
- `use_emojis`, `max_response_length`
- `system_prompt` (com fallback default no handler)
- `forbidden_topics`, `handoff_keywords`
- `custom_knowledge` (do tenant) e `custom_instructions` (do canal)
- `sales_mode_enabled`, `ai_model`, `rules`

Leituras diretas de `effectiveConfig.<campo>` ou `channelConfig.<campo>` para esses campos são PROIBIDAS no caminho principal — devem passar pela policy. `effectiveConfig` segue vivo apenas para campos técnicos não cobertos (RAG, handoff_on_no_evidence, metadata.arch18_*, redact_pii_in_logs, etc.).

## Precedência

`base` (invariantes, intocáveis) → `default` (fallback do compiler) → `tenant` (`ai_support_config`) → `channel` (`ai_channel_config`).

Channel SÓ pode sobrescrever: `system_prompt_override`, `forbidden_topics` (união), `max_response_length`, `use_emojis`, `custom_instructions`. NUNCA: identity (persona/tom), modelo, sales_mode, regras estruturadas, ou qualquer invariante.

## Invariantes da plataforma (camada `base`, freezada)

`tenant_isolation`, `cross_tenant_data_leak_forbidden`, `forbidden_pii_request_on_whatsapp`, `no_invented_actions`, `no_unverified_tool_assertions`, `no_real_world_side_effect_without_tool`, `no_catalog_override`, `no_shipping_override`, `no_checkout_override`. Essas regras vivem em `PLATFORM_INVARIANTS` (Object.freeze) e qualquer mudança exige nova fase + memória anti-regressão.

## Source trace

Cada campo do `EffectivePolicy` carrega `{ value, source }` com `source ∈ { base | tenant | channel | default }`. O handler loga `policySourceTrace(policy)` no início do turno para diagnóstico. Divergência entre policy e leitura legada (cálculo paralelo) é loggada como `[Onda18-B] policy_divergence ...` e serve como sinal de regressão.

## Fallback seguro

- Tenant sem `ai_channel_config` para o canal atual → todos os campos sobrescrevíveis recaem no tenant; `custom_instructions = null`. NÃO quebra.
- `max_response_length = 0` ou negativo no canal → ignorado, recai no tenant. Fail-safe explícito.
- `channelConfig` ausente OU sem `use_emojis` definido → mantém valor do tenant.

## Anti-regressão

- Bloco manual antigo de overrides (`if (channelConfig) { if (channelConfig.max_response_length) ... }`) foi REMOVIDO. Reintroduzir essa lógica fora do compiler é regressão.
- `custom_instructions` do canal estava sendo persistido no banco mas NUNCA chegava no prompt. A Fase B fechou esse gap. Remover a injeção desse bloco é regressão.
- Fase A continua intacta: `enforceFamilyBaseFirst`, `ai_turn_traces`, kill switch `arch18_catalog_base_forced`. NENHUM dos pontos da Fase B altera catálogo/frete/checkout.

## Testes

`_shared/sales-pipeline/__tests__/policy-compiler.test.ts` — 9 cenários (default, tenant-only, channel override, fallbacks, invariantes frozen, source_trace, união de forbidden). Qualquer mudança no compiler DEVE manter ou estender esses testes.

## Kill switch

A Fase B NÃO criou flag de rollout. Sob o novo contexto (piloto único = Respeite o Homem), o compiler ativa direto. Se for necessário desligar emergencialmente, a opção é reverter o commit do handler — o módulo `policy-compiler.ts` é função pura sem efeito colateral, então remover suas chamadas restaura o caminho legado.

## Fase B.1 — Saneamento (02/mai/2026)

### `ai_model` afeta roteamento real (não é informativo)
`effectivePolicy.ai_model.value` é consumido por `configuredModel` no handler e roteia a chamada do gateway (com normalização Gemini→GPT). Default do compiler é `"gpt-5.2"` — alinhado com o handler legado. Mudar esse default altera custo/latência silenciosamente para tenants sem `ai_model` configurado.

### Migrações B.1 (effectiveConfig → policy)
- `sales_mode_enabled` → `effectivePolicy.sales_mode_enabled.value` (reassign após compileEffectivePolicy).
- `rules` → `effectivePolicy.rules.value`.
- `handoff_keywords` → `effectivePolicy.handoff_keywords.value`.
- `system_prompt` no `buildPromptForState` → `effectivePolicy.system_prompt.value`.
- `channelConfig.custom_instructions` no `buildPromptForState` → `effectivePolicy.custom_instructions.value`.
- `ai_model` no roteamento de modelo → `effectivePolicy.ai_model.value`.

### Leituras residuais MANTIDAS (com motivo técnico)
- `effectiveConfig.is_enabled` — gate de circuit-breaker pré-policy (precisa rodar antes de compilar).
- `effectiveConfig.metadata?.arch18_catalog_base_forced` — kill switch técnico de Fase A; vive em metadata, não é política.
- `effectiveConfig.rag_top_k`, `rag_similarity_threshold`, `rag_min_evidence_chunks`, `handoff_on_no_evidence` — parâmetros técnicos do RAG, fora do escopo de política.
- `effectiveConfig.redact_pii_in_logs` — flag operacional de logging, não comportamento da IA.
- `effectiveConfig.max_response_length`/`use_emojis`/`forbidden_topics` no bloco `policy_divergence` — leitura LEGADA usada PROPOSITALMENTE para detectar divergência vs policy. Remover quando o log estabilizar (1 semana de produção limpa).

### Hierarquia de autoridade no prompt (POLICY_AUTHORITY_PREAMBLE)
Topo do system prompt SEMPRE inclui o preamble:
1. Invariantes da plataforma > qualquer instrução.
2. Resultado real de tools > texto livre (catálogo/preço/estoque/frete/checkout só via tool).
3. Instruções de tenant/canal são complementares e cedem se conflitarem com (1) ou (2).

Custom_instructions e system_prompt_override do canal continuam em blocos separados ABAIXO do preamble — nunca substituem nem precedem essas regras.
