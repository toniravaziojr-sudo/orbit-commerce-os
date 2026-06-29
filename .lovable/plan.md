📋 CHECKLIST DE CONFORMIDADE:
- Doc de Regras lido ✅ (working-rules, logística-externa, mercado-livre v3.12, orderTransitions)
- Tema: Pedidos (status de envio) + Mercado Livre (imagem do item)
- Fluxo afetado: exibição do status base na esteira logística + ingestão de itens do ML
- Fonte de verdade: enum canônico `awaiting_shipment` (orderStatus.ts) e `product_images` (catálogo)
- Módulos impactados: Pedidos (detalhe/lista), Logística Interna, Logística Externa, sync ML
- UI impactada: rótulo de status no detalhe/lista — sem nova rota, sem mexer no mapa-ui
- Situação: Aguardando confirmação do usuário

---

## 1) Status base "Aguardando etiqueta"

**Como funciona hoje**
- O enum canônico já tem `awaiting_shipment` (rótulo atual: "Aguardando envio"), que é exatamente o estado pré-etiqueta. As transições partem dele para `label_generated → shipped → in_transit → arriving → delivered`.
- O valor legado no banco é `pending` (DB confirma: pedidos #662/#663 ML estão com `shipping_status='pending'`). A lista de pedidos normaliza e mostra "Aguardando envio", mas o **seletor do detalhe** lê o valor cru e por isso aparece **vazio** quando o pedido ainda está no estado legado.

**O problema**
- Rótulo "Aguardando envio" é ambíguo com "Enviado". O usuário quer "Aguardando etiqueta" para deixar claro que é o estado anterior à geração da etiqueta.
- O seletor do detalhe aparece vazio em pedidos com valor legado.

**O que eu faria (mudança mínima, zero regressão)**
1. Renomear o **rótulo** de `awaiting_shipment` de "Aguardando envio" → **"Aguardando etiqueta"** no único ponto de verdade (`src/types/orderStatus.ts` → `SHIPPING_STATUS_CONFIG`).
2. Trocar as 2 strings literais remanescentes ("Aguardando envio") em `OrderNew.tsx` (placeholder + item do select inicial) e no filtro de `Orders.tsx` para "Aguardando etiqueta", mantendo os mesmos valores canônicos.
3. No `OrderDetail.tsx`, passar o valor pelo `normalizeShippingStatus(order.shipping_status)` no `value` do `<Select>` para que pedidos com `pending` legado já exibam o status base preenchido.
4. **Não mexer** em: enum do banco, transições (`orderTransitions.ts`), `core-orders`, triggers de fiscal/logística, fluxo de geração de etiqueta. Continua tudo entrando como `awaiting_shipment` e avançando para `label_generated` quando a etiqueta é gerada.

**Resultado final**
- Lista e detalhe do pedido — tanto loja virtual quanto Mercado Livre — mostram **"Aguardando etiqueta"** desde que o pedido entra na esteira logística até a etiqueta ser gerada. Sem alteração de fluxo, sem migração de dados.

---

## 2) Imagem do produto ausente nos itens dos pedidos do Mercado Livre

**Como funciona hoje**
- `meli-sync-orders` insere `order_items` sem `product_image_url`. Mesmo quando o SKU bate com um produto do catálogo (vínculo `product_id` correto), a imagem fica nula e o card do pedido exibe o ícone genérico de pacote.

**O que eu faria**
1. No `meli-sync-orders`, ao montar o `skuMap` (já busca peso/barcode/NCM), incluir uma consulta paralela a `product_images` para os `product_id` resolvidos, escolhendo a imagem com `is_primary=true` (fallback: menor `sort_order`).
2. Preencher `product_image_url` no insert de `order_items`:
   - 1ª prioridade: imagem do catálogo (quando o SKU bate).
   - Fallback: `it.item.secure_thumbnail` ou `it.item.thumbnail` que o ML devolve no payload de `/orders` (mantém alguma imagem mesmo quando o SKU não existe no catálogo).
3. Backfill pontual dos pedidos #662 e #663: atualizar `product_image_url` dos itens já gravados, usando a mesma regra (catálogo → fallback ML).

**Resultado final**
- Itens dos pedidos do ML passam a mostrar a imagem do produto cadastrado. Quando o SKU não existir no catálogo, mostra o thumbnail do anúncio do ML. Pedidos antigos corrigidos via backfill controlado.

---

## Documentação obrigatória ao final
- `docs/especificacoes/marketplaces/mercado-livre.md` — anexar nota em "Sync de Pedidos v3.12" sobre resolução de imagem do item (catálogo + fallback ML).
- `docs/especificacoes/ecommerce/pedidos.md` (ou doc de status) — registrar rótulo canônico "Aguardando etiqueta" para `awaiting_shipment`.
- Sem alteração em `mapa-ui.md` (mesma rota, mesmo componente).

## Validação técnica que vou executar
- SQL em `orders` confirmando que #662/#663 continuam com `shipping_status` válido e que os itens passam a ter `product_image_url`.
- Build/lint da edge `meli-sync-orders` após deploy.
- Conferência visual no detalhe do pedido (#662) e na lista — o usuário valida o rótulo.

## Pontos que NÃO faço sem sua confirmação
- Não vou criar novo valor de enum no banco (mantenho `awaiting_shipment` e só renomeio o rótulo).
- Não vou alterar transições, gatilhos fiscais nem o fluxo de geração de etiqueta.
- Não vou tocar em outros rótulos de status além desse.

Confirma que eu sigo com os 2 ajustes dessa forma?
