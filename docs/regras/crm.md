# CRM (Notificações, Atendimento, Emails) — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção)

## Visão Geral

Módulo de relacionamento com cliente: notificações, atendimento/suporte, e gestão de emails.

---

## Submódulos

| Submódulo | Rota | Status |
|-----------|------|--------|
| Notificações | `/notifications` | 🟧 Pending |
| Atendimento | `/support` | 🟧 Pending |
| Emails | `/emails` | 🟧 Pending |

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Notifications.tsx` | Notificações push/email |
| `src/pages/Support.tsx` | Central de atendimento |
| `src/pages/Emails.tsx` | Gestão de emails |

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
| WhatsApp | 🟧 Pending | Via providers |
| SMS | 🟧 Pending | Via providers |

---

## 2. Atendimento (Support)

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Inbox unificado | 🟧 Pending | Todas as conversas |
| WhatsApp | 🟧 Pending | Integração |
| Instagram DM | 🟧 Pending | Via Meta |
| Email | 🟧 Pending | Recebimento |
| Chat ao vivo | 🟧 Pending | Widget na loja |
| IA Atendente | 🟧 Pending | Respostas automáticas |

### Status de Conversa
| Status | Descrição |
|--------|-----------|
| `open` | Aguardando atendimento |
| `in_progress` | Em atendimento |
| `waiting_customer` | Aguardando cliente |
| `resolved` | Resolvido |
| `closed` | Fechado |

### Modelo de Dados

```typescript
// conversations
{
  id: uuid,
  tenant_id: uuid,
  customer_id: uuid,
  channel: 'whatsapp' | 'instagram' | 'email' | 'chat',
  status: 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed',
  assigned_to: uuid,
  last_message_at: timestamptz,
  created_at: timestamptz,
}

// messages
{
  id: uuid,
  conversation_id: uuid,
  sender_type: 'customer' | 'agent' | 'ai',
  content: text,
  attachments: jsonb,
  created_at: timestamptz,
}
```

---

## 3. Emails (Transacionais e Marketing)

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

## Configuração de IA

```typescript
// ai_support_config
{
  tenant_id: uuid,
  is_enabled: boolean,
  ai_model: string,
  system_prompt: text,
  personality_name: string,
  personality_tone: 'formal' | 'casual' | 'friendly',
  max_response_length: number,
  handoff_keywords: string[],
  forbidden_topics: string[],
  operating_hours: jsonb,
  out_of_hours_message: text,
}
```

---

## Pendências

- [ ] Implementar inbox unificado
- [ ] Integrar WhatsApp Cloud API
- [ ] Widget de chat ao vivo
- [ ] IA para atendimento
- [ ] Templates de email editáveis
- [ ] Automações de follow-up
