📋 CHECKLIST DE CONFORMIDADE
- Doc de Regras lido: sim.
- Doc formal do tema lido: gestor-trafego.md, plataformas-baseline.md, mapa-ui.md, memórias de governança Ads.
- Fluxo: proposta da IA → aprovação visual → publicação Meta → histórico em "Ações da IA".
- Fonte de verdade: proposta aprovada (snapshot) + retorno real da Meta.
- Módulos: Gestor de Tráfego IA (Aguardando Ação, Ações da IA), publicador Meta, rastreamento/UTM, doc + memórias.
- Impacto cruzado: ROAS real, atribuição, exclusão de clientes, leitura de histórico pelo usuário.
- UI impactada: sim — aba "Ações da IA" passa a usar o mesmo card visual da aprovação (já solicitado pelo usuário). Mapa de UI será atualizado.
- Situação: Aguardando confirmação do usuário.

📌 STATUS DA ENTREGA: Proposta

## Como funciona hoje

1. A IA cria propostas e o usuário aprova em "Aguardando Ação" com um card visual completo (resumo de negócio, modal passo a passo).
2. Quando executadas, as propostas migram para "Ações da IA" e perdem identidade visual: aparecem como "campaign_proposal", "Meta" e abrem um modal com JSON cru. O usuário não consegue identificar qual campanha aprovou.
3. Propostas de campanha fria não preenchem a "Estratégia de ciclo de vida do cliente" (deveria vir "Conquistar novos clientes" por padrão em TOF).
4. Anúncios sobem sem UTMs, derrubando atribuição.
5. Não há conferência final com a Meta após publicar — uma campanha do Kit Banho Calvície Zero aparenta ter ficado com criativo faltando, mas internamente os 2 anúncios constam como criados; falta a verificação que prova.

## O problema

Quatro frentes que se reforçam:
- Histórico ilegível para o usuário.
- Configuração de ciclo de vida em branco em campanhas frias.
- UTMs ausentes nos anúncios publicados.
- Sucesso de publicação declarado sem conferir com a Meta.

## O que eu faria

### Frente 1 — Histórico visual igual ao da aprovação (UI, precisa aval)
- A aba "Ações da IA" passa a renderizar o mesmo card visual usado na aprovação, em modo somente leitura.
- Cada item exibe: tipo em linguagem de negócio (Proposta de Campanha, Plano Estratégico, Pausa, Ajuste de Orçamento), nome amigável (nome da campanha/plano + data), resumo de negócio, selo de status (Aprovada · Publicada na Meta · Falhou · Recusada · Desfeita) e datas (criada, aprovada, publicada).
- Botão "Visualizar" abre o mesmo modal passo a passo da aprovação (Visão Geral, Campanha, Conjuntos, Anúncios, Publicação), sem botões de aprovar/recusar/ajustar.
- Modal técnico (JSON) deixa de ser o padrão; fica recolhido atrás de "Ver detalhes técnicos" para diagnóstico.
- Confirmar com o usuário antes de mexer na UI (é mudança visual).

### Frente 2 — Ciclo de vida automático (decisão técnica)
- Campanha fria de vendas (TOF) entra com "Conquistar novos clientes" por padrão, na geração da proposta e como segunda camada de segurança no publicador.
- Remarketing/retenção mantém "Todos os públicos".
- Escolha manual do usuário sempre prevalece.

### Frente 3 — UTMs obrigatórias (decisão técnica)
- Aplicar UTMs padrão em todo anúncio antes de publicar (origem Meta, mídia paga social, campanha, conjunto, anúncio, público), tanto na URL final quanto na camada nativa de parâmetros da Meta.
- Bloquear publicação se faltar UTM obrigatória.

### Frente 4 — Conferência pós-publicação (decisão técnica)
- Após publicar, consultar a Meta e confirmar campanha, conjuntos e quantidade de anúncios por conjunto contra o snapshot aprovado.
- Divergiu? Proposta volta para "Aguardando Ação" com mensagem clara, sem declarar sucesso.
- Conferir agora a campanha do Kit Banho Calvície Zero suspeita: se a Meta confirmar 2 anúncios, problema é só de leitura; se confirmar 1, abrir incidente e republicar o criativo faltante (sem republicar a campanha inteira).

### Frente 5 — Propostas em aberto e campanhas já publicadas
- Propostas ainda não publicadas: aplicar ciclo de vida + UTMs automaticamente antes da próxima publicação.
- Campanhas já publicadas na Meta: não altero sem sua autorização explícita por campanha.

### Frente 6 — Documentação e anti-regressão
- Atualizar gestor-trafego.md e plataformas-baseline.md com: ciclo de vida automático em TOF, UTM obrigatória, conferência pós-publicação, paridade visual no histórico.
- Atualizar mapa-ui.md com a nova apresentação da aba "Ações da IA".
- Registrar memórias de governança: "histórico de Ações da IA usa o mesmo card da aprovação", "UTM obrigatória em todo anúncio", "publicação só é sucesso após paridade com a Meta", "TOF vendas = novos clientes por padrão".
- Testes anti-regressão cobrindo as quatro frentes.

## Resultado final esperado

- "Ações da IA" mostra cada plano/campanha com nome e resumo iguais ao da aprovação.
- Campanhas frias de vendas sobem com "Conquistar novos clientes".
- Todo anúncio sobe com UTMs.
- "Publicado" só é declarado após bater com a Meta; divergência volta para o usuário.

## Validação que farei após o ajuste

- Abrir "Ações da IA" e conferir card visual + nome + modal de leitura.
- Validar uma proposta fria nova: precisa mostrar novos clientes + UTMs antes de publicar.
- Conferir retorno da Meta no pós-publicação e logs internos.
- Auditar a campanha suspeita do Kit Banho Calvície Zero (leitura na Meta, sem alterar nada sem seu aval).

## Ação destrutiva ou sensível

Não altero campanhas já publicadas na Meta sem autorização separada por campanha.

É isso? Confirma que eu ajusto?