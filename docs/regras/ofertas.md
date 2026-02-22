# Aumentar Ticket (Ofertas) — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Visão Geral

Núcleo de estratégias para aumentar o ticket médio via ofertas inteligentes baseadas em regras de prioridade e condições de gatilho. Centraliza quatro tipos principais de ofertas que aparecem em diferentes pontos da jornada de compra.

---

## Tipos de Oferta (REGRA CRÍTICA DE LOCALIZAÇÃO)

| Tipo | Código | Local de Exibição | Componente Storefront |
|------|--------|-------------------|----------------------|
| **Cross-sell** | `cross_sell` | Carrinho | `CrossSellSection.tsx` |
| **Order Bump** | `order_bump` | Checkout (1-click) | `OrderBumpSection.tsx` |
| **Upsell** | `upsell` | Página de Obrigado | `UpsellSection.tsx` / `UpsellSlotBlock.tsx` |
| **Compre Junto** | N/A (tabela separada) | Página do Produto | `BuyTogetherSection.tsx` |

> **REGRA FIXA:** Cada tipo de oferta tem seu local específico. Não misturar.

---

## Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Página Admin** | `src/pages/Offers.tsx` | Gerenciamento de ofertas |
| **Conteúdo Ofertas** | `src/components/offers/OffersContent.tsx` | CRUD de regras |
| **Cross-sell** | `src/components/storefront/cart/CrossSellSection.tsx` | Exibição no carrinho |
| **Order Bump** | `src/components/storefront/checkout/OrderBumpSection.tsx` | Exibição no checkout |
| **Upsell** | `src/components/storefront/sections/UpsellSection.tsx` | Exibição pós-compra |
| **Upsell Builder** | `src/components/builder/blocks/slots/UpsellSlotBlock.tsx` | Bloco para o builder |
| **Cross-sell Builder** | `src/components/builder/blocks/slots/CrossSellSlotBlock.tsx` | Bloco para o builder |
| **Compre Junto** | `src/components/storefront/sections/BuyTogetherSection.tsx` | Exibição na página do produto |
| **Selos** | `src/components/offers/BadgesContent.tsx` | Gestão de badges |
| **Variações** | `src/components/offers/ProductVariantTypesContent.tsx` | Atributos globais |

---

## Banco de Dados: `offer_rules`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `tenant_id` | UUID (FK) | Tenant da regra |
| `name` | TEXT | Nome interno da regra |
| `type` | ENUM | `cross_sell`, `order_bump`, `upsell` |
| `is_active` | BOOLEAN | Liga/desliga a regra |
| `priority` | INTEGER | Ordem (menor número = processado primeiro) |
| `trigger_product_ids` | TEXT[] | Produtos gatilho (vazio = global) |
| `suggested_product_ids` | TEXT[] | Produtos oferecidos |
| `discount_type` | ENUM | `none`, `percent`, `fixed` |
| `discount_value` | NUMERIC | Valor do desconto |
| `min_order_value` | NUMERIC | Valor mínimo do carrinho para ativar |
| `customer_type` | ENUM | `all`, `new`, `returning` |
| `max_items` | INTEGER | Limite de produtos exibidos |
| `default_checked` | BOOLEAN | Pré-selecionado (Order Bump) |
| `title` | TEXT | Título exibido ao cliente |
| `description` | TEXT | Descrição da oferta |

---

## Banco de Dados: `buy_together_rules` (Compre Junto)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | Identificador único |
| `tenant_id` | UUID (FK) | Tenant da regra |
| `trigger_product_id` | UUID (FK) | Produto principal |
| `suggested_product_id` | UUID (FK) | Produto sugerido |
| `title` | TEXT | Título do combo |
| `discount_type` | ENUM | `none`, `percent`, `fixed` |
| `discount_value` | NUMERIC | Valor do desconto |
| `priority` | INTEGER | Ordem de exibição |
| `is_active` | BOOLEAN | Liga/desliga |

---

## Hooks

| Hook | Arquivo | Uso |
|------|---------|-----|
| `useOfferRules(type?)` | `src/hooks/useOfferRules.ts` | CRUD no admin (com tenant do auth) |
| `useActiveOfferRules(type, tenantSlug)` | `src/hooks/useOfferRules.ts` | Storefront público (apenas `is_active=true`) |

---

## Fluxo de Ativação

```
1. Admin cria regra de oferta em /offers
2. Define:
   - Tipo de oferta (determina local de exibição)
   - Produtos gatilho (se definidos, só ativa com esses produtos)
   - Valor mínimo do carrinho
   - Tipo de cliente (novo/recorrente)
3. Regra com maior prioridade (menor número) é exibida
4. Cliente aceita → desconto é calculado e aplicado
```

---

## Integração com Builder

| Contexto | Comportamento |
|----------|---------------|
| **Builder** (`isEditing=true`) | Exibe dados demo/skeleton se não há regras configuradas |
| **Storefront Público** | Só renderiza se houver regras reais ativas; caso contrário, `return null` |

---

## Mapeamento no Builder

| Página | Feature ID | Settings Key | Data Module |
|--------|------------|--------------|-------------|
| Carrinho | `cross-sell` | `showCrossSell` | `cross_sell_rules` |
| Checkout | `order-bump` | `showOrderBump` | `order_bump_rules` |
| Obrigado | `upsell` | `showUpsell` | `upsell_rules` |
| Produto | `buy-together` | `showBuyTogether` | `buy_together_rules` |

---

## Cálculo de Desconto

```typescript
function getDiscountedPrice(product: Product, rule: OfferRule): number {
  if (rule.discount_type === 'none') return product.price;
  if (rule.discount_type === 'percent') {
    return product.price * (1 - rule.discount_value / 100);
  }
  if (rule.discount_type === 'fixed') {
    return Math.max(0, product.price - rule.discount_value);
  }
  return product.price;
}
```

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Prioridade** | Menor número = maior prioridade (processado primeiro) |
| **Gatilho vazio** | Regra é global (aplica para qualquer produto) |
| **Produtos já no carrinho** | Cross-sell/Order Bump filtra produtos já adicionados |
| **Order Bump default_checked** | Se true, checkbox vem marcado por padrão |
| **max_items** | Limita quantidade de produtos sugeridos exibidos |

---

## Configuração via Toggles do Builder

| Página | Toggle | Default |
|--------|--------|---------|
| Carrinho | `showCrossSell` | true |
| Checkout | `showOrderBump` | true |
| Obrigado | `showUpsell` | true |
| Produto | `showBuyTogether` | true |

---

## Selos de Produto (Badges)

| Campo | Descrição |
|-------|-----------|
| **Nome** | Texto do selo (ex: "Mais Vendido", "Novo", "Promoção") |
| **Cor** | Cor de fundo do selo (HEX) |
| **Cor do texto** | Cor do texto do selo |
| **Produtos** | Produtos que recebem o selo |

---

## Gerador de Ofertas com IA

### Visão Geral
Sistema que gera automaticamente regras de ofertas usando IA, baseado na composição dos kits (`product_components`) e catálogo de produtos. O lojista informa o desconto desejado e opcionalmente um prompt customizado.

### Estratégia da IA (sem dados de vendas)
A IA usa a **lógica de composição de kits** como fonte principal:
- **Compre Junto / Cross-sell:** Completar o kit (ex: Shampoo → sugerir Balm + Loção do mesmo kit)
- **Order Bump:** Produtos complementares de menor valor no checkout
- **Upsell:** Upgrade para kit maior na página de obrigado

### Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Dialog IA** | `src/components/offers/AIOfferGeneratorDialog.tsx` | Formulário de desconto + prompt + preview de sugestões |
| **Edge Function** | `supabase/functions/ai-generate-offers/index.ts` | Busca dados, chama Lovable AI, retorna sugestões |

### UX no Admin
- Botão **"✨ Criar com IA"** ao lado de "Nova Regra" em cada aba de tipo de oferta
- Dialog com: tipo de desconto, valor, instruções adicionais (opcional)
- IA retorna sugestões → lojista seleciona quais aceitar → regras são criadas

### Edge Function: `ai-generate-offers`

**Entrada:**
```json
{
  "type": "cross_sell | order_bump | upsell | buy_together",
  "discount_type": "percent | fixed | none",
  "discount_value": 10,
  "custom_prompt": "(opcional)"
}
```

**Processamento:**
1. Busca produtos ativos do tenant (nome, preço, SKU)
2. Busca composição dos kits via `product_components`
3. Busca regras existentes para evitar duplicatas
4. Envia para Lovable AI (`google/gemini-3-flash-preview`) com tool calling
5. Retorna lista de sugestões estruturadas

**Saída (via tool calling):**
```json
{
  "suggestions": [{
    "name": "Cross-sell Shampoo -> Balm + Loção",
    "trigger_product_ids": ["id-shampoo"],
    "suggested_product_ids": ["id-balm", "id-locao"],
    "title": "Complete seu kit!",
    "description": "Adicione o Balm e a Loção para o tratamento completo",
    "reasoning": "Shampoo faz parte do Kit Banho junto com Balm e Loção"
  }]
}
```

### Modelo de IA
- **google/gemini-3-flash-preview** via Lovable AI Gateway
- Tool calling para output estruturado (sem streaming)
- `LOVABLE_API_KEY` auto-provisionado

---

## Arquivos Relacionados

| Se for editar... | Leia este doc primeiro |
|------------------|------------------------|
| `src/pages/Offers.tsx` | Este documento |
| `src/components/offers/*` | Este documento |
| `src/components/offers/AIOfferGeneratorDialog.tsx` | Este documento |
| `supabase/functions/ai-generate-offers/index.ts` | Este documento + `docs/regras/edge-functions.md` |
| `src/components/storefront/cart/CrossSellSection.tsx` | Este documento |
| `src/components/storefront/checkout/OrderBumpSection.tsx` | Este documento |
| `src/components/storefront/sections/UpsellSection.tsx` | Este documento |
| `src/components/storefront/sections/BuyTogetherSection.tsx` | Este documento |
| `src/components/builder/blocks/slots/*SlotBlock.tsx` | Este documento |
| `src/hooks/useOfferRules.ts` | Este documento |
