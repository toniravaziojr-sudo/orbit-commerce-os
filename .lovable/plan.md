

# Proposta Consolidada — Reestruturação dos Fluxos de Checkout, Pagamento e Clientes

## Resumo Executivo

Três sistemas interconectados precisam ser redesenhados para eliminar pedidos fantasma, clientes fantasma e garantir verificação ativa de pagamento. A proposta consolida os fluxos anteriormente discutidos (estado interno + abandono) com os dois novos sistemas solicitados (verificação de pagamento e identificação de clientes).

---

## COMO FUNCIONA HOJE

```text
1. Cliente preenche dados pessoais
   → checkout_session criada (active)

2. Cliente clica "Finalizar Compra"
   → Pedido REAL criado imediatamente (consome numeração #192, #193...)
   → Cliente criado/atualizado no módulo Clientes imediatamente
   → Chama operadora de pagamento
      → Se responde: grava payment_gateway_id → pedido visível
      → Se NÃO responde: pedido fantasma → cron cancela em 30min
   → Cliente "fantasma" permanece no sistema com 0 pedidos

3. Verificação de pagamento
   → Apenas via webhook (passivo) + cron de expiração (30min/1h/4dias)
   → Sem verificação ativa junto à operadora
   → Sem monitoramento de chargebacks

4. Identificação de clientes novos
   → Cliente criado no momento do pedido (antes do pagamento)
   → Trigger incrementa total_orders em todo INSERT
```

**Problemas:**
- Numeração consumida por tentativas que nunca chegaram à operadora
- Clientes como "Eliseu" entram no sistema com 0 pedidos pagos
- Sem verificação proativa de status junto ao gateway
- Sem detecção de chargebacks/estornos
- Ghost orders precisam de filtro em todas as queries

---

## COMO VAI FUNCIONAR

### Fase 1 — Estado Interno e Abandono

```text
Step 1 (dados pessoais)
  → checkout_session criada (status: active)
  → dados pessoais + itens armazenados na checkout_session
  → NENHUM pedido criado, NENHUM cliente criado

Clique em "Finalizar Compra"
  → Sistema chama operadora de pagamento
  → Operadora responde (qualquer status: aprovado, recusado, pendente)
     → SÓ AGORA cria pedido real com numeração da loja
     → checkout_session muda para "converted"
  → Operadora NÃO responde (timeout, erro, tab fechada)
     → NENHUM pedido criado
     → checkout_session permanece "active"

Verificação a cada minuto (cron):
  → checkout_session ativa há mais de 30min sem conversão
     → status muda para "abandoned"
     → cliente adicionado à lista "Cliente Potencial" no email marketing
     → estado interno muda para "inactive"

Checkout abandonado que converte depois (mesmo checkout):
  → status muda para "reverted" (revertido)
  → pedido real criado, estado interno removido

Checkout abandonado cujo cliente converte em OUTRO checkout:
  → status muda para "recovered" (recuperado)
```

### Fase 2 — Verificação de Pagamento (Sistema A)

**Fluxo 1 — Verificação Inicial (pós-pedido até status final)**

```text
Pedido criado (qualquer forma de pagamento)
  → Verificação ativa do status junto à operadora:

  Escala progressiva:
  ┌────────────────────────────────────────────────┐
  │ 0-60 min      → a cada 1 minuto               │
  │ 1h-48h        → a cada 1 hora                  │
  │ 48h-5 dias    → a cada 12 horas                │
  │ 5 dias+       → a cada 24 horas                │
  │ Até: prazo máximo da forma de pagamento         │
  │   (consultado automaticamente na operadora)     │
  └────────────────────────────────────────────────┘

  Status finais aceitos:
  → Aprovado     → payment_status = approved
  → Expirado     → payment_status = cancelled (+ status = payment_expired)
  → Cancelado    → payment_status = cancelled
  → Recusado     → payment_status = declined

  Se nenhum status final ao fim do prazo máximo:
  → payment_status = cancelled (+ status = payment_expired)
```

**Fluxo 2 — Monitoramento pós-venda (chargebacks)**

```text
Pedido com pagamento aprovado
  → Verificação diária do status por 60 dias

  Se chargeback detectado:
  → payment_status = chargeback_requested (NOVO)
  → Acompanhamento diário por mais 15 dias:
     → Chargeback recuperado → payment_status volta para approved
     → Chargeback perdido   → payment_status = refunded
```

**Novos status de pagamento necessários:**

| Status atual | Novos status |
|---|---|
| `awaiting_payment` | Mantido |
| `paid` / `approved` | Mantido |
| `declined` | Mantido |
| `cancelled` | Mantido |
| `refunded` | Mantido |
| — | `chargeback_requested` (NOVO) |

**Transições de pagamento atualizadas:**

| De | Para | Válido |
|----|------|--------|
| `awaiting_payment` | `paid`, `declined`, `cancelled` | Sim |
| `paid` | `refunded`, `chargeback_requested` | Sim |
| `chargeback_requested` | `paid` (recuperado), `refunded` (perdido) | Sim |
| `declined` | `awaiting_payment`, `cancelled` | Sim |
| `cancelled` | — | Final |
| `refunded` | — | Final |

**Observação sobre viabilidade tecnica:** Os intervalos que você definiu (1 min por 1h, depois 1h por 48h, etc.) são tecnicamente viáveis. O sistema usará um cron de 1 minuto que consulta uma tabela de controle (`payment_verification_schedule`) para decidir quais pedidos verificar naquele momento, com base no tempo desde a criação e no último check. A consulta do prazo máximo de pagamento será feita via API da operadora quando possível, com fallbacks conservadores (30 min para PIX, 3 dias para boleto, imediato para cartão).

### Fase 3 — Identificação de Clientes (Sistema B)

```text
Verificação a cada minuto no cadastro de pedidos:
  → Identifica pedido novo com pagamento aprovado
  → Busca cliente por email no módulo Clientes
     → Se NÃO existe:
        → Cria cadastro do cliente
        → Marca pedido com "1ª Venda"
        → Atribui tag "Cliente"
        → Adiciona na lista "Clientes" do email marketing
        → Recalcula métricas
     → Se JÁ existe:
        → Apenas recalcula métricas e atualiza dados
```

**Observação técnica:** A identificação de clientes novos será implementada como uma **combinação de trigger + cron de reconciliação**, seguindo a arquitetura padrão do sistema. O trigger dispara imediatamente quando `payment_status` muda para `approved`, garantindo resposta instantânea. O cron de 1 minuto serve apenas como fallback para casos onde o trigger falhar. Isso evita sobrecarga e garante confiabilidade.

---

## MUDANÇAS NOS STATUS DO MÓDULO CHECKOUTS ABANDONADOS

| Status | Antes | Depois |
|--------|-------|--------|
| `active` | Checkout em andamento | Checkout em andamento (estado interno ativo) |
| `abandoned` | Inatividade > 30min | Inatividade > 30min sem pedido real (estado interno → inativo) |
| `converted` | Pedido finalizado | Checkout converteu em pedido real diretamente |
| `recovered` | Abandonado que converteu | Cliente converteu em **outro** checkout |
| `reverted` | **Não existia** | **NOVO** — Mesmo checkout abandonado foi concluído e virou pedido real |

---

## NOVA LISTA DE EMAIL MARKETING: "CLIENTE POTENCIAL"

| Item | Valor |
|------|-------|
| Nome | `Cliente Potencial` |
| Tipo | Lista padrão do sistema |
| Critério de entrada | Checkout abandonado (status = abandoned) |
| Tag vinculada | `Cliente Potencial` (nova tag sistêmica) |
| Cor da tag | `#f97316` (laranja) |

---

## LIFECYCLE ATUALIZADO

```text
Lead → Subscriber → Cliente Potencial → Customer
                         |                    |
                   checkout abandonado    pedido real com pagamento aprovado
```

---

## DOCUMENTOS IMPACTADOS

### 1. `docs/especificacoes/ecommerce/pedidos.md`

| Seção | Mudança |
|-------|---------|
| 3.1.1 (Ghost Orders) | **Removida.** Ghost orders deixam de existir. Pedidos só são criados após retorno da operadora |
| 3.2 (Status de Pagamento) | Adicionar `chargeback_requested` |
| 4.2 (Transições de Pagamento) | Adicionar transições de/para `chargeback_requested` |
| 5.1 (Criação via Checkout) | Reescrever: pedido só criado após resposta do gateway |
| 7.1 (Expiração Automática) | Substituir pela verificação progressiva junto à operadora |
| **Nova seção 7.2** | Sistema de verificação de pagamento (escala progressiva + chargebacks) |
| 8.1 (Numeração) | Nota: numeração só consumida para pedidos reais |
| 8.3 (Estoque) | Ajustar: reserva só ocorre quando pedido real é criado (após gateway) |

### 2. `docs/especificacoes/crm/checkouts-abandonados.md`

| Seção | Mudança |
|-------|---------|
| Status da Sessão | Adicionar `reverted`, redefinir `recovered` |
| Fluxo de Abandono | Reescrever com estado interno (ativo/inativo) |
| Ghost Orders | **Seção removida** (conceito eliminado) |
| **Nova seção** | Integração com lista "Cliente Potencial" |
| **Nova seção** | Regra de conversão tardia (revertido) |
| Regras de Negócio | Adicionar regra de estado interno e timeout |

### 3. `docs/especificacoes/ecommerce/clientes.md`

| Seção | Mudança |
|-------|---------|
| 4.2 (Criação de Cliente) | Cliente só criado após pagamento aprovado (não no clique de "Finalizar") |
| 4.3 (Contrato Lead ≠ Customer) | Item 2 atualizado: Customer criado por pedido **aprovado** (não apenas "criado") |
| **Nova seção** | Conceito de "Cliente Potencial" no lifecycle |

---

## O QUE NÃO MUDA

- Lógica de `is_first_sale` (continua baseada em primeiro pedido aprovado por email)
- Triggers de tag "Cliente" (continuam disparando em pedido aprovado)
- Heartbeat do checkout (continua funcionando igual)
- Lógica de retry de pagamento (continua para pedidos reais)
- Webhooks das operadoras (continuam como fonte primária; a verificação ativa é complementar)

