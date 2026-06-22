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

### Onda 2 — Expansão de capacidades operacionais
- Habilitar no chat o conjunto completo de ações: operação fina Meta, Google Ads, TikTok, leitura de aprendizados e avisos.
- Reaproveita funções já existentes do módulo.

### Onda 3 — Governança e configuração via chat
- Permitir ler e alterar configurações da IA por conta (prompt estratégico, metas, splits, modo de aprovação, janela de publicação).
- Confirmação explícita para alterações sensíveis.

### Onda 4 — Experimentos e relatórios
- Abertura/encerramento de experimentos A/B, relatórios de ROI e gestão da fila via chat.

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
