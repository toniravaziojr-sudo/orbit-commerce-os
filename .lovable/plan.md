

# Plano: Documentação dos Campos Fiscais + Refatoração do Layout da NF-e

## Situação Atual

O sistema já possui todos os dados obrigatórios com coleta garantida (GTIN no produto, Origem Fiscal nas configurações, CPF/endereço no checkout). Porém:

1. **A documentação não reflete** os novos campos obrigatórios nem o fluxo completo de alimentação da NF-e
2. **O layout do editor de NF-e** (`InvoiceEditor.tsx`, 1175 linhas) e do diálogo manual (`ManualInvoiceDialog.tsx`, 745 linhas) não possuem os campos SEFAZ que foram planejados (Indicador de Presença, IE Dest., Pagamento, GTIN/CEST por item, impostos detalhados)
3. **O adapter da Nuvem Fiscal** (`nuvem-fiscal-adapter.ts`) já monta parte do payload mas com valores hardcoded (ex: `indPres: 2`, `indFinal` derivado, impostos zerados) em vez de usar dados reais do banco

---

## Etapa 1 — Documentação (Layer 3)

Atualizar 3 documentos existentes + criar 1 novo:

### 1.1 Atualizar `docs/especificacoes/erp/erp-fiscal.md`

Adicionar nova seção **"Mapeamento de Campos da NF-e"** com:

| Conteúdo | Detalhes |
|---|---|
| Tabela completa de campos | Cada campo da NF-e com: nome, tipo, obrigatório (S/N), origem do dado, local de coleta na UI |
| Campos do cabeçalho | `indicador_presenca`, `indicador_ie_dest`, `hora_emissao`, `hora_saida`, `informacoes_fisco`, `finalidade_emissao`, `tipo_documento` |
| Campos de pagamento | `pagamento_indicador`, `pagamento_meio`, `pagamento_valor` |
| Campos de impostos totais | `valor_bc_icms`, `valor_icms`, `valor_pis`, `valor_cofins` |
| Campos do item | `gtin`, `gtin_tributavel`, `cest`, `valor_desconto`, impostos por item (ICMS, PIS, COFINS) |
| Fluxo de alimentação | Diagrama Origem → Destino: Produto → Item da NF, Cliente → Destinatário, Pedido → Pagamento, Configurações Fiscais → Defaults |
| Regras de derivação automática | Como cada campo é calculado ou preenchido automaticamente na criação do rascunho |

### 1.2 Atualizar `docs/especificacoes/ecommerce/produtos.md`

Adicionar na seção de campos do produto a indicação de que **GTIN é obrigatório** e sua finalidade fiscal.

### 1.3 Atualizar `docs/especificacoes/storefront/checkout.md`

Documentar que **CPF e endereço completo são obrigatórios** com justificativa fiscal (alimentação do destinatário da NF-e).

### 1.4 Criar `docs/especificacoes/erp/campos-nfe-referencia.md`

Documento de referência completo com todos os campos da NF-e organizados por grupo SEFAZ (IDE, Emitente, Destinatário, Itens, Totais, Transporte, Pagamento), indicando para cada um:
- Nome técnico SEFAZ (tag XML)
- Nome no sistema (coluna do banco)
- Obrigatório SEFAZ (S/N)
- Origem do dado (cadastro de produto, cliente, pedido, config fiscal, manual)
- Status atual (implementado / pendente de migração)

---

## Etapa 2 — Migração de Banco

Adicionar as colunas novas nas tabelas fiscais conforme o plano anterior já aprovado:

- **`fiscal_invoices`**: 11 colunas (indicador_presenca, indicador_ie_dest, hora_emissao, hora_saida, informacoes_fisco, pagamento_indicador, pagamento_meio, pagamento_valor, valor_bc_icms, valor_icms, valor_pis, valor_cofins)
- **`fiscal_invoice_items`**: 16 colunas (gtin, gtin_tributavel, cest, valor_desconto, valor_frete, icms_base, icms_aliquota, icms_valor, pis_cst, pis_base, pis_aliquota, pis_valor, cofins_cst, cofins_base, cofins_aliquota, cofins_valor)

Todos com defaults seguros (0 para numéricos, null para textos opcionais) para não quebrar dados existentes.

---

## Etapa 3 — Refatoração do InvoiceEditor

Reestruturar o editor de NF-e (atualmente 5 abas) para **6 abas** com todos os campos SEFAZ:

| Aba | Campos novos | Obrigatórios |
|---|---|---|
| **Geral** | Indicador de Presença (select 8 opções), Hora Emissão, Hora Saída, Informações ao Fisco | Ind. Presença: sim |
| **Destinatário** | Indicador IE Dest. (select 3 opções: Contribuinte/Isento/Não contribuinte) | Sim |
| **Itens** | GTIN (readonly, vindo do produto), CEST, Desconto por item + seção colapsável "Impostos" com ICMS/PIS/COFINS detalhados | GTIN: sim |
| **Valores** | Seção "Totais de Impostos" (BC ICMS, ICMS, PIS, COFINS) — calculados automaticamente, readonly | — |
| **Transporte** | Sem alteração | — |
| **Pagamento** (nova) | Indicador (À Vista/A Prazo/Outros), Meio (17 opções SEFAZ), Valor | Todos: sim |

Os tipos `InvoiceData` e `InvoiceItemData` serão ampliados para incluir os novos campos.

---

## Etapa 4 — Refatoração do ManualInvoiceDialog

Espelhar os mesmos campos novos do InvoiceEditor no diálogo de criação manual, agrupados nas mesmas seções lógicas.

---

## Etapa 5 — Atualização das Edge Functions

### 5.1 `fiscal-auto-create-drafts`
Propagar automaticamente na criação do rascunho:
- `products.gtin` → `fiscal_invoice_items.gtin`
- `products.cest` → `fiscal_invoice_items.cest`
- `customers.ie` + `customers.state_registration_is_exempt` → `fiscal_invoices.indicador_ie_dest`
- `orders.payment_method` → `fiscal_invoices.pagamento_meio` (via mapeamento existente no adapter)
- `fiscal_settings.origem_fiscal_padrao` → `fiscal_invoice_items.origem`

### 5.2 `fiscal-create-manual`
Propagar campos novos recebidos no body.

### 5.3 `nuvem-fiscal-adapter.ts` (`buildNFePayload`)
Substituir valores hardcoded por dados reais do banco:
- `indPres` → ler de `fiscal_invoices.indicador_presenca`
- `indIEDest` → ler de `fiscal_invoices.indicador_ie_dest`
- `tPag` → ler de `fiscal_invoices.pagamento_meio`
- GTIN nos itens → ler de `fiscal_invoice_items.gtin`
- Totais de impostos → somar dos itens

### 5.4 `fiscal-submit` (validação pré-emissão)
Adicionar validações para campos SEFAZ obrigatórios antes de enviar à Nuvem Fiscal.

---

## Etapa 6 — Validação Técnica

- Consulta ao banco para confirmar colunas criadas
- Deploy e teste das edge functions atualizadas
- Validação de build do frontend
- Teste do fluxo completo: criar rascunho manual → preencher campos → salvar → verificar dados no banco

---

## Ordem de Execução

```text
1. Documentação (Etapa 1)         — sem risco, base para tudo
2. Migração de banco (Etapa 2)    — pré-requisito para código
3. InvoiceEditor (Etapa 3)        — UI principal
4. ManualInvoiceDialog (Etapa 4)  — UI secundária
5. Edge Functions (Etapa 5)       — propagação e adapter
6. Validação técnica (Etapa 6)    — fechamento
```

---

## Detalhes Técnicos

- Migração SQL: 1 arquivo com ~27 ALTER TABLE ADD COLUMN
- Componentes alterados: `InvoiceEditor.tsx`, `ManualInvoiceDialog.tsx`
- Edge functions alteradas: `fiscal-auto-create-drafts`, `fiscal-create-manual`, `fiscal-submit`, `_shared/nuvem-fiscal-adapter.ts`
- Documentos alterados: 3 existentes + 1 novo
- Risco de regressão: baixo (todos os defaults são seguros, campos novos são aditivos)

