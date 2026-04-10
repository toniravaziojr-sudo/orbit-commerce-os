# Central de Comando — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-04-10  
> **Versão:** v2.0.0

> **Camada:** Layer 3 — Especificações / Sistema  
> **Migrado de:** `docs/regras/central-comando.md`  
> **Última atualização:** 2026-04-10


---

## Visão Geral

A Central de Comando (`/command-center`) é a página inicial do sistema administrativo. Funciona como hub operacional unificado com **5 abas**:

| Aba | Param | Componente | Descrição |
|-----|-------|-----------|-----------|
| **Dashboard** | `dashboard` | `DashboardTab` | Métricas analíticas, funil, faturamento, widgets de alerta |
| **Central de Execuções** | `executions` | `ExecutionsQueue` | Hub operacional "Zero Inbox" — somente pendências que exigem ação humana |
| **Insights** | `insights` | `InsightsTab` | Relatórios semanais de performance gerados por IA |
| **Assistente** | `assistant` | `EmbeddedCommandAssistant` | Auxiliar de Comando IA (doc separado: `auxiliar-comando.md`) |
| **Agenda** | `agenda` | `AgendaContent` | **Agente de IA** — Calendário + comunicação exclusiva via WhatsApp com o admin |

**Rota:** `/command-center` (redirect de `/` aponta aqui)  
**Tab control:** via query param `?tab=dashboard|executions|insights|assistant|agenda`  
**Permissão:** Sempre acessível (não requer permissão RBAC)

---

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/CommandCenter.tsx` | Página principal com Tabs |
| `src/hooks/useDashboardMetrics.ts` | Hook de métricas do dashboard |
| `src/components/command-center/agenda/` | Módulo completo da Agenda |
| `src/components/dashboard/` | Widgets do dashboard |
| `src/components/health/` | Cards de saúde do storefront |
| `src/components/billing/OrderLimitWarning.tsx` | Aviso de limite de pedidos |
| `src/components/billing/PaymentMethodBanner.tsx` | Banner de cartão de crédito |

---

## 1. Aba Overview — Dashboard

### Estrutura Visual (de cima para baixo)

1. **PaymentMethodBanner** — Banner de aviso para plano básico sem cartão
2. **DateRangeFilter** — Filtro de período padrão do sistema (ver `transversais/padroes-ui.md` § Padrão de Datas)
3. **OrderLimitWarning** — Barra de progresso de limite de pedidos do plano
4. **DashboardMetricsGrid** — 4 categorias de métricas empilhadas (§1.1)
5. **CommunicationsWidget** — Atendimentos, erros de notificação, emails não lidos
6. **AdsAlertsWidget** — Alertas do gestor de tráfego (saldo, ações pendentes, insights)
7. **FiscalAlertsWidget** — Alertas fiscais (NF-e em pedidos cancelados)
8. **Grid 3 colunas:**
   - **Pedidos Recentes** (2 cols) — Lista dos últimos 4 pedidos com status
   - **Coluna lateral** (1 col):
     - IntegrationAlerts (WhatsApp/Email)
     - StorefrontHealthCard (violações de URL, uptime)
     - Card "Atenção Agora" (itens demo estáticos)
9. **Ações Rápidas** — Grid de botões: Novo Produto, Novo Pedido, Novo Cliente, Processar Pedidos

### 1.1 Layout de Métricas (v8.8.0 — 4 Categorias)

**Componente:** `src/components/dashboard/DashboardMetricsGrid.tsx`

O grid é organizado em **4 categorias empilhadas verticalmente** (`space-y-4`), cada uma contendo cards horizontais (`flex gap-3`):

| Ordem | Título | Métricas | Fonte |
|-------|--------|----------|-------|
| **0 — Faturamento** | "Faturamento" | Faturamento Total, Faturamento Real, Retorno Real/ROAS, Taxa de Conversão | `orders`, `*_ad_insights`, `storefront_visits` |
| **1 — Funil** | "Funil de Conversão" | Visitas → Carrinho → Checkout → Pedidos | `storefront_visits`, `carts`, `checkout_sessions`, `orders` |
| **2 — Pedidos** | "Pedidos & Financeiro" | Pedidos Pagos, Não Pagos, Ticket Médio, Novos Clientes | `orders`, `customers` |
| **3 — Checkouts** | "Checkouts Abandonados" | Total abandonados, Recuperados, Com erros de contato | `checkout_sessions` |

#### Métricas de Faturamento

| Métrica | Cálculo | Formato |
|---------|---------|---------|
| **Faturamento Total** | `SUM(orders.total)` — todos os pedidos | `R$ X.XXX,XX` |
| **Faturamento Real** | `SUM(orders.total)` onde `payment_status = 'approved'` | `R$ X.XXX,XX` |
| **Retorno Real (ROAS)** | Faturamento Real ÷ Ad Spend Total | `X.XXx` (cor azul se ≥1x, vermelho se <1x) |
| **Taxa de Conversão** | `(pedidos pagos / visitantes únicos) × 100` | `X.XX%` |

#### Ad Spend — Fontes de Dados

| Plataforma | Tabela | Campo | Conversão |
|------------|--------|-------|-----------|
| Meta Ads | `meta_ad_insights` | `spend_cents` | ÷ 100 |
| Google Ads | `google_ad_insights` | `cost_micros` | ÷ 1.000.000 |
| TikTok Ads | `tiktok_ad_insights` | `spend_cents` | ÷ 100 |

### 1.2 Arquitetura de Dados do Dashboard

#### Fonte de Verdade e Deduplicação

| Métrica | Fonte de Verdade | Deduplicação |
|---------|-----------------|--------------|
| **Visitantes** | `storefront_visits` (tracking interno via cookie `_sf_vid`) | `COUNT(DISTINCT visitor_id)` via RPC `count_unique_visitors` — sem limite de 1000 rows |
| **Pedidos/Faturamento** | Tabela `orders` | `order.id` único |
| **Ad Spend** | `*_ad_insights` | Deduplicado por `tenant_id + campaign_id + date` via upsert |

#### Sincronização de Ad Insights

| Campo | Valor |
|-------|-------|
| **Edge Function** | `sync-ads-dashboard` |
| **Frequência** | A cada 15 minutos via `pg_cron` |
| **Fluxo** | Busca tenants com conexões ativas → Chama sync por plataforma → `Promise.allSettled` |

#### Visitantes (Tracking Interno)

| Regra | Descrição |
|-------|-----------|
| **Fonte** | Tabela `storefront_visits` (tracking próprio via fetch+keepalive no Edge HTML) |
| **Deduplicação** | Por `visitor_id` (cookie `_sf_vid`, 365 dias) |
| **Independência** | NÃO depende de GA4, Meta Pixel ou qualquer pixel externo |
| **Client-side** | `useVisitorTracking.ts` complementa para rotas SPA (checkout, carrinho) |
| **UI** | Não exibir rótulo de origem — apenas o número |
| **Proibição** | NUNCA usar `sendBeacon` para PostgREST (não suporta headers) — usar `fetch()` com `keepalive:true` |

#### RPC `count_unique_visitors`

`count_unique_visitors(p_tenant_id uuid, p_start timestamptz, p_end timestamptz) → integer`
- `SECURITY DEFINER`, `search_path = public`
- Conta `COUNT(DISTINCT visitor_id)` direto no banco (sem limite de 1000 rows)

#### Regra "Com erros de contato"

Checkout abandonado = "com erro" quando `customer_email` não contém `@` **E** `customer_phone` < 8 chars (ou nulo).

### Hook: `useDashboardMetrics`

```typescript
interface DashboardMetrics {
  salesToday: number;       // Soma de orders.total (approved) — em Reais
  salesYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  paidOrdersToday: number;
  paidOrdersYesterday: number;
  unpaidOrdersToday: number;
  unpaidOrdersYesterday: number;
  ticketToday: number;      // salesToday / paidOrders.length
  ticketYesterday: number;
  newCustomersToday: number;
  newCustomersYesterday: number;
  visitorsToday: number;    // storefront_visits (unique visitor_id)
  visitorsYesterday: number;
  cartsToday: number;
  cartsYesterday: number;
  checkoutsStartedToday: number;
  checkoutsStartedYesterday: number;
  abandonedCheckoutsToday: number;
  abandonedCheckoutsYesterday: number;
  recoveredCheckoutsToday: number;
  errorCheckoutsToday: number;
  totalRevenueToday: number;    // orders.total (todos, pagos+não pagos) — em Reais
  totalRevenueYesterday: number;
  adSpendToday: number;
  adSpendYesterday: number;
  conversionRateToday: number;  // (paidOrders / visitors) * 100
  conversionRateYesterday: number;
}
```

**Regras:**
- `orders.total` armazena em **Reais** (NÃO centavos). **NÃO dividir por 100.**
- `refetchInterval: 60000` (1 minuto)
- Período anterior calculado com mesma duração antes do período selecionado
- Trend label dinâmico: "vs. ontem" (1d), "vs. semana anterior" (≤7d), "vs. mês anterior" (≤31d)

### Hook: `useRecentOrders`

- Busca últimos N pedidos (padrão: 4)
- Join com `customers(full_name)`
- `refetchInterval: 30000` (30 segundos)
- Fallback de nome: "Cliente"
- Fallback de order_number: `#${id.slice(0,5).toUpperCase()}`

### Helpers exportados

| Função | Descrição |
|--------|-----------|
| `calculateTrend(current, previous)` | % de variação. Se previous=0 e current>0, retorna 100 |
| `formatCurrency(value)` | Formata em R$ via `Intl.NumberFormat('pt-BR')` |
| `formatRelativeTime(dateString)` | "Agora", "Há X min", "Há Xh", "Há Xd" |

---

## 2. Widgets do Dashboard

### 2.1 CommunicationsWidget

**Arquivo:** `src/components/dashboard/CommunicationsWidget.tsx`

Exibe contadores em tempo real de 3 canais:

| Métrica | Fonte | Realtime |
|---------|-------|----------|
| Atendimentos abertos | `useConversations().stats` (needsAttention + inProgress + botActive) | Via hook |
| Erros de notificação | `notifications` WHERE status='failed' | ✅ Canal Supabase |
| Emails não lidos | `email_messages` WHERE is_read=false | ✅ Canal Supabase |

**Links rápidos:** `/support`, `/notifications`, `/emails`  
**Refresh:** 30s polling + realtime

### 2.2 IntegrationAlerts

**Arquivo:** `src/components/dashboard/IntegrationAlerts.tsx`

Monitora saúde de integrações:

| Alerta | Condição | Variante | Ação |
|--------|----------|----------|------|
| WhatsApp desconectado | `configured && !connected` | warning | `/integrations?tab=others` |
| WhatsApp QR pendente | `connectionStatus === 'qr_pending'` | info | `/integrations?tab=others` |
| Email não configurado | `!from_email || !from_name` | info | `/integrations?tab=others` |
| Email não verificado | `!verified && configured` | warning | `/integrations?tab=others` |
| Email sistema (admin) | `isPlatformOperator && !systemEmail.verified` | platform | `/platform/integrations` |

**Dados WhatsApp:** Via RPC `get_whatsapp_config_for_tenant`  
**Dados Email:** Query direta em `email_provider_configs`  
**Admin:** Chama edge function `integration-config` para status do email do sistema

### 2.3 FiscalAlertsWidget

**Arquivo:** `src/components/dashboard/FiscalAlertsWidget.tsx`

- Usa `useFiscalAlerts()` hook
- Exibe quando há pedidos cancelados com NF-e autorizada
- Estilo `border-destructive/50 bg-destructive/5`
- CTA: "Ver Detalhes" → `/fiscal`
- Não renderiza se vazio ou loading

### 2.4 AdsAlertsWidget

**Arquivo:** `src/components/dashboard/AdsAlertsWidget.tsx`

Hooks utilizados:
- `useAdsInsights()` — Insights abertos
- `useAdsBalanceMonitor()` — Saldo de contas de anúncio
- `useAdsPendingActions()` — Ações pendentes de aprovação

| Alerta | Condição | Variante |
|--------|----------|----------|
| Contas sem saldo | `zeroBalanceCount > 0` | destructive |
| Saldo baixo | Por conta individual | warning |
| Ações pendentes | `pendingCount > 0` | warning |
| Insights não lidos | `openInsights.length > 0` | info |
| Tudo certo | Nenhum alerta | success |

**CTA:** "Ver tudo" → `/ads`

### 2.5 StorefrontHealthCard

**Arquivo:** `src/components/health/StorefrontHealthCard.tsx`

Hooks:
- `useViolationsStats()` — Violações de URL (hardcoded /store/, app domain links, preview em público)
- `useHealthCheckStats()` — Uptime do health monitor

**Exibição:**
- Badge de violações não resolvidas (24h)
- Badge de uptime % (alerta se < 95%)
- Breakdown por tipo de violação quando houver
- Link: `/health-monitor`

---

## 3. Aba Agenda — Agente de IA da Agenda

### 3.1 Identidade e Papel

A **Agenda** é o **quarto agente de IA** do sistema (junto com o Assistente IA/ChatGPT, o Auxiliar de Comando e o Gestor de Tráfego IA). Seu papel principal é:

- **Comunicar-se exclusivamente via WhatsApp** com o administrador da loja
- **Agendar tarefas e disparar lembretes** conforme solicitações do usuário
- **Delegar tarefas ao Auxiliar de Comando** e retornar os resultados ao usuário via WhatsApp
- **Organizar a agenda** do usuário conforme comandos em linguagem natural

> ⚠️ A Agenda **NÃO possui chat no sistema**. O "chat" dela é a conexão WhatsApp entre o número configurado e o WhatsApp do administrador.

### 3.2 Fluxo Principal: Agenda ↔ Auxiliar de Comando

```
Usuário (WhatsApp)
  │
  ▼
Agente Agenda (recebe mensagem via webhook WhatsApp)
  │
  ├─ Comando de lembrete → Cria/organiza tarefa internamente
  │
  └─ Comando de execução no sistema →
       │
       ▼
     Auxiliar de Comando (recebe solicitação da Agenda)
       │
       ▼
     Executa a tarefa (somente ações que o usuário poderia fazer manualmente)
       │
       ▼
     Retorna feedback para a Agenda
       │
       ▼
     Agente Agenda envia resultado via WhatsApp ao usuário
       │
       ▼
     Usuário confirma ou solicita ajuste (via WhatsApp)
```

**Regras do fluxo inter-agentes:**

| Regra | Descrição |
|-------|-----------|
| **Escopo do Auxiliar** | O Auxiliar de Comando só executa ações que o usuário conseguiria fazer manualmente na interface. Nunca altera configurações internas do sistema. |
| **Confirmação** | O usuário sempre recebe um resumo do que será feito e confirma via WhatsApp antes da execução |
| **Feedback** | Após execução, o resultado é sempre retornado ao usuário via WhatsApp |
| **Erro** | Se a execução falhar, o erro é traduzido em linguagem de negócio e enviado ao usuário |

### 3.3 Fluxo de Lembretes

```
Origem do lembrete:
  ├─ Via WhatsApp: Usuário envia comando → Agenda interpreta → cria tarefa + lembretes
  └─ Via UI: Usuário cria manualmente no calendário da aba Agenda

Disparo (cron a cada 5 minutos):
  1. Claim atômico: UPDATE agenda_reminders SET status = 'dispatched'
     WHERE status = 'pending' AND remind_at <= now() RETURNING *
     (PostgreSQL garante row-level lock — sem envio duplicado em execuções concorrentes)
  2. Edge function agenda-dispatch-reminders processa os lembretes retornados
  3. Tenta envio via meta-whatsapp-send para o número do administrador
     - Dentro da janela 24h: mensagem de texto livre
     - Fora da janela 24h: template aprovado pela Meta (obrigatório)
  4. Se envio OK: status permanece 'dispatched' (= "claimed e enviado com sucesso")
  5. Se envio falhar: UPDATE status = 'failed', last_error = motivo
  6. Lembretes de tarefas já completed/cancelled: marcados como 'skipped' (nunca enviados)
```

**Semântica de `dispatched`:** significa "claimed para envio e tentativa realizada". Não significa "entregue ao destinatário" (o sistema não rastreia entrega final da Meta).

**Idempotência:** o claim atômico via `UPDATE ... WHERE status = 'pending' RETURNING *` garante que duas execuções concorrentes do cron nunca processam o mesmo lembrete.

**Tipos de agendamento suportados:**

| Comando do Usuário (exemplo) | Interpretação |
|------------------------------|---------------|
| "Me lembre dia 15 às 10h" | Cria tarefa em 15/mês às 10:00 |
| "Avise 2 horas antes" | reminder_offset = 120 minutos |
| "Todo dia às 9h" | Tarefa recorrente diária |
| "Semana que vem, segunda" | Calcula data da próxima segunda |

### 3.4 Conexão WhatsApp do Administrador

O único setup necessário é o administrador **conectar o número de WhatsApp** pelo qual deseja se comunicar com a IA da Agenda.

| Aspecto | Detalhe |
|---------|---------|
| **Onde configura** | Aba Agenda → Configuração de número (ou Integrações → WhatsApp) |
| **O que armazena** | Número do administrador vinculado ao tenant |
| **Direção** | A IA envia mensagens para esse número E recebe mensagens desse número |
| **Webhook** | Mensagens recebidas do administrador são roteadas para o agente Agenda |
| **Separação** | Este número é o canal de comunicação **exclusivo** entre o admin e a IA da Agenda. Não se confunde com o número WABA usado para atendimento ao cliente. |

### 3.5 Arquitetura Técnica (Visão Geral)

**Decisão arquitetural:** NÃO será criado webhook separado para a Agenda. O roteamento acontece dentro do `meta-whatsapp-webhook` existente.

```
WhatsApp Cloud API (Meta)
  │
  ├─ Webhook de entrada (TODAS as mensagens WhatsApp)
  │    └─ Edge Function: meta-whatsapp-webhook (EXISTENTE)
  │         ├─ Identifica tenant pelo phone_number_id (já faz)
  │         ├─ Salva em whatsapp_inbound_messages (já faz)
  │         ├─ Verifica: from_phone está em agenda_authorized_phones do tenant?
  │         │    ├─ SIM → Roteia para agente Agenda (agenda-process-command)
  │         │    │    ├─ Deduplicar por (tenant_id, external_message_id) em agenda_command_log
  │         │    │    ├─ Gravar em agenda_command_log (status: received)
  │         │    │    ├─ IA interpreta comando (Gemini 2.5 Flash)
  │         │    │    ├─ Leitura/lembrete → executa direto
  │         │    │    ├─ Ação sensível → pede confirmação (payload congelado)
  │         │    │    └─ Ação no sistema → delega ao Auxiliar (com confirmação, via allowlist)
  │         │    └─ NÃO cria conversa de suporte
  │         └─ NÃO → Fluxo normal de suporte/conversas (como hoje)
  │
  └─ Envio de saída (mensagens da IA para o admin)
       └─ Edge Function: meta-whatsapp-send
            └─ Usa template aprovado (fora da janela 24h) ou mensagem livre (dentro da janela)
```

**Decisão de roteamento:** mensagens de números autorizados da Agenda SEMPRE vão para o agente Agenda, nunca para o fluxo de suporte. Se o admin quiser falar com suporte, usa outro canal. Esta é uma decisão consciente e documentada.

**Política temporal oficial:**
- Timezone: `America/Sao_Paulo` (hardcoded, documentado)
- Todas as datas/horas são interpretadas, persistidas e disparadas neste timezone
- Parsing: "amanhã" = dia seguinte em SP, "9h" = 09:00 BRT
- Ambiguidade: a IA confirma quando não consegue interpretar com certeza
- Armazenamento: `due_at` e `remind_at` em UTC, interpretação e exibição em BRT

**Edge Functions envolvidas:**

| Edge Function | Papel | Status |
|--------------|-------|--------|
| `meta-whatsapp-webhook` | Webhook existente — recebe inbound e roteia (suporte OU agenda) | ✅ Existente (requer modificação para roteamento) |
| `agenda-process-command` | Motor IA da Agenda: interpreta, executa, responde | 🔴 A criar |
| `agenda-dispatch-reminders` | Cron (5min): dispara lembretes pendentes | ✅ Existente (requer cron) |
| `meta-whatsapp-send` | Envia mensagens WhatsApp via Cloud API | ✅ Existente |
| `command-assistant` | Pipeline do Auxiliar de Comando (chamado pela Agenda quando necessário) | ✅ Existente |

### 3.6 Calendário Visual (UI)

A aba Agenda no sistema exibe um **calendário visual** para que o usuário também possa consultar e gerenciar tarefas pela interface (além do WhatsApp).

#### Estrutura

```
AgendaContent
  └─ AgendaCalendarView
       ├─ Stats (4 StatCards: pendentes, hoje, concluídas, lembretes pendentes)
       ├─ Alerta WhatsApp (se desconectado)
       ├─ AgendaCalendar (calendário mensal visual)
       ├─ DayTasksDialog (dialog de tarefas do dia)
       └─ CreateTaskDialog (criação de tarefa)
```

### 3.7 Tabelas do Banco

#### agenda_tasks (existente)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `created_by` | UUID | Usuário criador |
| `title` | TEXT | Título da tarefa |
| `description` | TEXT | Descrição (opcional) |
| `due_at` | TIMESTAMPTZ | Data/hora de vencimento |
| `status` | TEXT | `pending`, `completed`, `cancelled` |
| `is_recurring` | BOOLEAN | Se é recorrente |
| `recurrence` | JSONB | Config de recorrência |
| `reminder_offsets` | JSONB | Array de minutos antes do due_at |
| `created_at` | TIMESTAMPTZ | Data de criação |
| `updated_at` | TIMESTAMPTZ | Data de atualização |

#### agenda_reminders (existente — status renomeado)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `task_id` | UUID | FK agenda_tasks |
| `channel` | TEXT | Sempre `whatsapp` |
| `remind_at` | TIMESTAMPTZ | Quando enviar o lembrete |
| `status` | TEXT | `pending`, `dispatched`, `failed`, `skipped` |
| `sent_at` | TIMESTAMPTZ | Quando foi despachado |
| `last_error` | TEXT | Último erro (se falhou) |

> **Nota:** status `sent` foi renomeado para `dispatched`. Migração necessária para registros existentes.

#### agenda_authorized_phones (a criar)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `phone` | TEXT | Formato `55XXXXXXXXXXX` |
| `is_active` | BOOLEAN | Se está autorizado |
| `label` | TEXT | Identificação (ex: "João - Owner") |
| `configured_by` | UUID | Quem cadastrou |
| `created_at` | TIMESTAMPTZ | |

RLS: owner/manager do tenant. Índice único: `(tenant_id, phone)`.

#### agenda_command_log (a criar)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `direction` | TEXT | `inbound` / `outbound` |
| `external_message_id` | TEXT | ID da mensagem WhatsApp |
| `from_phone` | TEXT | Origem |
| `content` | TEXT | Conteúdo da mensagem |
| `intent` | TEXT | Intenção interpretada |
| `action_taken` | TEXT | Ação executada |
| `pending_action` | JSONB | Payload congelado quando `awaiting_confirmation` |
| `status` | TEXT | `received`, `interpreted`, `awaiting_confirmation`, `executed`, `rejected`, `expired`, `failed` |
| `error_message` | TEXT | Erro, se houver |
| `correlation_id` | UUID | Rastreio entre Agenda ↔ Auxiliar |
| `created_at` | TIMESTAMPTZ | |

Índice único: `(tenant_id, external_message_id)` para idempotência/deduplicação.

**Propósito:** auditoria operacional — "o que aconteceu, quando, resultado".

#### agenda_chat_history (a criar)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `role` | TEXT | `user` / `assistant` / `system` |
| `content` | TEXT | Conteúdo |
| `intent` | TEXT | Intenção interpretada |
| `action_result` | JSONB | Resultado da ação |
| `correlation_id` | UUID | Rastreio |
| `created_at` | TIMESTAMPTZ | |

**Propósito:** contexto conversacional para a IA (últimas N mensagens para continuidade). NÃO é auditoria — para isso usar `agenda_command_log`.

> **Separação explícita:** `agenda_command_log` = auditoria operacional (fonte de verdade para "o que aconteceu"). `agenda_chat_history` = memória de curto prazo da IA (alimenta contexto de conversa). Não são redundantes — cada um tem papel distinto.

#### Máquina de estados formal

```
agenda_tasks:    pending → completed | cancelled
agenda_reminders: pending → dispatched | failed | skipped  (estados finais)
agenda_commands:  received → interpreted → [awaiting_confirmation] → executed | rejected | expired | failed
```

#### Regra de confirmação ("Sim")

- "Sim" associa-se ao **último** comando com status `awaiting_confirmation` do mesmo tenant + phone dentro da janela de 5 minutos
- Se houver mais de um comando pendente simultaneamente: o sistema lista os pendentes e pede ao admin que especifique qual confirmar
- Confirmação executa o `pending_action` congelado — **nunca** reinterpreta a conversa
- Após 5 minutos sem confirmação: status → `expired`

#### Regra de desambiguação de alvo

Se a IA identificar mais de uma correspondência para o alvo de uma ação (ex: "concluir tarefa reunião" e existem 2 tarefas com "reunião"):
- **Não executa**
- Lista as opções encontradas
- Pede ao admin que especifique

Isso vale para **todas** as ações, incluindo consultas sem confirmação (ex: "status do pedido X" com múltiplas correspondências).

#### Allowlist de ações delegáveis ao Auxiliar

A Agenda só pode delegar ao Auxiliar de Comando ações da allowlist inicial:

| Ação | Confirmação |
|------|-------------|
| Consultar status de pedido | Não (mas obedece desambiguação) |
| Alterar preço de produto | Sim |
| Publicar/despublicar produto | Sim |
| Criar cupom de desconto | Sim |
| Pausar/retomar campanha | Sim |

Expansão da allowlist exige atualização documental e confirmação do usuário.

### 3.8 Tipos TypeScript

```typescript
type TaskStatus = 'pending' | 'completed' | 'cancelled';
type RecurrenceType = 'daily' | 'weekly' | 'monthly';

interface RecurrenceConfig {
  type: RecurrenceType;
  interval: number;        // a cada X dias/semanas/meses
  byweekday?: number[];    // 0=Dom, 1=Seg, etc.
  bymonthday?: number;     // dia do mês
}

interface CreateTaskInput {
  title: string;
  description?: string;
  due_at: string;          // ISO string
  is_recurring?: boolean;
  recurrence?: RecurrenceConfig;
  reminder_offsets?: number[];  // em minutos: 1440=1dia, 120=2h, 15=15min
}
```

### 3.9 Hook: `useAgendaTasks`

| Operação | Método | Descrição |
|----------|--------|-----------|
| `tasks` | Query | Todas as tarefas do tenant |
| `reminders` | Query | Todos os lembretes do tenant |
| `createTask` | Mutation | Cria tarefa + insere lembretes calculados |
| `updateTask` | Mutation | Atualiza tarefa (status, dados) |
| `deleteTask` | Mutation | Exclui tarefa e lembretes associados |
| `getTaskReminders` | Helper | Filtra lembretes por task_id |

### 3.10 Calendário Visual — Detalhes

**Componente:** `AgendaCalendar`

- Grid 7 colunas (Dom-Sáb) com dias do mês
- **Cores por status:**
  - Overdue (pendente + vencido): `bg-destructive/10 border-destructive/50`
  - Pendente: `bg-warning/10 border-warning/50`
  - Concluído: `bg-success/10 border-success/50`
  - Cancelado: `bg-muted/50 border-muted-foreground/30`
  - Vazio: `bg-background border-border`
- **Hoje:** `ring-2 ring-primary ring-offset-2`
- **Feriados:** `ring-2 ring-destructive/50` + emoji tooltip (via `getHolidayForDate`)
- Indicadores de badges: pendentes (Clock), concluídos (CheckCircle), lembretes (Bell)
- Mostra até 2 títulos de tarefas por dia, "+N mais" se exceder
- Click em dia com tarefas → abre `DayTasksDialog`
- Click em dia vazio → abre `CreateTaskDialog`
- Stats no header: pendentes e concluídas do mês

### 3.11 Dialog de Tarefas do Dia (`DayTasksDialog`)

- Lista todas as tarefas do dia selecionado
- Para cada tarefa: título, descrição, horário, status badge, indicador de recorrência
- Ações por tarefa via dropdown: Concluir, Cancelar, Excluir
- Seção de lembretes por tarefa: status (pendente/enviado/falhou), horário
- Botão "Adicionar Lembrete" no final

### 3.12 Dialog de Criação (`CreateTaskDialog`)

Campos:
- **Título** (obrigatório)
- **Descrição** (opcional)
- **Data** (obrigatório, calendar picker, não permite datas passadas)
- **Horário** (padrão: 09:00)
- **Recorrência** (toggle): tipo (diário/semanal/mensal) + intervalo
- **Notificações WhatsApp**: lista editável de offsets
  - Padrão: 1 lembrete de 1 dia antes
  - Unidades: minutos, horas, dias
  - Preview: "Você será notificado em: DD/MM/YYYY às HH:mm"

### 3.13 Pendências Técnicas e Etapas de Implementação

#### Etapa 1 — Contrato Operacional + Infraestrutura ✅

| Item | Status | Descrição |
|------|--------|-----------|
| Tabela `agenda_authorized_phones` | ✅ Feito | Tabela própria de números autorizados com RLS |
| Tabela `agenda_command_log` | ✅ Feito | Log operacional com deduplicação e payload de confirmação |
| Tabela `agenda_chat_history` | ✅ Feito | Contexto conversacional para a IA |
| Migração `sent` → `dispatched` | ✅ Feito | Renomeado status em `agenda_reminders` |
| Cron `agenda-dispatch-reminders` | ✅ Feito | pg_cron + pg_net configurados (5min) |
| Limpeza de estados órfãos | ✅ Feito | Lembretes `pending` em tarefas `completed/cancelled` → `skipped` |
| UI de configuração de número do admin | ✅ Feito | Seção na aba Agenda para gerenciar números autorizados |

#### Etapa 2 — Canal WhatsApp + Motor IA ✅

| Item | Status | Descrição |
|------|--------|-----------|
| Roteamento no `meta-whatsapp-webhook` | ✅ Feito | Ponto de decisão: admin → Agenda, outros → suporte |
| Edge function `agenda-process-command` | ✅ Feito | Motor IA (Gemini 2.5 Flash) com interpretação, confirmação e execução |
| Templates WhatsApp para lembretes | 🔴 A criar | Templates aprovados pela Meta para lembretes proativos (fora da janela 24h) |

> **Bloqueador:** sem template aprovado pela Meta, lembretes proativos fora da janela de 24h não serão entregues.

#### Etapa 3 — Integração Agenda ↔ Auxiliar ✅

| Item | Status | Descrição |
|------|--------|-----------|
| Contrato inter-agentes | ✅ Feito | Delegation via `command-assistant-execute` com `_internal_user_id`, timeout 30s, `correlation_id` |
| Allowlist de ações | ✅ Feito | `order_status`, `update_price`, `publish_product`, `create_discount` |

#### Etapa 4 — Recorrência + Diagnóstico ✅

| Item | Status | Descrição |
|------|--------|-----------|
| Recorrência blindada | ✅ Feito | `calculateNextDueAt` com safety loop (garante próxima data sempre no futuro) + `bymonthday` |
| Template fallback (24h) | ✅ Feito | Detecção de janela 24h + fallback para template `agenda_lembrete` |
| Painel de diagnóstico | ✅ Feito | Visualização do `agenda_command_log` na aba Agenda com filtros |

#### ~~`agenda-whatsapp-webhook`~~ — CANCELADO

> **Decisão definitiva:** NÃO será criado webhook separado para a Agenda. O roteamento acontece dentro do `meta-whatsapp-webhook` existente. Esta decisão está documentada em §3.5.

### 3.14 Cenários de Aceitação Obrigatórios

| # | Cenário | Resultado esperado |
|---|---------|-------------------|
| 1 | Inbound duplicado (mesmo `external_message_id`) | Não processa 2x |
| 2 | Admin autorizado envia mensagem | Roteia para Agenda |
| 3 | Número não autorizado envia mensagem | Fluxo normal de suporte |
| 4 | Confirmação após expiração (5min) | Não executa, informa expirado |
| 5 | Lembrete fora da janela 24h | Usa template WhatsApp |
| 6 | Sem template aprovado | Marca como `failed` com motivo |
| 7 | Alvo ambíguo (múltiplas correspondências) | Pede refinamento |
| 8 | Cancelamento em massa | Exige confirmação |
| 9 | Dispatch de tarefa já concluída | Reminder marcado como `skipped` |
| 10 | Cron concorrente (2 execuções simultâneas) | Sem envio duplicado (claim atômico) |

---

## 4. Componentes Compartilhados de Chat

**Diretório:** `src/components/chat/`

Componentes visuais usados por **3 chats** do sistema (Auxiliar de Comando, ChatGPT, IA de Tráfego):

| Componente | Exportação | Propósito |
|------------|-----------|-----------|
| `ChatMessageBubble` | Named | Bolhas de mensagem (user/assistant/tool) |
| `ChatTypingIndicator` | Named | Animação de "pensando" |
| `ChatEmptyState` | Named | Estado vazio com sugestões opcionais |
| `ChatConversationList` | Named | Lista lateral de conversas |

**Tipo exportado:** `ChatAttachment`

> ⚠️ **REGRA**: Ao criar novos chats no sistema, SEMPRE utilizar estes componentes para manter consistência visual. Detalhes de estilo e props estão documentados em `auxiliar-comando.md` (seção "Componentes Compartilhados de Chat").

---

## 5. Componentes de Billing no Dashboard

### OrderLimitWarning

- Usa `useOrderLimitCheck()` e `useTenantSubscription()`
- Mostra barra de progresso quando uso ≥ 80% do limite
- Variante destructive quando `is_over_limit`
- CTA: "Fazer Upgrade" → `/settings/billing`
- Não mostra para planos sem limite (`!order_limit`)

### PaymentMethodBanner

- Usa `useSubscriptionStatus()`
- Exibe apenas se `needsPaymentMethod && isBasicPlan`
- Estilo amber (aviso não-destrutivo)
- CTA: "Cadastrar agora" → `/settings/add-payment-method`

---

## Regras de Implementação

1. **Valores monetários em Reais** — `orders.total` armazena em Reais, NÃO centavos. Não dividir por 100.
2. **Realtime** — CommunicationsWidget usa canais Supabase para notifications e email_messages
3. **Polling** — Métricas refresh a cada 60s, pedidos recentes a cada 30s
4. **Permissões** — A Central de Comando é acessível a todos os usuários autenticados
5. **"Atenção Agora"** — Atualmente usa dados demo estáticos — migrar para dados reais é pendência futura
6. **Ações Rápidas** — Botões sem onClick implementado (pendência futura)
7. **Feriados** — Usa `src/lib/brazilian-holidays.ts` para feriados nacionais BR
8. **WhatsApp Agenda** — A Agenda é um **agente de IA** que se comunica exclusivamente via WhatsApp com o admin. Não possui chat no sistema. Depende de número WhatsApp do admin conectado e pode delegar tarefas ao Auxiliar de Comando.
9. **Calendário Agenda** — Usa `MonthlyCalendar` (componente unificado — ver `transversais/padroes-ui.md` § MonthlyCalendar)
