---
name: AI Router — Fallback obrigatório em gatilhos manuais
description: Chamadas manuais de IA (clique do usuário) NUNCA podem desabilitar o fallback entre provedores. Timeout/5xx do provedor primário deve cair para o próximo (Gemini→OpenAI→Lovable).
type: constraint
---

# Regra
Em qualquer chamada de IA disparada por clique do usuário (ex.: "Rodar análise estratégica agora" no Gestor de Tráfego IA), o roteador de IA DEVE manter o fallback entre provedores ativo. É proibido passar `noFallback: true` nesse tipo de gatilho.

# Por quê
Já houve regressão (2026-06-18) em que o gatilho manual da análise estratégica do Gestor de Tráfego IA foi configurado com `noFallback: true` + `maxRetries: 0`. Quando o Gemini estourou o timeout (135s, por causa de prompt gigantesco com 272 campanhas, 200 adsets e 2.473 linhas de insights), o sistema falhou de imediato com "Todos os provedores de IA falharam" sem sequer tentar OpenAI ou Lovable. O usuário viu "Última tentativa falhou" e não conseguiu rodar a análise.

# Como aplicar
- `noFallback` só é aceitável em chamadas automáticas de baixo custo onde reexecução em outro provedor seria desperdício explícito (ex.: heurísticas internas baratas).
- Em gatilhos manuais: `noFallback: false` SEMPRE.
- `maxRetries: 0` continua válido em gatilhos manuais para evitar reexecução no MESMO provedor que travou (custo duplo), desde que o fallback esteja ativo — assim o roteador pula direto para o próximo provedor em timeout/5xx, sem reprocessar o mesmo.
- Timeout não consome tokens cobrados; portanto acionar o próximo provedor após timeout é seguro e barato.

# Anti-regressão
Toda PR que tocar em chamada de IA disparada por ação manual do usuário deve revisar se mantém o fallback. Code review deve rejeitar `noFallback: true` em handlers de botão/ação manual.
