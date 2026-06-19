## Status

✅ Correção v1.9.0 aplicada e implantada em produção (causa raiz real).

## Histórico de tentativas

- v1.7.0: ativou flag + audiência de referência → ignorada silenciosamente pela Meta.
- v1.8.0: removeu duplicidade da audiência nas exclusões → ainda ignorada.
- **v1.9.0 (atual):** registra a lista de clientes no nível da CONTA de anúncios antes de criar a campanha — pré-requisito documentado pela Meta que estava faltando.

## Causa raiz comprovada (documentação oficial Meta)

A configuração "Conquistar novos clientes" só engata se a lista de clientes atuais estiver cadastrada no nível da conta de anúncios na Meta. Sem esse cadastro, a Meta aceita o pedido na campanha, mas ignora a flag silenciosamente — não retorna erro nem aviso. Esse é o motivo de v1.7.0 e v1.8.0 não terem resolvido: atacavam o sintoma na camada de campanha, mas a falha estava na ausência do pré-requisito na camada de conta.

## O que foi corrigido em v1.9.0

- Antes de publicar qualquer campanha de "Conquistar novos clientes", o sistema garante que a lista de clientes resolvida esteja registrada no cadastro permanente da conta de anúncios na Meta.
- Operação idempotente: lê primeiro o que já está lá; só escreve se faltar a lista. Em conta já configurada, é só uma leitura rápida (sem custo de processamento extra).
- Falha no cadastro bloqueia a publicação antes de criar qualquer objeto na Meta, com mensagem PT-BR explicando o que aconteceu.
- A dedupe de audiência (v1.8.0) continua ativa como camada adicional.
- Fail-closed pós-publicação continua ativo: se a Meta não confirmar a flag, o sistema pausa tudo e devolve a proposta para revisão.

## O que não mudou

- Nenhuma alteração de UI/UX.
- Nenhuma alteração de regra de negócio (frio continua mirando aquisição).
- UTMs, remarketing, campanhas quentes e overrides do usuário continuam iguais.
- A escolha da audiência de clientes continua seguindo a mesma ordem de prioridade.

## Próximo passo

Republicar a proposta "Shampoo Calvície Zero" (já está em "Aguardando aprovação"). Após a publicação, o sistema vai ler de volta na Meta e confirmar se a flag engatou. Se sim, status final "Corrigido e validado". Se não, volta para revisão com mensagem clara — mas agora com o pré-requisito da Meta atendido, a expectativa é que engate de primeira.

## Documentação atualizada

- Memória anti-regressão: nova regra v1.9.0 sobre registro de `existing_customers` no nível da conta.
- Base de conhecimento técnico: lição 9.5 documenta causa raiz real, solução e regra derivada.
