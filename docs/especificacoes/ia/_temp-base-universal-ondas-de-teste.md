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

> **Histórico de rodadas:** mantemos todas as execuções aqui para comparar antes/depois de cada bloco de ajuste. Cada rodada documenta a build da pipeline em que foi executada.

### Rodada 1 — Baseline (antes das Frentes 1–4)

**Build:** Fase 1 da base universal aplicada (chaves universais ligadas, listas hardcoded principais removidas). Frentes 1–4 (limpeza cosmética, scope-router, bucket-state-router, continuity-gate) ainda **não** aplicadas.
**Execução:** via `ai-test-sandbox` em Agent Mode no tenant Respeite o Homem (sem configuração personalizada da IA).

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

### Rodada 2 — Pós-Frentes 1–4 (2026-05-23)

**Build:** Fase 1 + Frente 1 (limpeza cosmética dos resíduos: `consultative-turn`, `turn-pre-router`, `turn-completeness`, `prompts/recommendation`) + Frente 2 (scope-router com 11 buckets de intenção) + Frente 3 (bucket-state-router para institucional/pós-venda/objeção/hesitação/handoff/fora-de-escopo) + Frente 4 (continuity-gate anti-loop de discovery + anti-repetição reforçada).
**Execução:** via `ai-test-sandbox` em Agent Mode no tenant Respeite o Homem, conversas isoladas (cada uma cria conversa nova e é apagada ao final). Horário do servidor no momento do teste: tarde (BRT).
**Modelo IA usado:** `gpt-5` (provider openai), `sales_mode=true`.

#### R2 — Conversa 1 — "oi" (cliente novo)
- **Cliente:** "oi"
- **IA:** "Olá, boa tarde, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Sinais:** intent=`greeting`, topics=`[saudacao]`, sentiment=neutro, latência=10,9s.
- **Certo:** Espelhou período (boa tarde), reciprocou tudo bem, abriu discovery, sem vazar preço/produto. ✅
- **Errado:** Nada.

#### R2 — Conversa 2 — "boa noite" (cliente novo)
- **Cliente:** "boa noite"
- **IA:** "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Sinais:** intent=`greeting`, latência=8,7s.
- **Certo:** Cliente disse "boa noite", IA espelhou "boa noite" mesmo com servidor em tarde — sobrescrita correta pela mensagem do cliente. ✅
- **Errado:** Nada.

#### R2 — Conversa 3 — "olá tudo bem?"
- **Cliente:** "olá tudo bem?"
- **IA:** "Olá, boa tarde, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Sinais:** intent=`greeting`, latência=9,4s.
- **Certo:** Saudou e reciprocou o "tudo bem?". ✅
- **Errado:** Nada.

#### R2 — Conversa 4 — "e aí, blz?" (saudação informal)
- **Cliente:** "e aí, blz?"
- **IA:** "Me conta um pouco do que você precisa que eu já te indico."
- **Sinais:** intent=`greeting`, topics=`[]`, latência=11,4s.
- **Certo:** Não vazou preço/produto.
- **Errado / hipótese:** **Q1.1 PERSISTE.** Saudação informal ("e aí", "blz") continua não sendo reconhecida pelo espelhador de saudação. A IA classificou intent=`greeting` mas pulou direto pra discovery sem reciprocar. As Frentes 1–4 não tocaram no detector lexical de saudação informal — esperado que persista.

#### R2 — Conversa 5 — Saudação no meio de thread ("oi" → "oi de novo")
- **Turno 1 — Cliente:** "oi"
  **IA:** "Olá, boa tarde, tudo bem? Como posso ajudar? Me conta o que você está procurando." ✅
- **Turno 2 — Cliente:** "oi de novo"
  **IA:** "Me conta um pouco do que você precisa que eu já te indico." ✅
- **Certo:** **Q1.2 e Q1.3 RESOLVIDAS.** A IA não refez a saudação completa e mandou **uma única mensagem** de discovery — comportamento exatamente esperado de continuidade. A Frente 4 (continuity-gate anti-loop de discovery + bloqueio de "muleta") atuou corretamente, e o orquestrador não deixou passar duas mensagens.
- **Errado:** Nada.

#### R2 — Conversa 6 — "bom dia"
- **Cliente:** "bom dia"
- **IA:** "Olá, bom dia, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Certo:** Espelhou "bom dia" (sobrescreveu período do servidor que era tarde). ✅
- **Errado:** Nada.

---

#### Resumo Rodada 2 — Onda 1

**Comparativo direto com Rodada 1:**

| Quebra | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q1.1 — Saudação informal não reciprocada ("e aí, blz") | ❌ | ❌ | **Persiste** |
| Q1.2 — Saudação completa repetida em thread ativa ("oi de novo") | ❌ | ✅ | **Resolvida** |
| Q1.3 — Resposta dupla no mesmo turno (greeting + discovery) | ❌ | ✅ | **Resolvida** |
| Q1.4 — Texto idêntico entre saudações diferentes | ⚠️ cosmético | ⚠️ cosmético | Inalterado (não bloqueante) |

**Funciona (mantido):**
- Espelho de período do dia (oi/boa noite/bom dia/olá) — mensagem do cliente sobrescreve hora do servidor.
- Reciprocidade do "tudo bem?".
- Discovery aberto e neutro, sem vazar preço/produto.

**Quebras pendentes para próxima rodada de ajuste:**
- **Q1.1** — Detector lexical de saudação informal não cobre "e aí", "blz", "fala", "salve", "opa". Próximo ajuste deve estender o detector (sem hardcode segmentado, é vocabulário universal de saudação informal em PT-BR).
- **Q1.4** — Variação de naturalidade entre saudações canônicas (não bloqueia "100%" da base, mas entra na lista de melhorias de UX).

**Ganhos da Rodada 2 atribuíveis às Frentes 1–4:**
- Continuity-gate (Frente 4) eliminou Q1.2 (saudação repetida em thread) e indiretamente Q1.3 (resposta dupla).
- Scope-router e bucket-state-router (Frentes 2–3) não foram exercitados nesta onda (saudações puras caem em `social`/`open_discovery`), mas registraram intent=`greeting` corretamente nos logs.

---

## Onda 2 — Dor sem citar produto

**Execução:** rodada via `ai-test-sandbox` Agent Mode, conversas isoladas (sem histórico cruzado).

### Onda 2 — Conversa 1 — "tô careca"
- **Cliente:** "tô careca"
- **IA:** "Me conta um pouco do que você precisa que eu já te indico."
- **Esperado:** Reconhecer a dor (calvície/queda) e fazer 1 pergunta direcionada (ex.: "é queda recente ou já consolidada? quer tratar ou disfarçar?").
- **Errado / hipótese:** **Q2.1 — Dor explícita ignorada.** IA caiu no fallback genérico de discovery em vez de engajar com a pista clara. Suspeita: classificador rotulou intent=`general` e topic=`appearance` sem mapear "careca" para família/dor de queda capilar; pipeline não tem reflexo de "dor → pergunta de qualificação".

### Onda 2 — Conversa 2 — "minha pele coça muito"
- **Cliente:** "minha pele coça muito"
- **IA:** "Entendi. Essa coceira é no couro cabeludo ou no corpo?"
- **Certo:** Reconheceu a dor, validou ("entendi"), fez pergunta de qualificação útil para afunilar família (couro cabeludo → shampoo/loção; corpo → sabonete/hidratante). Comportamento correto da base universal.

### Onda 2 — Conversa 3 — "preciso de algo pra dormir melhor"
- **Cliente:** "preciso de algo pra dormir melhor"
- **IA:** "Me conta um pouco do que você precisa que eu já te indico."
- **Esperado:** Já que a loja é de cosméticos masculinos, a base universal deveria reconhecer "fora do escopo" e responder com clareza honesta (ex.: "não trabalhamos com produtos pra sono; posso te ajudar com cuidados pra cabelo, barba, pele ou perfumaria") em vez de pedir que repita.
- **Errado / hipótese:** **Q2.2 — Fora-de-escopo não reconhecido.** Pipeline não checa se o tema bate com o catálogo do tenant antes de responder; cai em fallback genérico que confunde o cliente. Classificador inclusive marcou `purchase_intent` para um produto que a loja não vende.

### Onda 2 — Conversa 4 — "tô precisando de uma ajuda"
- **Cliente:** "tô precisando de uma ajuda"
- **IA:** "Oi! Claro. Me conta rapidinho: seu foco é tratar queda/calvície agora ou quer algo pra prevenção?"
- **Esperado:** Pergunta aberta e neutra ("o que você procura? cabelo, barba, pele, perfume?") — sem assumir nicho.
- **Errado / hipótese:** **Q2.3 — Viés de nicho.** Frente a pedido vago, IA assumiu queda/calvície sem o cliente ter mencionado cabelo. Suspeita: o tenant tem forte concentração de produtos de cabelo no catálogo e isso vazou como prior do modelo. Em base universal, pedido vago deve abrir leque das famílias, não escolher uma.

### Onda 2 — Conversa 5 — "tem algo pra dor de cabeça?"
- **Cliente:** "tem algo pra dor de cabeça?"
- **IA:** "Deixa eu confirmar isso direito pra te responder com certeza. Pode me dizer de novo o nome ou a categoria do produto que você procura?"
- **Esperado:** Mesma lógica do C3 — declarar fora-de-escopo de forma honesta.
- **Errado / hipótese:** Mesma raiz de **Q2.2**. IA tentou "confirmar nome do produto" em vez de reconhecer que a loja não vende remédio. Pelo menos não inventou produto, mas a UX é ruim.

---

### Resumo da Onda 2

**Funciona:**
- Dor com pista de família clara (coceira na pele) → IA engaja, valida e qualifica corretamente (C2).

**Quebras observadas:**
- **Q2.1 — Dor explícita virou fallback genérico:** "tô careca" deveria disparar pergunta de qualificação de queda/calvície; caiu em "me conta o que precisa".
- **Q2.2 — Fora-de-escopo não reconhecido:** "dormir melhor" e "dor de cabeça" não são tratados como fora do catálogo. IA não declara honestamente "não trabalhamos com isso" e oferece o que vende.
- **Q2.3 — Viés de nicho em pedido vago:** "tô precisando de ajuda" abriu direto em queda/calvície. Em base universal, deveria perguntar família (cabelo/barba/pele/perfume) sem chutar.

---

### Onda 2 — Rodada 2 — Pós-Frentes 1–4 (2026-05-23)

**Build:** mesma da Rodada 2 da Onda 1 (Frentes 1–4 ativas).
**Execução:** via `ai-test-sandbox` Agent Mode no tenant Respeite o Homem, conversas isoladas (cada uma com `conversation_id` própria, apagada ao final). Modelo `gpt-5`, `sales_mode=true`.

#### R2 — C1 — "tô careca"
- **IA:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ **Q2.1 PERSISTE.** Dor explícita de calvície continua caindo no fallback genérico de discovery. As Frentes 1–4 não tocaram no detector de "dor → pergunta de qualificação", apenas removeram o vocabulário hardcoded. Agora a IA não tem nem o atalho antigo nem o motor universal.

#### R2 — C2 — "minha pele coça muito"
- **IA:** "Me conta um pouco mais do que você quer resolver, que eu já te indico o certo."
- **Avaliação:** ❌ **REGRESSÃO.** Na Rodada 1 esta era a única conversa que funcionava — IA perguntava "couro cabeludo ou corpo?". Agora caiu no mesmo fallback genérico das outras. Causa provável: a Frente 1 removeu o regex de `pele/couro/cabelo` em `consultative-turn.ts` que sustentava a pergunta de qualificação, e nada universal foi colocado no lugar ainda.

#### R2 — C3 — "preciso de algo pra dormir melhor"
- **IA:** "Deixa eu confirmar isso direito pra te responder com certeza. Pode me dizer de novo o nome ou a categoria do produto que você procura?"
- **Avaliação:** ❌ **Q2.2 PERSISTE + piorou cosmeticamente.** Continua sem reconhecer fora-de-escopo. Na Rodada 1 caía em "Me conta..."; agora caiu na muleta "Deixa eu confirmar...". Mesma raiz da Q3.D — falta detector "pertence ao catálogo? sim/não".

#### R2 — C4 — "tô precisando de uma ajuda"
- **IA:** "Claro! Me conta rapidinho: é pra tratar queda/calvície, acelerar o crescimento, caspa/oleosidade ou cuidados com a barba? Se já tiver um produto em mente, me diz qual que eu te indico certinho."
- **Avaliação:** ⚠️ **Q2.3 atenuada parcialmente.** Continua o viés de nicho (cabelo/barba), mas agora abre 4 opções em vez de assumir uma só. Ainda falta incluir as outras famílias do tenant (pele/perfumaria) ou perguntar de forma neutra.

#### R2 — C5 — "tem algo pra dor de cabeça?"
- **IA:** "Deixa eu confirmar isso direito pra te responder com certeza. Pode me dizer de novo o nome ou a categoria do produto que você procura?"
- **Avaliação:** ❌ **Q2.2 PERSISTE.** Mesma falha da C3.

---

#### Resumo Rodada 2 — Onda 2

**Comparativo direto com Rodada 1:**

| Quebra | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q2.1 — Dor explícita virou fallback genérico ("tô careca") | ❌ | ❌ | **Persiste** |
| Q2.2 — Fora-de-escopo não reconhecido ("dormir", "dor de cabeça") | ❌ | ❌ | **Persiste** (e agora cai na muleta "Deixa eu confirmar") |
| Q2.3 — Viés de nicho em pedido vago | ❌ assumiu queda direto | ⚠️ abre 4 opções (ainda enviesado) | **Atenuada parcialmente** |
| C2 — "pele coça" qualificava corretamente | ✅ | ❌ | **REGRESSÃO** (perdeu o atalho cosmético sem ganhar motor universal) |

**Leitura:**
- A Frente 1 removeu vocabulário hardcoded mas o motor universal de "dor → família" e o detector de "fora-de-escopo" ainda não existem. O resultado é que a IA perdeu até os atalhos antigos sem ganhar substituto.
- A muleta "Deixa eu confirmar isso direito" (Q3.D) virou o fallback dominante quando a IA não sabe o que fazer — Frente 4 (anti-repetição) ainda não cobre essa frase específica.
- Bucket-state-router (Frente 3) não tem rota para "dor sem produto" nem para "fora-de-escopo"; cai no bucket genérico de discovery.

**Próximas rodadas de ajuste sugeridas (Fase 2):**
1. **Catálogo-pertence-gate:** antes de qualquer fallback, checar se o tema do turno bate com famílias/categorias do tenant. Se não bate → resposta honesta "não trabalhamos com X, posso te ajudar com Y/Z".
2. **Motor universal "dor → qualificação":** quando TPR detecta dor (sintoma/objetivo) sem produto, pipeline deve emitir 1 pergunta de afunilamento baseada nas famílias do catálogo do tenant (sem regex hardcoded).
3. **Estender anti-muleta da Frente 4:** incluir "Deixa eu confirmar isso direito" como frase proibida em segundo turno consecutivo de discovery.
4. **Discovery aberto sem viés:** quando pedido é vago ("preciso de ajuda"), apresentar todas as famílias do tenant na mesma ordem do catálogo, não a família dominante.

---

## Onda 3 — Pergunta direta por categoria

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas (cada cenário sem histórico).

### Q3.1 — "tem shampoo?"
**Resposta:** "Temos sim. Shampoo Preventive Power — uso diário pra prevenção e controle de oleosidade. Shampoo Calvície Zero — focado em queda/calvície, estimula o couro cabeludo e fortalece a raiz. Qual faz mais sentido pra você ou quer detalhe de algum?"
**Avaliação:** ✅ Excelente. Confirma disponibilidade, lista as 2 opções com diferenciação clara, devolve a bola.

### Q3.2 — "vocês vendem perfume?"
**Resposta:** "Deixa eu confirmar isso direito pra te responder com certeza. Pode me dizer de novo o nome ou a categoria do produto que você procura?"
**Avaliação:** ❌ Falha grave. Perfume é fora do catálogo — deveria responder honestamente "não trabalhamos com perfume" e ofertar o que vende. Em vez disso, cai em fallback genérico. Pior: numa execução anterior o mesmo prompt foi tratado corretamente ("No momento não. A gente não trabalha com perfume...") — comportamento inconsistente.

### Q3.3 — "tem produto pra barba?"
**Resposta:** "Posso te dar mais detalhes desse produto se você me confirmar o nome exato ou a categoria? Nossa linha é focada em calvície e crescimento do cabelo. Se te ajudar, posso te mostrar as opções pra prevenção e queda no couro cabeludo. Quer dar uma olhada?"
**Avaliação:** ❌ Falha. "Barba" está no `FAMILY_TOKENS` mas a IA não reconhece como categoria do catálogo. Trata como "produto desconhecido" e empurra cabelo/calvície. Catálogo do tenant tem produtos de barba — IA deixa de vender por viés de família dominante.

### Q3.4 — "tem hidratante?"
**Resposta:** "Temos sim. Nossa loção pra hidratar é a Loção pós-banho Calvície Zero (Noite) — leve, absorção rápida, hidrata o couro cabeludo enquanto ajuda no controle da queda. Quer que eu te mande os detalhes dela (modo de uso e composição)?"
**Avaliação:** ⚠️ Parcial. Numa execução anterior perguntou primeiro "pele/rosto ou couro cabeludo?" (correto, hidratante é ambíguo). Nesta, assumiu couro cabeludo direto. Inconsistente.

### Q3.5 — "vocês têm desodorante?"
**Resposta:** "Deixa eu confirmar isso direito pra te responder com certeza. Pode me dizer de novo o nome ou a categoria do produto que você procura?"
**Avaliação:** ❌ Falha grave. Mesmo padrão do perfume: fora-de-escopo cai em fallback genérico em vez de declarar "não trabalhamos com desodorante" e oferecer o que vende.

### Resumo da Onda 3

**Funciona bem:**
- Categoria forte e presente no catálogo (shampoo) → resposta ideal: confirma, diferencia opções, devolve a bola.

**Quebras observadas:**
- **Q3.A — Fora-de-escopo cai em fallback genérico (perfume, desodorante):** A IA não reconhece que a categoria não existe no catálogo. Em vez de responder honestamente, pede o cliente repetir. É a mesma falha da Onda 2 (dor fora-de-escopo) — base universal precisa de detector "pertence ao catálogo? sim/não" antes do pipeline de venda.
- **Q3.B — Categoria existente tratada como desconhecida (barba):** Com produtos de barba no catálogo, IA empurra calvície. Indica viés de família dominante no `catalog-probe` ou no ranking, desconsiderando famílias secundárias do mesmo tenant.
- **Q3.C — Inconsistência entre execuções idênticas (perfume, hidratante):** Mesmo prompt em conversa isolada produz respostas qualitativamente diferentes. Sugere estado vazando entre conversas (working memory / family_focus) ou variação alta demais do modelo para decisões críticas de catálogo.
- **Q3.D — "Deixa eu confirmar isso direito" virou muleta:** É o fallback padrão quando a IA não decide família/produto. Aparece em Q3.2, Q3.3, Q3.5 e na Onda 2. Em base universal precisa ser substituído por resposta honesta de catálogo ("não tenho isso, mas tenho X, Y, Z; o que te interessa?").

---

### Onda 3 — Rodada 2 (re-execução pós-Frentes 1–4, prompts oficiais do plano)

Re-executada via `ai-test-sandbox` Agent Mode, conversas isoladas, com os 4 prompts oficiais (linhas 44–48). Cada conversa criada e descartada após coleta.

#### Q3.1 — "vocês têm shampoo?"
**Resposta:** "Temos sim. — Shampoo Preventive Power: pra prevenção no dia a dia, ajuda a controlar oleosidade e queda inicial. — Shampoo Calvície Zero: mais intenso pra queda e afinamento, estimula crescimento e fortalece a raiz. Qual faz mais sentido pro seu caso ou quer detalhes de algum deles?"
**Avaliação:** ✅ Excelente. Confirma, lista as 2 opções com diferenciação clara, devolve a bola. Latência: 55s.

#### Q3.2 — "tem balm?"
**Resposta:** "Temos sim: o Balm Pós-Banho Calvície Zero (Dia). É pra usar depois do banho, de dia, direto no couro cabeludo — prático pra rotina de prevenção da queda e estímulo de crescimento. Quer que eu te mande os detalhes de uso e o que ele entrega?"
**Avaliação:** ✅ Excelente. Reconhece a família balm, apresenta o item, contextualiza o uso, devolve a bola. Latência: 63s.

#### Q3.3 — "vende perfume?"
**Resposta:** "No momento não vendemos perfume. Somos focados em cuidados capilares masculinos, principalmente queda e calvície. Se quiser, te indico algo pra prevenção, crescimento, oleosidade ou caspa. Qual desses faz mais sentido pra você?"
**Avaliação:** ✅ Resolvida. Categoria fora-de-escopo agora é tratada com honestidade ("não vendemos") e a IA reconduz pra dentro do catálogo. Antes caía em fallback genérico "deixa eu confirmar isso direito". Latência: 16s.

#### Q3.4 — "tem kit?"
**Resposta:** "Tem sim. Trabalhamos com estes kits da linha Calvície Zero (noite): — Kit Banho Calvície Zero (FLEX) Noite — Kit Banho Calvície Zero (2x) Noite — Kit Banho Calvície Zero (3x) Noite. Qual deles te ajuda mais agora ou quer detalhe de algum?"
**Avaliação:** ⚠️ Parcial. Confirma e lista kits, mas só os de **noite** — o catálogo tem também os de **dia**. Provável efeito do Onda 18 Fase A (Catalog Base Forced) priorizando contexto, mas em pergunta genérica "tem kit?" deveria mostrar os dois turnos (dia e noite) ou pedir contexto antes. Latência: 108s.

#### Comparativo Rodada 1 → Rodada 2
| Quebra | Status |
|---|---|
| Q3.A — fora-de-escopo cai em fallback (perfume) | ✅ Resolvida |
| Q3.B — categoria existente tratada como desconhecida (barba) | ⏭️ Não coberto pelos 4 prompts oficiais |
| Q3.C — inconsistência entre execuções idênticas | ➖ Sem evidência nesta rodada |
| Q3.D — muleta "deixa eu confirmar isso direito" | ✅ Não apareceu |
| **Q3.E (NOVA)** — viés de turno em pergunta genérica de kit | ⚠️ A investigar |

**Conclusão:** Onda 3 melhorou substancialmente. Persiste apenas a Q3.E (viés de turno noite vs dia) e atenção à latência alta em Q3.4 (108s).

---

## Onda 4 — Pergunta de preço sem produto definido

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas.

### Q4.1 — "quanto custa?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ⚠️ Aceitável mas pobre. Pergunta sem produto não tem como responder com preço, então pedir contexto é correto. Mas a resposta é genérica demais — não orienta o cliente sobre o que ele pode pedir (categorias do catálogo, faixa de preço, "quer ver os mais vendidos?").

### Q4.2 — "qual o preço?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ⚠️ Idêntico ao Q4.1. Resposta padronizada (boa consistência) mas igualmente genérica.

### Q4.3 — "tem desconto?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. "Tem desconto?" é pergunta sobre política comercial, não sobre produto específico. A resposta deveria ser sobre cupons ativos, frete grátis, kits com economia, ou "sim, temos kits com até X% de desconto vs avulsos". Em vez disso, trata como se fosse pergunta de produto e devolve a mesma muleta.

### Q4.4 — "qual o mais barato?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. "Qual o mais barato" é pergunta de catálogo plenamente respondível: a IA tem acesso ao catálogo e pode listar o produto de menor preço. Em vez disso, devolve a muleta. Vendedor humano nunca responderia assim.

### Q4.5 — "qual o kit mais completo?"
**Resposta:** "O mais completo é o Kit Banho Calvície Zero (3x); se preferir rotina noturna, o mais completo da noite é o Kit Banho Calvície Zero (3x) Noite. Pra te situar rapidinho: [explica os 3 kits]. Quer ver os detalhes (com valores) de qual deles? Ou prefere que eu te ajude a escolher entre dia ou noite?"
**Avaliação:** ✅ Excelente. Aqui a IA **vendeu**. Identificou os kits, ranqueou por completude, explicou as diferenças com 1 linha cada e devolveu a bola com 2 caminhos (escolher kit ou ajudar a decidir). É exatamente o comportamento esperado de um vendedor.

### Resumo da Onda 4

**Funciona bem:**
- Pergunta de superlativo com qualificador semântico ("mais completo") → IA consulta catálogo, ranqueia, explica e oferece próximo passo (Q4.5).

**Quebras observadas:**
- **Q4.A — Pergunta de preço sem contexto vira muleta única:** "Quanto custa", "qual o preço", "qual o mais barato" — todas caem na mesma frase enlatada "me conta um pouco do que você precisa". Falta um detector que distinga: (i) pergunta vaga onde pedir contexto faz sentido, (ii) pergunta de superlativo (mais barato/caro/completo) que é respondível direto pelo catálogo, (iii) pergunta sobre política comercial (desconto/frete/promoção) que merece resposta própria.
- **Q4.B — "Tem desconto?" não tem resposta comercial:** Mesmo a base universal precisa saber dizer se o tenant tem cupons ativos, kits com economia ou frete grátis. Hoje devolve a muleta.
- **Q4.C — Resposta genérica pobre em orientação:** Mesmo quando pedir contexto for legítimo (Q4.1/Q4.2), a frase atual ("me conta um pouco do que você precisa") não dá pista nenhuma do que o cliente pode pedir. Vendedor bom direciona: "Você procura algo pra cabelo, barba ou pele? Ou prefere ver os mais vendidos?"
- **Q4.D — Inconsistência de "completude" cognitiva:** A IA sabe ranquear "mais completo" (Q4.5) mas não sabe ranquear "mais barato" (Q4.4). O motor de catálogo entende um superlativo qualitativo mas não o de preço. Mesmo eixo cognitivo, comportamentos diferentes.

---

### Onda 4 — Rodada 2 (re-execução pós-Frentes 1–4, prompts oficiais do plano)

Re-executada via `ai-test-sandbox` Agent Mode (canal `whatsapp`), conversas isoladas, 5 prompts. Modelo: `gpt-5` em todas, ~600 tokens output, ~4k tokens input.

#### Q4.1 — "quanto custa?"
- **conversation_id:** `c70e460e-de17-4025-85ab-575603c1fb70` · latência: 21s
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ⚠️ Igual à Rodada 1. Resposta enlatada. Intent classificado como `purchase_intent` mas pipeline não distingue pergunta vaga de pergunta respondível.

#### Q4.2 — "qual o preço?"
- **conversation_id:** `fa2416d5-816b-4f53-9127-d3e78df3f35c` · latência: 22s
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ⚠️ Idêntica à Q4.1. Consistente, mas igualmente pobre.

#### Q4.3 — "tem desconto?"
- **conversation_id:** `6e282060-fce4-4875-be0b-1ea83039706b` · latência: 26s
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ Persiste Q4.B. Pergunta sobre política comercial (cupom/desconto) tratada como pergunta de produto. Sem rota para política comercial na base universal.

#### Q4.4 — "qual o mais barato?"
- **conversation_id:** `0c96a9ab-3629-4770-9278-79e115d512fb` · latência: 19s
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ Persiste Q4.A. Superlativo de preço é respondível direto pelo catálogo; IA não faz.

#### Q4.5 — "qual o kit mais completo?"
- **conversation_id:** `20e8c70e-b1a2-4292-83c6-c9a1fbb3ed35` · latência: 21s
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ **REGRESSÃO GRAVE.** Na Rodada 1 era a única conversa excelente da onda — IA listava os 3 kits com diferenciação e devolvia a bola. Agora caiu na mesma muleta de Q4.1–Q4.4. Provável causa: as Frentes 1–4 removeram o caminho que ativava `catalog-probe` para superlativo qualitativo, ou o roteador de turno hoje classifica todo turno curto sem família detectada como "vago → pedir contexto", sem antes consultar o catálogo.

#### Comparativo Rodada 1 → Rodada 2

| Quebra | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q4.A — preço sem contexto vira muleta única | ❌ | ❌ | **Persiste** |
| Q4.B — "tem desconto?" sem rota comercial | ❌ | ❌ | **Persiste** |
| Q4.C — resposta genérica pobre em orientação | ❌ | ❌ | **Persiste** |
| Q4.D — inconsistência "mais completo" vs "mais barato" | ❌ parcial (completo ✅, barato ❌) | ❌ (ambos ❌) | **Piorou** |
| **Q4.E (NOVA)** — superlativo qualitativo deixou de funcionar | — | ❌ | **Nova regressão** |

**Leitura:**
- A muleta "Me conta um pouco do que você precisa que eu já te indico" é hoje o fallback dominante de toda pergunta curta sem família detectada. Aparece em 5/5 cenários de Onda 4.
- A Frente 4 (anti-repetição) precisa incluir essa frase exata como proibida — caiu nos 5 prompts da onda.
- O motor de catálogo perdeu a capacidade de responder superlativo (mais completo/mais barato/mais caro) sem contexto prévio — ranqueamento por catálogo deveria ser independente de família detectada.
- Política comercial (cupom/desconto/frete grátis/promoção) continua sem rota dedicada na base universal.

**Latência média:** ~22s.

---

## Onda 5 — Pedido por nome de produto

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas.

### Q5.1 — "quero o Shampoo Preventive Power" (nome exato)
**Resposta:** "Prontinho, adicionei 1x do Shampoo Preventive Power no seu carrinho. Sai por R$ 75,91. Quer adicionar mais alguma coisa ou já te mando o link de pagamento?"
**Avaliação:** ✅ Excelente. Identificou o produto, adicionou ao carrinho, deu o preço, fechou com cross-sell + checkout.

### Q5.2 — "me manda o calvicie zero" (nome aproximado/coloquial)
**Resposta:** "Tem sim. Você quer o Shampoo Calvície Zero, que age direto na raiz no banho pra controlar a queda? Quer que eu te mande os detalhes dele pra gente seguir?"
**Avaliação:** ✅ Bom. Reconheceu "calvicie zero" como família "Calvície Zero", confirmou o produto-base (shampoo) com mini-pitch e pediu confirmação. Deveria ter mencionado que existem variantes (loção noite, kits) — mas como caminho de venda está ok.

### Q5.3 — "tem o shampu preventiv?" (erro de digitação)
**Resposta:** "Tem sim. Você quer a unidade do Shampoo Preventive Power ou prefere um pack (2x, 3x, 6x ou 12x)?"
**Avaliação:** ✅ Excelente. Tolerância a erro de digitação funcionou, reconheceu o produto e ofereceu upsell de pack imediatamente. Comportamento de vendedor experiente.

### Q5.4 — "vocês têm minoxidil?" (marca/composto concorrente)
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha grave. Minoxidil é o ativo concorrente direto pra calvície — a IA deveria ter dito "Não trabalhamos com minoxidil, mas temos a linha Calvície Zero (shampoo + loção noite) que age na queda. Quer ver?". Em vez disso, devolveu a muleta da Onda 4. Perdeu a chance de venda óbvia.

### Q5.5 — "quero o shampoo de cavalo" (produto popular fora do catálogo)
**Resposta:** "Você quer o Shampoo Calvície Zero ou o Shampoo Preventive Power?"
**Avaliação:** ⚠️ Parcial. Lidou com o "produto que não temos" sem dizer "não temos" — pulou direto para os shampoos do catálogo. Funciona como redirecionamento, mas faltou honestidade ("Shampoo de cavalo a gente não trabalha, mas tenho dois shampoos focados em queda/calvície..."). E não explicou a diferença entre os dois — exigiu que o cliente já saiba escolher.

### Resumo da Onda 5

**Funciona bem:**
- Nome exato → adiciona ao carrinho e fecha venda (Q5.1).
- Nome aproximado/coloquial → reconhece a família e confirma (Q5.2).
- Erro de digitação → tolera e ainda faz upsell de pack (Q5.3).

**Quebras observadas:**
- **Q5.A — Marca/ativo concorrente cai na muleta:** "Minoxidil" é exatamente o tipo de busca onde a IA precisa traduzir "o cliente quer tratar calvície" e oferecer a alternativa do catálogo. Hoje devolve "me conta o que você precisa". É o mesmo padrão das Ondas 2/3/4: fora-de-escopo vira muleta em vez de redirecionamento honesto.
- **Q5.B — Produto popular fora do catálogo sem honestidade:** Q5.5 redirecionou para os shampoos certos, mas pulou a etapa "isso a gente não tem". Em base universal, o vendedor deveria assumir a ausência e propor a alternativa, não fingir que entendeu.
- **Q5.C — Inconsistência entre Q5.4 e Q5.5:** Os dois cenários são tecnicamente equivalentes (produto fora do catálogo com pista de família). Q5.5 redireciona, Q5.4 cai na muleta. Sinal de que o detector de "fora-de-escopo + alternativa" não é determinístico — depende de quanto a frase do cliente "soa" como um produto interno.
- **Q5.D — Q5.2 não menciona variantes:** "Calvície Zero" tem shampoo, loção noite e kits. A IA confirmou só o shampoo. Numa base universal vendedora, o ideal seria "temos a linha Calvície Zero — shampoo, loção noite e kits. Qual você quer?". Hoje ela já decide pelo cliente.

### Onda 5 — Rodada 2 (re-execução pós-Frentes 1–4, prompts oficiais do plano)

Executada via `ai-test-sandbox` Agent Mode, 5 conversas isoladas, modelo `gpt-5`, modo vendas ativo.

#### Q5.1 — "quero o Shampoo Preventive Power" (nome exato)
- **Conversa:** `a5884dff-d96a-42ff-9f5b-b44e193c267f` — latência 105.8s.
- **Resposta:** "Shampoo Preventive Power adicionado ao carrinho. Quer mais alguma coisa ou já te mando o link de pagamento?"
- **Avaliação:** ⚠️ Parcial. Adicionou ao carrinho e ofereceu fechar — bom. Mas **sumiu o preço** que aparecia na Rodada 1 ("Sai por R$ 75,91"). Provável efeito do Price Scrubber (Reg #2.8) suprimindo valor mesmo quando o cliente já demonstra intenção de compra (deveria liberar `R$` neste estado).

#### Q5.2 — "me manda o calvicie zero" (nome aproximado/coloquial)
- **Conversa:** `ffb5af8e-77d2-437a-9db8-564b840d85cc` — latência 25.5s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ **REGRESSÃO grave.** Na Rodada 1 reconhecia "calvicie zero" → família Calvície Zero e confirmava o shampoo. Agora caiu na muleta universal. Tolerância a coloquialismo de família foi perdida.

#### Q5.3 — "tem o shampu preventiv?" (erro de digitação)
- **Conversa:** `6da20c85-fab6-4f89-b32b-183b4b87db04` — latência 50.6s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ **REGRESSÃO grave.** Na Rodada 1 reconhecia "shampu preventiv" → Shampoo Preventive Power e ainda fazia upsell de pack. Agora caiu na muleta. Fuzzy-match sobre nome de produto também foi perdido.

#### Q5.4 — "vocês têm minoxidil?" (ativo concorrente)
- **Conversa:** `679d7b35-2d90-4159-9bbd-b482018258bd` — latência 58.0s.
- **Resposta:** "Hoje não trabalhamos com minoxidil. Pra queda e prevenção, temos opções sem minoxidil que entram fácil na rotina de banho: Shampoo Preventive Power… Shampoo Calvície Zero… Qual faz mais sentido pro seu caso?"
- **Avaliação:** ✅ **GANHO grande.** Na Rodada 1 era falha grave (caía na muleta). Agora assume a ausência ("não trabalhamos com minoxidil"), traduz a intenção (queda/prevenção) e oferece duas alternativas com mini-pitch + pergunta de qualificação. Comportamento de vendedor honesto.

#### Q5.5 — "quero o shampoo de cavalo" (produto popular fora do catálogo)
- **Conversa:** `255edb3a-aa51-4557-a602-93d4cb2b671d` — latência 33.1s.
- **Resposta:** "Você quer o Shampoo Preventive Power ou o Shampoo Calvície Zero? Me fala qual pra eu colocar no carrinho."
- **Avaliação:** ⚠️ Mantém o padrão da Rodada 1 — redireciona para o catálogo, mas **não diz "não temos shampoo de cavalo"**. Pior que Q5.4: pulou a honestidade e ainda decidiu pelo cliente que ele quer um dos dois.

#### Comparativo Rodada 1 → Rodada 2

| Cenário | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q5.1 — nome exato | ✅ Carrinho + preço + cross-sell | ⚠️ Carrinho + cross-sell, sem preço | Regressão parcial (preço sumiu) |
| Q5.2 — nome aproximado | ✅ Reconhecia família | ❌ Caiu na muleta | **Regressão grave** |
| Q5.3 — erro de digitação | ✅ Reconhecia + upsell de pack | ❌ Caiu na muleta | **Regressão grave** |
| Q5.4 — ativo concorrente (minoxidil) | ❌ Muleta | ✅ Assume ausência + alternativa | **Ganho grande** |
| Q5.5 — produto fora do catálogo (cavalo) | ⚠️ Redireciona sem honestidade | ⚠️ Idem | Inalterado |

#### Achados novos da Rodada 2 — Onda 5

- **Q5.E — Tolerância a coloquial/typo de produto regrediu (Q5.2 e Q5.3):** o caminho que reconhecia "calvicie zero" e "shampu preventiv" parou de funcionar. Hoje só nome exato (Q5.1) ou ativo concorrente bem identificado (Q5.4) sai da muleta. Erro de digitação e abreviação coloquial caíram no fallback genérico.
- **Q5.F — Price Scrubber excessivo na Q5.1:** quando o cliente pede o produto pelo nome e o item entra no carrinho, faz sentido mostrar o preço junto. O scrub atual está suprimindo valor mesmo nesse estado de "intenção de compra confirmada", o que tira informação útil para o fechamento.
- **Q5.G — Detecção de "ativo concorrente" (Q5.4) ficou ótima, mas não cobre análogos populares (Q5.5):** "minoxidil" passou a ser tratado com honestidade + alternativa; "shampoo de cavalo" continua sendo redirecionado sem dizer que não tem. O detector de "fora do catálogo com pista" precisa cobrir também produtos populares fora-do-escopo, não só ativos farmacológicos.

**Latência média:** ~54s.

---


## Onda 6 — Comparação e indecisão

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas.

### Q6.1 — "qual a diferença entre os dois shampoos?"
**Resposta:** "O Calvície Zero é mais forte para tratar queda e falhas (bloqueia DHT e estimula crescimento); o Preventive Power é para prevenção/manutenção pós-tratamento, com foco em controle de oleosidade/caspa e fortalecimento. [bullets de cada um] Ambos têm 250 ml (rende cerca de 2 meses). Qual faz mais sentido pro seu momento agora: tratar as falhas/queda ou manter/prevenir?"
**Avaliação:** ✅ Excelente. Comparação clara, diferença em 1 linha cada, dado concreto (250 ml / 2 meses) e devolveu a bola com pergunta de qualificação. Comportamento consultivo de vendedor.

### Q6.2 — "qual você recomenda?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. Sem contexto da conversa, devolveu a muleta. Mas sem turno anterior é até justificável — o problema é que a frase enlatada não orienta nada. Vendedor humano diria: "Pra te recomendar com precisão, me diz: você quer tratar queda agora ou só manter o cabelo saudável?" — mesma pergunta, mas com pista do que esperar.

### Q6.3 — "tô na dúvida"
**Resposta:** "Oi! Tudo bem? Quer focar em tratar queda/calvície agora ou em prevenção?"
**Avaliação:** ⚠️ Bom em conteúdo, ruim em forma. A pergunta de qualificação é correta. Mas começou com "Oi! Tudo bem?" — em conversa nova faria sentido, em conversa em andamento (que é o cenário típico de "tô na dúvida") cumprimentar de novo soa robótico. Mesmo problema da Onda 1 (greeting repetido).

### Q6.4 — "preciso pensar"
**Resposta:** "Tranquilo, sem pressa. Quando quiser retomar, chama aqui que te ajudo a escolher o melhor pra sua rotina."
**Avaliação:** ✅ Bom. Acolheu sem insistir, deixou porta aberta. Tom de vendedor experiente que sabe que pressão fecha menos venda.

### Q6.5 — "depois eu vejo"
**Resposta:** "Tranquilo! Sem pressa. Quando quiser retomar, é só chamar aqui. Tô por aqui."
**Avaliação:** ✅ Bom. Mesmo padrão do Q6.4. Consistente.

### Resumo da Onda 6

**Funciona bem:**
- Comparação direta entre 2 produtos do catálogo → resposta consultiva, com diferenças claras e qualificação ao final (Q6.1).
- Sinais de "vou pensar" → acolhimento sem insistência, porta aberta (Q6.4, Q6.5). Comportamento maduro.

**Quebras observadas:**
- **Q6.A — Recomendação genérica vira muleta:** "Qual você recomenda?" sem contexto cai na frase enlatada da Onda 4. Mesmo padrão: a frase pede contexto sem orientar o cliente sobre o que pode ser dito.
- **Q6.B — Re-greeting em conversa em andamento (Q6.3):** "Tô na dúvida" recebeu "Oi! Tudo bem?" antes da pergunta útil. É a mesma falha da Onda 1.2 — a IA não distingue conversa nova de conversa em andamento. Em base universal, "tô na dúvida" é sinal de continuidade, nunca de saudação inicial.

### Onda 6 — Rodada 2 (re-execução pós-Frentes 1–4, prompts oficiais do plano)

Executada via `ai-test-sandbox` Agent Mode, 5 conversas isoladas, modelo `gpt-5`, modo vendas ativo.

#### Q6.1 — "qual a diferença entre os dois shampoos?"
- **Conversa:** `72302027-780b-4e4b-88d4-623f455794fd` — latência 49.9s.
- **Resposta:** "Diferença direta: Preventive Power é pra prevenção/manutenção pós-tratamento; Calvície Zero é pra quem já tem queda ativa e falhas, com ação mais potente para interromper a queda e estimular crescimento. [bullets de cada um, 250 ml, ≈2 meses, resposta 7–15 dias] Qual faz mais sentido pro seu momento? Se quiser, te passo os detalhes de uso e os valores do que escolher."
- **Avaliação:** ✅ Excelente. Mantém o nível da Rodada 1 — abre com "diferença direta" em 1 linha, depois detalha cada um, devolve a bola com pergunta de qualificação. Comportamento consultivo de vendedor.

#### Q6.2 — "qual você recomenda?"
- **Conversa:** `24e187df-9cc9-49aa-aefa-9a3fb5a9fd00` — latência 67.3s.
- **Resposta:** "Pra tratar queda e estimular o crescimento, eu recomendo a Loção pós-banho calvicie zero (Noite). É prática de usar antes de dormir e age direto no couro cabeludo durante a noite, focada em calvície e queda. Quer ver os detalhes dela ou me conta onde está pegando mais (entradas, topo, falhas) pra eu ajustar certinho?"
- **Avaliação:** ✅ **GANHO grande.** Na Rodada 1 caía na muleta. Agora a IA assume a recomendação (Loção Calvície Zero Noite), justifica em 1 frase e ainda devolve com pergunta de qualificação opcional ("entradas, topo, falhas"). Comportamento de vendedor maduro.

#### Q6.3 — "tô na dúvida"
- **Conversa:** `bcfb1d5e-ced7-4c17-b89b-787d17242fb9` — latência 11.3s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ **REGRESSÃO.** Na Rodada 1 fazia pergunta de qualificação ("Quer focar em tratar queda/calvície agora ou em prevenção?") — só errava no greeting redundante. Agora caiu na muleta universal sem qualquer pista. Pior conteúdo, embora sem o re-greeting.

#### Q6.4 — "preciso pensar"
- **Conversa:** `a723e52f-178d-4d3d-91a7-8ec3bdc776d2` — latência 18.8s.
- **Resposta:** "Tudo bem, sem pressa. Quando quiser continuar ou tirar alguma dúvida, é só me chamar por aqui."
- **Avaliação:** ✅ Mantido. Acolhe sem insistir, deixa porta aberta. Equivalente à Rodada 1.

#### Q6.5 — "depois eu vejo"
- **Conversa:** `328f6cd8-07f4-4432-ad2c-c12fb62ccad8` — latência 7.6s.
- **Resposta:** "Sem pressa, qualquer dúvida estou aqui."
- **Avaliação:** ✅ Mantido, mais enxuto. Equivalente à Rodada 1.

#### Comparativo Rodada 1 → Rodada 2

| Cenário | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q6.1 — diferença entre 2 produtos | ✅ Comparação consultiva | ✅ Comparação consultiva | Mantido |
| Q6.2 — "qual você recomenda?" | ❌ Muleta | ✅ Recomenda + justifica + qualifica | **Ganho grande** |
| Q6.3 — "tô na dúvida" | ⚠️ Pergunta certa + re-greeting | ❌ Muleta universal | **Regressão de conteúdo** |
| Q6.4 — "preciso pensar" | ✅ Acolhimento maduro | ✅ Acolhimento maduro | Mantido |
| Q6.5 — "depois eu vejo" | ✅ Acolhimento maduro | ✅ Acolhimento maduro | Mantido |

#### Achados novos da Rodada 2 — Onda 6

- **Q6.C — "Qual você recomenda?" virou caminho consultivo sólido (ganho da Rodada 2):** o cenário que era muleta na Rodada 1 agora produz recomendação ativa com justificativa breve e pergunta de qualificação opcional. É o melhor padrão de vendas observado nesta onda.
- **Q6.D — "Tô na dúvida" perdeu a pergunta de qualificação:** na Rodada 1 a IA pelo menos perguntava "tratar queda/calvície ou prevenção?" — útil mesmo com o greeting errado. Agora caiu na muleta total. Sintoma do mesmo problema das Ondas 4 e 5: turnos curtos sem pista explícita estão indo para a frase enlatada em vez de gerar pergunta de qualificação contextual.
- **Q6.E — "Preciso pensar" / "depois eu vejo" são o ponto mais estável da base:** mesmo conteúdo, mesmo tom, mesmo acolhimento entre rodadas. É um cenário que não precisa de ajuste.

**Latência média:** ~31s.

---


## Onda 7 — Objeções de preço e garantia

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas.

### Q7.1 — "tá caro"
**Resposta:** "Me conta um pouco mais do que você quer resolver, que eu já te indico o certo."
**Avaliação:** ❌ Falha grave. "Tá caro" é a objeção de venda mais clássica que existe. Vendedor humano responderia ancorando valor: "Caro comparado a quê? Nosso shampoo rende 2 meses (250 ml), o que dá menos de R$ 1,30 por dia de tratamento. E tem frete grátis acima de R$ X / parcela em até Y vezes." Devolver muleta de "me conta o que precisa" é jogar fora uma intenção de compra evidente.

### Q7.2 — "achei mais barato em outro lugar"
**Resposta:** "Me conta um pouco mais do que você quer resolver, que eu já te indico o certo."
**Avaliação:** ❌ Falha grave. Comparação com concorrente exige resposta de diferenciação: fórmula, resultado, garantia, suporte, autenticidade. A IA tratou como pergunta vaga e perdeu a chance de defender valor. Em vendas, esse turno é o momento de fechar — virou abandono.

### Q7.3 — "vale a pena?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. "Vale a pena?" é pedido de prova social/resultado. Vendedor responderia: "Vale. Os clientes que usam por 60 dias seguidos relatam X. E se não funcionar, [garantia]. Quer ver depoimentos ou começar por um kit de teste?"

### Q7.4 — "não sei se compensa"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. Mesma classe de Q7.3 — pedido de justificativa de valor. Recebeu muleta enlatada idêntica.

### Q7.5 — "tem garantia? e se não funcionar?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha crítica. Pergunta sobre política de garantia/devolução é informação factual que a IA deveria conhecer (ou consultar). Devolver muleta nessa pergunta é o pior cenário possível: o cliente perde confiança e some.

### Resumo da Onda 7

**Funciona bem:** nada. 5 de 5 cenários caíram na muleta enlatada.

**Quebras observadas:**
- **Q7.A — Objeção de preço sem ancoragem de valor:** "Tá caro" e "mais barato em outro lugar" não disparam comportamento de defesa de valor (rendimento, parcelamento, frete, diferenciação). A IA precisa de um classificador "objeção comercial" que ative resposta com ancoragem.
- **Q7.B — Pedido de prova social ignorado:** "Vale a pena?" e "não sei se compensa" são gatilhos de prova/resultado/garantia, não de qualificação. Hoje recebem a mesma muleta de "me conta o que precisa".
- **Q7.C — Política de garantia/devolução não respondida:** "Tem garantia?" é pergunta factual sobre política comercial. A IA não tem (ou não acessa) essa informação na base universal e devolve muleta — o que é o pior comportamento possível em fundo de funil.
- **Q7.D — Padrão sistêmico confirmado:** Onda 7 confirma o que Ondas 4, 5 e 6 já indicavam — qualquer pergunta que não seja "buscar produto pelo nome" cai na mesma frase. A IA tem 1 fluxo bom (catálogo) e 1 muleta única para todo o resto.

### Onda 7 — Rodada 2 (re-execução pós-Frentes 1–4, prompts oficiais do plano)

Executada via `ai-test-sandbox` Agent Mode, 5 conversas isoladas, modelo `gpt-5`, modo vendas ativo.

#### Q7.1 — "tá caro"
- **Conversa:** `ae350e2c-a507-4c18-9822-7d15e0df0275` — latência 9.9s.
- **Resposta:** "Me conta um pouco mais do que você quer resolver, que eu já te indico o certo."
- **Avaliação:** ❌ Mantida a falha. Objeção clássica de preço não dispara ancoragem de valor (rendimento, parcelamento, frete). Idêntico à Rodada 1.

#### Q7.2 — "achei mais barato em outro lugar"
- **Conversa:** `107f436a-a7cc-4fa7-8eec-c6833551eeac` — latência 9.2s.
- **Resposta:** "Me conta um pouco mais do que você quer resolver, que eu já te indico o certo."
- **Avaliação:** ❌ Mantida a falha. Comparação com concorrente segue tratada como pergunta vaga, sem defesa de diferenciação.

#### Q7.3 — "vale a pena?"
- **Conversa:** `79e98084-d054-471e-8601-d731a3547bac` — latência 10.3s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ Mantida a falha. Pedido de prova/resultado não dispara nenhuma resposta de social proof, garantia ou estimativa de tempo de resultado.

#### Q7.4 — "não sei se compensa"
- **Conversa:** `b0a71236-9af1-407b-88b5-ddc257f41e3e` — latência 10.4s.
- **Resposta:** "Entendo a dúvida. Pra te indicar o certo: seu foco é tratar queda/calvície agora ou prevenção?"
- **Avaliação:** ⚠️ **Pequeno ganho.** Saiu da muleta universal: acolhe ("entendo a dúvida") e faz pergunta de qualificação contextual. Ainda assim não é a resposta ideal — "compensa" é objeção de valor que pediria ancoragem de resultado/garantia, não só qualificação. Mas é o único cenário desta onda que evoluiu.

#### Q7.5 — "tem garantia? e se não funcionar?"
- **Conversa:** `a7036359-74d3-4055-a39f-96023352a6db` — latência 11.8s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ **Crítico — mantido.** Pergunta factual sobre política de garantia/devolução continua recebendo a muleta universal. É o pior comportamento possível em fundo de funil: o cliente perde confiança e some.

#### Comparativo Rodada 1 → Rodada 2

| Cenário | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q7.1 — "tá caro" | ❌ Muleta | ❌ Muleta | Inalterado |
| Q7.2 — "mais barato em outro lugar" | ❌ Muleta | ❌ Muleta | Inalterado |
| Q7.3 — "vale a pena?" | ❌ Muleta | ❌ Muleta | Inalterado |
| Q7.4 — "não sei se compensa" | ❌ Muleta | ⚠️ Acolhe + qualifica | **Pequeno ganho** |
| Q7.5 — "tem garantia?" | ❌ Muleta | ❌ Muleta | Inalterado |

#### Achados novos da Rodada 2 — Onda 7

- **Q7.E — Onda 7 é o ponto cego mais persistente da base universal:** 4 de 5 cenários idênticos à Rodada 1, mesmo após as Frentes 1–4. Objeção comercial (preço, comparação com concorrente, prova social, garantia) não tem rota dedicada e cai sempre na muleta enlatada.
- **Q7.F — "Não sei se compensa" abriu a única brecha:** é o único caso da onda que evoluiu para resposta com qualificação contextual. Sinaliza que existe potencial de detector de objeção, mas hoje só captura uma variante específica.
- **Q7.G — Garantia/devolução continua sendo lacuna factual crítica:** a base universal não tem fonte de verdade sobre política comercial (garantia, devolução, prazo de troca) — sem esse dado, a IA não tem como responder corretamente nem mesmo se o detector funcionasse. É lacuna de conteúdo, não só de pipeline.

**Latência média:** ~10s.

---



## Onda 8 — Informação institucional e operacional

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas.

### Q8.1 — "vocês entregam pra Manaus?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. Pergunta factual de cobertura/frete. A IA tem acesso a CEP, frete, prazo — deveria ter respondido "Entregamos pra Manaus sim. Pra te passar prazo e frete exatos, me manda o CEP." Devolveu muleta.

### Q8.2 — "qual o prazo de entrega?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. Mesma classe de Q8.1 — informação de prazo depende de CEP, mas a resposta certa é pedir o CEP, não devolver muleta de qualificação de produto.

### Q8.3 — "como funciona o pagamento?"
**Resposta:** "Funciona por link de pagamento: eu te envio, você escolhe a forma no checkout e a confirmação sai na hora. Me confirma qual produto você quer fechar que eu já gero o link aqui."
**Avaliação:** ✅ Bom. Explicou o fluxo, fechou com call-to-action. Comportamento de vendedor. Único problema menor: não listou as formas aceitas (pix, cartão, parcelamento), o que é informação útil em pré-venda.

### Q8.4 — "vocês têm loja física?"
**Resposta:** "Deixa eu confirmar isso direito pra te responder com certeza. Pode me dizer de novo o nome ou a categoria do produto que você procura?"
**Avaliação:** ❌ Falha confusa. Reconheceu que não sabe (ponto positivo: humildade), mas em vez de informar "somos 100% online" ou consultar a base, mudou de assunto pedindo nome de produto. Resposta desconexa — pergunta sobre loja física não tem nada a ver com produto.

### Q8.5 — "qual o horário de atendimento?"
**Resposta:** "Aqui no WhatsApp você pode mandar mensagem a qualquer hora; a equipe responde no expediente. Se preferir, também atendemos no e-mail atendimento@respeiteohomem.com.br e no telefone 1151945215. Quer seguir por aqui mesmo?"
**Avaliação:** ✅ Excelente. Resposta completa: WhatsApp 24h, expediente, e-mail e telefone. Fecha perguntando se quer seguir ali. Único ponto: "expediente" é vago (deveria dizer "seg-sex 9h-18h" se a base tiver).

### Resumo da Onda 8

**Funciona bem:**
- Pergunta sobre forma de pagamento (Q8.3) → resposta clara com call-to-action.
- Pergunta sobre canais de atendimento (Q8.5) → resposta completa com WhatsApp/e-mail/telefone.

**Quebras observadas:**
- **Q8.A — Cobertura e prazo de entrega caem na muleta:** "Entregam pra X?" e "qual o prazo?" são perguntas factuais sobre frete que a IA tem ferramenta para responder (precisa de CEP). Em vez de pedir o CEP, devolveu a muleta universal. Mesma classe de falha das Ondas 4-7.
- **Q8.B — Pergunta sobre loja física vira não-resposta confusa (Q8.4):** Em vez de afirmar "somos 100% online" ou consultar a base, a IA mudou de assunto pedindo nome de produto. Resposta desconexa que parece bug de roteamento.
- **Q8.C — Inconsistência entre informações institucionais:** Pagamento (Q8.3) e atendimento (Q8.5) têm respostas excelentes; entrega (Q8.1, Q8.2) e loja física (Q8.4) falham. A IA tem **fragmentos** da base institucional, não uma base coesa.

### Onda 8 — Rodada 2 (re-execução pós-Frentes 1–4, prompts oficiais do plano)

Executada via `ai-test-sandbox` Agent Mode, 5 conversas isoladas, modelo `gpt-5`, modo vendas ativo.

#### Q8.1 — "vocês entregam pra Manaus?"
- **Conversa:** `c281f794-92a5-413f-b376-1d2bfe62e13f` — latência 9.9s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ Mantida a falha. Pergunta factual de cobertura segue tratada como qualificação de produto.

#### Q8.2 — "qual o prazo de entrega?"
- **Conversa:** `2a803cd4-ea5a-44d0-9dc5-5650a0631235` — latência 8.8s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ Mantida a falha. Resposta certa seria pedir o CEP — segue caindo na muleta.

#### Q8.3 — "como funciona o pagamento?"
- **Conversa:** `27d6ab81-cdd8-43cd-ae80-ac61dd013183` — latência 43.6s.
- **Resposta:** "O pagamento é por um link de checkout seguro: você abre, escolhe a forma disponível e paga; a confirmação cai na hora. Me diz qual produto você quer fechar que eu já te mando o link."
- **Avaliação:** ✅ Mantido. Mesmo padrão da Rodada 1: explica o fluxo + call-to-action. Continua sem listar formas aceitas (pix, cartão, parcelamento).

#### Q8.4 — "vocês têm loja física?"
- **Conversa:** `4ec146c0-202d-4f6d-9d81-14878d86e872` — latência 9.3s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ⚠️ **Mudou o sintoma, mas continua errado.** Na Rodada 1 era resposta confusa ("deixa eu confirmar" + pediu nome de produto). Agora caiu na muleta universal. Saiu da confusão, mas perdeu a mínima honestidade que tinha — pior em conteúdo factual.

#### Q8.5 — "qual o horário de atendimento?"
- **Conversa:** `0a6c3cbb-cb82-47c4-9a31-e54ccadc88d7` — latência 9.1s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Avaliação:** ❌ **REGRESSÃO grave.** Na Rodada 1 era resposta excelente (WhatsApp 24h, e-mail, telefone, fechamento com CTA). Agora caiu na muleta universal. **Perda total de uma das duas respostas institucionais bem-resolvidas da Onda 8.**

#### Comparativo Rodada 1 → Rodada 2

| Cenário | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q8.1 — "entregam pra Manaus?" | ❌ Muleta | ❌ Muleta | Inalterado |
| Q8.2 — "qual o prazo?" | ❌ Muleta | ❌ Muleta | Inalterado |
| Q8.3 — "como funciona pagamento?" | ✅ Explica + CTA | ✅ Explica + CTA | Mantido |
| Q8.4 — "loja física?" | ⚠️ Resposta confusa | ❌ Muleta | Regressão |
| Q8.5 — "horário de atendimento?" | ✅ Resposta completa (3 canais) | ❌ Muleta | **Regressão grave** |

#### Achados novos da Rodada 2 — Onda 8

- **Q8.D — Resposta de horário/canais de atendimento foi perdida (regressão grave):** o único cenário institucional 100% bem-resolvido na Rodada 1 (Q8.5) agora caiu na muleta universal. Sinaliza que a fonte institucional (e-mail/telefone/horário) deixou de chegar ao prompt no fluxo atual — antes existia, agora sumiu.
- **Q8.E — A base institucional ficou ainda mais fragmentada:** na Rodada 1 a IA tinha 2 respostas excelentes (Q8.3 e Q8.5) e 3 falhas. Agora tem só 1 resposta excelente (Q8.3) e 4 falhas. O que era "fragmento institucional parcial" virou "fragmento mínimo" — só pagamento sobreviveu.
- **Q8.F — Latência do "muleta universal" ficou ~9s consistentes:** turnos que caem na muleta respondem em ~9s; o caminho útil (Q8.3) levou 43s. Isso indica que a muleta é resposta determinística rápida (sem chamada de tool/contexto), enquanto o caminho institucional real exige o LLM completo. Sem detector de intent institucional, a IA opta pelo caminho rápido errado.

**Latência média:** ~16s (puxada por Q8.3).

---



## Onda 9 — Pós-venda e atendimento de cliente existente

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas.

### Q9.1 — "cadê meu pedido?"
**Resposta:** "Poxa, chato ficar sem atualização. Confiro já pra você. Me passa seu nome completo e o número do pedido (se tiver). Se não tiver, pode ser o CPF ou o e-mail usado na compra. E me diz rapidinho o que rolou: atraso na entrega ou rastreio parado?"
**Avaliação:** ✅ Excelente. Empatia (poxa, chato), ação imediata (confiro já), pediu os dados certos com fallback (nome+pedido OU CPF/e-mail), qualificou o problema (atraso vs rastreio parado). Comportamento de SAC maduro.

### Q9.2 — "quero trocar o produto"
**Resposta:** "Poxa, chato isso. Vamos resolver sua troca. Me passa por favor seu nome completo, o número do pedido (se tiver) e me conta rapidinho o que aconteceu com o produto. Com isso eu já chamo alguém da equipe pra acompanhar com você."
**Avaliação:** ✅ Bom. Empatia, ação, dados pedidos. Único ponto: já avisa que vai escalar pra equipe — comportamento honesto, não promete o que não pode entregar.

### Q9.3 — "minha compra não chegou"
**Resposta:** "Poxa, chato isso. Vou olhar pra você. Me passa seu nome completo e o número do pedido (se tiver). Se não tiver o número, pode me mandar o e-mail ou CPF usados na compra."
**Avaliação:** ✅ Bom. Mesmo padrão do Q9.1, consistente.

### Q9.4 — "vocês têm cupom de desconto?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. Pergunta sobre política comercial (cupom ativo, primeira compra, frete grátis). Mesma muleta da Onda 4.B. Já registrado.

### Q9.5 — "como rastreio?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha grave. Pergunta operacional clara — cliente quer saber **como** rastrear (link, código, site dos correios). A IA tem ferramenta de pedido (provou em Q9.1/Q9.3) mas não conectou. Devolveu muleta. Pior: em Q9.1 ("cadê meu pedido?") ela pediu dados; aqui (mesma intenção, redação diferente) caiu na muleta. Inconsistência.

### Resumo da Onda 9

**Funciona bem:**
- "Cadê meu pedido?", "quero trocar", "não chegou" → ✅ comportamento de SAC maduro: empatia, ação, dados com fallback, qualificação. 3 de 3 nessa classe.

**Quebras observadas:**
- **Q9.A — Pergunta sobre cupom de desconto cai na muleta:** Confirmação da Onda 4.B. Não há resposta para política de cupom/desconto na base universal.
- **Q9.B — "Como rastreio?" não conecta com fluxo de pedido (Q9.5):** A IA tem ferramenta de pedido — provou em Q9.1 e Q9.3. Mas a redação "como rastreio?" não dispara o mesmo fluxo. Classificador de intenção depende muito da redação literal: "cadê meu pedido" ✅ vs "como rastreio?" ❌. Inconsistência grave de roteamento.

### Onda 9 — Rodada 2 (pós Frentes 1–4)

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas, modelo `gpt-5`.

| Q | Pergunta | Rodada 1 | Rodada 2 | Δ |
|---|---|---|---|---|
| Q9.1 | "cadê meu pedido?" | ✅ Empatia + dados + qualificação | ✅ Mantido. "Te ajudo a localizar seu pedido agora. Me passa nome + número do pedido (ou e-mail/CPF) e o que aconteceu." | = |
| Q9.2 | "quero trocar o produto" | ✅ Empatia + escala equipe | ✅ Mantido + ganho. Agora pergunta também se produto está lacrado/usado (qualificação de troca). Handoff acionado corretamente. | ↑ |
| Q9.3 | "minha compra não chegou" | ✅ Padrão SAC | ✅ Mantido. "Poxa, que chato isso. Vou olhar pra você…" Handoff acionado (complaint + urgency high). | = |
| Q9.4 | "vocês têm cupom de desconto?" | ❌ Muleta | ❌ **Mantida.** Mesma muleta universal. Confirmação da Onda 4.B — sem fonte de política comercial. | = |
| Q9.5 | "como rastreio?" | ❌ Muleta (inconsistência grave) | ✅ **Ganho importante.** Agora responde a parte operacional ("código vai por e-mail quando postado, posso enviar aqui") + pede dados pra verificar. Inconsistência Q9.1 vs Q9.5 resolvida. | ↑↑ |

**Latência média:** ~16s. 5 conversas: `828f03d6-58a8-4a42-8274-348cfdcd5cb2`, `584c6080-2f28-4aaa-8579-d02996aa731f`, `c3bd848c-dd5b-4ef2-bbbc-21144b744b15`, `734eba7d-39d5-4003-aefc-5e794b3f5e8f`, `a7b75839-81e8-48c1-93e5-80ef82955e16`.

**Leitura geral:**
- **3 ganhos / 0 regressões.** Q9.2 ficou mais maduro (qualificação extra), Q9.5 resolveu a inconsistência crítica de roteamento (mesma intenção, redação diferente agora dispara o mesmo fluxo).
- **Q9.4 (cupom) é ponto cego documental, não de pipeline** — mesmo motivo da Onda 4.B e Onda 7. Não há fonte de verdade na base universal sobre política de cupom/desconto pra IA consultar.
- **Pós-venda em geral é o ponto mais maduro da base universal:** 4 de 5 cenários da Onda 9 funcionam bem em Rodada 2, contrastando com Onda 7 (objeções comerciais) e Onda 8 (institucional), que continuam frágeis.

---

## Onda 10 — Mensagens fora do escopo e ruído

Executada via `ai-test-sandbox` Agent Mode, conversas isoladas.

### Q10.1 — "kkk"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha de tom. "kkk" é ruído social — risada solta sem intenção comercial. Vendedor humano responderia leve ("haha", emoji) ou ignoraria. A IA tratou como pergunta vaga e devolveu muleta — quebra o ritmo da conversa e soa robótica.

### Q10.2 — "vlw"
**Resposta:** "Imagina! Qualquer coisa sobre tratamento pra calvície ou prevenção, me chama."
**Avaliação:** ✅ Excelente. Fechamento natural, recíproco, deixa porta aberta com gancho específico (calvície/prevenção). Comportamento maduro.

### Q10.3 — "boa noite!"
**Resposta:** "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando."
**Avaliação:** ✅ Bom. Saudação devolvida, abertura natural. Único ponto: "como posso ajudar" + "me conta o que está procurando" são redundantes; podia escolher um.

### Q10.4 — "tem alguém aí?"
**Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
**Avaliação:** ❌ Falha. "Tem alguém aí?" é pedido de presença/sinal de vida (cliente esperando resposta há tempo, ou primeira mensagem testando). Resposta correta: "Tô aqui sim! Me conta no que posso ajudar." A muleta atual ignora a ansiedade da pergunta.

### Q10.5 — "preciso falar com humano"
**Resposta:** "Claro. Posso te colocar com alguém da equipe, sim. Me passa por favor: nome completo, e-mail ou CPF do pedido, número do pedido (se tiver), e um resumo rapidinho do que aconteceu. Com isso já encaminho pro time certo."
**Avaliação:** ✅ Excelente. Aceita o pedido sem resistência, coleta dados de forma estruturada, promete encaminhamento. Comportamento ideal — não tenta convencer o cliente a continuar com a IA.

### Resumo da Onda 10

**Funciona bem:**
- "Vlw" / fechamento de conversa → ✅ resposta recíproca com gancho.
- "Boa noite!" → ✅ saudação devolvida.
- "Preciso falar com humano" → ✅ aceita escalar sem resistência, coleta dados estruturados.

**Quebras observadas:**
- **Q10.A — "kkk" e ruído social caem na muleta:** Mensagens curtas/sociais sem intenção comercial precisam de detector próprio (ignorar, responder leve, ou pedir continuação natural). Hoje viram pergunta vaga.
- **Q10.B — "Tem alguém aí?" não detecta pedido de presença:** Padrão claro de cliente ansioso ou testando canal. A resposta deveria afirmar presença antes de qualificar. Mais um exemplo de classificador que não pega intenções emocionais.

---

### Onda 10 — Rodada 2 (pós Frentes 1–4)

**Build:** mesma da Rodada 2 das Ondas anteriores (Frentes 1–4 ativas).
**Execução:** via `ai-test-sandbox` Agent Mode no tenant Respeite o Homem, conversas isoladas. Modelo `gpt-5`, `sales_mode=true`.

#### Q10.1 — "kkk"
- **Conversa:** `9b5e4b91-e530-4d96-98f9-9f26c85d7dce` — latência 17.9s.
- **Resposta:** "Oi! Tudo bem? Tá buscando algo pro cabelo: queda ou prevenção?"
- **Intent:** `general`, sentiment=neutral, summary="Cliente rindo ou expressando descontração com 'kkk'."
- **Avaliação:** ❌ **Mudou o sintoma, piorou em conteúdo.** Na Rodada 1 caiu na muleta universal. Agora a IA espelhou a saudação ("Oi! Tudo bem?") mas pulou direto para assunto — sem entender que "kkk" é ruído social. Pior: assumiu nicho (cabelo/queda/prevenção) sem o cliente ter mencionado produto, categoria ou dor. Classificador acertou a intenção (`general`/descontração), mas o prompt de vendas sobrescreveu.

#### Q10.2 — "vlw"
- **Conversa:** `5bffe779-2ebc-4826-943a-8650a9dffa57` — latência 27.4s.
- **Resposta:** "Imagina! Tá buscando algo pra tratar queda/calvície ou pra prevenção?"
- **Intent:** `thanks`, sentiment=neutral
- **Avaliação:** ⚠️ **Regressão.** Na Rodada 1 era excelente: "Imagina! Qualquer coisa sobre tratamento pra calvície ou prevenção, me chama." — fechamento natural com gancho leve. Agora o gancho virou pergunta direta ("Tá buscando...?") que força continuidade de venda onde o cliente só agradeceu. O continuity-gate deveria reconhecer `intent=thanks` e proibir reabertura de discovery.

#### Q10.3 — "boa noite!"
- **Conversa:** `3589debf-ea1a-4042-81ca-2ee23c638f8f` — latência 22.7s.
- **Resposta:** "Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que você está procurando."
- **Intent:** `greeting`, topics=[saudacao]
- **Avaliação:** ✅ **Mantido.** Mesmo padrão da Rodada 1: saudação devolvida, abertura natural. A observação de redundância ("como posso ajudar" + "me conta o que está procurando") persiste, mas é cosmética.

#### Q10.4 — "tem alguém aí?"
- **Conversa:** `36cf04f1-f9aa-43a0-a4a6-36ae5c8ebce6` — latência 22.1s.
- **Resposta:** "Me conta um pouco do que você precisa que eu já te indico."
- **Intent:** `greeting`, summary="O cliente está perguntando se há alguém disponível para atendimento."
- **Avaliação:** ❌ **Mantida.** Na Rodada 1 caiu na muleta; agora também cai na muleta. A classificação melhorou (reconheceu "perguntando se há alguém disponível"), mas a resposta continua sendo a muleta universal. Esperado: "Tô aqui sim! Me conta no que posso ajudar."

#### Q10.5 — "preciso falar com humano"
- **Conversa:** `3758f024-20e2-4321-a09f-11ac36ae19c8` — latência 17.0s.
- **Resposta:** "Vou chamar alguém da equipe pra resolver isso direto com você. Já te respondem por aqui."
- **Intent:** `action_request`, handoff=true, urgency=high, topics=[support_request]
- **Avaliação:** ✅ **Mantido.** Comportamento ideal — aceita escalar sem resistência, promete encaminhamento. Na Rodada 1 coletava dados estruturados (nome, pedido, resumo); agora é mais direto e leve. Ambos são válidos, mas a Rodada 2 perdeu a coleta de dados que enriquecia o handoff.

#### Comparativo Rodada 1 → Rodada 2

| Cenário | Rodada 1 | Rodada 2 | Status |
|---|---|---|---|
| Q10.1 — "kkk" | ❌ Muleta | ❌ Saudação + viés de nicho | Mudou sintoma, piorou |
| Q10.2 — "vlw" | ✅ Excelente (gancho leve) | ⚠️ Forçou venda no agradecimento | **Regressão** |
| Q10.3 — "boa noite!" | ✅ Saudação | ✅ Saudação | Mantido |
| Q10.4 — "tem alguém aí?" | ❌ Muleta | ❌ Muleta | Inalterado |
| Q10.5 — "preciso falar com humano" | ✅ Excelente (dados estruturados) | ✅ Direto, sem resistência | Mantido (conteúdo diferente, igualmente válido) |

**Latência média:** ~21.4s.

#### Achados novos da Rodada 2 — Onda 10

- **Q10.C — Ruído social agora dispara saudação + viés de nicho (Q10.1):** em vez da muleta, "kkk" recebeu "Oi! Tudo bem?" + assunto. A Frente 2 (scope-router) classificou corretamente como `general`, mas o estado greeting sobrescreveu. O detector de ruído social ainda não existe — a IA tenta vender em qualquer contexto.
- **Q10.D — Agradecimento virou reabertura de discovery (Q10.2):** `intent=thanks` deveria ser terminal (ou gancho leve). Em vez disso, a IA perguntou "Tá buscando algo...?" — como se o cliente não tivesse acabado de agradecer. O continuity-gate não está reconhecendo `thanks` como estado terminal.
- **Q10.E — "Tem alguém aí?" classifica melhor, responde igual (Q10.4):** o TPR agora entende a intenção ("perguntando se há alguém disponível"), mas o bucket-state-router (Frente 3) não mapeia `greeting` + contexto de presença para resposta diferente da muleta. Gap no bucket `social`/`greeting`.
- **Q10.F — Handoff perdeu enriquecimento de dados (Q10.5):** a Rodada 1 coletava nome+pedido+resumo; a Rodada 2 só promete encaminhar. O bucket `human_request` do Frente 3 pode estar sobrescrevendo o comportamento natural da IA em vez de complementá-lo.

---

## Fim da Fase 3 — Diagnóstico Funcional

Todas as 10 ondas executadas. **50 cenários testados, 5 grandes padrões de falha confirmados:**

1. **Muleta universal:** "Me conta um pouco do que você precisa que eu já te indico" é a resposta padrão para qualquer mensagem que não case com palavra-chave forte de produto/pedido. Apareceu em ~25 dos 50 cenários.
2. **Classificador depende da redação literal:** "Cadê meu pedido?" ativa fluxo SAC; "como rastreio?" não. "Mais completo" funciona; "mais caro" não. A IA não generaliza intenção.
3. **Re-greeting em conversa em andamento:** "Tô na dúvida", "boa noite" mid-conversa recebem "Oi! Tudo bem?". A IA não distingue conversa nova de continuação.
4. **Falta de base institucional coesa:** Pagamento e atendimento estão respondidos; entrega, loja física, garantia, cupom e prova social não. Fragmentos, não base.
5. **Sem comportamento comercial defensivo:** Objeções de preço, comparação com concorrente, "vale a pena?" e "tem garantia?" — todos os gatilhos clássicos de fechamento — caem na muleta. A IA não tem ancoragem de valor.

**O que funciona consistentemente:**
- Busca de produto pelo nome (exato, colloquial, com typo) e upsell.
- Comparação direta entre 2 produtos do catálogo.
- Fluxo de pós-venda quando a redação contém palavras fortes ("pedido", "trocar", "não chegou").
- Pedido para falar com humano (aceita escalar).
- Sinais de "vou pensar" (acolhe sem insistir).

---

## Próximo passo — Fase 4

Aguardando "ok" para iniciar **Fase 4 — Análise consolidada**:
1. Agrupar os 5 padrões em causas raiz.
2. Propor plano de ajuste único (o que vira regra estrutural, o que vira detector, o que vira base institucional).
3. Incorporar ao changelog formal da base universal.
4. Descartar este documento de trabalho.

---

## Fase 4 — Plano de Ajuste — Andamento

### Frente 1 — Limpeza de resíduos cosméticos ✅ APLICADO
Removidos hardcodes de shampoo/cabelo/queda dos arquivos de pipeline (consultative-turn, turn-pre-router, turn-completeness, prompts/recommendation). Pipeline agora usa só vocabulário do tenant + sinais universais.

### Frente 2 — Roteador de escopo (11 buckets de intenção) ✅ APLICADO
Cada turno do cliente passa a ser consolidado em um dos 11 buckets:
`social`, `product_question`, `catalog_question`, `commercial_policy`, `institutional`, `post_sale`, `objection`, `hesitation`, `human_request`, `out_of_scope`, `open_discovery`.

- Classificador (TPR) ganhou o campo `intent_bucket` (LLM declara direto).
- Roteador determinístico (`scope-router.ts`) deriva o bucket quando o TPR cai em fallback ou não preenche.
- Wired no `ai-support-chat` — só loga e expõe; ainda não muda comportamento (Frentes 3-5 vão consumir).
- `open_discovery` é o ÚNICO bucket onde a "muleta de descoberta consultiva" continua válida — todos os outros 10 saem do fluxo de descoberta.

**Status:** aditivo, sem regressão funcional. Pendente de validação em conversa real para confirmar que os buckets estão sendo classificados certo (vai ser feito junto com Frentes 3-5).

### Frente 3 — Roteador de bucket por estado (entregue)

- Novo módulo `bucket-state-router.ts` consome o `IntentBucket` do Frente 2 e, para os buckets NÃO-vendas, devolve override de estado e/ou bloco curto de prompt.
- Mapas:
  - `human_request` → `handoff` + bloco de transição educada.
  - `post_sale` → `support` + bloco proibindo discovery de venda.
  - `institutional` → `support` + bloco montado a partir da KB do tenant (`business_context`, `attendance_rules`) e contexto de marca (`banned_claims`, `do_not_do`). Sem KB → instrução explícita de NÃO inventar e oferecer humano.
  - `objection` → mantém estado, bloco que proíbe inventar desconto/cupom e força usar prova cadastrada.
  - `hesitation` → mantém estado, bloco "não pressionar".
  - `out_of_scope` → mantém estado, bloco de redirecionamento educado.
- Wired no `ai-support-chat` DEPOIS do reflexo determinístico (Reg #2.17 Fase 3): se o reflexo já fixou estado, o Frente 3 NÃO sobrescreve — só anexa bloco de prompt quando complementar.
- Lê `tenant_brand_context` em fetch leve, tolerante a miss.

**Status:** aditivo, sem regressão. Pendente de validação na próxima bateria.

### Frente 4 — Gate de continuidade ✅ APLICADO

- Novo módulo `continuity-gate.ts` (`buildContinuityBlock`) gera bloco curto de instrução quando há contexto acumulado:
  1. **Anti-loop de descoberta:** se houve ≥1 turno anterior em `discovery`/`greeting`, proíbe repetir variações de "o que você está procurando?", "prefere ver opções?", "qual seu objetivo?", etc., e exige progressão (mostrar opção concreta OU pedir 1 info específica).
  2. **Foco de família persistente:** se `family_focus` está setado, instrui a IA a manter a família e não reabrir "qual categoria?".
  3. **Foco de produto recente:** se `last_focused_product_name` está setado e o estado é `recommendation`/`product_detail`/`decision`, instrui a continuar a partir desse produto.
  4. **Carrinho ativo em estado pré-fechamento:** reforça que se há carrinho, não voltar a perguntas de descoberta.
- `gateSemanticRepetition` em `output-gates.ts` recebeu novos padrões: "qual seu objetivo/interesse/foco", "como posso ajudar (hoje)", "tem alguma preferência/ideia/dúvida em mente". Passa a detectar mais famílias clássicas de pergunta-muleta repetida.
- Wired no `ai-support-chat` depois do bucket router (Frente 3) e antes de `buildPromptForState`. Lê `ai_support_turn_log` (últimos 5 turnos) para contar discovery consecutivos. Tolerante a falha (try/catch).

**Status:** aditivo, sem regressão. Pendente de validação na próxima bateria.

### Próximo — Frente 5
- Frente 5: prompts dos estados consumindo os blocos das Frentes 3/4 com naturalidade (refinar o `prompt-router.ts`/`prompts/*.ts` para integrar os blocos sem soar robótico).

---

## Plano Endurecido (pós-Rodada 2) — Frentes A → F

### Frente A — Bateria de regressão fixa ✅ APLICADA (2026-05-23)

**Entrega:** doc oficial `docs/especificacoes/ia/bateria-regressao-base-universal.md` congelando 19 cenários ✅/↑ da Rodada 2 como critério obrigatório de "não regrediu" para todas as Frentes seguintes.

**Cenários incluídos (19):** B1.1–B1.5 (saudação), B3.1–B3.3 (catálogo direto + fora-escopo honesto), B5.1 (minoxidil → alternativa), B5.2 (Shampoo Preventive Power exato com preço), B6.1 (diferença), B6.2 (recomenda), B6.3 (hesitação), B8.1 (pagamento), B9.1–B9.4 (pós-venda completo), B10.1 (boa noite), B10.2 (humano).

**Cenário condicional (1):** B4.1 ("kit mais completo") — entra na bateria obrigatória após a Frente C restaurar a regressão.

**Validação técnica executada:**
- Doc criado e versionado.
- Lista cruzada com a Rodada 2 do doc temporário cenário a cenário — todos os 19 estão classificados como ✅ ou ↑ na Rodada 2.
- Procedimento de execução documentado (sandbox Agent Mode, modelo, tenant, conversas isoladas).
- Critério de fechamento documentado (✅/⚠️/❌ + abortar a Frente em caso de ❌).

**Status:** aditivo, sem mexer em código de pipeline. Sem risco de regressão.

**Pendente para frente seguinte:** capturar o **baseline real** (transcrição turno a turno) executando a bateria uma vez antes de aplicar a Frente B, e arquivar nesta seção como "Baseline Frente B".

### Próximo — Frente B (continuity-gate completo)
Estende continuity-gate para tratar `intent=thanks` como terminal, ruído social ("kkk"/"haha"/"rs"/emoji solto), e adiciona reflexo determinístico de presença ("tem alguém aí?", "alô"). Resolve Q10.1, Q10.2 e Q10.4.



### Frente B — Continuity-gate completo ✅ APLICADA (2026-05-23)
- `thanks/farewell` → terminal universal ("vlw", "obrigado", "tmj", "tchau", "abraço", emoji solto de gratidão).
- Ruído social ("kkk", "haha", "hue", emoji puro) responde leve, sem assumir família/produto.
- Reflexo de presença ("tem alguém aí?") confirma presença em 1 linha antes de qualquer outra rota.
- 30/30 testes lógicos passaram. Detalhes em Registro #32 do changelog.
- ⏳ Pendente: rodar bateria fixa (19 cenários) em sandbox real para arquivar evidência.

### Frente C — Endurecimento Rodada 2 ✅ APLICADA (2026-05-23)
- TPR fallback: regex de preço cobre superlativos ("mais em conta", "compensa", "vale a pena", "tem promo/desconto", "sai por quanto").
- TPR fallback: emite `intent_bucket` determinístico (`social` | `commercial_policy` | `catalog_question` | `open_discovery` | `product_question`) mesmo sem LLM.
- search_products: quando `intent_bucket === "catalog_question"` e cliente não mencionou família nova, ignora `family_focus` e devolve vitrine ampla.
- Caminhos anteriores (Catalog Probe Reg #2.8, enforceFamilyBaseFirst Onda 18 Fase A, filtro estrito) preservados como fallback.
- Type-check e deploy do `ai-support-chat` concluídos.
- ⏳ Pendente: bateria fixa (19 cenários) + cenários novos da Frente C em sandbox real antes da Frente D.
- Detalhes em Registro #33 do changelog.

### Próximo — Frente D (Ficha institucional do tenant)
Consolida dados institucionais (cobertura, horário, pagamento, cupom, garantia, prova social) numa ficha por tenant injetada apenas em buckets `institutional` / `commercial_policy` / `objection`. Defaults conservadores: "não inventar, oferece humano".
