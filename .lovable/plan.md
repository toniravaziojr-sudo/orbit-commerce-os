

# Plano: Universalização do Fuso Horário de Brasília (BRT)

## Contexto

O sistema possui **72+ arquivos** usando `date-fns format()` (dependente do browser), **28 arquivos** usando `toLocaleDateString()` sem timezone explícito, e **7 arquivos** usando `isToday`/`isYesterday` sem considerar BRT. Apenas 4 arquivos usam corretamente `America/Sao_Paulo`. Isso causa exibição de horários errados quando o browser está em timezone diferente de BRT.

## Regra a Documentar

> Todo horário exibido ao usuário deve refletir o horário oficial de Brasília (America/Sao_Paulo). O banco armazena UTC. A conversão ocorre apenas na camada de apresentação.

---

## Etapas

### 1. Criar utilitário central `src/lib/date-format.ts`

Funções centralizadas com timezone `America/Sao_Paulo` hardcoded:

- `formatDateBR(date)` → "12/04/2026"
- `formatDateTimeBR(date)` → "12/04/2026 07:30"
- `formatDateLongBR(date)` → "12 de abril de 2026"
- `formatDateTimeLongBR(date)` → "12 de abril de 2026 às 07:30"
- `formatTimeBR(date)` → "07:30"
- `formatMonthYearBR(date)` → "abril 2026"
- `formatDayMonthBR(date)` → "12 abr"
- `formatWeekdayBR(date)` → "sábado, 12 de abril"
- `isTodayBR(date)` → boolean (compara dateKey SP)
- `isYesterdayBR(date)` → boolean
- `formatRelativeDateBR(date)` → "Hoje, 07:30" / "Ontem" / "12 abr" / "12 abr 2025"

Todas usam `Intl.DateTimeFormat` com `timeZone: 'America/Sao_Paulo'`. Reutiliza `getSaoPauloDateKey` do `date-timezone.ts` existente.

### 2. Migração dos arquivos (4 lotes)

**Lote 1 — E-commerce e Pedidos (~18 arquivos)**
Substituir `format(date, "dd/MM/yyyy", { locale: ptBR })` e `toLocaleDateString('pt-BR')` pelas funções centralizadas. Inclui: OrderDetails, OrderList, StorefrontOrderDetail, ShipmentDetailsCard, TrackingLookupBlock, TikTokShopOrdersTab, etc.

**Lote 2 — CRM e Marketing (~15 arquivos)**
EmailList, AbandonedCheckoutsTab, SubscribersTab, ChatConversationList, GoogleCalendarTab, etc.

**Lote 3 — Admin e Plataforma (~20 arquivos)**
CreditLedgerTable, BillingSettings, PlatformTenants, LandingPageEditor, FiscalSettings, WhatsAppMetaSettings, AgendaTemplateStatus, etc.

**Lote 4 — Calendários e Componentes Visuais (~10 arquivos)**
MonthlyCalendar (`isToday`), AgendaCalendar, PlanningTab, TrackingTab, DayPostsList, DayTasksDialog. O `isToday` do calendar compara datas — substituir por `isTodayBR`.

**Nota**: Edge functions (servidor) que usam `toLocaleDateString` para emails/notificações também serão atualizadas para consistência.

### 3. Documentação

- **Criar regra no Layer 2** (Doc de Regras): seção "Fuso Horário" com a regra oficial
- **Atualizar `date-timezone.ts`**: adicionar referência cruzada ao `date-format.ts`
- **Atualizar Knowledge**: incluir regra de timezone no checklist de conformidade

---

## Resumo de impacto

| Item | Quantidade |
|------|-----------|
| Novo arquivo utilitário | 1 (`src/lib/date-format.ts`) |
| Arquivos front-end a migrar | ~63 |
| Edge functions a ajustar | ~5 |
| Docs a atualizar | 2-3 |

## Risco

Baixo. Mudança é puramente de apresentação. Nenhuma alteração em dados ou lógica de negócio. Formatação visual permanece idêntica (pt-BR), apenas a referência de timezone muda de "browser local" para "São Paulo fixo".

