## Revisão do raciocínio

Reli os docs e o histórico. Duas correções de rota em relação ao plano anterior:

1. **UTMs já estão indo corretas na Meta.** O print confirma `utm_source=meta&utm_medium=social_paid&utm_campaign=…&utm_content=ad_2&utm_term=…` chegando ao anúncio. Não preciso mexer no publicador — preciso só **validar que essa URL é lida pelo nosso rastreamento de venda** (cookie/sessão do visitante → atribuição do pedido → relatórios de tráfego). Se a leitura estiver ok, encerro essa frente.

2. **Causa raiz corrigida:** o fluxo anterior tratava "campanha criada + anúncios criados" como sucesso mesmo quando a Meta não confirmava o seletor "Conquistar novos clientes". Agora essa configuração vira parte obrigatória da paridade de publicação: se a campanha fria exigir novos clientes e a Meta não confirmar, o sistema pausa os objetos criados e devolve a proposta para revisão.

## O que vou fazer (decisões técnicas, sem mudança de UI/UX)

**Frente A — Validar UTMs ponta a ponta (read-only, sem alterações se estiver ok)**
- Conferir, num pedido real recente, se um clique com essas UTMs grava origem "Meta — Pago" no rastreamento e aparece corretamente nos relatórios de atribuição e no ROAS Real do gestor de tráfego.
- Se algum elo estiver quebrado, corrijo só esse elo.

**Frente B — Resolver o ciclo de vida do cliente de verdade**
- Usar como fonte principal o público de Clientes já sincronizado pelo sistema para a conta de anúncios, não uma busca genérica por nome que poderia escolher Leads/Newsletter.
- Antes de publicar, vincular esse público como "clientes atuais" da campanha quando a estratégia for "Conquistar novos clientes".
- Se o público de Clientes não existir, bloquear antes de criar objetos na Meta e devolver mensagem clara na proposta.
- Após publicar, ler de volta o seletor na Meta. Se vier preenchido → ok. Se vier vazio → falha de paridade: pausa campanha/conjuntos e devolve para "Aguardando Ação".

**Frente C — Validação técnica obrigatória antes de fechar**
- Republicar a campanha "Kit Banho Calvície Zero" (que já está em Aguardando Ação) com o ajuste.
- Ler na Meta: parâmetros de URL do anúncio (já validado), ciclo de vida do cliente, e quantidade de anúncios por conjunto.
- Só declaro "Corrigido e validado" se UTMs continuarem corretas E o ciclo de vida vier preenchido. Campanha fria com ciclo de vida vazio não pode mais ser tratada como sucesso.

**Frente D — Documentação e anti-regressão**
- Atualizar especificação do gestor de tráfego com o pré-requisito de audiência de compradores e a regra de envio em dois níveis.
- Reforçar memória anti-regressão.

## O que NÃO vou fazer

- Não mexo na UI da aprovação nem da aba "Ações da IA" (já entregue).
- Não crio audiência nova na Meta sem você pedir (só uso o que já existe).
- Não republico campanhas que já estão rodando na Meta sem sua autorização.
- Não toco no rastreamento atual de UTM se estiver funcionando.

## Resultado esperado

- Você abre a campanha republicada e vê: UTMs no anúncio (já visto), seletor "Conquiste novos clientes" marcado, dois criativos no conjunto.
- Se a Meta não aceitar o ciclo de vida, a campanha não fica como publicada com configuração parcial: os objetos criados são pausados e a proposta volta para revisão com mensagem clara.

Confirma que eu sigo assim?
