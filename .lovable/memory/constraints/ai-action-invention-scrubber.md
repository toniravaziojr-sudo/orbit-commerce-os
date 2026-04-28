---
name: AI Action Invention Scrubber
description: Modelo proibido de afirmar ações executadas sem tool correspondente; scrubber força handoff
type: constraint
---

A IA do atendimento (modo informativo OU vendas) NÃO pode afirmar que executou uma ação sem que a tool correspondente tenha sido chamada NO MESMO TURNO.

**Frases proibidas sem tool backing:**
- "reenviei o e-mail/código/link"
- "encaminhei pra equipe/suporte/financeiro"
- "acionei o suporte/técnico"
- "atualizei seu cadastro/endereço"
- "cancelei/estornei seu pedido"
- "abri um chamado/ticket/protocolo"

**Tools que justificam essas falas:** `request_human_handoff`, `save_customer_data`, `update_customer_record`.

**Comportamento do scrubber (FIX-D em `ai-support-chat/index.ts`):**
Se a resposta contém uma frase de ação E nenhuma tool de backing foi chamada → substitui por fala neutra de handoff e força `shouldHandoff=true` com `reason='unsupported_action_promised'`.

**Por quê:** afirmação de ação não executada gera expectativa quebrada e é a principal causa de reclamação direta sobre IA "que mente". Spec: `docs/especificacoes/crm/crm-atendimento.md` §4.6 (defesa em profundidade).

**Onde aplica:** `ai-support-chat/index.ts`. Qualquer outra edge function que gere resposta livre da IA para o cliente DEVE replicar o scrubber.
