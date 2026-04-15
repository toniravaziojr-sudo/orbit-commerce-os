---
name: Command Assistant v4.0.0 Schema Corrections
description: 16 correções de mapeamento de colunas em tools de escrita e 2 em leitura do Auxiliar de Comando, validadas contra schema real
type: feature
---

# Correções de Schema — Auxiliar de Comando v4.0.0

## Contexto
Auditoria completa (2026-04-15) revelou que 16 tools de escrita e 2 de leitura usavam colunas inexistentes no schema real do banco.

## Mapeamento de Correções (Escrita)

| Tool | Errado | Correto |
|------|--------|---------|
| bulkUpdateProductsNCM | `ncm_code` | `ncm` |
| bulkUpdateProductsCEST | `cest_code` | `cest` |
| deleteProducts | hard DELETE | soft-delete via `deleted_at` |
| createProduct/updateProduct | `ncm_code`, `cest_code` | `ncm`, `cest` |
| addOrderNote | `notes` | `internal_notes` |
| createManualOrder | `source` | `source_platform` |
| createCustomer/updateCustomer | `name` | `full_name` |
| createDiscount/updateDiscount | `usage_limit`, `value/100` | `usage_limit_total`, valor direto |
| createCampaign | desestruturação de `analytics` | campos diretos |
| approveReview | `is_approved` | `status = 'approved'` |
| replyToReview | coluna `response` | concatenar em `content` |
| createPage/updatePage | `content` | `html_content` |

## Mapeamento de Correções (Leitura)
- `listPotentialCustomers`: `total` → `total_estimated`
- `listProductVariants`: validação de UUID adicionada

## Regras Derivadas
1. Toda nova tool DEVE ser validada contra `types.ts` ou SQL real
2. Produtos usam soft-delete (`deleted_at`)
3. Valores em `discounts` são em reais, não centavos
4. Nunca presumir nomes de colunas por convenção
