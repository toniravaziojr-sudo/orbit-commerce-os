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
| `src/pages/EmailMarketing.tsx` | Dashboard principal com abas |
| `src/hooks/useEmailMarketing.ts` | Hook CRUD centralizado |
| `src/components/email-marketing/ListDialog.tsx` | Modal criar lista |
| `src/components/email-marketing/ListDetailDrawer.tsx` | Drawer detalhes da lista + subscribers |
| `src/components/builder/theme-settings/PopupSettings.tsx` | Config popup newsletter (tema) |
| `supabase/functions/email-campaign-broadcast/` | Disparo em massa |
| `supabase/functions/email-dispatcher/` | Worker de processamento |
| `supabase/functions/marketing-form-submit/` | Captura de leads |
| `supabase/functions/email-unsubscribe/` | Descadastramento |

---

## Modelo de Dados: Listas Baseadas em Tags

### REGRA FIXA: Toda lista DEVE ter uma tag vinculada

```
Tag (customer_tags) → Lista (email_marketing_lists) → Subscribers (email_marketing_subscribers)
     ↑                         |                              ↑
     |                         +---------- tag_id NOT NULL ---+
     |                                                        |
Customers ← customer_tag_assignments → Sync automático -------+
```

**Fluxo:**
1. Admin cria uma tag (ex: "Leads Quentes")
2. Admin cria lista vinculada à tag
3. Sistema sincroniza automaticamente todos os customers com essa tag para `email_marketing_subscribers`
4. Quando um customer recebe a tag, automaticamente vira subscriber

---

## Tabelas do Banco

### email_marketing_lists
Listas segmentadas de contatos - **OBRIGATÓRIO vincular a uma tag**.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `name` | TEXT | Nome da lista |
| `description` | TEXT | Descrição |
| `tag_id` | UUID | **FK customer_tags (NOT NULL)** |

### email_marketing_subscribers
Assinantes com status - **sincronizados automaticamente via tags**.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `email` | TEXT | Email (único por tenant) |
| `name` | TEXT | Nome do assinante |
| `phone` | TEXT | Telefone |
| `status` | ENUM | `active`, `unsubscribed`, `bounced` |
| `source` | TEXT | Origem (ex: `tag_sync`, `form:newsletter`) |
| `customer_id` | UUID | FK customers (vínculo com cliente) |
| `created_from` | TEXT | Origem da criação |

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
| **Popup Newsletter** | **Configurado em Configurações do Tema > Popup Newsletter** |
| QuizEmbed Block | Quiz interativo via `quiz-submit` |
| Checkout | Captura com consentimento marketing |

### Popup Newsletter (Configurações do Tema)

O popup de newsletter foi movido para **Configurações do Tema > Popup Newsletter** no Builder.

| Configuração | Descrição |
|--------------|-----------|
| `is_active` | Ativa/desativa o popup |
| `list_id` | Lista de email para adicionar leads |
| `layout` | centered, side-image, corner, fullscreen |
| `trigger_type` | delay, scroll, exit_intent, immediate |
| `trigger_delay_seconds` | Segundos de atraso (se trigger=delay) |
| `trigger_scroll_percent` | % de scroll (se trigger=scroll) |
| `show_on_pages` | Páginas onde exibir (home, category, product, cart, blog) |
| `show_once_per_session` | Exibir apenas 1x por sessão |

**Tabela:** `newsletter_popup_configs`

### Builder Blocks (Categoria: Formulários)

| Bloco | Descrição |
|-------|-----------|
| `NewsletterForm` | Formulário inline de captura |
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

### Abas do Dashboard (`EmailMarketing.tsx`)

1. **Listas** - CRUD de listas segmentadas
   - Clique na lista abre `ListDetailDrawer` com subscribers
   - Menu dropdown: Ver detalhes, Excluir
   - Badge com cor da tag vinculada
2. **Assinantes** - Visualização/busca de subscribers com filtro
3. **Formulários** - Configuração de forms de captura
4. **Templates** - Editor de templates com preview
5. **Campanhas** - Gerenciamento de broadcasts/automações
6. **Estatísticas** - Métricas de envio

### Popup Newsletter (Builder → Configurações do Tema)

Configurado em **Configurações do Tema > Popup Newsletter** no Builder visual.

| Componente | Arquivo |
|------------|---------|
| Settings UI | `src/components/builder/theme-settings/PopupSettings.tsx` |
| Tabela | `newsletter_popup_configs` |
| Menu item | `ThemeSettingsPanel.tsx` → view `popup` |

---

## Anti-Patterns

| Proibido | Correto |
|----------|---------|
| Criar lista sem tag | Toda lista DEVE ter tag vinculada |
| Enviar email sem verificar status | Sempre checar `status === 'active'` |
| Hardcode de from_email | Usar config do tenant |
| Enviar sem link de descadastro | Sempre incluir unsubscribe link |
| Adicionar subscriber manualmente | Usar tags - sync é automático |

---

## Triggers Automáticos

### trg_auto_tag_cliente_on_payment
Quando `payment_status` de um pedido muda para `paid`:
- Remove todas as tags do cliente
- Adiciona tag "Cliente" (verde #10B981)
- Se a tag não existir, cria automaticamente

### trg_sync_subscriber_on_tag
Quando um cliente recebe uma tag:
- Para cada lista vinculada à tag, insere/atualiza subscriber

### trg_auto_sync_list_subscribers
Quando uma lista é criada:
- Sincroniza automaticamente todos os customers que já têm a tag

---

## Campaign Builder (Editor Visual)

### Arquitetura

Página dedicada em `/email-marketing/campaign/new` com wizard de 3 steps:

| Step | Componente | Descrição |
|------|-----------|-----------|
| 1. Configuração | `StepConfig.tsx` | Nome, tipo (broadcast/automation), lista de destino |
| 2. Conteúdo | `StepContent.tsx` | Editor visual drag-and-drop com blocos |
| 3. Revisão | `StepReview.tsx` | Preview final, resumo, enviar/agendar |

### Arquivos do Builder

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/EmailMarketingCampaignBuilder.tsx` | Página do wizard (rota) |
| `src/hooks/useEmailCampaignBuilder.ts` | State machine (blocos, seleção, envio) |
| `src/lib/email-builder-utils.ts` | Serializar blocos → HTML inline-style |
| `src/components/email-marketing/campaign-builder/CampaignStepBar.tsx` | Barra de progresso |
| `src/components/email-marketing/campaign-builder/StepConfig.tsx` | Step 1 |
| `src/components/email-marketing/campaign-builder/StepContent.tsx` | Step 2 |
| `src/components/email-marketing/campaign-builder/StepReview.tsx` | Step 3 |
| `src/components/email-marketing/campaign-builder/EmailBlocksSidebar.tsx` | Sidebar de blocos |
| `src/components/email-marketing/campaign-builder/EmailCanvas.tsx` | Canvas sortable |
| `src/components/email-marketing/campaign-builder/BlockPropertyEditor.tsx` | Propriedades do bloco |
| `src/components/email-marketing/campaign-builder/EmailPreview.tsx` | Preview iframe |

### Blocos Disponíveis

| Tipo | Props Principais |
|------|-----------------|
| `text` | content, tag (h1/h2/p), align, color, fontSize |
| `image` | src, alt, width, link |
| `button` | text, url, bgColor, textColor, borderRadius |
| `divider` | color, thickness |
| `spacer` | height |
| `columns` | columns (EmailBlock[][]) |
| `product` | product_id, showPrice, showImage, showButton |

### Modelo de Dados (EmailBlock)

```typescript
interface EmailBlock {
  id: string;
  type: EmailBlockType;
  props: Record<string, any>;
}
```

### Conversão HTML

`blocksToHtml()` converte blocos → HTML table-based com inline styles (compatível com email clients). Não depende de CSS externo.

### Fluxo de Envio

1. Usuário monta email no builder (Step 2)
2. Step 3: `blocksToHtml()` gera HTML final
3. "Enviar" → salva template + campanha no banco
4. Invoca `email-campaign-broadcast` edge function
5. Redireciona para listagem com toast

### Drag-and-Drop

Usa `@dnd-kit/core` + `@dnd-kit/sortable`:
- Sidebar: blocos clicáveis para adicionar
- Canvas: blocos sortable para reordenar

---

## Automation Flow Builder (Visual)

### Arquitetura

Página dedicada em `/email-marketing/automation/new` (e `/:flowId` para edição) com canvas visual usando `@xyflow/react` (React Flow).

### Arquivos do Automation Builder

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/EmailMarketingAutomationBuilder.tsx` | Página do builder (rota) |
| `src/hooks/useAutomationBuilder.ts` | State machine (nodes, edges, save/load) |
| `src/components/email-marketing/automation-builder/AutomationFlowCanvas.tsx` | Canvas React Flow |
| `src/components/email-marketing/automation-builder/AutomationSidebar.tsx` | Sidebar com blocos arrastáveis |
| `src/components/email-marketing/automation-builder/AutomationNodeComponent.tsx` | Componente visual de cada nó |
| `src/components/email-marketing/automation-builder/AutomationNodePanel.tsx` | Painel de propriedades do nó selecionado |
| `src/components/email-marketing/automation-builder/AutomationTopBar.tsx` | Barra superior (nome, trigger, salvar) |

### Tipos de Nós (AutomationNodeType)

| Tipo | Categoria | Descrição |
|------|-----------|-----------|
| `trigger` | Gatilho | Ponto de entrada (list_subscription, tag_added, order_placed, cart_abandoned) |
| `send_email` | Ação | Enviar email (template_id, subject) |
| `delay` | Controle | Aguardar X minutos/horas/dias |
| `condition` | Condição | If/else (opened_email, clicked_link, has_tag, is_customer, order_count) |
| `add_tag` | Ação | Adicionar tag ao subscriber |
| `remove_tag` | Ação | Remover tag do subscriber |
| `move_to_list` | Ação | Mover subscriber para outra lista |
| `split_ab` | Condição | Split A/B com porcentagem configurável |
| `end` | Controle | Fim do fluxo |

### Tabelas do Banco (Automação)

| Tabela | Descrição |
|--------|-----------|
| `email_automation_flows` | Metadados do fluxo (nome, trigger_type, status) |
| `email_automation_nodes` | Nós do canvas (tipo, posição, config) |
| `email_automation_edges` | Conexões entre nós (source, target, handle) |
| `email_automation_enrollments` | Subscribers em execução no fluxo |
| `email_automation_logs` | Histórico de execução por nó |

### Modelo de Dados (FlowConfig)

```typescript
interface FlowConfig {
  name: string;
  description: string;
  trigger_type: string; // list_subscription | tag_added | order_placed | cart_abandoned
  trigger_config: Record<string, any>;
}
```

### Fluxo de Persistência

1. Usuário monta fluxo no canvas visual
2. Clica "Salvar" → `useAutomationBuilder.saveFlow()`:
   - Upsert em `email_automation_flows`
   - Delete + recreate nodes/edges (com novo mapeamento de IDs)
3. Ao carregar (`flowId`), reconstrói nodes/edges do banco

### Interface no Admin

- Aba "Automações" no dashboard de Email Marketing
- Botão "Nova Automação" → `/email-marketing/automation/new`
- Lista de automações existentes com status (draft, active, paused)

---

## Checklist

- [x] Listas CRUD funcional
- [x] **Tag obrigatória em listas**
- [x] **Sync automático de subscribers por tag**
- [x] **Auto-tag "Cliente" ao aprovar pedido**
- [x] Subscribers com status correto
- [x] Templates com variáveis
- [x] Broadcast enfileira corretamente
- [x] Dispatcher processa fila
- [x] Unsubscribe funciona
- [x] NewsletterForm block captura leads
- [x] NewsletterPopup block com triggers
- [x] QuizEmbed block integrado
- [x] sync_subscriber_to_customer_with_tag unificado
- [x] **Campaign Builder visual com wizard 3 steps**
- [x] **Editor drag-and-drop de blocos de email**
- [x] **Serialização blocos → HTML inline-style**
- [x] **Preview do email em tempo real**
- [x] **Automation Flow Builder visual com React Flow**
- [x] **Nós: trigger, send_email, delay, condition, add/remove_tag, move_to_list, split_ab, end**
- [x] **Tabelas de automação com RLS**
- [x] **Persistência de fluxos (save/load)**
