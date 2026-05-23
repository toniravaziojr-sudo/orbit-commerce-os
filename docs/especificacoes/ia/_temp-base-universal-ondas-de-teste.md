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

---

## Onda 1 — Saudação e abertura

**Execução:** rodada via `ai-test-sandbox` em Agent Mode no tenant Respeite o Homem (sem configuração personalizada da IA).

### Onda 1 — Conversa 1 — "oi" (cliente novo)
- **Cliente:** "oi"
- **IA:** "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Certo:** Espelhou o período do dia (boa noite), reciprocou ("tudo bem?"), abriu discovery sem vazar produto/preço.
- **Errado:** Nada relevante.

### Onda 1 — Conversa 2 — "boa noite" (cliente novo)
- **Cliente:** "boa noite"
- **IA:** "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Certo:** Espelhou "boa noite", abriu discovery.
- **Errado:** Resposta literalmente idêntica à Conversa 1 — risco de soar robótico se o cliente trocar mensagem; aceitável neste cenário.

### Onda 1 — Conversa 3 — "olá tudo bem?"
- **Cliente:** "olá tudo bem?"
- **IA:** "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Certo:** Saudou e reciprocou o "tudo bem?".
- **Errado:** Nada relevante.

### Onda 1 — Conversa 4 — "e aí, blz?" (saudação informal)
- **Cliente:** "e aí, blz?"
- **IA:** "Me conta um pouco do que você precisa que eu já te indico."
- **Certo:** Não vazou preço/produto.
- **Errado / hipótese:** **Não cumprimentou de volta.** Pulou direto para discovery sem nenhum "oi/e aí/blz". O espelho de saudação só está reagindo a saudações canônicas ("oi", "olá", "bom dia/tarde/noite"); saudação informal ("e aí", "blz") está caindo fora do detector.

### Onda 1 — Conversa 5 — Saudação no meio de thread ("oi" → "oi de novo")
- **Cliente turno 1:** "oi" → **IA:** "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando." ✅
- **Cliente turno 2:** "oi de novo" → **IA:** retornou DUAS mensagens:
  1. "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando."
  2. "Me conta um pouco do que você precisa que eu já te indico."
- **Errado / hipótese 1 (grave):** **Saudação repetida dentro da mesma thread ativa.** A IA tratou "oi de novo" como abertura nova e refez a saudação completa, em vez de continuar o discovery que ela mesma tinha iniciado no turno anterior.
- **Errado / hipótese 2:** **Resposta dupla no mesmo turno** — a IA mandou greeting + discovery em mensagens separadas. Isso indica falha do gate anti-duplicação ou do orquestrador de turno (deveria ser uma única resposta ou nenhuma saudação).

### Onda 1 — Conversa 6 — "bom dia"
- **Cliente:** "bom dia"
- **IA:** "Olá, bom dia, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Certo:** Espelhou corretamente "bom dia" (sobrescreveu o período do servidor que era noite).
- **Errado:** Nada relevante.

---

### Resumo da Onda 1

**Funciona:**
- Saudações canônicas ("oi", "olá", "bom dia", "boa noite") são espelhadas e reciprocadas.
- Não há vazamento de preço/produto na abertura.
- Discovery aberto e neutro ("me conta o que você está procurando").

**Quebras observadas (hipóteses, sem corrigir ainda):**
- **Q1.1 — Saudação informal não detectada:** "e aí", "blz", "fala", "salve", "opa" provavelmente não estão no detector de saudação. A IA pula reciprocidade.
- **Q1.2 — Saudação repetida em thread ativa:** "oi de novo" reabriu a saudação completa em vez de continuar discovery. Suspeita: o gate de "thread já cumprimentada" não está olhando o histórico recente da própria conversa.
- **Q1.3 — Resposta dupla no mesmo turno:** No mesmo turno do "oi de novo" a IA disparou 2 mensagens (greeting + discovery). Suspeita: o orquestrador deixou passar uma mensagem do greeting-mirror e outra da pipeline principal.
- **Q1.4 — Resposta praticamente idêntica entre saudações diferentes:** "oi", "boa noite" e "olá tudo bem?" geraram texto literalmente igual. Funcional, mas pode ser melhorado para naturalidade (não bloqueia base 100%).

---

## Próximo passo

Aguardando "ok" para rodar **Onda 2 — Dor sem citar produto** (5 cenários).

Quando todas as ondas estiverem documentadas: **Fase 4 — análise consolidada** (agrupar por causa raiz, propor plano de ajuste único, incorporar ao changelog formal e descartar este documento).
