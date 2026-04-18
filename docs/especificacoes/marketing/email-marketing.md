# Email Marketing — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-04-17 (unificação de builders + atribuição centralizada)

> **Camada:** Layer 3 — Especificações / Marketing  
> **Migrado de:** `docs/regras/email-marketing.md`


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
| `src/pages/EmailMarketingListDetail.tsx` | Página de detalhes da lista + subscribers (rota `/email-marketing/list/:listId`) |
| `src/components/builder/theme-settings/PopupSettings.tsx` | Config popup newsletter (tema) |
| `supabase/functions/email-campaign-broadcast/` | Disparo em massa |
| `supabase/functions/email-dispatcher/` | Worker de processamento |
| `supabase/functions/marketing-form-submit/` | Captura de leads |
| `supabase/functions/email-unsubscribe/` | Descadastramento |
| `supabase/functions/email-marketing-list-sync/` | Sincronização periódica de listas baseadas em tags |

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
5. **A cada hora**, o `scheduler-tick` aciona `email-marketing-list-sync` que executa `sync_list_subscribers_from_tag` para todas as listas com tag vinculada, garantindo paridade entre o módulo de clientes e as listas de email marketing

---

## Listas Padrão do Sistema

Todo tenant recebe automaticamente 3 listas padrão ao ser criado (via trigger `AFTER INSERT ON tenants` + função idempotente `ensure_default_email_marketing_lists`). **Listas adicionais são criadas sob demanda** quando um formulário de captura é usado pela primeira vez.

### Listas criadas no provisionamento do tenant

| # | Tag (singular) | Cor | Lista (plural) | Descrição |
|---|----------------|-----|-----------------|-----------|
| 1 | Cliente | Verde `#10B981` | Clientes | Clientes com pedido aprovado |
| 2 | Newsletter PopUp | Ciano `#06b6d4` | Newsletter PopUp | (Legado) — substituída por "Leads Popup" |
| 3 | Cliente Potencial | Laranja `#f97316` | Clientes Potenciais | Clientes que abandonaram o checkout |

### Listas criadas automaticamente pelo `marketing-form-submit`

A função `marketing-form-submit` é o **único ponto de entrada** para captura de leads na loja pública. Ao receber a primeira submissão de cada origem, ela cria idempotentemente a lista correspondente (via índice único `(tenant_id, name) WHERE is_system=true`) e a tag obrigatória:

| Origem (`source`) | Lista criada | Tag | Cor |
|-------------------|--------------|-----|-----|
| `popup` | Leads Popup | Leads Popup | `#8B5CF6` |
| `footer_newsletter` | Leads Newsletter Rodapé | Leads Newsletter Rodapé | `#0EA5E9` |
| `support_chat` | Leads site | Leads site | `#6366F1` |
| `block:<slug>` ou `newsletter_form` (com `page_slug`) | Leads Formulário - `<Slug>` | mesma | `#F59E0B` |
| `newsletter_form` (sem page) | Leads Formulário | Leads Formulário | `#F59E0B` |

### Regras gerais

- **Idempotente:** mesma origem nunca duplica lista; condição de corrida tratada via re-fetch.
- **`is_system = true`:** todas as listas auto-criadas são marcadas como sistema.
- **Sem coluna `slug`:** identificação interna usa `name + is_system`. Nunca usar `eq('slug', ...)` em `email_marketing_lists` (a coluna não existe).
- **Preenchimento contínuo:**
  - **Clientes** → trigger `trg_recalc_customer_on_order` ao aprovar pedido.
  - **Clientes Potenciais** → `scheduler-tick` (abandon-sweep).
  - **Leads Popup / Leads Newsletter Rodapé / Leads Formulário** → `marketing-form-submit` (loja pública).
  - **Leads site** → `marketing-form-submit` chamado pelo chat de suporte com IA.

---

## Captura de Leads na Loja Pública (Pipeline Unificada)

### Princípio

Todo formulário de captura na loja pública (HTML servido pelo Edge `storefront-html`) submete via **handler universal JS** que chama `marketing-form-submit`. **É proibido** usar `setTimeout` mockado, `fetch` para endpoints inexistentes ou `onsubmit="event.preventDefault()"` sem handler real.

### Contrato HTML obrigatório

Qualquer compilador de bloco que renderize um formulário de captura **deve** emitir:

```html
<form data-sf-newsletter
      data-tenant-id="<tenant>"
      data-list-id="<list_id ou vazio>"
      data-source="popup | footer_newsletter | block:<slug> | newsletter_form"
      data-block-id="<id opcional>">
  <input type="email" name="email" required>
  <button type="submit">Inscrever</button>
</form>
```

O handler universal injetado em `storefront-html` (`document.addEventListener('submit', ...)`) intercepta qualquer `form[data-sf-newsletter]`, monta o payload e chama `POST /functions/v1/marketing-form-submit`. Mensagens de sucesso/erro são renderizadas inline.

### Caso especial: popup

O popup de newsletter é renderizado por `generateNewsletterPopupHtml()` no `storefront-html` e usa um handler dedicado, mas chama o **mesmo endpoint** `marketing-form-submit` com `source: "popup"`.

### Componentes envolvidos

| Camada | Arquivo | Papel |
|--------|---------|-------|
| Edge HTML | `supabase/functions/storefront-html/index.ts` | Renderiza loja + injeta handler universal + popup |
| Compilador rodapé | `supabase/functions/_shared/block-compiler/blocks/footer.ts` | Emite `<form data-sf-newsletter data-source="footer_newsletter">` |
| Compilador bloco | `supabase/functions/_shared/block-compiler/blocks/newsletter.ts` | Emite `<form data-sf-newsletter data-source="block:..." \| newsletter_form>` |
| Edge captura | `supabase/functions/marketing-form-submit/index.ts` | Único ponto: cria lista, persiste subscriber, dispara automações |
| RPC banco | `upsert_subscriber_only` | Persiste lead sem promovê-lo a cliente (Lead ≠ Cliente) |
| React preview | `src/components/builder/blocks/interactive/NewsletterBlock.tsx` | Pré-visualização no Builder também chama `marketing-form-submit` |

### Anti-regressão

- ✅ Endpoint sempre existe: `marketing-form-submit` (nunca chamar `newsletter-subscribe` — não existe).
- ✅ Filtro de lista no banco usa `name + is_system`, **nunca** `slug`.
- ✅ Toda Edge Function de captura loga erro explícito — proibido falhar em silêncio.
- ✅ Cada origem tem sua lista dedicada — segmentação automática por canal.
- ✅ **Anti-stale automático (v8.8.0+):** o `storefront-html` compara `metadata.storefront_html_version` do snapshot com sua própria `VERSION` e ignora snapshots de versão antiga, fazendo live render. Sempre que o contrato HTML do formulário (atributos, handler, payload) mudar, **bumpar a `VERSION`** do `storefront-html` é obrigatório — é isso que invalida automaticamente todo o cache de prerender e impede o sintoma "formulário não envia em produção" causado por HTML pré-renderizado antes da correção.

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

### email_marketing_list_members
Tabela de junção lista↔subscriber — **fonte de verdade para exibição de membros na tela de detalhe**.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `list_id` | UUID | FK email_marketing_lists |
| `subscriber_id` | UUID | FK email_marketing_subscribers |
| `created_at` | TIMESTAMPTZ | Data de inclusão na lista |

**Constraints:** `UNIQUE(list_id, subscriber_id)` — evita duplicatas.

**Regra:** A contagem e listagem de membros de uma lista DEVEM consultar esta tabela, nunca filtrar diretamente na tabela de subscribers por campo `source` ou outro atributo.

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

### Automation (Wizard Unificado)

Desde 2026-04-17, automações e envios únicos compartilham o mesmo wizard em `/email-marketing/campaign/new`. Não existem mais rotas separadas para builder visual nem aba "Automações" na UI.

**Passo 1 — Configuração:**
- Tipo: `Envio Único` (broadcast) ou `Automação` (sequência por trigger)
- Quando seleciona Automação, aparece dropdown **Estilo do builder**:
  - `Linear (simples)` — editor sequencial passo-a-passo (padrão)
  - `Visual (fluxograma)` — canvas ReactFlow com nós e arestas

**Passo 2 — Conteúdo:**
- Renderiza o builder escolhido (linear ou visual) embarcado no wizard
- O fluxo visual é salvo via `useAutomationBuilder.saveFlow(status, { skipNavigate: true })` e vinculado à campanha por `content.automationFlowId`

**Passo 3 — Revisão e envio.**

```
1. Trigger ocorre (subscriber novo, abandono, tag aplicada, etc.)
   ↓
2. Sistema busca automações ativas com trigger correspondente
   ↓
3. Executa steps (linear) ou percorre o grafo (visual) agendando emails na fila com delay
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

**Comportamento do botão de envio:**
- Botão usa `type="submit"` explícito para garantir envio dentro do Dialog Radix
- `e.stopPropagation()` no `handleSubmit` impede que o Dialog intercepte o evento de clique
- Proteção contra cliques duplos (desabilitado durante `isLoading`)
- Ao clicar, chama `marketing-form-submit` passando `tenant_id`, `list_id`, `email` e campos opcionais
- Mensagem de sucesso exibida por 2 segundos antes do popup fechar automaticamente
- Se `onInteractOutside` é acionado, o Dialog fecha normalmente sem interferir no submit

**Arquivos envolvidos:**
| Componente | Arquivo |
|------------|---------|
| Bloco visual | `src/components/builder/blocks/interactive/NewsletterPopupBlock.tsx` |
| Loader storefront | `src/components/storefront/NewsletterPopupLoader.tsx` |
| Edge Function | `supabase/functions/marketing-form-submit/index.ts` |

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

> **Atualização 2026-04-17:** As abas **Atribuição** e **Automações** foram removidas. Atribuição de vendas por e-mail é agora um canal do módulo central `/marketing/atribuicao` (alimentado pelo trigger `trg_propagate_email_conversion_to_attribution`). Automações vivem dentro do wizard único de campanhas.

1. **Campanhas** - Listagem unificada (broadcast + automação) com 6 métricas inline por linha:
   `Enviados · Entregues · Abertura% · Clique% · Conversões · Receita`
   Botão "Nova Campanha" abre o wizard `/email-marketing/campaign/new`.
2. **Listas** - CRUD de listas segmentadas
   - Contagem de leads exibida acima do nome da lista
   - Clique abre página dedicada (`EmailMarketingListDetail.tsx`)
   - Badge com cor da tag vinculada
3. **Membros / Assinantes** - Visualização/busca de subscribers com filtro
4. **Templates** - Editor de templates com preview
5. **Formulários** - Captura de leads (newsletter, quiz, etc.)

### Atribuição de Vendas (Canal E-mail)

- Toda nova conversão registrada em `email_conversions` é propagada automaticamente para `order_attribution` com `attribution_source = 'email'` via trigger `trg_propagate_email_conversion_to_attribution`.
- Escopo: **só novas conversões** (sem back-fill histórico).
- Visualização e relatórios ficam exclusivamente no módulo `/marketing/atribuicao`.

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
Quando `payment_status` de um pedido muda para `approved`:
- Adiciona tag "Cliente" (verde #10B981) via `ON CONFLICT DO NOTHING`
- **NÃO remove** outras tags existentes (preserva tags de popup, leads, etc.)
- Se a tag não existir, cria automaticamente

### trg_sync_subscriber_on_tag
Quando um cliente recebe uma tag:
- Para cada lista vinculada à tag, insere/atualiza subscriber (dedup por email)
- **Também insere na `email_marketing_list_members`** (dedup por list_id + subscriber_id)

### trg_auto_sync_list_subscribers
Quando uma lista é criada:
- Sincroniza automaticamente todos os customers que já têm a tag
- **Também insere na `email_marketing_list_members`** para cada subscriber

### Deduplicação
- **Regra fixa:** deduplicação de subscribers é feita EXCLUSIVAMENTE por `(tenant_id, email)`
- Se o email já existe no tenant, apenas atualiza dados (nome, telefone, customer_id)
- `email_marketing_list_members` tem constraint `UNIQUE(list_id, subscriber_id)` para evitar duplicatas na lista

### marketing-form-submit (Edge Function)
- Chama `upsert_subscriber_only` com `p_list_id` — NÃO cria customer (apenas subscriber)
- Se já existir customer com mesmo email, vincula automaticamente
- Deduplicação por email garantida em todos os caminhos (popup, footer, chat, formulários)
- **Alterado em 01/04/2026:** substituído `sync_subscriber_to_customer_with_tag` por `upsert_subscriber_only` para respeitar contrato Lead ≠ Customer. Função legada removida do banco em 01/04/2026.

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

- Aba "Automações" no dashboard de Email Marketing (`EmailMarketing.tsx`)
- Listagem de automações existentes consultando `email_automation_flows` com contagem de nós (`email_automation_nodes(count)`)
- Cada card exibe: nome, tipo de trigger (label de negócio), quantidade de blocos e badge de status (Rascunho/Ativa/Pausada)
- Clique no card navega para o builder visual (`/email-marketing/automation/:flowId`)
- Botão "Nova Automação" → `/email-marketing/automation/new`
- Empty state exibido quando não há fluxos salvos
- Query centralizada no hook `useEmailMarketing` (`automationFlows`), ordenada por `updated_at DESC`

---

## Auditoria de Sincronização (email_marketing_sync_audit)

Toda tentativa de projetar um customer para o módulo de email marketing é auditada:

| Campo | Descrição |
|-------|-----------|
| `tenant_id` | Tenant |
| `customer_id` | Customer envolvido (pode ser NULL) |
| `source` | Origem: `order_approved`, `manual_create`, `import`, `reconciliation` |
| `status` | `synced`, `skipped`, `failed` |
| `reason` | Ex: `missing_email` |
| `metadata` | Dados contextuais (order_id, etc.) |

**Regra:** Quando um pedido é aprovado para um customer sem email válido, o trigger `trg_recalc_customer_on_order` registra `status=skipped, reason=missing_email` via `log_marketing_sync_audit()`. O customer permanece válido — apenas a sincronização com marketing é pulada de forma observável.

**Função auxiliar:** `log_marketing_sync_audit(p_tenant_id, p_customer_id, p_source, p_status, p_reason, p_metadata)`

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
- [x] NewsletterPopup block com triggers (mobile: layout simples sem imagem; desktop: side-image)
- [x] QuizEmbed block integrado
- [x] upsert_subscriber_only para captura de leads (substitui sync_subscriber_to_customer_with_tag em formulários)
- [x] **Campaign Builder visual com wizard 3 steps**
- [x] **Editor drag-and-drop de blocos de email**
- [x] **Serialização blocos → HTML inline-style**
- [x] **Preview do email em tempo real**
- [x] **Automation Flow Builder visual com React Flow**
- [x] **Nós: trigger, send_email, delay, condition, add/remove_tag, move_to_list, split_ab, end**
- [x] **Tabelas de automação com RLS**
- [x] **Persistência de fluxos (save/load)**
- [x] **Listagem de automações na aba com contagem de nós e status**
