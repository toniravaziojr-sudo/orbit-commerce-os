
# Plano: Fluxo Integrado NF-e → Remessa → Despacho

## Ciclo de Vida Completo do Pedido (pós-pagamento)

```text
Pagamento Aprovado
    │
    ├── fiscal_draft_queue → Rascunho NF-e (draft)
    └── shipping_draft_queue → Rascunho Logístico (draft)
    │
    ▼
Emissão da NF-e (manual ou futuramente em lote)
    │
    ├── NF-e autorizada → status 'authorized'
    │   └── Pedido muda para 'processing'
    │
    ▼
Emissão da Remessa (depende de NF-e autorizada)
    │
    ├── auto_create_shipment = true → envia automaticamente
    │   └── Sucesso → shipment status: 'shipped', tracking_code preenchido
    │   └── Falha → shipment status: 'failed' (aba "Remessas pendentes")
    │
    ├── auto_create_shipment = false → fica em 'draft' na aba "Prontos para emitir"
    │   └── Usuário clica "Emitir Remessa" → envia direto à transportadora
    │   └── Sucesso → shipment status: 'shipped'
    │   └── Falha → shipment status: 'failed' (aba "Remessas pendentes")
    │
    ▼
Impressão (Etiqueta + DANFE)
    │
    ├── Botões individuais: "Imprimir Etiqueta" / "Imprimir DANFE"
    ├── Ação "Despachar": modal com preview etiqueta + DANFE, imprime ambos
    └── Impressão em lote: seleciona múltiplos, gera PDF consolidado
    │
    ▼
Despacho → Pedido muda para 'dispatched'
    │
    ▼
Rastreamento (polling automático por transportadora)
    │
    ├── Primeira movimentação ("coletado"/"a caminho") → Pedido: 'shipped'
    ├── Em trânsito → Pedido: 'in_transit'
    ├── Saiu para entrega → Pedido: 'out_for_delivery'
    └── Entregue → Pedido: 'delivered'
```

---

## Etapa 1 — Status do Pedido (Ajuste)

Adicionar status `dispatched` ao ciclo de vida do pedido:

| Status Atual | Novo Status | Gatilho |
|---|---|---|
| `processing` | `dispatched` | Etiqueta impressa (ação "Despachar") |
| `dispatched` | `shipped` | Primeira movimentação do rastreio na transportadora |

O status `shipped` passa a significar "em posse da transportadora" (não mais "etiqueta emitida").

---

## Etapa 2 — Dependência NF-e → Remessa

**Regra:** Remessa só pode ser emitida se existir NF-e com status `authorized` vinculada ao pedido.

Implementação:
- Na aba "Prontos para emitir remessa": só exibir pedidos que tenham NF-e autorizada
- No `shipping-create-shipment`: validar existência de NF-e autorizada antes de enviar
- No `auto_create_shipment`: só disparar se a NF-e retornou `authorized`

---

## Etapa 3 — Vínculo NF-e ↔ Remessa

Ao autorizar NF-e:
1. Preencher `shipments.nfe_key` com `fiscal_invoices.chave_acesso`
2. Preencher `shipments.invoice_id` com o ID da NF-e
3. Se `auto_create_shipment = true` → chamar `shipping-create-shipment` automaticamente

---

## Etapa 4 — UI de Impressão e Despacho

### 4.1 Botões Individuais
Em cada remessa emitida (aba "Remessas emitidas"):
- **Imprimir Etiqueta**: abre `label_url` em nova aba (PDF)
- **Imprimir DANFE**: abre `danfe_url` da NF-e vinculada em nova aba (PDF)

### 4.2 Ação "Despachar"
Na aba "Prontos para emitir remessa" (após emissão):
- Botão "Despachar" → modal com:
  - Preview/link da etiqueta
  - Preview/link do DANFE
  - Botão "Imprimir Tudo" (abre ambos)
  - Botão "Confirmar Despacho" → muda pedido para `dispatched`

### 4.3 Impressão em Lote
- Checkboxes para selecionar múltiplas remessas
- Botão "Imprimir Selecionadas" → gera/abre todas as etiquetas + DANFEs

---

## Etapa 5 — Aba "Remessas Pendentes" (Erros)

Quando uma remessa falha (automática ou manual):
- Exibe na aba "Remessas pendentes" com mensagem de erro
- Botão "Tentar Novamente" → reenvia à transportadora
- Permite edição de dados antes do reenvio (endereço, peso, etc.)

---

## Etapa 6 — Rastreamento e Transição Automática de Status

Pesquisar e mapear eventos de cada transportadora:

| Transportadora | Evento "Coletado" | Endpoint |
|---|---|---|
| Correios | Evento SRO tipo "coleta" ou "postagem" | `GET /rastro/v1/objetos/{codigo}` |
| Loggi | Status "collected" ou "in_transit" | API Loggi tracking |
| Frenet | Via webhook/polling do gateway | API Frenet |

O `scheduler-tick` (nova fase ou existente) faz polling periódico e atualiza:
- `shipments.delivery_status` conforme evento
- `orders.status` conforme mapeamento acima

---

## Etapa 7 — Documentação

Atualizar:
- `erp-fiscal.md`: fluxo pós-autorização com vínculo remessa
- `rascunhos-logisticos.md`: dependência NF-e, fluxo de despacho
- `logistica.md`: status `dispatched`, mapeamento de eventos por transportadora

---

## Resumo de Entregas

| Entrega | Tipo |
|---|---|
| Status `dispatched` no ciclo do pedido | Migração DB |
| Validação NF-e obrigatória na remessa | Edge function |
| Vínculo automático NF-e → shipment | Edge function |
| UI: botões imprimir etiqueta/DANFE | Frontend |
| UI: modal "Despachar" | Frontend |
| UI: impressão em lote | Frontend |
| UI: aba remessas pendentes (reenvio) | Frontend |
| Polling de rastreio com transição de status | Edge function + scheduler |
| Documentação completa | Docs |

## Ordem de Execução

```
1. Migração DB (status dispatched)
2. Edge functions (vínculo NF-e, validação, auto-create)
3. UI de impressão e despacho
4. Polling de rastreio (pode ser fase posterior)
5. Documentação
```
