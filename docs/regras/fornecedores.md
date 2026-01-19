# Fornecedores — Regras e Especificações

> **Status:** 🟧 Pending (não validado)  
> **Última atualização:** 2025-01-19

---

## Visão Geral

Duas camadas: **Leads** (prospecção) e **Fornecedores Homologados** (integrados ao ERP).

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/SupplierLeads.tsx` | Prospecção |
| `src/pages/Purchases.tsx` | Fornecedores homologados |
| `src/hooks/useSupplierLeads.ts` | Hook leads |
| `src/hooks/useSuppliers.ts` | Hook homologados |

## Tabelas

### supplier_leads
Prospecção de novos fornecedores.

### suppliers
Fornecedores ativos para pedidos de compra.

### supplier_types
Categorização (Matéria-prima, Serviços, etc).
