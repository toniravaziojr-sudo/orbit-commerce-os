# Plano — Chat IA do Gestor de Tráfego como agente único (revisado)

## Objetivo
O lojista deve conseguir, **só pelo chat**, fazer tudo que o Gestor de Tráfego faz hoje em telas separadas: consultar performance, pedir diagnóstico, criar estratégia, montar campanha completa, gerar criativos, ajustar orçamento, pausar/duplicar, ler/ajustar configurações da IA, ver aprendizados e avisos. A proposta gerada no chat precisa ir até "Aguardando ação" e ser **publicada na Meta** pelo mesmo caminho da proposta autônoma.

## Diagnóstico (recapitulado)
- O chat já existe e já tem várias ações (ver, criar, pausar, gerar criativo).
- Conversa estratégica é bloqueada hoje: proposta nascida no chat entra como "incompleta" e não pode ser aprovada/publicada. Só a proposta do ciclo autônomo fecha o ciclo.
- Convivem dois motores de chat (legado e novo) — risco de cascata e duplicação.
- Várias capacidades do módulo (Google Ads, TikTok, relatórios, aprendizados, experimentos, configurações por conta, avisos) ainda não estão expostas como ações do chat.

## Princípios obrigatórios já vigentes (que o plano respeita)
1. **Não existe "IA global" de execução.** Toda configuração de execução (orçamento, ROI/ROAS-alvo, prompt estratégico, modo de aprovação, autonomia, UTM, kill switch) é **por conta de anúncios**. O chat é uma porta de entrada única, mas qualquer ação que toque execução precisa estar amarrada a uma conta específica.
2. **Aviso ≠ Proposta.** Aviso é diagnóstico para o lojista ver; nunca executa nada nem entra em "Aguardando ação". Proposta é ação aprovável que segue o pipeline canônico até a Meta.
3. **Insights está aposentado** como destino vivo — o chat não pode reabrir esse caminho.
4. **Publicação tem paridade total e anti-limbo.** Todos os conjuntos planejados precisam ser criados; falha parcial devolve a proposta para a fila. Nada que o chat faça pode burlar isso.
5. **Supremacia do prompt estratégico.** Conflito editorial vira aviso, nunca bloqueio.

## O que vai mudar (visão de negócio)

### 1. Unificar o chat num único motor
Manter **uma única versão** do chat do Gestor de Tráfego. O motor antigo é desativado da UI e fica como código morto até remoção controlada. Elimina cascata de falha, duplicação e divergência de comportamento.

### 2. Fechar o ciclo "chat → aprovação → publicação"
A proposta nascida no chat passa a seguir o **mesmo pipeline canônico** da proposta autônoma:
- O chat conduz a conversa, coleta dados e estrutura a ideia.
- Ao concluir, dispara o estrategista canônico em modo "implementar a partir desta conversa", aplicando os mesmos guard-rails de completude e os mesmos gates técnicos.
- O resultado vira proposta normal em "Aguardando ação", aprovável e publicável pela Meta com o fluxo de revisão final já existente (modal H.4.2, janela 00:01 BRT, paridade total de conjuntos/anúncios).
- Acabam as propostas "incompletas" travadas.

### 3. Expandir as capacidades do agente
O agente passa a cobrir todas as ações operacionais que existem no módulo, sempre amarradas à conta de anúncios que o lojista escolher no chat:

- **Diagnóstico e leitura:** performance por campanha/conjunto/anúncio, tendência, públicos, criativos, saúde de rastreamento, contexto da loja, produtos, imagens.
- **Operação Meta:** criar campanha completa, pausar/reativar, ajustar orçamento, duplicar, atualizar segmentação, criar público personalizado e semelhante, gerar criativos com IA.
- **Operação Google Ads e TikTok:** mesmas ações equivalentes pelos adaptadores que já existem nesses canais.
- **Estratégia e proposta:** rodar análise inicial, propor estratégia, revisar, ajustar, submeter para aprovação.
- **Configuração da IA por conta:** ler e ajustar prompt estratégico, ROI/ROAS-alvo, splits de funil, modo de aprovação, janela de publicação, regras por canal — sempre na conta indicada, nunca como "global".
- **Aprendizados e avisos:** consultar aprendizados da IA, ler avisos abertos e marcar como visto/dispensado, abrir/encerrar experimentos A/B, gerar relatórios de ROI, listar ações executadas/agendadas.

Cada ação respeita os gates técnicos atuais (conexão de plataforma válida, pixel, página, URL de destino, criativo pronto). Conflito editorial continua sendo aviso, nunca bloqueio.

### 4. Hierarquia de execução dentro do chat
- **Ação unitária** (uma pausa, um ajuste de orçamento, um público): o chat executa direto e devolve o resultado.
- **Ação estrutural** (criar campanha completa, montar estratégia, lote): o chat propõe e leva para "Aguardando ação" no formato canônico aprovável.
- **Ação destrutiva ou sensível** (excluir, desativar em lote, alterar configuração crítica da conta): exige confirmação explícita no próprio chat antes de executar.
- **Ação cross-conta:** só permitida se o lojista nomear a conta-alvo explicitamente.

### 5. Transparência e segurança
- Toda ação executada pelo chat fica registrada no histórico de Ações da IA, com o que foi feito, em qual canal, em qual conta e o motivo.
- Erros técnicos (conexão expirada, pixel ausente, criativo faltando) viram mensagens em linguagem de negócio no chat, com indicação clara de como resolver.
- Nada que mexa em dinheiro real (publicar, subir orçamento, ativar campanha) acontece sem confirmação ou sem passar pelo modal de revisão final.

### 6. Documentação e governança
- Atualizar o doc de especificação do Gestor de Tráfego para refletir o chat como porta de entrada única do módulo.
- Atualizar o mapa de UI confirmando a ordem oficial das abas (Gerenciador, Chat IA, Aprendizado da IA, Desempenho, Avisos) e o papel ampliado do Chat IA.
- Atualizar memórias técnicas das restrições mantidas (proposta sai da fila só após publish, supremacia do prompt estratégico, sem IA global, aviso ≠ proposta).

## Pontos que precisam da sua aprovação antes de qualquer mudança
1. **Seleção da conta de anúncios dentro do chat.** Hoje o Chat IA é principal e não pertence a uma conta. Para executar ação real, o chat vai precisar saber a conta-alvo. Proposta: um seletor de conta no topo do chat (mudança de UI), com lembrança da última conta usada. **Confirma?**
2. **Como mostrar propostas geradas no chat.** Elas vão aparecer na aba "Gerenciador → Aguardando ação" exatamente como as autônomas, sem nova seção paralela. **Ok manter sem nova UI?**
3. **Onda 1 primeiro.** Começar pela convergência (fechar o ciclo chat → publicação) antes de expandir capacidades, para destravar valor imediato. **Confirma a ordem?**

## Entrega em ondas

**Onda 1 — Convergência do chat (alta prioridade)**
Unificar no motor único e remover o bloqueio de "incompleta": proposta do chat passa pelo estrategista canônico e vira proposta aprovável. Resultado: lojista consegue conversar, gerar proposta, aprovar e publicar pela Meta — fim a fim — só pelo chat. Sem nova UI (exceto o seletor de conta, se aprovado).

**Onda 2 — Expansão de capacidades operacionais**
Habilitar no chat o conjunto completo de ações Meta (operação fina), Google Ads e TikTok, mais leitura de aprendizados e avisos. Reaproveita as funções que já existem no módulo.

**Onda 3 — Governança e configuração via chat**
Permitir ler e alterar configurações da IA por conta (prompt estratégico, metas, splits, modo de aprovação, janela de publicação), com confirmação para alterações sensíveis.

**Onda 4 — Experimentos e relatórios**
Abertura/encerramento de experimentos A/B, geração de relatórios de ROI e gestão da fila "Aguardando ação" diretamente pelo chat.

## Critérios de aceite (negócio)
1. Conversar no chat → pedir estratégia → receber proposta → aprovar → ver publicada na Meta sem sair do chat, exceto pelo modal de revisão final.
2. Toda ação que existe hoje em qualquer aba do Gestor de Tráfego pode ser solicitada em linguagem natural ao agente.
3. Nenhuma proposta nascida no chat fica em estado "incompleta" travada.
4. Toda execução real está amarrada a uma conta de anúncios.
5. Ações sensíveis exigem confirmação; publicações reais passam pelos gates e pela paridade total atuais.
6. Avisos continuam sendo só diagnóstico — nunca executam nada pelo chat sem virar proposta antes.
7. Doc do módulo, mapa de UI e memórias atualizados.

## Fora de escopo
- Refatorar visualmente as abas existentes do Gestor de Tráfego (além do seletor de conta no chat, se aprovado).
- Alterar o motor de geração de criativos, o ciclo noturno autônomo ou o pipeline de publicação Meta — são reaproveitados como estão.
- Estender o agente para fora do Gestor de Tráfego.
- Reanimar a aba Insights ou criar nova "IA global".

## Próximo passo
Me confirma os três pontos da seção "Pontos que precisam da sua aprovação" e eu já sigo para a **Onda 1**.
