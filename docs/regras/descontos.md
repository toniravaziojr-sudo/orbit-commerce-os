# Descontos/Cupons — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Visão Geral

Sistema completo de gestão de cupons de desconto e promoções automáticas (primeira compra).

---

## Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Página Principal** | `src/pages/Discounts.tsx` | Listagem, filtros, ações de CRUD |
| **Formulário** | `src/components/discounts/DiscountFormDialog.tsx` | Criação e edição de cupons |
| **Hook de Dados** | `src/hooks/useDiscounts.ts` | CRUD + cálculo de uso via React Query |
| **Contexto Storefront** | `src/contexts/DiscountContext.tsx` | Estado global do cupom aplicado no checkout |

---

## Tabelas do Banco

| Tabela | Responsabilidade |
|--------|------------------|
| `discounts` | Configurações do cupom (código, tipo, valor, limites, escopo) |
| `discount_redemptions` | Registro de uso para controle de limites |
| `orders` | Armazena `discount_code`, `discount_name`, `discount_type`, `free_shipping` |

---

## Tipos de Desconto

| Tipo | Código | Descrição |
|------|--------|-----------|
| **Percentual no pedido** | `order_percent` | Desconto % sobre subtotal |
| **Valor fixo no pedido** | `order_fixed` | Desconto em R$ sobre subtotal |
| **Frete grátis** | `free_shipping` | Zera custo de frete |

---

## Escopo de Aplicação

| Escopo | Campo `applies_to` | Descrição |
|--------|-------------------|-----------|
| **Todos os produtos** | `all` | Cupom válido para qualquer produto |
| **Produtos específicos** | `specific_products` | Usa `product_ids[]` |
| **Categorias específicas** | `specific_categories` | Usa `category_ids[]` |

---

## Campos do Cupom

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `code` | TEXT | Código do cupom (case-insensitive) |
| `name` | TEXT | Nome interno do cupom |
| `type` | TEXT | `order_percent`, `order_fixed`, `free_shipping` |
| `value` | NUMERIC | Valor do desconto (% ou R$) |
| `min_subtotal` | NUMERIC | Subtotal mínimo para aplicar |
| `usage_limit_total` | INT | Limite total de usos |
| `usage_limit_per_customer` | INT | Limite por cliente |
| `starts_at` | TIMESTAMP | Início da validade |
| `ends_at` | TIMESTAMP | Fim da validade |
| `is_active` | BOOLEAN | Cupom ativo/inativo |
| `auto_apply_first_purchase` | BOOLEAN | Aplica automaticamente na primeira compra |
| `applies_to` | TEXT | Escopo: `all`, `specific_products`, `specific_categories` |
| `product_ids` | UUID[] | IDs dos produtos (quando escopo específico) |
| `category_ids` | UUID[] | IDs das categorias (quando escopo específico) |

---

## Edge Functions

| Function | Responsabilidade |
|----------|------------------|
| `discount-validate` | Valida cupom: existe, ativo, critérios atendidos |
| `check-first-purchase-eligibility` | Verifica elegibilidade para desconto automático de primeira compra |

---

## Fluxo de Validação

```
1. Cliente insere código no checkout ou carrinho suspenso (Edge)
2. Frontend chama discount-validate via Edge Function
3. Edge Function verifica:
   - Resolve tenant via hostname (com/sem www, slug, domínio customizado)
   - Cupom existe e está ativo
   - Está dentro do período de validade
   - Subtotal atende mínimo
   - Limite de uso não atingido
   - Escopo de produtos/categorias
4. Retorna desconto calculado ou erro
5. DiscountContext (SPA) ou localStorage (Edge) armazena cupom aplicado
6. Ao finalizar pedido, discount_redemptions registra uso
```

---

## Persistência do Cupom (Edge ↔ SPA)

| Aspecto | Detalhes |
|---------|----------|
| **Chave Edge** | `storefront_discount_{tenantSlug}` — formato interno do Edge runtime |
| **Chave SPA** | `coupon_{hostname_sem_www}` — formato do DiscountContext.tsx |
| **Sincronização** | Edge salva em AMBAS as chaves ao aplicar/remover, garantindo que o checkout SPA leia o cupom aplicado no carrinho Edge |
| **Restauração** | Edge tenta ler SPA key primeiro, depois Edge key (fallback) |
| **Remoção** | Botão × no carrinho suspenso remove de ambas as chaves |
| **Substituição** | Cliente pode remover cupom atual e aplicar outro |

---

## Resolução de Tenant no discount-validate

| Tentativa | Descrição |
|-----------|-----------|
| **1. Domínio exato** | Busca em `tenant_domains` com domain exato |
| **2. Sem www** | Remove `www.` do host e busca |
| **3. Com www** | Adiciona `www.` ao host e busca |
| **4. Slug da plataforma** | Extrai slug de `{slug}.shops.comandocentral.com.br` |

> **Bug corrigido (v8.6.3):** A busca usava `.eq("domain", store_host)` sem considerar variantes www/sem-www, causando "Loja não encontrada" quando `tenant_domains` tinha `www.` mas o browser enviava sem `www.`. Corrigido para usar `.in("domain", [host, hostWithoutWww, hostWithWww])`.

---

## UI do Cupom no Carrinho Suspenso (Edge)

| Elemento | Descrição |
|----------|-----------|
| **Campo de entrada** | `data-sf-cart-coupon-input` — input text com placeholder "Cupom de desconto" |
| **Botão Aplicar** | `data-sf-action="apply-coupon"` — valida e aplica |
| **Linha aplicada** | `data-sf-coupon-applied-row` — mostra código + descrição do desconto com ✓ |
| **Botão Remover** | `data-sf-action="remove-coupon"` — × vermelho remove o cupom |
| **Resultado** | `data-sf-cart-coupon-result` — mostra erros ou mensagens temporárias |
| **Comportamento** | Ao aplicar: oculta input, mostra linha aplicada. Ao remover: oculta linha, mostra input. |

---

## Primeira Compra (Auto-Apply)

| Regra | Descrição |
|-------|-----------|
| **Trigger** | `auto_apply_first_purchase = true` |
| **Verificação** | `check-first-purchase-eligibility` consulta se cliente tem pedidos anteriores |
| **Aplicação** | Cupom é aplicado automaticamente no checkout |
| **Limite** | 1 uso por cliente (por definição) |

---

## Status do Cupom (UI)

| Status | Condição |
|--------|----------|
| **Ativo** | `is_active = true` E dentro do período |
| **Agendado** | `is_active = true` E `starts_at` no futuro |
| **Expirado** | `ends_at` no passado |
| **Inativo** | `is_active = false` |

---

## Filtros da Listagem

| Filtro | Opções |
|--------|--------|
| **Busca** | Por código ou nome |
| **Status** | Todos, Ativo, Agendado, Expirado |

---

## Ações Disponíveis

| Ação | Descrição |
|------|-----------|
| **Criar** | Novo cupom via DiscountFormDialog |
| **Editar** | Alterar configurações do cupom |
| **Duplicar** | Copia cupom com novo código |
| **Ativar/Desativar** | Toggle de `is_active` |
| **Excluir** | Remove cupom (soft ou hard delete) |

---

## Integração com Comando Assistant

O assistente de IA pode criar cupons via tool `createDiscount` na edge function `command-assistant-execute`.

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Case-insensitive** | Código é comparado com `ilike` |
| **Tenant-scoped** | Cupons são isolados por tenant |
| **Uso registrado** | Toda aplicação gera registro em `discount_redemptions` |
| **Ordem de verificação** | Existência → Ativo → Período → Subtotal → Limite → Escopo |
