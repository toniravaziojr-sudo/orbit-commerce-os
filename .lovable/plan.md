

# Plano: Rascunhos Logísticos — Criação Simultânea aos Fiscais

## Ajuste Conceitual

**Antes (plano anterior):** Rascunho logístico criado após NF-e autorizada (trigger em `fiscal_invoices`).

**Agora (otimizado):** Rascunho logístico criado no mesmo momento que o rascunho fiscal — quando o pagamento é aprovado. Isso permite que, ao emitir a NF-e, as remessas já estejam prontas para envio imediato.

```text
Pagamento Aprovado
    │
    ├── fiscal_draft_queue (já existe)
    │
    └── shipping_draft_queue (NOVO — mesmo gatilho)
            │
            ▼
    Rascunho logístico pronto
    (aguardando emissão da NF-e para enviar remessa)
```

---

## Etapa 1 — Documentação

### 1.1 Criar `docs/especificacoes/erp/rascunhos-logisticos.md`

Conteúdo:
- Gatilho: pagamento aprovado (mesmo da fila fiscal)
- Separação por transportadora baseada em `orders.shipping_carrier`
- Dados necessários por transportadora (Correios, Loggi) — tabela com origem de cada campo
- Ciclo de vida: `pending → processing → done/failed`
- Modos de operação: automático (envia remessa ao emitir NF) vs manual (rascunho para revisão)
- Independência NF-e ↔ Remessa na criação; dependência apenas no envio

### 1.2 Atualizar `docs/especificacoes/erp/logistica.md`

Adicionar seção "Rascunhos Logísticos" referenciando o novo documento e o fluxo integrado.

### 1.3 Atualizar `docs/especificacoes/erp/erp-fiscal.md`

Atualizar o diagrama de fluxo para mostrar que ambas as filas são alimentadas pelo mesmo trigger.

---

## Etapa 2 — Migração de Banco

### 2.1 Criar tabela `shipping_draft_queue`

Estrutura espelhada da `fiscal_draft_queue`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid FK tenants | |
| order_id | uuid FK orders (UNIQUE) | |
| provider | text | correios, loggi, frenet — extraído de `orders.shipping_carrier` |
| status | text default 'pending' | pending, processing, done, failed |
| attempts | integer default 0 | |
| error_message | text nullable | |
| created_at | timestamptz | |
| processed_at | timestamptz nullable | |

RLS habilitado, acesso apenas via service_role.

### 2.2 Adicionar colunas em `shipments`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| label_url | text nullable | URL/base64 da etiqueta |
| provider_shipment_id | text nullable | ID da remessa na transportadora |
| invoice_id | uuid FK nullable | NF-e vinculada |
| service_code | text nullable | Código do serviço (03220, 03298) |
| nfe_key | text nullable | Chave de acesso da NF-e |

### 2.3 Expandir o trigger existente `enqueue_fiscal_draft`

Alterar a função `enqueue_fiscal_draft()` para, além de inserir na `fiscal_draft_queue`, também inserir na `shipping_draft_queue` — extraindo o `provider` de `NEW.shipping_carrier`. Um único trigger, duas filas, 100% atômico.

---

## Etapa 3 — Processamento da Fila no `scheduler-tick`

Adicionar nova fase (PHASE 1.6) logo após a fase fiscal:

1. Buscar itens `pending` na `shipping_draft_queue` (limit 5)
2. Para cada item:
   - Buscar pedido para obter dados de envio
   - Criar registro em `shipments` com status `draft` (rascunho pronto, não enviado)
   - Preencher: destinatário, dimensões (dos produtos), peso, serviço, valor declarado
   - Marcar como `done`
3. O envio real da remessa continua sendo feito depois (ao emitir NF-e ou manualmente)

**Importante:** Esta fase NÃO envia a remessa para a transportadora. Apenas monta o rascunho com todos os dados prontos.

### 3.1 Adicionar status `draft` ao enum `delivery_status`

Para diferenciar rascunhos logísticos de envios reais.

---

## Etapa 4 — Validação Técnica

- Confirmar colunas e tabela criadas no banco
- Verificar que o trigger alimenta ambas as filas
- Deploy do `scheduler-tick` atualizado
- Simular: aprovar pagamento → verificar que `fiscal_draft_queue` E `shipping_draft_queue` recebem registros
- Verificar que `shipments` recebe registro com status `draft`

---

## Ordem de Execução

```text
1. Documentação (Etapa 1)
2. Migração de banco (Etapa 2)
3. scheduler-tick (Etapa 3)
4. Validação técnica (Etapa 4)
```

## Resumo Técnico

- **1 tabela nova:** `shipping_draft_queue`
- **5 colunas novas** em `shipments`
- **1 valor novo** no enum `delivery_status` (`draft`)
- **1 trigger alterado:** `enqueue_fiscal_draft` → insere em 2 filas
- **1 edge function alterada:** `scheduler-tick` (nova fase 1.6)
- **3 docs:** 1 novo + 2 atualizados
- **Risco:** baixo — aditivo, sem quebra de fluxo existente

