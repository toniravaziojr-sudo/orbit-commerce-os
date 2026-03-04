

# Engine de Landing Pages V4.0 — Plano Final (3 correções aplicadas)

## Correções do ChatGPT incorporadas

1. **Nichos**: "APENAS para o nicho detectado" (sem número fixo, são 6 nichos definidos)
2. **Contrato UI → Backend**: enums explícitos para serialização
3. **Fallback de parse**: se JSON falhar → `parseError` + `hardCheckStatus: "warning"` + `needsReview: true`

---

## Etapas de Implementação

### Etapa 1: SQL Migration
```sql
ALTER TABLE ai_landing_pages ADD COLUMN briefing jsonb DEFAULT null;
```

### Etapa 2: Criar `supabase/functions/_shared/marketing/engine-plan.ts`
Módulo novo com:
- **`EnginePlanInput` interface** com todos os campos determinísticos
- **Template Registry** — 7 arquétipos com `requiredSections`, `optionalSections`, `preferredOrder`, `reorderRules`
- **`resolveEnginePlan()`** — decisões em TypeScript (niche, archetype, depth, visualWeight, proofStrength, defaultCTA, assumptions)
- **`runHardChecks()`** — validação pós-geração retornando `{ hardCheckStatus: "pass"|"warning"|"fail", needsReview: boolean, checks: [...] }`

### Etapa 3: Reescrever system prompt em `index.ts`
Prompt modular como executor (não decisor):
- Contexto Autoritativo (enginePlanInput como não negociável)
- Section Engine, Niche Rules (APENAS para o nicho detectado), Traffic Strategy, Visual Engine, Copy Engine, Anti-padrões, Quality Engine, Formato de Saída

### Etapa 4: Parser de resposta estruturada
Dois blocos fechados: ` ```json ` + ` ```html `
- **Se JSON não vier ou falhar no parse**: registrar `parseError` no metadata, definir `hardCheckStatus: "warning"`, definir `needsReview: true`. Tratar tudo como HTML para compatibilidade, mas NUNCA como sucesso normal.

### Etapa 5: Hard checks pós-geração
`runHardChecks()` valida H1, CTA, nome do produto, imagens, padrões proibidos, seções requeridas. Resultado salvo com `hardCheckStatus` e `needsReview`. V4.0 não bloqueia, mas registra.

### Etapa 6: Refatorar `fallback-prompts.ts`
Remover estrutura de seções (ESTRUTURA PERSUASIVA 1-10). Manter apenas tom/linguagem/ativos.

### Etapa 7: UI — Novo step "briefing" no `CreateLandingPageDialog.tsx`
Step entre `reference` e `prompt`. **Contrato de enums (UI exibe PT-BR, valor salvo em inglês)**:

| Campo | Enums |
|-------|-------|
| `objective` | `lead \| whatsapp \| sale \| checkout \| scheduling \| quiz \| signup \| download` |
| `trafficTemp` | `cold \| warm \| hot` |
| `trafficSource` | `meta \| google \| organic \| email \| remarketing \| direct` |
| `awarenessLevel` | `unaware \| pain_aware \| solution_aware \| product_aware \| ready` |
| `preferredCTA` | `whatsapp \| buy \| signup \| schedule \| download` (opcional) |
| `restrictions` | `no_countdown \| no_video \| no_comparisons` (checkboxes) |

### Etapa 8: Ajustar `ads-autopilot-strategist/index.ts`
Defaults conservadores com `assumedBySystem: true`.

### Etapa 9: Metadata expandido
`enginePlanInput`, `diagnostic`, `altHeadline`, `altCTA`, `engineVersion: "v4.0"`, `briefingSchemaVersion: "1.0"`, `hardCheckResults`.

### Etapa 10: Deploy e documentação

## Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| SQL Migration | `ADD COLUMN briefing jsonb` |
| `supabase/functions/_shared/marketing/engine-plan.ts` | **NOVO** |
| `supabase/functions/ai-landing-page-generate/index.ts` | Reescrita ~70% |
| `supabase/functions/_shared/marketing/fallback-prompts.ts` | Remover estrutura |
| `src/components/landing-pages/CreateLandingPageDialog.tsx` | Novo step briefing |
| `supabase/functions/ads-autopilot-strategist/index.ts` | Passar briefing |

## Fora de Escopo
- UI de variantes A/B (V4.1)
- Loop de aprendizado por métricas (V5.0)
- Score em tabela separada (V4.1)

