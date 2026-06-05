# Plano — Integração Pratika 100% à prova de falhas (APLICADO)

## Status: Ajustes aplicados — pendente de validação E2E real

### O que foi feito
- Nova ação **send_combined(order_id)** centraliza o envio: NF + rastreio sempre juntos, na mesma invocação. Se um dos lados não está pronto, responde "waiting" e não envia.
- **CNPJ sempre sanitizado** para 14 dígitos puros antes de qualquer chamada (inclusive teste de conexão). Sem 14 dígitos → aborta com mensagem clara.
- **Chave de acesso sempre 44 dígitos puros** antes do envio do rastreio.
- **Bloqueio defensivo** das ações isoladas (`send_nfe`, `update_tracking`): só executam com `force=true` (uso administrativo). Chamada sem `force` é recusada com mensagem simétrica.
- **Idempotência em duas camadas:** log combinado por pedido (sucesso anterior → não reenvia) + logs por sub-etapa (NF e rastreio) para retomar após falha parcial sem reenviar a etapa já confirmada.
- **Gatilhos atualizados:** `fiscal-webhook`, `fiscal-check-status`, `shipping-create-shipment` e `shipping-register-manual` agora chamam `send_combined` com `order_id`.
- **Reconciliação adaptada:** o cron de 30 min varre pedidos com NF autorizada + rastreio sem log `combined=success` e reenfileira a operação combinada.
- **Documentação:** atualizada a especificação de Logística (§Integração WMS Pratika) e a memória da integração; criada memória de anti-regressão.

### O que falta
- Novo teste E2E real ponta a ponta: emitir NF e gerar etiqueta de um pedido pago, confirmar log `combined=success` no histórico do tenant e confirmar com a Pratika que NF + rastreio apareceram no painel da loja.
