---
name: AI Provider Router Standard
description: Fluxos críticos de atendimento (TPR, composer e utilitários de IA) NÃO devem chamar Lovable AI Gateway diretamente como provider primário — devem usar _shared/ai-router.ts com hierarquia Gemini Native → OpenAI Native → Lovable Gateway (fallback final).
type: constraint
---

## Regra

Qualquer função edge que faça chat completion para um fluxo crítico
(atendimento real WhatsApp, classificação de turno, gates de venda,
geração de resposta) **DEVE** chamar `aiChatCompletion` /
`aiChatCompletionJSON` de `supabase/functions/_shared/ai-router.ts`,
nunca `fetch("https://ai.gateway.lovable.dev/...")` direto.

Hierarquia padrão (preferProvider="auto") gerenciada pelo router:
1. **Gemini Native** se `GEMINI_API_KEY` existe.
2. **OpenAI Native** se `OPENAI_API_KEY` existe.
3. **Lovable Gateway** se `LOVABLE_API_KEY` existe (fallback final).

Modelos lógicos (`google/...`, `openai/...`) são mapeados pelo router
para o modelo real do provider — ninguém deve hard-codear o nome real.

## Por quê

- Lovable Gateway é shared bucket por workspace Lovable (não por tenant).
  Um teste manual ou pico em qualquer tenant pode 429 o WhatsApp real
  dos outros.
- É um único ponto de falha. Se oscilar, atendimento cai mesmo com
  OpenAI/Gemini saudáveis.
- Migrar para providers nativos com fallback dá: rate limit
  independente, isolamento sandbox/produção (Fase 5) e resiliência
  multi-provider gratuita.

## Como aplicar

- Toda nova função edge que use IA deve importar `aiChatCompletionJSON`
  ou `aiChatCompletion` do `_shared/ai-router.ts`.
- Toda função antiga ainda no Gateway direto deve ser migrada nas
  Fases 2/3 do plano (`docs/especificacoes/ia/ai-provider-routing.md`).
- Toda função migrada deve ter rollback simples documentado (ex.: TPR
  usa `TPR_USE_LEGACY_GATEWAY=1`).
- Logar provider/modelo/latência/fallback em toda chamada.

## Hierarquia de credenciais (regra crítica)

`resolveAPIKeys` em `_shared/ai-router.ts` DEVE seguir a ordem:
**1) `platform_credentials` (banco) → 2) `Deno.env.get` (fallback condicional)**.
O fallback de env var só pode ser usado quando o banco não retornou
chave válida (`if (!key || !key.trim())`). Sobrescrever incondicionalmente
a chave do banco com `Deno.env.get(...) || null` é PROIBIDO — foi
exatamente esse bug que anulou a Fase 1 em 2026-05-03 e foi corrigido
em 2026-05-04 (smoke test confirmou `provider=gemini`).

## Fonte de verdade

- Doc formal: `docs/especificacoes/ia/ai-provider-routing.md`
  (seções 6.1 e 7).
- Código: `supabase/functions/_shared/ai-router.ts`,
  `supabase/functions/_shared/sales-pipeline/turn-pre-router.ts`.
- Status do plano: Fase 1 ✅ fechada em 2026-05-04 (Gemini Native real,
  validado em smoke test isolado).
