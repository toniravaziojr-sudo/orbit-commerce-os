
# Plano: Documentação de Lacunas — Anúncios Mercado Livre

## Contexto
A documentação atual (v2.1.0) cobre bem o fluxo de criação, publicação em massa e edição pré-publicação. Porém, existem 4 lacunas que precisam ser documentadas e implementadas.

---

## 1. Edição Pós-Publicação (Campos Editáveis)

### Situação Atual
- A action `update` na `meli-publish-listing` já envia: preço, estoque, imagens e descrição
- **NÃO envia título** na edição (falta no payload do `updateListing`)
- O frontend (`MeliListingWizard`) bloqueia edição para status `published`/`paused`

### O que documentar e implementar
- **Campos editáveis pós-publicação via API ML (PUT /items/{id}):**
  - ✅ Preço (`price`) — já implementado
  - ✅ Estoque (`available_quantity`) — já implementado
  - ✅ Imagens (`pictures`) — já implementado
  - ✅ Descrição (`plain_text` via endpoint separado) — já implementado
  - ❌ **Título (`title`) — FALTA adicionar ao payload do `updateListing`**
- **Campos NÃO editáveis pós-publicação (restrição ML):**
  - `category_id` (categoria é imutável após publicação)
  - `condition` (novo/usado é imutável)
  - `buying_mode`
- **UI:** Permitir edição no Wizard para anúncios `published`/`paused`, mas apenas dos campos permitidos pela API ML

### Ajustes necessários
1. Adicionar `title` ao payload de `updateListing` na edge function
2. Abrir o `MeliListingWizard` para status `published`/`paused` com campos restritos
3. Documentar quais campos são editáveis e quais são bloqueados

---

## 2. Variações (Multi-variação Completa)

### Situação Atual
- Zero suporte a variações — cada anúncio = 1 SKU fixo
- Tabela `meli_listings` não tem campo para variações

### O que documentar (para implementação futura)

**Modelo de dados:**
- Nova tabela `meli_listing_variations` (ou campo JSONB `variations` na `meli_listings`)
- Cada variação: `attribute_combinations` (ex: cor=Azul + tamanho=M), `price`, `available_quantity`, `picture_ids`, `seller_custom_field` (SKU)

**API ML para variações:**
- Criar com variações: incluir array `variations` no POST /items
- Cada variação referencia `picture_ids` (IDs das imagens do anúncio)
- `attribute_combinations`: array de `{ id: "COLOR", value_name: "Azul" }`

**Impacto cruzado:**
- Estoque: cada variação tem estoque próprio, soma = `available_quantity` do anúncio
- Pedidos: pedido ML indica `variation_id`, precisa mapear para SKU interno
- Imagens: variações referenciam imagens específicas do anúncio

**Fases sugeridas:**
- Fase 1: Modelo de dados + UI de criação de variações no Wizard
- Fase 2: Publicação com variações via API ML
- Fase 3: Sincronização de estoque por variação
- Fase 4: Mapeamento variação→SKU nos pedidos

---

## 3. Gestão de Imagens (Herdar + Customizar)

### Situação Atual
- `buildImagesList` já faz merge: imagens do anúncio + imagens do produto
- Não há UI para gerenciar imagens por anúncio (reordenar, adicionar, remover)
- Campo `images` (JSONB) existe na `meli_listings`

### O que documentar e implementar

**Comportamento padrão:**
- Na criação, herdar automaticamente todas as imagens do produto (até 10)
- Salvar no campo `images` da `meli_listings` como cópia editável

**Customização por anúncio:**
- UI no Wizard: galeria com drag-and-drop para reordenar
- Botão para adicionar imagens extras (upload ou URL)
- Botão para remover imagens específicas daquele anúncio
- Primeira imagem = imagem principal no ML

**Regras:**
- Mínimo 1 imagem para publicar (já validado)
- Máximo 10 imagens (limite ML, já aplicado no `buildImagesList`)
- Edição pós-publicação: PUT /items/{id} com `pictures` atualiza imagens

---

## 4. Multi-Anúncio com Diferenciação

### Situação Atual
- Sem restrição de unicidade (permite múltiplos anúncios por produto)
- Sem alerta ou validação de duplicata

### O que documentar e implementar

**Regra de diferenciação:**
- Ao criar anúncio para produto que já possui anúncio ativo (`published`/`paused`), exigir que **pelo menos título OU preço** sejam diferentes
- Validação no momento da aprovação/publicação (não bloqueia rascunho)
- Outros campos podem ser livremente editados

**UI:**
- Badge indicando "2 anúncios ativos" na lista de produtos/anúncios
- Alerta informativo (não bloqueante) ao criar: "Este produto já possui X anúncio(s) ativo(s)"
- Na lista de anúncios, agrupar visualmente anúncios do mesmo produto

---

## Resumo de Prioridades

| Item | Complexidade | Prioridade |
|------|-------------|-----------|
| Edição pós-publicação (título) | Baixa | Alta — fix simples na edge function |
| Gestão de imagens | Média | Alta — UX essencial |
| Multi-anúncio diferenciação | Baixa | Média — validação + UI |
| Variações completas | Alta | Futura — requer modelo de dados novo |
