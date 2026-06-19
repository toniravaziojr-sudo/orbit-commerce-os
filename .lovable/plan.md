## Revisão do raciocínio

Reli os docs e o histórico. Duas correções de rota em relação ao plano anterior:

1. **UTMs já estão indo corretas na Meta.** O print confirma `utm_source=meta&utm_medium=social_paid&utm_campaign=…&utm_content=ad_2&utm_term=…` chegando ao anúncio. Não preciso mexer no publicador — preciso só **validar que essa URL é lida pelo nosso rastreamento de venda** (cookie/sessão do visitante → atribuição do pedido → relatórios de tráfego). Se a leitura estiver ok, encerro essa frente.

2. **O ciclo de vida do cliente continua vazio porque a Meta exige um pré-requisito que hoje não cumprimos.** O campo "Conquiste novos clientes" só fica selecionável quando a conta tem uma **audiência de "clientes atuais" vinculada à campanha**. Estamos enviando a instrução para o Meta, mas sem essa audiência base o Meta descarta em silêncio. Além disso, a leitura desse seletor na UI da Meta acontece no nível do **conjunto de anúncios**, então a instrução precisa ir nos dois níveis (campanha + conjunto).

## O que vou fazer (decisões técnicas, sem mudança de UI/UX)

**Frente A — Validar UTMs ponta a ponta (read-only, sem alterações se estiver ok)**
- Conferir, num pedido real recente, se um clique com essas UTMs grava origem "Meta — Pago" no rastreamento e aparece corretamente nos relatórios de atribuição e no ROAS Real do gestor de tráfego.
- Se algum elo estiver quebrado, corrijo só esse elo.

**Frente B — Resolver o ciclo de vida do cliente de verdade**
- Enviar a instrução nos dois níveis (campanha + conjunto de anúncios).
- Antes de publicar, procurar na conta uma audiência já existente de compradores (Purchase) gerada pelo pixel. Se existir, vinculo automaticamente como "clientes atuais" da campanha. Isso destrava o seletor sem precisar subir lista manual.
- Se não existir audiência de compradores na conta, publico a campanha normalmente, mas registro um aviso técnico claro na proposta dizendo: "Ciclo de vida não pôde ser aplicado: a conta da Meta ainda não tem audiência de compradores disponível. Crie uma audiência de evento Purchase (Gerenciador de Anúncios → Públicos) e republique." Sem isso, a Meta vai continuar zerando o campo, então é melhor sermos transparentes do que silenciar.
- Após publicar, leio de volta o seletor no Meta. Se vier preenchido → ok. Se vier vazio → marco aviso na proposta (sem reverter a campanha; ela está válida, só sem essa otimização específica).

**Frente C — Validação técnica obrigatória antes de fechar**
- Republicar a campanha "Kit Banho Calvície Zero" (que já está em Aguardando Ação) com o ajuste.
- Ler na Meta: parâmetros de URL do anúncio (já validado), ciclo de vida do cliente, e quantidade de anúncios por conjunto.
- Só declaro "Corrigido e validado" se UTMs continuarem corretas E o ciclo de vida vier preenchido (ou avisar com clareza se a conta não tiver audiência de compradores ainda).

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
- Se a Meta não aceitar o ciclo de vida por falta da audiência base, você vê uma mensagem clara na proposta dizendo exatamente o que falta resolver na conta da Meta, em vez de campo zerado e silêncio.

Confirma que eu sigo assim?
