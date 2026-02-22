

# Ofertas Inteligentes com IA - Gerador Automatico

## Objetivo
Criar um sistema que gera automaticamente regras de ofertas (Cross-sell, Order Bump, Upsell e Compre Junto) usando IA, baseado na composicao dos kits e catalogo de produtos. O lojista informa o desconto desejado e opcionalmente um prompt customizado.

## Estrategia da IA (sem dados de vendas)

Como nao ha historico de pedidos, a IA vai usar a **logica de composicao de kits** como fonte principal:

- **Compre Junto / Cross-sell:** Se o Shampoo Calvicie Zero faz parte do Kit Banho (Shampoo + Balm + Locao), ao comprar o Shampoo isolado, sugerir Balm e Locao para "completar o kit"
- **Order Bump:** Sugerir produtos complementares de menor valor no checkout (ex: Fast Upgrade junto com um kit de banho)
- **Upsell:** Na pagina de obrigado, sugerir upgrade para kit maior (ex: comprou 1x, sugerir 2x ou 3x)

Os dados enviados para a IA incluirao:
- Catalogo completo (nome, preco, SKU)
- Composicao dos kits (quais produtos formam cada kit)
- Regras existentes (para evitar duplicatas)

## UX no Admin

### Botao por aba de tipo de oferta
Em cada aba (Cross-sell, Order Bump, Upsell, Compre Junto), ao lado do botao "Nova Regra", sera adicionado um botao **"Criar com IA"** com icone de sparkles.

### Dialog de configuracao
Ao clicar, abre um dialog com:
1. **Tipo de desconto** (Percentual / Valor Fixo / Sem desconto) - obrigatorio
2. **Valor do desconto** - obrigatorio se tipo != "Sem desconto"
3. **Instrucoes adicionais** (textarea, opcional) - prompt livre para o lojista explicar a logica desejada
4. Botao "Gerar Sugestoes"

### Fluxo de aprovacao
1. A IA retorna uma lista de sugestoes com preview (produto gatilho -> produtos sugeridos)
2. O lojista pode marcar/desmarcar quais aceitar
3. Ao confirmar, as regras selecionadas sao inseridas na tabela correspondente (`offer_rules` ou `buy_together_rules`)

## Implementacao Tecnica

### 1. Edge Function: `ai-generate-offers`

**Entrada:**
```text
{
  type: "cross_sell" | "order_bump" | "upsell" | "buy_together",
  discount_type: "percent" | "fixed" | "none",
  discount_value: number,
  custom_prompt?: string,
  tenant_id: string
}
```

**Processamento:**
- Busca produtos ativos do tenant (nome, preco, SKU)
- Busca composicao dos kits via `product_components`
- Busca regras existentes para evitar duplicatas
- Envia para Lovable AI (Gemini Flash) com tool calling para retornar JSON estruturado
- Retorna lista de sugestoes

**Saida (via tool calling):**
```text
{
  suggestions: [
    {
      name: "Cross-sell Shampoo -> Balm + Locao",
      trigger_product_ids: ["id-shampoo"],
      suggested_product_ids: ["id-balm", "id-locao"],
      title: "Complete seu kit!",
      description: "Adicione o Balm e a Locao para o tratamento completo",
      reasoning: "Shampoo faz parte do Kit Banho junto com Balm e Locao"
    }
  ]
}
```

### 2. Componente: `AIOfferGeneratorDialog.tsx`
- Novo componente em `src/components/offers/`
- Dialog com formulario de desconto + prompt
- Exibe sugestoes da IA em cards com checkbox
- Botao para confirmar e criar as regras selecionadas

### 3. Integracao na pagina `Offers.tsx`
- Adicionar botao "Criar com IA" em cada aba de tipo de oferta
- Chamar o dialog passando o tipo da aba ativa

### Arquivos a criar/editar

| Arquivo | Acao |
|---------|------|
| `supabase/functions/ai-generate-offers/index.ts` | Criar - Edge function |
| `supabase/config.toml` | Editar - Adicionar config da function |
| `src/components/offers/AIOfferGeneratorDialog.tsx` | Criar - Dialog UI |
| `src/pages/Offers.tsx` | Editar - Adicionar botao "Criar com IA" |

### Modelo de IA
- **google/gemini-3-flash-preview** via Lovable AI Gateway
- Tool calling para output estruturado
- Sem streaming (resposta unica)

### Seguranca
- Edge function com `verify_jwt = true` (requer autenticacao)
- Validacao de tenant_id via auth
- Desconto e prompt validados no servidor

