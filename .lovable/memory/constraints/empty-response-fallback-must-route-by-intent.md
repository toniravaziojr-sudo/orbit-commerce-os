---
name: empty-response-fallback-must-route-by-intent
description: Empty AI response fallback in ai-support-chat MUST route by intent (handoff for actionable, media prompt for media inbound, human handoff as default). No universal discovery muleta and no per-state promise muleta.
type: constraint
---
Quando o modelo retorna conteúdo vazio em `ai-support-chat/index.ts`, o fallback NUNCA pode ser uma muleta genérica — nem universal de descoberta ("Deixa eu entender melhor…"), nem por estado ("Me conta um pouco do que você precisa…", "Só um instante…"). Esse padrão mascarava reclamações, pedidos de ação, mídia recebida, e produzia mensagens idênticas em turnos consecutivos quando o modelo voltava vazio duas vezes seguidas.

**Regra (Reg #17.1 + #17.2):** o fallback de resposta vazia DEVE rotear por intenção, nesta ordem:
1. Reflexo determinístico disparou (`firedReflexId`) → resposta vem de `FALLBACK_BY_REFLEX`.
2. `intentClassification.intent` é `complaint` ou `action_request` (ou `requires_action=true`) e nenhuma tool de ação rodou, e não há veto comercial universal → forçar handoff humano (`shouldHandoff=true`, reason `empty_response_actionable_intent`).
3. Veto comercial universal (`complaint` sem sinal pós-venda) → usar `FALLBACK_CONCLUSIVE_BY_STATE` (oferta comercial, sem escalar).
4. Inbound do cliente é mídia (image/audio/document) e não há vision tool → pedir descrição em texto.
5. Tools já rodaram nesta rodada → humanizar a partir do resultado (`buildHumanFallbackFromTools`).
6. **Default (nenhum sinal acima):** transferir para humano com a frase fixa:
   > "No momento não consigo te ajudar, vou te transferir para um atendente humano."
   Forçar `shouldHandoff=true` com reason `empty_response_no_signal`. A conversa entra em `waiting_agent` e a trava de silêncio pós-handoff (Reg #17.3) impede a IA de voltar a falar até a equipe assumir.

**PROIBIDO:** usar `FALLBACK_PROMISE_BY_STATE` como caminho default em resposta vazia. Esse mapa só pode existir como referência histórica; não pode ser ramo ativo do fluxo.

**Causa raiz que motivou Reg #17.2 (mai/2026, Respeite o Homem):** em estados curtos (greeting/discovery), o budget de `max_completion_tokens=600` em gpt-5* com `reasoning.effort=minimal` era consumido todo pelo raciocínio interno, e o modelo voltava `finish_reason="length"` com `content=""`. Sem reflexo/ação/mídia/tools, caía na muleta de discovery — duas vezes seguidas gerou mensagens idênticas e quebrou confiança. Correção dupla: (a) `stateMaxTokens` para estados curtos sobe para 1500; (b) default vira handoff humano em vez de muleta.

**Onde aplica:** `supabase/functions/ai-support-chat/index.ts`, bloco "resposta vazia" (linhas ~7540–7720) e cálculo de `stateMaxTokens` (linha ~6834).
