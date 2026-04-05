# Referência de Campos da NF-e — Mapeamento SEFAZ × Sistema

> **Camada:** Layer 3 — Especificações / ERP / Fiscal  
> **Última atualização:** 2026-04-05  
> **Referência:** Layout NF-e 4.0 (NT 2016.002) + Modelo Bling

---

## 1. Grupo IDE (Identificação da NF-e)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. SEFAZ | Origem do Dado | Status |
|-----------|-----------------|-----------|:---:|----------------|--------|
| `cUF` | UF Emitente | `fiscal_settings.emit_uf` | S | Config Fiscal | ✅ Implementado |
| `natOp` | Natureza da Operação | `fiscal_invoices.natureza_operacao` | S | Config Fiscal / Manual | ✅ Implementado |
| `mod` | Modelo | Fixo `55` | S | Sistema | ✅ Hardcoded |
| `serie` | Série | `fiscal_invoices.serie` | S | Config Fiscal | ✅ Implementado |
| `nNF` | Número | `fiscal_invoices.numero` | S | Auto-incremento | ✅ Implementado |
| `dhEmi` | Data/Hora Emissão | `fiscal_invoices.hora_emissao` | S | Sistema (momento da emissão) | 🔄 Migração pendente |
| `dhSaiEnt` | Data/Hora Saída | `fiscal_invoices.hora_saida` | N | Manual | 🔄 Migração pendente |
| `tpNF` | Tipo (0=Entrada, 1=Saída) | Fixo `1` | S | Sistema | ✅ Hardcoded |
| `idDest` | Destino da Operação | Derivado da UF dest. vs emit. | S | Sistema | ✅ Calculado |
| `cMunFG` | Município do Fato Gerador | `fiscal_settings.emit_municipio_codigo` | S | Config Fiscal | ✅ Implementado |
| `tpImp` | Formato DANFE | Fixo `1` | S | Sistema | ✅ Hardcoded |
| `tpEmis` | Tipo de Emissão | Fixo `1` (Normal) | S | Sistema | ✅ Hardcoded |
| `finNFe` | Finalidade | Fixo `1` (Normal) | S | Sistema | ✅ Hardcoded |
| `indFinal` | Consumidor Final | Derivado (PF=1, PJ=0) | S | Derivado CPF/CNPJ | ✅ Calculado |
| `indPres` | Indicador de Presença | `fiscal_invoices.indicador_presenca` | S | Manual / Default | 🔄 Migração pendente |
| `procEmi` | Processo de Emissão | Fixo `0` | S | Sistema | ✅ Hardcoded |
| `verProc` | Versão do Processo | Versão do sistema | S | Sistema | ✅ Implementado |
| `tpAmb` | Ambiente | `fiscal_settings.ambiente` | S | Config Fiscal | ✅ Implementado |
| `infCpl` | Informações Complementares | `fiscal_invoices.observacoes` | N | Manual | ✅ Implementado |
| `infAdFisco` | Informações ao Fisco | `fiscal_invoices.informacoes_fisco` | N | Manual | 🔄 Migração pendente |

---

## 2. Grupo EMIT (Emitente)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `CNPJ` | CNPJ Emitente | `fiscal_settings.cnpj_emit` | S | Config Fiscal | ✅ |
| `xNome` | Razão Social | `fiscal_settings.razao_social` | S | Config Fiscal | ✅ |
| `xFant` | Nome Fantasia | `fiscal_settings.nome_fantasia` | N | Config Fiscal | ✅ |
| `IE` | Inscrição Estadual | `fiscal_settings.ie_emit` | S | Config Fiscal | ✅ |
| `CRT` | Regime Tributário | `fiscal_settings.regime_tributario` | S | Config Fiscal | ✅ |
| `enderEmit` | Endereço Emitente | `fiscal_settings.emit_*` | S | Config Fiscal | ✅ |

---

## 3. Grupo DEST (Destinatário)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `CPF/CNPJ` | CPF ou CNPJ | `fiscal_invoices.dest_cpf_cnpj` | S | Checkout (cliente) | ✅ |
| `xNome` | Nome | `fiscal_invoices.dest_nome` | S | Checkout (cliente) | ✅ |
| `indIEDest` | Indicador IE Dest. | `fiscal_invoices.indicador_ie_dest` | S | Manual / Derivado | 🔄 Migração pendente |
| `email` | Email | `fiscal_invoices.dest_email` | N | Checkout | ✅ |
| `fone` | Telefone | `fiscal_invoices.dest_telefone` | N | Checkout | ✅ |
| `enderDest` | Endereço completo | `fiscal_invoices.dest_endereco_*` | S | Checkout (endereço) | ✅ |

---

## 4. Grupo DET/PROD (Itens — Produto)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `cProd` | Código do Produto | `fiscal_invoice_items.codigo_produto` | S | Cadastro de Produto | ✅ |
| `cEAN` | GTIN/EAN | `fiscal_invoice_items.gtin` | S | Cadastro de Produto | 🔄 Migração pendente |
| `xProd` | Descrição | `fiscal_invoice_items.descricao` | S | Cadastro de Produto | ✅ |
| `NCM` | NCM | `fiscal_invoice_items.ncm` | S | Cadastro de Produto | ✅ |
| `CEST` | CEST | `fiscal_invoice_items.cest` | N | Cadastro de Produto | 🔄 Migração pendente |
| `CFOP` | CFOP | `fiscal_invoice_items.cfop` | S | Config Fiscal | ✅ |
| `uCom` | Unidade | `fiscal_invoice_items.unidade` | S | Cadastro de Produto | ✅ |
| `qCom` | Quantidade | `fiscal_invoice_items.quantidade` | S | Pedido | ✅ |
| `vUnCom` | Valor Unitário | `fiscal_invoice_items.valor_unitario` | S | Pedido | ✅ |
| `vProd` | Valor Total | `fiscal_invoice_items.valor_total` | S | Calculado | ✅ |
| `cEANTrib` | GTIN Tributável | `fiscal_invoice_items.gtin_tributavel` | S | Cadastro de Produto | 🔄 Migração pendente |
| `vDesc` | Valor Desconto | `fiscal_invoice_items.valor_desconto` | N | Pedido | 🔄 Migração pendente |
| `indTot` | Compõe Total | Fixo `1` | S | Sistema | ✅ Hardcoded |
| `orig` | Origem da Mercadoria | `fiscal_invoice_items.origem` | S | Config Fiscal (default) | ✅ |

---

## 5. Grupo DET/IMPOSTO (Impostos por Item)

### 5.1 ICMS (Simples Nacional — CSOSN)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `orig` | Origem | `fiscal_invoice_items.origem` | S | Config Fiscal | ✅ |
| `CSOSN` | CSOSN | `fiscal_invoice_items.csosn` | S | Config Fiscal | ✅ |
| `vBC` | Base de Cálculo ICMS | `fiscal_invoice_items.icms_base` | N* | Calculado | 🔄 |
| `pICMS` | Alíquota ICMS | `fiscal_invoice_items.icms_aliquota` | N* | Config / Manual | 🔄 |
| `vICMS` | Valor ICMS | `fiscal_invoice_items.icms_valor` | N* | Calculado | 🔄 |

*Obrigatório quando CSOSN exige (ex: 500, 900).

### 5.2 PIS

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `CST` | CST PIS | `fiscal_invoice_items.pis_cst` | S | Config Fiscal | 🔄 |
| `vBC` | Base PIS | `fiscal_invoice_items.pis_base` | N* | Calculado | 🔄 |
| `pPIS` | Alíquota PIS | `fiscal_invoice_items.pis_aliquota` | N* | Config | 🔄 |
| `vPIS` | Valor PIS | `fiscal_invoice_items.pis_valor` | N* | Calculado | 🔄 |

### 5.3 COFINS

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `CST` | CST COFINS | `fiscal_invoice_items.cofins_cst` | S | Config Fiscal | 🔄 |
| `vBC` | Base COFINS | `fiscal_invoice_items.cofins_base` | N* | Calculado | 🔄 |
| `pCOFINS` | Alíquota COFINS | `fiscal_invoice_items.cofins_aliquota` | N* | Config | 🔄 |
| `vCOFINS` | Valor COFINS | `fiscal_invoice_items.cofins_valor` | N* | Calculado | 🔄 |

---

## 6. Grupo TOTAL (ICMSTot)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `vBC` | Base Cálculo ICMS | `fiscal_invoices.valor_bc_icms` | S | Soma dos itens | 🔄 |
| `vICMS` | Total ICMS | `fiscal_invoices.valor_icms` | S | Soma dos itens | 🔄 |
| `vPIS` | Total PIS | `fiscal_invoices.valor_pis` | S | Soma dos itens | 🔄 |
| `vCOFINS` | Total COFINS | `fiscal_invoices.valor_cofins` | S | Soma dos itens | 🔄 |
| `vProd` | Total Produtos | `fiscal_invoices.valor_produtos` | S | Soma dos itens | ✅ |
| `vFrete` | Total Frete | `fiscal_invoices.valor_frete` | S | Pedido | ✅ |
| `vDesc` | Total Desconto | `fiscal_invoices.valor_desconto` | S | Pedido | ✅ |
| `vNF` | Valor da Nota | `fiscal_invoices.valor_total` | S | Calculado | ✅ |

---

## 7. Grupo TRANSP (Transporte)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `modFrete` | Modalidade Frete | `fiscal_invoices.frete_modalidade` | S | Manual / Pedido | ✅ |

---

## 8. Grupo PAG (Pagamento)

| Tag SEFAZ | Nome no Sistema | Coluna BD | Obrig. | Origem | Status |
|-----------|-----------------|-----------|:---:|--------|--------|
| `indPag` | Indicador de Pagamento | `fiscal_invoices.pagamento_indicador` | S | Manual / Derivado | 🔄 |
| `tPag` | Meio de Pagamento | `fiscal_invoices.pagamento_meio` | S | Pedido / Manual | 🔄 |
| `vPag` | Valor do Pagamento | `fiscal_invoices.pagamento_valor` | S | Calculado | 🔄 |

### Códigos de Meio de Pagamento (tPag)

| Código | Descrição |
|--------|-----------|
| `01` | Dinheiro |
| `02` | Cheque |
| `03` | Cartão de Crédito |
| `04` | Cartão de Débito |
| `05` | Crédito Loja |
| `10` | Vale Alimentação |
| `11` | Vale Refeição |
| `12` | Vale Presente |
| `13` | Vale Combustível |
| `14` | Duplicata Mercantil |
| `15` | Boleto Bancário |
| `16` | Depósito Bancário |
| `17` | PIX |
| `18` | Transferência bancária |
| `19` | Programa de fidelidade |
| `90` | Sem pagamento |
| `99` | Outros |

### Códigos de Indicador de Presença (indPres)

| Código | Descrição |
|--------|-----------|
| `0` | Não se aplica |
| `1` | Presencial |
| `2` | Internet |
| `3` | Teleatendimento |
| `4` | NFC-e em domicílio |
| `5` | Presencial fora do estabelecimento |
| `9` | Outros |

### Códigos de Indicador IE Destinatário (indIEDest)

| Código | Descrição |
|--------|-----------|
| `1` | Contribuinte ICMS |
| `2` | Contribuinte isento |
| `9` | Não Contribuinte |

---

## 9. Fluxo de Alimentação dos Campos

```
Cadastro de Produto ──→ fiscal_invoice_items
  ├─ gtin → gtin
  ├─ ncm → ncm
  ├─ cest → cest
  └─ sku → codigo_produto

Checkout (Cliente) ──→ fiscal_invoices
  ├─ cpf/cnpj → dest_cpf_cnpj
  ├─ nome → dest_nome
  ├─ email → dest_email
  ├─ telefone → dest_telefone
  └─ endereço completo → dest_endereco_*

Pedido (Order) ──→ fiscal_invoices + fiscal_invoice_items
  ├─ payment_method → pagamento_meio (mapeado)
  ├─ valor_frete → valor_frete
  ├─ valor_desconto → valor_desconto
  ├─ itens.quantidade → quantidade
  └─ itens.valor → valor_unitario

Config Fiscal (fiscal_settings) ──→ defaults
  ├─ cfop_intrastadual → cfop (default)
  ├─ origem_fiscal_padrao → origem (default por item)
  ├─ regime_tributario → CRT
  ├─ serie_nfe → serie
  └─ ambiente → ambiente
```

---

## 10. Regras de Derivação Automática

| Campo | Regra |
|-------|-------|
| `indFinal` | `1` se CPF (PF), `0` se CNPJ (PJ) |
| `idDest` | `1` se UF emit. = UF dest., `2` se diferente, `3` se exterior |
| `pagamento_valor` | Igual ao `valor_total` da NF-e |
| `gtin_tributavel` | Igual ao `gtin` quando não informado separadamente |
| `valor_total` (item) | `quantidade × valor_unitario - valor_desconto` |
| `valor_total` (NF-e) | `soma(itens.valor_total) + frete - desconto` |
| `valor_bc_icms` | Soma de `icms_base` dos itens (quando aplicável) |
| `valor_icms` | Soma de `icms_valor` dos itens |
| `valor_pis` | Soma de `pis_valor` dos itens |
| `valor_cofins` | Soma de `cofins_valor` dos itens |
