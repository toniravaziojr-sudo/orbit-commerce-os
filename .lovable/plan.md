

## Plano: Refatoração da Central de Comando — 6 Abas

### O que existe hoje na "Central de Execuções" (tudo preservado exceto Pedidos Recentes)

| Widget atual | Destino na nova estrutura |
|---|---|
| Banner de método de pagamento | **Dashboard** |
| Filtro de data + Métricas de funil/financeiro | **Dashboard** |
| Alerta de limite de pedidos | **Dashboard** |
| Widget de Comunicações | **Comunicações** |
| Alertas de Anúncios | **Alertas** |
| Erros de Integração | **Alertas** |
| Alertas do Calendário de Conteúdo | **Comunicações** |
| Alertas Fiscais | **Alertas** |
| ~~Pedidos Recentes~~ | **Removido** |
| Alertas de Integração (sidebar) | **Alertas** |
| Saúde do Storefront | **Alertas** |
| Card "Atenção Agora" | **Execuções** (com dados reais e navegação) |
| Ações Rápidas | **Dashboard** |

### Nova Estrutura (6 abas)

```text
Dashboard → Execuções → Alertas → Comunicações → Assistente → Agenda
```

**1. Dashboard** (aba padrão)
- Banner de pagamento e limite de pedidos
- Filtro de data + Métricas (funil, financeiro, checkouts abandonados)
- Ações Rápidas (Novo Produto, Novo Pedido, Novo Cliente, Processar Pedidos)

**2. Execuções** (fila operacional unificada)
Seções por módulo, cada item com botão que navega direto à ação:

| Seção | O que mostra | Clique leva para |
|---|---|---|
| Pedidos | Aguardando envio, pagamento pendente, chargebacks | `/orders?status=...` |
| Notas Fiscais | NF-e pendente, devoluções pendentes | `/fiscal?tab=...` |
| Integrações | Erros de sync com intervenção manual | `/integrations` |
| Anúncios | Ações do autopilot pendentes | `/ads?tab=autopilot` |
| Insights | Estoque baixo, carrinhos abandonados | Módulo relevante |

Seções sem pendências ficam colapsadas.

**3. Alertas**
- StorefrontHealthCard
- IntegrationAlerts + IntegrationErrorsCard
- FiscalAlertsWidget
- AdsAlertsWidget

**4. Comunicações**
- CommunicationsWidget
- ContentCalendarAlertsCard

**5. Assistente** — sem alteração
**6. Agenda** — sem alteração

### Arquivos

**Criar:**
- `src/components/command-center/ExecutionsQueue.tsx`
- `src/components/command-center/ExecutionSection.tsx`
- `src/components/command-center/DashboardTab.tsx`
- `src/components/command-center/AlertsTab.tsx`
- `src/components/command-center/CommunicationsTab.tsx`

**Modificar:**
- `src/pages/CommandCenter.tsx` — 4→6 abas, importar novos componentes, remover DashboardContent inline

