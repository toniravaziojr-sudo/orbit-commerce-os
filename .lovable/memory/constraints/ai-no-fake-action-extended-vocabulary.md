---
name: Action-invention scrubber must cover extended vocabulary
description: O scrubber FIX-D do ai-support-chat tem que cobrir três famílias de fala (pretérito sem tool, promessa de futuro sem job, redefinição de senha) — não só "reenviei/cancelei/acionei".
type: constraint
---

## Regra

O regex `ACTION_INVENTION_PATTERNS` em `supabase/functions/ai-support-chat/index.ts` (FIX-D) **deve** cobrir, no mínimo, três famílias de promessa não suportada por tool:

1. **Pretérito sem tool:** `reenviei|encaminhei|acionei|atualizei|cancelei|abri chamado|anexei|inclu(í|i) no pedido|solicitei reset/redefinição/recuperação de senha|enviei link de redefinição`.
2. **Promessa de futuro sem job:** `te aviso quando|vou te avisar|vou avisar|notifico você quando|fico no aguardo|aguardo o sistema|quando voltar|quando estiver disponível|quando chegar|quando sair do faturamento|quando for postado|quando o e-mail chegar`.
3. **Senha:** o sistema **não tem** tool de reset de senha. Qualquer afirmação de "redefinição de senha foi enviada / solicitei o reset / mandei o link" cai no scrubber e força handoff.

A whitelist de tools que justificam ações afirmadas (`ACTION_BACKING_TOOLS`) continua restrita a `request_human_handoff`, `save_customer_data`, `update_customer_record`. Verbos comerciais (carrinho/cupom/checkout/imagem) têm fala própria e não passam pela mesma checagem porque não usam regex de promessa de ação.

## Por quê

Auditoria de 7 dias do tenant Respeite o Homem (mai/2026) mostrou 14 conversas em que a IA prometeu ação inexistente (anexar PDF, reset de senha, "te aviso quando voltar"). O regex original só pegava `reenviei/cancelei/acionei/atualizei seu cadastro`. Cliente confiava na promessa, nada acontecia, virava reclamação direta. **Why:** o scrubber é a última linha; se ele não cobre o vocabulário real do modelo, o sistema mente para o cliente.

## Como aplicar

- Toda nova fala recorrente de promessa não suportada que aparecer em conversas reais entra no regex via Reg #N do `ia-atendimento-changelog.md`.
- Não criar tool fake só para "validar" a fala — se a tool não existe, o caminho é handoff.
- Validação obrigatória: rodar replay determinístico das 3 conversas-âncora (Antônio anexar PDF, Romero reset senha, Geraldo "te aviso") e confirmar que `[FIX-D] action-invention scrubbed` aparece nos logs.
