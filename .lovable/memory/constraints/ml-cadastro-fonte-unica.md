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
- `MeliAttributesPanel` faz self-healing silencioso (v2.6.0): rascunhos/anúncios com características salvas para a MESMA categoria são reaproveitados mesmo sem `resolver_version` e re-selados em segundo plano. Reabrir o Edit Dialog NÃO dispara IA automaticamente — recálculo só via botão explícito do painel. `MeliListingCreator.handleSaveAttributes` e `MeliListingWizard.handleSubmit` persistem o payload completo (name/source/status/required/resolver_version/values/not_applicable) para selar o cache.
- ANVISA do cadastro vai em um único atributo do ML. O atributo ANVISA não escolhido pela hierarquia do motor não aparece no painel, não vai para IA e não é enviado como N/A.
- Atributos de lista fechada de substâncias usam casamento determinístico por dicionário antes da IA. Se o motor estrutural mudar, incrementar a versão do cache do painel na mesma entrega.
- Adaptador de envio (`meli-publish-listing`) **nunca altera o cadastro**. Quando o cadastro não tem um número regulatório (AFE/CONAMA/ANVISA), o adaptador omite o atributo do payload — independentemente do que veio da memória do tenant, do painel ou da IA. Cadastro vazio = atributo omitido (v2.4.3).
- Quando a categoria do ML expõe `UNITS_PER_PACK` e o atributo não está no payload final, o adaptador injeta o valor do cadastro com piso 1 (avulso) ou a quantidade do kit (v2.4.3). Sem essa garantia o ML rejeita venda avulsa.
- Garantia é fonte única do cadastro (v2.6.0): `meli-publish-listing` em publish e update REMOVE qualquer `WARRANTY_TYPE`/`WARRANTY_TIME` herdado do painel/IA/memória e reinjeta a partir de `products.warranty_type`/`warranty_duration`. Cadastro `none`/vazio = ambos omitidos (ML mostra "Sem garantia" por default). `WARRANTY_TIME` é free-form no sanitizador de update.
- Edit síncrono robusto (v2.6.0): o handler `updateListing` usa `humanizeMeliError` e persiste `error_message` em `meli_listings.meli_response` quando o PUT items/{id} falha. O sanitizador de update suporta `values[]` cruzando contra a lista oficial da categoria.
 - Núcleo do sistema (Produtos/Clientes/Pedidos) é intocável por iniciativa da IA — ver Regras do Sistema seção 3.2.1. Periférico se adapta ao core, nunca o contrário.
 - Frete Grátis ML: piso fixo `MELI_FREE_SHIPPING_THRESHOLD_BRL = 79` em `src/lib/marketplaces/meliFreeShipping.ts` e `supabase/functions/_shared/meli/freeShipping.ts`. `MeliListingCreator` Step 9 controla frete grátis **por anúncio** (v2.5.1): itens com `preço ≥ 79` ficam travados em ON com badge "Obrigatório pelo Mercado Livre"; itens abaixo são editáveis; ações em massa "Ativar/Desativar frete grátis em todos" afetam apenas os elegíveis. `meli_listings.shipping.free_shipping` é persistido por listing a cada toggle/ação em massa. `MeliListingWizard` mantém toggle único bloqueado acima do piso. `meli-publish-listing` força `shipping.free_shipping=true` quando `price ≥ piso` (defesa em profundidade) e persiste o `shipping` real devolvido pelo ML. Sync/webhook detectam divergência passivamente (sem cron novo).

**Campos obrigatórios atuais (v3.8):** brand, gtin, model, weight, width, height, depth, universal_category_id, net_content_value+unit. Para `regulatory_regime = anvisa_cosmetic`, adicionar: dermatologically_tested, hypoallergenic, cruelty_free, vegan, has_fragrance.

Doc: `docs/especificacoes/marketplaces/mercado-livre.md` seção "Cadastro como Fonte Única do Mercado Livre (v3.8 — 2026-06-23)".
