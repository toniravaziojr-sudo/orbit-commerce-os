# Rascunhos Logísticos — Especificação

> **STATUS:** 🟧 Em implementação  
> **Camada:** Layer 3 — Especificações / ERP  
> **Criado em:** 2026-04-06  
> **Última atualização:** 2026-04-06  
> **Versão scheduler-tick:** v2.3.3

---

## Visão Geral

O sistema cria **rascunhos logísticos** automaticamente no mesmo momento em que cria os rascunhos fiscais — quando o pagamento de um pedido é aprovado. Isso garante que, ao emitir a NF-e, as remessas já estejam prontas para envio imediato à transportadora.

---

## Gatilho de Criação

| Campo | Valor |
|-------|-------|
| **Evento** | `payment_status` muda para `approved` na tabela `orders` |
| **Mecanismo** | Trigger SQL `enqueue_fiscal_draft()` — insere simultaneamente em `fiscal_draft_queue` e `shipping_draft_queue` |
| **Atomicidade** | 100% — INSERT atômico dentro da mesma transação do UPDATE do pedido |
| **Deduplicação** | `ON CONFLICT (order_id) DO NOTHING` — impede duplicatas |

```text
Pagamento Aprovado (trigger em orders)
    │
    ├── fiscal_draft_queue    → rascunho da NF-e
    │
    └── shipping_draft_queue  → rascunho logístico
```

---

## Separação por Transportadora

O campo `provider` do rascunho logístico é derivado automaticamente de `orders.shipping_carrier`:

| `shipping_carrier` (pedido) | `provider` (rascunho) | Transportadora |
|-----------------------------|----------------------|----------------|
| `correios` | `correios` | Correios (Pré-postagem PLP) |
| `loggi` | `loggi` | Loggi (Async Shipments) |
| `frenet` | `frenet` | Frenet (Gateway) |
| Outro / NULL | `manual` | Sem integração direta |

---

## Ciclo de Vida do Rascunho (shipping_draft_queue)

```text
pending → processing → done
                    └→ failed (após 5 tentativas)
```

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando processamento pelo scheduler-tick |
| `processing` | Sendo processado (lock temporário) |
| `done` | Rascunho criado com sucesso em `shipments` |
| `failed` | Falha após todas as tentativas |

---

## Processamento da Fila (scheduler-tick — Fase 1.6)

O `scheduler-tick` processa a `shipping_draft_queue` logo após a fila fiscal:

1. Busca itens `pending` (limit 5 por pass)
2. Para cada item:
   - Busca dados do pedido (destinatário, método de envio, valor)
   - Busca itens do pedido com dados dos produtos (peso, dimensões)
   - Calcula peso total e dimensões consolidadas
   - Cria registro em `shipments` com status `draft`
   - Marca item da fila como `done`
3. **NÃO envia** a remessa à transportadora — apenas prepara o rascunho

---

## Dados Necessários por Transportadora

> **IMPORTANTE:** O campo `products.weight` armazena peso em **gramas** (g). O campo de dimensões de comprimento no banco é `products.depth` (não `length`). Não é necessária conversão de unidade ao enviar para transportadoras — o valor já está em gramas.

### Correios (Pré-postagem PLP)

| Dado | Origem | Coluna/Campo | Obrigatório |
|------|--------|-------------|-------------|
| Remetente (nome, CNPJ, endereço) | Configuração do provider | `shipping_providers.settings` | Sim |
| Destinatário (nome, endereço, CEP) | Pedido | `orders.shipping_*` | Sim |
| Código de serviço (PAC/SEDEX) | Pedido | `orders.shipping_service_code` | Sim |
| Peso (g) | Produtos × quantidade | `products.weight` | Sim |
| Dimensões (cm) | Produtos | `products.height/width/depth` | Sim |
| Valor declarado | Pedido | `orders.total` | Condicional |
| Cartão de postagem | Credenciais | `shipping_providers.credentials` | Sim |
| Chave NF-e | NF-e (preenchido após emissão) | `fiscal_invoices.chave_acesso` | Recomendado |

### Loggi (Async Shipments)

| Dado | Origem | Coluna/Campo | Obrigatório |
|------|--------|-------------|-------------|
| shipFrom (endereço origem) | Configuração do provider | `shipping_providers.credentials/settings` | Sim |
| shipTo (endereço destino) | Pedido | `orders.shipping_*` | Sim |
| Peso (kg) | Produtos × quantidade | `products.weight` | Sim |
| Dimensões (cm) | Produtos | `products.height/width/depth` | Sim |
| Valor declarado | Pedido | `orders.total` | Sim |
| Company ID | Credenciais | `shipping_providers.credentials.company_id` | Sim |

---

## Modos de Operação

Configurável via `fiscal_settings.auto_create_shipment`:

| Modo | Flag | Comportamento |
|------|------|--------------|
| **Automático** | `true` | Ao emitir NF-e, o sistema envia a remessa automaticamente à transportadora e retorna tracking + etiqueta |
| **Manual** | `false` | Ao emitir NF-e, o rascunho logístico permanece com status `draft` para revisão e envio manual pelo módulo logístico |

---

## Independência NF-e ↔ Remessa

| Aspecto | Regra |
|---------|-------|
| **Criação** | Independentes — ambos os rascunhos são criados simultaneamente pelo mesmo trigger |
| **Envio** | Dependente — a remessa só é enviada à transportadora após a NF-e estar autorizada |
| **Chave NF-e** | Opcional na criação do rascunho, preenchida automaticamente quando a NF-e é autorizada |
| **Rastreio na NF-e** | O código de rastreio **não é campo da NF-e** (grupo Transporte é informativo) |

---

## Estrutura de Dados

### Tabela `shipping_draft_queue`

| Coluna | Tipo | Default | Descrição |
|--------|------|---------|-----------|
| id | uuid PK | gen_random_uuid() | |
| tenant_id | uuid FK tenants | — | |
| order_id | uuid FK orders (UNIQUE) | — | |
| provider | text | — | correios, loggi, frenet, manual |
| status | text | 'pending' | pending, processing, done, failed |
| attempts | integer | 0 | Contador de tentativas |
| error_message | text | NULL | Último erro |
| created_at | timestamptz | now() | |
| processed_at | timestamptz | NULL | |

### Colunas Adicionais em `shipments`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| label_url | text | URL/base64 da etiqueta |
| provider_shipment_id | text | ID da remessa na transportadora |
| invoice_id | uuid FK fiscal_invoices | NF-e vinculada |
| service_code | text | Código do serviço (03220, 03298) |
| nfe_key | text | Chave de acesso da NF-e |

### Status `draft` em `delivery_status`

Novo valor no enum para representar rascunhos logísticos que aguardam envio manual.

---

## Retry e Limpeza

| Regra | Valor |
|-------|-------|
| Máximo de tentativas | 5 |
| Status após exaustão | `failed` |
| Limpeza de itens `done` | 7 dias (scheduler-tick) |

---

## UI — Abas de Remessas

A tela de Logística > Remessas é dividida em 3 abas:

| Aba | Conteúdo | Fonte |
|-----|----------|-------|
| **Prontos para emitir remessa** | Pedidos com rascunho logístico (`shipments.delivery_status = 'draft'`) aguardando emissão | `shipments` WHERE `delivery_status = 'draft'` |
| **Remessas emitidas** | Remessas enviadas com sucesso à transportadora (qualquer status exceto `draft` e `failed`) | `shipments` WHERE `delivery_status NOT IN ('draft', 'failed')` |
| **Remessas pendentes** | Remessas com erro que precisam de correção manual e reenvio | `shipments` WHERE `delivery_status = 'failed'` |

---

## Correções Aplicadas

| Data | Versão | Correção |
|------|--------|----------|
| 2026-04-06 | v2.3.1 | Nomes de colunas de endereço corrigidos (shipping_street, shipping_postal_code, etc.) |
| 2026-04-06 | v2.3.2 | Coluna de profundidade corrigida de `length` para `depth` (nome real no schema `products`) |
| 2026-04-06 | v2.3.3 | Campo `products.weight` padronizado para gramas (g). Removidas conversões `*1000` de todas as edge functions. Dados existentes migrados. |

---

## Pendências Futuras

- [ ] UI de etiquetas para impressão (aba "Etiquetas")
- [ ] Envio em lote de remessas
- [ ] Integração de status remessa ↔ NF-e na lista fiscal
- [ ] Notificações automáticas de rastreio ao cliente
