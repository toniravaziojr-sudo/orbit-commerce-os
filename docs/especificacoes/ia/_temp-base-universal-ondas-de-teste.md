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

