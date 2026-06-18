---
name: Ads H.4.5 — Briefing enriquecido + feedback visível na geração inline
description: A geração inline de copy/imagem do anúncio no wizard usa briefing enriquecido (produto real + funil/público do conjunto vinculado + voz da marca + aprendizados recentes) e proíbe explicitamente clichês e vocabulário de outro nicho. O feedback do lojista é sempre visível em cada campo e vira aprendizado registrado.
type: constraint
---

# Regra (Onda H.4.5 — 2026-06-18)

Substitui e complementa a H.4.4. A produção de copy e imagem na etapa "Anúncios" do `StructuredProposalModal` segue:

## Briefing enriquecido (obrigatório)
Antes de chamar a IA, `ads-creative-inline-generate` monta o briefing com:
- **Produto real do cadastro** (`products`: name, description, price, short_description) usando `product_id` do anúncio/planejado.
- **Conjunto vinculado** identificado por `ad.ad_set_ref` (match por nome) ou `ad.adset_index`, extraindo `funnel_stage`/`audience_type`/`target_audience`. Heurística `inferStageFromAdset` mapeia para `cold | warm | hot`.
- **Promessa/ângulo/formato** do `planned_creatives[idx]` e objetivo da `campaign`.
- **Voz da marca**: `tenant_brand_context` (brand_summary, tone_of_voice, approved_main_promise, banned_claims, do_not_do, allowed_claims) + `ai_support_config` (personality_tone, business_context, forbidden_topics).
- **Aprendizados recentes**: 3 últimos `ads_ai_learnings` ativos da categoria `creative_copy_feedback` do tenant.

## Regras duras no prompt (`HARD_RULES`)
1. Usar SEMPRE o produto descrito; proibido falar de outro nicho.
2. Proibido inventar desconto, promoção, frete grátis, garantia, prazo ou claim que não esteja no contexto.
3. Proibido clichês: "ofertas exclusivas", "qualidade e preço justo", "renove seu look/guarda-roupa", "tudo em um só lugar", "aproveite as ofertas", "compre o seu agora" (fora de BOF), "descubra ofertas exclusivas hoje".
4. Proibido claim de cura/resultado garantido/regulado sem evidência no contexto.
5. Copy DEVE encostar no produto/benefício real.
6. Respeitar o estágio do funil indicado.

## Diretrizes por estágio (`stageGuide`)
- **cold (TOF)**: dor/desejo/curiosidade; PROIBIDO "compre agora", "aproveite a oferta", menção a desconto/frete/prazo; CTA implícito de descoberta.
- **warm (MOF)**: prova, comparação, benefício específico; urgência leve sem inventar prazo/desconto.
- **hot (BOF/retarget)**: fechamento direto; oferta SÓ se explícita no contexto; CTA de compra permitido.

## Feedback visível (UI)
`AdCreativeAIPanel` e `AdImageAIControls`:
- Cada campo de copy (título, texto principal, descrição) e o bloco de imagem têm o textarea de feedback SEMPRE VISÍVEL — sem toggle.
- Botão "Regenerar com este feedback" desabilitado até 5 caracteres.
- Aviso curto: "Seu feedback vira aprendizado da IA desta loja."
- Backend (`regen_copy_field`/`regen_image`) já registra em `ads_ai_learnings` (categoria `creative_copy_feedback` ou `creative_image_feedback`) com metadata enriquecida (stage, product_name, before/after).

## Proibições
- Não voltar ao briefing minimalista (só nome do produto) — copy genérica é regressão.
- Não esconder o feedback atrás de toggle/botão "Regerar com IA" — feedback é parte do gesto, não opcional.
- Não introduzir clichês listados no `HARD_RULES` em prompts derivados.
- Não inferir estágio só pelo nome do conjunto sem cair na heurística de público (`audience_type`).

## Implementação
- Edge: `supabase/functions/ads-creative-inline-generate/index.ts` (`buildBriefing`, `formatBriefingForPrompt`, `stageGuide`, `inferStageFromAdset`, `pickLinkedAdset`, `HARD_RULES`).
- UI: `src/components/ads/AdCreativeAIPanel.tsx`.
- Memória anterior `ads-h44-inline-creative-generation.md` continua válida na parte de governança de etapa (geração dentro do step 4, etapa 5 publica, sem auto-enqueue).
