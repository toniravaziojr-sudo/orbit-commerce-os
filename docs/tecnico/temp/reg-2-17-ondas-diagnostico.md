# Reg #2.17 — Diagnóstico das Ondas de Teste (TEMPORÁRIO)

> Doc temporário. Após rodar as 4 ondas, será consolidado em plano de correção e este arquivo descartado.

## Contexto
Validação da Fase 1 (TPR como fonte primária de classificação de turno) através de 12 cenários divididos em 4 ondas (A/B/C/D), 3 cenários cada. Tenant: Respeite o Homem. Canal: ai-test-sandbox + Agent Mode.

---

## Onda A — Saudação e descoberta inicial

### A1 — Saudação pura ("Bom dia")
- **Status:** ✅ OK
- **Esperado:** Espelhar período do dia + abrir pergunta de descoberta, sem preço, sem produto.
- **Observado:** Resposta com saudação espelhada e pergunta aberta de descoberta.
- **Conclusão:** Greeting Mirror Gate + TPR funcionando corretamente em saudação pura.

### A2 — Saudação + dor ("tô com a barba ressecada e coçando") 🔴
- **Status:** ❌ REGRESSÃO CRÍTICA
- **Esperado:** Reconhecer sintoma/dor → entrar em descoberta → oferecer probe de catálogo (Shampoo + Loção + Balm + Kit) com foco em hidratação/balm.
- **Observado:** Classificou o turno como **complaint (reclamação)** e disparou **handoff humano** antes de oferecer qualquer solução.
- **Causa provável:** O TPR (ou o detector regex de fallback) está mapeando termos de sintoma físico ("ressecada", "coçando") como reclamação de produto/atendimento, em vez de "dor do cliente que abre oportunidade comercial".
- **Impacto:** Trava o fluxo de vendas exatamente no caso de uso mais valioso — cliente com problema explícito que o catálogo resolve.
- **Hipótese de correção (a confirmar pós-ondas):** Adicionar no schema do TPR um sinal `is_product_pain_symptom` distinto de `is_complaint`, e só rotear para handoff quando for queixa sobre pedido/entrega/produto comprado, nunca quando for sintoma corporal/capilar.

### A3 — Pergunta direta ("vendem balm?")
- **Status:** ✅ OK
- **Esperado:** Confirmar disponibilidade, recomendar família correta, sem inventar preço.
- **Observado:** Recomendou família correta (Balm), Price Scrubber funcionando (sem R$ vazado).
- **Conclusão:** Catálogo + scrub de preço OK em pergunta direta de produto.

### Resumo Onda A
- 2/3 OK, 1 regressão crítica bloqueante (A2).
- **Bloqueador identificado:** classificação errada de "dor do cliente" como "complaint" → handoff prematuro.
- A regressão é da Fase 1 (mudança de fonte de leitura para TPR) e precisa ser corrigida antes de promover a Fase 2.

---

## Onda B — (a executar)

## Onda C — (a executar)

## Onda D — (a executar)
