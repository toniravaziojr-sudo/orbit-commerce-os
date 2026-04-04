

# Plano: Ciclo de Vida de Exclusão de Produtos — Doc + Sistema + Correção AMAZGAN

## Contexto do problema

Hoje existem 3 falhas simultâneas no fluxo de exclusão de produtos:

1. **A Edge Function faz hard delete** (apaga o registro), mas 10+ módulos no sistema filtram por `deleted_at IS NULL` — ou seja, o sistema foi construído esperando soft delete
2. **O painel admin não filtra `deleted_at`**, então produtos "fantasma" aparecem como se estivessem ativos
3. **Os índices únicos de SKU e slug não consideram `deleted_at`**, então se um produto é excluído via soft delete por qualquer caminho, é impossível recadastrar com o mesmo SKU/slug

Resultado: os 7 kits da AMAZGAN estão marcados com `deleted_at` (por mecanismo desconhecido), invisíveis na loja, visíveis no admin, e bloqueando recadastro.

---

## Etapa 1 — Atualizar documentação (Layer 3)

**Arquivo:** `docs/especificacoes/ecommerce/produtos.md` — Seção 9 (Exclusão)

Reescrever a seção para documentar o modelo **Soft Delete universal**:

- Exclusão **sempre** marca `deleted_at = NOW()` — nunca apaga o registro
- Status muda para `archived`
- Dados relacionados (imagens, variantes, componentes, categorias) permanecem intactos
- Itens de pedido mantêm referência ao `product_id` original (sem marcar `[Excluído]`)
- Admin filtra `deleted_at IS NULL` em todas as listagens
- Storefront já filtra corretamente (sem mudança)
- Recadastro com mesmo SKU/slug é permitido graças a índices parciais
- Auditoria registra `soft_delete` em vez de `hard_delete`

---

## Etapa 2 — Aplicar no sistema

### 2.1 Migração SQL — Índices parciais

Substituir os 3 índices únicos atuais por versões que ignoram registros com `deleted_at`:

- `products_tenant_id_sku_key` → partial unique `WHERE deleted_at IS NULL`
- `products_tenant_id_slug_key` → partial unique `WHERE deleted_at IS NULL`
- `idx_products_slug_lower` → partial unique `WHERE deleted_at IS NULL`

Isso permite que dois registros com o mesmo SKU/slug coexistam desde que apenas um esteja ativo.

### 2.2 Edge Function `core-products` — ação `delete`

Substituir o bloco de hard delete (linhas ~440-550) por:

- `UPDATE products SET deleted_at = NOW(), status = 'archived' WHERE id = ? AND tenant_id = ?`
- **Remover** toda a cascata de deleção (imagens, variantes, componentes, categorias, cart_items, related_products, buy_together_rules)
- **Remover** a atualização de `order_items` que marca `[Excluído]`
- Registrar auditoria como `soft_delete`
- Emitir evento `product.deleted` normalmente

### 2.3 Hook `useProducts` — listagem do admin

Adicionar `.is('deleted_at', null)` na query principal (linha ~147), alinhando o admin com o comportamento da vitrine.

### 2.4 Componente `DeleteProductDialog`

Atualizar a mensagem de confirmação — remover referência a "excluir permanentemente" e trocar por "arquivar/desativar", já que o registro será preservado.

---

## Etapa 3 — Correção AMAZGAN

Após as etapas 1 e 2, executar uma verificação automática:

- Consultar os 7 produtos com `deleted_at` preenchido no tenant AMAZGAN
- Se o usuário confirmar que devem ser restaurados: limpar `deleted_at` e restaurar `status = 'active'`
- Se o usuário preferir mantê-los excluídos: nenhuma ação (o novo fluxo já os trata corretamente)

---

## Etapa 4 — Validação técnica

Antes da validação do usuário, executar:

1. **Banco:** Confirmar que os índices parciais estão criados e os antigos removidos
2. **Edge Function:** Chamar `core-products` com `action: delete` em um produto de teste e verificar que o registro permanece com `deleted_at` preenchido (não é apagado)
3. **Admin:** Verificar que a query do `useProducts` inclui o filtro `deleted_at IS NULL`
4. **Storefront:** Confirmar que as queries existentes continuam filtrando corretamente
5. **Recadastro:** Verificar que é possível criar um produto com o mesmo SKU de um produto excluído (soft deleted)
6. **AMAZGAN:** Consultar estado final dos 7 produtos

---

## Arquivos impactados

| Arquivo | Mudança |
|---------|---------|
| `docs/especificacoes/ecommerce/produtos.md` | Reescrita da Seção 9 |
| `supabase/functions/core-products/index.ts` | Ação `delete` → soft delete |
| `src/hooks/useProducts.ts` | Filtro `deleted_at IS NULL` |
| `src/components/products/DeleteProductDialog.tsx` | Texto atualizado |
| Migração SQL | Índices parciais |

