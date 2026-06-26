---
name: Cadastro como Fonte Única do Mercado Livre
description: Campos obrigatórios para ML vivem no cadastro do produto; ProductForm bloqueia salvar, ProductList tem filtro de incompletos, MeliListingWizard faz checagem silenciosa antes de publicar. IA nunca preenche marca/modelo/GTIN/peso/dimensões/categoria.
type: constraint
---

A função `checkMlReadiness` em `src/lib/marketplaces/mlReadiness.ts` é a **única fonte** de verdade de quais campos do cadastro do produto são obrigatórios para o Mercado Livre. Três pontos consomem essa função:

1. `ProductForm.tsx` — banner amarelo no topo + bloqueio em `handleSubmit` com toast destrutivo listando o que falta. Campo Modelo tem botão **"Genérico"** que preenche `products.model = "Genérico"` (literal exato, usado pelo `meli-publish-listing` como cascata válida).

2. `ProductList.tsx` — contador clicável **"N Incompletos para Mercado Livre"** que filtra apenas os pendentes.

3. `MeliListingWizard.tsx` — `handleSubmit` consulta o produto direto no banco e bloqueia publicação com toast + ação "Abrir cadastro" se algum campo voltou a ficar vazio. Roda **mesmo com o painel verde**, porque o lojista pode ter esvaziado o cadastro depois.

**Proibido:**
- Permitir IA preencher BRAND, MODEL, GTIN/EAN, dimensões, peso, categoria universal, conteúdo líquido — todos esses vêm do cadastro.
- Alterar a lista de campos obrigatórios sem atualizar `checkMlReadiness` + doc `mercado-livre.md` v3.8 + esta memória.
- Pular a checagem do wizard "porque o painel já está verde" — o cadastro pode ter mudado entre o resolve e o publish.
- Reprocessar Categorias/Títulos/Descrições no wizard ao clicar Voltar→Continuar: cada etapa só roda uma vez por abertura do diálogo (refs `categorizeDoneRef`/`titlesDoneRef`/`descriptionsDoneRef`, reset apenas no close). Regerar é exclusivamente via botões explícitos do painel.
- Trocar categoria de um anúncio (seletor manual ou "Aplicar a todos") **sempre zera `meli_listings.attributes`** quando o código da categoria realmente muda. ML define atributos por categoria — manter o cache antigo faria o painel mostrar campos errados. A invalidação roda em `handleCategoryChange` e `handleApplyCategoryToAll` (`MeliListingCreator.tsx`); na reabertura o painel chama o motor uma única vez para a nova categoria.

**Campos obrigatórios atuais (v3.8):** brand, gtin, model, weight, width, height, depth, universal_category_id, net_content_value+unit. Para `regulatory_regime = anvisa_cosmetic`, adicionar: dermatologically_tested, hypoallergenic, cruelty_free, vegan, has_fragrance.

Doc: `docs/especificacoes/marketplaces/mercado-livre.md` seção "Cadastro como Fonte Única do Mercado Livre (v3.8 — 2026-06-23)".
