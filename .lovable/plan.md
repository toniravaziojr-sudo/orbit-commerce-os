## Objetivo

Fechar o ciclo dos pedidos do Mercado Livre: mostrar status correto de cancelamento, exibir aviso discreto do motivo, e completar o envio da NF-e para o ML do pedido pago (#665) para liberar a etiqueta e voltar o rastreio para o módulo Logística Externa.

---

## Onda 1 — Status correto "Cancelado" no módulo Pedidos

**Hoje:** os pedidos cancelados do ML (#662 e #663) aparecem como "Pagamento expirado" porque o sistema recebe o status `cancelled` mas a tela não traduz esse valor — cai num fallback antigo.

**O que fazer:** ensinar a tela a reconhecer o status `cancelled` e mostrar o badge correto "Cancelado" (vermelho), tanto na lista quanto no detalhe do pedido. Sem mexer em gatilhos, banco ou regras fiscais.

---

## Onda 2 — Aviso discreto "Cancelado pelo comprador"

**Hoje:** quando o cancelamento vem do comprador, o sistema mostra um banner grande em vermelho ocupando o topo da tela.

**O que fazer:** trocar o banner grande por **uma linha pequena** (chip / texto fino em vermelho) logo abaixo do status, em três lugares:

1. **Módulo Pedidos** — abaixo do status "Cancelado".
2. **Pedido de Venda** (fiscal) — abaixo do status do pedido de venda.
3. **Nota Fiscal** — abaixo do status da NF (Autorizada/Cancelada).

Texto exibido: `Pedido cancelado pelo comprador` (ou o motivo real retornado pelo ML, quando houver). O banner grande de "ação manual necessária" continua existindo só quando há NF autorizada ou etiqueta despachada que exigem ação concreta — caso contrário, fica apenas a linha discreta.

---

## Onda 3 — Envio da NF para o Mercado Livre (pedido #665)

**Hoje:** o pedido #665 já está pago e com NF autorizada, mas o envio da NF para o ML falha — o sistema manda em formato errado e o ML recusa, então a etiqueta nunca é liberada.

**O que fazer:**

1. Corrigir o envio da NF para o ML usando o formato correto exigido pela API deles (XML autêntico da SEFAZ, não JSON).
2. Após o ML aceitar, ele libera a etiqueta/rastreio.
3. Trazer automaticamente essa etiqueta e código de rastreio para o módulo **Logística Externa**, fechando o ciclo.
4. Reprocessar o #665 agora para validar o fluxo de ponta a ponta.

---

## Onda 4 — Validação técnica e documentação

- Confirmar no banco/tela que #662 e #663 aparecem como "Cancelado" com a linha "cancelado pelo comprador".
- Confirmar que #665 envia NF, recebe etiqueta e aparece em Logística Externa.
- Atualizar os docs: `docs/especificacoes/marketplaces/mercado-livre.md`, `docs/especificacoes/logistica/logistica-externa.md` e `assuntos-em-andamento.md`.
- Registrar memória anti-regressão sobre o formato XML do envio de NF ao ML.

---

## Detalhes técnicos (para referência)

- **Onda 1:** ajuste em `src/types/orderStatus.ts` (mapeamento `cancelled` → variante destructive, label "Cancelado") + helpers usados em `useCustomerOrders` e listagens.
- **Onda 2:** novo componente `BuyerCancellationNotice` (linha discreta) consumindo `orders.cancellation_reason`. `OrderRegressionBanner` continua, mas só renderiza quando há `requires_action` em NF/shipment.
- **Onda 3:** reescrita de `meli-send-invoice` para `POST /fiscal_documents` com `Content-Type: application/xml`, payload = XML autorizado da SEFAZ. Após sucesso, popular `shipments` (tracking + carrier) via `meli-sync-shipments` ou inline.
- **Onda 4:** memória `mem://constraints/meli-invoice-xml-format`.

---

## Riscos / fora de escopo

- Não vou criar status novo `cancelled_by_buyer` (decisão já confirmada).
- Não vou tocar em gatilhos de banco, regras fiscais ou máquina de estados de pedidos.
- Mudanças de UI ficam restritas aos três pontos pedidos (Pedidos, Pedido de Venda, NF).
