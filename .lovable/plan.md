## Objetivo

Investigar e corrigir as 7 frentes em aberto da IA de atendimento (modo vendas WhatsApp) e adicionar duas novas frentes pedidas agora:

- **Frente 8 (Saudação formal):** IA responde sempre em tom formal, sem gírias, com fórmulas fixas (cliente novo vs cliente recorrente).
- **Frente 9 (Venda IA):** marcar pedidos fechados via link gerado pela IA com flag visível em Pedidos e categoria própria em Atribuição de Vendas.

Cada frente vira uma entrega independente (diagnóstico → proposta → ajuste → validação), na ordem definida.

---

## Ordem de execução

1. Frente 9 — Flag "Venda IA" + categoria de Atribuição (alto valor, baixo risco, desbloqueia análise de ROI da IA)
2. Frente 8 — Saudação formal sem gírias (regra nova de produto, fácil de validar)
3. Frente 2 — Variantes obrigatórias no auto-add do checkout
4. Frente 7 — Auditoria do "carrinho convertido" no webhook
5. Frente 5 — Anti-repetição cobrindo paráfrase semântica
6. Frente 3 — Fechamento real da janela do scrubber (limites de tamanho)
7. Frente 6 — Detecção de tom robótico residual
8. Frente 4 — Loop de confirmação travada em casos edge
9. Frente 1 — Sandbox stale (ferramenta interna de teste retornando versão antiga)

---

## Frente 9 — Flag "Venda IA" + Atribuição

### Como funciona hoje
- IA gera link via tool `generate_checkout_link` → cria registro em `checkout_links` vinculado ao `whatsapp_carts.conversation_id`.
- Quando o pagamento é aprovado, trigger `link_whatsapp_cart_to_order` faz `whatsapp_carts.order_id = orders.id`.
- A tabela `orders` não tem nenhum campo indicando origem "IA de atendimento".
- A tabela `order_attribution` é populada por UTM/landing do storefront, mas a IA do WhatsApp gera link que entra no checkout sem UTM próprio → atribuição fica como `unknown` ou herdada da última sessão.

### O problema
- Operador não consegue saber, olhando a lista de pedidos, quais foram fechados pela IA.
- Relatório de atribuição não tem categoria "IA de Atendimento" → ROI da IA é invisível.

### O que será feito
1. **Migration:**
   - Adicionar coluna `orders.sales_channel text` (valores: `storefront`, `ai_attendant`, `marketplace`, `link_checkout`, `manual`) com default `storefront`.
   - Adicionar coluna `orders.ai_conversation_id uuid` (nullable, FK opcional para `conversations`).
   - Index composto `(tenant_id, sales_channel, created_at DESC)` para filtro rápido.
2. **Backend (edge `generate_checkout_link` em `ai-support-chat/index.ts`):**
   - Ao criar `checkout_links`, persistir já a marcação `metadata.source='ai_attendant'` e `metadata.conversation_id`.
3. **Trigger `link_whatsapp_cart_to_order`:**
   - Ao vincular cart→order, setar `orders.sales_channel='ai_attendant'` e `orders.ai_conversation_id`.
   - Inserir/atualizar `order_attribution` com `attribution_source='ai_atendimento'` e `attribution_medium='whatsapp'` (sobrescreve UTM herdado, porque link IA é fonte determinística).
4. **UI Pedidos:**
   - Novo badge "Venda IA" (ícone bot + cor distinta) na lista (`OrderSourceBadge`-like) e no detalhe do pedido.
   - Filtro "Origem" passa a incluir "IA de Atendimento".
5. **UI Atribuição (`useAttributionStats` + dashboard):**
   - Categoria nova "IA de Atendimento" aparece como linha própria, ranqueada por receita.
   - Tooltip explicando que conta apenas pedidos com link gerado pela IA.
6. **Documentação:** atualizar `modo-vendas-whatsapp.md`, `mapa-ui.md` e criar memória `mem://constraints/ai-sales-channel-marking.md`.

### Validação técnica
- Conversa sandbox → fechar checkout → confirmar webhook de teste → checar `orders.sales_channel='ai_attendant'`, `order_attribution.attribution_source='ai_atendimento'`, badge na UI.

---

## Frente 8 — Saudação formal sem gírias

### Como funciona hoje
- `greeting-mirror.ts` espelha exatamente o que o cliente disse, incluindo "Eai", "Opa", "Beleza".
- Prompt `prompts/greeting.ts` permite "Oi!" e variações informais.
- `greeting-scrub.ts` reescreve abertura mas mantém o token informal do cliente.

### O problema
- Cliente manda "Eai" de manhã → IA responde "Eai!" em vez de "Olá, bom dia, tudo bem? Como posso ajudar?".
- Não há diferenciação entre cliente novo (sem histórico) e cliente recorrente.

### O que será feito
1. **Nova fórmula determinística** (substitui mirror espelho-literal):
   - Sempre começa com "Olá".
   - Adiciona período do dia detectado pelo horário do servidor (BRT) OU pelo que o cliente disse (preferência: o que o cliente disse).
   - Sempre inclui "tudo bem?".
   - Fecha com "Como posso ajudar?" (cliente novo) OU "Como posso ajudar hoje?" (cliente recorrente, identificado via `lookup_customer` no histórico).
   - Se já houver nome conhecido na conversa recente, prefixa "Olá, {Nome}". Senão, omite.
2. **Sanitizador de input:** lista de gírias mapeadas para neutro ("eai", "opa", "blz", "tmj", "fala") → tratadas como saudação genérica, NÃO espelhadas.
3. **Detecção cliente novo vs recorrente:** consultar `customers` por `phone` no início do turno greeting; se existe e tem nome, marca como recorrente.
4. **Toggle de configuração futuro:** deixar hook `ai_support_config.greeting_style` (default `formal`) para tenants poderem ativar `mirror_informal` depois — sem UI agora, só campo no schema.
5. **Atualizar:** `greeting-mirror.ts`, `greeting-scrub.ts`, `prompts/greeting.ts`, TPR (já entrega `greeting_period`), changelog IA atendimento, memória `mem://constraints/greeting-must-be-formal-by-default.md`.

### Validação técnica
- Sandbox 5 turnos: cliente novo manda "Eai", "Opa bom dia", "blz mano", "boa tarde tudo bem?", "oi". Verificar que TODAS as respostas começam com "Olá, [período], tudo bem? Como posso ajudar?".
- Repetir com telefone de cliente cadastrado → confirmar "hoje" no fim.

---

## Frente 2 — Variantes obrigatórias no auto-add

### Como funciona hoje
- Reg #2.15 adicionou auto-add no `generate_checkout_link` quando cart vazio + 1 produto focado SEM variantes mandatórias.
- Produto com variantes obrigatórias (cor, tamanho) cai fora do salva-vidas.

### O que será feito
- Detectar produto focado com variantes → IA pergunta a variante ANTES de gerar link (forçar tool `get_product_variants`).
- Se cliente já mencionou variante no histórico, fazer match por `option1_value` e auto-add.
- Logar `[Reg #2.16] variant required` para auditoria.

---

## Frente 7 — Auditoria do "cart converted" no webhook

### O que será feito
- Listar todos os webhooks de gateway (`pagarme-webhook`, `mercadopago-storefront-webhook`) e verificar se chamam o trigger `link_whatsapp_cart_to_order` ou marcam `whatsapp_carts.status='converted'`.
- Inventariar carts `active` com mais de 30 dias e order vinculado pago → identificar gap.
- Adicionar reconciliação cron diária: cart com `order_id NOT NULL` e `orders.payment_status='paid'` → marca `converted`.

---

## Frente 5 — Anti-repetição semântica

### O que será feito
- Hash de prefixo atual compara texto literal. Adicionar embedding leve (Gemini Flash-Lite) para detectar paráfrase ("Eu indicaria" vs "Minha recomendação seria").
- Threshold de similaridade configurável; ao bater, regenera com instrução explícita de mudar abordagem.

---

## Frente 3 — Limites de tamanho do scrubber de saudação

### O que será feito
- `greeting-scrub.ts` tem regex de cabeça limitado a ~25 chars. Resposta longa com saudação degenerada no meio passa despercebida.
- Estender detecção para primeiros 80 chars + fallback de prepend obrigatório quando TPR detecta saudação não espelhada.

---

## Frente 6 — Tom robótico residual

### O que será feito
- Catálogo de frases robóticas ("Como posso te auxiliar", "Em que posso ser útil", "Estou à sua disposição") → scrubber substitui por equivalentes humanas/formais ("Como posso ajudar").
- TPR ganha campo `tone_robotic_score` para flagar antes de gerar.

---

## Frente 4 — Loop de confirmação travada (edge cases)

### O que será feito
- Mapear casos remanescentes onde IA pergunta "confirma?" mais de 2x sem nova ação.
- State machine ganha contador `confirmation_loops`; ao bater 2, força ação determinística (gerar link, listar opções, ou handoff).

---

## Frente 1 — Sandbox stale

### O que será feito
- Investigar por que `ai-test-sandbox` às vezes retorna comportamento de versão anterior (suspeita: cache de prompt no Lovable AI Gateway ou release não propagado).
- Adicionar header `x-deploy-version` na resposta do sandbox para evidenciar versão exata em uso.
- Documentar no runbook.

---

## Documentação obrigatória (todas as frentes)

- `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — Registro novo por frente.
- `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` — Atualizar comportamento.
- `docs/especificacoes/transversais/mapa-ui.md` — Badge "Venda IA" + filtro novo + linha em Atribuição.
- Memórias `mem://constraints/*` por frente com risco de regressão.

---

## Detalhes técnicos (resumo)

```text
DB:
  + orders.sales_channel text default 'storefront'
  + orders.ai_conversation_id uuid
  + ai_support_config.greeting_style text default 'formal'
  + index orders(tenant_id, sales_channel, created_at desc)

Edge:
  ai-support-chat/index.ts (generate_checkout_link handler)
  _shared/sales-pipeline/greeting-mirror.ts (rewrite formal)
  _shared/sales-pipeline/greeting-scrub.ts (limites + prepend)
  _shared/sales-pipeline/turn-pre-router.ts (tone_robotic_score)
  _shared/sales-pipeline/output-gates.ts (frase robotica scrub)
  pagarme-webhook + mercadopago-storefront-webhook (auditoria)

Trigger:
  link_whatsapp_cart_to_order: setar sales_channel + order_attribution

UI:
  src/components/orders/OrderSourceBadge.tsx (novo valor "Venda IA")
  src/pages/Marketing.tsx ou dashboard atribuição (categoria nova)
  src/hooks/useOrderAttribution.ts (label "ai_atendimento" → "IA de Atendimento")
```

---

## O que NÃO está no escopo

- Toggle UI de "estilo de saudação" (deixamos só o campo, ativação via UI vira ticket futuro).
- Reescrita do TPR (mantemos modelo atual, só adicionamos campos).
- Alteração de gateways de pagamento além de auditoria/log.

---

**Confirma esse plano e a ordem proposta?** Se sim, começo pela Frente 9 (Venda IA + Atribuição) por ser a de maior valor imediato e desbloquear os relatórios de ROI da IA.