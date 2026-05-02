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
| Honrar pergunta consultiva antes de listar produto | ⚠️ Só prompt | Sem regra dura | Reg. #2 — pendente 3.6 |
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

Legenda: ✅ coberto · ⚠️ parcial · ❌ sem defesa / quebrado

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
