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

## Fluxo Completo: NF-e → Remessa → Despacho

```text
Pagamento Aprovado (trigger em orders)
    │
    ├── fiscal_draft_queue    → Rascunho NF-e (draft)
    └── shipping_draft_queue  → Rascunho Logístico (draft)
    │
    ▼
Emissão da NF-e (manual pelo usuário)
    │
    ├── NF-e autorizada → status 'authorized'
    │   ├── shipments.nfe_key e invoice_id preenchidos (helper nfe-shipment-link.ts)
    │   └── Pedido muda para 'processing'
    │
    ▼
Emissão da Remessa (depende de NF-e autorizada — OBRIGATÓRIA)
    │
    ├── auto_create_shipment = true → envia automaticamente à transportadora
    │   └── Sucesso → shipment: 'label_created', tracking_code preenchido
    │   └── Falha → shipment: 'failed' (aba "Remessas pendentes")
    │
    ├── auto_create_shipment = false → fica em 'draft' (aba "Prontos para emitir")
    │   └── Usuário seleciona e clica "Emitir Remessa" → envia à transportadora
    │
    ▼
Impressão (Etiqueta + DANFE)
    │
    ├── Botões individuais: "Imprimir Etiqueta" / "Imprimir DANFE"
    ├── Ação "Despachar": modal com preview + confirma despacho
    └── Impressão em lote: seleciona múltiplos na aba "Remessas emitidas"
    │
    ▼
Despacho → Pedido muda para 'dispatched' (shipped_at preenchido)
    │
    ▼
Rastreamento (polling automático — PENDENTE)
    │
    ├── Primeira movimentação ("coletado"/"a caminho") → Pedido: 'shipped'
    ├── Em trânsito → Pedido: 'in_transit'
    └── Entregue → Pedido: 'delivered'
```

### Regra de Status do Pedido (CRÍTICA)

| Status | Gatilho | Quem muda |
|--------|---------|-----------|
| `processing` | NF-e autorizada | Edge function (fiscal-*) |
| `dispatched` | Usuário confirma despacho (imprime etiqueta) | Frontend (ShipmentGenerator) |
| `shipped` | Primeira movimentação do rastreio | Polling automático (futuro) |

**NUNCA** mudar pedido para `shipped` diretamente na emissão da remessa ou NF-e.

---

## Dependência NF-e → Remessa

| Aspecto | Regra |
|---------|-------|
| **NF-e obrigatória** | Remessa só pode ser emitida se existir NF-e com status `authorized` vinculada ao pedido |
| **Validação** | `shipping-create-shipment` verifica `fiscal_invoices` WHERE `order_id = X AND status = 'authorized'` |
| **Bloqueio** | Se não houver NF-e autorizada, retorna erro: "Emita a NF-e antes de criar a remessa" |

---

## Helper Compartilhado: nfe-shipment-link.ts

Módulo `_shared/nfe-shipment-link.ts` centraliza o vínculo NF-e → Remessa. Chamado por:
- `fiscal-submit` (Focus NFe)
- `fiscal-emit` (Nuvem Fiscal)
- `fiscal-webhook` (callback assíncrono)
- `fiscal-check-status` (polling manual)
- `fiscal-get-status` (consulta Focus)

**Responsabilidades:**
1. Preencher `shipments.nfe_key` e `shipments.invoice_id` no draft existente
2. Se `auto_create_shipment = true`, chamar `shipping-create-shipment`
3. Atualizar `orders.status` para `processing`

---

## Gatilho de Criação

| Campo | Valor |
|-------|-------|
| **Evento** | `payment_status` muda para `approved` na tabela `orders` |
| **Mecanismo** | Trigger SQL `enqueue_fiscal_draft()` — insere simultaneamente em `fiscal_draft_queue` e `shipping_draft_queue` |
| **Atomicidade** | 100% — INSERT atômico dentro da mesma transação do UPDATE do pedido |
| **Deduplicação** | `ON CONFLICT (order_id) DO NOTHING` — impede duplicatas |

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

## Dados Físicos dos Produtos

> **IMPORTANTE:** O campo `products.weight` armazena peso em **gramas** (g). O campo de dimensões de comprimento no banco é `products.depth` (não `length`). Não é necessária conversão de unidade ao enviar para transportadoras — o valor já está em gramas.

`shipping-create-shipment` busca pesos e dimensões reais dos produtos vinculados ao pedido (via `order_items.product_id → products`), com fallbacks:
- Peso: 300g
- Altura: 10cm
- Largura: 15cm
- Profundidade: 20cm

---

## Modos de Operação

Configurável via `fiscal_settings.auto_create_shipment`:

| Modo | Flag | Comportamento |
|------|------|--------------|
| **Automático** | `true` | Ao autorizar NF-e, o sistema envia a remessa automaticamente à transportadora |
| **Manual** | `false` | O rascunho permanece com status `draft` para envio manual pelo módulo logístico |

---

## UI — Abas de Remessas

A tela de Logística > Remessas é dividida em 3 abas:

| Aba | Conteúdo | Ações disponíveis |
|-----|----------|-------------------|
| **Prontos para emitir** | Shipments com `delivery_status = 'draft'` | Selecionar + "Emitir Remessa" (em lote) |
| **Remessas emitidas** | Shipments com status excluindo `draft` e `failed` | Imprimir Etiqueta, Imprimir DANFE, Despachar, Impressão em lote |
| **Remessas pendentes** | Shipments com `delivery_status = 'failed'` | Reenviar |

### Ação "Despachar"

Modal que exibe dados do pedido + botões de impressão + botão "Confirmar Despacho":
- Muda `orders.status` → `dispatched`
- Preenche `orders.shipped_at`
- Registra em `order_history`

### Impressão em Lote

Na aba "Remessas emitidas", checkboxes permitem selecionar múltiplas remessas e imprimir:
- Apenas etiquetas
- Apenas DANFEs
- Ambos

---

## Filtros e Exibição da Tela Rastreios

A tela `/shipments` (Rastreios) trabalha com **três campos** que descrevem o envio, propagados obrigatoriamente do pedido para a remessa:

| Campo da remessa | Significado | Origem (pedido) |
|------------------|-------------|-----------------|
| `carrier` | Transportadora (Correios, Loggi, Frenet) | `orders.shipping_carrier` |
| `service_name` | Serviço escolhido (PAC, Sedex, Loggi Express, etc) | `orders.shipping_service_name` |
| `service_code` | Código do serviço (ex: 03298=PAC, 03220=Sedex) | `orders.shipping_service_code` |

### Propagação obrigatória
Toda criação de remessa (rascunho automático em `scheduler-tick`, etiqueta gerada via `shipping-create-shipment`, ou registro manual em `shipping-register-manual`) **deve** copiar os três campos do pedido. Se a entrada vier com `carrier="PAC"` ou `"Sedex"` (legado), o sistema normaliza automaticamente para `carrier="Correios"` + `service_name="PAC"|"Sedex"` + `service_code="03298"|"03220"`.

### Exibição
Cada linha mostra o **badge da transportadora** (Correios/Loggi/Frenet) e abaixo, em texto secundário, o **serviço** (PAC, Sedex, etc).

### Filtros disponíveis
A tela tem **dois filtros independentes** que combinam:

**Filtro 1 — Transportadora**
| Opção | Casamento (case-insensitive) |
|-------|------------------------------|
| **Correios** | `carrier ILIKE 'correios'` OU `'pac'` OU `'sedex'` (cobre legado) |
| **Loggi** | `carrier ILIKE 'loggi'` |
| **Frenet** | `carrier ILIKE 'frenet'` |
| **Sem integração (fallback)** | `carrier ILIKE '%fallback%'` |
| **Sem transportadora** | `carrier IS NULL` |

**Filtro 2 — Serviço (dinâmico)**
Lista populada a partir dos `service_name` distintos existentes nas remessas do tenant (PAC, Sedex, Loggi Express, etc). Garante que apareçam apenas serviços realmente em uso.

> **Importante:** PAC e Sedex são *serviços* dos Correios, não transportadoras separadas. O filtro Transportadora=Correios sempre cobre PAC e Sedex; para refinar, use o filtro Serviço.

---

## Correções Aplicadas

| Data | Versão | Correção |
|------|--------|----------|
| 2026-04-06 | v2.3.1 | Nomes de colunas de endereço corrigidos |
| 2026-04-06 | v2.3.2 | Coluna de profundidade corrigida de `length` para `depth` |
| 2026-04-06 | v2.3.3 | Campo `products.weight` padronizado para gramas (g) |
| 2026-04-06 | v2.4.0 | Fluxo integrado NF-e → Remessa → Despacho. Helper nfe-shipment-link.ts. NF-e obrigatória. Status dispatched. UI de impressão e despacho. |
| 2026-04-14 | v2.4.1 | Filtros de Rastreios cobrindo PAC/Sedex como Correios, fallback dedicado e "Sem transportadora". Normalização case-insensitive. |
| 2026-04-16 | v2.5.0 | Coluna `shipments.service_name` adicionada. Propagação obrigatória dos 3 campos (carrier+service_name+service_code) em scheduler-tick, shipping-create-shipment e shipping-register-manual. UI passa a mostrar "Correios · PAC/Sedex" e ganha filtro dinâmico de Serviço. Backfill aplicado no tenant Respeite o Homem (106 remessas normalizadas). |

---

## Pendências Futuras

- [ ] Polling automático de rastreio com transição de status (dispatched → shipped → in_transit → delivered)
- [ ] Mapeamento de eventos de rastreio por transportadora (Correios SRO, Loggi, Frenet)
- [ ] Envio em lote de remessas
- [ ] Notificações automáticas de rastreio ao cliente
