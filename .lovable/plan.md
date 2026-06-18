## Revisão depois de reler as regras

A queixa do usuário continua válida e o caminho continua sendo **unificar criativo + copy dentro da etapa 4 do wizard**. Mas dois pontos das regras antigas precisam ser respeitados, e foram ajustados no plano:

1. **Geração de criativos não pode acontecer "em background" automaticamente após aprovar a estrutura.** A regra atual exige segundo gesto explícito do lojista + diálogo de custo + checagem de prontidão antes de qualquer chamada de IA. Isso continua valendo — apenas muda *onde* o segundo gesto acontece: passa a ser cada botão "Gerar com IA" dentro da etapa 4, em vez de um botão pós-aprovação numa tela separada.
2. **Aprovar e publicar continuam sendo gestos finais distintos** do gesto de gerar criativo. Cada um tem sua confirmação.

Tudo o mais do plano anterior se mantém.

## Como vai funcionar a etapa "Anúncios" (etapa 4)

Para cada anúncio planejado, um cartão único com:

**Criativo (imagem)**
- Botão principal: **Gerar imagem com IA** — no primeiro clique da sessão, mostra o custo numérico e a frase "Isso vai consumir créditos de IA. Nada será enviado à Meta agora." Sem essa confirmação, não dispara.
- Alternativas: **Enviar do PC** · **Escolher no Drive**.
- Depois de pronta: pré-visualização + **Regenerar com IA** (campo de feedback obrigatório, limite de 3 regenerações por anúncio, com custo) · **Substituir** · **Remover**.

**Textos do anúncio**
- Botão principal: **Gerar textos com IA** — preenche título, texto principal e descrição de uma vez (mesma confirmação de custo na primeira vez).
- Depois de prontos: cada um dos três campos editável, com botão próprio **Regenerar com IA** ao lado (também com feedback e custo).
- Botão de ação (CTA) e link de destino continuam como estão hoje.

**Estado de processamento**
- Enquanto a IA gera, o cartão mostra "Gerando…" e o botão **Avançar** fica desabilitado.
- Falha: mensagem em PT-BR + botão **Tentar de novo**.
- Se a checagem de prontidão (imagem principal do produto, logo, paleta, conexão Meta básica, orçamento, tabela de preços de IA) não passar, o botão "Gerar com IA" fica desabilitado com explicação clara dos itens faltantes (no máximo 3 visíveis + "Ver todos").

**Critério para liberar a etapa Publicar**
- Cada anúncio precisa ter imagem definida e os três textos preenchidos (gerados, enviados ou editados). Etapa 5 mostra os anúncios pendentes se faltar algum.

## Etapa "Publicar" (etapa 5)

- Resumo final (campanha, conjuntos, anúncios, janela de publicação 00:01–04:00 BRT).
- Botão único **Publicar na Meta** — esta ação aprova a estrutura e publica em modo ATIVO no mesmo gesto, com a confirmação que já existe hoje ("esta ação é definitiva, vai começar a gastar quando rodar").
- O modal separado de Revisão Final que existia depois de aprovar deixa de ser aberto — etapa 5 substitui ele.

## O que muda nos bastidores (decisões técnicas)

Decisões que estou tomando sozinho, dentro de critério de solidez/eficiência/segurança:

- **Reaproveitar funções existentes** de gerar imagem, gerar/regerar texto e aplicar override. Adiciono apenas o caso "gerar texto do zero" (hoje só existe regenerar com feedback).
- **Eliminar a automação que enfileirava criativos automaticamente** ao aprovar a estrutura. Geração passa a ser 100% sob comando do lojista dentro da etapa 4. Isso reduz custo (zero IA acidental) e elimina a duplicidade de telas.
- **Marcar como descontinuado o modal de Revisão Final separado** e a seção "Propostas aprovadas em andamento" que vivia no painel — não some hoje da base, mas para de aparecer/ser navegável. Propostas antigas já aprovadas e em fila continuam pelo caminho atual até serem publicadas ou descartadas (sem regressão).
- **Manter o diálogo de custo, o gate de prontidão, a idempotência (não duplicar custo em duplo clique) e o limite de 3 regenerações** — são as travas que já existem na regra atual.
- **Não mexer no modal estruturado para propostas que não são de campanha** (plano estratégico, ajuste de orçamento etc. — continuam com fluxo inline ou overviewOnly como hoje).

## O que continua igual

- 5 etapas do wizard, mesmos nomes e ordem.
- Regras de prontidão técnica (Meta conectada, pixel, página, URL+UTM, orçamento, tabela de preços de IA).
- Janela de publicação 00:01–04:00 BRT (ou imediato se na faixa).
- Aprendizados da IA a partir de feedback de regeneração.

## Validação antes de fechar

- Abrir uma proposta nova, ir até etapa 4, gerar imagem com IA (conferir diálogo de custo), gerar textos com IA, regenerar individualmente cada texto, regenerar imagem com feedback, substituir uma imagem pelo PC, avançar para etapa 5 e publicar.
- Conferir que a etapa 5 bloqueia se algum anúncio ficar sem imagem ou textos.
- Conferir que aprendizados de feedback continuam sendo gravados.
- Conferir que propostas antigas em fila continuam funcionando sem regressão.

## Documentação e governança

- Atualizar a especificação do Gestor de Tráfego (seção do fluxo de propostas e criativos).
- Atualizar o mapa de UI (etapa 4 ganha blocos de IA; modal de Revisão Final separado descontinuado).
- Atualizar as memórias de governança H.3 e H.4 para refletir que o "segundo gesto" agora vive dentro da etapa 4 do wizard, e que a Revisão Final foi absorvida pela etapa 5.

## Bloco técnico (opcional)

Se quiser, depois te mando a lista de arquivos tocados, funções reaproveitadas, função nova mínima para "gerar copy do zero" e os pontos de telemetria que vou preservar.

Confirma que sigo por aí?
