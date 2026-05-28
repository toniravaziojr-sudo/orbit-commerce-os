# Plano — "Emitir Remessa" passa a despachar o rascunho

## 📋 Checklist
- Docs lidos: `docs/especificacoes/erp/logistica.md`, `docs/especificacoes/erp/rascunhos-logisticos.md`, memórias `shipping-draft-mirrors-pedido-venda` e `shipment-mirrors-pedido-venda-em-aberto`.
- Fluxo: Logística → aba "Prontos para emitir remessa" → ação "Emitir Remessa".
- Fonte de verdade do rascunho: a própria linha de remessa (já tem peso, dimensões, transportadora, serviço, destinatário, overrides).
- Regra do sistema confirmada nos docs: **NF-e autorizada é obrigatória para emitir etiqueta**. Mantida.
- UI/UX: nenhuma mudança visual (botão no mesmo lugar, mesmo texto). Só o comportamento por trás muda.

## Causa raiz (determinística, não probabilística)

O botão "Emitir Remessa" hoje chama o motor antigo de criação de remessa **a partir do pedido**. Esse motor:
1. Exige um pedido vinculado. Vários rascunhos da fila atual são de PV manual/duplicado **sem pedido** — a seleção no checkbox usa o pedido como chave; quando ele é nulo, a seleção quebra e o envio vai com identificador vazio.
2. Exige NF-e autorizada. Correto pela regra, mas a mensagem hoje é genérica ("X falharam"), sem dizer qual rascunho e por quê.
3. Reconstrói tudo a partir do pedido, ignorando o rascunho que o operador acabou de ajustar (peso, endereço, serviço). O override só é aplicado quando o rascunho é encontrado por pedido — para órfãos, nunca é.

## O que vou ajustar

1. **Entrada do motor de emissão** passa a aceitar o **id do rascunho** (caminho novo) e segue aceitando o id do pedido (compatibilidade com chamadas internas existentes do scheduler e da automação NF→Etiqueta).
2. Quando entra pelo rascunho: o motor lê tudo do próprio rascunho. Se há pedido, usa pedido para campos faltantes; se não há, lê do Pedido de Venda vinculado e dos itens do PV. Override manual continua tendo precedência.
3. NF-e segue obrigatória (regra do sistema). Para PV sem pedido, busca-se a NF-e autorizada pelo PV. Quando faltar, mensagem clara em PT-BR identificando o rascunho.
4. **Mensagens por linha**: substitui o toast genérico "X falharam" por feedback por rascunho — sucesso com código de rastreio, falha com motivo de negócio (faltou NF-e, faltou CEP, faltou peso, recusa da transportadora, etc.).
5. **Seleção da lista** passa a usar o id do rascunho. Resolve PV sem pedido e o caso de mais de um rascunho por pedido.

## Resultado final
- Botão "Emitir Remessa" despacha exatamente o que está visível na fila, respeitando overrides e PVs sem pedido.
- Erros aparecem por linha, com texto de negócio claro.
- Pedido original e remessas já postadas nunca são tocados.

## Bloco técnico
- `ShipmentGenerator.tsx`: `selectedOrders` vira `selectedShipments: Set<string>` (id do rascunho). `handleGenerateShipments` itera ids e chama novo hook `useDispatchShipment({ shipment_id })`. Mostra resultados por linha.
- `useShipments.ts`: adicionar `useDispatchShipment({ shipment_id })`.
- `supabase/functions/shipping-create-shipment/index.ts`: aceitar `shipment_id` no body. Quando presente, carregar tenant/order/PV via shipment. Hidratar order virtual a partir de `fiscal_invoices + fiscal_invoice_items + products` quando `order_id` é nulo. Override continua valendo. Buscar NF-e por `order_id` quando existir, senão por `source_order_invoice_id = pv.id` (NF gerada a partir do PV) ou diretamente pelo próprio PV se ele já estiver autorizado. Manter caminho `order_id` para chamadas internas legadas.
- Sem migração de banco.

## Validação técnica que vou executar
1. Build do projeto (lint/tsc) sem erro.
2. Chamar a edge function com `shipment_id` de um rascunho válido do `respeiteohomem` (sem efetuar postagem real — vou usar um rascunho cuja NF-e ainda não está autorizada para confirmar a mensagem clara, e um caso com NF-e autorizada para confirmar o fluxo até a chamada Correios).
3. Conferir logs.

## 📝 Documentação
- `docs/especificacoes/erp/logistica.md`: atualizar a seção "Emissão de Remessa" — nova entrada por id do rascunho, mensagens por linha, comportamento para PV sem pedido.
- Memória `shipment-mirrors-pedido-venda-em-aberto`: nota curta sobre o despacho consumir o rascunho.
- `mapa-ui.md`: sem mudança visual.

📌 Status: Plano fechado, partindo para implementação.
