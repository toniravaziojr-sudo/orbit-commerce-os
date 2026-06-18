---
name: Ads H.4.6 — Aprendizados por tema + feedback como direção (não literal)
description: Feedbacks de regeneração de copy/imagem são gravados em ads_ai_learnings com category oficial ("copy" / "criativo") e subtype no metadata. A UI de Aprendizados é organizada em 5 abas por tema (Copys, Criativos, Estratégias, Públicos, Configurações) com filtro de status secundário. O prompt de regeneração trata o feedback como DIREÇÃO criativa (interpretar) e retenta uma vez se a saída ecoar o feedback literal.
type: constraint
---

# Regra (Onda H.4.6 — 2026-06-18)

Substitui parcialmente H.4.5 nas partes de gravação de aprendizado e tratamento do feedback. As regras de briefing enriquecido e HARD_RULES seguem válidas.

## Gravação de aprendizado a partir de feedback inline
- `ads-creative-inline-generate` grava em `ads_ai_learnings` SEMPRE usando as categorias oficiais já aceitas pela UI:
  - feedback em copy de anúncio → `category = "copy"`
  - feedback em imagem de anúncio → `category = "criativo"`
- O `metadata.subtype` guarda o tipo original (`creative_copy_feedback` | `creative_image_feedback`).
- `source_type = "user_feedback"`; `status = "active"`; `confidence = 0.8`.
- A leitura de "aprendizados recentes" para enriquecer briefing usa `category = "copy"` (e não mais um valor fora do enum oficial).
- Proibido inventar novas categorias soltas fora da lista oficial (`produto, publico, orcamento, funil, criativo, copy, oferta, performance, restricao, tracking, outro`).

## UI de Aprendizados (`AdsAILearningsTab`)
Abas de nível principal por TEMA (não mais por status):
1. **Copys** — `copy`
2. **Criativos** — `criativo`, `produto`
3. **Estratégias** — `funil`, `oferta`, `performance`
4. **Públicos** — `publico`
5. **Configurações** — `orcamento`, `tracking`, `restricao`, `outro`

Cada aba tem:
- contador de itens não arquivados;
- filtro secundário por status (`Todos | Ativos | Sugeridos | Pausados | Arquivados`);
- "Novo aprendizado" abre já na categoria padrão da aba;
- ações de ativar/pausar/editar/arquivar/remover mantidas.

Edição mantém todas as categorias disponíveis no select (para permitir mover entre temas). Criação trava nas categorias da aba atual.

## Feedback como DIREÇÃO criativa, não texto pronto
Prompt do `regen_copy_field`:
- Declara explicitamente que o feedback é direção/inspiração, não texto pronto.
- Trechos entre aspas / "como" / "tipo" / "parecido com" / "no estilo de" são EXEMPLOS de tom e ângulo — proibido devolver como saída.
- A IA deve capturar a INTENÇÃO (ângulo, tom, foco, benefício) e gerar uma versão NOVA coerente com briefing/estágio.

Gate determinístico anti-eco:
- Após a primeira chamada, normaliza saída e feedback (lower, sem aspas, espaços colapsados).
- Considera "eco" se: saída == feedback; OU saída cabe inteira dentro do feedback (>=8 chars); OU saída == trecho entre aspas do feedback.
- Em caso de eco, refaz UMA vez com instrução adicional reforçando originalidade. Sem segundo retry — evita custo extra.

## Proibições
- Voltar a gravar aprendizados com `category` fora do enum oficial.
- Voltar a usar abas só por status na tela de Aprendizados.
- Reescrever o prompt do regen sem a instrução de "feedback é direção, não texto pronto".
- Remover o gate anti-eco.

## Implementação
- Edge: `supabase/functions/ads-creative-inline-generate/index.ts` (`recordLearning` mapeia subtype→category; `callAI` reutilizável; `echoesFeedback` + retry único).
- UI: `src/components/ads/AdsAILearningsTab.tsx` (THEMES, filtro secundário, criação travada na aba).
- Hook: `src/hooks/useAdsAILearnings.ts` (`source_type` aceita `"user_feedback"`).
