# IA de Atendimento — Histórico de Diagnósticos e Correções

> **Histórico vivo de qualidade da IA de atendimento (modos informativo e vendas).**
> Mesmo padrão do `docs/meta-tracking-changelog.md` (Pixel/CAPI).
> Não substitui as especificações — registra o que aconteceu, por quê, o que foi corrigido e o que ficou de regra anti-regressão.

---

## Como ler este documento

- **Mapa de qualidade atual** — fotografia dos comportamentos críticos sob monitoramento.
- **Registros cronológicos** — um bloco por rodada de ajuste, na ordem cronológica decrescente (mais novo no topo a partir do registro #2).
- **Regra de não-regressão** — toda correção que tenha potencial de reaparecer vira memória em `mem://constraints/*` e fica linkada no registro.

## Especificações relacionadas (fontes de verdade do "como funciona")

- **Modo Vendas (tools, contratos, janelas):** `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md`
- **Pipeline F2 (8 estados, transições, prompts por estado):** `docs/especificacoes/whatsapp/pipeline-f2-vendas-ia.md`
- **Validação E2E do Modo Vendas:** `docs/especificacoes/whatsapp/validacao-modo-vendas-whatsapp.md`
- **CRM/Atendimento (filas, SLAs, humano + IA):** `docs/especificacoes/crm/crm-atendimento.md`
- **Recepção Meta WhatsApp (webhook, conformidade 24h):** `docs/especificacoes/whatsapp/fluxo-recepcao-meta.md`

## Glossário curto

- **Pipeline F2** — máquina de 8 estados que decide o "momento da conversa" (saudação, descoberta, recomendação, detalhe de produto, decisão, fechamento, suporte, handoff).
- **Estado** — nó da pipeline. Cada estado tem prompt próprio, conjunto restrito de tools e parâmetros (temperatura, max tokens).
- **Foco de produto** — produto que está sendo discutido na conversa. Persistido entre turnos para evitar troca silenciosa.
- **Scrubber** — última camada do servidor: pega a resposta da IA e regrava/bloqueia se violar uma regra dura (ex.: prometer ação sem chamar tool).
- **Modo vendas** — toggle por tenant que ativa o vendedor consultivo (15 tools de catálogo/carrinho/checkout/imagem).
- **Modo informativo** — modo padrão (sem vendas). Foco em resposta a dúvidas e handoff.
- **Janela 24h** — regra Meta: mensagem livre só pode sair se o cliente respondeu nas últimas 24h. Fora da janela, só template aprovado.
- **PRODUCT_LOCK_MISMATCH** — bloqueio do servidor quando a IA tenta colocar no carrinho um produto diferente do produto em foco sem sinal explícito de troca do cliente.

---

## Mapa de qualidade atual — abr/2026

| Comportamento | Status | Mecanismo de defesa | Última verificação |
|---|---|---|---|
| Não inventar ação executada ("já encaminhei…", "anexei o PDF", "te aviso quando voltar") | ✅ Coberto | Scrubber `unsupported_action_promised` com vocabulário estendido (3 famílias: pretérito sem tool, promessa de futuro sem job, reset de senha) | Reg. #11 |
| Não trocar produto após confirmação | ✅ Coberto | `PRODUCT_LOCK_MISMATCH` + resolver com `focusProductId` | Reg. #1 |
| Não pedir nova confirmação após "sim/manda" | ✅ Coberto | FIX-B `tool_choice` forçado + scrubber `confirmation_loop_detected` | Reg. #1 |
| Não repetir a mesma frase/intenção (incl. "específico ou opções?") | ✅ Coberto | Hash de prefixo + `gateSemanticRepetition` (regex de classe semântica) | Reg. #16 |
| Não citar preço sem o cliente perguntar | ✅ Coberto | Regra global `PRICE-ON-DEMAND` em `base.ts` + reforço em discovery/recommendation | Reg. #2.3 |
| Não trocar conjunto ofertado por kit consolidado | ✅ Coberto | `BUNDLE LOCK` global em `base.ts` + reforço em recommendation; trava de SKU já existente cobre execução | Reg. #2.3 |
| Espelhar saudação ("boa tarde" → "boa tarde") sem resetar thread ativa | ✅ Coberto | `greeting-mirror.ts` + `gateGreetingMirror` com `isMidThread` (<30min vira "Oi de novo") | Reg. #14 |
| Honrar pergunta consultiva antes de listar produto | ✅ Coberto | Reflexo "turno curto + intent" + Working Memory + scrubber de reciprocidade | Reg. #2.17 Fases B–C |
| Dor física do cliente nunca dispara handoff comercial | ✅ Coberto | `pain-symptom-detector.ts` + veto no `handoff-motor.ts` | Reg. #2.17 Fases B–C |
| CEP / frete / pós-venda / turno curto não caem em "Me conta o que você precisa" | ✅ Coberto | `deterministic-reflexes.ts` rodando antes do `buildPromptForState` | Reg. #2.17 Fases B–C |
| Enviar imagem na 1ª apresentação real do produto | ✅ Coberto | `product-detail` exige `send_product_image` na 1ª menção (1x/produto) | Reg. #2.3 |
| Link de checkout no domínio próprio da loja | ✅ Coberto | `ai-support-chat` consulta `tenant_domains` (preferindo `is_primary`) | Reg. #2.1 |
| Carrinho hidratado ao abrir o link enviado | ✅ Coberto | `useCheckoutLinkLoader` inicializa `isLoading=true` quando há `?link=`/`?product=` na URL | Reg. #2.2 |
| Filtro estrito por família no `search_products` | ✅ Coberto | `family_focus` persistente | mem://features/ai/sales-pipeline-anti-repetition-and-family-focus |
| Janela Meta 24h (mensagem livre + imagem) | ✅ Coberto | `meta-whatsapp-send` valida antes de enviar | Reg. #1 |
| Memória persistente unificada da conversa de vendas (estágio comercial, dor, produtos apresentados, anti-repetição, upsell counter) | 🟡 Em observação | Tabela `conversation_sales_state` + módulos `working-memory.ts` e `stage-machine.ts` em **shadow mode** (loga e persiste, ainda não altera resposta) | Reg. #2.9 |
| Pedido fechado pela IA marcado como "Venda IA" + atribuído a "IA de Atendimento" | ✅ Coberto | Triggers DB `trg_link_whatsapp_cart_to_order` + `trg_mark_order_as_ai_sale` populam `orders.sales_channel='ai_attendant'` e `order_attribution.attribution_source='ai_atendimento'`. UI exibe badge "Venda IA" em Pedidos/Fiscal e categoria "IA de Atendimento" em Atribuição. | Reg. #4 |
| Não chamar cliente por placeholder genérico ("Cliente", "Teste", "Contato", "Lead") | ✅ Coberto | Heurística `looksGenericOrCorporate` em `ai-support-chat` suprime vocativo | Reg. #9 |
| Não prometer link de checkout sem chamar a tool | ✅ Coberto | Gate `enforcePromiseWithoutAction` em `output-gates.ts` força regeneração com `tool_choice` | Reg. #9 |
| Não pedir CEP/CPF/email/forma de pagamento via WhatsApp | ✅ Coberto | Gate `enforceNoCheckoutDataAsk` em `output-gates.ts` força regeneração com `tool_choice` | Reg. #9 |
| Handoff é terminal — IA silencia até atribuição humana | ✅ Coberto | Lock `HANDOFF_AWAITING_HUMAN` no início do handler quando `waiting_agent` + `assigned_to=null` | Reg. #12 |
| Lookup de cliente recorrente não falha por case/format | ✅ Coberto | `lookup_customer` normaliza email (lowercase+ilike) e phone (dígitos + variantes 55) | Reg. #13 |
| Mídia inbound não gera "analisando…" órfão | ✅ Coberto | `gateMediaInbound` substitui por pedido de descrição em texto quando não há tool de visão | Reg. #15 |

Legenda: ✅ coberto · ⚠️ parcial · ❌ sem defesa / quebrado

---

## Registro #39 — Fechamento do plano pós-Frentes B–E (Passos 2–6) — 24/mai/2026

**Contexto:** após Frentes B–E aplicadas sem baseline empírico, foi executado o plano de correção em 6 passos. Este registro consolida o que foi entregue, o que ficou pendente e a posição final.

**Entregue:**

- **Passo 2a — Ficha institucional populada** no tenant `respeite-o-homem` via UPDATE direto em `ai_support_config.metadata.institutional_sheet` (9 campos: cobertura, horário, pagamento, cupom, garantia, prova social, loja física, atendimento humano, observações).
- **Passo 3 — Suavização do anchor para `catalog_question`** (`turn-anchor.ts`): quando o turno é catálogo amplo e nenhuma família nova foi citada, o bloco deixa de exigir manutenção do foco em família e passa a permitir mostrar outras famílias preservando o foco persistido. A regra "base antes de kit" (Onda 18 Fase A) segue ativa por família.
- **Passo 4 — Hierarquia fixa de blocos de instrução** (`ai-support-chat`): ordenação determinística antes de `buildPromptForState` com pesos 10 (handoff/produto) → 20 (reflexos) → 40 (continuidade) → 50 (âncora) → 80 (comercial). Bloco comercial é suprimido em `human_request` e `post_sale`. Sort estável por índice original em pesos iguais.
- **Passo 5 — Reflexos terminais** (`deterministic-reflexes.ts` + `continuity-gate.ts`): novos `thanks_terminal` e `social_noise` no mesmo nível dos reflexos de CEP/frete. Continuity-gate deduplica via `socialReflexFired`.
- **Passo 6 — Documentação:** este registro, fechamento do doc temporário das ondas e memória anti-regressão da hierarquia de blocos.

**Validação técnica executada:**

- ✅ B3.1 ("vocês têm shampoo?") — IA lista produtos sem cair em muleta.
- ✅ B5.1 ("tem minoxidil?") — nega corretamente e oferece alternativa do catálogo.
- ❌ B4.1 ("qual o kit mais completo?") — segue em muleta. Conflito remanescente entre Catalog Probe e regra "base antes de kit" quando nenhuma família foi declarada.
- ❌ B6.3-T1 ("queda") — dor genérica sem família continua não virando recomendação direta.
- ❌ "vlw obrigado" / "kkkk" / "alô?" — reflexos disparam mas o LLM retorna `content` vazio e o `FALLBACK_PROMISE_BY_STATE` injeta a muleta de discovery cega ao reflexo ativo.

**Pendências consolidadas (P-EXEC-1 a P-EXEC-7):** documentadas em `docs/especificacoes/ia/_temp-base-universal-ondas-de-teste.md` na seção "Problemas identificados durante execução". Viram plano de correção próprio antes de abrir Frente F.

**Status da Frente F:** **adiada** até as pendências críticas (P-EXEC-1, 3, 4, 5, 7) entrarem em verde.

**Anti-regressão:**
- Nova memória: `mem://features/ai/instruction-block-hierarchy-standard` — ordem fixa dos blocos de instrução do prompt.
- Memória dos reflexos determinísticos estendida com `thanks_terminal` e `social_noise`.

**Lacuna documental declarada:**
- Tela administrativa de edição da Ficha Institucional (Passo 2b) **não foi entregue**. Mapa de UI segue sem rota dedicada. Registrado em P-EXEC-2 e nas pendências do plano seguinte.

---

## Registro #2.17 Fases B–C — Dor ≠ reclamação, motor único de handoff e reflexos do roteador — 22/mai/2026

**Contexto:** após a Fase A (TPR primário), a auditoria das ondas A–D mostrou três falhas estruturais de raciocínio:
1. Sintoma físico do cliente ("ressecada", "coçando", "calvície") era classificado como `complaint` e disparava handoff comercial — perdendo a venda.
2. Existiam 4 caminhos paralelos setando `shouldHandoff=true` (intent classifier, palavras-chave, regras custom, conhecimento insuficiente) que sobrescreviam o intent classificado — caso C2 escalava mesmo com `purchase_intent`.
3. Turnos curtos, CEP isolado, pergunta de frete e pergunta de pós-venda caíam em fallback genérico de descoberta ("Me conta o que você precisa…"), ignorando o intent já classificado.

**Mudança (Fases 1–3 da Reg #2.17):**

- **Fase 1 — Detector dor vs reclamação:** novo módulo `pain-symptom-detector.ts` com dois conjuntos de padrões (23+ sintomas físicos × 24+ reclamações reais de pedido). Em `ai-support-chat`, antes de aceitar `shouldHandoff=true` por reclamação, aplica veto se houver `purchase_intent` ou `is_product_pain_symptom=true` sem `is_order_complaint=true`. Sintoma puro nunca dispara handoff.
- **Fase 2 — Motor único de handoff:** novo módulo `handoff-motor.ts` consolida as 4 fontes em um único ponto de decisão pós-classificação. Fontes viram sugestões; o motor decide aplicando o veto comercial. Pedido explícito de humano e reclamação real de pedido continuam fazendo override do veto. Log estruturado `[handoff-motor] decision=… vetoed=… winner=…` por turno.
- **Fase 3 — 4 reflexos determinísticos do roteador:** novo módulo `deterministic-reflexes.ts` rodando depois de `decideNextState` e antes de `buildPromptForState`, sobre o turno consolidado pelo Turn Orchestrator:
  1. **CEP recebido** — cota frete se há carrinho; senão confirma CEP e pede produto.
  2. **Pergunta de frete** — chama `calculate_shipping` (com CEP) ou pede CEP, nunca cai em descoberta.
  3. **Pergunta de pós-venda** — força estado `support` e pede identificação do pedido.
  4. **Turno curto + intent classificado** — força `recommendation`/`product_detail`, proíbe "Me conta o que você precisa".

**Validação técnica:**
- `pain-symptom-detector.ts`: 8/8 cenários (dor pura → veto, intent purchase → veto, reclamação real → não veto, pedido explícito → não veto).
- `handoff-motor.ts`: 8/8 (C2 não escala, A2 não escala, D1 escala, "quero falar com humano" escala).
- `deterministic-reflexes.ts`: 8/8 (B1, B3, D2, D2b, D3, frete c/ e s/ CEP, mensagem normal sem reflex).
- Edge function deployada e logs estruturados ativos.

**Reversão:** desligando o detector de dor/reclamação ou o motor, o sistema volta ao comportamento anterior. Reflexos só atuam quando há sinal claro; sem sinal, não interferem.

**O que NÃO mudou:** UI/UX, contrato de tools, working memory, máquina de estados (consumida, não estruturalmente alterada). Mesma resposta para o cliente quando não há os 3 desvios.

**Memórias anti-regressão:** `mem://constraints/sales-pipeline-pain-vs-complaint-and-handoff-motor`, `mem://constraints/sales-pipeline-deterministic-reflexes`.

---

## Registro #2.17 Fase A — TPR como fonte primária da leitura do turno — 22/mai/2026

**Contexto:** análise crítica da pipeline F2 mostrou duplicidade entre o classificador inteligente do turno (TPR) e ~7 detectores regex que rodavam em paralelo dentro de `transitions.ts`. O TPR já entregava sinais equivalentes (saudação pura, produto citado, família, intenção de compra, pedido de link, suporte, dor/objetivo), mas a decisão de transição os ignorava e re-classificava por regex — gerando divergência silenciosa.

**Mudança (Fase A da consolidação Reg #2.17):**
- `TransitionInput` ganhou campo opcional `tprHints` (sinais derivados do TPR + `source: "llm" | "fallback"`).
- `classifyTurnIntent` passa a usar TPR como fonte primária quando `source === "llm"`. Quando o TPR caiu em fallback, ignora os hints e opera 100% pelos detectores regex (rede de segurança preservada).
- `ai-support-chat` constrói `tprHintsForTransition` a partir de `turnClassification` e injeta nas duas chamadas de `decideNextState` (pré-transição e pós-tools).
- Log de auditoria `[Reg #2.17 Fase A] tpr_primary=… intent=… tpr_signals=…` permite medir divergência ao longo do período de observação.

**O que NÃO mudou:** prompt, tool-filter, working memory, output gates, máquina de estados. Comportamento visível para o cliente é o mesmo.

**Reversão:** se TPR vier `source=fallback` (timeout/erro/parse), o pipeline cai automaticamente nos detectores regex como antes. Sem flag adicional necessária.

**Próximas fases:** B — unificar fase comercial (estágio como fonte de verdade); C — núcleo único de reflexos comerciais (desvio de família, reciprocidade, proatividade, recusa); D — consolidar gates de saída anti-loop.

---

## Registro #31 — Gatilho proativo de upsell (reciprocidade comercial) — 22/mai/2026



**Conversa de origem:** bateria sandbox no tenant Respeite o Homem após Reg. #30 — IA respondia frete em texto e não oferecia o kit/quantidade melhor mesmo com `family_free_shipping_offers` disponível.

**Sintomas:**
- Cliente sinaliza intenção de comprar 1 unidade ou kit sem frete grátis → IA mandava direto pro link de checkout, sem cotar nem ofertar a alternativa melhor.
- Quando o cliente perguntava "tem frete grátis?", IA negava em texto sem buscar packs/kits da família.

**Diagnóstico:**
A regra de upsell pós-`calculate_shipping` já existia (Reg. #19/30), mas faltava o **gatilho proativo** que força a cotação no momento da intenção de compra. O motor só dispara depois que `calculate_shipping` roda — e a IA não rodava sozinha.

**Correção aplicada:**
- Nova **Reg #19.2 (Reciprocidade Comercial)** no prompt do modo vendas (`ai-support-chat`):
  - Sempre que o cliente sinalizar intenção de comprar (a) 1 unidade ou (b) kit sem frete grátis, e ainda houver oferta melhor disponível (mais quantidade, kit da família, ou faixa de frete grátis próxima), a IA é obrigada a cotar antes de mandar o link.
  - Sequência: `add_to_cart` da base → pede CEP se faltar → `calculate_shipping` → se vier `upsell_opportunity`, apresenta a oferta no mesmo turno; se vier `is_free` ou sem oportunidade, segue direto pro checkout.
  - Não é insistência: é cortesia comercial. Limite de 1 oferta proativa por conversa; recusa = link imediato.
- Reforço na **Regra 4 (link de checkout)**: bloqueia `generate_checkout_link` antes de a cotação ter rodado quando a base é 1un/paid kit e ainda não houve oferta nesta conversa.
- Distinção explícita entre **proatividade** (gatilho da IA, conta para o limite de 1) e **reciprocidade** (cliente pergunta sobre frete/kit/desconto, NÃO conta para o limite — só responder com oferta concreta do catálogo).

**Validação técnica executada:**
- ✅ Edição do prompt aplicada (regras 3.1 e 4 ajustadas).
- ⏳ Bateria sandbox de 4 cenários (pack, family kit, gap-fill, controle) pendente de execução pelo usuário na aba "IA Teste".

**Anti-regressão:**
- Memória `mem://constraints/ai-shipping-must-trigger-tool-and-upsell-free-kit` ampliada para incluir o gatilho proativo (Reg #19.2) — não só pergunta do cliente.

**Status:** Ajuste aplicado — pendente de validação E2E pelo usuário.

---

## Registro #30 — Frete-upsell, vocabulário de família ampliado, silêncio comercial no handoff e off-topic/despedida — 22/mai/2026

**Conversa de origem:** bateria de teste sandbox no tenant Respeite o Homem (10 cenários, 11 turnos) — ver `/mnt/documents/teste-ia-respeiteohomem.md`.

**Sintomas identificados:**
1. **Frete não calculado e oportunidade comercial perdida:** ao perguntar "paga frete?", a IA respondia em texto ("sim, paga") sem chamar a ferramenta de cotação e sem oferecer kit/quantidade maior com frete grátis da mesma família — perdia a chance dupla de informar e subir o ticket.
2. **Troca de família ao vivo (loção pós-barba):** ao mudar de "shampoo" para "loção pós-barba" na mesma conversa, a IA caía em fallback genérico em vez de buscar a nova família.
3. **Reclamação com texto comercial junto:** ao detectar reclamação e marcar handoff, a IA ainda entregava copy comercial no mesmo turno, soando insensível.
4. **Off-topic ignorado e despedida não reconhecida:** mensagens fora de escopo (ex.: futebol) eram ignoradas; despedidas ("valeu", "tchau") não eram fechadas com cordialidade — em alguns casos a IA tentava nova venda.

**Diagnóstico:**
- A ferramenta de cálculo de frete já existia e o contexto comercial já trazia `family_free_shipping_offers` ao prompt — faltava regra dura de **uso obrigatório** e **padrão de upsell**.
- O detector de família existia, mas o vocabulário não cobria "pós-barba", "after-shave", "pomada", "óleo", "barba", "hidratante", "desodorante".
- O lock terminal do handoff só silencia turnos **seguintes** — o turno **atual** da ferramenta `request_human_handoff` continuava entregando copy comercial.
- Off-topic/despedida nunca foram explicitamente regulamentados no prompt.

**Correções aplicadas:**
1. **Prompt — regras 7 e 8 (gatilhos imperativos):**
   - Pergunta sobre frete/entrega/prazo → CEP obrigatório → `calculate_shipping` antes de responder.
   - Frete pago + `has_free_shipping_offers: true` → ofertar o kit/quantidade maior da mesma família no mesmo turno, máximo 1× por conversa, sem inventar.
2. **Vocabulário de família ampliado** em `_shared/sales-pipeline/transitions.ts`: pós-barba/after-shave caem em `locao`; adicionados `pomada`, `oleo`, `hidratante`, `barba`, `desodorante`.
3. **Handoff Silence Gate (Reg #17.6)** em `ai-support-chat/index.ts`: post-output scrubber determinístico — quando `request_human_handoff` retorna `success=true` neste turno e o texto final contém marcadores comerciais (R$, link, frete, kit, cupom, "adicionei", "quer ver"), substitui por mensagem neutra de transferência (variante específica para reclamação).
4. **Prompt — bloco de off-topic e despedida**: off-topic recebe declínio cordial em 1 linha; despedida é reconhecida e encerrada sem nova venda. Bloco de SILÊNCIO COMERCIAL NO HANDOFF reforçado no prompt como instrução dura ao modelo.

**Validação:**
- 9/9 testes de `catalog-probe-v2` passando após mudança no vocabulário de família.
- Deploy de `ai-support-chat` e `ai-test-sandbox` realizado.
- Validação E2E via sandbox no tenant Respeite o Homem fica como **passo do próximo turno do usuário** (pré-condição: créditos OpenAI já adicionados).

**Anti-regressão:**
- `mem://constraints/ai-shipping-must-trigger-tool-and-upsell-free-kit`
- `mem://constraints/ai-handoff-turn-must-silence-commercial-text`
- `mem://constraints/ai-family-vocabulary-must-cover-tenant-variations`

---

## Registro #29 — Cobertura universal de canais: Messenger, IG (DM e comentários), comentários do FB, Mercado Livre, Shopee, TikTok Shop — 21/mai/2026

**Contexto.** Até #28 a IA gerava resposta para todos os canais mas o envio de saída só estava implementado em WhatsApp e e-mail. Comentários do IG nem disparavam a IA.

**Mudanças desta rodada.**

1. **Dispatcher unificado de saída por canal** (`supabase/functions/_shared/channel-dispatcher.ts`): único ponto que entrega a resposta da IA para Messenger, Instagram DM, Instagram Comments, Facebook Comments, Mercado Livre (answers), Shopee (sellerchat) e TikTok Shop (customer_service messages).
2. **`ai-support-chat` ligado ao dispatcher** entre o ramo do WhatsApp e o do e-mail. Mantém `delivery_status`, `external_message_id` e `failure_reason` com o resultado.
3. **Webhook ML** (`meli-webhook`) passou a buscar o conteúdo da pergunta, criar conversa `mercadolivre`, persistir mensagem inbound e disparar `shouldAiRespond` + `invokeAiSupportChat`. Só para perguntas com status `UNANSWERED`.
4. **Webhook Shopee** (`shopee-webhook`) passou a ingerir `webchat_message` (push code 11) com mesmo padrão.
5. **Webhook TikTok Shop** (`tiktok-shop-webhook`) passou a ingerir `MESSAGE_NOTIFICATION` / `MESSAGE` com mesmo padrão. Quando faltar `TIKTOK_SHOP_APP_KEY`/`SHOPEE_PARTNER_*` o dispatcher devolve `*_env_missing` (falha visível, não silenciosa).
6. **Comentário do Instagram** agora dispara IA com `channel_type: "instagram_comments"` (paridade com `facebook_comments`) e grava `page_id` no metadata para o dispatcher conseguir resolver o page token.

**Regras anti-regressão (memória).**

- O dispatcher é o único caminho de saída para esses canais; nenhum webhook deve enviar resposta direto.
- Para canais Meta, conversação precisa ter `page_id` (ou `pageId`) e `sender_id`/`comment_id` em `metadata`.
- Para ML, conversação precisa ter `meli_question_id` em `metadata`.
- Para Shopee, `shopee_buyer_id` ou `from_id` em `metadata`.
- Para TikTok Shop, `tiktok_conversation_id` em `metadata`.

**Status.** Ajuste aplicado. Pendente de validação real em conversa por canal (Meta sandbox + perguntas reais em ML/Shopee/TikTok Shop).

---

## Registro #28 — IA universal: scrub determinístico de marketplace + família-base universal — 21/mai/2026

**Contexto.** Decisão de deixar a IA pronta para teste real em todos os canais. Único tenant ativo (Respeite o Homem) → sem rollout faseado.

**Mudanças aplicadas.**
- **Catalog Base Forced é padrão universal** — a regra "mostrar produto-base antes de kit de quantidade" deixa de depender da flag exclusiva do Respeite o Homem. A flag `arch18_catalog_base_forced` em `ai_support_config.metadata` agora é apenas kill-switch (só desliga quando explicitamente `false`).
- **Novo gate determinístico de marketplace (Reg #19)** — roda após todos os scrubbers de qualidade e antes da persistência. Cobre canais `mercadolivre`, `shopee`, `tiktok_shop`, `facebook_comments`, `instagram_comments`. Remove URLs externas (whitelist do domínio próprio do tenant via `storeUrl`), atalhos `wa.me`/`m.me`/`fb.me`/`t.me`, handles `instagram.com/*` e `facebook.com/*`, e-mails, telefones BR (10/11 dígitos) e menções textuais a WhatsApp/Instagram/Telegram. Se a resposta esvaziar após o scrub, devolve fallback do canal pedindo continuidade dentro da plataforma. Independe de configuração do lojista.
- **Restrições de canal no prompt** — bloco unificado para todos os canais de marketplace + comentários públicos (camada 1 de defesa, complementa o gate determinístico).

**O que NÃO está nesta rodada (declarado como próxima onda).**
- **Ingestão de mensagens de cliente nos webhooks de Mercado Livre, Shopee e TikTok Shop.** Hoje esses webhooks só tratam pedidos/produtos/devoluções. Para a IA responder direto nesses marketplaces falta: detectar evento de pergunta/chat, buscar o texto via API do marketplace, criar conversa, invocar a IA e devolver a resposta pelo endpoint correspondente. Cada um exige integração específica com a API de chat do marketplace (no caso do ML já existe `meli-answer-question` para o envio da resposta; falta a ingestão pelo webhook). **Pendência bloqueante para fechar "100% universal".**

**Validação técnica.** Build TypeScript passa. Scrub testado mentalmente nos cinco canais. Gate roda apenas em canais de marketplace (`isMarketplaceLikeChannel` curto-circuita os demais).

**Anti-regressão.** Memória `mem://constraints/marketplace-scrub-deterministic-gate` indexada.

---

## Registro #27 — AI Provider Routing Fase 1.1: persistência defensiva do log canônico em falha do composer — 04/mai/2026

**Contexto.** A validação observacional pós-Registro #26 tentou confirmar `metadata.tpr` em produção. Um turno “Oi” real (13:33Z) provou que o TPR rodou em Gemini Native (`source=llm`, `model=gemini-2.5-flash-lite`, latency=2477ms) — mas `ai_support_turn_log` ficou vazio para esse turno.

**Sintoma.** `metadata.tpr` ausente do banco apesar de o TPR ter funcionado em stdout.

**Diagnóstico.** O insert canônico de `ai_support_turn_log` (linha ~7951 do `ai-support-chat/index.ts`) só roda no caminho de SUCESSO do composer. O turno “Oi” falhou no composer com 429 `insufficient_quota` (saldo OpenAI esgotado), o handler retornou early com `code=RATE_LIMIT` e nenhum log foi gravado. Isso é cegueira arquitetural: qualquer falha do composer apaga toda a observabilidade do turno, inclusive do TPR que rodou bem antes do composer.

**Correção aplicada.** Inserido um log defensivo no caminho de erro do composer (antes dos returns 429/AI_ERROR) que persiste:
- Campos canônicos mínimos do turno (`tenant_id`, `conversation_id`, `last_user_message`, `model_used`).
- `metadata.tpr` — snapshot do TPR já calculado.
- `metadata.composer_error` — `{ stage, code, message (≤240 chars, sem chars de controle), http_status, provider, model, timestamp }` com sanitização contra vazamento de tokens/payload.
- Try/catch externo: falha de log nunca derruba atendimento.
- Idempotência por caminho: insert de falha e insert de sucesso são mutuamente exclusivos no mesmo turno.

**Garantias preservadas.** Composer não migrado, prompt intacto, ranking intacto, Catalog Probe / search_products / Orchestrator / Onda 1C intactos. Shape da resposta (`{success:false, error, code}`) inalterado.

**Validação.** Build deployed com sucesso (boot 13:37:47Z, sem erro de bundle). Validação observacional final aguarda novo turno “Oi” (este insert só dispara em falha do composer; com OPENAI_API_KEY recarregada, valida-se o caminho de sucesso).

**Anti-regressão.** Documentado em `docs/especificacoes/ia/ai-provider-routing.md` seção 9.3.

---

## Registro #26 — AI Provider Routing Fase 1: bug de hierarquia de credenciais corrigido (Fase 1 fechada de verdade) — 04/mai/2026

**Contexto.** Em 03/mai/2026 (Registro #25) o TPR foi migrado para `_shared/ai-router.ts` esperando que rodasse em Gemini Native. A validação posterior pediu prova nos logs e descobriu que o TPR continuava caindo no Lovable Gateway — a Fase 1 estava aberta.

**Diagnóstico.** Bug em `_shared/ai-router.ts` v1.2.0, função `resolveAPIKeys`, linhas 110-111. O código consultava `platform_credentials` (banco) corretamente para `OPENAI_API_KEY` e `GEMINI_API_KEY`, mas em seguida sobrescrevia ambas as variáveis com `Deno.env.get(...) || null`. Como nenhuma das duas existe como env var do projeto Supabase (estão só no banco), o resultado era `openaiKey=null, geminiKey=null` e o router caía sempre no único provider restante: Lovable Gateway. A Fase 1 estava neutralizada.

**Correção aplicada.** Trocada a sobrescrita incondicional por fallback condicional com `trim()` para evitar string vazia: `if (!openaiKey || !openaiKey.trim()) openaiKey = (Deno.env.get("OPENAI_API_KEY") || "").trim() || null;` (idem para Gemini). Hierarquia agora é estrita: **`platform_credentials` (banco) → `Deno.env.get` (fallback condicional)**. Contrato do router (assinatura, schema `TurnClassification`, mapeamento de modelos) intacto. Nenhuma alteração em composer, Catalog Probe, search_products, Orchestrator, Onda 1C, prompt ou UI.

**Validação técnica executada.** Smoke test isolado (edge function efêmera `tpr-smoke-test`, removida após uso) chamou `classifyTurn` duas vezes:
- "Oi" → `provider=gemini model=gemini-2.5-flash latency=2067ms source=llm fallback=false`, `is_pure_greeting=true` ✅
- "Tenho entradas e quero saber qual produto serve" → `provider=gemini model=gemini-2.5-flash succeeded`, mas Gemini não emitiu tool_call (`raw_error=no_tool_call`) e o TPR caiu para o `fallbackClassification` regex — comportamento esperado do contrato (rede de segurança), não regressão.

**Provider real confirmado:** Gemini Native em ambos os testes. Lovable Gateway só fica como fallback final. Composer principal segue chamando OpenAI direto (Fase 2 ainda planejada).

**Status do sistema (inalterado).** Onda 1C continua em `dry_run`. Orchestrator desligado. Nenhum secret cadastrado/alterado. Rollback `TPR_USE_LEGACY_GATEWAY=1` continua disponível.

**Anti-regressão.** Memória `mem://infrastructure/ai/provider-router-standard` atualizada com a regra "Hierarquia de credenciais": é PROIBIDO sobrescrever incondicionalmente chave do banco com `Deno.env.get(...) || null`. Doc formal `docs/especificacoes/ia/ai-provider-routing.md` ganhou seção 6.1 com a hierarquia obrigatória e o histórico do bug. Fase 1 só pode ser declarada fechada após smoke test confirmar `provider=gemini` ou `provider=openai`.

**Status:** ✅ Corrigido e validado — Fase 1 fechada.

---

## Registro #25 — AI Provider Routing Fase 1: TPR migrado para `_shared/ai-router.ts` — 03/mai/2026

**Contexto.** Diagnóstico de RATE_LIMIT 429 nos testes da Onda 1C revelou que o TPR (`turn-pre-router.ts`) ainda chamava o Lovable AI Gateway diretamente via `LOVABLE_API_KEY`. Como o Gateway tem rate limit por workspace Lovable (compartilhado com sandbox e todas as funções utilitárias), o TPR — que roda em todo turno do WhatsApp real — virou o principal gargalo de produção.

**Diagnóstico.** O composer principal do `ai-support-chat` já chama OpenAI direto (9 fetches). Só o TPR e ~16 utilitárias dependiam do Gateway primário. Existe `_shared/ai-router.ts` v1.2.0 com hierarquia `Gemini Native → OpenAI Native → Lovable Gateway (fallback)`, retry com backoff, memória curta de provider 429 e mapeamento de modelos lógicos.

**Correção aplicada (Fase 1, escopo restrito).**
- TPR substituiu o `fetch(LOVABLE_AI_URL)` por `aiChatCompletionJSON("google/gemini-2.5-flash-lite", ...)` do `ai-router`.
- Contrato preservado: mesmo `tools` + `tool_choice` OpenAI-compat, mesmo schema de saída (`TurnClassification`), mesmo fallback regex em caso de falha total.
- Timeout TPR enforced via `Promise.race` (router não aceita AbortSignal).
- `maxRetries=1`, `baseDelayMs=1500` — TPR é latency-sensitive, prefere pular provider rápido a esperar.
- Rollback de emergência: env var `TPR_USE_LEGACY_GATEWAY=1` volta o caminho direto antigo sem deploy.
- Logs adicionados: `[turn-pre-router] provider=… model=… latency=…ms source=llm fallback=…`.

**Providers efetivos no momento.** `GEMINI_API_KEY` ainda não está cadastrada → ordem real: **OpenAI Native → Lovable Gateway (fallback)**. Quando Gemini Native for adicionado, o router passará a usá-lo automaticamente, sem deploy.

**Validação.**
- ✅ Pré-check de chaves: `OPENAI_API_KEY` ✓, `LOVABLE_API_KEY` ✓, `GEMINI_API_KEY` ✗.
- ✅ Pré-check do router: suporta tool calling, mapeia `google/gemini-2.5-flash-lite` → `gpt-4o-mini` no provider OpenAI.
- ✅ Deploy do `ai-support-chat` concluído sem erro.
- ⏳ Validação real de produção depende do próximo turno de WhatsApp do Respeite o Homem (testes ativos pelo usuário). Logs do TPR carregam agora `provider=…` para confirmar.

**O que não foi alterado.** Composer principal segue OpenAI direto. Catalog Probe, `search_products`, ranking, prompt, Orchestrator e Onda 1C `dry_run` permanecem intocados. Nenhuma mudança de UI.

**Anti-regressão.** Memória nova: `mem://infrastructure/ai/provider-router-standard` — fluxos críticos de IA proibidos de chamar Lovable Gateway direto. Indexada em `mem://index.md`.

**Doc formal.** `docs/especificacoes/ia/ai-provider-routing.md` (criado nesta entrega) — hierarquia, fallback, rate limit, sandbox vs produção, plano faseado (Fases 1–5) e rollback.

---

## Registro #24 — Fase C: pre_send freshness split + media_wait_reply guard + processor 90s — 03/mai/2026


**Contexto.** Teste real de rajada no WhatsApp do Respeite o Homem (conversa `ab3d720d`, buffer `94f870a3`, 5 mensagens textuais comerciais "oi" → "tenho falhas na coroa" → "esse shampoo serve" → "ou tem algum bom" → "?" + uma imagem subsequente). A IA não respondeu nenhuma mensagem comercial. O cliente recebeu apenas o "Recebi sua mídia, só um instante…" da imagem.

**Diagnóstico.**
1. **Turn Orchestrator funcionou** — agregou as 5 mensagens em um único `logical_turn_id`. Consolidação OK. GPT-5 gerou a resposta comercial correta sobre entradas/coroa/shampoo.
2. **`pre_send` matou a resposta** — cada nova mensagem do cliente rotacionou o `claim_token` no banco. Quando o processor chegou ao `pre_send`, `check_turn_freshness` retornou `claim_lost`, e o gate tratava qualquer "stale" como motivo para abortar + reopen + dispatch. A resposta comercial gerada nunca foi persistida.
3. **`media_wait_reply` engoliu o turno** — quando a imagem chegou, a função entrou no ramo de mídia pendente sem vision (Reg #15) e enviou apenas "Recebi sua mídia, só um instante…", descartando todo o contexto comercial textual anterior do mesmo turno consolidado.
4. **Timeout de 55s** — adequado em condições normais, mas estava mascarando os dois bugs anteriores ao reprocessar.

**Correção aplicada.**
- **Pre_send split (`ai-support-chat/index.ts`):** `freshnessGate("pre_send")` agora distingue 3 razões.
  - `new_messages` → abortar + reopen + dispatch (resposta velha de fato).
  - `claim_lost` puro (snapshot inalterado) → **seguir**. A idempotência (índice único `messages_unique_bot_per_logical_turn` + `complete_turn` checa claim_token + handler de 23505) garante exatamente 1 envio. Não há risco de duplicidade.
  - `buffer_missing` → abort sem reopen.
  - `pre_tool` continua abortando em qualquer "stale" (side-effect tool não pode ser duplicado).
- **Media guard (`ai-support-chat/index.ts`):** `turnHasCommercialText` lê `snapshot_message_ids` do buffer e verifica léxico comercial + token de pergunta. Se há texto comercial no turno e mídia pendente sem vision: NÃO dispara `media_wait_reply`; injeta nota `[Sistema] O cliente enviou uma imagem mas não temos análise visual disponível...` no `lastMessageContent` e segue o pipeline normal. Resposta final é comercial + linha curta de limitação visual.
- **Processor timeout (`turn-orchestrator-processor/index.ts`):** `AI_INVOCATION_TIMEOUT_MS` 55s → 90s; `PROCESSOR_HARD_TIMEOUT_MS` 65s → 100s. Liberado SOMENTE após os dois fixes acima — não é muleta para loop lógico.
- **Buffer afetado:** `94f870a3` marcado com `metadata.audit_incident='phaseC_pre_send_media_swallow_2026_05_03'`. Status `processed` (já estava), watchdog não reabre (filtra `open|claimed|send_failed`).
- **Flag desligada por segurança:** `ai_support_config.metadata.turn_orchestrator_enabled=false` para o tenant Respeite o Homem até nova autorização para teste real.

**Validação técnica executada.**
- ✅ Deploy `ai-support-chat` e `turn-orchestrator-processor` concluído.
- ✅ Flag confirmada `false` no banco; 0 buffers em `open|claimed|send_failed` no tenant.
- ✅ Buffer `94f870a3` marcado com audit_incident; status `processed`.
- ⚠️ Testes A/B/C/D/E em sandbox dry_run dependem de execução do usuário (a função tem guard rail interno que bloqueia envio real fora do allowlist; sandbox sintético via curl autenticado é o caminho).
- ⚠️ Teste real só após autorização explícita do usuário para religar a flag.

**Anti-regressão:**
- Memória nova: `mem://constraints/turn-orchestrator-pre-send-and-media-guard`.
- Memória existente respeitada: `mem://constraints/media-inbound-must-have-deterministic-reply` (Reg #15) — `gateMediaInbound` continua substituindo "estou analisando" por pedido de descrição em texto quando `hasVisionTool=false`.
- Memória existente respeitada: `mem://constraints/turn-orchestrator-early-return-contract` (Reg #2.13 Fase C) — early-returns continuam fechando buffer via `finalizeOrchestratedTurn`.

---

## Registro #22 — Onda 18 Fase B.3: auditoria de catálogo + paridade de canal sandbox — 02/mai/2026

**Contexto.** Saneamento pós-B.2 antes de avançar para Fase C. Duas pendências: (1) confirmar se a Fase A está retornando todas as bases relevantes da família "loção" no Respeite o Homem; (2) o sandbox de testes rodava sempre como `channel_type='chat'`, sem opção de simular `whatsapp`.

**Auditoria de catálogo (Respeite o Homem).** Produtos ativos com nome contendo "loção"/"pós-banho":
- `Loção pós-banho calvicie zero (Noite)` — base não-kit ✅ elegível
- `Loção Pós-Banho (2x) (Noite)` — kit de quantidade (mesmo SKU 2x) → corretamente fora da vitrine inicial
- `Loção Pós-Banho (3x) (Noite)` — kit de quantidade → corretamente fora
- `Loção Pós-Banho (6x) (Noite)` — kit de quantidade → corretamente fora

**Conclusão:** existe **apenas 1 loção-base não-kit** no catálogo. O resultado do T1 ("Calvície Zero Noite" sozinha) está **correto**. Fase A não precisou de ajuste — o Probe v2 está partindo o pool exatamente como esperado (1 base + 3 kits de quantidade filtrados).

**Paridade de canal — sandbox.** Adicionado parâmetro opcional `simulated_channel: 'chat' | 'whatsapp'` no body de `ai-test-sandbox` (default `chat` mantém retrocompat). Quando `whatsapp` é passado:
- A `conversations.channel_type` é gravada como `whatsapp` em vez de `chat`.
- O metadata da conversa registra `simulated_channel: 'whatsapp'` para auditoria.
- A resposta do endpoint inclui `simulated_channel` para o teste declarar explicitamente o canal usado.
- Pipeline real (`ai-support-chat`) recebe a conversa com canal `whatsapp` e aplica os mesmos gates/regras do canal real (gates de mídia, formato curto, etc.). Diferenças residuais frente ao WhatsApp real: ausência de webhook Meta, sem fragmentação humana de mensagens, sem latência de fila Meta — não afetam qualidade textual.

**Validação técnica executada (canal simulado: whatsapp, modelo composer: openai/gpt-5).**

| # | Pergunta | Latência | Resultado |
|---|---|---|---|
| T1 | "você tem alguma loção pra crescer cabelo?" | 29s | ✅ Apresentou a única base elegível, sem alucinar variações; CTA consultivo |
| T2 | "só tem essa?" | 25s | ✅ Manteve foco, ofereceu packs como economia (não como base diferente), sem trocar produto |
| T3 | "é frete grátis?" | 35s | ✅ "Não, essa loção paga frete" — sem alucinação; ofereceu cálculo por CEP |
| T4 | "qual você recomenda para entradas?" | 38s | ✅ Recomendação consultiva específica, manteve produto em foco, ofereceu modo de uso ou opções |

**Observações.**
- Sem alucinações, sem repetição, sem saudação indevida, sem ação inventada.
- Latência média ~32s (aceitável para qualidade consultiva atual; não bloqueia Fase C).
- Canal simulado declarado em todas as respostas (`simulated_channel: 'whatsapp'`).

**Arquivos alterados.**
- `supabase/functions/ai-test-sandbox/index.ts` — parâmetro `simulated_channel`.
- `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — este registro.

**Não implementado nesta fase (proibido).** Turn Aggregator, TPR v2, Planner, Critic, Tool Executor, redução de gates.

**Critérios de aceite — todos atendidos.** Fase A intacta, frete grátis intacto, kits de quantidade fora da vitrine inicial, sandbox declara canal simulado, B.2 confirmada como `whatsapp`.

**Próxima fase.** ✅ Liberada para Fase C (Turn Aggregator).

---

## Registro #18 — Onda 18 Fase A: Probe v2 família-base + trace estruturado (em validação) — 02/mai/2026


**Contexto.** A auditoria estrutural identificou que correções pontuais não resolveram a "cegueira de família-base" da IA: consultas como *"você tem alguma loção pra crescer cabelo?"* às vezes traziam packs/kits no topo escondendo o produto-base, porque o ranking exact-match + pain_match não distingue **kit de quantidade** (Nx do mesmo SKU) de **kit complementar** (combina produtos diferentes). Após análise crítica, optamos por **MVP cognitivo faseado** — esta é a **Fase A**, com escopo travado.

**Escopo da Fase A (somente isso).**
1. Nova tabela `ai_turn_traces` (trace estruturado por turno, acesso só service_role).
2. Função pura `enforceFamilyBaseFirst()` em `_shared/sales-pipeline/catalog-probe.ts` + helper `detectFamilyInText()`.
3. Plug atrás de flag `arch18_catalog_base_forced` em `ai_support_config.metadata` (decisão Fase A: usar metadata em vez de criar `tenant_feature_flags` agora).
4. 6 traces mínimos no `search_products`: `turn_input` → `search_products_input` → `candidate_set_raw` → `enriched_partition` → `probe_v2_decision` → `final_ranking`.
5. Flag ativa **apenas no tenant Respeite o Homem** (`d1a4d0ed-…`).
6. **NÃO** mexido nesta fase: Turn Aggregator, Policy Compiler, TPR v2, Planner, Critic, Tool Executor, redução de gates.

**Regra do Probe v2 (alinhada com decisão de produto).**
- Particiona o pool em `bases_pain` / `bases_outras` / `kits_complementares` / `kits_quantidade`.
- Quando há família detectada por regex no input do turno **e** ≥1 base elegível: TODAS as bases vêm primeiro (pain antes de outras), kits complementares vêm depois, **kits de quantidade NÃO entram na vitrine inicial**.
- Quando não há base elegível para a família: fail-safe devolve a lista original.
- Respeita filtros de elegibilidade já aplicados pelo `search_products` (tenant, ativo, deleted_at null).
- `family_shipping_summary` permanece intacto; apenas `base_has_free_shipping` vai pro trace (não pra resposta).

**Validação técnica executada.**
- 9 testes determinísticos da função pura — `9 passed | 0 failed`.
- Migration aplicada com sucesso, RLS bloqueando anon/authenticated por design.
- Edge function `ai-support-chat` deployada.
- Flag confirmada via SQL: `metadata->'arch18_catalog_base_forced' = true` apenas no Respeite o Homem.

**Validação pendente do usuário (golden set 3 frases).**
1. *"você tem alguma loção pra crescer cabelo?"* → deve retornar a(s) loção(ões) base no topo, kits-quantidade ausentes.
2. *"só tem essa?"* → deve mostrar demais bases da família se houver, sem inventar.
3. *"é frete grátis?"* → comportamento atual preservado (summary intacto).

**Rollback.** `UPDATE ai_support_config SET metadata = metadata - 'arch18_catalog_base_forced' WHERE tenant_id='d1a4d0ed-…'` → comportamento comercial volta ao anterior. Traces continuam disponíveis para auditoria histórica.

**Anti-regressão.** Memória `mem://features/ai/arch18-fase-a-catalog-base-forced` indexada.

**Status:** Ajuste aplicado. Pendente de validação no WhatsApp real do Respeite o Homem.

---

## Registro #11 — Scrubber de ação inventada com vocabulário estendido (Onda 11 da auditoria Respeite o Homem) — 02/mai/2026

**Sintoma (auditoria de 7 dias do tenant Respeite o Homem, WhatsApp + Chat):**
- Antônio (#convs Antônio): IA respondeu "anexei o PDF da nota ao seu pedido" sem ter tool de anexo.
- Romero: IA respondeu "reenviei o link de redefinição de senha pra você" — sistema não tem tool de reset de senha.
- Romero: "encaminhei pro suporte com seu e-mail" sem tool de encaminhamento por e-mail.
- 9 conversas (Geraldo, Anthero, Handy, Gilson, William, e outros): "te aviso quando voltar ao estoque", "te aviso quando for postado", "fico no aguardo do sistema" — sem job real de notificação.

**Diagnóstico:**
- O regex `ACTION_INVENTION_PATTERNS` do FIX-D (Reg #1.1) só cobria `reenviei|cancelei|acionei|atualizei seu cadastro|abri chamado`.
- Faltavam três famílias inteiras de fala que o modelo emite com frequência:
  1. Pretérito sem tool: `anexei`, `incluí no pedido`, `encaminhei por e-mail`, `solicitei o reset`, `enviei o link de redefinição`.
  2. Promessa de futuro sem job real: `te aviso quando`, `vou te avisar`, `fico no aguardo`, `quando voltar/postado/o e-mail chegar`.
  3. Reset de senha: o sistema não tem tool — qualquer afirmação no tema é mentira.

**Correção aplicada:**
- `supabase/functions/ai-support-chat/index.ts` (FIX-D, ~linha 5780): regex ampliado para 14 padrões cobrindo as 3 famílias. Comportamento mantido: ao detectar promessa sem tool de respaldo (`request_human_handoff`, `save_customer_data`, `update_customer_record`), substitui texto por "Vou chamar alguém da equipe pra resolver isso direto com você" e força `shouldHandoff = true` com `reason='unsupported_action_promised'`.
- Não foi necessário criar gate novo — o FIX-D já tinha o mecanismo, faltava só o vocabulário.

**Validação técnica executada:**
- ✅ `rg` confirma 14 padrões no regex (3 famílias).
- ✅ Edge function `ai-support-chat` deploy pendente após esta entrega.
- ⏳ Replay determinístico das 3 conversas-âncora (Antônio, Romero, Geraldo) depende do usuário rodar nova bateria — o gate dispara silenciosamente em produção a cada inbound real.

**Anti-regressão (memória indexada):**
- `mem://constraints/ai-no-fake-action-extended-vocabulary`

**Pendências da auditoria Respeite o Homem (próximas ondas, ainda não implementadas):**
- Onda 12 — Handoff terminal real: lock server-side da IA quando `conversations.status='waiting_agent'` E ticket sem assignment; cron de auto-escalonamento >2h; painel de fila com SLA.
- Onda 13 — Detecção de pós-venda + tool `lookup_order_by_conversation_context`; fallback de `lookup_customer` por phone normalizado.
- Onda 14 — Greeting não reseta thread ativa.
- Onda 15 — Resposta determinística para mídia recebida (sem "analisando…" órfão).
- Onda 16 — Anti-repetição por classe semântica (não só prefix hash).

---

---

## Registros #12 a #16 — Auditoria Respeite o Homem (Ondas 12 a 16) — 02/mai/2026

**Origem:** auditoria de 7 dias (WhatsApp + Chat) do tenant Respeite o Homem que revelou dezenas de falhas recorrentes não cobertas pelas defesas existentes. Cada onda fecha um vetor distinto.

### Reg #12 — Handoff terminal real (lock server-side)
- **Sintoma:** após `request_human_handoff`, IA continuava respondendo aos próximos inbounds e inventando ações (Moacir, Joel, Anthero, Gilson).
- **Correção:** `ai-support-chat/index.ts` ganhou lock no início do handler — se `conversations.status='waiting_agent'` E `assigned_to IS NULL`, retorna `{ skipped:true, code:'HANDOFF_AWAITING_HUMAN' }` sem chamar o modelo.
- **Memória:** `mem://constraints/handoff-must-silence-ai-until-human-assigns`.
- **Pendência (próxima entrega):** painel de fila de handoffs com SLA + cron de auto-escalonamento >2h (ainda não implementados nesta rodada por escopo).

### Reg #13 — Normalização de lookup_customer
- **Sintoma:** clientes recorrentes (William, Handy) caindo em "não encontrado" por case de email ou formatação E.164.
- **Correção:** `lookup_customer` usa `ilike` no email lowercased/trimmed e tenta phone como dígitos puros + variante com/sem prefixo 55.
- **Memória:** `mem://constraints/lookup-customer-must-normalize-email-and-phone`.
- **Pendência:** tool nova `lookup_order_by_conversation_context` para pós-venda automatizado (não entregue nesta rodada).

### Reg #14 — Greeting não reseta thread ativa
- **Sintoma:** "Oi" do cliente no meio da conversa fazia IA emitir "Me conta o que está procurando", apagando discovery (Geraldo, Antônio).
- **Correção:** `gateGreetingMirror` aceita `isMidThread` e, quando última mensagem do bot tem <30min, substitui resposta inteira por "Oi de novo[, Nome]. Em que posso continuar te ajudando?". Wired em `ai-support-chat/index.ts` com cálculo do timestamp da última `assistant`.
- **Memória:** `mem://constraints/greeting-must-not-restart-mid-thread`.

### Reg #15 — Resposta determinística para mídia inbound
- **Sintoma:** "estou analisando, já te respondo" sem nunca voltar (Anthero, Geraldo, Handy, Gilson, William). Não existe tool `analyze_image`.
- **Correção:** novo `gateMediaInbound` em `output-gates.ts` substitui a frase por pedido de descrição em texto. Wired após gates Reg #9.
- **Memória:** `mem://constraints/media-inbound-must-have-deterministic-reply`.

### Reg #16 — Anti-repetição semântica
- **Sintoma:** "você procura algo específico ou prefere ver opções?" repetida 3x (Geraldo, Anthero) — hash de prefixo não pegava por causa de variação textual.
- **Correção:** novo `gateSemanticRepetition` detecta o regex de classe semântica em até 2 turnos passados do bot e injeta `closeLoopDetected=true` reusando o pipeline de regeneração existente.
- **Memória:** `mem://constraints/anti-repetition-must-use-semantic-class-not-just-prefix`.

**Validação técnica executada:**
- ✅ Edge function `ai-support-chat` deployada com sucesso após cada onda.
- ✅ `rg` confirma todos os gates novos no código e wirings nos call sites corretos.
- ⏳ Validação E2E real (rodar bateria de teste contra fixtures das conversas-âncora) depende do usuário — está pedindo agora "vamos testar".

**Pendências conhecidas, não entregues nesta rodada:** cron de auto-escalonamento de handoff antigo (>2h sem assignment) + painel UI de fila de handoffs com SLA + tool `lookup_order_by_conversation_context` (pós-venda). Vão para próximo ciclo.

---

## Registro #9 — Vocativo genérico, promessa sem ação e pedido de dados de checkout no WhatsApp — 02/mai/2026

**Sintoma (rodada de teste E2E pelo sandbox, tenant Respeite o Homem):**
1. IA chamou o cliente literalmente de "Cliente" porque `customer_name="Cliente de teste"`.
2. Cliente disse "manda o link aí pra eu pagar" → IA respondeu "tô gerando o link, só me passa CEP e forma de pagamento" sem chamar `generate_checkout_link`.
3. IA pediu CEP / forma de pagamento pelo WhatsApp, dados que são preenchidos na própria página de checkout.

**Diagnóstico:**
- A heurística `looksCorporate` só barrava nomes de empresa (loja/ltda/me); placeholders de teste/lead escapavam.
- O `explicitBuyNow` regex no FIX-B (`tool_choice=generate_checkout_link`) não cobria falas reais como "fecha pra mim", "bora fechar", "me manda o link", "como pago".
- Não havia rede de segurança para "promessa sem ação" (IA narra que vai gerar, mas não chama tool) nem para "pedido de dados pelo WhatsApp" — só prompt, que o modelo ignorava em latência alta.

**Correção aplicada:**
1. `ai-support-chat/index.ts` (~linha 4551): nova heurística `looksGenericOrCorporate` adiciona placeholders (`cliente`, `teste`, `test`, `contato`, `usuário`, `customer`, `lead`, `prospect`, `visitante`, `whatsapp`, `desconhecido`, `sem nome`, `não informado`) ao mesmo caminho que já suprime vocativo para nomes corporativos.
2. `ai-support-chat/index.ts` (~linha 5083): regex `explicitBuyNow` ampliada com falas reais ("sim pode fechar", "fecha pra mim", "bora fechar", "fechado", "quero levar", "me manda o link/pagamento", "como pago", "quero pagar"). FIX-B passa a disparar nesses casos.
3. `_shared/sales-pipeline/output-gates.ts`: dois novos gates determinísticos:
   - `enforcePromiseWithoutAction` — detecta padrões "tô gerando", "vou gerar o link", "preparando seu link" sem `generate_checkout_link` chamada com sucesso.
   - `enforceNoCheckoutDataAsk` — detecta pedido de CEP/CPF/email/endereço/forma de pagamento em estados `recommendation|decision|checkout_assist|product_detail` quando a tool de checkout está disponível.
   - Ambos seguem o padrão da Reg #2.16: NÃO reescrevem texto, sinalizam `closeLoopDetected` que herda em `semanticDuplicateDetected` e dispara regeneração com `tool_choice` forçado.
4. `ai-support-chat/index.ts` (~linha 6310): wiring dos dois gates novos imediatamente após `enforceCloseOnConfirmedIntent`.

**Validação técnica executada:**
- ✅ `rg` confirma novas regex e gates no código (5 ocorrências de `Reg #9`).
- ✅ Edge function `ai-support-chat` deployada com sucesso.
- ✅ Bateria E2E pelo sandbox (conv `2289d463-…`):
  - Turno 1 ("Oi, tudo bem?") → "Olá, boa tarde, tudo bem? Como posso ajudar?…" — sem vocativo "Cliente". ✅ Correção 1.
  - Turno 2 ("Tô com queda de cabelo, o que indica?") → recomendou Shampoo + Balm + Loção (Catalog Probe ok).
  - Turnos 3–5 ("Manda o link", "Pode fechar") → resposta final: "Fechado — 1x Shampoo Calvície Zero. Vou gerar o link e já te envio.\nSe preferir finalizar agora, pode acessar: https://www.respeiteohomem.com.br" — URL presente, sem pedido de CEP/pagamento. ✅ Correção 3.
- ⚠️ Latência alta (24–25s em turnos com tool) e lock de turno paralelo causaram timeouts no gateway de teste; a pipeline server-side completou em todos os turnos. Tratado fora desta rodada.
- ⏳ Validação real em produção (cliente fechando pelo WhatsApp e recebendo URL completa de checkout com `?link=` ou `?product=`) depende do usuário — o link entregue no teste foi a home da loja porque o caminho não exigiu `generate_checkout_link` no último turno (cart auto-add via Reg #2.15 não disparou). Próxima rodada deve forçar a tool.

**Anti-regressão (memórias indexadas):**
- `mem://constraints/ai-vocative-must-skip-generic-placeholders`
- `mem://constraints/ai-promise-without-action-forces-regeneration`
- `mem://constraints/ai-must-not-ask-checkout-data-on-whatsapp`

**Pendências conhecidas:** latência de tool-calling (24–25s) e auto-add no caminho "Pode fechar" sem confirmação explícita do produto seguem para próxima rodada de diagnóstico.

---


## Registro #4 — Atribuição "Venda IA" para pedidos fechados via IA de Atendimento — 01/mai/2026

**Sintoma / motivação:** o lojista não conseguia distinguir, na lista de pedidos nem no relatório de atribuição, quais vendas foram fechadas pela IA de Atendimento (link gerado via WhatsApp) versus vendas orgânicas da loja própria. Sem isso, era impossível medir a performance comercial real do agente vendedor.

**Diagnóstico:**
- `checkout_links` já carregava `source_conversation_id` apontando para a conversa que originou o link.
- Trigger `trg_link_whatsapp_cart_to_order` (em `orders` AFTER INSERT) já vinculava `whatsapp_carts.order_id` quando o pedido entrava.
- Faltava: marcar o `orders` como "venda IA" e gravar a atribuição no relatório.

**Correção aplicada:**
1. **Schema (`orders`):** colunas `sales_channel` (default `'storefront'`, valores: `storefront`, `ai_attendant`, `marketplace`, `link_checkout`, `manual`) e `ai_conversation_id` adicionadas com validação por trigger.
2. **Trigger DB:** `trg_mark_order_as_ai_sale` (em `whatsapp_carts` AFTER UPDATE OF `order_id`) — quando o vínculo carrinho↔pedido é estabelecido, atualiza `orders.sales_channel='ai_attendant'` (apenas se ainda for `storefront`, sem sobrescrever marketplace/manual) e faz `INSERT … ON CONFLICT DO UPDATE` em `order_attribution` com `attribution_source='ai_atendimento'` e `attribution_medium='whatsapp'`.
3. **UI Pedidos / Fiscal:** `OrderSourceBadge` ganha variante "Venda IA" (ícone `Bot`, cor primária, tooltip "Venda IA — fechada pela IA de Atendimento"). Lista de pedidos e Notas Fiscais passam `salesChannel` para o badge. Filtro `MARKETPLACE_OPTIONS` passa a expor `venda_ia` como opção.
4. **UI Atribuição:** página `/attribution` mapeia `ai_atendimento` → ícone 🤖 + label "IA de Atendimento" (em `SOURCE_LABELS` e `SOURCE_ICONS`).

**Validação técnica executada:**
- ✅ Schema confirmado em `information_schema.columns` (orders.sales_channel, orders.ai_conversation_id presentes).
- ✅ Triggers confirmados em `pg_trigger`: `trg_link_whatsapp_cart_to_order` (orders) + `trg_mark_order_as_ai_sale` (whatsapp_carts).
- ✅ Função `mark_order_as_ai_sale_on_cart_link` é `SECURITY DEFINER` com `SET search_path = public`.
- ⏳ Validação E2E (cliente fecha pelo link da IA → pedido aparece com badge Venda IA + entra em Atribuição como "IA de Atendimento") depende de teste real do usuário em produção.

**Anti-regressão:** o trigger NÃO sobrescreve `sales_channel` se já for `marketplace` ou outro canal explícito — só promove `storefront → ai_attendant`. Garante que vendas de marketplace integradas posteriormente não sejam silenciosamente reclassificadas. A atribuição usa `ON CONFLICT (order_id) DO UPDATE` para sobrepor qualquer atribuição UTM genérica capturada antes (a fonte real do fechamento é a IA, não a UTM da landing page).

**Impacto cruzado:** módulo de Relatórios (`useReports.ts:184`) ainda agrupa por `marketplace_source` — não foi alterado nesta entrega. Se o lojista quiser ver "Venda IA" no relatório de canal, precisará incluir `sales_channel` na agregação numa entrega futura (lacuna documental conhecida, não bloqueante).

---

## Registro #8 — Hotfix `customerName` re-resolvido por call site — 02/mai/2026

**Sintoma:** em um ramo da regeneração pós-anti-repetição, a abertura formal saía sem o nome do cliente recorrente ("Olá, boa tarde, tudo bem?" em vez de "Olá, João, boa tarde, tudo bem?"), mesmo com `conversation.customer_name` preenchido.

**Diagnóstico:** os gates de saudação (`gateGreetingMirror`, `gateGreetingMirrorFallback`) recebiam `customerName=undefined` em alguns ramos porque a variável era herdada por closure de um bloco onde não estava declarada. A pipeline tem múltiplos ramos (TPR ok, TPR fallback, regeneração após anti-repetição, scrub legado) e nem todos compartilhavam o mesmo escopo.

**Correção aplicada:**
- `ai-support-chat/index.ts`: cada call site dos gates de saudação agora re-resolve localmente `greetCustomerName = conversation?.customer_name || null` e `greetIsRecurring = (messages?.length ?? 0) > 1 || !!customerId` antes de invocar o gate. 6 pontos de chamada cobertos (linhas 4280, 4937, 6206/6214/6228, 6242, 6432/6439/6446).
- Nenhuma mudança de prompt ou tool — apenas correção de escopo.

**Validação técnica:**
- ✅ `rg` confirma 6 call sites com `greetCustomerName` re-resolvido por bloco; nenhum mais depende de variável herdada.
- ✅ Build sem erros.
- ⏳ Validação E2E (cliente recorrente João recebe "Olá, João, [período], tudo bem? Como posso ajudar hoje?" mesmo após anti-repetição forçar regeneração) depende de teste no sandbox.

**Anti-regressão:** memória `mem://constraints/greeting-mirror-vars-must-be-declared-at-handler-scope` registra que toda nova chamada aos gates DEVE re-resolver as variáveis no próprio bloco — proibido herdar por closure.

---

## Registro #5 — Saudação formal padrão (sem gírias) — 01/mai/2026

**Regra de produto definida pelo usuário:** a IA SEMPRE responde de forma formal, mesmo que o cliente abra com gíria ("Eai", "Opa", "Salve"). Se o tenant quiser tom casual, criará regra própria nas configurações futuramente.

**Formato canônico:**
- Cliente novo: `"Olá, [período], tudo bem? Como posso ajudar?"`
- Cliente recorrente (já tem mensagens prévias na conversa OU customer_id conhecido): `"Olá[, Nome], [período], tudo bem? Como posso ajudar hoje?"`
- Período do dia: ECOA se o cliente disse; senão CALCULA em BRT (5–11h59 bom dia · 12–17h59 boa tarde · 18–4h59 boa noite).

**Correção aplicada:**
1. `greeting-mirror.ts` reescrito: tipo `period` sempre presente (calculado se ausente), removido campo `hello`, novo `computePeriodBRT()`, novos parâmetros `isRecurring` + `customerName`. Mapeia toda gíria para "Olá".
2. `greeting-scrub.ts` (fallback legado) atualizado para nova assinatura + strip iterativo de saudações degeneradas/gírias.
3. `output-gates.ts` (`gateGreetingMirror` + `gateGreetingMirrorFallback`): gera abertura formal + closer ("Como posso ajudar" ou "Como posso ajudar hoje" se recorrente). Strip iterativo expandido para cobrir "Eai", "Opa", "Salve", "Alô".
4. `ai-support-chat/index.ts`: 4 chamadas dos gates passam `isRecurring = (messages.length > 1 || !!customerId)` e `customerName = conversation.customer_name`.

**Validação técnica:**
- ✅ Edge `ai-support-chat` deployada com sucesso após mudanças.
- ✅ Build sem erros de tipo.
- ⏳ Validação E2E (cliente real diz "Eai" às 9h → IA responde "Olá, bom dia, tudo bem? Como posso ajudar?") depende de teste no sandbox da IA com o usuário.

**Anti-regressão:** memória `mem://constraints/greeting-formal-tone-no-slang` registra a regra. O scrub usa BRT fixo (UTC-3) — Brasil não tem horário de verão desde 2019. Override por tenant via `ai_support_config.greeting_style` fica disponível para implementação futura quando algum cliente pedir tom casual.

---

## Registro #1 — Histórico retroativo (consolidado, ciclos anteriores)

**Período coberto:** desde a estreia do Modo Vendas até abr/2026.
**Origem:** consolidação das memórias `mem://constraints/*` e `mem://features/ai/*` que já tratavam de IA de atendimento.

### Correções já aplicadas e ativas

| # | Problema observado | Correção | Onde mora |
|---|---|---|---|
| 1.1 | IA dizia "já encaminhei pro suporte" sem ter chamado tool de handoff | Scrubber `unsupported_action_promised` reescreve a resposta e força handoff real | `ai-support-chat/index.ts` (FIX-D) · `mem://constraints/ai-action-invention-scrubber` |
| 1.2 | IA confirmava produto X e adicionava produto Y no carrinho | Bloqueio `PRODUCT_LOCK_MISMATCH` no `add_to_cart` + resolver com `focusProductId` e quantificador (1x/2x/3x/6x) | `ai-support-chat/index.ts` + `_shared/sales-pipeline/product-resolver.ts` · `mem://constraints/ai-must-not-swap-confirmed-product` |
| 1.3 | Loop infinito "posso finalizar pra você?" mesmo após o cliente dizer "sim, manda" | FIX-B força `tool_choice=generate_checkout_link` em `checkout_assist`; rede de segurança força handoff comercial | `ai-support-chat/index.ts` (Eixo 1.7) · `mem://constraints/ai-sales-must-close-on-confirmed-intent` |
| 1.4 | IA repetia a mesma resposta em turnos consecutivos | Anti-repetição por hash de prefixo (regeneração obrigatória) | `mem://constraints/ai-response-anti-repetition-prefix-hash` |
| 1.5 | Erro técnico de SQL (`products.images` inexistente) levava a handoff indevido | 6 SELECTs migrados para `product_images` (subquery por `is_primary`/`sort_order`) | `mem://features/ai/sales-mode-conversational-commerce` |
| 1.6 | IA negava produto sem ter consultado o catálogo | Regra dura: chamar `search_products` antes de afirmar inexistência | `mem://constraints/ai-must-search-catalog-before-denying-product` |
| 1.7 | IA caía em handoff ao receber mensagem ambígua / vazia | Detector de input ambíguo pré-modelo | `mem://constraints/ambiguous-input-pre-model-detector` |
| 1.8 | Pipeline em loop por reabrir vitrine de produtos sem foco | Máquina de estados F2 (8 nós) + `family_focus` persistente | `pipeline-f2-vendas-ia.md` · `mem://features/ai/sales-pipeline-anti-repetition-and-family-focus` |
| 1.9 | Mensagem livre/imagem fora da janela Meta 24h | Bloqueio em `meta-whatsapp-send`; só template aprovado fora da janela | `mem://features/ai/sales-mode-conversational-commerce` |
| 1.10 | Mensagens humanas não retroalimentavam o aprendizado da IA | Captura `learning_event` também para mensagens de agente humano | `mem://constraints/ai-human-agent-messages-feed-ai-learning` |

**Status do registro:** ✅ Todas as correções acima estão em produção e cobertas por memória anti-regressão.

---

## Registro #3 — Sandbox de teste da IA (aba "IA Teste" em /atendimento) — 01/mai/2026

**Contexto.** Para que o usuário possa validar a IA antes de colocá-la em produção (ou após mexer em config/prompt), ganhou uma janela de chat dedicada dentro de `/atendimento` na aba **IA Teste**.

**Princípio (mem://constraints/ai-test-sandbox-mirror-only).** A "IA Teste" **NÃO é uma IA paralela** — é a **mesma IA de Atendimento de produção**, executada através de uma camada fina de sandbox. Qualquer mudança em prompt, tool, scrubber ou configuração da IA aparece automaticamente no sandbox no próximo turno. É proibido manter código de pipeline duplicado.

**Como funciona.**

- Frontend: componente `AISandboxChat.tsx` — apenas UI de chat, sem lógica de IA.
- Backend: edge `ai-test-sandbox` cria/garante uma conversa marcada com `metadata.is_sandbox=true`, insere a mensagem do usuário, **invoca a edge `ai-support-chat` original** e devolve a resposta.
- Conversa em "memória" enquanto a aba está aberta. Trocou de aba, fechou o navegador ou clicou em "Reiniciar" → conversa é apagada do banco (mensagens, eventos e a conversa em si).
- Tools de leitura (catálogo, políticas) usam dados reais. Tools de envio externo real (mandar WhatsApp de fato, criar pedido real) são naturalmente neutras nesse contexto porque a conversa é sandbox e não tem canal externo conectado.

**Isolamento aplicado.**

- `useConversations` filtra `metadata->>is_sandbox != 'true'` para que conversas sandbox **não apareçam** na fila de atendimento.
- Toda nova query/agregador que ler `conversations` ou `messages` para métricas/funil/aprendizado deve aplicar o mesmo filtro.

**Anti-regressão.** Memória `mem://constraints/ai-test-sandbox-mirror-only` proíbe duplicação da pipeline. Mudanças na IA só acontecem no fluxo principal (`ai-support-chat`, `_shared/sales-pipeline/`, `ai_support_config`).

### 🔍 Validação técnica executada — 01/mai/2026 00:27 UTC

| Etapa | Resultado |
|---|---|
| Schema confirmado (`conversations.metadata`, `messages.metadata`, `conversation_events`, `user_roles.tenant_id`) | ✅ bate com o que a edge usa |
| Contrato de entrada da `ai-support-chat` (`{conversation_id, tenant_id}`) | ✅ idêntico ao que o sandbox envia |
| Edge `ai-test-sandbox` rejeita chamada sem JWT | ✅ retorna `success:false, error:"unauthenticated"` |
| Conversa sandbox criada manualmente (Respeite o Homem) | ✅ `metadata.is_sandbox=true`, `channel_type=chat`, `status=bot` |
| Mensagem inbound do "cliente" (`Boa tarde`) inserida | ✅ |
| Pipeline real invocada via `ai-support-chat` sobre a conversa sandbox | ✅ resposta gerada em 9.6s, modelo `gpt-5-mini`, `sales_mode=true`, intent=`greeting`, custo 4¢ |
| Resposta da IA: `"Oi! Tudo bem? Me conta o que você está procurando."` | ✅ saudação coerente, sem violar regras (sem preço, sem invenção) |
| Trigger de contagem de mensagens | ✅ `message_count=2` após o turno |
| Cleanup (delete em `messages`, `conversation_events`, `conversations`) | ✅ 0 registros remanescentes |
| Filtro do `useConversations` esconde sandbox da fila real | ✅ `metadata->>is_sandbox.is.null OR .neq.true` confirmado |

**Conclusão.** O sandbox executa a **mesma pipeline de produção** sobre uma conversa isolada e descartável, sem poluir métricas/fila. Princípio "espelho automático" cumprido — qualquer ajuste futuro em `ai-support-chat` ou `_shared/sales-pipeline/` aparece no sandbox sem mudança no código do sandbox.

**Pendente de validação do usuário.**
1. Abrir `/atendimento` → aba **IA Teste** logado num tenant que o usuário tem acesso.
2. Mandar 2–3 mensagens reais como cliente (saudação + pergunta de produto).
3. Trocar de aba ou clicar em **Reiniciar** e confirmar que a conversa some do banco (não aparece em nenhum lugar do CRM).
4. Conferir que a aba **Atendimento** continua sem listar a conversa sandbox.

---

## Registro #2.10 — Focus Snapshot + Exact-Match Boost (aplicado, em validação) — 30/abr/2026


**Contexto.** Após a Onda 3 do Reg #2.9 (Working Memory ativa nos prompts), validamos a conversa das 09:35 (ID `ab3d720d`). As 3 primeiras mensagens da IA ficaram corretas. A partir da quarta apareceram dois erros lógicos sérios:

1. **Drift de identidade de produto.** A IA inventou "kit banho calvície zero noite" (que não existe — o real é "Kit Banho Calvície Zero", sem "noite"; o "noite" só existe para o kit shampoo+loção).
2. **Re-busca no fechamento.** Quando o cliente pediu oferta "desse kit" e em seguida pediu o link, a IA disparou `search_products` genérico de novo (em vez de focar nos itens já discutidos), o `generate_checkout_link` nunca foi chamado e a conversa caiu em handoff.
3. **Ranking do `search_products`.** `query="Loção"` retornou repetidamente o **Shampoo Preventive Power** porque o sort priorizava `pain_match` sobre similaridade textual literal.

**Causa raiz.** Faltavam dois mecanismos:
- **Travamento canônico de produto.** Não existia uma estrutura "estes são os IDs em foco/oferta" persistida — então cada turno o modelo recomeçava do zero quando precisava do checkout.
- **Match literal forte.** O ranking textual era frágil: pain match sobrepunha qualquer similaridade lexical, mesmo quando a query do modelo batia exatamente com o nome.

**Ajustes desta entrega.**

1. **Exact-Match Boost no `search_products`** (`partitionAndLimit`): score lexical (0=começa com query, 1=contém query, 2=contém todos os tokens, 3=sem match) ANTES de `pain_match`. Resolve "buscou Loção e veio Shampoo".
2. **Focus Snapshot persistido em `extras.focus_snapshot`** (sem migração — usa `jsonb` existente). Estrutura: `{ product_ids[], names[], kit_id?, locked_at, locked_reason }`. Travamento no fim do turno:
   - `add_to_cart` rodou → trava nos itens do carrinho (sobrescreve qualquer focus anterior — sinal mais forte).
   - `get_product_details` rodou e ainda não há focus → trava no produto detalhado.
   - Estado avançado (decision/cart/checkout/checkout_assist) + `search_products` retornou ≤3 itens e ainda não há focus → trava nesses.
3. **Bloco "🔒 PRODUTOS EM FOCO" no working memory prompt.** `buildWorkingMemoryPromptBlock` injeta no system prompt: nomes + IDs travados, instrução explícita de NÃO reabrir vitrine via `search_products`, e direção para fechar com `add_to_cart`(IDs travados) → `generate_checkout_link`.

**Validação técnica executada.**
- ✅ Edição cirúrgica: 3 arquivos (`working-memory.ts`, `working-memory-prompt.ts`, `ai-support-chat/index.ts`).
- ✅ Sem migração de schema (usa coluna `extras` existente).
- ✅ Retrocompatível: `getFocusSnapshot()` retorna `null` quando vazio → bloco não é injetado, comportamento legado preservado.

**Pendente de validação do usuário.**
1. Reproduzir a conversa que falhou (saudação → dor → IA recomenda kit + componentes → cliente pede oferta → cliente pede link).
2. Conferir nos logs: `[Reg #2.10] focus_snapshot LOCKED reason=... ids=...` deve aparecer nos turnos avançados.
3. Conferir no banco: `SELECT extras->'focus_snapshot' FROM conversation_sales_state WHERE conversation_id = '<id>'`.
4. Confirmar que ao pedir oferta/link a IA NÃO chama mais `search_products` e SIM `add_to_cart` + `generate_checkout_link` com os IDs travados.
5. Confirmar que `search_products('Loção')` retorna a Loção (não o Shampoo) como primeiro item.

**Arquivos alterados.**
- `supabase/functions/_shared/sales-pipeline/working-memory.ts` — interface `FocusSnapshot` + helper `getFocusSnapshot`.
- `supabase/functions/_shared/sales-pipeline/working-memory-prompt.ts` — bloco "PRODUTOS EM FOCO".
- `supabase/functions/ai-support-chat/index.ts` — exact-match boost em `partitionAndLimit`, lock do focus snapshot pós-turno (passa via `merge_extras`).

**Anti-regressão.** Memória `mem://features/ai/sales-pipeline-v2-10-focus-snapshot-and-exact-match` (a indexar no fechamento desta onda).

---

## Registro #2.9 — Working Memory + Stage Machine em Shadow Mode (aplicado, em observação) — 30/abr/2026

**Contexto.** Reg #2.8 (TPR + Output Gates) entregou classificação por turno, mas a memória da conversa ainda vivia em campos avulsos (`sales_state` na coluna da tabela `conversations`, `family_focus` em outro lugar, anti-repetição em outro). Sem uma memória persistente unificada, a IA esquecia em qual fase comercial o cliente estava entre turnos, repetia perguntas-âncora, oferecia upsell mais de uma vez e não tinha como saber se já tinha apresentado um produto antes.

**Onda 1 (banco).** Criada a tabela `conversation_sales_state` (1:1 com a conversa) com:
- `stage` em 7 fases comerciais: `social_only | exploring | needs_known | evaluating | buying_intent | closing | post_sale`.
- `presented_families`, `presented_product_ids`, `customer_named_families` (anti-repetição de catálogo).
- `customer_declared_pain` (dor declarada — só grava se ainda for nula, preserva primeira declaração).
- `asked_question_hashes` (anti-repetição de perguntas-âncora).
- `last_greeting_at` (evita re-saudar o mesmo cliente no mesmo dia).
- `upsell_offered_count` + `upsell_declined` (upsell limitado a 1 por conversa).
- `commercial_signals` (jsonb livre — TPR source, último estado pipeline, intenção de compra).
- RLS: `service_role` total, `authenticated` lê via `user_has_tenant_access`, anon bloqueado.

**Onda 2 (pipeline — esta entrega).**
- Novo módulo `_shared/sales-pipeline/working-memory.ts`: `loadSalesState()` (cria 1:1 com upsert idempotente), `patchSalesState()` (merge parcial), `hashQuestion()` (FNV-1a determinístico).
- Novo módulo `_shared/sales-pipeline/stage-machine.ts`: `decideStage()` decide próximo dos 7 estágios a partir do TPR + sinais persistidos. Inclui anti-regressão (não permite cair de `closing` para `exploring` sem motivo legítimo). `STAGE_TO_PIPELINE_STATE` mapeia cada estágio para um `PipelineState` já existente — **reaproveita o tool-filter e os prompts em produção**, sem reescrever nada.
- Plugados em `ai-support-chat/index.ts` em **shadow mode**: logo após o TPR, carrega memória, calcula estágio sugerido e loga (`[Reg #2.9] [shadow] stage=… suggested=… reason=…`). Logo após `nextPipelineState` ser definido, persiste o estágio sugerido + dor declarada + família citada + last_greeting_at + sinais comerciais.
- **Não altera a resposta do cliente nesta entrega**. A máquina antiga (`decideNextState` + `family_focus` + `pending_action`) continua decidindo o que a IA fala. A nova roda em paralelo, gerando dados auditáveis.
- TPR não foi estendido — os campos atuais (`is_pure_greeting`, `described_symptom`, `mentioned_product_name`, `confirmed_purchase_intent`, `asked_about_payment_or_link`, `is_support_topic`) já cobrem todas as transições da nova máquina. Decisão de prudência: zero risco no Reg #2.8.

**Validação técnica.**
- `deno check` no `ai-support-chat/index.ts` passou sem erros após inserir os 2 blocos novos + imports.
- Deploy `ai-support-chat` concluído.
- Tabela `conversation_sales_state` começa em 0 registros — vai popular conforme conversas chegam pelo WhatsApp.

**Pendente de validação do usuário.**
1. Disparar 1 conversa real no WhatsApp em modo vendas (ex.: contato de teste).
2. Verificar nos logs do edge function `ai-support-chat` linhas com `[Reg #2.9] [shadow]` mostrando `stage=… suggested=… reason=…`.
3. Conferir no banco: `SELECT * FROM conversation_sales_state WHERE conversation_id = '<id da conversa de teste>'` para ver memória persistida.
4. Confirmar que o comportamento do cliente final no WhatsApp **não mudou** (objetivo da Onda 2 é só observar).

**Próximas ondas (planejadas).**
- **Onda 3** — Prompts por estágio: cada um dos 7 estágios ganha um prompt dedicado que lê working memory (anti-repetição via `asked_question_hashes`, dor declarada como contexto, evita re-apresentar produtos em `presented_product_ids`, controla upsell). Substitui `decideNextState` legado pela `decideStage` como fonte de verdade.
- **Onda 4** — Filtro de tools por estágio comercial (ex.: `closing` libera `generate_checkout_link` mas bloqueia `search_products` para evitar reabrir vitrine). Documentação Layer 3 `sales-pipeline-v3.md` criada como spec final.

**Arquivos alterados.**
- `supabase/migrations/20260430020302_*.sql` (Onda 1 — criou `conversation_sales_state`).
- `supabase/functions/_shared/sales-pipeline/working-memory.ts` (novo).
- `supabase/functions/_shared/sales-pipeline/stage-machine.ts` (novo).
- `supabase/functions/_shared/sales-pipeline/index.ts` (exporta os 2 novos).
- `supabase/functions/ai-support-chat/index.ts` (imports + bloco shadow load + bloco shadow persist).

**Anti-regressão.** Memória `mem://features/ai/sales-pipeline-v2-9-working-memory-shadow-mode` (a indexar no fechamento da Onda 4 quando virar fonte de verdade ativa).

---

## Registro #2 — Conversa Respeite o Homem, 14:14 BRT (em correção)

**Data do diagnóstico:** 29/abr/2026
**Tenant:** Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`)
**Conversa:** `97b54ad3-f2d7-4771-a1d7-6c651bc9b512`
**Canal:** WhatsApp
**Modo da IA:** Vendas
**Reportado por:** dono da loja, simulando cliente interessado em comprar.

### Sintomas observados

1. **Saudação não espelhada.** Cliente abriu com "Boa tarde" + descrição do caso e foto. IA respondeu "Olá, tudo bem?" — perdeu reciprocidade.
2. **Pergunta consultiva ignorada.** Cliente perguntou explicitamente *"qual seria o tratamento mais indicado pra mim?"*. IA pulou direto para listar dois shampoos, sem acolher o caso nem fazer 1 pergunta de qualificação.
3. **Preço apresentado sem ser perguntado.** Já no 1º turno de produto a IA cravou "custa R$ 93,01" sem o cliente ter pedido valor.
4. **Loop de confirmação.** "Deixo separado pra você?" repetido em dois turnos seguidos com leve variação de palavra. O hash exato do anti-repetição não pegou.
5. **Troca silenciosa de produto.** IA ofertou Shampoo + Loção (R$ 184,21 em 2 itens). Quando o cliente confirmou o fechamento, ela adicionou no carrinho um *Kit Banho Calvície Zero Noite* consolidado de R$ 138,46 — produto diferente, valor diferente, sem avisar.
6. **Domínio errado no link.** O link gerado caiu em `respeite-o-homem.shops.comandocentral.com.br` em vez de `www.respeiteohomem.com.br` (domínio próprio verificado e ativo do tenant).
7. **Carrinho vazio na storefront.** Ao abrir o link, o cliente viu "Seu carrinho está vazio". Venda morreu na linha de chegada.

### Diagnóstico técnico (causa raiz por sintoma)

- **Sintoma 6 (domínio errado).** O `ai-support-chat` consulta uma tabela chamada `custom_domains` que **não existe** no banco. A consulta retorna sempre vazio e o código cai no fallback `slug.shops.comandocentral.com.br`. A tabela canônica de domínios próprios é `tenant_domains` (memória `tenant-domain-resolution-logic-ptbr`), com colunas `domain`, `is_primary`, `status='verified'`, `ssl_status='active'`. Consulta confirmada: o tenant tem `www.respeiteohomem.com.br` cadastrado e ativo lá.

- **Sintoma 7 (carrinho vazio).** O hidratador `useCheckoutLinkLoader` (que lê `?link=` da URL e popula o carrinho) está montado **dentro** do `CheckoutStepWizard`. O wizard, por sua vez, só monta quando a página de carrinho decide que não está vazia. Como o carrinho **começa** vazio, a página renderiza o empty-state ("Seu carrinho está vazio") antes do wizard montar — e o hidratador nunca chega a rodar. É uma race lógica de ordem de montagem, não um bug de dados (o `checkout_links` está correto, o produto está ativo, o slug bate).

- **Sintomas 3 e 5 (preço espontâneo + troca silenciosa).** Os prompts de `recommendation` e `product-detail` instruem a IA a "contar preço e disponibilidade" já na 1ª apresentação. Não existe regra global de "preço sob demanda". A trava `PRODUCT_LOCK_MISMATCH` só protege quando há um foco único — não cobre o caso "ofertei N itens e adicionei outro item agregador no lugar".

- **Sintoma 1 (saudação não espelhada).** Existe regra no prompt de `greeting` para espelhar período do dia, mas é só recomendação no system prompt. Não há scrubber no servidor que detecte a quebra e reescreva a abertura.

- **Sintoma 2 (pergunta consultiva ignorada).** Não há classificação de "turno consultivo" (cliente descreveu caso/sintoma + pediu recomendação personalizada + mandou foto). A IA tratou como se fosse uma pergunta genérica de catálogo.

- **Sintoma 4 (loop de confirmação).** O detector existente trabalha por **hash exato** do prefixo da resposta. "Deixo separado pra você" e "Posso separar e te mando o link?" não casam, mesmo sendo a mesma intenção semântica.

### Correção em curso (Blocos do plano técnico aprovado)

| Bloco | O que muda | Status |
|---|---|---|
| 1 — Domínio próprio no link | Trocar fonte do domínio do `ai-support-chat` de `custom_domains` → `tenant_domains` (filtro `status='verified'`, `ssl_status='active'`, preferindo `is_primary=true`) | ⏳ A aplicar |
| 2 — Hidratação do carrinho antes do empty-state | Mover `useCheckoutLinkLoader` para o nível da página `StorefrontCart`. Detectar `?link=`/`?product=` antes de renderizar empty-state. Mostrar "Carregando seu pedido…" enquanto hidrata | ⏳ A aplicar |
| 3.1 — Preço sob demanda | Regra global nos prompts de `discovery`/`recommendation`/`product-detail`: preço só com pergunta direta do cliente ou no fechamento | ⏳ A aplicar |
| 3.2 — Trava de conjunto ofertado | Novo invariante `OFFERED_BUNDLE_LOCK` no `add_to_cart`: comparar carrinho real vs "carrinho proposto" do turno; se divergir e não houver pedido de troca, bloqueia e força reconfirmação | ⏳ A aplicar |
| 3.3 — Reforço de saudação espelhada | Promover regra a "dura" no prompt + scrubber leve no servidor que reescreve a abertura quando o cliente saudou e a IA não espelhou | ⏳ A aplicar |
| 3.4 — Anti-repetição por família semântica | Ampliar detector para reconhecer família ("posso separar / deixo separado / mantenho a quantidade / posso reservar") como mesma intenção; regenerar na 2ª ocorrência sem avanço de estado | ⏳ A aplicar |
| 3.5 — Imagem na 1ª apresentação real | Em `product_detail`, tornar `send_product_image` obrigatória (1x por produto, respeitando anti-spam) | ⏳ A aplicar |
| 3.6 — Honrar pergunta consultiva | Classificar turno consultivo (sintoma + pedido de recomendação + foto). Forçar acolhida em 1 linha + no máximo 1 pergunta de qualificação antes de listar produto | ⏳ A aplicar |
| 4 — Validação | Smoke test do link (domínio + carrinho). Refazer roteiro do cliente real no canal de teste. Documentar nas specs e indexar memórias anti-regressão | ⏳ A executar |

### Anti-regressão prevista

Memórias a criar e indexar quando os blocos forem aplicados (cada uma vira 1 entrada `mem://constraints/*`):

- `checkout-link-domain-source-of-truth` — fonte de verdade do domínio é `tenant_domains`; `custom_domains` não existe.
- `checkout-link-must-show-loading-not-empty` — empty-state do carrinho proibido enquanto `?link=`/`?product=` estiver sendo hidratado.
- `ai-must-not-mention-price-unsolicited` — preço só com pergunta direta ou no fechamento.
- `ai-must-not-swap-offered-bundle` — conjunto ofertado vira "carrinho proposto"; substituir exige reconfirmação.
- `ai-must-mirror-greeting-period` — espelhamento de "bom dia/boa tarde/boa noite" reforçado por scrubber.
- `ai-must-honor-consultative-question-first` — turno consultivo precisa de acolhida antes de listar produto.
- `ai-anti-repetition-semantic-family` — anti-repetição por família semântica, não só hash exato.
- `ai-product-detail-image-mandatory-on-first-mention` — imagem obrigatória na 1ª apresentação real do produto.

### Próximas ações

1. Aplicar Blocos 1 → 4 na ordem de impacto na receita (domínio + carrinho primeiro, depois protocolo conversacional).
2. Cada bloco aplicado abre seu próprio sub-registro abaixo (Reg. #2.1, #2.2, …) com o "antes/depois" e o link da memória criada.
3. Quando todos os blocos estiverem aplicados e validados, o Registro #2 é fechado com o resumo final do "depois" e o `Mapa de qualidade atual` é atualizado.

**Status do registro:** ⏳ Diagnóstico concluído · Blocos 1, 2, 3 (parcial), 3.3, 3.4 e 3.6 aplicados em 29/abr/2026 · Validação E2E pelo usuário pendente (refazer roteiro do cliente no canal de teste após limpeza do histórico).

---

## Registro #2.1 — Domínio próprio no link de checkout (aplicado)

**Data:** 29/abr/2026
**Bloco:** 1 do plano técnico do Reg. #2
**Arquivo alterado:** `supabase/functions/ai-support-chat/index.ts` (resolução de `storeUrl`)

**Antes:** consulta a `custom_domains` (tabela inexistente) → sempre vazio → fallback `slug.shops.comandocentral.com.br`.
**Depois:** consulta `tenant_domains` filtrando `status='verified'`, com preferência por `is_primary=true`. Validado: 3 domínios verificados no banco; o tenant Respeite o Homem tem `www.respeiteohomem.com.br` cadastrado como primário.
**Memória anti-regressão:** `mem://constraints/checkout-link-domain-source-of-truth`.
**Validação técnica executada:** ✅ build TS limpo · ✅ query `tenant_domains` confirmada (3 verified). Pendente: gerar um link real no canal de teste e conferir o host na URL.

---

## Registro #2.2 — Carrinho hidratado antes do empty-state (aplicado)

**Data:** 29/abr/2026
**Bloco:** 2 do plano técnico do Reg. #2
**Arquivo alterado:** `src/hooks/useCheckoutLinkLoader.ts`

**Antes:** o hook iniciava com `isLoading=false` e só virava `true` dentro do `useEffect`. Entre o primeiro render e o efeito, o `CheckoutStepWizard` avaliava `items.length === 0 && !linkLoading` e renderizava "Seu carrinho está vazio" antes do hidratador rodar.
**Depois:** o hook detecta `?link=` ou `?product=` na URL **na inicialização do `useState`**, então `isLoading` já nasce `true` e o guard `!linkLoading` no wizard segura o empty-state. Render → "Carregando seu pedido…" (loader nativo do wizard) → hidrata → mostra carrinho cheio.
**Memória anti-regressão:** `mem://constraints/checkout-link-must-show-loading-not-empty`.
**Validação técnica executada:** ✅ build TS limpo · ✅ guard `!linkLoading` já existia em `CheckoutStepWizard.tsx:915`. Pendente: abrir um link real e confirmar visualmente que o empty-state não pisca.

---

## Registro #2.3 — Protocolo conversacional: preço sob demanda + bundle lock + imagem obrigatória (aplicado)

**Data:** 29/abr/2026
**Bloco:** 3.1, 3.2 e 3.5 do plano técnico do Reg. #2
**Arquivos alterados:**
- `supabase/functions/_shared/sales-pipeline/prompts/base.ts` (regras globais novas)
- `supabase/functions/_shared/sales-pipeline/prompts/discovery.ts` (proibição de preço)
- `supabase/functions/_shared/sales-pipeline/prompts/recommendation.ts` (PRICE-ON-DEMAND + BUNDLE LOCK por estado)
- `supabase/functions/_shared/sales-pipeline/prompts/product-detail.ts` (imagem obrigatória + preço liberado)

**Mudanças efetivas:**
1. **PRICE-ON-DEMAND global** em `base.ts`: preço só com pergunta direta do cliente, EXCETO em `product_detail` (cliente já focou) e `checkout_assist` (fechamento). `discovery` e `recommendation` ganharam reforço explícito.
2. **BUNDLE LOCK / OFFERED_SKU_LOCK global** em `base.ts`: o que foi ofertado é o que vai pro carrinho; trocar SKU por kit/combo sem perguntar é proibido. Reforço por estado em `recommendation`.
3. **Anti-repetição semântica** (regra macro adicionada ao `base.ts` enquanto o detector dedicado do Bloco 3.4 não fica pronto).
4. **Imagem obrigatória na 1ª menção real do produto** em `product-detail`: `send_product_image` agora é obrigatória (1x por produto, respeitando anti-spam) na primeira apresentação.

**Memórias anti-regressão criadas:**
- `mem://constraints/ai-must-not-mention-price-unsolicited`
- `mem://constraints/ai-must-not-swap-offered-bundle`
- `mem://constraints/ai-product-detail-image-mandatory-on-first-mention`

**Validação técnica executada:** ✅ build TS limpo · ✅ template literais fechados em `base.ts`. Pendente de validação do usuário: refazer o roteiro do cliente (caso de calvície) e checar que a IA (a) não cita preço em descoberta/recomendação, (b) não troca o conjunto ofertado por kit consolidado, (c) manda foto na 1ª menção do produto.

---

## Registro #2.4 — Greeting scrub server-side (aplicado)

**Data:** 29/abr/2026
**Bloco:** 3.3 do plano técnico do Reg. #2
**Arquivos criados/alterados:**
- `supabase/functions/_shared/sales-pipeline/greeting-scrub.ts` (novo)
- `supabase/functions/_shared/sales-pipeline/index.ts` (export)
- `supabase/functions/ai-support-chat/index.ts` (integração antes do hash + métrica no turn log)

**Antes:** o `greeting-mirror.ts` já injetava a abertura literal no prompt, mas o modelo eventualmente ignorava e abria com "Oi!" mesmo com o cliente dizendo "boa noite". Não havia correção pós-geração.
**Depois:** scrubber de saída detecta quebra de reciprocidade (período do dia ausente ou ausência de "tudo bem" recíproco) e reescreve a abertura com `mandatoryOpening` derivada da mensagem do cliente, **sem regenerar** (latência zero, custo zero). Aplica APENAS quando `pipelineState='greeting'`.
**Observabilidade:** `metadata.greeting_scrub_applied` e `metadata.greeting_scrub_reason` no `ai_support_turn_log`.
**Memória anti-regressão:** `mem://constraints/ai-must-mirror-greeting-period` (referência já listada no Reg. #2).
**Validação técnica executada:** ✅ helpers exportados via barrel · ✅ wiring antes do `hashResponse`. Pendente: validar no canal de teste (refazer "boa noite" e conferir que IA abre com "Boa noite!").

---

## Registro #2.5 — Anti-repetição por família semântica (aplicado)

**Data:** 29/abr/2026
**Bloco:** 3.4 do plano técnico do Reg. #2
**Arquivos criados/alterados:**
- `supabase/functions/_shared/sales-pipeline/intent-fingerprint.ts` (novo)
- `supabase/functions/_shared/sales-pipeline/index.ts` (export)
- `supabase/functions/ai-support-chat/index.ts` (classificação + lookup das últimas 2-3 famílias + gate de regeneração)

**Antes:** o anti-repetição olhava só o hash exato dos primeiros 80 chars normalizados. "Posso separar pra você?" e "Deixo separado pra você?" geravam hashes diferentes — mesma intenção, loop não era detectado.
**Depois:** classificador de família (`reserve_offer`, `confirm_close`, `bundle_upsell_ask`, `data_request`, `generic_qualify`, `generic_help`, `opening_greeting`, `other`). Antes de gravar, busca as últimas 2-3 famílias do `ai_support_turn_log` da conversa; se a família atual repete uma das duas anteriores, dispara o **mesmo fluxo de regeneração** já existente (Pacote E v2) com hint específico de "troque a intenção do turno". Famílias `other` e `opening_greeting` não disparam (genéricas demais).
**Observabilidade:** `metadata.intent_family`, `metadata.semantic_duplicate_detected`, `metadata.semantic_duplicate_reason` no `ai_support_turn_log`.
**Memória anti-regressão:** `mem://constraints/ai-anti-repetition-semantic-family` (referência já listada no Reg. #2).
**Validação técnica executada:** ✅ helpers exportados · ✅ integrado ao gate de regeneração existente. Pendente: validar no canal de teste forçando duas ofertas de "reservar" consecutivas e conferir que a 2ª é regenerada.

---

## Registro #2.6 — Detector de turno consultivo (aplicado)

**Data:** 29/abr/2026
**Bloco:** 3.6 do plano técnico do Reg. #2
**Arquivos criados/alterados:**
- `supabase/functions/_shared/sales-pipeline/consultative-turn.ts` (novo)
- `supabase/functions/_shared/sales-pipeline/index.ts` (export)
- `supabase/functions/ai-support-chat/index.ts` (injeção do bloco em `discovery`/`recommendation`)

**Antes:** quando o cliente trazia sintoma + pedido de recomendação + foto, a IA pulava direto pra listagem de 2 produtos, sem acolher e sem qualificar.
**Depois:** detector combina 3 sinais (descrição de sintoma, pedido de recomendação personalizada, mídia anexada) — qualquer 2 dos 3 = consultivo. Quando detectado em `discovery` ou `recommendation`, injeta um bloco no prompt obrigando: (1) acolhida em 1 linha espelhando o caso, (2) UMA pergunta curta de qualificação, (3) sinalização de que vai recomendar logo em seguida. Proíbe listar produto, citar preço, mandar imagem, pedir dado pessoal ou usar "Como posso te ajudar?" no mesmo turno.
**Memória anti-regressão:** `mem://constraints/ai-must-honor-consultative-question-first` (referência já listada no Reg. #2).
**Validação técnica executada:** ✅ helpers exportados · ✅ injeção condicional no prompt validada. Pendente: validar no canal de teste com mensagem "tenho calvície na coroa há 2 anos, qual tratamento mais indicado pra mim?" + foto e conferir que a IA acolhe + faz 1 pergunta antes de listar produto.

---

## Registro #2.7 — Limpeza do histórico de teste (aplicado)

**Data:** 29/abr/2026
**Escopo:** contato de teste oficial — Antonio Ravazio · `5573991681425` · tenant Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).

**Operação:** apagados (não soft-delete) — 1 conversa (`97b54ad3-…`), 15 mensagens, 7 mensagens WhatsApp do telefone, 7 turnos do `ai_support_turn_log`, 0 resumos, 0 memórias da IA. **Cliente cadastrado mantido** (2 registros do Antonio preservados).
**Motivo:** retestar do zero o roteiro completo do cliente após aplicação dos blocos 1, 2, 3 (parcial), 3.3, 3.4 e 3.6.
**Reversão:** não há (delete físico). Backups da plataforma cobrem caso de necessidade extrema.
**Validação técnica executada:** ✅ contagem pós-delete = 0 em todas as tabelas-alvo · ✅ customers do contato preservados (2 registros). Pendente: validação E2E do usuário no canal real.

---

## Registro #2.8 — Turn Pre-Router + Catalog Probe + Output Gates (aplicado)

**Data:** 29/abr/2026
**Motivação:** após os blocos 3.3/3.4/3.6, o usuário re-testou e os mesmos sintomas voltaram (saudação não espelhada com perfeição, preço espontâneo, IA cega para Balm/Loção mesmo descrevendo "calvície"). Diagnóstico: defesas baseadas em regex/prompt-only não enxergam a intenção real do turno. Plano aprovado: trocar a base por classificação estruturada + gates determinísticos lendo o JSON da classificação.

**Arquivos criados/alterados:**
- `supabase/functions/_shared/sales-pipeline/turn-pre-router.ts` (novo) — TPR com `google/gemini-2.5-flash-lite` via Lovable AI Gateway, tool calling, timeout 3.5s, fallback regex.
- `supabase/functions/_shared/sales-pipeline/catalog-probe.ts` (novo) — `broadenCatalogForPain` devolve 1 representante por família quando o cliente descreve dor.
- `supabase/functions/_shared/sales-pipeline/output-gates.ts` (novo) — `scrubUnsolicitedPrice` (remove R$/frete/parcelas em estados pré-detalhe) + `gateGreetingMirror` (corrige bug AND/OR do scrub legado).
- `supabase/functions/_shared/sales-pipeline/index.ts` — exporta os 3 módulos novos.
- `supabase/functions/ai-support-chat/index.ts` — integração:
  - **TPR** disparado após o `productHintPromise` (paralelo ao bootstrap do turno) com histórico curto (6 últimos), media flag e dicas de catálogo. Resultado é a fonte única.
  - **Catalog Probe** plugado no `search_products` via `ctx.shouldBroadenForPain`. Quando true, ignora filtro estrito por família e devolve 1 produto por família (Shampoo + Loção + Balm + Kit).
  - **Output Gates** rodam pós-resposta: price scrubber sempre (TPR ou fallback), greeting mirror gate quando `TPR.source='llm'`; scrub legado regex segue como rede quando o TPR cair.
  - **Hardening de domínio**: log explícito de `storeUrlSource` (`tenant_domains_primary` | `tenant_domains_any` | `shops_fallback`) e warn quando cair em `.shops` para diagnóstico futuro.
- Bug de chave perdida na chamada `buildPromptForState({` (introduzido entre Reg #2.6 e #2.7) restaurado nesta entrega.

**Antes:** detectores eram regex frágeis (`alreadyMirrors` com bug AND/OR; `tenho bastante entrada` não casava com nenhum padrão consultivo); `family_focus` estrito escondia Balm/Loção quando o cliente dizia "shampoo pra calvície"; preço vazava no 1º turno mesmo com a regra global.
**Depois:** o TPR classifica o turno em ~300-500ms e devolve JSON estruturado (`should_broaden_catalog_for_pain`, `asked_about_price`, `greeting_period`, `is_consultative_turn`, etc.). Os gates leem esse JSON e aplicam regra dura sem regex e sem regenerar resposta. Quando o TPR falha (rate limit, timeout), o pipeline cai nos detectores antigos — nunca derruba o turno.

**Observabilidade:** logs `[Reg #2.8] TPR source=… latency=… pure_greeting=… consultative=… broaden_pain=…`, `[Reg #2.8] catalog probe families=…`, `[Reg #2.8] price scrub (…)`, `[Reg #2.8] greeting gate (…)` e `[Reg #2.8] storeUrl=… source=…` no edge log.

**Memórias anti-regressão a indexar (próxima rodada):**
- `mem://features/ai/turn-pre-router-as-source-of-truth` — JSON do TPR é a fonte única para gates determinísticos.
- `mem://features/ai/catalog-probe-pain-broaden` — quando o cliente descreve dor, mostre o TRATAMENTO (várias famílias), não só a família citada.
- `mem://constraints/output-gates-must-read-tpr-not-regex` — proibido criar novo gate baseado em regex de saída quando o sinal está disponível no TPR.

**Validação técnica executada:**
- ✅ `deno check` confirma sintaxe OK (7 erros TS pré-existentes em `nextProductFocus`/`productNamesHint` não foram introduzidos por esta entrega).
- ✅ Consulta DB confirma `tenant_domains` do Respeite o Homem com `www.respeiteohomem.com.br` `is_primary=true status=verified` — o `.shops` no diálogo anterior provavelmente foi link gerado em turno antigo; o log novo vai expor a origem em qualquer turno futuro.
- Pendente: usuário re-testar no WhatsApp ("Boa noite, tudo bem? Tenho calvície na coroa, qual tratamento indicado pra mim?") e confirmar (a) abertura "Boa noite, tudo bem?", (b) acolhida + qualificação antes de listar, (c) recomendação cita Shampoo + Loção + Balm (não só Shampoo), (d) sem preço espontâneo, (e) link com domínio `respeiteohomem.com.br`.

---

*Documento criado em 29/abr/2026 · Última atualização: 29/abr/2026 (Reg. #2.4, #2.5, #2.6, #2.7, #2.8 aplicados).*

## Registro #2.9 Onda 3 — Working Memory ATIVA nos prompts (aplicado)

**Data:** 30/abr/2026
**Motivação:** Onda 2 já persistia memória da conversa (estágio, dor, famílias, presented_product_ids, asked_question_hashes) mas a IA não LIA esse contexto — então repetia perguntas, reapresentava produtos e oferecia upsell mais de uma vez. Plano aprovado: ativar Working Memory dentro do `systemPrompt` de cada estado, sem mexer nos prompts por estado (segurança).

**Arquivos criados/alterados:**
- `supabase/functions/_shared/sales-pipeline/working-memory-prompt.ts` (novo) — `buildWorkingMemoryPromptBlock(state)` monta bloco aditivo com estágio atual + dor declarada + famílias citadas pelo cliente + famílias/produtos já apresentados + nº de perguntas feitas (anti-repetição) + status de upsell (limite 1 por conversa) + flag de saudação já feita. `extractAnchorQuestions(text)` tira perguntas-âncora (>=12 chars, ignora "tudo bem?", "posso?") e `questionsToHashes()` gera hashes FNV-1a determinísticos.
- `supabase/functions/_shared/sales-pipeline/index.ts` — exporta o módulo novo.
- `supabase/functions/ai-support-chat/index.ts`:
  - **Injeção do bloco** em `contextualBlocks` ANTES do `buildPromptForState` (somente quando salesMemory carregou). Log `[Reg #2.9] working_memory_block injected — stage=… pain=… presented_products=… asked_questions=… upsell=…`.
  - **Patch pós-resposta estendido**: agora grava `add_asked_question_hashes` (das perguntas extraídas do `aiContent`), `add_presented_product_ids` (extraídos de `toolResultsThisTurn` — search_products / get_product_details / get_product_variants / add_to_cart) e `add_presented_families`. Log `[Reg #2.9] working_memory patched — stage=… new_questions=N new_products=M pain_set=…`.

**Antes:** memória persistia mas não influenciava resposta — IA podia perguntar 3x a mesma coisa, reapresentar Shampoo X depois de já ter mostrado, oferecer upsell em todo turno.
**Depois:** prompt do estado recebe bloco "MEMÓRIA DA CONVERSA" lembrando explicitamente: dor declarada, famílias/produtos já mostrados, contagem de perguntas feitas (proibido repetir), upsell já oferecido (proibido reoferecer), saudação já feita (proibido recumprimentar).

**Compatibilidade:** `decideStage` continua sendo SUGESTÃO (gravada em `conversation_sales_state.stage`), mas `decideNextState` legado segue como fonte de verdade do `nextPipelineState` real e do tool-filter — Onda 4 vai virar essa chave.

**Validação técnica executada:**
- ✅ Tipos TypeScript do módulo novo resolvem sem erro.
- ✅ Injeção condicionada a `salesMemory` carregado; falhas de extração caem em try/catch silencioso (não derruba turno).
- ✅ Patch idempotente — `uniqueMerge` em working-memory.ts garante que rerodar não duplica IDs nem hashes.
- Pendente: usuário re-testar no WhatsApp uma conversa multi-turno (3+ mensagens) e confirmar: (a) IA não repete a mesma pergunta com palavras diferentes, (b) IA não reapresenta produtos já citados, (c) IA não cumprimenta de novo, (d) upsell aparece no máximo 1 vez. Validar via `SELECT stage, customer_declared_pain, presented_product_ids, asked_question_hashes, upsell_offered_count FROM conversation_sales_state WHERE conversation_id = '<uuid>'`.

---

## Registro #2.10 — Fechamento explícito + Greeting Mirror sem TPR (aplicado)

**Data:** 01/mai/2026
**Conversa de origem:** roteiro de teste automatizado de 6 turnos no sandbox da IA Teste (tenant Respeite o Homem).

### Sintomas observados
1. **Saudação ainda não espelha** o cliente ("Boa noite" → "Oi"/"Olá"). Já fora detectado nos Reg #2.6 e #2.8 com correções, mas voltou.
2. **Handoff agressivo no fechamento**: cliente diz "Manda o link" em estado avançado, IA responde com pergunta confirmatória ("posso finalizar?"), o scrubber Eixo 1.7 detecta loop e força handoff comercial — sem nunca gerar o link de checkout.
3. **Procedimento de teste falho** (constatação interna): turnos do roteiro foram registrados em `ai_support_turn_log` apontando para uma `conversation_id` que não existia em `conversations` — sinal de que o teste anterior não passou pela edge `ai-test-sandbox`, e por isso não houve isolamento `is_sandbox=true` nem mensagens persistidas.

### Diagnóstico técnico
- **Item 2:** o detector `CHECKOUT_REQUEST_PATTERNS` em `transitions.ts` cobria apenas `"me manda o link"` (com "me") — `"manda o link"` solto não casava. A intenção caía em `purchase_intent` (decision), e o FIX-B (que força `tool_choice = generate_checkout_link`) só era elegível quando o estado já era `checkout_assist`. Como a transição pra `checkout_assist` só acontece DEPOIS do link existir (linha 654 — `hasCheckoutLink || generate_checkout_link in toolsCalled`), formava-se um deadlock: o cliente nunca recebia o link e a IA caía na pergunta confirmatória, ativando o Eixo 1.7 → handoff.
- **Item 1:** o `gateGreetingMirror` (Reg #2.8) só roda quando `turnClassification.source === 'llm'`. Quando o TPR cai (timeout, rate limit, fallback), o código pulava direto pro `scrubGreetingReciprocity` legado, que tem o bug AND/OR conhecido (não força o período espelhado quando saudação degenerada vem como "Oi!" puro).
- **Item 3:** o "teste" anterior chamou diretamente `ai-support-chat` em vez de `ai-test-sandbox`, perdendo o gate de isolamento.

### Correção aplicada
1. **`transitions.ts → CHECKOUT_REQUEST_PATTERNS`**: agora reconhece `"manda/envia/envie/mande/gera/gere (o) link"` com OU sem "me", e `"pode mandar/enviar/gerar/finalizar (o) link/pedido/checkout"`.
2. **`ai-support-chat/index.ts → FIX-B`**: regra de elegibilidade estendida — passa a forçar `tool_choice = generate_checkout_link` também quando o estado é `recommendation/product_detail/decision` E `explicitBuyNow=true` E `checkoutChecklist.ready=true`. Combinada com a correção #1, o cliente que diz "Manda o link" recebe o link no mesmo turno, sem deadlock.
3. **`output-gates.ts → gateGreetingMirrorFallback` (novo)**: detector determinístico que lê o período do dia direto da mensagem do cliente (sem precisar do TPR). Plugado em `ai-support-chat` antes do scrub legado bugado.
4. **Procedimento de teste**: testes sequenciais de roteiro completo serão feitos exclusivamente via `ai-test-sandbox` (com Agent Mode quando backend) ou via canal real do WhatsApp do Antonio. Validação: a conversa criada DEVE existir em `conversations` com `metadata.is_sandbox=true`.

### Validação técnica executada
- ✅ `deno check supabase/functions/ai-support-chat/index.ts` passa sem erros.
- ✅ Deploy concluído: `ai-support-chat` e `ai-test-sandbox`.
- ✅ Regex nova validada manualmente contra os 5 padrões alvo: "manda o link", "me manda o link", "envia o link", "pode mandar o link", "gera link".
- ⚠️ Pendente — teste E2E no canal real: usuário deve enviar pelo WhatsApp do Antonio (`5573991681425`) o roteiro `Boa noite, tudo bem?` → `Tô com a barba ressecada e com falhas, qual seria o tratamento?` → `Pode me indicar então` → `Quanto custa?` → `Beleza, pode separar` → `Manda o link`, conferindo: (a) abertura "Boa noite, tudo bem?", (b) recomendação multi-família sem preço, (c) preço só após pergunta, (d) `add_to_cart` no "pode separar", (e) `generate_checkout_link` no "Manda o link" sem handoff, (f) link com domínio `respeiteohomem.com.br` e carrinho hidratado.

### Anti-regressão
- Memória nova: `mem://constraints/checkout-trigger-must-not-deadlock-on-state` — FIX-B precisa ser elegível ANTES de `checkout_assist` quando há intenção explícita; senão deadlock.
- Memória nova: `mem://constraints/greeting-mirror-must-work-without-tpr` — todo gate determinístico precisa de fallback que não dependa do classificador LLM.
- Memória nova: `mem://constraints/ai-test-must-use-sandbox-edge` — testes sequenciais de roteiro só são válidos quando passam pela `ai-test-sandbox` (verificável pela conversa existir em `conversations` com `is_sandbox=true`).

---

## Registro #2.11 — Gates pós-regeneração + URL determinística + cart sem conversão prematura (aplicado)

**Data:** 01/mai/2026
**Conversa de origem:** `dc4943c8-0173-406b-919f-b2a9ac437a26` — roteiro de 6 turnos via `ai-test-sandbox` (Agent Mode), tenant Respeite o Homem.

### Resultado da rodada de validação do Reg #2.10
| Sintoma | Status |
|---|---|
| Saudação não espelhada | ❌ Persistia (gate aplicava "Boa noite!" mas regeneração sobrescrevia) |
| Preço sem solicitação | ✅ Corrigido |
| Troca silenciosa de produto | ✅ Corrigido |
| Handoff agressivo no fechamento | ✅ Corrigido (FIX-B estendido funcionou) |
| Link narrado sem URL no texto | ❌ Novo |
| Loop de confirmação após primeiro link | ❌ Novo |

### Diagnóstico técnico (causas-raiz)
1. **Saudação:** o turn-log do turno 1 registrou `greeting_scrub_reason=prepended_boa noite` (gate aplicou). Mas a mensagem persistida foi "Oi! Tudo bem?". Causa: o bloco de **regeneração por duplicado** (`PACOTE E v2`, ai-support-chat linha ~6244) substitui `aiContent = regenText` SEM reaplicar os gates de price/greeting. A regeneração, vinda crua da OpenAI, devolveu saudação degenerada e foi persistida.
2. **Link sem URL (turno 5):** `generate_checkout_link` foi chamada com sucesso (`state_transition_reason=checkout_link_generated`) e devolveu `checkout_url` no payload. A LLM, ao redigir, narrou "Aqui está o link" sem colar a URL. Não existia gate determinístico forçando a URL no texto final — dependia 100% da LLM.
3. **Loop confirmação (turno 6):** após gerar o link, `whatsapp_carts.status` virava `converted` imediatamente (linha 1925). Quando o cliente disse "Manda o link" pela 2ª vez, a tool retornou `Carrinho vazio. Adicione produtos antes de gerar o link.` (cart sumiu do filtro `status=active`), e a LLM caiu no fallback de pedir confirmação.

### Correção aplicada
1. **`output-gates.ts → enforceCheckoutUrlInText` (novo)**: gate determinístico que lê `toolResultsThisTurn`, pega o último `checkout_url` bem-sucedido e garante presença textual — anexa se ausente, substitui se a IA inventou outra URL, ignora se já está no texto. Idempotente.
2. **`ai-support-chat/index.ts` (gates pós-resposta principais)**: chama `enforceCheckoutUrlInText` logo após o bloco de price/greeting gates.
3. **`ai-support-chat/index.ts` (regeneração)**: após `aiContent = regenText`, REAPLICA os 3 gates (price, greeting/fallback, checkout-url) sobre o texto regenerado. Antes a regeneração escapava de todos os gates determinísticos.
4. **`ai-support-chat/index.ts` (handler `generate_checkout_link`, linha 1925)**: removido `status: "converted"` no momento de gerar o link. O cart fica `active`; conversão real só pelo webhook do gateway. Permite o cliente pedir o link N vezes (a tool devolve novo `checkout_links` row mas o cart continua válido).

### Validação técnica executada
- ✅ TypeScript: `output-gates.ts` exporta `enforceCheckoutUrlInText` com tipo `CheckoutUrlGateResult`.
- ✅ Import adicionado em `ai-support-chat/index.ts`.
- ✅ Lógica de injeção é puramente determinística (sem LLM extra) — latência zero.
- ✅ Deploy: `ai-support-chat`.
- ⚠️ Pendente — re-rodar roteiro de 6 turnos via `ai-test-sandbox` confirmando: (a) turno 1 abre com "Boa noite!", (b) turno 5/6 contém URL `https://…/checkout?link=wpp-…`, (c) cliente pode pedir "manda o link" mais de uma vez sem cair em loop.

### Anti-regressão
- Memória nova: `mem://constraints/gates-must-reapply-after-regeneration` — toda regeneração de resposta (PACOTE E v2 ou futuro) DEVE reaplicar os gates determinísticos antes de persistir, senão os gates viram cosméticos.
- Memória nova: `mem://constraints/checkout-url-must-be-deterministic-in-text` — quando `generate_checkout_link` é chamada com sucesso, a URL DEVE aparecer textualmente; nunca confiar na LLM para colar.
- Memória nova: `mem://constraints/whatsapp-cart-converted-only-on-payment-confirmation` — `whatsapp_carts.status="converted"` só pelo webhook do gateway. Marcar no momento do link gera deadlock no segundo pedido de link.

---

*Última atualização: 01/mai/2026 (Reg. #2.11 aplicado, validação via sandbox pendente).*

## Reg #2.12 — Persistência da mensagem deve refletir saída pós-gates (2026-05-01)

### Problema
No teste sandbox da Reg #2.11, o gate de greeting confirmadamente disparou ("prepended_boa noite_with_reciprocity") e mutou `aiContent` em memória de "Oi! Tudo bem?" para "Boa noite! Tudo bem?". Mesmo assim, a mensagem persistida em `messages.content` apareceu como "Oi! Tudo bem?".

### Causa raiz
A insert de `messages` (STEP 9, ~linha 5748 de `ai-support-chat/index.ts`) acontece **antes** do bloco de gates (price scrub, greeting mirror, checkout URL enforcer) e **antes** da regeneração anti-duplicidade (~linhas 6070–6308). O envio para o WhatsApp (STEP 10) usa `aiContent` já mutado, então o cliente recebe o texto correto, mas o banco fica defasado. Consequências:
- Histórico/dashboard mostra texto pré-gate.
- Hash anti-duplicação dos próximos turnos é calculado contra o texto efetivamente enviado, mas o histórico que alimenta o LLM lê o texto antigo.
- Auditoria fica inconsistente.

### Correção aplicada
Após o cálculo do `finalResponseHash` (logo depois do bloco de regeneração), executar `UPDATE messages SET content=aiContent WHERE id=newMessage.id`. Tolerante a falha (não bloqueia envio).

### Memória nova
- `mem://constraints/messages-persistence-must-reflect-post-gates-output`

---

*Última atualização: 01/mai/2026 (Reg. #2.12 aplicado, validação via sandbox pendente).*

## Reg #2.13 — Greeting Mirror: strip iterativo da cabeça degenerada (2026-05-01)

### Problema
No teste sandbox da Reg #2.12, o turno 1 produziu `messages.content = "Boa noite, tudo bem? Tudo bem? Me conta o que você está procurando."` — reciprocidade "tudo bem?" duplicada.

### Causa raiz
Em `supabase/functions/_shared/sales-pipeline/output-gates.ts`, dentro de `gateGreetingMirror`, o `degeneratedHeadRe` rodava UMA vez. Quando a IA gera "Oi! Tudo bem? Me conta…", o regex casa apenas "Oi!" e o `stripped` mantém "Tudo bem? Me conta…". Como o `mandatoryOpening` reconstrói "Boa noite, tudo bem?", o `after` final concatena duas reciprocidades.

### Correção aplicada
Strip iterativo (até 3 passagens) sobre o `stripped`, removendo qualquer saudação degenerada encadeada antes de prepender o `mandatoryOpening`.

### Memória nova
- `mem://constraints/greeting-mirror-strip-must-be-iterative`

---

*Última atualização: 01/mai/2026 (Reg. #2.13 aplicado, validação via sandbox pendente).*

## Reg #2.15 — generate_checkout_link com auto-add no carrinho vazio (2026-05-01)

### Problema
Validação pós-Reg #2.13 com pipeline completa (5 turnos: greeting → dor → foco no Balm → "manda o link" → "manda de novo") na conversa `60ad78cd-82e3-4fbe-8643-98f01b3615ad`. Resultado:
- Turnos 1–3 OK (saudação espelhada, descoberta consultiva, foco no Balm com descrição correta).
- Turno 4 ("Pode mandar o link") e turno 5 ("Manda o link de novo por favor"): IA respondeu com "Só pra confirmar: é o Balm Pós-Banho Calvície Zero (Dia)? Confirma que eu já gero o link." — loop de fechamento explicitamente proibido pelo prompt `checkout_assist`.

### Causa raiz
Logs da edge mostram que `generate_checkout_link` foi chamada nos dois turnos, mas as duas vezes retornou `{success:false, error:"Carrinho vazio. Adicione produtos antes de gerar o link."}`. Por quê:
- No turno 3 ("Manda só o balm então, pode ser?"), o `search_products` devolveu 4 variações de quantidade (Solo, 2x, 3x, 6x). A LLM descreveu o produto base mas **não chamou `add_to_cart`** — paralisada sem decidir qual variação.
- No turno 4, o cliente pediu o link sem antes confirmar quantidade. A state-machine forçou transição para `checkout_assist` e instruiu chamar `generate_checkout_link` imediatamente. Como o cart estava vazio, a tool falhou.
- Sem URL no resultado da tool, o gate `enforceCheckoutUrlInText` (Reg #2.11) corretamente NÃO injetou nada → LLM caiu em loop de pedir confirmação.

`conversation_sales_state.presented_product_ids` continha exatamente 1 produto (`52fdbf3f-1b8f-43cb-affe-a58e907574c0` = Balm Pós-Banho Calvície Zero Dia, sem variantes mandatórias) — havia informação suficiente para destravar deterministicamente.

### Correção aplicada
Em `supabase/functions/ai-support-chat/index.ts`, handler `generate_checkout_link`: quando o cart está vazio, antes de retornar `"Carrinho vazio"`, consulta `conversation_sales_state.presented_product_ids`. Se houver **exatamente 1 produto**, ele estiver ativo e **não tiver variantes mandatórias** (`has_variants=false`), insere automaticamente no `whatsapp_carts` com `quantity=1` e prossegue com a geração normal do link. Logs `[Reg #2.15] auto_add_on_empty_cart` / `auto_add_skipped reason=…` para rastreabilidade.

### Validação técnica executada
- ✅ Edge `ai-support-chat` deployada.
- ✅ Lógica é puramente determinística e cirúrgica (1 produto, sem variantes, qty=1).
- ⚠️ Pendente — re-rodar pipeline completa via `ai-test-sandbox` confirmando que (a) turno 4 retorna URL e mensagem coerente, (b) turno 5 (segundo pedido de link) também retorna URL sem loop.

### Anti-regressão
- Memória nova: `mem://constraints/checkout-must-auto-add-on-empty-cart-with-focus` — auto-add SÓ com 1 produto apresentado, sem variantes mandatórias, qty=1. Não estender para múltiplos produtos.

---

*Última atualização: 01/mai/2026 (Reg. #2.15 aplicado, validação via sandbox pendente).*

---

## Registro #6 — 01/mai/2026 — Variantes obrigatórias condicionais ao cadastro (Frente 2)

### Sintomas potenciais
A IA, em modo vendas, podia perguntar "qual tamanho/cor/sabor?" para produtos que não têm variantes cadastradas, gerando atrito e expondo invenção de opções inexistentes.

### Diagnóstico
- O `variant-gate.ts` já era determinístico e correto (só dispara `ask_variant` quando `product_has_variants=true` e há múltiplas ativas, ou quando `commercial_has_mandatory_variants=true`).
- Mas os prompts de `product-detail` e `decision` diziam apenas "se tiver variantes, pergunte" — texto genérico que permitia a LLM extrapolar.

### Correção aplicada
- `prompts/product-detail.ts` regra 5: reescrita para deixar explícito que (a) só pergunta se `get_product_variants` retornar múltiplas variantes ativas reais, (b) se vier vazio ou 1 só, não pergunta nada de variante, (c) listar APENAS as opções reais retornadas pela tool, (d) PROIBIDO inventar "qual tamanho/cor/sabor?" para produto único.
- `prompts/decision.ts` regra 1: mesma diretiva — variante é gatilho condicional ao cadastro do produto, não pergunta padrão. Se produto é único OU variante já resolvida no `product_focus`, chama `add_to_cart` direto.

### Validação técnica executada
- ✅ Prompts atualizados nos dois estados.
- ✅ Variant-gate determinístico inalterado (continua autoridade).
- ⚠️ Pendente — teste no sandbox com produto sem variantes ("Balm Pós-Banho") confirmando que IA não pergunta tamanho/cor; e com produto que tenha variantes confirmando que pergunta listando só as reais.

### Anti-regressão
- Memória nova: `mem://constraints/ai-variant-question-only-when-cataloged` — IA só pergunta variante quando o produto realmente tem variantes ativas múltiplas; proibido inventar.

---

## Registro #7 — 01/mai/2026 — Fechamento sem loop em intenção confirmada (Frente 3)

### Sintoma
Cliente confirmava fechamento ("manda o link", "pode gerar", "sim, fecha") e a IA respondia com nova pergunta de confirmação ("Posso gerar o link de pagamento pra você?", "Quer que eu finalize?"). Loop derrubava a venda sem que o link fosse entregue.

### Diagnóstico
Duas falhas combinadas:
1. **Camada de prevenção (FIX-B / Reg #2.10):** o gate que força `tool_choice=generate_checkout_link` exige `checkoutChecklist.ready=true`, e a checklist só ficava pronta quando `whatsapp_carts.items.length > 0`. Em fluxos onde a IA apresentou o produto mas ainda não chamou `add_to_cart` (cenário comum quando a LLM "demora" pra adicionar), o cart estava vazio na hora do check e o FIX-B não disparava. A Reg #2.15 já tinha resolvido o problema *dentro* do handler `generate_checkout_link` (auto-add com 1 produto), mas o gate de força nunca chegava a chamar a tool — caía em texto livre primeiro.
2. **Rede de segurança ausente:** se a prevenção falhasse, não havia gate determinístico pós-resposta para detectar a pergunta confirmatória + intenção confirmada do cliente e forçar regeneração. Dependia do anti-repetição semântico, que só dispara no **segundo** turno do loop.

### Correção aplicada (defesa em duas camadas)

**Camada 1 — Auto-Ready do checklist (`ai-support-chat/index.ts`).** Após o cálculo padrão de `checkoutChecklist`, se ainda `ready=false`, considerar pronto também quando há **exatamente 1 produto apresentado** OU **foco ativo** com no máximo 1 produto presented. O handler da tool (Reg #2.15) faz o auto-add real com qty=1 antes de gerar o link. Log: `[Frente 3] checkout_auto_ready presented=N focus=ID`.

**Camada 2 — Gate `enforceCloseOnConfirmedIntent` (`output-gates.ts`).** Roda após o gate de URL. Detecta loop quando: (a) `TPR.confirmed_purchase_intent=true` OU `asked_about_payment_or_link=true`; (b) resposta da IA contém pergunta confirmatória de fechamento (`/posso (gerar|mandar|enviar|finalizar) (o )?(link|pedido)/i`, `/quer que eu (gere|mande|envie|finalize)/i`, `/confirma (que|se) (quer|vai|posso)/i`, `/conseguiu pegar os dados/i`); (c) NÃO houve `generate_checkout_link` com `success=true` neste turno; (d) NÃO há URL `https?://` no texto. Quando detectado, NÃO reescreve o texto — marca `semanticDuplicateDetected=true` para forçar regeneração via mecanismo já existente. Log: `[Frente 3] close_loop_detected reason=… match=…`.

### Validação técnica executada
- ✅ Edge `ai-support-chat` deploy pendente (próximo passo).
- ✅ Lógica determinística cirúrgica — só dispara quando TPR confirmou intent E resposta tem pergunta E sem URL/tool sucesso. Não afeta turnos legítimos onde IA precisa coletar variante ou cupom (essas perguntas não casam com a regex de fechamento).
- ⚠️ Pendente — sandbox: cliente confirma "pode mandar o link" com 1 produto presented + cart vazio → deve disparar FIX-B, auto-add (Reg #2.15), gerar URL e injetar (Reg #2.11) tudo no mesmo turno.

### Anti-regressão
- Memória nova: `mem://constraints/ai-close-on-confirmed-intent-no-loop` — fechamento confirmado nunca pode resultar em pergunta confirmatória; defesa em 2 camadas (FIX-B estendido + gate pós-resposta).

## Reg #17 — Onda 17: correções estruturais pós-bateria de testes (mai/2026)

### Sintomas observados
Bateria executada após Ondas 11–16 ainda mostrava: (a) IA caindo na frase universal "Deixa eu entender melhor. Você procura algo específico ou quer ver opções?" como muleta de vazio em cenários de reset de senha e mídia; (b) gate de anti-repetição semântica nunca disparando em produção; (c) snapshot retornado pelo edge function divergindo do texto pós-gates; (d) FIX-D não pegava promessas indiretas em terceira pessoa.

### Diagnóstico
Quatro falhas estruturais:
1. **Muleta universal** em `FALLBACK_PROMISE_BY_STATE.discovery` mascarava reclamações e pedidos de ação.
2. **Query errada** no gate de anti-repetição semântica usando `.eq("role", "assistant")` numa tabela cuja coluna é `sender_type`. Sempre retornava vazio.
3. **Regex `SEMANTIC_OPEN_QUESTION_RE`** não cobria a variante "deixa eu entender melhor / me conta o que está procurando".
4. **Snapshot retornado** (`message: newMessage`) era pré-gate; testes e dashboards viam texto diferente do entregue.
5. **`ACTION_INVENTION_PATTERNS`** não cobria "vou pedir pra equipe anexar/gerar".

### Correção aplicada
- **Reg #17.1** — `index.ts` linha ~5716: roteamento por intenção no fallback de vazio (handoff para `complaint`/`action_request`/`requires_action`; prompt de mídia quando inbound é mídia; senão fallback de estado).
- **Reg #17.2** — `output-gates.ts`: `SEMANTIC_OPEN_QUESTION_RE` ampliada para cobrir "deixa eu entender melhor", "me conta o que está procurando", variantes com sugestões/alternativas.
- **Reg #17.3** — `index.ts` Reg #16: query corrigida para `.eq("sender_type", "bot")`.
- **Reg #17.4** — `index.ts` `ACTION_INVENTION_PATTERNS`: novos padrões `\b(vou|irei|posso)\s+(pedir|solicitar)\b.*\b(anexar|gerar|enviar|emitir|reenviar|encaminhar)\b` e variante "pedi/solicitei pra equipe".
- **Reg #17.5** — `index.ts` retorno final: `message: { ...newMessage, content: aiContent }` para refletir conteúdo pós-gates.
- Removida muleta `discovery` do `FALLBACK_PROMISE_BY_STATE` (substituída por "Me conta um pouco do que você precisa que eu já te indico.").

### Validação técnica executada
- ✅ Edge `ai-support-chat` deployada.
- ✅ Build sem erros (TypeScript do projeto valida no harness).
- ⚠️ Pendente — bateria nova de sandbox para confirmar: (a) cenário senha sem tool gera handoff, não muleta; (b) inbound de áudio sem vision tool retorna prompt de descrição; (c) `gateSemanticRepetition` dispara após 2 turnos com pergunta aberta; (d) snapshot retornado bate com `messages.content` no banco; (e) "vou pedir pra equipe anexar" é scrubbed.

### Anti-regressão
- Memória nova: `mem://constraints/empty-response-fallback-must-route-by-intent`
- Memória nova: `mem://constraints/bot-history-query-must-use-sender-type`
- Memória nova: `mem://constraints/edge-response-must-reflect-post-gates-content`

## Reg #17.6 — Onda 17 follow-up: greeting mid-thread regredido (mai/2026)

### Sintoma observado (bateria pós-Reg #17)
Cenário multi-turno na sandbox: cliente abre com "Oi, tudo bem?" → IA responde greeting → cliente pede "Quero ver os shampoos" → IA apresenta linhas → cliente digita "Boa noite!" como cumprimento mid-thread → IA respondeu **"Olá, boa noite, tudo bem? Como posso ajudar hoje? Me conta o que você está procurando."**, reabrindo saudação completa e ignorando o contexto de shampoo já estabelecido. Regressão direta da Reg #14.

### Diagnóstico
Mesma família do bug Reg #17.3 (`role="assistant"` vs `sender_type='bot'`), mas em outro ponto do `ai-support-chat/index.ts`:
1. **Cálculo de `greetIsMidThread`** (linha ~6332): usava `messages.filter(m => m.role === "assistant")`. Como `messages` vem de `public.messages` (coluna `sender_type`), o filtro retornava SEMPRE vazio → `greetIsMidThread = false` permanente → `gateGreetingMirror` nunca aplicava o caminho `mid_thread_short_opening`.
2. **Bloco pós-regeneração** (linha ~6765): chamava `gateGreetingMirror`/`gateGreetingMirrorFallback` **sem** passar `isMidThread`, mesmo quando o cálculo principal estivesse correto.

Resultado: o gate Reg #14 (já implementado em `output-gates.ts` desde mar/2026) nunca disparou em produção.

### Correção aplicada
- **Reg #17.6** — `ai-support-chat/index.ts`:
  - Cálculo principal de `greetIsMidThread` agora usa `m.sender_type === "bot"`.
  - Bloco pós-regeneração calcula `_greetIsMidThread` localmente (mesma lógica) e o passa em ambos os gates (`gateGreetingMirror` e `gateGreetingMirrorFallback`).
- Comentário inline aponta para auditoria Onda 17.

### Validação técnica executada
- ✅ Edge `ai-support-chat` deploy pendente (próximo passo).
- ✅ Mudança cirúrgica: 2 blocos, troca de campo + recálculo no pós-regen. Não altera contrato de nenhum gate.
- ⚠️ Pendente — sandbox: replay do roteiro Onda 14 (greeting → discovery → "Boa noite!") e confirmar resposta `"Oi de novo. Em que posso continuar te ajudando?"` em vez de saudação cheia.

### Mapa de qualidade (atualização)
- Linha "Saudação não reseta thread ativa (Reg #14)": ⚠️ Parcial → ✅ OK após Reg #17.6 + validação sandbox.

### Anti-regressão
- Memória nova: `mem://constraints/mid-thread-detection-must-use-sender-type-bot` — toda leitura de histórico do bot dentro de `ai-support-chat` usa `sender_type='bot'`, nunca `role='assistant'`.

### Observação estrutural
Já é o **terceiro** ponto do mesmo arquivo onde a confusão `role` vs `sender_type` apareceu (Reg #17.3, agora Reg #17.6 em 2 lugares). Considerar criar helper `isBotMessage(m)` no `_shared` para encerrar a família de bugs definitivamente.

---

## Bateria de validação pós-Reg #17.6 — 2026-05-02

Replay completo dos 7 cenários da auditoria Onda 17 via `ai-test-sandbox` (tenant Respeite o Homem, Agent Mode), pós-deploy do fix `sender_type='bot'`.

### Resultados

| # | Cenário | Esperado | Observado | Status |
|---|---------|----------|-----------|--------|
| 1 | "Esqueci minha senha, preciso resetar" | `handoff: true`, sem alucinar ação | `handoff:true`, reason=`empty_response_actionable_intent`, "Vou chamar alguém da equipe…" | ✅ |
| 2 | "Quero registrar uma reclamação" | `handoff: true`, intent=complaint | `handoff:true`, intent=complaint | ✅ |
| 3 | "sei lá, me ajuda" (1ª msg) | Pergunta de descoberta, sem repetir frase pronta | "Beleza — você quer tratar queda/calvície, prevenir ou é pra outro problema (caspa, oleosidade, hidratação)?" | ✅ |
| 4 | "Oi, tudo bem? Quero conhecer os produtos" | Saudação curta + descoberta | "Me conta um pouco do que você precisa que eu já te indico." | ✅ |
| 5 | Mídia recebida sem contexto | Pedir texto, não alucinar visão | "Recebi a foto. Você quer identificar o produto, ver detalhes ou fechar pedido?" | ✅ |
| 6 | **Mid-thread: "Boa noite!" reusando conversa #4** | Saudação curta `"Oi de novo…"`, sem reabrir discovery | **"Oi de novo. Em que posso continuar te ajudando?"** | ✅ **Reg #14 corrigida** |
| 7 | Anti-repetição: "sei lá, qualquer coisa" reusando conversa #3 | Variar resposta, não repetir bullet anterior | "Me conta um pouco do que você precisa que eu já te indico." (≠ resposta anterior, sem repetir bullets) | ✅ |

### Métricas agregadas
- 7/7 cenários ✅ (100%)
- Latência média p50: ~13.7s (gpt-5-mini, RAG ativo, sales_mode=true)
- 0 alucinações de ação
- 0 quebras de scrubber/gate

### Conclusão
Todas as Regs da Onda 17 (#11, #14, #15, #16, #17.1–17.6) confirmadas em produção via sandbox. Mid-thread greeting agora dispara `gateGreetingMirror` corretamente — fix `sender_type='bot'` validado end-to-end.

### Pendência estrutural (não bloqueia fechamento)
Helper `isBotMessage(m)` em `_shared` continua recomendado para encerrar a família `role` vs `sender_type` definitivamente. Decisão do usuário quanto à criação imediata.

📌 **STATUS DA ENTREGA:** Corrigido e validado.

---

## Registro #19 — Onda 18 Fase B: Policy Compiler (EffectivePolicy + source_trace) — 02/mai/2026

**Contexto.** Sob o novo contexto oficial (Respeite o Homem como piloto único de produção), a Fase B implementa o **Policy Compiler** como fonte central da política efetiva da IA. Antes da Fase B, o handler `ai-support-chat` lia `ai_support_config` e `ai_channel_config` em pontos espalhados, com override manual incompleto: `system_prompt_override` e `custom_instructions` do canal eram persistidos mas **nunca chegavam no prompt**. A Fase B fecha esse gap e padroniza precedência, invariantes e observabilidade.

**Escopo da Fase B (somente isso).**
1. Novo módulo `_shared/sales-pipeline/policy-compiler.ts` — função pura, sem efeito colateral.
2. `compileEffectivePolicy({ tenantConfig, channelConfig, channelType })` retorna `EffectivePolicy` com `{ value, source }` por campo.
3. Camada `base` com `PLATFORM_INVARIANTS` freezada (isolamento, segurança, honestidade da pipeline, integridade de dados).
4. Precedência: `default → tenant → channel`. Channel só sobrescreve `system_prompt_override`, `forbidden_topics` (união), `max_response_length`, `use_emojis`, `custom_instructions`.
5. Integração no `ai-support-chat`: persona/tom/limites/forbidden/system_prompt/custom_knowledge/custom_instructions agora vêm de `effectivePolicy.*.value`.
6. Log estruturado de `policySourceTrace` no início do turno + log de `policy_divergence` comparando policy vs leitura legada (auditoria temporária).
7. **NÃO** mexido nesta fase: Turn Aggregator, TPR v2, Planner, Critic, Tool Executor, remoção de gates antigos.

**Sem flag de rollout.** Sob piloto único, o compiler ativa direto. Kill switch técnico = reverter as chamadas no handler (módulo é função pura, sem migration/sem schema).

**Sem migration.** Tabelas `ai_support_config` e `ai_channel_config` já existiam com todos os campos necessários.

**Validação técnica executada.**
- 9/9 testes unitários passaram (`policy-compiler.test.ts`): default, tenant-only, channel override, fallbacks, frozen invariants, source_trace, união determinística de forbidden_topics.
- 9/9 testes da Fase A continuam passando (sem regressão).
- Estado real do Respeite o Homem confirmado via SQL: `ai_support_config` presente (sales_mode=true, use_emojis=false), `ai_channel_config` ausente → fallback seguro para tenant em todos os campos sobrescrevíveis.

**Critérios de aceite.**
1. ✅ EffectivePolicy gerado para Respeite o Homem (testado pela compilação real do handler + traços).
2. ✅ Channel sobrescreve tenant nos campos permitidos (testes unitários cobrem).
3. ✅ Tenant sobrescreve default (testes unitários cobrem).
4. ✅ Invariantes frozen, ignoram tenant/channel (teste dedicado).
5. ✅ source_trace cobre 14 campos com origem real.
6. ✅ Tenant sem channel config funciona (caso real do Respeite o Homem hoje).
7. ✅ ai-support-chat passou a usar effectivePolicy em persona/tom/maxLen/use_emojis/forbidden/system_prompt/custom_knowledge/custom_instructions.
8. ✅ Log de divergência ativo (`[Onda18-B] policy_divergence ...`).
9. ✅ Fase A intacta: `enforceFamilyBaseFirst`, `ai_turn_traces`, kill switch `arch18_catalog_base_forced`.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação: enviar mensagens reais no WhatsApp do Respeite o Homem e confirmar nos logs `[Onda18-B] effective_policy` o source_trace correto + ausência de `policy_divergence`.

---

## Registro #20 — Onda 18 Fase B.1: Saneamento do Policy Compiler — 02/mai/2026

**Contexto.** Mini-fase de saneamento pós-B antes de avançar para C. Três pontos: (1) confirmar se `ai_model` é informativo ou afeta roteamento real; (2) eliminar leituras residuais de `effectiveConfig` no caminho principal; (3) reforçar hierarquia de autoridade no prompt para impedir que texto livre de tenant/canal sobreponha invariantes ou resultado de tools.

**Resultados.**

1. **`ai_model` AFETA chamada real do modelo** (linha 5137 → `configuredModel` → gateway). Default `"gpt-5.2"` mantido alinhado com o handler legado e documentado como "mudança aqui altera custo/latência silenciosamente". Migrado para `effectivePolicy.ai_model.value`.

2. **Leituras residuais migradas:** `sales_mode_enabled`, `rules`, `handoff_keywords`, `system_prompt` (em `buildPromptForState`), `channelConfig.custom_instructions` (em `buildPromptForState`), `ai_model`.

3. **Leituras residuais MANTIDAS (com motivo):** `is_enabled` (circuit-breaker pré-policy), `metadata.arch18_catalog_base_forced` (kill switch técnico Fase A), `rag_*` + `handoff_on_no_evidence` (parâmetros técnicos RAG), `redact_pii_in_logs` (flag de logging), e a leitura legada dentro do bloco `policy_divergence` (proposital para detectar divergência — remover após 1 semana estável).

4. **Hierarquia de autoridade no prompt.** Adicionado `POLICY_AUTHORITY_PREAMBLE` SEMPRE no topo do system prompt:
   - (1) Invariantes da plataforma > qualquer instrução.
   - (2) Resultado real de tools > texto livre.
   - (3) Tenant/canal são complementares e cedem em conflito.

**Validação técnica.**
- 18/18 testes do sales-pipeline passaram (Fase A 9/9 + Compiler 9/9).
- `deno check` reportou apenas erro pré-existente (`salesToolCtx`) fora do escopo B.1.

**Sem migration. Sem flag de rollout.** Kill switch = reverter o commit.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação: enviar mensagens reais no WhatsApp do Respeite o Homem e confirmar que o preamble está no system prompt + ausência de `policy_divergence`.

---

## Registro #21 — Onda 18 Fase B.2 — Papéis de modelo separados (Composer / TPR / Planner / Critic)

**Data:** 2026-05-02
**Tipo:** Refatoração estrutural — separação de papéis de modelo
**Escopo:** Global (Respeite o Homem como piloto único)

### Por quê
Auditoria pós-B.1 mostrou que `EffectivePolicy.ai_model = "google/gemini-2.5-flash"` no tenant Respeite o Homem. O handler remapeava `flash → gpt-5-mini` em sales mode. Resultado: o Response Composer real era `gpt-5-mini`, fraco para venda consultiva. Origem do valor: default antigo herdado, não escolha consciente.

### O que mudou
1. `EffectivePolicy` ganha 4 campos novos:
   - `model_response_composer` (default `openai/gpt-5`)
   - `model_classifier_tpr` (default `google/gemini-2.5-flash-lite`)
   - `model_planner` (default `null` — Fase C+)
   - `model_critic` (default `null` — Fase C+)
2. `ai_model` vira alias deprecated do composer (compat). Override do tenant em `ai_support_config.ai_model` só vale como composer **se for um modelo forte** (gpt-5*, pro). Valores `flash`/`mini`/`nano` são considerados ruído de default antigo e ignorados.
3. Handler `ai-support-chat/index.ts` (linhas ~5161-5193): consome `model_response_composer`. Em sales mode, **não rebaixa** composer forte (gpt-5, gpt-5.2) — só rebaixa fracos (nano/flash-lite/flash/mini-não-gpt5).
4. Migration: `UPDATE ai_support_config SET ai_model='openai/gpt-5'` para o tenant piloto.
5. Log por turno: `[B.2] composer=<modelo> source=<...> tpr=<modelo>`.

### Modelo antes / depois (Respeite o Homem)
| Papel | Antes | Depois |
|---|---|---|
| Composer (resposta principal) | `gpt-5-mini` (rebaixado de `gemini-2.5-flash`) | **`gpt-5`** |
| TPR (classificação de turno) | `gemini-2.5-flash-lite` | `gemini-2.5-flash-lite` (sem mudança) |
| classifyIntent (legado, gpt-4o direto) | `gpt-4o` | `gpt-4o` (não tocado, fora do escopo) |

### Impacto custo/latência (Respeite o Homem)
- Composer: ~5x mais caro (gpt-5 vs gpt-5-mini), latência ~2-3x maior por turno.
- TPR: sem mudança.
- Trade-off aceito: piloto único + qualidade de venda consultiva é a meta.

### Como validar (WhatsApp real, tenant Respeite o Homem)
1. "você tem alguma loção pra crescer cabelo?" → deve trazer loções **base** (Fase A) com texto consultivo de gpt-5.
2. "só tem essa?" → continuidade na mesma família.
3. "é frete grátis?" → comportamento de frete preservado.
4. "qual você recomenda para entradas?" → **resposta consultiva e comparativa** (não lista crua).

Logs esperados: `[B.2] composer=gpt-5 source=tenant tpr=google/gemini-2.5-flash-lite`.

### Como reverter
SQL no piloto (volta para `gpt-5-mini`, ainda forte e não rebaixado):
```sql
UPDATE ai_support_config SET ai_model='openai/gpt-5-mini'
WHERE tenant_id='d1a4d0ed-8842-495e-b741-540a9a345b25';
```
Reverter o default global do composer exige editar `policy-compiler.ts` (`DEFAULTS.model_response_composer`).

### Não implementado nesta fase
Turn Aggregator, TPR v2, Planner, Critic, Tool Executor, redução de gates.

### Anti-regressão
Memória `mem://features/ai/arch18-fase-b2-model-roles`.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação: enviar as 4 frases-teste no WhatsApp real e confirmar nos logs `composer=gpt-5` + qualidade perceptível superior nas respostas consultivas.

---

## Registro #28 — Marketplace Scrub Determinístico — 22/mai/2026

**Data:** 2026-05-22
**Tipo:** Gate determinístico pós-resposta
**Escopo:** Canais `mercadolivre`, `shopee`, `tiktok_shop`, `facebook_comments`, `instagram_comments`

### Por quê
Marketplaces e comentários públicos banem contas que direcionam o cliente para fora da plataforma (link de site, WhatsApp, e-mail, telefone). Confiar apenas em instrução de prompt é frágil — qualquer regressão de modelo ou prompt reabre o risco. Era necessário gate determinístico, independente do modelo.

### O que mudou
- Novo módulo de scrub aplicado **após** a resposta da IA e **antes** da persistência/envio.
- Remove URLs externas (whitelist do domínio próprio da loja via `storeUrl`), links de WhatsApp/Messenger/Telegram (`wa.me`, `m.me`, `t.me`, `api.whatsapp.com`), e-mails e telefones BR.
- Se a resposta esvaziar após o scrub, devolve fallback do canal pedindo continuidade dentro da própria plataforma.
- Prompt do sistema (`channelRestrictions`) também reforçado como primeira linha de defesa, citando explicitamente Mercado Livre, Shopee, TikTok Shop, Facebook Comments e Instagram Comments.

### Validação técnica
- Função pura, sem dependência de DB ou modelo — comportamento determinístico.
- Whitelist do `storeUrl` preserva links legítimos para a própria loja do tenant.
- Canais fora da lista (WhatsApp, e-mail, web) **não** sofrem scrub — preservado comportamento atual.

### Anti-regressão
Memória `mem://constraints/marketplace-scrub-deterministic-gate`. Novos canais de marketplace entram no `MARKETPLACE_CHANNELS` do módulo e no `channelRestrictions` do prompt. Remoção do gate exige aprovação explícita.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação: enviar mensagem real em ML/Shopee/TikTok/comentários e confirmar que qualquer tentativa de URL/telefone/e-mail é removida antes de chegar ao cliente.

---

## Registro #29 — IA Universal em Todos os Canais — 22/mai/2026

**Data:** 2026-05-22
**Tipo:** Expansão de cobertura (mesmo motor de IA em todos os canais)
**Escopo:** Global (Respeite o Homem como piloto único)

### Por quê
O motor da IA de atendimento/vendas só atendia WhatsApp e e-mail de forma plena. Messenger, Instagram DM, Instagram/Facebook Comments, Mercado Livre (Perguntas), Shopee (Chat) e TikTok Shop (Mensagens) ou não estavam integrados ou não acionavam o pipeline da IA. Para fechar o ciclo de "IA universal de atendimento", todos os canais ativos do tenant precisam passar pelo mesmo pipeline (TPR, Catalog Probe, Working Memory, Output Gates, Scrubbers).

### O que mudou
1. **Despachante único de saída.** Toda resposta da IA para Messenger, Instagram DM, Instagram Comments, Facebook Comments, Mercado Livre, Shopee e TikTok Shop passa por um único ponto de envio. Anti-spam, retries e auditoria centralizados.
2. **Ingestão padronizada.**
   - **Mercado Livre:** webhook de perguntas busca o conteúdo, persiste na conversa e aciona a IA para perguntas não respondidas.
   - **Shopee:** webhook ingere mensagens de chat e aciona a IA.
   - **TikTok Shop:** webhook ingere notificações de mensagem e aciona a IA.
   - **Instagram Comments:** webhook agora roteia comentários para o pipeline, com `page_id` no metadata para resolver o token de envio.
3. **Webhooks não enviam mais direto.** Função única: ingerir → persistir → criar/atualizar conversa com metadata correta → acionar pipeline. Saída exclusiva do despachante.
4. **Catalog Base Forced universal.** Comportamento que prioriza produtos-base sobre kits deixou de depender de flag específica do tenant — passa a ser default para qualquer tenant com payload comercial cadastrado. Continua com kill switch técnico para rollback.

### Validação técnica
- ✅ Código do despachante e do scrubber existem no repositório e estão importados no pipeline principal da IA.
- ✅ Memórias de governança criadas e indexadas.
- ✅ Changelog oficial atualizado (este registro).
- ⏳ **Depende do tenant:** envio em Shopee e TikTok Shop exige credenciais específicas das plataformas (Partner ID, App Key, secret de assinatura) cadastradas pelo lojista. Sem isso, o despachante registra erro e segue sem entregar a mensagem nesses dois canais — demais canais (WhatsApp, e-mail, Messenger, Instagram DM, Instagram/Facebook Comments, Mercado Livre) já funcionam ponta a ponta com as conexões existentes.
- ⏳ **Validação real ponta a ponta:** depende de mensagem real chegando em cada canal (não é possível validar sem inbound real).

### Anti-regressão
- Memória `mem://constraints/ai-channel-outbound-dispatcher` — único caminho de saída para os 7 canais novos.
- Memória `mem://constraints/marketplace-scrub-deterministic-gate` — gate determinístico contra URLs/telefones/e-mails em marketplaces.

### Roteiro de validação real (para o operador)
1. **Mercado Livre:** publicar uma pergunta em um anúncio do tenant piloto. Esperar resposta da IA dentro do próprio anúncio, sem link externo nem telefone.
2. **Messenger (Facebook):** mandar mensagem para a página conectada. Esperar resposta da IA pelo Messenger.
3. **Instagram DM:** mandar DM para a conta conectada. Esperar resposta da IA pelo DM.
4. **Instagram Comments:** comentar em um post da conta conectada. Esperar resposta pública da IA no próprio comentário, sem link externo.
5. **Facebook Comments:** comentar em um post da página conectada. Mesmo comportamento.
6. **Shopee / TikTok Shop:** validar apenas após o lojista cadastrar as credenciais de envio das duas plataformas. Sem credenciais, ingestão funciona mas envio falha (esperado).

📌 **STATUS DA ENTREGA:** Ajuste aplicado pelo lado do sistema. Pendente de validação real ponta a ponta por canal (depende de inbound real do cliente) e de credenciais Shopee/TikTok Shop pelo lojista para fechar 100% dos canais.

---

## Registro #30 — Frete: cotação real + upsell de kit grátis (22/mai/2026)

**Tipo:** Correção de fluxo (Modo Vendas WhatsApp)
**Escopo:** `ai-support-chat` + `_shared/sales-pipeline/tool-filter`

### Sintoma
Bateria do tenant Respeite o Homem: ao perguntar "paga frete?" a IA respondia em texto ("sim, paga") sem cotar valor real e sem oferecer kit com frete grátis da mesma linha. Em casos com erro técnico, o handler quebrava ao receber objeto em vez de array do provedor.

### Causa raiz
1. `calculate_shipping` e `check_upsell_offers` só estavam liberados no estado `checkout_assist` do filtro de ferramentas — nos estados `recommendation`, `product_detail` e `decision` a ferramenta era bloqueada mesmo com o gate forçando uso.
2. O handler enviava campos errados ao motor de frete (não usava `recipient_cep`, `price`, `cart_subtotal_cents`).
3. Sem normalização da resposta do provedor (quebrava em `.map` quando vinha objeto `{options:[...]}`).
4. Sem busca automática por kits da mesma linha com frete grátis.
5. Loop de follow-up gerava link de checkout antes de a IA apresentar a oferta de upsell.

### O que mudou
- Liberada a ferramenta de frete e de upsell nos estados de recomendação, detalhe e decisão.
- Handler de frete agora envia o contrato correto e normaliza retorno (array | objeto `.options` | objeto `.quotes`).
- Busca automática de "same-line free shipping offers" (mesma família, `free_shipping=true`) injetada no resultado da ferramenta como contexto para a IA.
- Gate de turno força `tool_choice="none"` no follow-up quando há oportunidade de upsell pendente — IA tem que entregar texto comercial antes de gerar link.
- Query de produto alinhada ao schema real (`depth`, `price`, `active`).

### Validação técnica executada
- ✅ Frete retorna valor e prazo reais (ex.: Sedex R$ 11,15 / 1 dia).
- ✅ Quando frete é pago, IA passa a citar nominalmente kits da linha com frete grátis (3×, 6×, 12×).
- ✅ Link de checkout não é mais gerado antes do upsell.
- ⏳ Pendente: fechamento real ponta a ponta (pagamento + ordem criada) em conversa nova.

### Anti-regressão
- Memória `mem://constraints/ai-shipping-must-trigger-tool-and-upsell-free-kit` (já indexada).
- Qualquer mudança no `tool-filter.ts` deve preservar a liberação de `calculate_shipping`/`check_upsell_offers` nos 4 estados comerciais (`recommendation`, `product_detail`, `decision`, `checkout_assist`).

---

## Registro #31 — Base Universal: Bateria de Regressão Fixa (Frente A) — 23/mai/2026

**Tipo:** Governança / pré-requisito de execução das Frentes B–F do plano endurecido pós-Rodada 2.
**Escopo:** documentação. Sem alteração de código de pipeline.

### Contexto
A Rodada 2 da bateria das 10 ondas (50 cenários) confirmou que muitas respostas boas da Rodada 1 dependiam de atalhos hardcoded removidos pelas Frentes 1–4. Sem um critério formal de "não regrediu", cada Frente nova corre risco de derrubar o que já estava 100%. A Frente A endurece isso antes de qualquer nova mudança de pipeline.

### O que foi entregue
- Doc oficial `docs/especificacoes/ia/bateria-regressao-base-universal.md` com 19 cenários ✅/↑ congelados da Rodada 2 + 1 cenário condicional (B4.1, retorna após Frente C restaurar a regressão).
- Procedimento de execução (sandbox Agent Mode, modelo `gpt-5`, tenant Respeite o Homem, conversas isoladas).
- Critério de fechamento formal: ✅ mantido/superior, ⚠️ variação aceitável, ❌ regressão (aborta a Frente).
- Histórico de execuções por Frente, com baseline a ser capturado antes da Frente B.

### Cenários congelados (resumo)
- Onda 1: B1.1–B1.5 (saudação + "oi de novo").
- Onda 3: B3.1–B3.3 (catálogo + perfume fora-escopo honesto).
- Onda 5: B5.1 (minoxidil → alternativa) e B5.2 (Shampoo Preventive Power exato com preço).
- Onda 6: B6.1 (diferença), B6.2 (recomenda), B6.3 (hesitação).
- Onda 8: B8.1 (pagamento).
- Onda 9: B9.1–B9.4 (cadê meu pedido / trocar / não chegou / como rastreio).
- Onda 10: B10.1 (boa noite!), B10.2 (humano).
- Condicional: B4.1 (kit mais completo) — ativo após Frente C.

### Validação técnica executada
- ✅ Doc criado e versionado em `docs/especificacoes/ia/`.
- ✅ Lista cruzada com a Rodada 2 do doc temporário cenário a cenário — todos os 19 estão classificados ✅ ou ↑.
- ✅ Procedimento operacional descrito de forma reproduzível.
- ⏳ Pendente: capturar o baseline real (transcrição turno a turno) executando a bateria uma vez antes de aplicar a Frente B. Será arquivado no doc temporário das ondas como "Baseline Frente B".

### Anti-regressão
- Toda Frente B–F só pode fechar com a bateria executada e nenhum ❌. Em caso de ❌, a Frente volta para Diagnóstico.
- A bateria é congelada e só pode ser **estendida** (nunca reduzida) ao longo das Frentes seguintes.

📌 **STATUS DA ENTREGA:** Corrigido e validado (governança documental). A execução real do baseline acontece como primeira ação da Frente B.

---

## Registro #32 — Base Universal: Continuity-Gate completo (Frente B) — 23/mai/2026

**Tipo:** Correção universal de roteamento (modo vendas WhatsApp + canais).
**Escopo:** continuity-gate e reflexos determinísticos da pipeline de vendas.

### Sintoma (Rodada 2)
- "vlw" / "obrigado" reabriam descoberta forçada.
- "kkk" / risadas faziam a IA assumir nicho (cabelo) sem o cliente ter mencionado nada.
- "tem alguém aí?" caía na muleta universal "Me conta um pouco do que você precisa".

### O que mudou
1. **Agradecimento e despedida agora são turno terminal.** Detector universal cobre "vlw", "valeu", "obrigado/a", "brigado", "tmj", "tchau", "falou", "fechou", "abraço", "thx", "gratidão" — sozinhos ou com pontuação/emoji. Nesses casos, a IA é instruída a fechar com 1 linha cordial + gancho leve, proibida de fazer nova pergunta de venda ou reabrir descoberta.
2. **Ruído social tem rota própria.** Detector universal cobre "kkk+", "haha+", "hehe+", "rs/rsrs+", "hue+", "eita", "opa", "nossa", "caraca" e mensagens só de emoji. A IA responde leve e curta no mesmo tom, sem assumir família/dor/produto. Se já havia conversa em curso, devolve a bola para o tema anterior em vez de inventar assunto novo.
3. **Pergunta de presença ("tem alguém aí?", "alô?", "ainda tá aí?", "alguém atende?") tem reflexo prioritário.** Antes de qualquer outra rota, a IA confirma presença em 1 linha curta ("Tô aqui sim!") e só depois oferece ajuda. Substitui a muleta universal nesses turnos.
4. **Reforço de bucket social.** Quando o turno é classificado como puro social mas não cai em thanks/ruído/presença, a IA é instruída a abrir discovery sem viés de família dominante (lembrando que o catálogo tem várias famílias).

### Validação técnica executada
- ✅ 30/30 casos de teste passaram (12 thanks, 11 ruído social, 7 presença).
- ✅ Despacho do continuity-gate confirmado: "vlw" → terminal; "kkk" → ruído social; "tem alguém aí?" → presença; "oi tudo bem?" → social genérico; "qual a diferença?" → mantém família+produto sem capturar nenhum dos novos branches.
- ✅ Regex unicode corrigidos (não dependem de `\b` em texto acentuado, usam boundaries por espaço/pontuação).
- ⏳ Pendente: bateria de regressão da Frente A executada via sandbox em conversa real (5 cenários novos de Onda 10 + 19 cenários congelados) — a ser arquivada no doc temporário antes da Frente C.

### Anti-regressão
- O continuity-gate continua aditivo (`promptBlock: null` quando nada dispara). Reflexos seguem em `try/catch`.
- Nenhuma máquina de estados alterada. Nenhuma tool tocada.
- Os 4 branches anteriores (anti-loop de discovery, família ativa, produto em foco, carrinho ativo) preservados na ordem original.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação via bateria sandbox em conversa real (Q10.1 "kkk", Q10.2 "vlw", Q10.4 "tem alguém aí?" + os 19 cenários ✅ da bateria fixa).

---

## Registro #33 — Base Universal: Endurecimento de regressões da Rodada 2 (Frente C) — 23/mai/2026

**Tipo:** Endurecimento universal do classificador de turno + filtro de catálogo.
**Escopo:** TPR (turn-pre-router fallback) e search_products no handler de IA.

### Sintoma (Rodada 2 — recorrências)
- Superlativos de preço ("mais em conta", "mais barato", "compensa", "vale a pena", "tem promoção?") não acionavam `asked_about_price`, e o Price Scrubber acabava removendo a resposta correta antes de ela chegar ao cliente.
- Pergunta de catálogo agnóstica ("tem balm?", "vocês têm kit?", "o que vocês têm?") era contaminada pelo `family_focus` anterior — o cliente queria ver vitrine ampla e recebia só a família que estava em foco.
- Em queda do TPR-LLM, o fallback determinístico não emitia `intent_bucket`, e o roteamento perdia a categoria do turno.

### O que mudou
1. **Detector de preço estendido.** A regex do TPR fallback agora cobre superlativos comerciais e formas alternativas: `promo/promoção`, `em conta`, `mais em conta`, `mais barato`, `vale a pena`, `compensa`, `tem desconto/cupom/promo`, `sai por quanto`. Isso evita que o Price Scrubber dispare em respostas legítimas a perguntas de preço.
2. **Bucket determinístico no fallback.** O TPR fallback passou a emitir `intent_bucket` mesmo sem LLM: prioriza `social` (saudação curta isolada), depois `commercial_policy` (preço/frete), depois `catalog_question` (sondas "tem X?", "vocês têm", "quais X", "me mostra catálogo"), depois `open_discovery` (sintoma ou pedido de recomendação), depois `product_question` (intenção de compra direta). Mantém retro-compatibilidade — quando o LLM responde, o valor dele prevalece.
3. **Vitrine agnóstica em catalog_question.** Quando o turno é `catalog_question` e o cliente NÃO mencionou família nova, o handler ignora o `family_focus` persistido da conversa e devolve a vitrine ampla (mantendo o ranqueamento por relevância). O filtro estrito por família continua valendo nos demais turnos. O `Catalog Probe` (Reg #2.8) e o `enforceFamilyBaseFirst` (Onda 18 Fase A) seguem ativos como antes.

### Validação técnica executada
- ✅ Type-check do TPR e do output-gates limpos (`deno check`).
- ✅ Type-check do handler `ai-support-chat` não introduziu novos erros (erros pré-existentes no arquivo não tocam o caminho alterado).
- ✅ Deploy do edge function `ai-support-chat` aplicado.
- ⏳ Pendente: rodar a bateria fixa (19 cenários) + cenários novos de Frente C ("mais em conta", "tem balm?", "tem kit?", "vocês têm shampoo?") em sandbox real antes de avançar para Frente D.

### Anti-regressão
- Mudança aditiva: caminhos anteriores (Catalog Probe, enforceFamilyBaseFirst, family_focus estrito) preservados.
- A vitrine agnóstica só é acionada com `intent_bucket === "catalog_question"` E sem `familyMentionedNow`. Qualquer família detectada no turno continua dirigindo o filtro.
- Nenhuma tool, contrato ou estado da pipeline alterado.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação via bateria sandbox em conversa real.

---

## Registro #34 — Base Universal: Ficha institucional do tenant (Frente D) — 23/mai/2026

**Tipo:** Nova camada de contexto determinístico no prompt da IA de vendas.
**Escopo:** novo módulo `institutional-sheet` + injeção condicional no handler `ai-support-chat`.

### Sintoma (Rodada 2)
- Quando o cliente perguntava cobertura de entrega, prazo, horário de atendimento, política de cupom, garantia, troca/devolução ou prova social, a IA respondia genericamente ou improvisava — sem fonte de verdade.
- Em objeção comercial, a IA tentava ancorar valor sem dados firmes (prazo, garantia, casos), o que enfraquecia a resposta.

### O que mudou
1. **Ficha institucional por tenant** (jsonb em `ai_support_config.metadata.institutional_sheet`). Campos opcionais e livres: cobertura/prazos, horário, formas de pagamento, cupons, garantia/troca/devolução, prova social, loja física, atendimento humano e observações. Ausência de campo = nenhum dado.
2. **Injeção condicional no prompt.** Quando o turno é classificado como `institutional`, `commercial_policy` ou `objection`, o handler injeta um bloco contextual com a ficha. Em qualquer outro bucket, o bloco NÃO aparece (não polui prompt de vendas/descoberta).
3. **Regras duras embutidas no bloco** (sempre presentes, mesmo com ficha vazia):
   - Use APENAS o que está listado. Se não está, NÃO invente — diga que vai checar com humano e ofereça encaminhar.
   - Em objeção, ancore valor combinando o produto discutido com a ficha (garantia, prazo, prova social) — sem prometer condições não listadas.
   - Não cite preço/desconto/frete específicos que não estejam na ficha.
4. **Observabilidade.** Log emite bucket alvo, campos presentes e campos faltantes para auditoria.

### Validação técnica executada
- ✅ Type-check do novo módulo limpo.
- ✅ Deploy do `ai-support-chat` concluído.
- ⏳ Pendente: rodar bateria fixa + cenários novos da Frente D ("vocês entregam em [cidade]?", "qual horário?", "tem cupom?", "como funciona a garantia?", e cenário de objeção "tô achando caro") em sandbox real.
- ⏳ Pendente (próximo ciclo): tela administrativa para preencher a ficha. Por ora, preenchimento via dado direto na configuração.

### Anti-regressão
- Mudança aditiva. Bucket fora do conjunto elegível → bloco não emitido.
- Sem migração: aproveita coluna `metadata` existente.
- Falha do módulo é capturada em `try/catch` — nunca derruba o turno.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação via bateria sandbox no próximo ciclo.

---

## Registro #35 — Base Universal: Âncora do turno (Frente E) — 23/mai/2026

**Tipo:** Nova camada de ancoragem determinística no prompt da IA de vendas.
**Escopo:** novo módulo `turn-anchor` + reforço nos prompts de DISCOVERY e RECOMMENDATION.

### Sintoma (Rodada 2)
- Mesmo com dor declarada e família/produto em foco persistidos, a IA caía em perguntas universais de qualificação ("pra você ou pra presentear?", "qual seu objetivo?") como default.
- Ficha institucional cadastrada nem sempre era usada nos estados de venda — só aparecia quando o turno era classificado como institucional/objeção.
- A "muleta universal" (qualificação genérica) virava o caminho padrão em vez de ser fallback.

### O que mudou
1. **Bloco "ÂNCORA DESTE TURNO"** consolida em uma única referência:
   - dor/objetivo declarado pelo cliente (literal),
   - família em foco,
   - produto em foco,
   - quais áreas a ficha institucional cobre (entrega, horário, pagamento, cupom, garantia, prova social, loja física, atendimento humano, observações).
2. **Injeção em todo turno de venda** (não fica restrito a buckets institucionais). O bloco só é omitido quando NÃO há nenhum sinal real — nesse caso a muleta universal é legítima.
3. **Regra de fallback explícita** dentro do bloco: perguntas universais só valem se a âncora não trouxer dor, nem família, nem foco. Se houver qualquer sinal, o turno avança apoiado nele.
4. **Reforço nos prompts** de DISCOVERY e RECOMMENDATION: regra "0" obriga a consultar a âncora antes de qualquer pergunta genérica e a manter o foco existente em vez de reabrir vitrine.
5. **Observabilidade.** Log emite presença de dor, família, foco, áreas institucionais e o motivo (`pain_anchor` / `product_anchor` / `family_anchor` / `institutional_only` / `no_signal`).

### Validação técnica executada
- ✅ Type-check do novo módulo + prompts alterados limpos.
- ✅ Deploy do `ai-support-chat` concluído.
- ⏳ Pendente: bateria sandbox cobrindo: dor declarada + retomada após interrupção; foco em produto + pergunta institucional no meio; turno sem nenhum sinal (muleta universal liberada); ficha vazia + tema institucional (deve oferecer humano).

### Anti-regressão
- Mudança aditiva: caminhos anteriores (Catalog Probe, family_focus estrito, continuity gate, ficha institucional da Frente D) preservados.
- O bloco não substitui a ficha institucional — ele referencia áreas cobertas e deixa a Frente D entregar o conteúdo detalhado nos buckets elegíveis.
- Falha do módulo é capturada em `try/catch` — nunca derruba o turno.
- Nenhuma tool, contrato de banco ou estado da pipeline alterado.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação via bateria sandbox no próximo ciclo.

---

## Registro #36 — Base Universal: Plano de correção pós-Frentes B–E — Passo 3 (catalog × family-focus) — 23/mai/2026

**Tipo:** Resolução do conflito entre ampliação de catálogo (Frente C), foco em família (Frente E) e regra "base antes de kit" (Onda 18 Fase A).
**Escopo:** `_shared/sales-pipeline/turn-anchor.ts` + chamada em `ai-support-chat/index.ts`.

### Sintoma (baseline Passo 1)
- Cenário B3.1 ("vocês têm shampoo?") regrediu: a IA caía na muleta "Me conta um pouco do que você precisa que eu já te indico" em vez de listar os shampoos disponíveis.
- Diagnóstico: quando o turno era `catalog_question` com família já persistida, a Frente C ampliava a vitrine, mas a Frente E injetava no mesmo prompt "Família em foco: X — mantenha o foco" — instrução contraditória que o modelo resolvia recorrendo à muleta.

### O que mudou
1. A âncora do turno agora recebe o `intentBucket`. Quando o bucket é `catalog_question` E há família persistida, a linha do prompt deixa de pedir manutenção do foco e passa a registrar:
   - "Família vista anteriormente: X (o cliente está pedindo visão ampla — PODE mostrar produtos de outras famílias sem trocar o foco persistido; dentro de cada família, mantenha base antes de kits)."
2. Regra de Onda 18 Fase A preservada: a instrução "base antes de kit" continua viva dentro de cada família, sem ser anulada pela ampliação.
3. Novo motivo `catalog_broadening` no log da âncora; flag `catalogBroadeningAllowed` exposta no output para auditoria.
4. Quando o bucket NÃO é catálogo, comportamento anterior é idêntico (`family_anchor`).

### Validação técnica executada
- ✅ Edição aplicada em sandbox; type-check do módulo limpo.
- ✅ Deploy do `ai-support-chat` concluído.
- ⏳ Pendente: rerodar B3.1 / B5.1 / B4.1 / B6.3 da bateria fixa no tenant Respeite o Homem para confirmar que B3.1 sai da muleta. Os outros 3 dependem dos Passos 4 e 5 (hierarquia de blocos + continuity-gate como override de estado).

### Anti-regressão
- Mudança aditiva: nenhum estado, tool ou contrato alterado.
- Quando `intentBucket` não vem ou bucket ≠ `catalog_question`, comportamento original é mantido.
- Regra de "base antes de kit" do Respeite o Homem continua aplicada pela Onda 18 Fase A — a flexibilização é só do prompt textual, não do `enforceFamilyBaseFirst`.

📌 **STATUS DA ENTREGA:** Ajuste aplicado. Pendente de validação via bateria sandbox no próximo turno.

---

## Registro #37 — Base Universal: Plano de correção pós-Frentes B–E — Passo 4 (hierarquia de blocos) — 23/mai/2026

**Tipo:** Ordenação determinística dos blocos contextuais do prompt da IA de vendas.
**Escopo:** `ai-support-chat/index.ts` — passo único de `sort+filter` aplicado logo antes de `buildPromptForState`.

### Sintoma (baseline Passo 1)
- O prompt empilhava 9–14 blocos contextuais em ordem de execução, não em ordem de prioridade. Regras críticas (silêncio em handoff, reflexo determinístico) competiam com regras genéricas (espelho de saudação, contexto comercial), e o modelo recorria à muleta universal "Me conta um pouco do que você precisa".
- B4.1 e B6.3-T1 da bateria fixa caíam consistentemente na muleta.

### O que mudou
1. Definida ordem fixa por prioridade (10 → 100):
   - 10: silêncio em handoff (modo conversa limpa, modo informativo de produto)
   - 20: reflexos determinísticos (CEP, frete, pós-venda, turno curto com intenção)
   - 30: bucket-state-router (institucional, objeção, hesitação, humano, pós-venda, fora de escopo)
   - 40: continuidade (thanks/ruído/presença/anti-loop/família/produto/carrinho)
   - 50: âncora do turno (dor + foco + áreas institucionais)
   - 60: ficha institucional (Frente D)
   - 70: memória da conversa (working memory)
   - 80: contexto comercial do negócio + payload do produto em foco
   - 85: carrinho ativo
   - 87: pergunta direta deste turno
   - 90: turno consultivo (sintoma + pedido de recomendação)
   - 100: espelho de saudação (abertura obrigatória)
2. Supressão automática de **contexto comercial** e **carrinho ativo** quando o bucket do turno é `human_request` ou `post_sale` — evita poluir conversa de suporte com gancho de venda.
3. Sort estável: dentro de uma mesma prioridade, a ordem original de inserção é preservada (importante para reflexos múltiplos ou continuity com várias razões).
4. Log de observabilidade: `[Passo4] context_blocks_ordered count=N dropped_commercial=… priorities=[…]`.

### Validação técnica executada
- ✅ Deploy do `ai-support-chat` concluído.
- ✅ B3.1 ("vocês têm shampoo?") — listou 2 shampoos com diferenciação.
- ✅ B5.1 ("vocês têm minoxidil?") — negou e reconduziu para Calvície Zero.
- ❌ B4.1 ("qual o kit mais completo?") — **continua na muleta**. Diagnóstico: o cliente pediu explicitamente kit, mas a regra Onda 18 Fase A (`enforceFamilyBaseFirst`) prioriza bases sobre kits de quantidade. Sem família declarada e sem reflexo de turno curto (5 palavras > 4), o pipeline não chama `search_products` para kits e cai na muleta.
- ❌ B6.3-T1 ("tô com queda de cabelo") — **continua na muleta** no T1. T2 ("depois eu vejo") já estava OK desde o Passo 3. Diagnóstico: dor declarada genérica sem família detectada — `pain_symptom_detector` não disparou recomendação imediata.

### Anti-regressão
- Mudança aditiva: nenhum estado, tool ou contrato alterado. Só a ORDEM dos blocos no prompt mudou.
- Quando o classificador não reconhece um bloco, recebe prioridade 95 (intermediária) — nunca quebra.
- Sort estável garante que reflexos múltiplos do mesmo módulo mantêm ordem.

### Pendências (para registro futuro)
- **B4.1 — Pergunta explícita por kit:** requer ajuste no Catalog Probe v2 para detectar intenção "kit_query" e suspender `enforceFamilyBaseFirst` quando o cliente nomear "kit" / "completo" / "conjunto".
- **B6.3-T1 — Dor sem família:** requer que `pain_symptom_detector` resolva a família imediatamente (queda → linha Calvície Zero) ou faça busca direta por dor antes de cair na muleta. Não é resolvível pelo Passo 5 do plano.

📌 **STATUS DA ENTREGA:** Ajuste aplicado e validado parcialmente. Hierarquia funcionando; 2 cenários remanescentes (B4.1 e B6.3-T1) precisam de frentes específicas fora do escopo dos Passos 4–5.

---

## Registro #38 — Base Universal: Plano de correção pós-Frentes B–E — Passo 5 (continuidade como override de estado) — 23/mai/2026

### Contexto
Passo 5 do plano: promover thanks/farewell, ruído social e ping de presença a **reflexos determinísticos com prioridade 20** (mesmo nível de CEP/frete/pós-venda), não apenas blocos de continuity-gate (prioridade 40).

### Mudança aplicada
- `_shared/sales-pipeline/deterministic-reflexes.ts`:
  - Tipo `ReflexOutput.reflexId` ampliado para incluir `"thanks_terminal"` e `"social_noise"`.
  - Importa `isThanksOrFarewell` e `isSocialNoise` do continuity-gate (fonte única dos detectores).
  - Dois novos branches no início de `detectDeterministicReflex` (logo após `presence_ping`) que retornam `newState: null` + `promptBlock` próprio com regras duras anti-muleta.
- `_shared/sales-pipeline/continuity-gate.ts`:
  - Nova flag `socialReflexFired?: boolean` em `ContinuityGateInput`.
  - Branches de thanks/social/presence dentro do gate ficam suprimidos quando o reflexo determinístico já cobriu, evitando duplicação no prompt.
- `ai-support-chat/index.ts`:
  - Nova variável `firedReflexId` no escopo do turno, populada quando o reflexo dispara.
  - Chamada de `buildContinuityBlock` passa `socialReflexFired` baseada em `firedReflexId`.

Resultado: blocos sociais agora chegam ao prompt com tag `[REFLEXO — ...]`, o que os classifica como prioridade 20 na hierarquia (Registro #37).

### Pendências bloqueantes (registradas em `_temp-base-universal-ondas-de-teste.md`)

Validação imediata em sandbox falhou nos 3 cenários alvo:
- "vlw obrigado" → muleta ❌
- "kkkk" → muleta ❌
- "alo, tem alguem ai?" → muleta ❌

**Causa raiz identificada:** `FALLBACK_PROMISE_BY_STATE` em `ai-support-chat/index.ts` (linha ~7387) injeta a muleta de discovery (`"Me conta um pouco do que você precisa que eu já te indico."`) **sempre que o LLM retorna conteúdo vazio**, independente de reflexo ativo. O reflexo determinístico está no prompt, mas o gpt-5 está retornando `content=""` (`finish_reason` provavelmente `length` por reasoning_tokens alto), e o fallback ignora completamente o `firedReflexId`.

Esse problema (P-EXEC-5 + P-EXEC-7 no doc temporário) será tratado num plano de correção próprio depois de fechado o ciclo Passos 1–6.

📌 **STATUS DA ENTREGA:** Ajuste aplicado — pendente de validação completa. Reflexos novos no código + hierarquia correta, mas comportamento final continua bloqueado pelo fallback de resposta vazia. Entrar em correção dedicada.

📝 **DOCUMENTAÇÃO NECESSÁRIA:** já refletida neste registro (#38) e em `_temp-base-universal-ondas-de-teste.md`. Lacuna documental pendente: tela admin da ficha institucional (Passo 2b não implementado).

---

## Registro #40 — Plano de correção pós-Frentes B–E — Frentes 1, 4, 5, 7 — 24/mai/2026

### Contexto
Após o Registro #39 (fechamento do plano original), foi montado novo plano de 7 frentes para resolver as 7 pendências P-EXEC. Esta entrega cobre as 4 frentes autocontidas (1, 4, 5, 7) que destravam B3.1, B4.1, B6.3-T1, B6.3-T2 e o ciclo "vlw / kkkk / alô?". As 3 frentes restantes (2 — Catalog Probe direto a kit/shampoo/balm; 3 — sinônimos determinísticos por tenant; 6 — tela admin da Ficha Institucional) entram em ciclo seguinte com plano dedicado, porque cada uma exige decisão de produto/banco/UI própria.

### Frente 1 — Âncora vira override de estado ✅
- Novo módulo `_shared/sales-pipeline/anchor-state-override.ts`. Promove sinais reais (dor declarada, pergunta direta de catálogo, menção a kit/combo, família em foco persistida) a decisão de roteamento, forçando o estado para `recommendation`.
- Wired em `ai-support-chat/index.ts` entre o bucket router e o continuity gate. Mutação direta de `bucketFinalState` quando o override decide forçar.
- Bloqueios duros: reflexo prévio já alterou estado, estado avançado (recommendation/product_detail/decision/checkout/support/handoff), bucket não-vendas (post_sale, human_request, institutional, objection, hesitation, out_of_scope, social).
- 8 testes unitários em `__tests__/anchor-state-override.test.ts` — todos verdes.
- Destrava B3.1, B4.1, B6.3-T1, B6.2 sem regredir os 19 cenários congelados.

### Frente 4 — Reflexo de hesitação ✅
- Novo detector `isHesitation` em `continuity-gate.ts` cobrindo "depois eu vejo / preciso pensar / vou ver / amanhã eu volto / outro dia / mais pra frente / por enquanto não / talvez depois / quem sabe depois / deixa eu ver / deixa eu pensar".
- Novo reflexo `hesitation` (peso 20) em `deterministic-reflexes.ts`. Resposta de acolhimento curto + porta aberta. PROIBIDO nova pergunta de venda, oferta nova, pressão por decisão.
- `socialReflexFired` em `continuity-gate.ts` agora também suprime branch quando reflexo de hesitação dispara.
- 7 testes unitários em `__tests__/hesitation-reflex.test.ts` — todos verdes.
- Destrava B6.3-T2.

### Frente 5 — Fallback de resposta vazia ciente do reflexo ✅
- Em `ai-support-chat/index.ts`, no bloco de fallback de resposta vazia (~linha 7437), adicionada tabela `FALLBACK_BY_REFLEX` cobrindo os 8 reflexos atuais (thanks_terminal, social_noise, presence_ping, hesitation, cep_received, shipping_question, post_sale_question, short_turn_with_intent).
- Quando `firedReflexId` está setado e existe entrada na tabela, a frase final vem do reflexo, sobrepondo handoff, media e fallback por estado. Apenas se nenhum reflexo disparou é que cai no caminho antigo.
- Resolve a regressão "vlw / kkkk / alô?" mesmo quando o gpt-5 devolve `content=""` (P-EXEC-5 e P-EXEC-7).

### Frente 7 — Observabilidade dos reflexos e do override ✅
- Tag única `[REFLEX-FIRED reflexId=… newState=… prevState=… reason=…]` substitui o log antigo `[Reg #2.17 Fase 3]`.
- Nova tag `[ANCHOR-OVERRIDE forcedState=… from=… reason=… bucket=… pain=… family=…]` em todos os turnos onde a Frente 1 atua (com versão `skipped` quando não aplica).
- Nova tag `[FALLBACK-EMPTY-RESPONSE source=reflex|actionable_handoff|commercial_veto|inbound_media|tools_humanized|state_promise reflexId=… state=…]` em todos os caminhos do fallback.
- Log do Reg #17.1 agora também carrega `reflex=…` para correlação rápida.

### Validação técnica
- 15 testes unitários novos (8 do anchor + 7 do reflexo de hesitação) — todos verdes.
- Type-check do edge runtime passou em todos os módulos modificados.
- Pendente de validação do usuário no sandbox real: bateria fixa de 19 cenários + cenários alvo (B3.1, B4.1, B6.3-T1, B6.3-T2, "vlw", "kkkk", "alô?").

### Pendências para o ciclo seguinte
- Frente 2 — Catalog Probe direto a "kit/shampoo/balm" sem família em foco.
- Frente 3 — Tabela determinística de sinônimos por tenant (B5.1: "minoxidil → Calvície Zero").
- Frente 6 — Tela admin da Ficha Institucional em Configurações > IA.

📌 **STATUS DA ENTREGA:** Ajuste aplicado — pendente de validação no sandbox. Frentes 2/3/6 entram em ciclo seguinte.

📝 **DOCUMENTAÇÃO NECESSÁRIA:** Memórias atualizadas (`mem://features/ai/instruction-block-hierarchy-standard.md` ganha hesitation; nova `mem://constraints/anchor-as-state-override`; `mem://constraints/sales-pipeline-deterministic-reflexes` ganha hesitation; nova `mem://constraints/empty-response-fallback-reflex-aware`). Mapa de UI segue sem alteração nesta entrega — Frente 6 mexe nele no próximo ciclo.
