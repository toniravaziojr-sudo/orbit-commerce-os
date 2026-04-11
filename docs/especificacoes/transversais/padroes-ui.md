# Padrões Transversais de UI

> **Status:** ✅ Ativo  
> **Camada:** Layer 3 — Especificações / Transversais  
> **Última atualização:** 2026-04-03  
> **Extraído de:** `docs/regras/regras-gerais.md`

---

## 1. Loading States — Regra de Feedback Visual

> **REGRA OBRIGATÓRIA** — Aplica-se a TODAS as ações assíncronas.

### Padrão Obrigatório

Todo botão que executa ação assíncrona DEVE:

1. **Desabilitar durante execução** — `disabled={isLoading}`
2. **Mostrar spinner animado** — `Loader2` do lucide-react com `animate-spin`
3. **Alterar texto para gerúndio** — Ex: "Publicar" → "Publicando..."
4. **Desabilitar botões relacionados** — Ex: "Cancelar" no mesmo modal

### Implementação Padrão

```tsx
import { Loader2 } from 'lucide-react';

<Button disabled={isLoading}>
  {isLoading ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Salvando...
    </>
  ) : (
    'Salvar'
  )}
</Button>
```

### Nomenclatura de Estados

| Ação Original | Texto em Loading |
|---------------|------------------|
| Salvar | Salvando... |
| Publicar | Publicando... |
| Excluir | Excluindo... |
| Enviar | Enviando... |
| Processar | Processando... |
| Confirmar | Confirmando... |
| Importar | Importando... |
| Exportar | Exportando... |
| Conectar | Conectando... |
| Sincronizar | Sincronizando... |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Botão clicável durante loading | `disabled={isLoading}` |
| Sem feedback visual | Spinner + texto de loading |
| Múltiplos cliques permitidos | Desabilitar imediatamente |
| Fechar modal durante ação | Desabilitar botão cancelar |

---

## 2. Diálogos de Confirmação — useConfirmDialog

> **REGRA OBRIGATÓRIA** — Aplica-se a TODAS as ações destrutivas ou críticas.

### Hook Canônico

`src/hooks/useConfirmDialog.tsx` — **useConfirmDialog**

### Uso

```typescript
const { confirm, ConfirmDialog } = useConfirmDialog();

const confirmed = await confirm({
  title: "Título da ação",
  description: "Descrição do impacto",
  variant: "destructive" | "warning" | "info" | "default",
  confirmText: "Texto do botão",
});
if (!confirmed) return;
```

### Variantes

| Variante | Uso | Ícone | Cor |
|----------|-----|-------|-----|
| `destructive` | Exclusão permanente | Trash2 | Vermelho |
| `warning` | Ações com impacto reversível | AlertTriangle | Amarelo |
| `info` | Confirmações informativas | Info | Azul |
| `default` | Ações gerais (publicar, enviar) | Send | Primary |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| `window.confirm()` | `await confirm({ ... })` |
| `window.alert()` | `toast.success()` |
| Diálogos nativos do browser | `useConfirmDialog` |

---

## 3. Padrão de Datas, Períodos e Calendários

> **REGRA OBRIGATÓRIA** — Aplica-se a TODOS os módulos.

### 3.1 Fonte de Verdade: `src/lib/date-presets.ts`

| Função | Descrição |
|--------|-----------|
| `getPresetDateRange(preset)` | Calcula start/end para qualquer preset |
| `detectPreset(start, end)` | Detecta qual preset corresponde a um par de datas |
| `getPreviousPeriod(start, end)` | Calcula período anterior para comparação |
| `getComparisonLabel(start, end)` | Retorna texto comparativo |
| `getPresetLabel(preset)` | Retorna label legível do preset |

**Regras de cálculo:**
- Timezone padrão: `America/Sao_Paulo`
- Início: `startOfDay` (00:00:00.000) no timezone de SP
- Fim: `endOfDay` (23:59:59.999) no timezone de SP
- Semana começa na **Segunda-feira** (`weekStartsOn: 1`)

### 3.2 Utilitário de Timezone: `src/lib/date-timezone.ts`

| Função | Descrição |
|--------|-----------|
| `toSaoPauloStartIso(date)` | ISO de 00:00:00.000 no horário de SP |
| `toSaoPauloEndIso(date)` | ISO de 23:59:59.999 no horário de SP |
| `getSaoPauloDateKey(date)` | `YYYY-MM-DD` conforme timezone de SP |

**Proibições:**
- ❌ `date.toISOString()` direto em filtros de query
- ❌ `setHours(23, 59, 59, 999)` para endOfDay
- ✅ `toSaoPauloStartIso(date)` e `toSaoPauloEndIso(date)`

### 3.3 DateRangeFilter — Filtro de Período

`src/components/ui/date-range-filter.tsx` — **Obrigatório para todo filtro de período.**

| Feature | Descrição |
|---------|-----------|
| **Calendário duplo** | Dois meses lado a lado para seleção visual |
| **Seleção unificada** | Primeiro clique = início, segundo = fim. Dois cliques na mesma data = dia único |
| **Inputs de data** | Campos editáveis DD/MM/AAAA para início e fim |
| **Presets** | Todos de `date-presets.ts` com separadores por grupo |
| **Sincronização preset↔manual** | Seleção manual ativa "Período customizado"; preset substitui manual |
| **"Todo o período"** | Envia `undefined` para start/end. Hook busca `MIN(created_at)` dos pedidos confirmados como data-base |
| **Label inteligente** | Presets nomeados no botão; customizados exibem datas |

**Regra "Todo o período":** Quando `startDate` e `endDate` são `undefined`, busca o `MIN(created_at)` dos pedidos confirmados pelo gateway (`payment_gateway_id IS NOT NULL`). Se não existir nenhum pedido, usa fallback de 90 dias atrás.

**Telas que usam:** Central de Comando, Pedidos, Relatórios, Checkouts Abandonados, Notificações, Logística, Compras, Financeiro, Anúncios.

### 3.4 DatePickerField — Data Única

`src/components/ui/date-picker-field.tsx` — **Obrigatório em vez de `<input type="date">`.**

| Feature | Descrição |
|---------|-----------|
| **Popover + Calendar** | Seletor visual baseado em Shadcn |
| **Input manual** | Campo editável DD/MM/AAAA com parsing via date-fns |
| **Locale ptBR** | Calendário em português |
| **Props** | `minDate`, `maxDate`, `clearable`, `disabled` |

**Telas que usam:** CustomerForm, InvoiceEditor, PurchaseFormDialog, FinanceEntryFormDialog, PlatformAnnouncements, CustomerDetail, Newsletter blocks.

### 3.5 DateTimePickerField — Data e Hora

`src/components/ui/datetime-picker-field.tsx` — **Obrigatório em vez de `<input type="datetime-local">`.**

| Feature | Descrição |
|---------|-----------|
| **Popover + Calendar + Time** | Data visual + input de hora HH:mm |
| **Apply/Cancel** | Alterações confirmadas ao clicar "Aplicar" |
| **Locale ptBR** | Calendário em português |
| **Props** | `minDate`, `maxDate`, `clearable`, `disabled` |

**Telas que usam:** ProductForm (promoção), DiscountFormDialog (validade), PropsEditor (builder), StepReview (email marketing).

### 3.6 MonthlyCalendar — Grade Mensal

`src/components/ui/monthly-calendar.tsx` — **Obrigatório para calendários tipo grade.**

| Feature | Descrição |
|---------|-----------|
| **Grade 7 colunas** | Dom-Sáb com cabeçalhos em ptBR |
| **Navegação mensal** | Botões anterior/próximo mês |
| **Feriados** | Detecção automática via `getHolidayForDate` com emoji e tooltip |
| **Skeletons** | Estado de carregamento padronizado |
| **renderDayContent** | Render prop para conteúdo específico |

**Telas que usam:** Planejamento de Conteúdo, Acompanhamento de Publicações, Agenda.

### Proibições de Datas

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| `<input type="date">` | `<DatePickerField>` |
| `<input type="datetime-local">` | `<DateTimePickerField>` |
| Calendário customizado para filtros | `DateRangeFilter` |
| Constantes `DATE_PRESETS` locais | `date-presets.ts` |
| Grade mensal com `eachDayOfInterval` manual | `MonthlyCalendar` |
| `react-day-picker` direto para filtros | `DateRangeFilter` |
| Calcular "período anterior" manualmente | `getPreviousPeriod` de `date-presets.ts` |

---

## 4. Tratamento de Erros — Padrão v2.0

> **REGRA OBRIGATÓRIA** — Aplica-se a TODOS os módulos do admin e Builder.

### Princípio

**Nenhum erro pode ser silencioso.** Todo erro deve resultar em feedback visual.

### Componente Base: `ErrorFallback`

`src/components/ui/error-fallback.tsx` — 3 variantes: `fullscreen`, `card`, `inline`.

#### Props

| Prop | Tipo | Obrigatória | Descrição |
|------|------|-------------|-----------|
| `variant` | `'fullscreen' \| 'card' \| 'inline'` | ✅ | Variante visual |
| `title` | `string` | ❌ | Título (tem default por variante) |
| `message` | `string` | ❌ | Mensagem descritiva |
| `onRetry` | `() => void` | ❌ | Callback para tentar novamente |
| `onReload` | `() => void` | ❌ | Callback para recarregar |
| `showSupport` | `boolean` | ❌ | Exibe link de suporte |
| `extraActions` | `ReactNode` | ❌ | Ações extras (ex: "Copiar Diagnóstico") |
| `error` | `Error \| null` | ❌ | Erro original — detalhes só em debug |
| `errorInfo` | `React.ErrorInfo \| null` | ❌ | Info do componente React que falhou |

**Detalhes técnicos (debug):** Stack trace visível apenas em `development` ou com `?debug=1` na URL.

### Camadas de Proteção

| Camada | Componente | Variante |
|--------|-----------|----------|
| Global (Admin) | `AdminErrorBoundary` | `fullscreen` |
| Global (Builder) | `BuilderErrorBoundary` | `fullscreen` + "Copiar Diagnóstico" |
| Bloco (Builder) | `BlockErrorBoundary` | `inline` |
| Página (Query) | `QueryErrorState` | `card` |
| Hook/Ação | `showErrorToast` | — |

### BlockErrorBoundary — Regras de Layout

| Regra | Descrição |
|-------|-----------|
| **Altura mínima** | `min-h-[80px]` — nunca colapsa a zero |
| **Não empurra** | Não pode expandir indefinidamente |
| **Isolado** | Erro em um bloco NÃO afeta outros blocos |
| **Logging** | Detalhes técnicos via `console.group` — nunca na UI |

### QueryErrorState — API Congelada

`src/components/ui/query-error-state.tsx` — Wrapper fino sobre `ErrorFallback variant="card"`.

| Prop | Tipo | Default |
|------|------|---------|
| `title` | `string` | `'Erro ao carregar dados'` |
| `message` | `string` | `'Não foi possível carregar os dados. Tente novamente.'` |
| `onRetry` | `() => void` | — |
| `showSupportLink` | `boolean` | `true` |

> ⚠️ **API congelada** — contrato legado de ~20 páginas. NÃO alterar props.

```tsx
if (isError) {
  return (
    <QueryErrorState
      title="Erro ao carregar [módulo]"
      message="Não foi possível carregar os dados. Tente novamente."
      onRetry={() => refetch()}
    />
  );
}
```

---

## 5. Performance e Latência

### Princípios

| Princípio | Descrição |
|-----------|-----------|
| **Execução Paralela** | Edge Functions com múltiplas sub-tarefas DEVEM usar `Promise.allSettled()` |
| **Bootstrap Pattern** | Páginas com 3+ queries iniciais DEVEM consolidar em Edge Function bootstrap |
| **Cache Agressivo** | Dados estáveis: `staleTime` ≥ 2 minutos |
| **Batch Processing** | Listas: batches concorrentes (max 5-10) em vez de loops sequenciais |

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Loops `for...of` com `await` sequencial | `Promise.allSettled()` |
| Múltiplas queries individuais para dados iniciais | Edge Function bootstrap |
| `staleTime: 0` para dados estáveis | `staleTime` ≥ 2 minutos |

---

## 6. Responsividade Mobile — Padrão Admin

| Padrão | Regra |
|--------|-------|
| **Tabelas** | `overflow-x-auto` + `min-w-[Xpx]` para scroll horizontal |
| **Filtros** | `w-full sm:w-44` nos SelectTrigger |
| **Paginação** | Botões numéricos `hidden sm:flex`, mostra "X / Y" no celular |
| **Cards** | `flex-col sm:flex-row` — empilham no celular |
| **Grids de stats** | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` |

---

## 7. Popovers e Calendários

| Regra | Descrição |
|-------|-----------|
| **Altura máxima** | `max-h-[var(--radix-popover-content-available-height)]` |
| **Rolagem interna** | `overflow-y-auto` |
| **Colisão** | `collisionPadding={16}` |
| **Proibição** | Nunca usar `pb-64` para "forçar espaço" |

---

## 8. Utilitários de Formatação

| Utilitário | Arquivo | Descrição |
|------------|---------|-----------|
| `formatCpf.ts` | `src/lib/formatCpf.ts` | Máscara, validação matemática de CPF |
| `formatCnpj.ts` | `src/lib/formatCnpj.ts` | Máscara e validação de CNPJ |
| `cepUtils.ts` | `src/lib/cepUtils.ts` | Sanitização e validação de CEP |

---

## 9. Formatação de Moeda

| Regra | Descrição |
|-------|-----------|
| **Função canônica** | `formatCurrency()` |
| **Valores** | `orders.total` armazena em **Reais** (NÃO centavos). **NÃO dividir por 100.** |
| **Formato** | `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` |

---

## 10. Trigger + Cron Fallback

> **REGRA NÃO NEGOCIÁVEL** — Toda automação baseada em mudança de estado.

| Camada | Responsabilidade |
|--------|-----------------|
| **Trigger (primário)** | Database trigger via `pg_net` — instantâneo |
| **Cron (fallback)** | Job periódico — rede de segurança |

| Regra | Descrição |
|-------|-----------|
| Trigger obrigatório | Toda automação baseada em mudança de estado |
| Cron obrigatório como fallback | Cobrir falhas do trigger |
| Anti-duplicação | Ambos verificam se ação já executada |
| Data real | Usar data do evento original, nunca `now()` |

---

## 11. Separação Admin vs Storefront — Componentes

> **REGRA CRÍTICA** — Alterações no admin NUNCA devem afetar a loja pública dos tenants.

### Domínios

| Contexto | Domínio | Escopo |
|----------|---------|--------|
| **Admin (Comando Central)** | `app.comandocentral.com.br` | Sistema SaaS, UI fixa, tema azul marinho |
| **Storefront (Loja Pública)** | `tenant.shops.comandocentral.com.br` ou domínio customizado | Loja do cliente, herda tema do tenant |

### Componentes Separados

| Componente | Admin | Storefront |
|------------|-------|------------|
| **Toaster (Sonner)** | `AdminToaster` (`src/components/ui/admin-sonner.tsx`) | `Toaster` (`src/components/ui/sonner.tsx`) |
| **Tema/Cores** | Fixo (azul marinho #1e3a5f) | CSS Variables do tenant |
| **Layout** | `AppShell.tsx` | `StorefrontLayout.tsx`, `TenantStorefrontLayout.tsx` |

### Detecção de Contexto

```typescript
const shouldUseTenantRootRoutes = isOnTenantHost();
// TRUE = domínio de tenant (loja pública)
// FALSE = domínio admin (Comando Central)
{shouldUseTenantRootRoutes ? <Sonner /> : <AdminToaster />}
```

### Proibições

| ❌ Proibido | ✅ Correto |
|-------------|------------|
| Alterar `sonner.tsx` para estilizar toasts do admin | Alterar `admin-sonner.tsx` |
| Usar cores hardcoded em componentes compartilhados | Usar CSS variables ou criar versão específica |
| Assumir que mudança em UI afeta só um contexto | Verificar se componente é compartilhado |
| Editar componentes em `src/components/storefront/` para ajustes do admin | Criar componente específico |

### Verificação Obrigatória

Antes de QUALQUER alteração de UI/estilo, verificar:

1. **Qual contexto será afetado?** (Admin, Storefront ou ambos)
2. **O componente é compartilhado?** (Se sim, considerar criar versão específica)
3. **A mudança usa CSS variables ou cores hardcoded?**
4. **Testar em ambos os contextos** após a mudança

---

## Tooltips Informativos

> **Adicionado em:** 2026-04-11

### Objetivo

Fornecer descrições contextuais para botões, tabs, itens de menu e controles da UI. O usuário vê um "balão" explicativo ao manter o mouse sobre o elemento por 1 segundo.

### Arquitetura

| Arquivo | Função |
|---------|--------|
| `src/config/ui-tooltips.ts` | Mapa centralizado `Record<string, string>` com todas as descrições (~120 textos) |
| `src/components/ui/info-tooltip.tsx` | Componente wrapper reutilizável `<InfoTooltip>` |

### Regras

1. **Delay**: 1000ms — o balão aparece após 1 segundo com o mouse parado
2. **Desaparece**: imediatamente ao retirar o mouse
3. **Tamanho**: max-width 280px, texto de no máximo 120 caracteres
4. **Linguagem**: sempre de negócio, sem termos técnicos
5. **Estilo**: usa o `TooltipContent` padrão do design system (bg-popover)
6. **Não interfere**: com tooltips já existentes na sidebar colapsada (delay 0)

### Como usar

```tsx
import { InfoTooltip } from "@/components/ui/info-tooltip";

// Via chave do config:
<InfoTooltip tooltipKey="orders.btn.new">
  <Button>Novo Pedido</Button>
</InfoTooltip>

// Via texto direto:
<InfoTooltip content="Descrição customizada aqui">
  <Button>Ação</Button>
</InfoTooltip>

// Com ícone de "?" ao lado:
<InfoTooltip tooltipKey="orders.btn.new" showIcon>
  <span>Novo Pedido</span>
</InfoTooltip>
```

### Convenção de chaves

- `sidebar.<segmento>` — Itens do menu lateral
- `cc.tab.<nome>` — Tabs da Central de Comando
- `<módulo>.btn.<ação>` — Botões de ação (ex: `orders.btn.new`)
- `<módulo>.tab.<nome>` — Tabs de módulos (ex: `shipping.tab.carriers`)
- `<módulo>.stat.<nome>` — StatCards (ex: `orders.stat.total`)
- `header.<elemento>` — Itens do header

### Onde aplicado

- **Sidebar**: todos os itens de navegação (modo expandido, com delay de 1s)
- **Central de Comando**: 5 tabs
- **Pedidos**: botões Importar, Exportar, Novo Pedido
- **Clientes**: botões Importar, Exportar, Novo Cliente
- **Descontos**: botão Criar desconto
- **Marketing**: 3 tabs
- **Logística**: 4 tabs
- **Header**: itens Dados da Conta e Planos e Faturamento

### Manutenção

Para adicionar um novo tooltip:
1. Adicionar a chave e texto em `src/config/ui-tooltips.ts`
2. Envolver o elemento com `<InfoTooltip tooltipKey="chave">`
3. Não é necessário alterar nenhum outro arquivo de configuração

---

*Fim do documento.*
