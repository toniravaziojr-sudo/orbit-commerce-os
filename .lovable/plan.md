

# Plano: Eliminação de Erros Silenciosos no Comando Central

## Contexto

O sistema possui ~90 hooks e ~60 páginas no admin. A auditoria revelou:

- **14 arquivos** com `catch {}` vazio (erros 100% silenciosos)
- **79 hooks** com `console.error()` — maioria JÁ tem `toast.error()` associado (bom), mas ~15-20 instâncias logam no console sem notificar o usuário
- **0 ErrorBoundary** no admin (apenas no Builder/Storefront)
- **0 páginas** com tratamento de estado de erro em queries (`isError` não usado em nenhuma página)
- Nenhum padrão global de "contate o suporte" para erros técnicos

## Estratégia

Criar um sistema de 3 camadas:

1. **Camada Global** — ErrorBoundary no admin + interceptor de erros não tratados
2. **Camada de Hook** — Padronizar todos os hooks para sempre notificar o usuário
3. **Camada de Página** — Cada página mostra estado de erro quando query falha

---

## Parte 1: ErrorBoundary Global do Admin

**Criar** `src/components/layout/AdminErrorBoundary.tsx`

Um React Error Boundary que envolve todo o admin layout. Quando um erro não tratado ocorre:
- Mostra tela com mensagem amigável: "Algo deu errado"
- Botão "Tentar novamente" (reload da página)
- Botão "Contatar suporte" (link para /support ou WhatsApp)
- Loga o erro no console para debug

**Alterar** `src/App.tsx` ou layout principal para envolver rotas admin com `<AdminErrorBoundary>`.

---

## Parte 2: Componente Reutilizável de Erro

**Criar** `src/components/ui/query-error-state.tsx`

Componente padrão para estados de erro em queries:

```text
┌─────────────────────────────────┐
│  ⚠ Erro ao carregar [módulo]   │
│                                 │
│  Não foi possível carregar os   │
│  dados. Tente novamente.        │
│                                 │
│  [Tentar novamente]             │
│                                 │
│  Se o problema persistir,       │
│  entre em contato com o suporte │
└─────────────────────────────────┘
```

Props: `title`, `message`, `onRetry`, `showSupportLink`.

---

## Parte 3: Utilitário de Toast para Erros

**Criar** `src/lib/error-toast.ts`

Função centralizada para categorizar e exibir erros:

- **Erro de ação do usuário** (ex: campo obrigatório, duplicata) → Toast com instrução clara do que fazer
- **Erro técnico** (ex: falha de rede, 500, timeout) → Toast com "Erro interno. Se persistir, contate o suporte."
- **Erro de permissão** (ex: 403, RLS) → Toast com "Você não tem permissão para esta ação."

---

## Parte 4: Hooks — Auditoria e Correção (20+ hooks)

Hooks que logam erro no console SEM notificar o usuário:

| Hook | Problema |
|------|----------|
| `useBuilderData.ts` | `console.error` + `throw` sem toast |
| `useSubscriptionStatus.ts` | `console.error` + `throw` sem toast |
| `useThemeSettings.ts` (migrateLegacy) | `console.error` + return null silencioso |
| `useFiles.ts` (getFileUrl, getSignedUrl) | `console.error` + return null silencioso |
| `useDashboardMetrics.ts` | Queries sem onError |
| `useNotificationLogs.ts` | Query sem onError |
| `useFinanceEntries.ts` | Query sem onError |
| `usePurchases.ts` | Query sem onError |
| `useEmailMarketing.ts` | Query sem onError |
| `useReports.ts` | Query sem onError |
| `useIntegrationConfig.ts` | Fetch silencioso |
| `useMediaLibrary.ts` | Upload errors parcialmente silenciosos |
| `useAdsChat.ts` | `.catch(() => ({}))` silencioso |
| `useStoreSettings.ts` | Queries sem feedback de erro |
| `useHealthChecks.ts` | Erro de fetch silencioso |

**Ação**: Adicionar `toast.error()` com mensagem clara em cada `catch`/`onError` que hoje é silencioso. Usar o utilitário `error-toast.ts` para categorizar.

---

## Parte 5: Páginas — Estado de Erro Visual (40+ páginas)

Nenhuma página do admin mostra estado de erro quando uma query falha. Todas ignoram `isError` retornado pelo React Query.

**Páginas prioritárias** (alto impacto):

| Página | Query afetada |
|--------|---------------|
| `Orders.tsx` | `useOrders` |
| `Products.tsx` | `useProducts` |
| `Customers.tsx` | `useCustomers` |
| `Dashboard.tsx` | `useDashboardMetrics` |
| `Categories.tsx` | `useProducts` |
| `Discounts.tsx` | `useDiscounts` |
| `Finance.tsx` | `useFinanceEntries` |
| `Fiscal.tsx` | `useFiscal` |
| `Shipping.tsx` | `useShippingRules` |
| `EmailMarketing.tsx` | `useEmailMarketing` |
| `Notifications.tsx` | `useNotificationRules` |
| `Media.tsx` | `useMediaLibrary` |
| `Integrations.tsx` | Multiple |
| `Offers.tsx` | `useOfferRules` |
| `Reviews.tsx` | Reviews query |
| `Affiliates.tsx` | `useAffiliates` |
| `Blog.tsx` | Blog queries |
| `LandingPages.tsx` | LP queries |
| `Campaigns.tsx` | Campaign queries |
| `Support.tsx` | Tickets query |
| `Reports.tsx` | `useReports` |
| `Purchases.tsx` | `usePurchases` |
| `Shipments.tsx` | `useShipments` |
| `CommandCenter.tsx` | Agenda queries |
| `AdsManager.tsx` | Ads queries |
| `Import.tsx` | Import queries |
| `Files.tsx` | `useFiles` |
| `Pages.tsx` | `useStorePages` |
| `Menus.tsx` | `useMenus` |
| `Payments.tsx` | `usePaymentProviders` |
| `Settings.tsx` | Config queries |
| `Domains.tsx` | Domain queries |

**Ação em cada página**: Extrair `isError` e `refetch` das queries e renderizar `<QueryErrorState>` quando `isError === true`.

---

## Parte 6: Catches Vazios — Correção Pontual

| Arquivo | Linha | Ação |
|---------|-------|------|
| `CommandChatInput.tsx` | 85, 215 | OK — localStorage fallback, aceitável |
| `AppSidebar.tsx` | 251 | OK — localStorage fallback |
| `AdminModeContext.tsx` | 41, 51 | OK — localStorage fallback |
| `AdsManager.tsx` | 134, 144 | Adicionar `toast.error('Erro ao sincronizar')` |
| `EmailProviderSettings.tsx` | 153 | OK — já tem toast logo abaixo |
| `checkoutSession.ts` | 249 | OK — fire-and-forget intencional |

---

## Parte 7: Edge Functions e IAs

Todas as IAs (Auxiliar de Comando, Gerador de LP, Criativos, Ads Chat) já retornam erros via streaming ou response body. O problema é no **client-side**:

- `useCommandAssistant.ts` — Já tem error handling adequado
- `useAdsChat.ts` — Catch genérico, melhorar mensagem
- `useCreatives.ts` — Já tem toast.error
- Landing Page generate — Já tem toast.error

**Ação**: Auditar mensagens de erro das IAs para garantir que são claras e orientam o usuário.

---

## Ordem de Implementação

1. Criar `AdminErrorBoundary` + `QueryErrorState` + `error-toast.ts` (infraestrutura)
2. Corrigir hooks silenciosos (Parte 4)
3. Adicionar estados de erro nas páginas principais (Parte 5 — top 15 páginas primeiro)
4. Corrigir catches vazios restantes (Parte 6)
5. Refinar mensagens de erro das IAs (Parte 7)
6. Páginas secundárias restantes

---

## Arquivos Novos

| Arquivo | Descrição |
|---------|-----------|
| `src/components/layout/AdminErrorBoundary.tsx` | ErrorBoundary global do admin |
| `src/components/ui/query-error-state.tsx` | Componente reutilizável de estado de erro |
| `src/lib/error-toast.ts` | Utilitário centralizado de toast de erro |

## Arquivos Editados

~55 arquivos entre hooks e páginas (listados acima).

---

## Documentação

Atualizar `docs/regras/regras-gerais.md`:
- Adicionar seção "Padrão de Tratamento de Erros v1.0"
- Registrar componentes e utilitários criados
- Definir regra: "Nenhum `console.error` sem `toast` correspondente"
- Definir regra: "Toda página com query deve tratar `isError`"

