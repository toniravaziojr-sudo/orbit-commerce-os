# CRM (Notificações, Atendimento, Emails, Avaliações) — Regras e Especificações

> **STATUS:** ✅ Ready (Emails, Notificações, Atendimento WhatsApp com IA via OpenAI, Avaliações)  
> **Última atualização:** 2026-03-29

> **Camada:** Layer 3 — Especificações / Crm  
> **Migrado de:** `docs/regras/crm.md`  
> **Última atualização:** 2026-04-03


## Visão Geral

Módulo de relacionamento com cliente: notificações, atendimento/suporte, gestão de emails e avaliações de produtos.

---

## Submódulos

| Submódulo | Rota | Status |
|-----------|------|--------|
| Notificações | `/notifications` | ✅ Ready |
| Atendimento | `/support` | ✅ Ready |
| Emails | `/emails` | ✅ Ready |
| Avaliações | `/reviews` | ✅ Ready |

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Notifications.tsx` | Notificações push/email |
| `src/pages/Support.tsx` | Central de atendimento unificada |
| `src/pages/Emails.tsx` | Gestão de emails |
| `src/hooks/useConversations.ts` | Hook de conversas |
| `src/hooks/useMessages.ts` | Hook de mensagens |
| `src/hooks/useAiSupportConfig.ts` | Configuração da IA |
| `src/hooks/useAiChannelConfig.ts` | Configuração por canal |
| `supabase/functions/ai-support-chat/index.ts` | Edge Function de IA |
| `supabase/functions/process-events/index.ts` | Converte eventos em notificações |
| `supabase/functions/run-notifications/index.ts` | Envia notificações (WhatsApp/Email) |

---

## 1. Notificações

### Pipeline de Notificações (v8.2.6)

O fluxo completo de notificações funciona assim:

```
evento (events_inbox) → process-events (cron 1min) → notifications (fila) → run-notifications (cron 1min) → envio real (WhatsApp/Email)
```

#### Cron Jobs Ativos
| Job | Schedule | Edge Function | Descrição |
|-----|----------|---------------|-----------|
| `process-events-every-minute` | `* * * * *` | `process-events` | Processa eventos pendentes e gera notificações |
| `run-notifications-every-minute` | `* * * * *` | `run-notifications` | Envia notificações agendadas via canal configurado |
| `check-whatsapp-templates-hourly` | `0 * * * *` | `whatsapp-check-templates` | Verifica status de aprovação de templates WhatsApp na Meta |

#### Pré-requisitos para Envio
- **WhatsApp**: tenant precisa ter `whatsapp_configs` com `connection_status=connected` e `is_enabled=true`
- **WhatsApp Template**: regras com canal WhatsApp submetem template automaticamente à Meta; disparo só ocorre após `meta_template_status=approved`
- **Email**: tenant precisa ter `email_provider_configs` verificado OU sistema precisa ter `system_email_config` verificado + `SENDGRID_API_KEY`

### Aprovação Automática de Templates WhatsApp (v1.0.0)

#### Fluxo Completo
```
criar/editar regra com WhatsApp → whatsapp-submit-template (auto) → Meta API → status: pending
                                                                                     ↓
                                                    whatsapp-check-templates (cron 1h) → approved/rejected
                                                                                     ↓
                                                    run-notifications usa template_name → mensagem entregue
```

#### Tabelas
| Tabela | Descrição |
|--------|-----------|
| `whatsapp_template_submissions` | Registro de cada template enviado à Meta (status, template_name, etc.) |
| `notification_rules.meta_template_name` | Nome do template gerado (ex: `pagamento_aprovado_abc123`) |
| `notification_rules.meta_template_status` | Status: `none`, `pending`, `approved`, `rejected`, `error`, `not_found` |

#### Edge Functions
| Função | Trigger | Descrição |
|--------|---------|-----------|
| `whatsapp-submit-template` | Chamada pelo hook ao criar/editar regra | Converte mensagem em template Meta e submete via API |
| `whatsapp-check-templates` | Cron a cada 1 hora | Consulta status de templates pendentes na Meta e atualiza BD |

#### Comportamento na UI
| Estado | Badge | Cor | Comportamento |
|--------|-------|-----|---------------|
| `none` | — | — | Regra sem template (canal email only) |
| `pending` | "Aguardando Meta (até 24h)" | Amarelo | Disparos bloqueados |
| `approved` | "Template aprovado em DD/MM às HH:mm" | Verde | Disparos ativos via template. Data vem de `whatsapp_template_submissions.approved_at` |
| `rejected` | "Template rejeitado em DD/MM às HH:mm" | Vermelho | Disparos bloqueados, usuário deve editar. Data vem de `whatsapp_template_submissions.rejected_at` |
| `error` | "Erro no envio" | Laranja | Erro ao submeter, retry ao salvar |
| `not_found` | "Template não encontrado" | Laranja | Template sumiu da Meta |

#### Link "Ver na Meta"
- Exibido ao lado do badge quando há status de template (qualquer status exceto `none`)
- URL: `https://business.facebook.com/latest/whatsapp_manager/message_templates`
- A Meta redireciona automaticamente para a conta do lojista logado
- Abre em nova aba (`target="_blank"`)

#### Campos de Data no Hook
| Campo | Origem | Descrição |
|-------|--------|-----------|
| `meta_template_approved_at` | `whatsapp_template_submissions.approved_at` | Data/hora de aprovação do template pela Meta |
| `meta_template_rejected_at` | `whatsapp_template_submissions.rejected_at` | Data/hora de rejeição do template pela Meta |

#### Conversão de Variáveis
As variáveis amigáveis (`{{customer_first_name}}`) são convertidas para o formato Meta (`{{1}}`) automaticamente:
- `{{customer_first_name}}` → `{{1}}`
- `{{order_number}}` → `{{2}}`
- etc.

O `run-notifications` reconstrói os valores reais do payload ao enviar.

### Tipos de Notificação (Regras V2)
| rule_type | trigger_condition | Descrição |
|-----------|-------------------|-----------|
| `payment` | `pix_generated` | PIX gerado — mensagem de instruções |
| `payment` | `payment_approved` | Pagamento confirmado |
| `payment` | `boleto_generated` | Boleto gerado — mensagem com instruções |
| `payment` | `declined` | Pagamento recusado |
| `payment` | `expired` | Pagamento expirado |
| `shipping` | `posted` | Pedido despachado |
| `shipping` | `in_transit` | Em trânsito |
| `shipping` | `delivered` | Entregue |
| `shipping` | `returned` | Devolvido |
| `abandoned_checkout` | — | Checkout abandonado |
| `post_sale` | — | Pós-venda (1ª compra) |

### Canais
| Canal | Status | Descrição |
|-------|--------|-----------|
| Email | ✅ Ready | Via SendGrid |
| Push Web | 🟧 Pending | Web Push API |
| WhatsApp | ✅ Ready | Via Meta WhatsApp Cloud API (único provider) |
| SMS | 🟧 Pending | Via providers |

---

## 2. Atendimento (Support)

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Inbox unificado | ✅ Ready | Todas as conversas |
| WhatsApp (Meta) | ✅ Ready | Via Meta Cloud API |
| WhatsApp (Z-API) | ✅ Ready | Via Z-API |
| Messenger (FB) | ✅ Ready | Via Meta Graph API |
| Instagram DM | ✅ Ready | Via Meta Graph API |
| Comentários FB/IG | ✅ Ready | Via Meta Webhooks |
| Email | ✅ Ready | Recebimento via Resend |
| Chat ao vivo | ✅ Ready | Widget na loja |
| IA Atendente | ✅ Ready | OpenAI GPT-5.2 |

### Status de Conversa
| Status | Descrição |
|--------|-----------|
| `new` | Nova conversa |
| `open` | Aguardando atendimento |
| `waiting_customer` | Aguardando cliente |
| `waiting_agent` | Aguardando agente |
| `bot` | Em atendimento pela IA |
| `resolved` | Resolvido |
| `closed` | Fechado |
| `spam` | Marcado como spam |

### Modelo de Dados

```typescript
// conversations
{
  id: uuid,
  tenant_id: uuid,
  customer_id: uuid | null,
  customer_name: string,
  customer_email: string | null,
  customer_phone: string | null,
  channel_type: 'whatsapp' | 'instagram' | 'email' | 'chat' | 'messenger',
  status: 'new' | 'open' | 'waiting_customer' | 'waiting_agent' | 'bot' | 'resolved' | 'closed' | 'spam',
  assigned_to: uuid | null,
  last_message_at: timestamptz,
  created_at: timestamptz,
}

// messages
{
  id: uuid,
  conversation_id: uuid,
  tenant_id: uuid,
  direction: 'inbound' | 'outbound',
  sender_type: 'customer' | 'agent' | 'bot' | 'system',
  sender_id: uuid | null,
  sender_name: string,
  content: text,
  content_type: 'text' | 'image' | 'audio' | 'video' | 'document',
  delivery_status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed',
  is_ai_generated: boolean,
  is_internal: boolean,
  is_note: boolean,
  created_at: timestamptz,
}
```

---

## 3. IA Atendente — 5º Agente de IA do Sistema

### 3.1 Identidade e Papel

A **IA Atendente** é o **quinto agente de IA** do sistema, e o único que interage diretamente com os **clientes** do tenant (os demais agentes auxiliam o administrador da loja).

| Atributo | Valor |
|----------|-------|
| **Escopo** | Atendimento ao cliente via multi-canal (WhatsApp, Instagram, Messenger, Email, Chat Widget) |
| **Execução** | Responde automaticamente clientes nos canais habilitados |
| **Restrição Principal** | Informativa por padrão. Executa ações comerciais **apenas** quando `ai_support_config.sales_mode_enabled = true` e **somente** dentro da allowlist do Modo Vendas (ver §4 e doc `whatsapp/modo-vendas-whatsapp.md`). Fora dessa allowlist, nunca executa ações. |
| **Público-alvo** | Clientes finais do tenant (não o admin) |
| **Escalamento** | Transfere para humano quando necessário |
| **Configuração** | Global via `ai_support_config` + granular por canal via `ai_channel_config` |
| **Trilha de auditoria** | `conversation_events` com modelo, tokens, latência e custo |
| **Billing** | Consumo registrado via `record_ai_usage` e `increment_ai_metrics` |

### 3.2 Critérios de Promoção a Agente (Layer 2, § 9.4)

A IA Atendente atende todos os critérios de promoção:

| Critério | Evidência |
|----------|-----------|
| Escopo próprio | Atendimento ao cliente final (domínio exclusivo) |
| Regras próprias de permissão | Configuração por tenant (`ai_support_config`) e por canal (`ai_channel_config`) |
| Autonomia de execução própria | Responde automaticamente sem intervenção do admin |
| Trilha de auditoria própria | `conversation_events`, `ai_support_metrics`, billing por modelo |

### 3.3 Diferença dos Demais Agentes

| Agente | Quem interage | Onde |
|--------|---------------|------|
| Assistente IA (ChatGPT) | Admin | Chat interno |
| Auxiliar de Comando | Admin | Central de Comando |
| Gestor de Tráfego IA | Admin | Gestor de Tráfego |
| Agenda | Admin | WhatsApp (admin) |
| **IA Atendente** | **Clientes** | **Multi-canal (WhatsApp, IG, Messenger, Email, Chat Widget)** |

---

## 4. Fluxo de Atendimento com IA (OpenAI)

### Provider: OpenAI

> **Migrado em:** 2025-01-26  
> **Provider anterior:** Lovable AI Gateway  
> **Provider atual:** OpenAI API direta

### Modelos Disponíveis

| Modelo | Prioridade | Descrição |
|--------|------------|-----------|
| `gpt-5.2` | 1 (default) | Máxima qualidade e raciocínio |
| `gpt-5` | 2 | Alta qualidade |
| `gpt-5-mini` | 3 | Equilíbrio custo/qualidade |
| `gpt-5-nano` | 4 | Rápido e econômico |
| `gpt-4o` | 5 (fallback) | Compatibilidade legada |

### Fallback Automático

Se o modelo configurado falhar (modelo não existe), o sistema tenta automaticamente o próximo na lista de prioridade.

### Mapeamento de Modelos Legados

| Modelo Legado | Mapeado Para |
|---------------|--------------|
| `google/gemini-2.5-flash` | `gpt-5-mini` |
| `google/gemini-2.5-pro` | `gpt-5` |
| `openai/gpt-4o` | `gpt-4o` |

---

## 4. Guardrails: Modo Informativo (padrão) e Modo Vendas (opcional)

### 4.1 Regra Fundamental

A IA Atendente opera em **dois modos mutuamente exclusivos por tenant**, controlados pelo toggle `ai_support_config.sales_mode_enabled`:

| Modo | Quando | O que pode fazer | O que NUNCA pode fazer |
|------|--------|------------------|------------------------|
| **Informativo (padrão)** | `sales_mode_enabled = false` | Responder dúvidas com base em KB/RAG, coletar dados mínimos, escalar para humano | Qualquer ação no sistema (cancelar, reembolsar, alterar dados, criar carrinho, gerar checkout) |
| **Vendas** | `sales_mode_enabled = true` | Tudo do informativo + executar a **allowlist fechada** de tools comerciais | Tudo que estiver fora da allowlist (mesmo que o cliente peça) |

> ⚠️ A separação é **server-side**: o orquestrador filtra as tools disponíveis pelo modo + estado da pipeline F2 antes de chamar o modelo. Mudar de modo exige toggle do admin — a IA não escolhe.

### 4.2 Allowlist do Modo Vendas (única lista autorizada)

Definida em `docs/especificacoes/whatsapp/modo-vendas-whatsapp.md` §3. Resumo:

- **Catálogo (leitura):** `search_products`, `get_product_details`, `get_product_variants`, `recommend_related_products`, `send_product_image`.
- **Carrinho do próprio cliente (escrita escopada):** `add_to_cart`, `view_cart`, `remove_from_cart`.
- **Cupons:** `check_coupon`, `check_customer_coupon_eligibility`, `apply_coupon`, `check_upsell_offers`.
- **Cliente (próprio):** `lookup_customer`, `save_customer_data`, `update_customer_record` (apenas dados de contato/entrega da própria conversa).
- **Logística/checkout:** `calculate_shipping`, `generate_checkout_link`.
- **Escalada:** `request_human_handoff` (atômico, terminal e idempotente).
  - **Idempotência por conversa:** enquanto existir um chamado de atendimento em aberto ou pendente vinculado à conversa, novas chamadas de handoff **atualizam o mesmo chamado** (motivo, prioridade, resumo, contexto do carrinho) em vez de criar um chamado novo. Isso evita duplicação de tickets quando a IA reaciona o handoff em mensagens seguintes.
  - **Atômico:** o mesmo acionamento marca a conversa como aguardando agente, vincula o chamado e registra o motivo no carrinho ativo.
  - **Terminal:** após o handoff, a IA encerra o turno sem novas tools nem fala livre.

**Tudo que não está nessa lista é proibido**, incluindo: cancelar pedido, alterar status de pedido pago, criar/editar cupom, alterar preço/estoque de produto, alterar dados de outro cliente, acessar dados de outro tenant, enviar e-mail manual, executar SQL livre, chamar APIs administrativas.

### 4.3 Prompt de Guardrails — Modo Informativo (default)

```text
VOCÊ É UM ASSISTENTE PURAMENTE INFORMATIVO.

REGRAS ABSOLUTAS:
1. NUNCA EXECUTE AÇÕES - Você não pode cancelar pedidos, processar reembolsos, alterar dados, etc.
2. SEMPRE INFORME E ESCALONE - Se o cliente pedir ações ou estiver insatisfeito, diga que vai encaminhar para um humano.
3. NUNCA INVENTE INFORMAÇÕES - Se não souber a resposta, diga que vai verificar com a equipe.
4. NUNCA PROMETA PRAZOS OU RESULTADOS que você não pode garantir.
5. COLETE DADOS MÍNIMOS para facilitar o atendimento humano quando escalar.

QUANDO ESCALAR PARA HUMANO:
- Solicitação de cancelamento/reembolso
- Reclamação ou insatisfação
- Problema técnico não documentado
- Pedido de ação específica
- Cliente explicitamente pede falar com humano
- Informação não disponível na base de conhecimento
```

### 4.4 Prompt de Guardrails — Modo Vendas (quando `sales_mode_enabled = true`)

Substitui o prompt informativo. Mantém os mesmos princípios de segurança e adiciona regras comerciais:

```text
VOCÊ É UM VENDEDOR CONVERSACIONAL DA LOJA. PODE CONDUZIR A VENDA DO INÍCIO AO FIM
USANDO APENAS AS TOOLS LIBERADAS PARA O ESTADO ATUAL DA CONVERSA.

REGRAS ABSOLUTAS DE SEGURANÇA:
1. SÓ EXECUTE AÇÕES VIA TOOLS - Nunca afirme ao cliente que executou uma ação se a tool
   correspondente não foi chamada neste turno. Proibido: "reenviei seu e-mail",
   "cancelei seu pedido", "acionei o suporte", "atualizei seu cadastro" sem tool real.
2. ALLOWLIST É LIMITE ABSOLUTO - Se o cliente pedir algo fora da allowlist (cancelar
   pedido, alterar pedido pago, mudar preço, criar cupom, etc.), diga que vai
   encaminhar e chame request_human_handoff.
3. NUNCA INVENTE PRODUTO, PREÇO, ESTOQUE OU CUPOM - Tudo vem das tools de catálogo.
   Antes de NEGAR a existência de um produto, chame search_products.
4. ESCOPO DO CLIENTE - Você só vê e altera dados do cliente desta conversa. Nunca
   acesse dados de outro cliente.
5. CONFIRMAÇÃO ÚNICA - Quando o cliente confirma a compra ("sim", "fechado", "pode
   gerar"), chame add_to_cart + generate_checkout_link no mesmo turno. Proibido pedir
   nova confirmação depois de uma confirmação clara.
6. HANDOFF É TERMINAL - Se prometeu humano, chame request_human_handoff antes de
   responder. Após o handoff, encerre o turno.

QUANDO ESCALAR PARA HUMANO (chame request_human_handoff):
- Pedido de atacado/B2B fora da política de varejo
- Negociação de preço/condição fora dos cupons disponíveis
- Reclamação grave / cliente irritado
- Solicitação de ação fora da allowlist (cancelar/alterar pedido, reembolso)
- Erro técnico repetido em tool
- Cliente pede explicitamente falar com humano
```

### 4.5 Comportamento Esperado

| Cenário | Modo Informativo | Modo Vendas |
|---------|------------------|-------------|
| Pergunta sobre prazo de entrega | Responde com base na KB | Responde com base na KB + tool de frete se houver CEP |
| Cliente quer comprar produto X | Coleta dados + escala | Conduz a venda com tools (search → details → cart → checkout) |
| Solicitação de cancelamento | Escala + coleta dados | Escala via `request_human_handoff` (fora da allowlist) |
| Reclamação de produto | Escala + coleta detalhes | Escala via `request_human_handoff` |
| Pergunta não documentada | "Vou verificar" + escala | "Vou verificar" + escala (não inventa) |
| Cliente pede desconto fora dos cupons | N/A (não vende) | `request_human_handoff` com `reason='custom_negotiation'` |
| Cliente confirma compra com dados | N/A | `add_to_cart` + `generate_checkout_link` no mesmo turno |
| Elogio | Agradece e registra | Agradece e registra |

### 4.6 Defesa em Profundidade (server-side)

Mesmo se o modelo "alucinar" e tentar uma tool fora do permitido, o orquestrador bloqueia em três camadas:

1. **Filtro por modo:** se `sales_mode_enabled = false`, todas as tools comerciais são removidas da chamada à OpenAI.
2. **Filtro por estado da pipeline F2:** mesmo no Modo Vendas, só as tools do estado atual ficam expostas (ver `whatsapp/pipeline-f2-vendas-ia.md` §2).
3. **Scrubber pré-envio:** antes de enviar a resposta ao cliente, o texto é varrido por verbos de ação ("reenviei", "cancelei", "acionei", "atualizei seu cadastro", etc.). Se nenhuma tool correspondente foi chamada no turno, força handoff técnico em vez de mandar a fala.

### 4.7 Auditoria Obrigatória

Todo turno grava em `ai_support_turn_log`:
- `sales_mode_enabled` (snapshot do toggle no momento da resposta)
- `sales_state_before` / `sales_state_after`
- `tools_available` (lista filtrada que foi exposta ao modelo)
- `tools_called` (lista do que o modelo realmente chamou)
- `scrubber_blocked` (true se o scrubber pré-envio bloqueou alguma fala)
- `pre_transition_reason` / `state_transition_reason`

Sem auditoria gravada, a resposta não é despachada.

### 4.8 Tratamento de Input Degenerado (Eixo 1.3)

Para evitar que mensagens "vazias" do cliente (só pontuação, só emoji, ou com menos de 2 caracteres alfanuméricos) sejam roteadas para o modelo — gerando respostas confusas ou loops — o orquestrador aplica um detector pré-modelo:

- **Quando aplica:** apenas após a fase inicial da conversa (mais de 5 mensagens trocadas). Conversas novas seguem o fluxo padrão de saudação.
- **Resposta a 1 ou 2 inputs ambíguos seguidos:** o sistema responde "Não entendi sua última mensagem, pode reescrever, por favor?" e **não altera** o estado comercial (`sales_state`). O contador `metadata.ambiguous_input_count` é incrementado.
- **Resposta ao 3º input ambíguo seguido:** handoff automático, idempotente por conversa, com `reason='ambiguous_input'`. A conversa entra em `waiting_agent` e fica visível na fila de atendimento humano. Contador é zerado.
- **Reset:** qualquer mensagem compreensível zera o contador.

Esse detector evita gastar tokens, evita poluir o histórico com respostas-modelo tentando adivinhar e garante que clientes sem contexto cheguem rapidamente a um humano.

### 4.9 Anti-Repetição de Resposta (Eixo 1.4)

Cada resposta gerada é hasheada por um **prefixo normalizado de 80 caracteres** (lowercase, sem acentos, sem pontuação, espaços colapsados). Esse hash é comparado contra o histórico recente de hashes da mesma conversa.

- **Se houver colisão (resposta praticamente repetida):** o orquestrador faz **uma** tentativa de regeneração com `tool_choice='none'`, instruindo o modelo a reformular completamente abertura, palavras e estrutura, mantendo o mesmo conteúdo de negócio (preços, produtos, condições).
- **Se a regeneração ainda colidir:** a resposta é suprimida (não enviada ao cliente) e a duplicata é registrada na auditoria.
- **Por que prefixo e não conteúdo inteiro:** repetições percebidas pelo cliente são quase sempre repetições de **abertura**. Comparar o prefixo normalizado captura colisões reais e ignora variações cosméticas no meio do texto.

---

## 5. Webhooks de Entrada

Cada canal possui seu próprio webhook que:
1. Recebe a mensagem do provedor
2. Cria/atualiza conversa na tabela `conversations`
3. Insere mensagem na tabela `messages`
4. **Invoca `ai-support-chat` se IA estiver habilitada**

| Canal | Edge Function | Invoca IA |
|-------|---------------|-----------|
| WhatsApp (Meta) | `meta-whatsapp-webhook` | ✅ Sim |
| WhatsApp (Z-API) | `support-webhook` | ✅ Sim |
| Messenger (FB) | `meta-page-webhook` | ✅ Sim |
| Instagram DM | `meta-instagram-webhook` | ✅ Sim |
| Comentários FB | `meta-page-webhook` | ❌ Não |
| Comentários IG | `meta-instagram-webhook` | ❌ Não |
| Email | `support-email-inbound` | ✅ Sim |
| Chat Widget | `SupportChatWidget.tsx` → `ai-support-chat` | ✅ Sim |

### Lógica de Invocação da IA

Antes de invocar a IA, os webhooks verificam:

```typescript
// 1. Verifica config global
const { data: aiConfig } = await supabase
  .from("ai_support_config")
  .select("is_enabled")
  .eq("tenant_id", tenantId)
  .single();

// 2. Verifica config específica do canal (opcional)
const { data: channelAiConfig } = await supabase
  .from("ai_channel_config")
  .select("is_enabled")
  .eq("tenant_id", tenantId)
  .eq("channel_type", channelType) // 'whatsapp', 'email', etc.
  .single();

// 3. IA habilitada se: global ON && (sem config canal OU canal ON)
const aiEnabled = aiConfig?.is_enabled && (channelAiConfig?.is_enabled !== false);

if (aiEnabled) {
  await fetch(`${SUPABASE_URL}/functions/v1/ai-support-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      conversation_id: conversationId,
      tenant_id: tenantId,
    }),
  });
}
```

---

## 5.1. Gate Universal de Canal (Fonte de Verdade)

### Regra
A tabela `channel_accounts` é a **fonte única de verdade** para "canal habilitado". A IA de atendimento (`ai-support-chat`) executa um gate obrigatório no início do fluxo, antes de qualquer chamada ao LLM, RAG ou ferramenta de venda.

### Comportamento
Para cada conversa recebida, o motor consulta `channel_accounts` filtrando por `tenant_id` + `channel_type` da conversa. A IA **só responde** quando existe registro **e** `is_active = true`. Caso contrário, retorna imediatamente o código `CHANNEL_DISABLED` e encerra a execução.

| Estado em `channel_accounts` | Comportamento da IA |
|------------------------------|---------------------|
| Registro existe, `is_active = true`  | IA responde normalmente (sujeita às demais regras) |
| Registro existe, `is_active = false` | IA bloqueada → `CHANNEL_DISABLED` |
| Registro inexistente                  | IA bloqueada → `CHANNEL_DISABLED` (ausência = inativo) |

### Persistência (UI Desativar/Reativar vs. Remover)
A ação **Desativar** na tela de Canais de Atendimento **não exclui** o registro: apenas alterna `is_active = false`. Isso preserva a fonte de verdade do gate e permite Reativar com 1 clique. A ação **Remover Permanentemente** existe como ação secundária explícita, com confirmação obrigatória.

### Ordem de Verificação no Motor
1. Conversa existe? (senão → `CONVERSATION_NOT_FOUND`)
2. **Gate Universal**: `channel_accounts.is_active`? (senão → `CHANNEL_DISABLED`)
3. Config por canal `ai_channel_config.is_enabled`? (senão → `CHANNEL_AI_DISABLED`)
4. Config global `ai_support_config.is_enabled`? (senão → desabilitado)
5. Demais regras (horário de atendimento, handoff, RAG, etc.)

### Por que esse gate é obrigatório
Antes do gate universal, cada webhook (`meta-whatsapp-webhook`, `instagram-webhook`, chat do site) verificava apenas `ai_support_config` global e `ai_channel_config`. A tabela `channel_accounts` era usada só para credenciais. Resultado: ao "desativar" um canal pela UI o registro era apagado, mas como o motor não consultava `channel_accounts`, a IA continuava respondendo. O gate universal centraliza a verificação no motor (entrada única para todos os webhooks) e elimina a divergência.

---

## 6. Edge Function `ai-support-chat`

### Responsabilidades

1. Carregar histórico da conversa
2. Montar contexto (produtos, FAQs, políticas se habilitado)
3. **Injetar guardrails informativos**
4. Gerar resposta via **OpenAI API**
5. Salvar resposta na tabela `messages`
6. **Registrar consumo de tokens (metering)**
7. Enviar resposta de volta pelo canal correto

### Fluxo de Execução

```typescript
// 1. Buscar configuração do tenant
const aiConfig = await getAiConfig(tenantId);

// 2. Montar mensagens com contexto
const messages = [
  { role: 'system', content: systemPrompt + GUARDRAILS },
  ...conversationHistory,
];

// 3. Chamar OpenAI
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: resolvedModel, // gpt-5.2 com fallback
    messages,
    max_tokens: aiConfig.max_response_length || 500,
    temperature: 0.7,
  }),
});

// 4. Registrar consumo (billing)
await supabase.rpc('record_ai_usage', {
  p_tenant_id: tenantId,
  p_usage_cents: calculatedCost,
});

// 5. Registrar evento (observabilidade) e métricas
await supabase.rpc('increment_ai_metrics', {
  p_tenant_id: tenantId,
  p_messages: 1,
  p_images: visionProcessed ? 1 : 0,
  p_audio_count: audioProcessed ? 1 : 0,
  p_audio_seconds: audioDurationSeconds,
  p_handoffs: handoffTriggered ? 1 : 0,
  p_no_evidence: ragNoEvidence ? 1 : 0,
  p_embedding_tokens: embeddingTokens,
});

await supabase.from('conversation_events').insert({
  conversation_id,
  tenant_id,
  event_type: 'ai_response',
  metadata: {
    model: resolvedModel,
    input_tokens,
    output_tokens,
    latency_ms,
    cost_cents,
  },
});
```

### Envio por Canal

```typescript
if (conversation.channel_type === "whatsapp" && conversation.customer_phone) {
  await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-send`, {
    body: JSON.stringify({
      tenant_id,
      phone: conversation.customer_phone,
      message: aiContent,
    }),
  });
}
```

---

## 7. Billing e Metering

### Custos por Modelo (aproximados)

| Modelo | Input ($/1M tokens) | Output ($/1M tokens) |
|--------|---------------------|----------------------|
| gpt-5.2 | $5.00 | $15.00 |
| gpt-5 | $5.00 | $15.00 |
| gpt-5-mini | $0.30 | $1.00 |
| gpt-5-nano | $0.10 | $0.40 |
| gpt-4o | $2.50 | $10.00 |

### Registro de Consumo

O consumo é registrado via RPC `record_ai_usage` que incrementa o campo `ai_usage_cents` na tabela `tenant_monthly_usage`.

```sql
-- Exemplo de query para ver consumo
SELECT tenant_id, year_month, ai_usage_cents 
FROM tenant_monthly_usage 
WHERE tenant_id = 'xxx'
ORDER BY year_month DESC;
```

### Métricas Registradas

Cada resposta de IA registra em `conversation_events`:

| Campo | Descrição |
|-------|-----------|
| `model` | Modelo usado |
| `input_tokens` | Tokens de entrada |
| `output_tokens` | Tokens de saída |
| `latency_ms` | Tempo de resposta |
| `cost_cents` | Custo em centavos |

---

## 8. Emails (Transacionais e Marketing)

### Templates de Email
| Template | Trigger | Descrição |
|----------|---------|-----------|
| Boas-vindas | Cadastro | Novo cliente |
| Confirmação de pedido | Checkout | Pedido criado |
| Pagamento aprovado | Webhook | PIX/Cartão OK |
| Nota fiscal | NF emitida | Envio da NF |
| Envio | Postagem | Código de rastreio |
| Entrega | Status update | Pedido entregue |
| Recuperação | Cron job | Carrinho abandonado |

### Variáveis de Template
| Variável | Descrição |
|----------|-----------|
| `{{customer.name}}` | Nome do cliente |
| `{{order.number}}` | Número do pedido |
| `{{order.total}}` | Valor total |
| `{{tracking.code}}` | Código de rastreio |
| `{{store.name}}` | Nome da loja |

---

## 9. Configuração de IA

### Tabela `ai_support_config` (Global)

```typescript
{
  tenant_id: uuid,
  is_enabled: boolean,
  ai_model: string, // 'gpt-5.2' padrão
  system_prompt: text,
  custom_knowledge: text,
  personality_name: string,
  personality_tone: 'formal' | 'casual' | 'friendly',
  use_emojis: boolean,
  max_response_length: number,
  max_messages_before_handoff: number,
  handoff_keywords: string[],
  forbidden_topics: string[],
  operating_hours: jsonb,
  out_of_hours_message: text,
  auto_import_products: boolean,
  auto_import_categories: boolean,
  auto_import_policies: boolean,
  auto_import_faqs: boolean,
  handle_images: boolean,
  handle_audio: boolean,
  approval_mode: boolean,
}
```

### Modelos Disponíveis na UI

| Opção | Modelo | Descrição |
|-------|--------|-----------|
| Máxima Qualidade | `gpt-5.2` | Melhor raciocínio (mais caro) |
| Alta Qualidade | `gpt-5` | Excelente (custo moderado) |
| Balanceado | `gpt-5-mini` | Bom custo-benefício |
| Econômico | `gpt-5-nano` | Mais barato |

### Tabela `ai_channel_config` (Por Canal)

Permite sobrescrever configurações específicas por canal:

```typescript
{
  tenant_id: uuid,
  channel_type: 'whatsapp' | 'email' | 'chat' | 'instagram' | 'messenger',
  is_enabled: boolean,
  system_prompt_override: text | null,
  forbidden_topics: string[],
  max_response_length: number | null,
  use_emojis: boolean | null,
  custom_instructions: text | null,
}
```

---

## 10. Provedores de WhatsApp

### Meta Cloud API (Recomendado)

| Campo | Descrição |
|-------|-----------|
| `phone_number_id` | ID do número no Meta |
| `access_token` | Token de acesso (criptografado) |
| `waba_id` | ID da conta WhatsApp Business |

**Webhook:** `meta-whatsapp-webhook`  
**Envio:** `meta-whatsapp-send`

### Z-API (Legacy)

| Campo | Descrição |
|-------|-----------|
| `instance_id` | ID da instância Z-API |
| `api_token` | Token da API |
| `client_token` | Token do cliente |

**Webhook:** `support-webhook`  
**Envio:** `whatsapp-send`

---

## 11. Tabelas de Configuração

### `whatsapp_configs`

```sql
CREATE TABLE whatsapp_configs (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  provider text NOT NULL, -- 'meta' | 'z-api'
  phone_number text,
  phone_number_id text,
  instance_id text,
  api_token text, -- encrypted
  client_token text, -- encrypted
  access_token text, -- encrypted
  waba_id text,
  connection_status text, -- 'connected' | 'disconnected' | 'qr_pending'
  is_enabled boolean DEFAULT true,
  UNIQUE(tenant_id, provider)
);
```

### RLS Policies

```sql
-- Owners/admins podem gerenciar configs do próprio tenant
CREATE POLICY "Tenant owners can view their whatsapp_configs"
ON whatsapp_configs FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = auth.uid()
    AND ur.tenant_id = whatsapp_configs.tenant_id
    AND ur.role IN ('owner', 'admin')
));

-- Policies similares para INSERT, UPDATE, DELETE
```

---

## 12. Teste Ponta a Ponta

### Passos para Validar

1. **Enviar mensagem** (WhatsApp/Chat/Email)
2. **Verificar log da Edge Function** (`ai-support-chat`)
3. **Confirmar modelo usado** (gpt-5.2 por padrão)
4. **Validar resposta informativa** (sem promessas de ação)
5. **Verificar consumo registrado** (`tenant_monthly_usage.ai_usage_cents`)
6. **Verificar evento registrado** (`conversation_events` com metadata de tokens)

### Comandos de Debug

```sql
-- Ver últimas respostas de IA
SELECT * FROM messages 
WHERE is_ai_generated = true 
ORDER BY created_at DESC LIMIT 10;

-- Ver consumo de IA por tenant
SELECT * FROM tenant_monthly_usage 
WHERE ai_usage_cents > 0 
ORDER BY year_month DESC;

-- Ver eventos de IA
SELECT * FROM conversation_events 
WHERE event_type = 'ai_response' 
ORDER BY created_at DESC LIMIT 10;
```

---

## Checklist de Implementação

- [x] Inbox unificado
- [x] Integrar WhatsApp Meta Cloud API
- [x] Integrar WhatsApp Z-API
- [x] Widget de chat ao vivo
- [x] IA para atendimento automático
- [x] Invocação automática da IA em todos os canais
- [x] **Migrar provider para OpenAI (GPT-5.2)**
- [x] **Implementar guardrails informativos**
- [x] **Metering de tokens por tenant**
- [x] **Fallback automático de modelos**
- [x] **Seletor de modelo na UI**
- [x] **RAG com busca semântica (Knowledge Base)**
- [x] **Vision para análise de imagens (GPT-4o)**
- [x] **Transcrição de áudio (Whisper)**
- [x] **Fila assíncrona de processamento de mídia**
- [x] **Intent classification via Tool Calling**
- [x] **Handoff automático inteligente**
- [x] **Redação de PII (LGPD)**
- [ ] Templates de email editáveis
- [ ] Automações de follow-up
- [ ] Instagram DM
- [ ] Messenger

---

## 13. RAG (Retrieval-Augmented Generation)

### Visão Geral

O sistema utiliza busca semântica para contextualizar as respostas da IA com base em documentos cadastrados na Knowledge Base.

### Componentes

| Componente | Descrição |
|------------|-----------|
| `knowledge_base_docs` | Documentos fonte (políticas, FAQs) |
| `knowledge_base_chunks` | Chunks vetorizados com embeddings |
| `ai-generate-embedding` | Edge Function para gerar embeddings |
| `search_knowledge_base` | RPC para busca semântica |

### Configuração por Tenant

```typescript
// ai_support_config
{
  rag_top_k: number,              // Máximo de chunks (default: 5)
  rag_similarity_threshold: number, // Limiar de similaridade (default: 0.7)
  rag_min_evidence_chunks: number,  // Mínimo para responder (default: 1)
  handoff_on_no_evidence: boolean,  // Escalar se não houver evidência
}
```

### Fluxo de RAG

```typescript
// 1. Gerar embedding da pergunta
const embedding = await generateEmbedding(customerMessage);

// 2. Buscar chunks similares
const { data: chunks } = await supabase.rpc('search_knowledge_base', {
  p_tenant_id: tenantId,
  p_query_embedding: embedding,
  p_top_k: config.rag_top_k || 5,
  p_threshold: config.rag_similarity_threshold || 0.7,
});

// 3. Verificar evidência mínima
if (chunks.length < config.rag_min_evidence_chunks && config.handoff_on_no_evidence) {
  // Escalar para humano - sem evidência suficiente
  return triggerHandoff('no_evidence');
}

// 4. Montar contexto para a IA
const ragContext = chunks.map(c => c.chunk_text).join('\n---\n');
```

---

## 14. Processamento de Mídia (Vision e Áudio)

### Fila Assíncrona

O processamento de imagens e áudio é feito via fila (`ai_media_queue`) para não bloquear o fluxo principal.

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando processamento |
| `processing` | Em execução |
| `completed` | Concluído com sucesso |
| `failed` | Falhou após max_attempts |

### Edge Functions

| Função | Modelo | Descrição |
|--------|--------|-----------|
| `ai-support-vision` | GPT-4o | Análise de imagens |
| `ai-support-transcribe` | Whisper | Transcrição de áudio |
| `ai-media-queue-process` | - | Processador da fila (cron) |

### Fluxo de Imagem

```typescript
// 1. Mensagem com imagem recebida
// 2. Criar item na fila
await supabase.from('ai_media_queue').insert({
  tenant_id,
  message_id,
  attachment_id,
  process_type: 'vision',
  status: 'pending',
});

// 3. Cron processa (ai-media-queue-process)
// 4. Chama ai-support-vision
// 5. Atualiza metadata do attachment
await supabase.from('message_attachments').update({
  ai_description: "Cliente mostra produto com defeito na embalagem",
  ai_extracted_text: "Texto extraído da imagem...",
  ai_suggested_actions: ["Solicitar fotos adicionais", "Escalar para logística"],
  vision_processed_at: new Date().toISOString(),
});

// 6. Descrição é injetada no contexto do ai-support-chat
```

### Fluxo de Áudio

```typescript
// 1. Mensagem com áudio recebida
// 2. Criar item na fila
await supabase.from('ai_media_queue').insert({
  tenant_id,
  message_id,
  attachment_id,
  process_type: 'transcription',
  status: 'pending',
});

// 3. Cron processa (ai-media-queue-process)
// 4. Chama ai-support-transcribe (OpenAI Whisper)
// 5. Atualiza metadata do attachment
await supabase.from('message_attachments').update({
  transcription: "Olá, estou ligando porque...",
  transcription_duration_seconds: 45,
  transcription_processed_at: new Date().toISOString(),
});

// 6. Transcrição é injetada no contexto do ai-support-chat
```

---

## 14.1 Garantias de Integridade do Consumo de Mídia (v2026-04-26 — D7)

O processamento de mídia (imagem/áudio) é assíncrono. Para garantir que a IA **só responda depois que a descrição/transcrição estiver pronta**, sem duplicar mensagens e sem gerar loops, o motor de atendimento opera 4 mecanismos obrigatórios — todos validados fim a fim por harness técnico (ver §17.1).

### 14.1.1 Gate de Espera no Chat (`pending_media_processing`)

Quando uma mensagem entra com anexo de imagem ou áudio:

1. A mensagem é gravada com a flag `pending_media_processing = true`.
2. O motor `ai-support-chat`, ao processar a conversa, detecta a flag e **não chama o LLM**.
3. Em vez disso, envia uma única mensagem de espera ("Recebi sua mídia, estou analisando…") e encerra.
4. Quando o consumidor da fila (`ai-media-queue-process`) conclui o processamento e atualiza o anexo (`vision_processed_at` / `transcription_processed_at`), um trigger limpa `pending_media_processing = false`.
5. O próximo turno do chat (ou um disparo de reprocesso — ver §14.1.3) já encontra a flag limpa e prossegue normalmente, com a descrição/transcrição injetada no contexto.

### 14.1.2 Anti-Loop da Mensagem de Espera (`media_wait_reply_sent`)

A mensagem de espera só pode ser enviada **uma vez por mídia pendente**. O motor controla isso pela flag `media_wait_reply_sent`:

- Se `pending_media_processing = true` E `media_wait_reply_sent = false` → envia a espera, marca `media_wait_reply_sent = true` e encerra.
- Se `pending_media_processing = true` E `media_wait_reply_sent = true` → encerra silenciosamente, sem reenviar a espera.

**Regra:** nunca reenviar a mesma mensagem de espera para a mesma mídia. Reenviar é regressão e deve ser tratado como bug.

### 14.1.3 Reprocesso Único Garantido

Quando o consumidor da fila finaliza uma mídia, ele dispara **um único reprocesso** do `ai-support-chat` para aquela conversa, garantindo que a IA responda sem depender do próximo turno do cliente. Esse reprocesso:

- Acontece **somente** após `status = completed` no item da fila.
- Gera **uma única resposta** da IA — controlado pelo gate de espera + flag de consumo (§14.1.4).
- Em caso de falha de processamento (`status = failed` após `max_attempts`), o gate é liberado mesmo sem descrição/transcrição, e o motor segue com o conteúdo textual disponível (fallback).

### 14.1.4 Consumo Registrado (`consumed_at`)

Quando a descrição/transcrição entra de fato no system prompt da chamada ao LLM, o motor grava `consumed_at = NOW()` no anexo correspondente. Isso serve como **prova auditável** de que o resultado da fila foi efetivamente injetado no contexto antes da resposta final — não apenas processado isoladamente.

### 14.1.5 Limpeza de Estado

Após a resposta da IA:

- `pending_media_processing` → fica `false` (limpo pelo trigger ao concluir o processamento).
- `media_wait_reply_sent` → permanece `true` apenas pelo tempo de vida daquela mídia pendente; é resetado quando uma nova mídia entra na conversa.
- Item da fila → `status = completed`, `processed_at` preenchido. Sem item órfão.

### 14.1.6 Regras Anti-Regressão (MANDATÓRIAS)

1. **Proibido** o motor `ai-support-chat` chamar o LLM com `pending_media_processing = true` para qualquer anexo da conversa atual.
2. **Proibido** enviar a mensagem de espera mais de uma vez para a mesma mídia pendente.
3. **Proibido** declarar uma resposta de IA como válida em conversa com mídia sem `consumed_at` preenchido no anexo correspondente.
4. **Proibido** reprocessar o chat antes de `status = completed` (ou `failed` final) no item da fila.
5. Toda alteração no fluxo de mídia DEVE rodar o harness `d7-media-harness` (§17.1) e provar os 6 pontos: registro de mensagem/anexo, enfileiramento correto, processamento concluído, consumo no contexto, anti-loop, limpeza de estado.

---

## 15. Intent Classification (Tool Calling)

### Objetivo

Classificar automaticamente a intenção do cliente para decidir:
- Se a IA pode responder
- Se deve escalar para humano
- Qual prioridade atribuir

### Schema do Tool

```typescript
const classifyIntentTool = {
  type: "function",
  function: {
    name: "classify_intent",
    description: "Classifica a intenção e sentimento do cliente",
    parameters: {
      type: "object",
      properties: {
        intent: {
          type: "string",
          enum: ["question", "complaint", "request_action", "praise", "other"],
        },
        sentiment: {
          type: "string",
          enum: ["positive", "neutral", "negative", "aggressive"],
        },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
        },
        requires_action: {
          type: "boolean",
          description: "Se o cliente solicita uma ação (cancelar, reembolsar, etc)",
        },
        topic: {
          type: "string",
          description: "Tópico principal (entrega, pagamento, produto, etc)",
        },
      },
      required: ["intent", "sentiment", "urgency", "requires_action"],
    },
  },
};
```

### Gatilhos de Handoff Automático

| Condição | Ação |
|----------|------|
| `requires_action === true` | Escalar para humano |
| `sentiment === 'aggressive'` | Escalar para humano |
| `intent === 'complaint' && urgency === 'high'` | Escalar para humano |
| Sem evidência na KB | Escalar para humano |
| Cliente pediu humano | Escalar para humano |

---

## 16. Metering Avançado

### Métricas por Tenant (tenant_monthly_usage)

| Campo | Descrição |
|-------|-----------|
| `ai_messages_count` | Total de mensagens processadas pela IA |
| `ai_image_analysis_count` | Imagens analisadas via Vision |
| `ai_audio_transcription_count` | Áudios transcritos |
| `ai_audio_duration_seconds` | Total de segundos de áudio |
| `ai_handoff_count` | Escalações para humano |
| `ai_no_evidence_count` | Respostas sem evidência na KB |
| `ai_embedding_tokens` | Tokens usados em embeddings |
| `ai_usage_cents` | Custo total em centavos |

### RPC de Incremento

```sql
SELECT increment_ai_metrics(
  p_tenant_id := 'uuid',
  p_messages := 1,
  p_images := 1,
  p_audio_count := 0,
  p_audio_seconds := 0,
  p_handoffs := 0,
  p_no_evidence := 0,
  p_embedding_tokens := 150
);
```

---

## 17. Redação de PII (LGPD)

### Dados Redatados

O sistema mascara automaticamente:
- CPF (`***.456.789-**`)
- CNPJ (`12.345.***/0001-**`)
- Telefones (`(**) *****-1234`)
- Emails (`jo***@***.com`)
- CEPs (`*****-123`)
- Chaves Pix (parcialmente mascaradas)
- RGs

### Onde é Aplicado

| Local | Aplicação |
|-------|-----------|
| `ai_context_used` | Logs de contexto da IA |
| Resumos de conversa | Quando enviados para humanos |
| Exportações | Relatórios e analytics |

### Configuração

```typescript
// ai_support_config
{
  redact_pii_in_logs: boolean,   // Ativar redação (default: true)
  data_retention_days: number,  // Retenção de dados (default: 365)
}
```

---

## Componentes de Data Padronizados

| Submódulo | Campo | Componente |
|-----------|-------|------------|
| Notificações | Filtro de período (NotificationsFilter) | `DateRangeFilter` |

> Ver `regras-gerais.md` § Padrão de Datas para especificação completa.

---

## 17.1 Harness de Validação Fim a Fim — Mídia (D7)

Para auditar o pipeline completo de mídia (registro → fila → processamento → consumo → limpeza), o sistema mantém um harness dedicado que dispara um cenário real e retorna evidência concreta de cada etapa. Esse harness é **a única forma oficial de declarar o D7 como tecnicamente fechado** após qualquer alteração no fluxo.

**Função:** `d7-media-harness` (Edge Function de auditoria — não destinada a uso operacional).

**O que valida (6 pontos obrigatórios):**

1. **Entrada da mídia** — mensagem registrada e anexo registrado.
2. **Enfileiramento** — linha criada em `ai_media_queue` com tipo correto (`vision` para imagem, `transcription` para áudio).
3. **Processamento** — item da fila atinge `status = completed` com `processed_at` e resultado persistido.
4. **Consumo no contexto** — descrição/transcrição entrou no system prompt do `ai-support-chat` antes da resposta final (provado por `consumed_at`).
5. **Anti-loop e reprocesso único** — sem resposta duplicada, sem mensagem de espera repetida, exatamente um reprocesso por mídia.
6. **Limpeza de estado** — `pending_media_processing` liberado após conclusão; sem item órfão na fila.

**Critério de fechamento:** o harness deve retornar evidência positiva nos 6 pontos acima. Resultado parcial não fecha o D7.

