# [TEMP] Base Universal da IA de Atendimento — Ondas de Teste

**Status:** documento temporário de trabalho. Será descartado depois que o plano de ajuste consolidado for incorporado aos docs formais (changelog, motor-contexto-comercial, modo-vendas-whatsapp).

## Contexto da entrega (Fase 1 — implementação)

- 4 chaves universais agora são **padrão** da pipeline base (kill-switch via `false`):
  pain resolver, catalog probe, TPR, turn completeness.
- Listas hardcoded de cosmético foram removidas:
  - `FAMILY_TOKENS` (transitions.ts) → vazio; detecção de família depende 100% do vocabulário do tenant.
  - `PAIN_OR_OBJECTIVE_PATTERNS` → reduzido a padrões estruturais universais (sem cabelo/calvície/caspa/oleosidade/pós-banho).
  - `ANAPHORIC_REFERENCE_PATTERNS` → genérico (esse/essa + produto/item/kit/combo).
  - `FAMILY_NAME_PATTERNS` (catalog-probe.ts) → removido; classificação por classifier do tenant.
  - `getCatalogFamilyAliases` legado (loção↔balm) → removido.
- **Pendências conhecidas para Fase 1.5** (ainda têm vocabulário cosmético, vão ser tratadas como primeira rodada de ajuste após as ondas):
  - `consultative-turn.ts` (regex de calvície/queda/caspa/cabelo/couro/coroa/barba/pele/shampoo).
  - `turn-pre-router.ts` (`legacyPainHit` com coroa/calv/queda/caspa/seborr/oleos).
  - `turn-completeness.ts` (`STRONG_Q_PRODUCT_REF`, `Q_ABOUT_PRODUCT_FAMILY`, `LEGACY_PAIN_RE`).
  - `prompts/recommendation.ts` (exemplos cosméticos no prompt).

A decisão é: rodar as ondas com a base já universalizada (chaves ligadas + listas principais removidas) **mesmo com os resíduos acima**, para que a bateria revele o impacto real deles em conversa. Os resíduos NÃO bloqueiam o teste.

---

## Ondas planejadas

Cada onda roda separada (rate limit). Para cada conversa: cenário, mensagem do cliente, resposta da IA, o que estava certo, o que estava errado (hipótese de causa em linguagem clara), sinais cruzados (estado, intenção, família detectada, reflexo acionado).

### Onda 1 — Saudação e abertura
- [ ] Cliente novo: "oi"
- [ ] Cliente novo: "boa noite"
- [ ] Cliente recorrente: "oi"
- [ ] Saudação no meio de thread (<30min): "oi de novo"
- [ ] "olá tudo bem?"
- [ ] "e aí, blz?"

### Onda 2 — Dor sem citar produto
- [ ] "tô careca"
- [ ] "minha pele coça muito"
- [ ] "preciso de algo pra dormir melhor"
- [ ] "tô precisando de uma ajuda"
- [ ] "tem algo pra dor de cabeça?"

### Onda 3 — Pergunta direta de produto/família
- [ ] "vocês têm shampoo?"
- [ ] "tem balm?"
- [ ] "vende perfume?"
- [ ] "tem kit?"

### Onda 4 — Troca de família no meio
- [ ] Começa em shampoo → muda para loção pós-barba
- [ ] Começa em balm → muda para perfume

### Onda 5 — Preço, frete, CEP
- [ ] "quanto custa?"
- [ ] "qual o frete?"
- [ ] "01310-100"
- [ ] CEP + carrinho ativo

### Onda 6 — Pós-venda real
- [ ] "meu pedido não chegou"
- [ ] "quero rastrear"
- [ ] "produto veio com defeito"
- [ ] "quero reembolso"

### Onda 7 — Reclamação que NÃO é pós-venda
- [ ] "esse shampoo de vocês não funciona porra nenhuma" (sem mencionar pedido)
- [ ] Cliente irritado pedindo solução de produto

### Onda 8 — Turnos curtos e ambíguos
- [ ] "?"
- [ ] "e aí"
- [ ] "manda aí"
- [ ] "sim"

### Onda 9 — Multi-segmento (lojas fictícias internas)
- [ ] Pet: "meu cachorro não come"
- [ ] Moda: "tem tênis 42?"
- [ ] Suplemento: "preciso de algo pra ganhar massa"

### Onda 10 — Fechamento
- [ ] "quero comprar"
- [ ] "manda o link"
- [ ] "como pago?"
- [ ] "finaliza"

---

## Registro por onda

> **Modelo de seção** (replicar para cada conversa):
>
> ### Onda X — Conversa N — [título curto]
> - **Cliente:** "..."
> - **IA:** "..."
> - **Esperado:** ...
> - **Certo:** ...
> - **Errado / hipótese:** ...
> - **Sinais:** estado=`...`, intent=`...`, família detectada=`...`, reflexo=`...`, traço=`...`

(seções a serem preenchidas conforme cada onda for executada)

---

## Próximo passo

Quando todas as ondas estiverem documentadas: **Fase 4 — análise consolidada** (agrupar por causa raiz, propor plano de ajuste único, incorporar ao changelog formal e descartar este documento).
