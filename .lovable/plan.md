# Plano — Integração Pratika 100% à prova de falhas

## Como funciona hoje
A NF é enviada à Pratika assim que a Sefaz autoriza. A etiqueta é enviada em um segundo momento, quando o rastreio é registrado. Os dois eventos são independentes. Além disso, o CNPJ vai com máscara (pontos/barra/traço), o que faz a Pratika gravar os documentos num "balde" diferente do CNPJ real da loja.

## O problema confirmado pela Pratika
A Pratika só considera o documento "recebido" quando NF e etiqueta chegam **juntas**, sob o **mesmo CNPJ cru (14 dígitos)**. Hoje violamos os dois pontos — por isso no teste anterior nem a NF nem o rastreio apareceram no painel da loja.

## O que será feito

### 1. Envio acoplado: NF + rastreio sempre juntos
- Nova operação única de envio à Pratika, disparada **só quando os dois lados estão prontos** para o mesmo pedido (NF autorizada **e** rastreio registrado).
- Quando só um lado chega, o sistema marca como "aguardando o outro" e não envia nada.
- Quando o segundo lado chega, dispara a operação única: primeiro a NF, em seguida o rastreio, na mesma execução.
- Se a segunda chamada falhar, a primeira é marcada como pendente de reconciliação (não fica meio-enviada).
- Idempotência preservada: não reenvia se já houve sucesso anterior.

### 2. CNPJ sempre sanitizado (14 dígitos)
- Antes de qualquer chamada à Pratika (teste de conexão, envio de NF, atualização de rastreio), o CNPJ é reduzido aos 14 dígitos numéricos.
- Se não tiver 14 dígitos, a operação é abortada com mensagem clara nos logs e na tela de Aplicativos Externos.

### 3. Bloqueios defensivos
- Tentar enviar manualmente só a NF sem rastreio → recusado com mensagem clara: *"Aguardando código de rastreio para enviar à Pratika"*.
- Tentar enviar manualmente só a etiqueta sem NF autorizada → mesma recusa simétrica.

### 4. Reconciliação adaptada
- A rotina automática a cada 30 min passa a procurar pedidos com NF autorizada **e** rastreio existente que ainda não tiveram envio combinado bem-sucedido, e reenfileira a operação única.

### 5. Reenvio do teste anterior
- Não vamos reenviar registros antigos. O usuário vai limpar os dados e fazemos um novo teste E2E para validar tudo do zero.

### 6. Documentação e anti-regressão
- Atualizar a especificação de Logística (§WMS Pratika) com a nova regra de envio acoplado e CNPJ cru.
- Atualizar a memória da integração Pratika com as duas novas garantias.
- Criar memória de anti-regressão: *"Pratika nunca recebe NF e rastreio separados; sempre juntos, sob CNPJ de 14 dígitos."*

## Resultado final
- NF e etiqueta sempre chegam juntas no painel Pratika da loja correta.
- Envio parcial ou com CNPJ formatado é impossível por construção.
- Reconciliação automática cobre qualquer falha pontual de gatilho.
- Validação por teste E2E real após a correção.

## Detalhes técnicos (apêndice)
- `wms-pratika-send`: nova ação `send_combined(order_id)` que resolve invoice + tracking, valida ambos, sanitiza CNPJ, e executa `RecepcaoDocNfe` seguido de `AtualizarCodRastreioNfe` na mesma invocação. Log único `operation='combined'` com idempotência por `order_id`.
- Gatilhos `fiscal-webhook`, `fiscal-check-status`, `shipping-register-manual`, `shipping-get-label` passam a chamar `send_combined` (que internamente decide se ambos estão prontos). Ações antigas `send_nfe`/`update_tracking` ficam disponíveis só para reconciliação admin.
- Sanitização: `String(cnpj||'').replace(/\D/g,'')` + validação `length===14` em todos os caminhos, incluindo `test_connection`.
- Cron `wms-pratika-reconcile` busca pedidos com NF autorizada + tracking sem log `combined=success`.
