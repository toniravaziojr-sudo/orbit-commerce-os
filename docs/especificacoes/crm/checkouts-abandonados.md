# Checkouts Abandonados — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

> **Camada:** Layer 3 — Especificações / CRM  
> **Migrado de:** `docs/regras/checkouts-abandonados.md`  
> **Última atualização:** 2026-04-04

## Visão Geral

Dashboard de monitoramento e recuperação de checkouts abandonados. O sistema rastreia sessões de checkout via **estado interno temporário** e identifica oportunidades de recuperação quando o cliente abandona o processo.

**REGRA FUNDAMENTAL (v2026-04-04):** O estado interno temporário existe enquanto o cliente não tiver um pedido real. Nenhum pedido é criado e nenhum cliente é registrado durante o estado interno — esses eventos só ocorrem após resposta da operadora de pagamento.

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
| `checkout_sessions` | `id`, `tenant_id`, `status`, `internal_state`, `customer_email`, `customer_phone`, `customer_name`, `contact_captured_at`, `abandoned_at`, `recovered_at`, `converted_at`, `reverted_at`, `items_snapshot`, `total_estimated`, `region`, `utm`, `order_id` |

---

## Status da Sessão

| Status | Descrição |
|--------|-----------|
| `active` | Checkout em andamento — estado interno ativo |
| `abandoned` | Inatividade > 30 min sem pedido real — estado interno inativo |
| `converted` | Checkout converteu diretamente em pedido real |
| `recovered` | Cliente com checkout abandonado converteu em **outro** checkout |
| `reverted` | **NOVO (v2026-04-04)** — Mesmo checkout abandonado foi concluído e virou pedido real |

---

## Estado Interno (v2026-04-04)

O estado interno controla a validade temporária da sessão de checkout:

| Estado | Descrição |
|--------|-----------|
| `active` | Cliente está no checkout, dados sendo coletados. Dura até 30 min de inatividade |
| `inactive` | Timeout de 30 min sem conversão. Checkout marcado como abandonado |

**Regras do estado interno:**
1. Estado inicia como `active` quando o checkout começa
2. Heartbeat mantém `last_seen_at` atualizado
3. Se `last_seen_at` > 30 min sem conversão → estado muda para `inactive`
4. Quando inativo, checkout é marcado como `abandoned`
5. **Estado inativo NÃO impede conversão tardia** — se o cliente voltar e concluir, o checkout é marcado como `reverted`
6. O estado interno é **removido** quando o checkout se torna um pedido real (em qualquer cenário: `converted` ou `reverted`)

---

## Campos Críticos

| Campo | Descrição |
|-------|-----------|
| `contact_captured_at` | Momento em que email/telefone foi capturado (Step 1) |
| `internal_state` | Estado interno: `active` ou `inactive` |
| `abandoned_at` | Momento em que foi marcado como abandonado |
| `recovered_at` | Momento em que foi recuperado (outro checkout converteu) |
| `converted_at` | Momento em que converteu diretamente em pedido |
| `reverted_at` | Momento em que um abandono foi revertido (mesmo checkout concluído) |
| `last_seen_at` | Última atividade do cliente |
| `items_snapshot` | Snapshot dos itens no carrinho |
| `total_estimated` | Valor estimado do pedido |
| `order_id` | ID do pedido real, quando criado |

---

## Edge Functions

| Function | Responsabilidade |
|----------|------------------|
| `checkout-session-start` | Inicia tracking da sessão |
| `checkout-session-capture-contact` | Captura email/telefone no Step 1 |
| `checkout-session-end` | Marca sessão como finalizada (converted) |
| `scheduler-tick` | Job que detecta abandonos (inatividade > 30 min) e processa conversões tardias |

---

## Fluxo de Checkout com Estado Interno (v2026-04-04)

```
┌─────────────────────────────────────────────────────────────┐
│  1. Cliente inicia checkout                                  │
│     → checkout-session-start cria sessão                     │
│     → status: active, internal_state: active                 │
│     → NENHUM pedido criado, NENHUM cliente criado             │
├─────────────────────────────────────────────────────────────┤
│  2. Cliente preenche identificação (Step 1)                  │
│     → checkout-session-capture-contact                       │
│     → contact_captured_at é preenchido                       │
│     → Sessão agora é "recuperável" (tem dados de contato)    │
├─────────────────────────────────────────────────────────────┤
│  3. Cliente clica "Finalizar Compra"                         │
│     → Sistema chama operadora de pagamento                   │
│     → Se operadora RESPONDE (qualquer status):               │
│        → Pedido REAL criado (com numeração da loja)          │
│        → status → "converted", converted_at preenchido       │
│        → Estado interno removido                             │
│     → Se operadora NÃO RESPONDE (timeout/erro):             │
│        → NENHUM pedido criado                                │
│        → Sessão permanece active                             │
├─────────────────────────────────────────────────────────────┤
│  4. Se inatividade > 30 minutos (sem conversão)              │
│     → scheduler-tick detecta timeout                         │
│     → internal_state → "inactive"                            │
│     → status → "abandoned", abandoned_at preenchido          │
│     → Evento checkout.abandoned disparado                    │
│     → Cliente adicionado à lista "Cliente Potencial"         │
│       no email marketing                                     │
├─────────────────────────────────────────────────────────────┤
│  5a. Conversão tardia (mesmo checkout abandonado)            │
│     → Cliente volta ao MESMO checkout e conclui              │
│     → Operadora responde → pedido REAL criado                │
│     → status → "reverted", reverted_at preenchido            │
│     → Estado interno removido                                │
│     → Checkout não é mais "abandonado"                       │
├─────────────────────────────────────────────────────────────┤
│  5b. Recuperação (outro checkout)                            │
│     → Cliente com checkout abandonado abre NOVO checkout     │
│     → Novo checkout converte em pedido                       │
│     → Checkout anterior: status → "recovered",               │
│       recovered_at preenchido                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Stats Cards

| Card | Métrica |
|------|---------|
| **Total** | Quantidade total de checkouts abandonados no período |
| **Abandonados** | Checkouts com status `abandoned` (não recuperados/revertidos) |
| **Não recuperados** | Abandonados sem conversão posterior |
| **Valor perdido** | Soma do `total_estimated` dos não recuperados |

---

## Filtros da Listagem

| Filtro | Opções | Componente |
|--------|--------|------------|
| **Busca** | Por nome, email ou telefone | `Input` com ícone Search |
| **Status** | Todos, Ativo, Abandonado, Convertido, Recuperado, Revertido | `Select` |
| **Região** | Estado/UF do cliente | `Select` |
| **Período** | Data inicial e final | `DateRangeFilter` (padrão do sistema — ver `regras-gerais.md`) |

---

## Detalhes do Checkout (Sheet)

| Seção | Campos |
|-------|--------|
| **Cliente** | Nome, email, telefone, região |
| **Itens** | Produtos no carrinho, quantidades, preços |
| **Timeline** | Iniciado em, Última atividade, Abandonado em, Recuperado em, Revertido em |
| **UTM/Atribuição** | Dados de origem do tráfego |

---

## Regras de Negócio

| Regra | Descrição |
|-------|-----------|
| **Só exibe com contato** | Sessões sem `contact_captured_at` não aparecem na listagem (não são recuperáveis) |
| **Timeout 30 min** | `scheduler-tick` marca abandono após 30 min de inatividade |
| **Tenant-scoped** | Sessões são isoladas por tenant |
| **Evento de abandono** | `checkout.abandoned` pode triggerar automações |
| **Estado interno não bloqueia** | Mesmo com estado `inactive`, o cliente pode converter (→ reverted) |
| **Sem pedidos fantasma** | Pedidos só existem após resposta do gateway. Não há mais ghost orders |
| **Lista Cliente Potencial** | Checkout abandonado insere automaticamente na lista "Cliente Potencial" do email marketing |

---

## Heartbeat

O frontend envia heartbeats periódicos via `checkoutSession.heartbeat()` para manter `last_seen_at` atualizado. Se parar de receber, scheduler-tick detecta inatividade.

---

## Integração com Email Marketing — Lista "Cliente Potencial" (v2026-04-04)

Quando um checkout é marcado como `abandoned`:

1. Sistema verifica se existe a tag sistêmica "Cliente Potencial" no tenant
   - Se não existe, cria com cor `#f97316` (laranja)
2. Sistema verifica se existe a lista "Cliente Potencial" no email marketing
   - Se não existe, cria vinculada à tag
3. Adiciona o contato como subscriber na lista "Cliente Potencial"
   - Usa `upsert_subscriber_only()` — NÃO cria customer
4. Se o contato já for subscriber, apenas adiciona à lista (sem duplicar)

| Item | Valor |
|------|-------|
| Nome da tag | `Cliente Potencial` |
| Cor | `#f97316` (laranja) |
| Nome da lista | `Cliente Potencial` |
| Tipo | Lista padrão do sistema |
| Critério de entrada | Checkout abandonado (status = abandoned) |

---

## Integração com Automações

Quando `checkout.abandoned` é disparado, pode triggerar:
- Email de recuperação
- Mensagem WhatsApp
- Notificação para equipe
- Inserção na lista "Cliente Potencial"

---

## Proteção de Notificação para Abandono

O motor de notificações (`process-events`) usa 2 camadas de proteção para `abandoned_checkout`:

| Camada | Verificação | Prioridade |
|--------|------------|------------|
| **1 — Sessão** | Se a `checkout_session` tem `order_id` preenchido → NÃO é abandono | Máxima |
| **2 — Heurística** | Se o cliente tem pedido aprovado nas últimas 24h → skip | Complementar |

---

## Lifecycle do Contato

```
Lead → Subscriber → Cliente Potencial → Customer
                         |                    |
                   checkout abandonado    pedido real com pagamento aprovado
```

| Estado | Trigger | Módulo |
|--------|---------|--------|
| Lead | Captura de contato (formulário, popup) | CRM |
| Subscriber | Opt-in confirmado | Email Marketing |
| Cliente Potencial | Checkout abandonado | Email Marketing (lista "Cliente Potencial") |
| Customer | Pedido real com pagamento aprovado | Clientes |

---

## RBAC

| Módulo | Rota | Permissão |
|--------|------|-----------|
| `ecommerce.abandoned-checkouts` | `/abandoned-checkouts` | Listar, visualizar sessões |

---

*Fim do documento.*
