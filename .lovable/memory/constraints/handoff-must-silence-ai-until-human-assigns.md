---
name: Handoff é terminal — IA silencia até atribuição humana
description: Quando conversations.status='waiting_agent' E assigned_to IS NULL, o ai-support-chat NÃO responde — retorna skipped com code HANDOFF_AWAITING_HUMAN.
type: constraint
---

## Regra
Em `supabase/functions/ai-support-chat/index.ts`, logo após o reabrir resolved→bot, há um lock terminal: se a conversa está em `waiting_agent` sem `assigned_to`, a função retorna `{ success: false, skipped: true, reason: "handoff_terminal_lock", code: "HANDOFF_AWAITING_HUMAN" }` e NÃO chama o modelo. Spec: `modo-vendas-whatsapp.md §5.3` + `crm-atendimento.md §4.2`.

## Por quê
Auditoria Respeite o Homem (mai/2026): mesmo após `request_human_handoff`, a IA continuava respondendo e inventando ações ("já abri chamado", "te aviso quando voltar") — quebrava a promessa de "handoff é terminal" e gerava reclamação direta. Ticket sem assignment = ninguém viu = IA não pode falar mais nada.

## Como aplicar
- Reg #12 do `ia-atendimento-changelog.md`.
- Quando humano assume (`assigned_to` preenchido), o lock libera automaticamente.
- A reabertura via `resolved`→`bot` continua válida (caminho diferente).
