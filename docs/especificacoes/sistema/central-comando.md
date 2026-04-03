# Central de Comando — Regras e Especificações

> **Status:** ✅ Ready  
> **Última atualização:** 2026-03-29  
> **Versão:** v1.0.0

> **Camada:** Layer 3 — Especificações / Sistema  
> **Migrado de:** `docs/regras/central-comando.md`  
> **Última atualização:** 2026-04-03


---

## Visão Geral

A Central de Comando (`/command-center`) é a página inicial do sistema administrativo. Funciona como hub operacional unificado com **3 abas**:

| Aba | Componente | Descrição |
|-----|-----------|-----------|
| **Central de Execuções** (`overview`) | `DashboardContent` | Métricas, pedidos recentes, widgets de alerta |
| **Assistente** (`assistant`) | `EmbeddedCommandAssistant` | Auxiliar de Comando IA (doc separado: `auxiliar-comando.md`) |
| **Agenda** (`agenda`) | `AgendaContent` | **Agente de IA** — Calendário + comunicação exclusiva via WhatsApp com o admin |

**Rota:** `/command-center` (redirect de `/` aponta aqui)  
**Tab control:** via query param `?tab=overview|assistant|agenda`  
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

A **Agenda** é o **terceiro agente de IA** do sistema (junto com o Auxiliar de Comando e o Gestor de Tráfego IA). Seu papel principal é:

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

Disparo:
  1. Cron job verifica agenda_reminders com remind_at ≤ now() e status = 'pending'
  2. Edge function agenda-dispatch-reminders processa os lembretes
  3. Envia via meta-whatsapp-send para o número do administrador
  4. Atualiza status do lembrete (sent/failed)
```

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

```
WhatsApp Cloud API (Meta)
  │
  ├─ Webhook de entrada (mensagens do admin)
  │    └─ Edge Function: agenda-whatsapp-webhook
  │         ├─ Identifica tenant pelo número
  │         ├─ Roteia para o agente Agenda (IA)
  │         ├─ Agente interpreta comando (lembrete vs. execução)
  │         └─ Se execução → chama pipeline do Auxiliar de Comando
  │
  └─ Envio de saída (mensagens da IA para o admin)
       └─ Edge Function: meta-whatsapp-send
            └─ Usa template aprovado ou mensagem dentro da janela de 24h
```

**Edge Functions envolvidas:**

| Edge Function | Papel |
|--------------|-------|
| `agenda-whatsapp-webhook` | Recebe mensagens do admin via webhook Meta (a criar) |
| `agenda-dispatch-reminders` | Cron: dispara lembretes pendentes |
| `meta-whatsapp-send` | Envia mensagens WhatsApp via Cloud API |
| `command-assistant` | Pipeline do Auxiliar de Comando (chamado pela Agenda quando necessário) |

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

#### agenda_tasks

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

#### agenda_reminders

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK tenants |
| `task_id` | UUID | FK agenda_tasks |
| `channel` | TEXT | Sempre `whatsapp` |
| `remind_at` | TIMESTAMPTZ | Quando enviar o lembrete |
| `status` | TEXT | `pending`, `sent`, `failed`, `skipped` |
| `sent_at` | TIMESTAMPTZ | Quando foi enviado |
| `last_error` | TEXT | Último erro (se falhou) |

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

### 3.13 Pendências Técnicas (a implementar)

| Item | Status | Descrição |
|------|--------|-----------|
| `agenda-whatsapp-webhook` | 🔴 A criar | Edge function para receber mensagens do admin e rotear ao agente Agenda |
| Agente IA da Agenda | 🔴 A criar | Motor de IA que interpreta comandos do admin (lembretes, execuções) |
| Integração Agenda ↔ Auxiliar | 🔴 A criar | Canal inter-agentes para delegação de tarefas |
| Cron `agenda-dispatch-reminders` | 🟡 Parcial | Edge function existe, mas cron não configurado |
| Tela de conexão WhatsApp do admin | 🔴 A criar | UI para vincular o número do administrador |
| Sincronização de status órfãos | 🟡 Pendente | Lembretes `pending` em tarefas `completed` precisam ser marcados como `skipped` |

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
8. **WhatsApp** — Agenda depende de integração WhatsApp conectada para envio de lembretes
9. **Calendário Agenda** — Usa `MonthlyCalendar` (componente unificado — ver `transversais/padroes-ui.md` § MonthlyCalendar)
