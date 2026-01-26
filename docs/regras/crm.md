# CRM (Notificações, Atendimento, Emails, Avaliações) — Regras e Especificações

> **STATUS:** ✅ Ready (Emails, Notificações, Atendimento WhatsApp com IA, Avaliações)

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

---

## 1. Notificações

### Tipos de Notificação
| Tipo | Canal | Descrição |
|------|-------|-----------|
| `order_confirmed` | Email | Pedido confirmado |
| `order_shipped` | Email/Push | Pedido enviado |
| `order_delivered` | Email/Push | Pedido entregue |
| `payment_approved` | Email | Pagamento aprovado |
| `payment_failed` | Email | Pagamento falhou |
| `abandoned_cart` | Email | Carrinho abandonado |

### Canais
| Canal | Status | Descrição |
|-------|--------|-----------|
| Email | ✅ Ready | Via Resend |
| Push Web | 🟧 Pending | Web Push API |
| WhatsApp | ✅ Ready | Via Meta/Z-API |
| SMS | 🟧 Pending | Via providers |

---

## 2. Atendimento (Support)

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Inbox unificado | ✅ Ready | Todas as conversas |
| WhatsApp (Meta) | ✅ Ready | Via Meta Cloud API |
| WhatsApp (Z-API) | ✅ Ready | Via Z-API |
| Instagram DM | 🟧 Pending | Via Meta |
| Email | ✅ Ready | Recebimento via Resend |
| Chat ao vivo | ✅ Ready | Widget na loja |
| IA Atendente | ✅ Ready | Respostas automáticas |

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

## 3. Fluxo de Atendimento com IA

### Webhooks de Entrada

Cada canal possui seu próprio webhook que:
1. Recebe a mensagem do provedor
2. Cria/atualiza conversa na tabela `conversations`
3. Insere mensagem na tabela `messages`
4. **Invoca `ai-support-chat` se IA estiver habilitada**

| Canal | Edge Function | Invoca IA |
|-------|---------------|-----------|
| WhatsApp (Meta) | `meta-whatsapp-webhook` | ✅ Sim |
| WhatsApp (Z-API) | `support-webhook` | ✅ Sim |
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

### Edge Function `ai-support-chat`

Responsável por:
1. Carregar histórico da conversa
2. Montar contexto (produtos, FAQs, políticas se habilitado)
3. Gerar resposta via Lovable AI (Gemini/GPT)
4. Salvar resposta na tabela `messages`
5. **Enviar resposta de volta pelo canal correto**

```typescript
// Envio por canal (ai-support-chat/index.ts)
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

## 4. Emails (Transacionais e Marketing)

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

## 5. Configuração de IA

### Tabela `ai_support_config` (Global)

```typescript
{
  tenant_id: uuid,
  is_enabled: boolean,
  ai_model: string, // 'google/gemini-2.5-flash' padrão
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

## 6. Provedores de WhatsApp

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

## 7. Tabelas de Configuração

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

## Checklist de Implementação

- [x] Inbox unificado
- [x] Integrar WhatsApp Meta Cloud API
- [x] Integrar WhatsApp Z-API
- [x] Widget de chat ao vivo
- [x] IA para atendimento automático
- [x] Invocação automática da IA em todos os canais
- [ ] Templates de email editáveis
- [ ] Automações de follow-up
- [ ] Instagram DM
- [ ] Messenger
