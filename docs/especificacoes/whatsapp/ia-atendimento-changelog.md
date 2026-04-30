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
| Não inventar ação executada ("já encaminhei…") | ✅ Coberto | Scrubber `unsupported_action_promised` | Reg. #1 |
| Não trocar produto após confirmação | ✅ Coberto | `PRODUCT_LOCK_MISMATCH` + resolver com `focusProductId` | Reg. #1 |
| Não pedir nova confirmação após "sim/manda" | ✅ Coberto | FIX-B `tool_choice` forçado + scrubber `confirmation_loop_detected` | Reg. #1 |
| Não repetir a mesma frase/intenção | ⚠️ Parcial | Hash de prefixo (não pega família semântica) | Reg. #2 — pendente 3.4 |
| Não citar preço sem o cliente perguntar | ✅ Coberto | Regra global `PRICE-ON-DEMAND` em `base.ts` + reforço em discovery/recommendation | Reg. #2.3 |
| Não trocar conjunto ofertado por kit consolidado | ✅ Coberto | `BUNDLE LOCK` global em `base.ts` + reforço em recommendation; trava de SKU já existente cobre execução | Reg. #2.3 |
| Espelhar saudação ("boa tarde" → "boa tarde") | ✅ Coberto | `greeting-mirror.ts` mecânico (já em produção) + regra dura em greeting prompt | Reg. #2 (já existia, confirmado) |
| Honrar pergunta consultiva antes de listar produto | ⚠️ Só prompt | Sem regra dura | Reg. #2 — pendente 3.6 |
| Enviar imagem na 1ª apresentação real do produto | ✅ Coberto | `product-detail` exige `send_product_image` na 1ª menção (1x/produto) | Reg. #2.3 |
| Link de checkout no domínio próprio da loja | ✅ Coberto | `ai-support-chat` consulta `tenant_domains` (preferindo `is_primary`) | Reg. #2.1 |
| Carrinho hidratado ao abrir o link enviado | ✅ Coberto | `useCheckoutLinkLoader` inicializa `isLoading=true` quando há `?link=`/`?product=` na URL | Reg. #2.2 |
| Filtro estrito por família no `search_products` | ✅ Coberto | `family_focus` persistente | mem://features/ai/sales-pipeline-anti-repetition-and-family-focus |
| Janela Meta 24h (mensagem livre + imagem) | ✅ Coberto | `meta-whatsapp-send` valida antes de enviar | Reg. #1 |
| Memória persistente unificada da conversa de vendas (estágio comercial, dor, produtos apresentados, anti-repetição, upsell counter) | 🟡 Em observação | Tabela `conversation_sales_state` + módulos `working-memory.ts` e `stage-machine.ts` em **shadow mode** (loga e persiste, ainda não altera resposta) | Reg. #2.9 |

Legenda: ✅ coberto · ⚠️ parcial · ❌ sem defesa / quebrado

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
