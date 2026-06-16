## Objetivo

Simplificar o Gestor de Tráfego eliminando o "cérebro global" duplicado, mantendo a IA por conta de anúncios. Promover "Aprendizado da IA" a aba principal. Transformar insights em propostas acionáveis. Sem regressão no fluxo de campanhas.

## Princípios

- O que é por conta de anúncios continua por conta (orçamento, ROI, instruções, autonomia, modo estratégico, regras de funil, prompt estratégico).
- O que continua global, **sem aparecer como aba de configuração**: Visão Geral (consolidada), Chat IA Global (responde sobre qualquer conta) e UTMs (aplicadas automaticamente pelo sistema com base no tenant, sem UI).
- IA só gera proposta quando tem ação concreta. Sinal solto vira contexto interno da IA, nunca proposta.
- Limpeza do tenant Respeite o Homem feita junto da Onda 1 para o usuário testar do zero.

## Pontos sensíveis identificados na auditoria (decisões de fluxo já tomadas)

1. **Prompt estratégico global** existe hoje em paralelo ao prompt por conta. Some na Onda 2; quem tinha prompt global terá o conteúdo migrado para cada conta de anúncios ativa (a IA já tratava ambos com hierarquia de supremacia, então não há perda de regra — só consolidação no lugar correto).
2. **Trava de execução simultânea** hoje é por tenant (impede a IA rodar dois ciclos ao mesmo tempo na casa toda). Passa a ser por conta de anúncios, permitindo que contas distintas rodem em paralelo sem se atrapalhar.
3. **"Replicação inteligente entre contas"** (hoje só roda no primeiro start global) some. Em troca, ao ativar a IA numa conta nova, ela usa os Aprendizados da IA do tenant como base (a aba nova garante isso). Resultado prático equivalente, sem precisar do conceito global.

---

## ONDA 1 — Aprendizado da IA + Limpeza do tenant

**Entrega visual**

Abas principais ficam:
1. Visão Geral
2. Gerenciador (Meta / Google / TikTok)
3. Aprendizado da IA  ← nova posição
4. Chat IA Global

(Insights e Configurações Gerais saem só nas Ondas 2 e 3, para isolar risco.)

**Aprendizado da IA**

- Promovida ao topo, com lista, criar, editar, ativar, pausar, arquivar e remover.
- Já existe pronta dentro de Configurações Gerais; apenas movida para o nível principal e ganha um cabeçalho explicando "Aqui você ajusta o que a IA aprendeu sobre o seu negócio".

**Limpeza do tenant Respeite o Homem**

Apaga apenas: propostas pendentes/aprovadas/publicadas/recusadas, sessões da IA, análises executadas, insights, feedbacks, conversas do chat de tráfego.

Preserva: conexão Meta, conta de anúncios e suas configurações, aprendizados da IA, memória aprendida, prompt estratégico, métricas históricas reais.

**Validação Onda 1**
- Aba "Aprendizado da IA" aparece como aba principal e abre direto na lista.
- Criar, editar, pausar e remover aprendizado funciona.
- Tenant Respeite o Homem zera as 6 categorias acima e mantém o restante.
- Fluxo de criar proposta → aprovar → publicar continua funcionando (smoke test rápido).

---

## ONDA 2 — Remover o conceito global

**Entrega visual**

Sai a aba "Configurações Gerais". Sai a aba "Chat IA" interna de cada conta. Sai o botão "Analisar todas as contas (global)" do Gerenciador.

Abas finais:
1. Visão Geral
2. Gerenciador (Meta / Google / TikTok)
3. Aprendizado da IA
4. Chat IA Global

Dentro de cada conta, as subabas continuam: Campanhas, Ações da IA, Aguardando Ação, Relatórios, ROI Real.

**Migração de configurações**

| Hoje em Configurações Gerais | Destino |
|---|---|
| Orçamento total da casa | Removido. Cada conta tem o seu. |
| ROI alvo / ROI mínimo / Limite ROAS | Já existe por conta. Removido do global. |
| Instruções para a IA / Modo estratégico / Divisão de funil / Autonomia | Já existem por conta. Removidos. |
| Prompt estratégico global | Migrado para o prompt da conta (uma vez, na Onda 2). Some do nível global. |
| UTM padrão | Removido da UI. Sistema aplica automaticamente UTMs do tenant em qualquer URL de anúncio. |
| "Aguardando Aprovação (consolidado de todos os canais)" | Removido. Cada conta já tem sua aba "Aguardando Ação". |

**Chat IA Global**

Mantido. Enxerga todas as contas conectadas e responde sobre o consolidado ou sobre uma conta específica quando solicitado.

**O que para de rodar**

- Análise inicial global (substituída pela análise por conta na ativação da IA).
- Trava de execução por tenant (vira por conta).
- Toggle "IA global ligada/desligada". A IA opera ligada/desligada por conta apenas.

**Validação Onda 2**
- Configurações Gerais e Chat por conta não aparecem mais.
- Todas as configurações importantes seguem editáveis dentro de cada conta.
- Prompt estratégico aparece consolidado dentro de cada conta (sem perda do conteúdo que estava no global).
- UTMs aplicadas automaticamente nas URLs de novos anúncios sem tela.
- Fluxo proposta → aprovação → publicação íntegro em uma conta de teste.
- Chat IA Global responde corretamente perguntas sobre uma conta específica.

---

## ONDA 3 — Insights viram propostas acionáveis

**Comportamento novo**

- A aba Insights some.
- A IA continua coletando sinais (CTR caindo, ROI baixo, criativo saturado, gasto fora da meta) como contexto interno.
- Esses sinais só viram item visível ao usuário quando a IA consegue formular uma ação concreta (pausar, ajustar verba, trocar criativo, criar variação, etc.). Aí nasce como proposta na aba "Aguardando Ação" da conta correspondente.
- Sinal sem ação concreta fica como contexto que a IA usa para próximas decisões e para o Chat IA Global responder quando perguntado.

**O que para de rodar**
- Geração semanal de insights "puramente diagnósticos".
- Botão manual "Gerar insights agora".

**O que passa a rodar**
- O ciclo da IA por conta passa a ser a única fonte de propostas. Quando detecta um sinal, decide se há ação dentro das regras estabelecidas; se sim, gera proposta; se não, apenas registra como aprendizado/contexto.

**Validação Onda 3**
- Aba Insights some sem quebrar navegação.
- Em uma conta de teste, forçar um cenário de queda de performance: ou nasce proposta concreta em "Aguardando Ação", ou nada — nunca insight órfão.
- Aprendizados gerados pela IA aparecem na aba "Aprendizado da IA" e o usuário consegue ajustar/remover.

---

## Documentação atualizada em cada onda

- Especificação do Gestor de Tráfego (Layer 3): novas abas, ausência do global, novo fluxo Insights→Proposta, UTM automática, prompt estratégico só por conta.
- Mapa de UI (Layer 3 transversal): registrar "Aprendizado da IA" como aba principal; remover "Configurações Gerais", "Insights" e "Chat IA por conta".
- Memória de governança: vedado reintroduzir conceito de "IA global" no Gestor de Tráfego (anti-regressão).

## Fora de escopo
- Mudanças em métricas, gráficos, ROI real, relatórios.
- Mudanças no fluxo de publicação Meta.
- Mudanças em conexões e contas de anúncios.

## Aprovação

Confirma o plano? Começo pela Onda 1 (Aprendizado da IA promovido + limpeza do Respeite o Homem). Ondas 2 e 3 só após você validar a anterior.
