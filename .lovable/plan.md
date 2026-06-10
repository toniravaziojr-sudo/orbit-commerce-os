## Revisão do contexto

Reli os docs relevantes (ERP Fiscal, padrão de cron/edge auth e regra de proibição da GUC do service key). A regra documental canônica do projeto é clara:

- Chamadas entre edge functions devem usar **anon key no header `Authorization: Bearer`** e a edge alvo faz a validação interna (papel/tenant) no corpo.
- Service role key não deve circular como Bearer entre funções neste projeto — foi exatamente o que travou o disparo nas últimas tentativas (o gateway rejeita o formato antigo de service key como JWT).

Conclusão: a direção das últimas correções estava certa em parte (passar a anon key + sinalizador interno), mas o tratamento da emissão automática ainda está acoplado a uma chamada HTTP entre funções, que é frágil quando há rotação de chave, mudança de gateway ou cold start. Isso explica por que o sintoma volta a cada teste.

## Mudança de plano (decisão técnica, sem mudança de UI/UX nem de negócio)

Trocar o disparo da emissão automática de "uma função chama outra por HTTP" por **fila no banco + um único processador**:

1. Quando o pedido entra no estado que autoriza emissão (pago + status pronto para faturar), a função de rascunhos só faz duas coisas:
   - Garante que o Pedido de Venda existe.
   - Marca o registro fiscal correspondente como "pronto para emissão" na fila já existente de rascunhos fiscais.
2. O cron de processamento da fila (que já roda) passa a ser o único responsável por emitir a NF, chamando a lógica de emissão **dentro do mesmo runtime** (sem chamada HTTP cruzada).
3. A função pública de emissão manual (usada pela tela) continua existindo e inalterada para o usuário.

Por que isso é mais sólido:

- Elimina a dependência de autenticação entre funções (causa raiz dos últimos erros).
- Reaproveita o cron de fila que já existe — sem novo agendamento, sem novo processamento desnecessário.
- Mantém rastreabilidade: cada item da fila tem estado, tentativa e erro registrados.
- Não muda nada para o usuário final: a tela, o fluxo do pedido e a emissão manual continuam iguais.

## Critérios de aceite

- Ao aprovar um pedido manualmente, o sistema:
  1. Cria o Pedido de Venda.
  2. Cria a Remessa em rascunho.
  3. Em até um ciclo do cron, emite a NF automaticamente.
  4. Após autorização da NF, libera a Remessa para despacho.
- Nenhum item depende de chamada HTTP entre edge functions.
- Logs do cron mostram: item pego da fila, resultado da emissão, próximo passo.

## Validação que farei após implementar

- Limpar dados do teste anterior.
- Criar um novo pedido aprovado no tenant Respeite o Homem.
- Acompanhar a fila e os logs até ver a NF autorizada e a Remessa pronta.
- Só declaro "corrigido e validado" com a NF autorizada na base.

## Documentação

Ao concluir, atualizo a especificação de ERP Fiscal descrevendo o novo caminho de emissão automática via fila (substituindo a descrição atual baseada em chamada entre funções) e registro a regra anti-regressão: "emissão automática nunca depende de chamada HTTP entre edge functions".

Posso seguir com esse plano?