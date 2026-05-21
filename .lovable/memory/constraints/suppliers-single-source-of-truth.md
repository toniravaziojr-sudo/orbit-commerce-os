---
name: Fornecedores é fonte única no ERP
description: Cadastro de fornecedores é único por tenant, compartilhado entre Compras, Fiscal e qualquer outro módulo. Documento (CPF/CNPJ) único por tenant.
type: constraint
---

## Regra
A tabela `public.suppliers` é a **única** base de fornecedores do tenant. Compras (`usePurchaseSuppliers`), Fiscal e qualquer módulo futuro consomem dela. **Proibido** criar tabela paralela de fornecedores ou duplicar cadastro em outro lugar.

Documento (CPF para PF, CNPJ para PJ, armazenado só em dígitos) é **único por tenant entre cadastros ativos** via índice `uq_suppliers_tenant_doc`. Soft delete (`deleted_at IS NOT NULL`) libera o documento para reuso.

Exclusão dura proibida na UI — apenas inativação (`deleted_at = NOW()` + `is_active = false`).

## Por quê
Garantir uma fonte de verdade evita: cadastros divergentes entre módulos, retrabalho do lojista, e inconsistência fiscal (mesmo fornecedor com IE diferente em duas notas). Reflete o padrão já adotado por Clientes para vendas.

## Como aplicar
- Sempre usar `useSuppliers` (`src/hooks/useSuppliers.ts`) como hook principal. `usePurchaseSuppliers` permanece como compat mas aponta para a mesma tabela.
- Antes de criar fornecedor via fluxo "Salvar na base" (NF de Entrada/Compra/Remessa/Devolução), chamar `findByDocument(documento, person_type)` e oferecer **Atualizar / Usar existente / Cancelar** se já existir.
- Toda nova UI que listar fornecedores deve filtrar `deleted_at IS NULL`.
- Doc formal: `docs/especificacoes/erp/fornecedores.md`.
