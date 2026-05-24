---
name: AI Sales Pipeline — Anchor as State Override
description: Anchor (pain/family/catalog/kit) is a routing decision, not just a prompt block. Forces state to recommendation when there is real signal.
type: constraint
---

# Âncora vira override de estado (Frente 1 — plano de correção pós-Frentes B–E)

## Regra
A "Âncora do Turno" da pipeline de vendas (Frente E) **não pode mais ser apenas bloco de prompt**. Quando há sinal real, ela é DECISÃO de roteamento e força o estado da pipeline para `recommendation`.

## Quando força (estado `greeting` ou `discovery`, bucket de vendas)
1. Cliente declarou dor (qualquer dor mapeável para alguma família do tenant).
2. Pergunta direta de catálogo (`bucket = catalog_question`): "vocês têm shampoo?", "tem balm?", "qual o kit mais completo?".
3. Pergunta sobre produto/família com sinal claro (`bucket = product_question` + `mentioned_product_family|mentioned_product_name|mentions kit/combo`).
4. Menção a "kit/combo/conjunto/pacote/completo" em qualquer bucket de vendas, mesmo sem família em foco.
5. `family_focus` persistida e cliente segue em `discovery`.

## Quando NÃO força
- Reflexo determinístico já alterou o estado neste turno (não atropela).
- Estado já é avançado (`recommendation`, `product_detail`, `decision`, `checkout_assist`, `support`, `handoff`).
- Bucket é não-vendas/terminal: `post_sale`, `human_request`, `institutional`, `objection`, `hesitation`, `out_of_scope`, `social`.

## Por que
A muleta de discovery ("Me conta um pouco do que você precisa que eu já te indico") era caminho legítimo do estado quando a âncora era só prompt — o LLM seguia o estado, não a âncora. Promover a âncora a override mata esse caminho.

## Como aplicar
- Módulo `supabase/functions/_shared/sales-pipeline/anchor-state-override.ts`.
- Wired em `ai-support-chat/index.ts` entre bucket router e continuity gate.
- Log obrigatório: `[ANCHOR-OVERRIDE forcedState=… from=… reason=…]` (ou versão `skipped`).
- Onda 18 Fase A continua valendo dentro de cada família (base antes de kit) — não conflita com a Frente 1.
