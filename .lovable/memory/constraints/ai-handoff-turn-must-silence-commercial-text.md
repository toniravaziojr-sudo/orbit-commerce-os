---
name: IA — turno do handoff silencia copy comercial
description: Quando request_human_handoff é acionada com sucesso no turno, a resposta de texto DEVE ser apenas acolhimento + aviso de transferência. Gate determinístico pós-saída remove copy comercial (preço, link, frete, kit, cupom, gancho de venda).
type: constraint
---

## Regra (Reg #17.6 — Handoff Silence Gate)

Em `supabase/functions/ai-support-chat/index.ts`, logo após os scrubbers de saída e antes do STEP 8, há um gate determinístico:

- Se `toolResultsThisTurn` contém `request_human_handoff` com `success=true && !blocked`, AND `aiContent` contém qualquer marcador comercial:
  - `R$\s?\d` (preço)
  - `https?://` (link)
  - `\b(frete|entrega|prazo|cep)\b`
  - `\b(cupom|desconto|promo[çc][ãa]o)\b`
  - `\b(kit|combo|leve\s+\d|\d\s+unidades?)\b`
  - `\b(adicionei|adiciono|no\s+carrinho|finalizar|gerar?\s+link)\b`
  - `\b(quer\s+ver|quer\s+que\s+eu|posso\s+(te\s+)?mostrar|te\s+mando)\b`
- Substitui o texto por mensagem neutra de transferência. Variante para `complaint|angry`: *"Sinto muito pelo ocorrido. Já estou passando seu caso pra um humano da nossa equipe — em instantes te respondem por aqui."*

O lock terminal (`HANDOFF_AWAITING_HUMAN`) continua valendo nos turnos **seguintes**. Este gate cobre o turno **atual** da ferramenta.

## Por quê

Bateria de teste do tenant Respeite o Homem (mai/2026): no turno da reclamação, a IA marcava handoff corretamente (✅) mas ainda entregava texto comercial junto ("...e enquanto isso, quer ver nosso kit?"), o que é insensível e quebra a promessa de "vou passar pra um humano".

## Como aplicar

- Nunca remover ou afrouxar a lista de marcadores sem aprovação explícita.
- Manter consistência: o prompt do modo vendas também tem instrução dura de **SILÊNCIO COMERCIAL NO HANDOFF** — prompt + gate são complementares.
- Registro: Reg #30 em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.
