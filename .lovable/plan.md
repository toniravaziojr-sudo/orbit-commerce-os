## Objetivo
Fechar o fluxo Mercado Livre → Pratika end-to-end e usar o pedido #677 como teste real do backfill. Confirmado: se não chegou na Pratika, ninguém separou — então o backfill é seguro e obrigatório.

## Como funciona hoje
- Pedido ML pago → NF-e emitida → NF enviada ao ML → etiqueta baixada e rastreio gravado.
- Envio para a Pratika (`send_combined`) só é disparado pelo fluxo interno (Correios/Frenet). Pedidos de marketplace não têm caller → ficam invisíveis no WMS.
- `shipping_status` de pedidos ML fica com valores crus do ML (`ready_to_ship`, `pending`), fora do vocabulário canônico.

## O problema
1. Pratika nunca recebe NF + etiqueta de pedidos de marketplace → operação não consegue separar/despachar. Crítico: sem Pratika, o pedido simplesmente não sai.
2. `shipping_status` divergente confunde UI, relatórios e automações futuras.
3. Pedido #677 está exatamente nesse buraco.

## O que eu faria

### 1. Acoplar Pratika ao fluxo de marketplace (correção estrutural)
Em `meli-fetch-shipment`, após gravar tracking + salvar PDF da etiqueta no bucket:
- Se o tenant tem `wms_pratika_configs` ativo E o pedido tem NF-e autorizada com XML disponível → disparar `send_combined` com XML da NF + PDF da etiqueta ML.
- Idempotência: gravar `sent_to_wms_at` em `marketplace_shipments` para não reenviar em re-execuções do cron.
- Se não tem Pratika configurada → segue igual, nada muda.
- Se tem Pratika mas NF ainda não está autorizada → não dispara agora; o próximo ciclo do cron reavalia (a NF vai ficar pronta em minutos).
- Ajustar `wms-pratika-reconcile` para reconhecer rastreios de marketplace (códigos AR/AD via ML) e não emitir alerta falso de "rastreio órfão".

### 2. Padronizar `shipping_status` canônico
Mapeamento aplicado em `meli-sync-orders` e `meli-fetch-shipment`:
- ML `pending` / `handling` → `awaiting_shipment`
- ML `ready_to_ship` sem tracking → `awaiting_label`
- ML `ready_to_ship` com tracking → `label_generated`
- ML `shipped` → `shipped`
- ML `delivered` → `delivered`
- ML `cancelled` / `not_delivered` → `cancelled`
Backfill único do `shipping_status` do #677 durante o teste.

### 3. Backfill controlado do #677 (teste real do fluxo novo)
Sequência: deploy do novo `meli-fetch-shipment` → invocar manualmente para o #677 → validar que:
- `shipping_status` normalizou para valor canônico.
- `send_combined` foi chamada e `wms_pratika_logs` registrou sucesso.
- `sent_to_wms_at` foi gravado.
- Pedido aparece no painel Pratika (usuário confirma visualmente).
Se a Pratika retornar erro, paro, reporto o erro real e não repito cegamente.

### 4. Documentação
- `docs/especificacoes/marketplaces/mercado-livre.md`: novo passo "Envio para WMS" no ciclo de vida.
- `docs/especificacoes/logistica/logistica-externa.md`: Pratika passa a receber pedidos de marketplace via `meli-fetch-shipment`.
- Memória `wms-pratika-anchored-on-fiscal-invoice`: adicionar marketplace como caller válido de `send_combined`.
- Registrar tabela de mapeamento canônico de `shipping_status` ML → sistema.

## Resultado final
- Pedido #677 entra na Pratika com NF + etiqueta prontas para separação.
- Todo pedido ML futuro segue automaticamente: pago → NF → etiqueta → Pratika, sem toque humano.
- `shipping_status` uniforme em todo o sistema.
- Sem regressão no fluxo interno: o `send_combined` existente continua igual, só ganhou um novo caller.
