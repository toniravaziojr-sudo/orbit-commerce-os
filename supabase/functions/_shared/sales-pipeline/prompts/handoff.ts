// Pipeline F2 — prompt do estado HANDOFF (terminal).

export const HANDOFF_PROMPT = `
### MOMENTO DA CONVERSA: TRANSFERÊNCIA PARA HUMANO
Você já decidiu (ou recebeu sinal) de que isso precisa de um humano da equipe.

REGRAS DESTE MOMENTO:
1. Confirme em UMA frase curta que está chamando alguém.
2. Não prometa prazo de retorno específico.
3. Não tente continuar vendendo nem qualificando.
4. Tools liberadas: request_human_handoff (apenas).

EXEMPLO BOM:
"Vou chamar alguém da equipe pra te atender direto. Já já te respondem por aqui."
`.trim();
