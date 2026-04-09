

## Plano: Central de Execuções Completa — Cards com Stats + Só Pendências

### Problema Atual
- Mostra todas as 5 seções mesmo sem pendências (ruído visual)
- Cobre apenas 5 das 33 execuções identificadas
- Layout de lista com expand/collapse, diferente do padrão de cards com contadores que o usuário quer (estilo Comunicações)

### Nova UI — Estilo CommunicationsWidget
Cada categoria vira um Card com grid de contadores clicáveis + botões de ação rápida. **Só aparece se tiver pendências.** Quando tudo está ok: mensagem "Tudo em dia!".

```text
┌─────────────────────────────────────────────────────┐
│ 🛒 Pedidos                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │    12    │ │    86    │ │     3    │ │    1    ││
│ │Pagamento │ │  Enviar  │ │Chargeback│ │Devolução││
│ │ pendente │ │          │ │          │ │         ││
│ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│ [Ver Pendentes]  [Processar Envios]  [Resolver]    │
├─────────────────────────────────────────────────────┤
│ 📄 Notas Fiscais                                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │     5    │ │     2    │ │     1    │            │
│ │ Emitir   │ │Rejeitadas│ │ Alertas  │            │
│ └──────────┘ └──────────┘ └──────────┘            │
│ [Emitir NF-e]  [Corrigir Rejeitadas]  [Ver Alertas]│
├─────────────────────────────────────────────────────┤
│ 💬 Atendimento                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│ │     8    │ │     3    │ │     2    │            │
│ │Aguardando│ │  Novos   │ │Erros Ntf │            │
│ └──────────┘ └──────────┘ └──────────┘            │
│ [Abrir Atendimento]  [Ver Notificações]            │
├─────────────────────────────────────────────────────┤
│ (Integrações, Anúncios, Insights — só se houver)   │
└─────────────────────────────────────────────────────┘
```

### Categorias e Contadores (todas as 33 execuções mapeadas)

**1. Pedidos** (hooks: `useExecutionOrders` — novo)
- Pagamento pendente (`payment_status = 'awaiting_payment'`) → `/orders?paymentStatus=awaiting_payment`
- Aguardando envio (`status = 'paid'` sem shipment) → `/orders?status=paid`
- Chargebacks (`status in chargeback_detected, chargeback_lost`) → `/orders?status=chargeback_detected`
- Devoluções (`status = 'returning'`) → `/orders?status=returning`
- Aguardando NF-e (`status = 'ready_to_invoice'`) → `/orders?status=ready_to_invoice`

**2. Notas Fiscais** (hooks: `useFiscalStats`, `useOrdersPendingInvoice`, `useFiscalAlerts`)
- NF-e pendente de emissão (drafts) → `/fiscal?tab=open-orders`
- NF-e rejeitadas pelo SEFAZ → `/fiscal?tab=invoices&status=rejected`
- Alertas fiscais (cancelamento com NF-e ativa) → `/fiscal?tab=invoices`

**3. Atendimento** (hooks: `useConversations` stats + queries de notificações/emails)
- Conversas aguardando agente (`status = new | waiting_agent`) → `/support?status=waiting_agent`
- Conversas em andamento (`status = open | waiting_customer`) → `/support`
- Erros de notificação (`notifications.status = 'failed'`) → `/notifications`
- Emails não lidos → `/emails`

**4. Integrações** (hook novo: `useExecutionIntegrations`)
- Erros de sync Google Merchant (produtos reprovados) → `/integrations/google-merchant`
- Erros de sync Mercado Livre → `/integrations/mercado-livre`
- Erros de sync Shopee → `/integrations/shopee`
- Erros de sync TikTok Shop → `/integrations/tiktok-shop`

**5. Anúncios** (hook existente: `useAdsPendingActions`)
- Ações do autopilot pendentes de aprovação → `/ads?tab=autopilot`
- Experimentos pendentes de avaliação → `/ads?tab=experiments`

**6. Insights** (hooks: query de estoque + `useDashboardMetrics` + `useRuntimeViolations`)
- Carrinhos abandonados → `/orders?status=abandoned`
- Produtos com estoque baixo → `/products?stock=low`
- Violações de storefront → `/storefront/health`

### Implementação Técnica

**Novo componente de seção** — `ExecutionCard.tsx`:
- Recebe: título, ícone, array de `{ count, label, color, navigateTo }`, array de botões de ação
- Renderiza grid de contadores clicáveis (estilo `CommunicationsWidget`) + botões de ação
- Componente retorna `null` se todos os counts forem 0

**Novo hook** — `useExecutionCounts.ts`:
- Centraliza todas as queries de contagem em um único hook
- Retorna contadores por categoria: `{ orders, fiscal, support, integrations, ads, insights }`
- Cada contador com `count` e `navigateTo`
- Usa queries existentes onde possível (`useFiscalStats`, `useAdsPendingActions`, `useConversations`)
- Cria queries novas apenas para: contagem de pedidos por status, estoque baixo, erros de integração

**Reescrever** — `ExecutionsQueue.tsx`:
- Usa `useExecutionCounts` para obter todos os dados
- Renderiza `ExecutionCard` para cada categoria com pendências
- Mostra "Tudo em dia!" quando nenhuma categoria tem pendências

**Remover** — `ExecutionSection.tsx` (substituído por `ExecutionCard.tsx`)

**Modificar** — `DashboardTab.tsx`:
- Remover seção "Ações Rápidas"

### Ordem de exibição dos cards
1. Pedidos (maior volume diário)
2. Notas Fiscais (obrigação legal)
3. Atendimento (experiência do cliente)
4. Integrações (erros de sync)
5. Anúncios (ações de autopilot)
6. Insights (oportunidades)

Cards sem pendências simplesmente não renderizam.

