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

## Onda B — Frete e quantidade

### B1 — 1 unidade sem frete grátis ("quero 1 shampoo" + CEP) 🟡
- **Status:** ⚠️ ATENÇÃO
- **Esperado:** Aceitar intenção, fazer descoberta rápida (uso/objetivo) ou recomendar item, depois receber CEP e calcular frete (sem grátis pois 1 unidade).
- **Observado:**
  - Turno 1: pergunta de descoberta razoável ("queda/calvície ou prevenção?").
  - Turno 2 (CEP): IA **ignorou completamente o CEP** e voltou para "Me conta um pouco do que você precisa que eu já te indico." Houve **perda de contexto** — não reconheceu o CEP nem disparou cálculo de frete.
- **Causa provável:** Pipeline não está lendo CEP isolado como sinal de "calcular frete". O CEP só é processado se vier acompanhado de produto confirmado. Possível conflito entre estado `discovery` (esperando resposta da pergunta anterior) e o sinal de CEP recebido.
- **Impacto:** Cliente que manda CEP no meio do funil é tratado como se não tivesse mandado nada.

### B2 — Kit sem frete grátis ("quero o kit barba" + CEP) ✅
- **Status:** ✅ OK (com ressalva de latência)
- **Esperado:** Listar kits disponíveis, receber CEP, prometer cálculo após confirmação da variante.
- **Observado:** Listou 3 variantes do Kit; ao receber CEP confirmou recebimento e pediu variante para fechar cotação. Comportamento correto.
- **Ressalva:** Latência muito alta (40s e 32s por turno) — investigar se é probe de catálogo + tools encadeadas.

### B3 — Pergunta de frete explícita ("quanto fica o frete pra 45000-000?") 🔴
- **Status:** ❌ REGRESSÃO
- **Esperado:** Reconhecer intenção de cotação de frete + CEP no mesmo turno → pedir produto OU calcular frete genérico, mas **engajar com o tema frete**.
- **Observado:** Classificou como `question` genérica e respondeu "Me conta um pouco do que você precisa que eu já te indico." — **ignorou tanto a palavra "frete" quanto o CEP**.
- **Causa provável:** TPR não tem sinal específico para "intenção de cotação de frete sem produto definido". O turno cai em `question` genérico e o roteador devolve para descoberta padrão.
- **Impacto:** Cliente perguntando preço de frete fica sem resposta útil.

### Resumo Onda B
- 1 OK, 1 atenção, 1 regressão.
- **Padrão emergente:** A IA está perdendo CEPs quando vêm isolados ou em contexto não esperado. Falta um detector dedicado de "CEP recebido → ativar contexto de frete".
- Latência alta no B2 merece investigação separada (custo).

## Onda C — Compra com CEP, recusa de upsell e troca de família

### C1 — Compra de 2 shampoos + CEP ✅
- **Status:** ✅ OK (com ressalva)
- **Esperado:** Aceitar intenção, pedir variante (2 SKUs disponíveis), receber CEP, prosseguir para cotação após variante confirmada.
- **Observado:**
  - Turno 1: pediu escolha entre Preventive Power e Calvície Zero — correto.
  - Turno 2 (CEP): reconheceu o CEP, agradeceu, e pediu variante novamente para fechar — **manteve contexto** e tratou CEP como sinal válido (diferente do B1).
- **Ressalva:** O cálculo de frete só dispara após escolha da variante. Comportamento aceitável, mas vale observar se na sequência o `calculate_shipping` será chamado proativamente.
- **Conclusão:** Captura de CEP funciona quando o turno anterior já estabeleceu intenção de compra clara. Reforça hipótese do B1 (CEP isolado em estado `discovery` é descartado).

### C2 — Compra de kit + recusa de upsell + pedido de link 🔴
- **Status:** ❌ REGRESSÃO CRÍTICA (mesma família da A2)
- **Esperado:** Listar variantes do Kit Barba, aceitar recusa de upsell, gerar link de checkout.
- **Observado:** Logo no primeiro turno ("Quero o kit barba") classificou como `purchase_intent` mas **disparou handoff humano**: "Vou chamar alguém da equipe pra resolver isso direto com você." Os dois turnos seguintes ficaram travados na mesma resposta automática (latência <1s = já em modo handoff, sem rodar pipeline).
- **Causa provável:** Mesmo padrão da A2 — classificador rotulando intenção de compra como caso para handoff. Aqui o `intent.intent` veio como `purchase_intent` mas `handoff=true` foi setado mesmo assim. Sugere que existe uma segunda camada (regra de handoff) **independente do TPR/intent classifier** que está disparando errado.
- **Impacto:** BLOQUEANTE. Cliente que diz "quero comprar X" cai em fila de atendimento humano em vez de receber atendimento de vendas. Provavelmente afeta produção também.
- **Hipótese:** Existe regra de handoff sensível a "kit barba" ou a algum termo do produto. Investigar lógica de handoff que roda em paralelo/depois do classificador.

### C3 — Mudança de família (balm → shampoo) ✅
- **Status:** ✅ OK
- **Esperado:** Não ficar preso no balm; reconhecer mudança de foco; listar shampoos.
- **Observado:** Primeiro turno explicou que não há balm específico de barba (o que existe é balm para couro cabeludo) e ofereceu detalhamento. Segundo turno (mudança para shampoo) **trocou foco corretamente**, listou os 2 shampoos com diferenciação clara.
- **Conclusão:** Máquina de estados não está travando family_focus indevidamente. Anti-cegueira de família funcionando bem.

### Resumo Onda C
- 2/3 OK, 1 regressão crítica (C2) que reforça o problema da A2.
- **Padrão consolidado:** O sistema de **handoff** está disparando em casos claros de venda. Não é só TPR — há uma segunda camada de decisão de handoff que ignora o `intent=purchase_intent` e manda para humano. Esse é o **bug #1** a corrigir.
- Bom: contexto entre turnos preservado quando há produto definido (C1 vs B1), e mudança de família funciona bem (C3).

---

## Onda D — (a executar)

