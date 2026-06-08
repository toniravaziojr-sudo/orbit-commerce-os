---
name: Cancelamento de NF travado por estado do objeto logístico (com mensagens PT-BR)
description: NF de venda só pode ser cancelada se não houver objeto OU se ele estiver em draft/label_created/cancelled. Em qualquer outro estado (postado, em trânsito, entregue, devolvido) o cancelamento é bloqueado em 2 camadas (UI + edge), com mensagem clara em PT-BR contendo rastreio e data quando aplicável.
type: constraint
---

# Trava: cancelar NF só com objeto em estado permitido

## Regra inegociável (2026-06-08)

Cancelar uma NF de venda autorizada **só é permitido** quando o objeto de
postagem vinculado (`shipments` via `invoice_id` OU
`source_pedido_venda_id`) está em um destes estados:

- `draft` (etiqueta em preparo)
- `label_created` (etiqueta gerada, ainda não postada fisicamente)
- `cancelled`

OU quando **não existe objeto** vinculado.

Qualquer outro estado (`posted`, `in_transit`, `out_for_delivery`,
`delivered`, `returned`, `returning`) **bloqueia** o cancelamento.

## Defesa em 2 camadas (obrigatórias)

### Camada 1 — UI (`CancelInvoiceDialog`)
Ao abrir o diálogo, pré-consulta `shipments` por `invoice_id`/
`source_pedido_venda_id`. Se houver objeto fora dos estados permitidos:
- esconde o textarea de justificativa;
- esconde o botão "Confirmar Cancelamento";
- exibe `Alert variant="destructive"` com a mensagem PT-BR completa.

### Camada 2 — Edge `fiscal-cancel`
Repete a mesma checagem antes de chamar a Focus NFe. Resposta padrão:
```json
{ "success": false, "code": "shipment_blocks_cancel", "error": "<msg PT-BR>", "blocking_shipment": { "tracking_code": "...", "delivery_status": "...", "delivered_at": "..." } }
```

## Mensagens obrigatórias (PT-BR)

| Estado | Mensagem |
|---|---|
| `posted` / `in_transit` / `out_for_delivery` | "Não é possível cancelar esta NF: o pedido já foi despachado e está em rota de entrega (rastreio: AP...). Para cancelar a NF, primeiro cancele o objeto de postagem no módulo de Logística." |
| `delivered` | "Não é possível cancelar esta NF: o pedido já foi entregue ao cliente (rastreio: AP..., entregue em DD/MM/AAAA). Notas de pedidos entregues não podem ser canceladas — utilize uma NF de devolução se for o caso." |
| `returned` / `returning` | "Não é possível cancelar esta NF: o pedido foi devolvido. Registre uma NF de devolução em vez de cancelar a original." |

Rastreio sempre exibido entre parênteses quando disponível. Data formatada
em BRT (`America/Sao_Paulo`).

## O que NUNCA pode acontecer

- Cancelar NF de pedido já entregue ao cliente.
- UI permitir clicar em "Confirmar Cancelamento" enquanto o objeto está em
  movimento.
- Edge devolver `success: true` para um objeto fora dos estados permitidos.
- Mensagem técnica vazar para o usuário (ex.: `shipment_blocks_cancel`,
  códigos da Focus, nomes de tabela). Sempre PT-BR de negócio.
- Remover a Camada 1 (UI) e confiar só na Camada 2 — a defesa em
  profundidade é obrigatória.

## Arquivos

- Edge: `supabase/functions/fiscal-cancel/index.ts` (bloco "TRAVA POR ESTADO
  DO OBJETO LOGÍSTICO").
- UI: `src/components/fiscal/CancelInvoiceDialog.tsx`.
- Doc: `docs/especificacoes/erp/erp-fiscal.md` §"Cancelamento de NF × Objeto Logístico".
- Memória relacionada: `mem://constraints/nf-cancel-reopens-pv-clean`.
