# Email Marketing — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2025-01-20

---

## Visão Geral

Sistema completo de email marketing com listas segmentadas, templates personalizáveis, campanhas broadcast e automações por trigger.

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/EmailMarketing.tsx` | Dashboard principal |
| `src/hooks/useEmailMarketing.ts` | Hook CRUD centralizado |
| `supabase/functions/email-campaign-broadcast/` | Disparo em massa |
| `supabase/functions/email-dispatcher/` | Worker de processamento |
| `supabase/functions/marketing-form-submit/` | Captura de leads |
| `supabase/functions/email-unsubscribe/` | Descadastramento |

---

## Tabelas do Banco

### email_marketing_lists
Listas segmentadas de contatos.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `name` | TEXT | Nome da lista |
| `description` | TEXT | Descrição |
| `is_active` | BOOLEAN | Ativa para envio |

### email_marketing_subscribers
Assinantes com status e tags.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `email` | TEXT | Email (único por tenant) |
| `name` | TEXT | Nome do assinante |
| `phone` | TEXT | Telefone |
| `status` | ENUM | `active`, `unsubscribed`, `bounced` |
| `source` | TEXT | Origem (ex: `form:newsletter`) |
| `tags` | TEXT[] | Tags para segmentação |
| `metadata` | JSONB | Dados extras |

### email_marketing_templates
Modelos de email com variáveis dinâmicas.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `name` | TEXT | Nome interno |
| `subject` | TEXT | Assunto (suporta `{{name}}`) |
| `body_html` | TEXT | Corpo HTML |
| `body_text` | TEXT | Versão texto |
| `variables` | TEXT[] | Variáveis disponíveis |

### email_marketing_campaigns
Campanhas broadcast ou automações.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `type` | ENUM | `broadcast`, `automation` |
| `name` | TEXT | Nome da campanha |
| `template_id` | UUID | FK template |
| `list_id` | UUID | FK lista (broadcast) |
| `trigger_type` | TEXT | Trigger (automation) |
| `status` | ENUM | `draft`, `active`, `paused`, `completed` |

### email_send_queue
Fila de envio com status.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `campaign_id` | UUID | FK campaign |
| `subscriber_id` | UUID | FK subscriber |
| `to_email` | TEXT | Email destino |
| `subject` | TEXT | Assunto renderizado |
| `body_html` | TEXT | Corpo renderizado |
| `status` | ENUM | `queued`, `sending`, `sent`, `failed`, `skipped` |
| `scheduled_at` | TIMESTAMPTZ | Agendamento |
| `sent_at` | TIMESTAMPTZ | Data de envio |
| `provider_message_id` | TEXT | ID do provedor |

---

## Fluxos

### Broadcast Campaign

```
1. Admin cria campanha tipo "broadcast"
   ↓
2. Seleciona template + lista
   ↓
3. Clica "Enviar"
   ↓
4. Edge Function email-campaign-broadcast:
   - Busca subscribers ativos da lista
   - Cria entries na email_send_queue
   - Marca campanha como "active"
   ↓
5. email-dispatcher (scheduler):
   - Processa fila em batches
   - Marca como "sending" (lock)
   - Verifica status do subscriber
   - Adiciona link de descadastro
   - Envia via Resend
   - Atualiza status para "sent" ou "failed"
```

### Automation

```
1. Subscriber se cadastra via formulário
   ↓
2. marketing-form-submit:
   - Upsert subscriber
   - Adiciona a lista configurada
   - Adiciona tags
   - Dispara triggerAutomations()
   ↓
3. Para cada automation ativa com trigger_type="subscribed":
   - Busca steps da campanha
   - Agenda emails na fila com delay
```

### Unsubscribe

```
1. Subscriber clica "descadastrar" no email
   ↓
2. email-unsubscribe:
   - Valida token
   - Marca subscriber.status = "unsubscribed"
   - Marca token como usado
```

---

## Captura de Leads

### Newsletter Block (Builder)

```typescript
// Bloco no builder chama marketing-form-submit
POST /marketing-form-submit
{
  "tenant_id": "...",
  "form_slug": "newsletter",
  "fields": {
    "email": "cliente@email.com",
    "name": "Nome"
  }
}
```

### Integrações

| Fonte | Comportamento |
|-------|---------------|
| NewsletterForm Block | Adiciona à lista via `marketing-form-submit` |
| NewsletterPopup Block | Popup com trigger (delay/scroll/exit_intent) |
| QuizEmbed Block | Quiz interativo via `quiz-submit` |
| Checkout | Captura com consentimento marketing |

### Builder Blocks (Categoria: Formulários)

| Bloco | Descrição |
|-------|-----------|
| `NewsletterForm` | Formulário inline de captura |
| `NewsletterPopup` | Popup com regras de exibição |
| `QuizEmbed` | Incorpora quiz do módulo Marketing |

---

## Provider (Resend)

Configuração em `email_provider_configs`:

| Campo | Descrição |
|-------|-----------|
| `provider` | `resend` |
| `api_key` | Chave da API |
| `from_email` | Email remetente verificado |
| `from_name` | Nome do remetente |

---

## Interface do Admin

### Abas do Dashboard

1. **Listas** - CRUD de listas segmentadas
2. **Assinantes** - Visualização/busca de subscribers
3. **Formulários** - Configuração de forms de captura
4. **Templates** - Editor de templates com preview
5. **Campanhas** - Gerenciamento de broadcasts/automações
6. **Estatísticas** - Métricas de envio

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Enviar email sem verificar status | Sempre checar `status === 'active'` |
| Hardcode de from_email | Usar config do tenant |
| Enviar sem link de descadastro | Sempre incluir unsubscribe link |

---

## Checklist

- [x] Listas CRUD funcional
- [x] Subscribers com status correto
- [x] Templates com variáveis
- [x] Broadcast enfileira corretamente
- [x] Dispatcher processa fila
- [x] Unsubscribe funciona
- [x] NewsletterForm block captura leads
- [x] NewsletterPopup block com triggers
- [x] QuizEmbed block integrado
- [x] sync_subscriber_to_customer_with_tag unificado
