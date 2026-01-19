# Programa de Afiliados — Regras e Especificações

> **STATUS:** 🟧 Pending (em construção - não consta no module-status)

## Visão Geral

Sistema de afiliados para gerar vendas por indicação com rastreamento de cliques, conversões e comissões.

---

## Arquivos Principais

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Affiliates.tsx` | Página principal do módulo |
| `src/hooks/useAffiliates.ts` | Hooks do módulo |

---

## Funcionalidades

| Feature | Status | Descrição |
|---------|--------|-----------|
| Cadastro de afiliados | ✅ | Nome, email, telefone, dados de pagamento |
| Criação de links | ✅ | Links únicos com código |
| Rastreamento de cliques | ✅ | Registra cada clique |
| Conversões | ✅ | Vincula pedido ao afiliado |
| Comissões | ✅ | Cálculo automático |
| Pagamentos | ✅ | Registro de pagamentos |
| Configurações | ✅ | % comissão, janela de atribuição |

---

## Modelo de Dados

### `affiliate_programs`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| tenant_id | uuid | PK, FK para tenants |
| is_enabled | boolean | Programa ativo |
| commission_type | text | 'percent' ou 'fixed' |
| commission_value_cents | int | Valor da comissão |
| attribution_window_days | int | Janela de atribuição (default 30) |

### `affiliates`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| tenant_id | uuid | FK para tenants |
| name | text | Nome do afiliado |
| email | text | Email |
| phone | text | Telefone |
| status | text | 'active', 'paused', 'blocked' |
| payout_notes | text | Dados para pagamento |

### `affiliate_links`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| affiliate_id | uuid | FK para affiliates |
| code | text | Código único do link |
| target_url | text | URL de destino (opcional) |

### `affiliate_clicks`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| affiliate_id | uuid | FK |
| link_id | uuid | FK |
| ip_hash | text | Hash do IP |
| user_agent | text | User agent |
| referrer | text | Referrer |
| landing_url | text | URL de destino |

### `affiliate_conversions`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| affiliate_id | uuid | FK |
| order_id | uuid | FK para orders |
| order_total_cents | int | Valor do pedido |
| commission_cents | int | Comissão calculada |
| status | text | 'pending', 'approved', 'rejected', 'paid' |

### `affiliate_payouts`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| tenant_id | uuid | FK |
| affiliate_id | uuid | FK |
| amount_cents | int | Valor do pagamento |
| status | text | 'pending', 'paid' |
| paid_at | timestamptz | Data do pagamento |
| proof_url | text | Comprovante |
| notes | text | Observações |

---

## Fluxo de Conversão

```
1. Afiliado compartilha link: loja.com/?aff=CODIGO
2. Visitante clica no link
3. Sistema registra click em affiliate_clicks
4. Cookie/localStorage guarda affiliate_id
5. Visitante faz compra
6. Checkout verifica attribution
7. Se dentro da janela, cria conversão
8. Comissão calculada automaticamente
9. Admin aprova/rejeita conversão
10. Pagamento registrado
```

---

## Configurações do Programa

| Campo | Default | Descrição |
|-------|---------|-----------|
| `is_enabled` | false | Se o programa está ativo |
| `commission_type` | 'percent' | Tipo de comissão |
| `commission_value_cents` | 1000 | 10% ou R$10,00 |
| `attribution_window_days` | 30 | Janela de atribuição |

---

## Status de Conversão

| Status | Descrição |
|--------|-----------|
| `pending` | Aguardando aprovação |
| `approved` | Aprovada, aguardando pagamento |
| `rejected` | Rejeitada |
| `paid` | Paga |

---

## Métricas

| Métrica | Descrição |
|---------|-----------|
| Total de afiliados | Quantidade cadastrada |
| Total de cliques | Cliques rastreados |
| Total de conversões | Pedidos atribuídos |
| Comissão pendente | Valor a pagar |
| Comissão paga | Valor já pago |

---

## Pendências

- [ ] Adicionar ao module-status.ts
- [ ] Integração com checkout (attribution)
- [ ] Dashboard do afiliado (área pública)
- [ ] Relatórios avançados
- [ ] Notificações de conversão
- [ ] Múltiplos níveis de comissão
