
## 📋 CHECKLIST DE CONFORMIDADE
- Doc de Regras lido: sim (governança + memórias de IA de atendimento)
- Doc do tema lido: memórias `empty-response-fallback-must-route-by-intent`, `empty-response-fallback-reflex-aware`, `ai-provider-openai-locked`, `handoff-idempotency-by-conversation`, `handoff-must-silence-ai-until-human-assigns`, `ai-action-invention-scrubber`. Spec formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (registro novo obrigatório).
- Fluxo afetado: atendimento IA (chat de teste e WhatsApp real) — caminho de "resposta vazia do modelo".
- Fonte de verdade: pipeline `ai-support-chat` (estado da conversa, intenção, reflexos, tools desta rodada).
- Módulos impactados: Atendimento IA, Central de Atendimento (tickets/handoff), changelog da IA.
- Impacto cruzado: tickets de suporte (idempotência por conversa), trava de silêncio da IA após handoff.
- UI impactada? Não há mudança de tela. mapa-ui.md não precisa atualização.
- Situação: Aguardando confirmação do usuário.

## O que está acontecendo hoje

1. No teste de hoje (Respeite o Homem), as duas respostas idênticas ("Me conta um pouco do que você precisa…") **não vieram do modelo** — vieram de uma muleta interna usada quando o modelo devolve texto vazio.
2. O modelo voltou vazio porque, nos estados curtos (saudação e descoberta), o orçamento de raciocínio do modelo é **pequeno demais**: o modelo gasta todo o orçamento "pensando" e não sobra espaço para escrever a resposta. Isso é independente de crédito da OpenAI — a conta tem crédito, o problema é configuração interna do nosso lado.
3. Quando isso acontece e não há reflexo determinístico, nem ação pendente, nem mídia, nem ferramenta executada na rodada, o sistema cai numa frase genérica de "descoberta" e **repete a mesma frase** se o cenário se repetir. Isso quebra a regra de "nunca usar muleta universal" e gera a sensação de IA robótica.
4. Há ainda um efeito de classificação: pedidos como "esse produto funciona mesmo?" e "shampoo pra calvície" não foram tratados como pedido comercial real porque a resposta nunca chegou a ser gerada — o caminho morreu antes, na muleta.

## O que eu faria

Três frentes, na mesma entrega:

**Frente 1 — Substituir a muleta genérica por transferência real para humano (pedido direto do usuário)**
Quando o modelo vier vazio e não houver reflexo determinístico, nem ação clara pendente, nem mídia, nem ferramenta executada, a IA passa a responder exatamente:
> "No momento não consigo te ajudar, vou te transferir para um atendente humano."
E, no mesmo turno, abre/atualiza ticket de atendimento humano para aquela conversa (respeitando a regra de um ticket por conversa) e silencia a IA até alguém assumir. Isso é coerente com a regra existente de "nunca prometer ação sem executar" e com a regra de "handoff é terminal".

**Frente 2 — Corrigir a causa raiz do retorno vazio (o motivo de cair na muleta)**
Aumentar o orçamento de geração do modelo nos estados curtos para um valor que comporte tanto o raciocínio interno quanto a resposta visível, e garantir que, se ainda assim vier vazio uma vez, o sistema **tente uma segunda vez com um modelo de fallback** antes de desistir e transferir para humano. Hoje só existe fallback entre modelos quando há erro HTTP — não quando o modelo responde "ok" mas com texto vazio.

**Frente 3 — Registro e anti-regressão**
Atualizar o changelog da IA de atendimento com o diagnóstico, a correção e o resultado esperado. Atualizar/criar a memória de "fallback de resposta vazia" para refletir a nova regra: muleta universal está proibida; o caminho do "estado sem nada para dizer" agora é handoff humano com a frase definida pelo lojista.

## Resultado final

- Cliente nunca mais recebe duas vezes a mesma frase de "me conta um pouco do que você precisa".
- Quando a IA realmente não tem como responder, ela diz claramente que vai transferir e o atendimento humano recebe o ticket no mesmo segundo.
- A chance de o modelo voltar vazio cai porque o orçamento foi ajustado e existe uma segunda tentativa antes do handoff.
- O comportamento fica documentado no changelog da IA e travado por memória anti-regressão.

## O que continua igual

- Reflexos determinísticos (agradecimento, "kkk", "alô?", CEP recebido, etc.) continuam respondendo direto, sem chamar humano.
- Pedidos com ação pendente (reclamação real de pedido, troca, reembolso) continuam indo para humano com a mensagem já existente.
- Inbound de mídia continua pedindo descrição em texto.
- O provedor continua sendo OpenAI (memória `ai-provider-openai-locked`).

## Bloco técnico (opcional, só se você quiser)

- Arquivo: `supabase/functions/ai-support-chat/index.ts`, ramo "resposta vazia" (linhas 7540–7720).
- Mudança 1: ramo `state_promise` deixa de existir; quando nenhum dos outros gatilhos (reflexo, actionable, mídia, tools_humanized, commercial_veto) se aplica, força `shouldHandoff=true`, `handoffReason="empty_response_no_signal"` e `aiContent="No momento não consigo te ajudar, vou te transferir para um atendente humano."`.
- Mudança 2: `stateMaxTokens` para `SHORT_OUTPUT_STATES` sobe de 600 para 1500 (mantém latência aceitável e cobre o reasoning do gpt-5). Quando `finish_reason="length"` E `content` vazio E `reasoning_tokens > completion_text_tokens`, fazer uma retomada com o próximo modelo da lista (`gpt-5-mini` → `gpt-5`) reaproveitando `currentMessages`, antes de cair no handoff.
- Mudança 3: `request_human_handoff` já é idempotente por conversa (memória `handoff-idempotency-by-conversation`) — reusar a mesma função, não criar novo código de ticket.
- Documentação: novo registro em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` e atualização das memórias `empty-response-fallback-must-route-by-intent` e `empty-response-fallback-reflex-aware` para refletir que o caminho default agora é handoff humano (sem muleta universal).

## 📌 STATUS DA ENTREGA: Proposta — aguardando confirmação

Confirma que eu ajusto assim?
