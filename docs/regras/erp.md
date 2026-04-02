# ERP (Fiscal, Financeiro, Compras) — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção) — Fiscal ✅ Ready

## Visão Geral

Módulo de gestão empresarial: fiscal (NF-e via Nuvem Fiscal), financeiro, e compras/estoque.

---

## Submódulos

| Submódulo | Rota | Status |
|-----------|------|--------|
| Fiscal | `/fiscal` | ✅ Ready (Nuvem Fiscal) |
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
| `src/components/integrations/FiscalPlatformSettings.tsx` | Config global Nuvem Fiscal |

### Atualização em Tempo Real (v8.22.0)

| Campo | Valor |
|-------|-------|
| **Tipo** | Hook / Realtime |
| **Localização** | `src/hooks/useFiscal.ts` → `useFiscalRealtime()` |
| **Contexto** | Usado em `FiscalInvoiceList.tsx` |
| **Descrição** | Escuta mudanças na tabela `fiscal_invoices` via realtime e invalida automaticamente os dados da lista |
| **Comportamento** | Ao receber INSERT/UPDATE/DELETE em `fiscal_invoices`, invalida queries `fiscal-invoices`, `fiscal-stats` e `fiscal-alerts` |
| **Condições** | Tabela `fiscal_invoices` adicionada à publication `supabase_realtime` |
| **Resultado** | O módulo fiscal atualiza automaticamente sem o usuário precisar recarregar a página |


| Função | Descrição |
|--------|-----------|
| `fiscal-sync-nuvem-fiscal` | Sincroniza empresa + certificado na Nuvem Fiscal |
| `fiscal-emit` | Emissão da NF-e via Nuvem Fiscal |
| `fiscal-create-draft` | Cria rascunho de NF-e a partir de pedido |
| `fiscal-create-manual` | Cria NF-e manualmente (sem pedido) |
| `fiscal-auto-create-drafts` | Criação automática de rascunhos (cron 5min + manual) |
| `fiscal-validate-order` | Validação pré-emissão |

### Trigger: Criação Instantânea de NF (v8.7.0)

| Campo | Valor |
|-------|-------|
| **Tipo** | Database Trigger (pg_net) |
| **Trigger** | `trg_fiscal_draft_on_payment_approved` em `orders` |
| **Descrição** | Cria rascunho de NF-e **instantaneamente** quando `payment_status` muda para `approved` |
| **Mecanismo** | Chama a edge function `fiscal-auto-create-drafts` em modo TRIGGER via `net.http_post` |
| **Data da NF** | Usa `paid_at` do pedido (não `now()`) para refletir a data real da venda |
| **Condições** | Dispara somente quando `OLD.payment_status IS DISTINCT FROM 'approved'` AND `NEW.payment_status = 'approved'` |
| **Fallback** | O cron continua ativo como rede de segurança |

### Cron: fiscal-auto-create-drafts (fallback)

| Campo | Valor |
|-------|-------|
| **Tipo** | Cron Job (pg_cron) |
| **Frequência** | A cada 5 minutos (`*/5 * * * *`) |
| **Descrição** | Rede de segurança — cria rascunhos para pedidos pagos que o trigger eventualmente não processou |
| **Modos** | **Cron** (todos tenants) / **User** (tenant do usuário) / **Trigger** (order_id + tenant_id no body) |
| **Data da NF** | Usa `paid_at` do pedido como `created_at` da NF |
| **Anti-duplicação** | Verifica `fiscal_invoices` existentes antes de criar; retry com incremento de número |
| **verify_jwt** | `false` (necessário para cron/trigger) |
| **Segurança** | Cron/Trigger usa anon key → usa service_role internamente |


### Shared Module: fiscal-numbering.ts
| Função | Descrição |
|--------|-----------|
| `_shared/fiscal-numbering.ts` | Módulo centralizado de numeração fiscal |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Emissão NF-e | ✅ Ready | Via Nuvem Fiscal |
| Sincronização Empresa | ✅ Ready | Cadastro automático na Nuvem Fiscal |
| Upload Certificado | ✅ Ready | A3/A1 via Nuvem Fiscal |
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

---

## Integração Nuvem Fiscal

### Credenciais (Platform-level)
Configuradas via `platform_secrets`:
| Secret | Descrição |
|--------|-----------|
| `NUVEM_FISCAL_CLIENT_ID` | Client ID OAuth2 |
| `NUVEM_FISCAL_CLIENT_SECRET` | Client Secret OAuth2 |

### Configuração por Tenant (`fiscal_settings`)
```typescript
{
  tenant_id: uuid,
  ambiente: 'homologacao' | 'producao',
  certificado_pfx: string,      // Certificado em base64 (criptografado)
  certificado_senha: string,    // Senha do certificado (criptografada)
  razao_social: string,
  cnpj: string,
  ie: string,
  crt: '1' | '2' | '3',         // Regime tributário
  codigo_municipio: string,     // Código IBGE do município
  endereco_*: string,           // Dados do emitente
  desmembrar_estrutura: boolean,// Desmembrar kits na NF
  nuvem_fiscal_id: string,      // ID da empresa na Nuvem Fiscal
  sync_status: 'pending' | 'synced' | 'error',
  last_sync_at: timestamp,
  sync_error: string,
}
```

### Arquitetura Nuvem Fiscal

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED MODULES                                │
├─────────────────────────────────────────────────────────────────┤
│  nuvem-fiscal-client.ts     │  nuvem-fiscal-adapter.ts          │
│  ─────────────────────────  │  ────────────────────────────     │
│  • OAuth2 token management  │  • buildEmpresaPayload()          │
│  • syncEmpresa()            │  • buildCertificadoPayload()      │
│  • cadastrarCertificado()   │  • buildNFePayload()              │
│  • emitirNFe()              │  • parseNFeResponse()             │
│  • consultarNFe()           │  • CRT/UF/Payment mappings        │
│  • cancelarNFe()            │                                   │
│  • downloadXML/PDF()        │                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                                │
├─────────────────────────────────────────────────────────────────┤
│  fiscal-sync-nuvem-fiscal   │  fiscal-emit                      │
│  ─────────────────────────  │  ────────────────────────────     │
│  1. Load fiscal_settings    │  1. Load invoice + items          │
│  2. Build empresa payload   │  2. Build NF-e payload            │
│  3. syncEmpresa()           │  3. emitirNFe()                   │
│  4. cadastrarCertificado()  │  4. Map Sefaz status              │
│  5. Update sync_status      │  5. Update fiscal_invoices        │
└─────────────────────────────────────────────────────────────────┘
```

### Fluxo de Sincronização
```
1. Tenant configura dados fiscais (CNPJ, certificado, endereço)
2. Chama fiscal-sync-nuvem-fiscal
3. Edge function:
   a. Carrega fiscal_settings
   b. Descriptografa certificado (FISCAL_ENCRYPTION_KEY)
   c. Resolve código IBGE via RPC
   d. Chama NuvemFiscalClient.syncEmpresa()
   e. Cadastra certificado na Nuvem Fiscal
   f. Atualiza fiscal_settings com nuvem_fiscal_id
```

### Fluxo de Emissão
```
1. Invoice em status 'draft' ou 'pending'
2. Chama fiscal-emit com invoice_id
3. Edge function:
   a. Carrega invoice + items + fiscal_settings
   b. Monta payload via buildNFePayload()
   c. Chama NuvemFiscalClient.emitirNFe()
   d. Mapeia status Sefaz → status interno
   e. Atualiza fiscal_invoices (chave, protocolo, URLs)
```

### Mapeamento de Status NF-e (Sefaz → Interno)
| Status Sefaz | Status Interno |
|--------------|----------------|
| `autorizada` | `authorized` |
| `rejeitada` | `rejected` |
| `denegada` | `denied` |
| `cancelada` | `cancelled` |
| `processando` | `processing` |

### Integração Status Pedido ↔ NF-e (v2026-03-10)

O fluxo fiscal é diretamente integrado ao ciclo de vida do pedido. A coluna `status` do pedido reflete a etapa fiscal-operacional interna.

#### Fluxo Completo (Pedido → Fiscal → Logística)
```
awaiting_confirmation → ready_to_invoice → invoice_pending_sefaz → invoice_authorized → invoice_issued → dispatched → completed
                                                   ↓                        ↓
                                            invoice_rejected         invoice_cancelled
```

#### Mapeamento Pedido ↔ Fiscal
| Status do Pedido | Significado | Ação Fiscal |
|------------------|-------------|-------------|
| `awaiting_confirmation` | Aguardando pagamento | Nenhuma |
| `ready_to_invoice` | Pago, pronto para NF | Criar rascunho de NF-e |
| `invoice_pending_sefaz` | NF enviada à SEFAZ | Aguardar retorno |
| `invoice_authorized` | NF autorizada pela SEFAZ e enviada ao cliente | NF aprovada com sucesso |
| `invoice_issued` | NF impressa, preparando despacho | Preparar envio |
| `dispatched` | Pacote despachado | — |
| `completed` | Entregue ao destino | — |
| `invoice_rejected` | SEFAZ rejeitou NF | Corrigir e reemitir |
| `invoice_cancelled` | NF cancelada pós-autorização | Emitir NF de cancelamento |
| `returning` | Em devolução | Emitir NF de devolução |
| `payment_expired` | Pagamento expirado | Nenhuma |

#### Transições Automáticas
| Gatilho | Transição |
|---------|-----------|
| Webhook de pagamento aprovado | `awaiting_confirmation` → `ready_to_invoice` |
| PIX/Boleto expirado | `awaiting_confirmation` → `payment_expired` |
| fiscal-auto-create-drafts (auto-emissão ativa) | `ready_to_invoice` → `invoice_pending_sefaz` |

#### Regras
1. **Separação de colunas**: `status` = etapa operacional interna. `shipping_status` = status de entrega. `payment_status` = status de pagamento.
2. **Automação**: Transição para `ready_to_invoice` é automática via webhook de pagamento.
3. **NF Autorizada vs Emitida**: "Autorizada" = SEFAZ aprovou e NF foi enviada ao cliente. "Emitida" = NF impressa e preparada para despacho físico.
4. **Terminal**: `completed` é o estado final após confirmação de entrega.

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
- [x] Sincronização de empresa na Nuvem Fiscal
- [x] Upload de certificado via Nuvem Fiscal
- [x] Emissão de NF-e via Nuvem Fiscal
- [ ] Dashboard financeiro
- [ ] Módulo de compras
- [ ] Relatórios fiscais
- [ ] Integração com ERPs externos
- [ ] Importação de NF-e de entrada
- [ ] Cancelamento de NF-e
- [ ] Carta de correção (CC-e)

---

## Numeração Fiscal — Arquitetura Anti-Colisão (v8.6.2 — 2026-03-11)

### Problema Original (Causa Raiz)

O campo `numero_nfe_atual` em `fiscal_settings` ficava defasado em relação aos números realmente existentes em `fiscal_invoices`. Quando múltiplos pedidos eram processados, o cursor apontava para um número já utilizado, causando erro `23505` (unique constraint violation) na constraint `fiscal_invoices_numero_unique (tenant_id, serie, numero)`.

**Sintoma:** Pedidos pagos não geravam rascunho de NF-e. A edge function falhava silenciosamente.

### Solução: Shared Module `_shared/fiscal-numbering.ts`

Módulo centralizado usado por **todas** as 3 funções de criação fiscal.

#### Funções

| Função | Descrição |
|--------|-----------|
| `getNextFiscalNumber()` | Consulta `MAX(numero)` diretamente na tabela `fiscal_invoices` para o tenant+série. Retorna `MAX + 1` ou o fallback de `numero_nfe_atual`, o que for maior. **Nunca confia apenas no cursor de settings.** |
| `insertFiscalInvoiceWithRetry()` | Tenta inserir o invoice com o número calculado. Se receber erro `23505` (duplicata), incrementa o número e retenta até `maxAttempts` (default: 20). Se o erro NÃO for duplicata, propaga o erro imediatamente. |
| `syncFiscalNumberCursor()` | Após inserção bem-sucedida, recalcula o próximo número via `getNextFiscalNumber()` e atualiza `fiscal_settings.numero_nfe_atual` para manter o cursor sincronizado. |

#### Fluxo de Numeração

```
1. getNextFiscalNumber() → consulta MAX(numero) em fiscal_invoices
   → retorna MAX(maxNumero + 1, fallbackNumeroAtual)

2. insertFiscalInvoiceWithRetry() → tenta INSERT com o número calculado
   ├─ ✅ Sucesso → retorna invoice + numero
   └─ ❌ 23505 (duplicata) → incrementa numero, retenta (até 20x)
       └─ ❌ Outro erro → throw imediato

3. syncFiscalNumberCursor() → recalcula e atualiza fiscal_settings.numero_nfe_atual
```

#### Edge Functions que Usam o Módulo

| Edge Function | Versão | Comportamento |
|--------------|--------|---------------|
| `fiscal-auto-create-drafts` | v8.6.2 | Loop por pedidos pagos sem NF. Usa cursor compartilhado `nextNumeroCursor` que avança a cada invoice criado. Sync final ao terminar. |
| `fiscal-create-draft` | v8.6.2 | Criação individual. Se draft já existe para o pedido, atualiza sem mudar número. Se novo, usa retry. |
| `fiscal-create-manual` | v8.6.2 | NF-e sem pedido vinculado. Mesmo fluxo de retry + sync. |

#### Garantias

1. **Sem dependência exclusiva do cursor**: Sempre consulta `MAX(numero)` no banco antes de inserir.
2. **Race condition safe**: Retry com incremento automático em caso de colisão.
3. **Cursor auto-reparável**: `syncFiscalNumberCursor` recalcula baseado no estado real do banco.
4. **Idempotente**: `fiscal-auto-create-drafts` verifica existência de invoice antes de criar (double-check).

---

## Correções Aplicadas

### fiscal-numbering — Erro 23505 em numeração fiscal (v8.6.2 — 2026-03-11)

| Campo | Valor |
|-------|-------|
| **Tipo** | Correção de Bug Crítico (Regressão) |
| **Localização** | `supabase/functions/_shared/fiscal-numbering.ts`, `fiscal-auto-create-drafts`, `fiscal-create-draft`, `fiscal-create-manual` |
| **Contexto** | Numeração automática de NF-e ao criar rascunhos |
| **Causa Raiz** | `numero_nfe_atual` em `fiscal_settings` ficava defasado. Tentava inserir número já existente → erro 23505. |
| **Correção** | Criado módulo shared `fiscal-numbering.ts` com: (1) `getNextFiscalNumber` que consulta `MAX(numero)` real, (2) `insertFiscalInvoiceWithRetry` com retry em colisões, (3) `syncFiscalNumberCursor` para manter cursor atualizado. Todas as 3 functions de criação fiscal agora usam esse módulo. |
| **Afeta** | Todo fluxo de criação de NF-e (automático, manual, por pedido) |

### fiscal-auto-create-drafts — Regressão status filter (v8.6.1 — 2026-03-11)

| Campo | Valor |
|-------|-------|
| **Tipo** | Correção de Bug (Regressão) |
| **Localização** | `supabase/functions/fiscal-auto-create-drafts/index.ts` |
| **Contexto** | Auto-criação de rascunhos de NF-e para pedidos pagos |
| **Descrição** | A function filtrava apenas `status = 'paid'`, mas o novo fluxo fiscal-operacional usa `ready_to_invoice` como status pós-pagamento. Pedidos aprovados não apareciam em "Prontas para Emitir". |
| **Correção** | Alterado para `.eq('payment_status', 'approved').in('status', ['paid', 'ready_to_invoice'])` — garante compatibilidade com fluxo legado e novo. |
| **Afeta** | Módulo Fiscal → aba "Prontas para Emitir", botão "Gerar Rascunhos" |

---

### Padronização de erros — Lote Fiscal (v8.25.0 — 2026-03-29)

| Campo | Valor |
|-------|-------|
| **Tipo** | Padronização de Infraestrutura |
| **Localização** | Todas as 20 edge functions `fiscal-*` + 8 componentes frontend fiscais |
| **Contexto** | Iniciativa global de sanitização de erros para evitar vazamento de dados técnicos |
| **Descrição** | Substituído `error.message` por `errorResponse()` (contrato padronizado) em todas as edge functions fiscais. No frontend, substituído `toast.error(error.message)` por `showErrorToast()` com sanitização automática. |
| **Edge Functions afetadas** | fiscal-emit, fiscal-submit, fiscal-cancel, fiscal-webhook, fiscal-get-status, fiscal-create-draft, fiscal-create-manual, fiscal-validate-order, fiscal-settings, fiscal-upload-certificate, fiscal-send-nfe-email, fiscal-auto-create-drafts, fiscal-sync-focus-nfe, fiscal-sync-nuvem-fiscal, fiscal-test-connection, fiscal-check-status, fiscal-remove-certificate, fiscal-cce, fiscal-inutilizar, fiscal-update-draft |
| **Componentes afetados** | CancelInvoiceDialog, EmitInvoiceButton, CorrectInvoiceDialog, InutilizarNumerosDialog, ManualInvoiceDialog, EntryInvoiceDialog |
| **Afeta** | Módulo Fiscal inteiro — nenhum erro técnico vaza mais para o usuário |

---

## Componentes de Data Padronizados

| Submódulo | Campo | Componente |
|-----------|-------|------------|
| Fiscal | Data da NF-e (InvoiceEditor) | `DatePickerField` |
| Financeiro | Data de lançamento (FinanceEntryFormDialog) | `DatePickerField` |
| Financeiro | Filtro de período (Finance) | `DateRangeFilter` |
| Compras | Data do pedido (PurchaseFormDialog) | `DatePickerField` |
| Compras | Filtro de período (Purchases) | `DateRangeFilter` |

> Ver `regras-gerais.md` § Padrão de Datas para especificação completa.
