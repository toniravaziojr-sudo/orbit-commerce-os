## Status

✅ Correção v1.8.0 aplicada e implantada em produção.

## Causa raiz comprovada

A campanha era criada com sucesso na Meta, mas a configuração "Conquistar novos clientes" não engatava. A mesma audiência de Clientes estava sendo enviada como referência de "clientes atuais" (no nível da campanha) e ao mesmo tempo como exclusão manual (no nível de cada conjunto). A Meta aceita o pedido mas, por conflito interno, silenciosamente ignora o flag — sem erro, sem warning.

## O que foi corrigido

- Quando a campanha está com "Conquistar novos clientes" e usa a audiência de Clientes como referência, o sistema agora remove essa mesma audiência das exclusões manuais do conjunto antes de enviar para a Meta.
- A exclusão de compradores continua acontecendo automaticamente pelo mecanismo nativo da Meta (que é justamente o objetivo do "Conquistar novos clientes").
- Outras exclusões (lookalikes, públicos não-clientes) continuam preservadas.
- Fail-closed continua ativo: se a Meta não confirmar o flag após a correção, o sistema pausa tudo e devolve a proposta para revisão.

## O que não mudou

- Nenhuma alteração de UI/UX.
- Nenhuma alteração de regra de negócio (frio continua excluindo compradores).
- Múltiplos conjuntos e múltiplos anúncios funcionam como antes.
- UTMs padronizadas (`utm_medium=paid_social`) continuam aplicadas.
- Remarketing, campanhas quentes e overrides do usuário não são afetados.

## Próximo passo

Republicar a proposta "Shampoo Calvície Zero" (já está em "Aguardando aprovação"). Após a publicação, o sistema vai ler de volta na Meta e confirmar se o flag engatou desta vez. Se sim, status final "Corrigido e validado". Se não, a proposta volta para revisão com mensagem clara.

## Documentação atualizada

- Memória anti-regressão: regra "Dedupe de audiência de clientes vs exclusões manuais" registrada.
- Base de conhecimento técnico: lição 9.4 documenta causa raiz, solução e regra derivada.
