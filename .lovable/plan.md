

## Pensamento

**Sintoma alegado:** queda nas vendas + 3 erros do Pixel desde ontem.

**Dados reais (até as 16h BRT, mesma janela horária):**
- Hoje (sáb 19/abr): 188 PageView, 9 InitiateCheckout, **2 Purchase**
- Sábado anterior (12/abr): 239 PageView, 23 InitiateCheckout, **8 Purchase**
- Sexta (18/abr, dia do refator): 270 PageView, 34 InitiateCheckout, 4 Purchase (dia inteiro: 7 Purchase, top da semana)

**Conclusões objetivas:**
1. **18/abr (sexta) NÃO teve queda** — foi um dos melhores dias da semana em volume e Purchase. Tracking continua disparando normal (7 Purchase capturados).
2. **19/abr (hoje) tem queda real**: -22% PageView, -61% InitiateCheckout, -75% Purchase vs sábado anterior. Mas a queda começa **no topo do funil** (PageView), não entre carrinho e checkout. Isso afasta culpa do refator do checkout.
3. Os **3 erros do Pixel não são de ontem** — estão registrados no changelog desde 03/abr. São antigos, conhecidos, e não bloqueiam vendas (continuam chegando 188 PageView hoje).
4. **44 sessões de checkout dos últimos 4 dias estão com status `abandoned` ou `active` — 0 `completed`.** Isso é um bug estrutural no rastreamento de funil interno (não afeta Pixel/CAPI), mas distorce a métrica de carrinho×checkout.

**Mudanças de ontem (18/abr) auditadas:**
- Refator do `CheckoutStepWizard` em 7 arquivos, com lazy loading de Step3/Step4 → eventos `Lead`, `AddShippingInfo`, `AddPaymentInfo`, `Purchase` continuam disparando (confirmado nos logs)
- Skeleton no `index.html` + Worker v2.0.0 → não afeta tracking
- Prefetch do chunk de checkout no carrinho → reduz latência, não muda funil

**Nada no refator de ontem quebrou Pixel/CAPI ou tracking de vendas.** A queda de hoje tem outra explicação plausível:
- Sábado de Páscoa (19/abr/2026 = sábado de Aleluia) → tráfego naturalmente menor que sábado normal
- Possível impacto de campanhas pausadas ou orçamento Meta (a investigar com o usuário)

---

## O Plano

### Frente 1 — Provar que o refator não quebrou nada (validação técnica)
- Reproduzir compra real de ponta a ponta em loja teste: cart → step1 → step2 → step3 → step4 → pagamento aprovado
- Verificar nos logs se os 6 eventos disparam (PageView, ViewContent, AddToCart, InitiateCheckout, Lead, AddShippingInfo, AddPaymentInfo, Purchase)
- Confirmar deduplicação Pixel↔CAPI (mesmo `event_id`)

### Frente 2 — Corrigir o bug de "0 sessões completed" (que distorce a métrica)
- Auditar onde `completeCheckoutSession` é chamado após pagamento aprovado
- Garantir chamada na página de "Obrigado" (Thank You) e em todos os caminhos de aprovação (cartão, PIX, redirect MercadoPago)
- Esse é o motivo real da "queda de margem carrinho×checkout" reportada — não é menos venda, é métrica errada

### Frente 3 — Resolver definitivamente os 3 erros do Pixel (4ª tentativa)
Em vez de mais um ajuste cego, instalar diagnóstico real:
- Coletar amostra de 30 PageViews recentes
- Comparar `client_ip_from_browser` (que o navegador mandou) vs IP que o CAPI recebeu
- Identificar exatamente em quais cenários o IP diverge (proxy intermediário? cookie sem persistir?)
- Só depois propor a 4ª correção, com base em evidência, não em hipótese

### Frente 4 — Verificar campanhas/anúncios (causa da queda real de hoje)
- Confirmar com o usuário se houve mudança de orçamento, criativos pausados, ou problema na conta de anúncios da Meta
- Comparar tráfego pago vs orgânico hoje
- Se for sazonalidade de Páscoa, sem ação técnica necessária

---

## Resultado final
- Refator de ontem auditado e validado tecnicamente: **descartado como causa**
- Bug do "completeCheckoutSession" corrigido → métrica de carrinho×checkout volta a refletir realidade
- 3 erros do Pixel resolvidos com base em diagnóstico real (não tentativa #4 cega)
- Causa da queda de hoje identificada (provavelmente sazonalidade + Páscoa, a confirmar com usuário)

---

## Ordem de execução recomendada
1. Frente 2 (bug do completed) — **crítico, distorce todas as métricas de funil**
2. Frente 1 (validar refator) — rápido, dá tranquilidade
3. Frente 3 (Pixel) — requer coleta de amostra antes
4. Frente 4 (campanhas) — pergunta executiva ao usuário

---

**Estimativa:** 1-2 horas para Frentes 1+2. Frente 3 fica para um segundo loop depois da coleta de amostras (24h). Frente 4 é validação não técnica.

📌 STATUS: Plano consolidado — aguardando aprovação para sair do modo Plan e executar.

