---
name: Modo Vendas — dor do cliente nunca é reclamação; handoff tem motor único
description: Sintoma físico do cliente é oportunidade comercial e nunca pode disparar handoff. Toda decisão de escalada para humano deve passar por um único motor pós-classificação que aplica veto comercial.
type: constraint
---

## Regras invioláveis (Reg #2.17 Fases 1–2)

1. **Dor física ≠ reclamação de pedido.**
   - `pain-symptom-detector.ts` separa dois sinais:
     - `isProductPainSymptom` — sintoma que o catálogo resolve (ressecamento, queda, caspa, calvície, coceira, oleosidade, etc.). **Sempre** oportunidade comercial. Proibido disparar handoff.
     - `isOrderComplaint` — reclamação real de pedido/entrega/atendimento já comprado (não chegou, atrasado, cancelar pedido, reembolso, defeito, produto errado). Caminho legítimo de handoff.
   - Sinal "complaint" do classificador sem `isOrderComplaint=true` é insuficiente para escalar.

2. **Motor único de handoff.**
   - `handoff-motor.ts` consolida todas as fontes (intent classifier, palavras-chave, regras custom, conhecimento insuficiente) em **uma única decisão pós-classificação**. As fontes viram sugestões.
   - Veto comercial automático: se houver `purchase_intent` ou `isProductPainSymptom=true`, escalada por reclamação é bloqueada.
   - **Override do veto** (continua escalando):
     - Cliente pediu humano explicitamente.
     - `isOrderComplaint=true` (reclamação real de pedido).

3. **Log estruturado obrigatório por turno:**
   - `[handoff-motor] decision=… vetoed=… winner=… sources=…`
   - Sem isso o problema vira invisível de novo.

## Por quê

A análise das ondas A–D mostrou que:
- A2 (cliente fala de ressecamento) escalava como reclamação.
- C2 ("quero o kit barba") escalava mesmo com purchase_intent.
- 4 caminhos paralelos setavam `shouldHandoff=true` ignorando o classificador.

Sem motor único e sem separar dor de reclamação, o sistema perdia venda em todo turno consultivo com sintoma e tinha decisões contraditórias entre camadas.

## Como aplicar

- Toda nova fonte de handoff (palavra-chave, regra de cliente, knowledge insuficiente, etc.) **deve** virar voto no `handoff-motor.ts`, nunca setar `shouldHandoff` direto.
- Toda nova categoria de "dor que vende" deve entrar no `PAIN_SYMPTOM_PATTERNS`.
- Toda nova categoria de "reclamação real" deve entrar no `ORDER_COMPLAINT_PATTERNS` (e o motor mantém override).
- Cenários A2, C2 e D1 ficam como testes fixos da bateria do tenant Respeite o Homem.

## Fonte de verdade

- Doc formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — Registro #2.17 Fases B–C.
- Código: `supabase/functions/_shared/sales-pipeline/pain-symptom-detector.ts`, `supabase/functions/_shared/sales-pipeline/handoff-motor.ts`, integração em `supabase/functions/ai-support-chat/index.ts`.
