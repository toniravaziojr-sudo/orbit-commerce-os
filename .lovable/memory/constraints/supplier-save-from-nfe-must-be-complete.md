---
name: Salvar fornecedor a partir da NF deve ser cadastro completo (padrão Cliente)
description: "Salvar na base" e "Atualizar cadastro" do Fornecedor/Remetente no Editor de NF-e seguem o padrão de enriquecimento de Clientes — NF é fonte mais recente, IE digitada vence o indicador, campo vazio nunca apaga.
type: constraint
---

## Regra

O fluxo "Salvar na base" / "Atualizar cadastro" do Fornecedor/Remetente dentro do Editor de NF-e (Entrada / Devolução / Remessa / Transferência) **deve** persistir, em uma única ação, todos os campos disponíveis no destinatário da NF, aplicando o **padrão de enriquecimento de Clientes** (memória `profile-enrichment-policy-standard`):

- **Documento e tipo de pessoa:** imutáveis após criação.
- **Campo não-vazio (após trim) na NF → sobrescreve** cadastro existente.
- **Campo vazio/whitespace → preserva** o que está no cadastro. Nunca apaga.
- **IE digitada vence o indicador IE.** Se o usuário escreveu uma IE no formulário, salva como `contribuinte` com aquela IE — independente do indicador estar em 2 (isento) ou 9 (não contribuinte).
- **Indicador 2 ou 9 só apaga IE/contribuinte existente** quando o cadastro já estava sem IE. Se já havia IE salva, preserva.
- **Auto-flip na UI:** quando o usuário digita IE válida (≥2 dígitos) e o indicador estava em 9, o seletor "Indicador IE Dest." promove automaticamente para 1.
- Campos persistidos: Nome/Razão Social, IE + `ie_isento`, endereço completo (CEP, logradouro, número, complemento, bairro, cidade, UF, **código IBGE**), e-mail, telefone, `contributor_type`.

## Por quê

Histórico:

- **2026-05-24:** salvamento gravava só nome + documento. Endereço, IE, IBGE, contato e contributor_type ficavam vazios.
- **2026-05-25 — Caso K LOGISTICA:** usuário digitou IE no formulário, mas o indicador IE padrão (9 = não contribuinte) forçou `ie = NULL` e `contributor_type = nao_contribuinte` no INSERT. A intenção mais recente do usuário (digitar a IE) era descartada por um valor default do seletor. Mesma regra também falhava em "Atualizar cadastro" quando o indicador caía em 2 ou 9.

A regra de Clientes (`enrich_customer_from_order`) já estabelecia que a fonte mais recente vence. Fornecedor passa a seguir o mesmo princípio para coerência sistêmica.

## Como aplicar

- `src/components/suppliers/SupplierAutocomplete.tsx`:
  - Helper `clean()` (trim+NULLIF) e `coalesce()` (campo novo não-vazio sobrescreve; vazio preserva).
  - Helper `resolveIeAndContributor()` — IE digitada vence o indicador.
  - `handleSaveToBase` e `handleUpdateExisting` usam os helpers.
- `src/components/fiscal/InvoiceEditor.tsx`: input de Inscrição Estadual (tanto no cartão unificado de Entrada quanto no cartão de saída) faz auto-flip do indicador IE de 9 → 1 quando o usuário digita IE com ≥2 dígitos.
- Doc: `docs/especificacoes/erp/fornecedores.md` § "Retificação 2026-05-25".
- Regra cruzada: `profile-enrichment-policy-standard` (padrão original em Clientes).
