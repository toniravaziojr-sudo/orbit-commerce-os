# Checkouts Abandonados — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Visão Geral

Dashboard de monitoramento e recuperação de checkouts abandonados. O sistema rastreia sessões de checkout e identifica oportunidades de recuperação quando o cliente abandona o processo.

---

## Arquitetura de Componentes

| Componente | Arquivo | Responsabilidade |
|------------|---------|------------------|
| **Página Principal** | `src/pages/AbandonedCheckouts.tsx` | Dashboard com stats e listagem |
| **Tab Component** | `src/components/cart-checkout/AbandonedCheckoutsTab.tsx` | Versão modular para settings |
| **Hook de Dados** | `src/hooks/useCheckoutSessions.ts` | Fetch de sessões com filtros |
| **Hook de Stats** | `src/hooks/useCheckoutSessionsStats.ts` | Métricas agregadas |
| **Instrumentação** | `src/lib/checkoutSession.ts` | Tracking no storefront |

---

## Tabela do Banco

| Tabela | Campos-Chave |
|--------|--------------|
| `checkout_sessions` | `id`, `tenant_id`, `status`, `customer_email`, `customer_phone`, `customer_name`, `contact_captured_at`, `abandoned_at`, `recovered_at`, `converted_at`, `items_snapshot`, `total_estimated`, `region`, `utm` |

---

## Status da Sessão

| Status | Descrição |
|--------|-----------|
| `active` | Checkout em andamento |
| `abandoned` | Inatividade > 30 min após captura de contato |
| `converted` | Pedido finalizado |
| `recovered` | Abandonado que depois converteu |

---

## Campos Críticos

| Campo | Descrição |
|-------|-----------|
| `contact_captured_at` | Momento em que email/telefone foi capturado (Step 1) |
| `abandoned_at` | Momento em que foi marcado como abandonado |
| `recovered_at` | Momento em que foi recuperado |
| `last_seen_at` | Última atividade do cliente |
| `items_snapshot` | Snapshot dos itens no carrinho |
| `total_estimated` | Valor estimado do pedido |

---

## Edge Functions

| Function | Responsabilidade |
|----------|------------------|
| `checkout-session-start` | Inicia tracking da sessão |
| `checkout-session-capture-contact` | Captura email/telefone no Step 1 |
| `checkout-session-end` | Marca sessão como finalizada |
| `scheduler-tick` | Job que detecta abandonos (inatividade > 30 min) |

---

## Fluxo de Abandono

```
┌─────────────────────────────────────────────────────────────┐
│  1. Cliente inicia checkout                                  │
│     → checkout-session-start cria sessão (status: active)   │
├─────────────────────────────────────────────────────────────┤
│  2. Cliente preenche identificação (Step 1)                  │
│     → checkout-session-capture-contact                       │
│     → contact_captured_at é preenchido                       │
│     → Sessão agora é "recuperável"                           │
├─────────────────────────────────────────────────────────────┤
│  3. Se inatividade > 30 minutos                              │
│     → scheduler-tick marca abandoned_at                      │
│     → status muda para 'abandoned'                           │
│     → Evento checkout.abandoned é disparado                  │
├─────────────────────────────────────────────────────────────┤
│  4. Recuperação possível via email/WhatsApp                  │
│     → Se cliente converter depois → recovered_at preenchido  │
│     → status muda para 'recovered'                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Stats Cards

| Card | Métrica |
|------|---------|
| **Total** | Quantidade total de checkouts no período |
| **Abandonados** | Checkouts marcados como abandonados |
| **Não recuperados** | Abandonados sem conversão |
| **Valor perdido** | Soma do `total_estimated` dos não recuperados |

---

## Filtros da Listagem

| Filtro | Opções |
|--------|--------|
| **Busca** | Por nome, email ou telefone |
| **Status** | Todos, Ativo, Abandonado, Convertido, Recuperado |
| **Região** | Estado/UF do cliente |
| **Período** | Data inicial e final |

---

## Detalhes do Checkout (Sheet)

| Seção | Campos |
|-------|--------|
| **Cliente** | Nome, email, telefone, região |
| **Itens** | Produtos no carrinho, quantidades, preços |
| **Timeline** | Iniciado em, Última atividade, Abandonado em, Recuperado em |
| **UTM/Atribuição** | Dados de origem do tráfego |

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Só exibe com contato** | Sessões sem `contact_captured_at` não aparecem na listagem (não são recuperáveis) |
| **Timeout 30 min** | `scheduler-tick` marca abandono após 30 min de inatividade |
| **Tenant-scoped** | Sessões são isoladas por tenant |
| **Evento de abandono** | `checkout.abandoned` pode triggerar automações |

---

## Heartbeat

O frontend envia heartbeats periódicos via `checkoutSession.heartbeat()` para manter `last_seen_at` atualizado. Se parar de receber, scheduler-tick detecta inatividade.

---

## Integração com Automações

Quando `checkout.abandoned` é disparado, pode triggerar:
- Email de recuperação
- Mensagem WhatsApp
- Notificação para equipe

---

## RBAC

| Módulo | Rota | Permissão |
|--------|------|-----------|
| `ecommerce.abandoned-checkouts` | `/abandoned-checkouts` | Listar, visualizar sessões |
