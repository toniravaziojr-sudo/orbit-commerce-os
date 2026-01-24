# ERP (Fiscal, Financeiro, Compras) — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção)

## Visão Geral

Módulo de gestão empresarial: fiscal (NF-e), financeiro, e compras/estoque.

---

## Submódulos

| Submódulo | Rota | Status |
|-----------|------|--------|
| Fiscal | `/fiscal` | 🟧 Pending |
| Financeiro | `/finance` | 🟧 Pending |
| Compras | `/purchases` | 🟧 Pending |
| Logística | `/shipping` | 🟧 Pending (ver logistica.md) |

---

## 1. Fiscal

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Fiscal.tsx` | Dashboard fiscal |
| `src/pages/FiscalSettings.tsx` | Configurações |
| `src/pages/FiscalProductsConfig.tsx` | NCM/CFOP por produto |

### Edge Functions Fiscais
| Função | Descrição |
|--------|-----------|
| `fiscal-create-draft` | Cria rascunho de NF-e a partir de pedido |
| `fiscal-create-manual` | Cria NF-e manualmente (sem pedido) |
| `fiscal-auto-create-drafts` | Criação automática de rascunhos |
| `fiscal-emit` | Emissão da NF-e via Nuvem Fiscal |
| `fiscal-validate-order` | Validação pré-emissão |
| `fiscal-sync-nuvem-fiscal` | Sincroniza empresa na Nuvem Fiscal |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Emissão NF-e | ✅ Ready | Via Nuvem Fiscal |
| Consulta CNPJ | 🟧 Pending | Dados do cliente |
| NCM/CFOP | ✅ Ready | Configuração por produto |
| ICMS/PIS/COFINS | 🟧 Pending | Cálculo automático |
| Manifestação | 🟧 Pending | Aceite de NF |
| Desmembrar Kits | ✅ Ready | Lista componentes separados na NF-e |

### Desmembramento de Kits (Composições)

Quando a configuração `desmembrar_estrutura` está ativa em `fiscal_settings`:

1. **Valores do Pedido**: Os valores são extraídos do pedido original (preço de venda real)
2. **Listagem na NF**: Os componentes são listados separadamente para facilitar conferência
3. **Rateio Proporcional**: O valor total do kit é distribuído proporcionalmente entre os componentes
4. **NCM por Componente**: Cada componente usa seu próprio NCM cadastrado em `fiscal_products`

**Fluxo:**
```
Kit vendido por R$ 100,00
├── Componente A (valor base R$ 60) → R$ 60,00 na NF
└── Componente B (valor base R$ 40) → R$ 40,00 na NF
                                     ────────────
                                      Total: R$ 100,00 (igual ao pedido)
```

**Importante:** A estrutura do produto (componentes e quantidades) é apenas para listagem na NF. Os preços/custos no cadastro do componente não afetam o valor final - o que vale é o preço vendido no pedido.

### Shared Module: Kit Unbundler
```typescript
// supabase/functions/_shared/kit-unbundler.ts
// Desmembra kits em componentes individuais
// Mantém rastreabilidade: original_kit_id, original_kit_name, is_from_kit
```

### Campos Fiscais do Produto
| Campo | Descrição |
|-------|-----------|
| `ncm` | Código NCM (8 dígitos) |
| `cfop` | Código CFOP |
| `origem` | Origem (0-8) |
| `cest` | Código CEST |
| `csosn` | CSOSN (Simples Nacional) |
| `cst` | CST (Lucro Real/Presumido) |
| `unidade_comercial` | Unidade (UN, KG, etc) |

### Integração Nuvem Fiscal
```typescript
// Configuração por tenant em fiscal_settings
{
  tenant_id: uuid,
  nuvem_fiscal_client_id: string,   // Client ID (via platform_secrets)
  nuvem_fiscal_client_secret: string, // Client Secret (via platform_secrets)
  ambiente: 'homologacao' | 'producao',
  certificado_pfx: string,    // Certificado em base64 (criptografado)
  certificado_senha: string,  // Senha do certificado (criptografada)
  razao_social: string,
  cnpj: string,
  ie: string,
  crt: '1' | '2' | '3',       // Regime tributário
  codigo_municipio: string,   // Código IBGE do município
  endereco_*: string,         // Dados do emitente
  desmembrar_estrutura: boolean, // Desmembrar kits na NF
}
```

### Edge Functions Fiscais (Nuvem Fiscal)
| Função | Descrição |
|--------|-----------|
| `fiscal-sync-nuvem-fiscal` | Sincroniza empresa na Nuvem Fiscal |
| `fiscal-emit` | Emissão da NF-e |
| `fiscal-cancel` | Cancelamento de NF-e |
| `fiscal-download-xml` | Download do XML |
| `fiscal-download-pdf` | Download do DANFE |

---

## 2. Financeiro

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Finance.tsx` | Dashboard financeiro |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Contas a receber | 🟧 Pending | Entradas |
| Contas a pagar | 🟧 Pending | Saídas |
| Fluxo de caixa | 🟧 Pending | Previsão |
| Conciliação | 🟧 Pending | Bancária |
| DRE | 🟧 Pending | Demonstrativo |

### Modelo de Dados
```typescript
// financial_transactions
{
  id: uuid,
  tenant_id: uuid,
  type: 'income' | 'expense',
  category: string,
  description: text,
  amount_cents: int,
  due_date: date,
  paid_date: date,
  status: 'pending' | 'paid' | 'overdue' | 'cancelled',
  reference_type: 'order' | 'purchase' | 'manual',
  reference_id: uuid,
}

// financial_categories
{
  id: uuid,
  tenant_id: uuid,
  name: string,
  type: 'income' | 'expense',
  parent_id: uuid,
}
```

---

## 3. Compras

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Purchases.tsx` | Gestão de compras |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Pedidos de compra | 🟧 Pending | Criação/gestão |
| Fornecedores | 🟧 Pending | Cadastro |
| Cotações | 🟧 Pending | Comparação |
| Entrada de estoque | 🟧 Pending | Recebimento |

### Modelo de Dados
```typescript
// purchase_orders
{
  id: uuid,
  tenant_id: uuid,
  supplier_id: uuid,
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled',
  total_cents: int,
  expected_date: date,
  received_date: date,
  notes: text,
}

// purchase_order_items
{
  id: uuid,
  purchase_order_id: uuid,
  product_id: uuid,
  variant_id: uuid,
  quantity: int,
  unit_cost_cents: int,
  received_quantity: int,
}
```

---

## Integrações ERP

| Sistema | Status | Descrição |
|---------|--------|-----------|
| Bling | 🟧 Coming Soon | Sincronização |
| Tiny | 🟧 Coming Soon | Sincronização |
| Omie | 🟧 Coming Soon | Sincronização |
| ContaAzul | 🟧 Coming Soon | Financeiro |

---

## Pendências

- [x] Migração Focus NFe → Nuvem Fiscal
- [ ] Dashboard financeiro
- [ ] Módulo de compras
- [ ] Relatórios fiscais
- [ ] Integração com ERPs externos
- [ ] Importação de NF-e de entrada
