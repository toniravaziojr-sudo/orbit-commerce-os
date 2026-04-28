---
name: AI Response Anti-Repetition Uses 80-char Prefix Hash
description: Hash anti-repetição deve ser sobre prefixo normalizado, não texto completo
type: constraint
---

O hash usado para detectar respostas repetidas da IA (`hashResponse` em `supabase/functions/_shared/sales-state-machine.ts`) DEVE ser calculado sobre um **prefixo normalizado de 80 caracteres**, não sobre o texto completo.

**Normalização obrigatória:**
1. lowercase
2. remover acentos (NFD + strip combining marks)
3. substituir tudo que não for `[a-z0-9 ]` por espaço (remove pontuação/emoji/símbolos)
4. colapsar espaços
5. trim
6. cortar nos primeiros 80 caracteres

**Por quê:** repetições percebidas pelo cliente são quase sempre repetições de **abertura** ("Claro! Posso te ajudar com..."). Hashear o texto inteiro fazia colisão depender de detalhes que o cliente nem nota e deixava passar repetições reais. O prefixo normalizado captura o que de fato incomoda.

**Quando há colisão:** uma única tentativa de regeneração com `tool_choice='none'` e instrução de variação substantiva. Se ainda colidir, suprimir e auditar.

**Onde aplica:** `supabase/functions/_shared/sales-state-machine.ts` (definição) e `supabase/functions/ai-support-chat/index.ts` (consumo). Spec: `docs/especificacoes/crm/crm-atendimento.md` §4.9.
