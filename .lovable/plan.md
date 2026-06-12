# Onda F — Pipeline de Produção do Gestor de Tráfego IA (entregue 2026-06-12)

## Status
✅ Implementado e validado tecnicamente. Aguardando validação operacional do usuário.

## O que foi entregue

### 1. Hierarquia Plano Estratégico → Propostas filhas
- Aprovar Plano marca o plano como aprovado (não publica nada).
- Strategist é acionado com vínculo explícito ao plano e à rodada de análise.
- Cada proposta filha gerada guarda: plano-pai, rodada de análise e índice da ação planejada de origem.
- Segundo clique em Aprovar Plano **não duplica** filhas (dedup por índice único parcial no banco).
- Recusar/Ajustar continuam funcionando; comentários úteis viram aprendizado sugerido.

### 2. UTM obrigatória no nível Anúncio/Criativo
- Modelo interno fixo de produção (sem campo na UI):
  - `utm_source=meta`, `utm_medium=paid_social`, `utm_campaign={campanha}`, `utm_content={anuncio}`, `utm_term={publico_ou_funil}`.
- Aplicação automática ao montar a proposta:
  - Preserva query params já existentes.
  - **Não sobrescreve** UTMs já preenchidas — registra warning técnico.
  - Completa apenas o que faltar.
- Gate de UTM no modal de proposta: bloqueia aprovação do Anúncio sem UTM, aponta para o nó Criativo, mensagem amigável.
- Não bloqueia a aprovação do Plano Estratégico em si.

### 3. Aprendizados da IA editáveis
- Nova área em **Gestor de Tráfego IA → Configurações Gerais → Aprendizados da IA**.
- 4 abas: Todos · Sugeridos · Ativos · Pausados · Arquivados.
- Categorias: produto, público, orçamento, funil, criativo, copy, oferta, performance, restrição, tracking, outro.
- Ações: criar, editar, ativar, pausar, arquivar, remover.
- Feedback do usuário (com motivo/observação útil) vira aprendizado **sugerido** automaticamente; nunca ativa sozinho.
- Aprendizado criado manualmente nasce ativo.
- **Somente aprendizados ativos** entram no contexto do Strategist e na expansão Plano → propostas.
- Dedup: aprendizado parecido (mesma categoria + título normalizado) **reforça** evidência e confiança em vez de duplicar.

## Restrições respeitadas
- Sem publicação, sem mutação Meta/Google/TikTok, sem criativo final automático, sem crédito sem aprovação.
- Sem Google/TikTok operacional, sem cron mensal, sem admin avançado.
- Sem campo de UTM na UI de Configurações Gerais.
- Aprendizado sugerido nunca ativa sozinho.
- Aprendizados pausados/arquivados/sugeridos não entram no prompt da IA.
- Propostas filhas nunca nascem soltas (sempre vinculadas a plano e análise).

## Como validar no painel
1. Rodar uma análise inicial em uma conta Meta com IA ativa.
2. Conferir que o Plano Estratégico aparece como proposta única.
3. Clicar em "Aprovar Plano" → conferir que aparecem propostas filhas na fila "Aguardando Ação".
4. Clicar em "Aprovar Plano" de novo → conferir que **não** duplica.
5. Em uma proposta filha de anúncio, conferir que o link de destino já tem UTMs aplicadas.
6. Tentar aprovar uma proposta cujo anúncio tenha link sem UTM → conferir bloqueio com mensagem.
7. Recusar uma proposta com motivo descritivo → ir em Configurações Gerais → Aprendizados da IA → conferir item sugerido.
8. Ativar o aprendizado → próxima análise deve mencionar "considerou X aprendizados ativos".

## Testes automatizados
- `src/test/ads-utm.test.ts` — 5 testes (modelo, preservação, validação, slugify, URL inválida) ✅
- `src/test/ads-gates-utm.test.ts` — 3 testes (passa/bloqueia/ignora sem URL) ✅
