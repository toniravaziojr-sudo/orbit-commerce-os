---
name: Modo Vendas — veto comercial universal; cliente expressando problema nunca é reclamação
description: Lógica universal segment-agnostic. Reclamação real de pedido (sinais de pós-venda) é o ÚNICO caminho legítimo de handoff por "complaint". Qualquer outro turno classificado como complaint é tratado como oportunidade comercial, em qualquer segmento (cosmético, pet, moda, eletrônico, suplemento, software, etc.).
type: constraint
---

## Regras invioláveis (Reg #2.17 Fases 1–2, v2 universal)

1. **Não enumerar sintomas por segmento.**
   - É proibido manter listas de palavras-chave de "dor" específicas de um vertical (cabelo, pele, barba, ração, sapato, etc.). Isso viola a governança do Motor de Contexto Comercial (`docs/especificacoes/ia/motor-contexto-comercial.md`) que é multi-tenant e segment-agnostic.
   - O detector universal (`pain-symptom-detector.ts`) reconhece **apenas** sinais UNIVERSAIS de reclamação de pedido (palavras de pós-venda: "meu pedido", "não chegou", "rastreio", "reembolso", "devolução", "defeito", "produto errado", "atrasado", "extraviado", "estorno", "chargeback", "procon", "reclamação explícita", etc.). Esses sinais são iguais em qualquer e-commerce.

2. **Veto comercial universal.**
   - `shouldVetoComplaintHandoff` decide a partir de duas variáveis universais:
     - `signal.isOrderComplaint` (sinal de pós-venda detectado).
     - `intent` do classificador.
   - Regra:
     - `isOrderComplaint=true` → handoff legítimo, **não veta**.
     - `intent=purchase_intent` → **veta** (cliente quer comprar, escalar é perda de venda).
     - `intent=complaint` sem sinal de pós-venda → **veta** (falso positivo do classificador; é cliente expressando problema/necessidade que o catálogo resolve, em qualquer segmento).

3. **Motor único de handoff.**
   - `handoff-motor.ts` consolida todas as fontes em uma única decisão pós-classificação. Cada fonte (intent, palavras-chave, regras custom, knowledge insuficiente) vira voto, nunca seta `shouldHandoff` direto.
   - Override do veto continua sendo: cliente pediu humano explicitamente OU `isOrderComplaint=true`.

4. **Fallback de resposta vazia também aplica o veto universal.**
   - Quando o modelo retorna vazio e `intent=complaint`, antes de escalar é obrigatório verificar `painSignal.isOrderComplaint`. Sem sinal de pós-venda, usa o fallback do estado (continua vendendo) em vez de chamar humano. Esse caminho era a fonte do A2 escapando do veto.

5. **Log estruturado obrigatório por turno:**
   - `[handoff-motor] decision=… vetoed=… winner=… intent=… complaint=… complaint_terms=[…]`

## Por quê

A versão anterior tinha lista de sintomas de cabelo/pele/barba (queda, caspa, ressecado, coçando, frizz, espinha, barba falhada, etc.). Isso funcionava no Respeite o Homem mas:
- Não funcionaria para pet shop (cachorro não come, ração que faz mal), moda (sapato aperta, camisa encolhe), eletrônico (controle não responde), suplementos, software, etc.
- Violava governança multi-tenant e o princípio do Motor de Contexto Comercial.

A regra correta é: **sinais de pós-venda são universais; "dor de produto" não precisa ser enumerada — é simplesmente "complaint do classificador SEM sinal de pós-venda"**, em qualquer segmento.

## Como aplicar

- Toda nova regra de "dor que vende" NÃO entra em lista de keywords. Entra como melhoria do classificador de intent (TPR), que é onde dor/necessidade são reconhecidas semanticamente.
- Toda nova categoria de "reclamação real" entra em `ORDER_COMPLAINT_PATTERNS` apenas se for sinal universal de pós-venda (ex.: "nota fiscal", "garantia", "assistência técnica").
- Cenários A2 (cliente expressa problema sem mencionar pedido), C2 (purchase_intent + irritação), D1 (reclamação real de entrega), D3 (rastreio/pedido) são testes fixos da bateria.

## Fonte de verdade

- Doc formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — Registro #2.17 Fases B–C.
- Governança: `docs/especificacoes/ia/motor-contexto-comercial.md` (proibição de hardcode por segmento).
- Código: `supabase/functions/_shared/sales-pipeline/pain-symptom-detector.ts`, `supabase/functions/_shared/sales-pipeline/handoff-motor.ts`, integração e veto duplicado de fallback em `supabase/functions/ai-support-chat/index.ts`.
