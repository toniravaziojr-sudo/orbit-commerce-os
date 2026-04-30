---
name: Sales Pipeline TPR and Output Gates (Reg #2.8)
description: Modo Vendas WhatsApp — TPR como fonte única de classificação de turno, Catalog Probe para "cegueira de família" e Output Gates determinísticos. Proibido voltar a depender só de regex de saída ou filtro estrito por família em turnos de "dor".
type: constraint
---

# Sales Pipeline TPR + Catalog Probe + Output Gates (Reg #2.8)

## Regras invioláveis

1. **Turn Pre-Router (TPR) é fonte única de classificação de turno**
   - Roda em paralelo ao bootstrap (após `productHintPromise`), com Gemini 2.5 Flash-Lite via Lovable AI Gateway, timeout 3.5s.
   - Devolve JSON estruturado: `should_broaden_catalog_for_pain`, `asked_about_price`, `greeting_period`, `is_pure_greeting`, `is_consultative_turn`, etc.
   - Em caso de falha (timeout/rate limit), cai em detector regex como rede — **nunca derruba o turno**.
   - Proibido criar novo gate/scrubber baseado em regex de saída quando o sinal já existe no TPR.

2. **Catalog Probe combate "cegueira de família"**
   - Quando `TPR.should_broaden_catalog_for_pain=true`, o handler de `search_products` IGNORA filtro estrito por família e devolve **1 representante por família** (Shampoo + Loção + **Balm** + Kit).
   - Proibido aplicar `family_focus` estrito em turnos de descoberta com sintoma/dor — só após o cliente focar num item (estado `product_detail`).

3. **Output Gates determinísticos pós-resposta**
   - **Price Scrubber:** sempre ativo. Remove `R$`, valor monetário, "frete grátis", parcelamento de qualquer resposta em `greeting`/`discovery`/`recommendation`, exceto se `TPR.asked_about_price=true`.
   - **Greeting Mirror Gate:** ativo quando `TPR.source='llm'`. Força espelhamento do período do dia do cliente (bom dia/boa tarde/boa noite).
   - Scrub legado regex segue como rede de segurança quando o TPR cair.

4. **Domínio do checkout (`storeUrl`) é estritamente verificado**
   - Prioridade absoluta: `tenant_domains` com `is_primary=true AND verified=true`.
   - Fallback `.shops` só se NÃO houver domínio primário verificado.
   - Logar `[Reg #2.8] storeUrl=… source=…` em todo envio para rastrear.

## Por quê

A análise da Reg #2.8 mostrou que defesas baseadas em regex de saída eram frágeis e o filtro estrito por família causava "cegueira": o agente recomendava só shampoo/loção e nunca o Balm. A arquitetura nova classifica intent ANTES da geração e aplica regras determinísticas DEPOIS, eliminando dependência de prompt obediente.

## Como aplicar

- Toda nova regra de comportamento de turno (preço, saudação, escopo de catálogo) deve **primeiro** virar campo no schema do TPR e **depois** virar gate determinístico — nunca prompt-only.
- Qualquer novo handler de tool de vendas deve ler `ctx.shouldBroadenForPain` antes de aplicar filtros restritivos.
- Logs obrigatórios: `[Reg #2.8] TPR source=… latency=…`, `[Reg #2.8] catalog probe families=…`, `[Reg #2.8] price scrub (…)`, `[Reg #2.8] greeting gate (…)`, `[Reg #2.8] storeUrl=… source=…`.

## Fonte de verdade

- Doc formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (Registro #2.8).
- Código:
  - `supabase/functions/_shared/sales-pipeline/turn-pre-router.ts`
  - `supabase/functions/_shared/sales-pipeline/catalog-probe.ts`
  - `supabase/functions/_shared/sales-pipeline/output-gates.ts`
  - `supabase/functions/ai-support-chat/index.ts` (orquestração)
