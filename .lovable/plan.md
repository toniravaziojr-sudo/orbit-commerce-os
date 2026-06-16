## Objetivo

Simplificar o Gestor de Tráfego eliminando o "cérebro global" duplicado, mantendo a IA por conta de anúncios. Promover "Aprendizado da IA" a aba principal. Criar a aba "Avisos" para sinais diagnósticos. Transformar insights em propostas acionáveis. Sem regressão no fluxo de campanhas.

## Princípios

- O que é por conta de anúncios continua por conta (orçamento, ROI, instruções, autonomia, modo estratégico, regras de funil, prompt estratégico).
- O que continua global, **sem aparecer como aba de configuração**: Visão Geral, Chat IA Global, Aprendizado da IA, Avisos e UTMs (aplicadas automaticamente pelo sistema, sem UI).
- **Proposta** só nasce quando a IA tem ação concreta dentro das regras estabelecidas.
- **Aviso** é o canal para sinais diagnósticos relevantes — informa o usuário, mas não exige ação dele.
- Limpeza do tenant Respeite o Homem feita junto da Onda 1 para o usuário testar do zero.

## Pontos sensíveis identificados na auditoria (decisões de fluxo já tomadas)

1. Prompt estratégico global existe hoje em paralelo ao prompt por conta. Some na Onda 2; conteúdo migrado para cada conta ativa.
2. Trava de execução simultânea hoje é por tenant. Passa a ser por conta, permitindo contas distintas rodarem em paralelo.
3. "Replicação inteligente entre contas" some. Conta nova ativada usa Aprendizados da IA do tenant como base.

---

## ONDA 1 — Aprendizado da IA + Limpeza do tenant ✅ entregue, aguardando validação

Abas atuais: Visão Geral · Gerenciador · **Aprendizado da IA** · Insights · Configurações Gerais · Chat IA Global.

Limpeza do Respeite o Homem executada (6 categorias zeradas, configurações por conta preservadas).

**Validação do usuário pendente** — testar a nova aba e confirmar a limpeza antes da Onda 2.

---

## ONDA 2 — Remover o conceito global + criar aba "Avisos"

**Entrega visual**

Sai "Configurações Gerais". Sai "Chat IA" interna de cada conta. Sai o botão "Analisar todas as contas (global)" do Gerenciador. Nasce a aba "Avisos".

Abas finais (após Onda 3):
1. Visão Geral
2. Gerenciador (Meta / Google / TikTok)
3. Aprendizado da IA
4. **Avisos** ← nova
5. Chat IA Global

Subabas por conta seguem iguais: Campanhas, Ações da IA, Aguardando Ação, Relatórios, ROI Real.

**Nova aba "Avisos"**

- Lista cronológica de sinais que a IA detectou e considerou relevantes para o usuário, mesmo sem ação concreta associada. Exemplos: "ROI da campanha X caindo há 3 dias", "Criativo Y entrando em fadiga", "Frequência subindo acima do saudável no público Z".
- Cada aviso mostra: título, descrição curta, conta de anúncios afetada, campanha/criativo quando aplicável, severidade (informativo / atenção / urgente), data do primeiro sinal e tendência.
- Ações do usuário: marcar como visto, dispensar e (opcional) abrir conversa no Chat IA Global perguntando "o que sugere fazer aqui?".
- Avisos viram **contexto** que a IA usa para gerar próximas propostas. Quando a IA evolui um aviso para uma ação concreta, nasce uma proposta vinculada na aba "Aguardando Ação" da conta, e o aviso é marcado como "virou proposta".
- Contador (badge) na aba mostrando avisos não vistos.
- Sem botão "gerar avisos agora": avisos saem do ciclo natural da IA por conta.

**Migração de configurações**

| Hoje em Configurações Gerais | Destino |
|---|---|
| Orçamento total da casa | Removido. Cada conta tem o seu. |
| ROI alvo / ROI mínimo / Limite ROAS | Já existe por conta. Removido do global. |
| Instruções / Modo estratégico / Funil / Autonomia | Já existem por conta. Removidos. |
| Prompt estratégico global | Migrado para o prompt da conta. Some do nível global. |
| UTM padrão | Removido da UI. Sistema aplica automaticamente UTMs do tenant. |
| Aguardando Aprovação consolidado | Removido. Cada conta já tem sua aba. |

**Chat IA Global**

Mantido. Enxerga todas as contas e responde sobre o consolidado ou sobre uma conta específica. Pode ser chamado a partir de um aviso para discutir o sinal.

**O que para de rodar**
- Análise inicial global.
- Trava de execução por tenant (vira por conta).
- Toggle "IA global ligada/desligada".

**Validação Onda 2**
- Configurações Gerais e Chat por conta não aparecem mais.
- Aba "Avisos" funcional com pelo menos um aviso de teste vindo do ciclo da IA.
- Configurações importantes editáveis dentro de cada conta.
- Prompt estratégico consolidado dentro de cada conta sem perda de conteúdo.
- UTMs aplicadas automaticamente nas URLs de novos anúncios.
- Fluxo proposta → aprovação → publicação íntegro em uma conta de teste.
- Chat IA Global respondendo sobre uma conta específica.

---

## ONDA 3 — Insights viram propostas + avisos (aba Insights sai)

**Comportamento novo**

- A aba Insights some.
- A IA continua coletando sinais como contexto interno.
- Sinal com **ação concreta** → proposta na aba "Aguardando Ação" da conta.
- Sinal **diagnóstico relevante mas sem ação ainda** → aviso na aba "Avisos".
- Sinal **irrelevante / contexto puro** → fica só na memória interna da IA.

**O que para de rodar**
- Geração semanal de insights diagnósticos no formato atual.
- Botão manual "Gerar insights agora".

**O que passa a rodar**
- Ciclo da IA por conta como única fonte de propostas e avisos.
- Critério interno da IA decide: proposta, aviso ou contexto.

**Validação Onda 3**
- Aba Insights some sem quebrar navegação.
- Cenário de queda de performance numa conta de teste: nasce proposta concreta OU aviso — nunca sinal órfão.
- Aprendizados gerados pela IA aparecem em "Aprendizado da IA" editáveis.
- Aviso que evolui para ação concreta vira proposta na conta e é marcado como "virou proposta".

---

## Documentação atualizada em cada onda

- Especificação do Gestor de Tráfego: novas abas, ausência do global, fluxo Insights → Proposta/Aviso, UTM automática, prompt estratégico só por conta, contrato da aba "Avisos".
- Mapa de UI: registrar "Aprendizado da IA" e "Avisos" como abas principais; remover "Configurações Gerais", "Insights" e "Chat IA por conta".
- Memória de governança: vedado reintroduzir "IA global" no Gestor de Tráfego; aviso ≠ proposta (anti-regressão).

## Fora de escopo
- Métricas, gráficos, ROI real, relatórios.
- Fluxo de publicação Meta.
- Conexões e contas de anúncios.

## Aprovação

Plano atualizado com a aba "Avisos". Onda 1 já entregue e aguardando sua validação para eu iniciar a Onda 2.
