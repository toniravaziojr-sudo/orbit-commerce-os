---
name: Salvar fornecedor a partir da NF deve ser cadastro completo
description: "Salvar na base" do remetente dentro do Editor de NF-e deve persistir todos os dados disponíveis no destinatário, com inferência correta de contribuinte e código IBGE.
type: constraint
---

## Regra

O fluxo "Salvar na base" do Fornecedor/Remetente dentro do Editor de NF-e (NF de Entrada/Devolução/Remessa/Transferência) **deve** gravar em uma única ação todos os campos disponíveis no destinatário da NF:

- Nome / Razão Social, CNPJ ou CPF
- Inscrição Estadual + flag `ie_isento`
- Endereço completo: `cep`, `logradouro`, `numero`, `complemento`, `bairro`, `cidade`, `uf`, **`codigo_ibge`**
- `email` e `phone`
- `contributor_type` inferido a partir de `indicador_ie_dest` (1 → `contribuinte`, 2 → `contribuinte_isento`, 9 → `nao_contribuinte`). Sem indicador, presença de IE → `contribuinte`; ausência → `nao_contribuinte`.

A mesma regra vale para o caminho "Atualizar dados existentes" no diálogo de duplicidade — campos vazios da NF **não** sobrescrevem campos preenchidos no cadastro existente.

## Por quê

Em 2026-05-24 o salvamento estava gravando só nome + documento. Endereço, IE, IBGE, contato e tipo de contribuinte ficavam vazios. O lojista era obrigado a ir ao cadastro central depois para completar. Isso quebra a promessa documentada do módulo ("reuso de IE e endereço completo em emissões futuras") e gera fornecedor parcial em produção.

## Como aplicar

- O contrato `SupplierContact` em `src/components/suppliers/SupplierAutocomplete.tsx` precisa carregar `codigoIbge` e `indicadorIe` além dos campos de endereço/IE/contato.
- O `InvoiceEditor` deve passar `codigoIbge: data.dest_endereco_municipio_codigo` e `indicadorIe: data.indicador_ie_dest` no `value` do `SupplierAutocomplete` e refluir esses campos no `onChange`.
- `handleSaveToBase` e `handleUpdateExisting` devem aplicar a inferência de contribuinte e gravar o conjunto completo.
- Quando faltar endereço ou IE no momento do salvamento, exibir toast de aviso amarelo amigável — sem bloquear o fluxo.

Documentado em `docs/especificacoes/erp/fornecedores.md` (seção "Retificação 2026-05-24").
