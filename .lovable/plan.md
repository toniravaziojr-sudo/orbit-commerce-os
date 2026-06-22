# Plano — Chat IA do Gestor de Tráfego como agente único

## Objetivo
O lojista deve conseguir, **só pelo chat**, fazer tudo que o Gestor de Tráfego faz hoje em telas separadas: consultar performance, pedir diagnóstico, criar estratégia, montar campanha completa, gerar criativos, ajustar orçamento, pausar/duplicar, ler/ajustar configurações, ver aprendizados e avisos. A proposta gerada no chat segue para "Aguardando ação" no formato canônico, marcada como "via chat", e só é publicada na Meta quando o lojista aprovar manualmente.

## Decisões aprovadas
1. **Conta no chat:** conta única padrão automática. Se houver só uma conta ativa do canal, o chat usa direto; com mais de uma, pergunta antes de submeter.
2. **Onde aparece:** mesma fila "Aguardando ação", com selo "via chat".
3. **Ordem:** Onda 1 primeiro (convergência), depois capacidades, governança e relatórios. A IA é auxiliar de criação — **nunca publica direto**; sempre passa pelo fluxo de aprovação manual.

## Princípios obrigatórios
- Não existe "IA global" de execução. Toda configuração de execução é por conta.
- Aviso ≠ proposta. Aviso é só diagnóstico.
- Insights está aposentado.
- Publicação canônica: paridade total, anti-limbo, gates técnicos, janela 00:01 BRT.
- Supremacia do prompt estratégico mantida.
- IA nunca publica direto. Sempre fila de aprovação.

## Entrega em ondas

### Onda 1 — Convergência do chat (✅ aplicada, pendente de validação)
- Fim do bloqueio "incompleta" no chat.
- Quando o lojista fecha estratégia no chat, o sistema resolve a conta alvo, abre análise canônica e delega ao estrategista oficial em modo assíncrono passando o brief da conversa como diretriz prioritária.
- A proposta resultante aparece em "Aguardando ação" no formato canônico, marcada com selo "via chat".
- Mantém o fluxo padrão de revisão e publicação manual.

### Onda 2A — Leitura plena (✅ aplicada, pendente de validação)
- Chat passa a responder qualquer pergunta de leitura do módulo em qualquer intent: performance, conjuntos, anúncios, criativos, públicos, produtos, rastreamento, avisos abertos, configurações da IA por conta, planos estratégicos, experimentos e lista de contas conectadas (Meta/Google/TikTok).
- Sem mudança de UI, sem novo motor, sem ação de escrita.

### Onda 2B — Ações unitárias, estruturais e destrutivas (✅ aplicada, pendente de validação)
- Unitárias (pausar/reativar, ajuste de orçamento, duplicar): já operacionais — execução direta, reporte depois.
- Estruturais (campanha/conjunto/criativo/plano): em "Aguardando ação" com selo "via chat" (Onda 1).
- Destrutivas (excluir campanha/conjunto/anúncio, desativar +3 em lote): tool com flag `user_confirmed`, IA obrigada a pedir confirmação explícita ("sim, pode excluir") antes de executar.
- Intent classifier reconhece "excluir/deletar/apagar/remover" e "desativar em lote".

### Onda 3 — Governança e configuração via chat (✅ aplicada, pendente de validação)
- Chat lê e altera configurações da IA por conta: prompt estratégico (instruções do lojista), meta de ROI, orçamento, modo (conservador/equilibrado/agressivo), aprovação humana (auto/high_impact), ligar/desligar IA, overrides via chat.
- Toda alteração é sensível: a IA precisa mostrar conta-alvo, campo, valor atual → novo valor, e SÓ executa após "sim/confirmo" explícito (gate `user_confirmed=true` validado no servidor — chamada sem confirmação retorna `confirmation_required`).
- Intent classifier reconhece "ajustar/alterar/mudar/configurar IA", "prompt estratégico", "meta de ROI", "modo conservador/agressivo", "aprovação automática/manual".

### Onda 4 — Experimentos e gestão da fila via chat (✅ aplicada, pendente de validação)
- Experimentos A/B: chat abre (com hipótese, variável, conta, orçamento, duração) e encerra (completed/cancelled, vencedor, notas) — todas exigem confirmação explícita do lojista.
- Fila "Aguardando ação": chat lista propostas pendentes e pode aprovar (publica de verdade pelo pipeline canônico, inclusive plano estratégico de 2 etapas) ou rejeitar (com motivo) — sempre com confirmação explícita.
- Gate de confirmação no servidor cobre as 5 ferramentas sensíveis (config, aprovar, rejeitar, criar experimento, encerrar experimento): chamada sem `user_confirmed=true` retorna `confirmation_required`.

## Hierarquia de execução no chat
- **Ação unitária** (uma pausa, ajuste de orçamento, público): executa direto.
- **Ação estrutural** (estratégia, lote, campanha completa): vai para "Aguardando ação".
- **Ação destrutiva** (exclusão, desativação em lote, mudança crítica de conta): confirmação explícita no chat.
- **Cross-conta:** só com nome da conta-alvo.

## Critérios de aceite
1. Conversar no chat → fechar estratégia → ver proposta em "Aguardando ação" marcada "via chat" → aprovar → publicada na Meta pelo fluxo padrão.
2. Toda ação que existe em qualquer aba do Gestor de Tráfego pode ser solicitada em linguagem natural no chat.
3. Nenhuma proposta nascida no chat fica em "incompleta" travada.
4. Toda execução real está amarrada a uma conta de anúncios.
5. IA nunca publica direto; sempre fluxo de aprovação manual.
6. Avisos continuam sendo só diagnóstico.
7. Doc do módulo, mapa de UI e memórias atualizados a cada onda.

## Fora de escopo
- Refatoração visual das abas existentes.
- Mudança no motor de criativos, no ciclo noturno autônomo ou no pipeline de publicação.
- Estender o agente para fora do Gestor de Tráfego.
- Reanimar Insights ou criar "IA global".

## Status
- Onda 1: **aplicada, aguardando validação do lojista** (testar conversar com a IA, fechar uma estratégia, confirmar que a proposta aparece em "Aguardando ação" com selo "via chat" em 1–3 min).
- Onda 2, 3, 4: a iniciar após validação da Onda 1.
