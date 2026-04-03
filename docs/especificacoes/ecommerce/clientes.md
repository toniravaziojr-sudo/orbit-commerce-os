# Módulo: Clientes (Admin)

> **Status:** ✅ Ativo  
> **Camada:** Layer 3 — Especificações / E-commerce  
> **Última atualização:** 2026-04-03  
> **Migrado de:** `docs/regras/clientes.md`

---

## 1. Visão Geral

CRM integrado ao e-commerce. Identidade do cliente baseada exclusivamente no **email** (normalizado), não no CPF ou auth.uid().

---

## 2. Arquitetura de Componentes

### 2.1 Páginas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Customers.tsx` | Lista com busca, filtros, tags e paginação |
| `src/pages/CustomerDetail.tsx` | Perfil completo com abas |
| `src/pages/CustomerNew.tsx` | Criação de novo cliente |

### 2.2 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `useCustomers.ts` | CRUD via coreCustomersApi |
| `useCustomerOrders.ts` | Pedidos do cliente (por email) |

### 2.3 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `core-customers` | API canônica: create, update, delete, addAddress, updateTags, addNote |
| `import-customers` | Importação em lote |
| `assign-tag-to-all-customers` | Atribuição de tag em massa |

---

## 3. Modelo de Dados

### 3.1 Tabela `customers`

```typescript
interface Customer {
  id: string;
  tenant_id: string;
  auth_user_id: string | null;
  
  // Identificação
  email: string;                 // ÚNICO por tenant (normalizado)
  full_name: string;
  cpf: string | null;            // Apenas fiscal
  phone: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | 'not_informed' | null;
  
  // Pessoa Jurídica
  person_type: 'pf' | 'pj' | null;
  cnpj: string | null;
  company_name: string | null;
  ie: string | null;
  
  // Status
  status: 'active' | 'inactive' | 'blocked' | null;
  
  // Marketing
  accepts_email_marketing: boolean | null;
  accepts_sms_marketing: boolean | null;
  accepts_whatsapp_marketing: boolean | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  
  // Métricas (via trigger recalc_customer_metrics)
  total_orders: number | null;
  total_spent: number | null;
  average_ticket: number | null;
  first_order_at: string | null;
  last_order_at: string | null;
  
  // Fidelidade (dinâmica por tenant — percentis)
  loyalty_points: number | null;
  loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
}
```

### 3.2 Tiers de Fidelidade

| Tier | Critério |
|------|----------|
| Bronze | Abaixo do percentil 50 |
| Silver | Percentil 50-75 |
| Gold | Percentil 75-90 |
| Platinum | Top 10% |

Calculado dinamicamente por `recalc_customer_metrics` por tenant.

### 3.3 Tabelas auxiliares

- `customer_addresses` — Múltiplos endereços com label e default
- `customer_tags` — Tags com cor, únicas por tenant
- `customer_tag_assignments` — Relação N:N
- `customer_notes` — Notas internas com autor

---

## 4. Fluxos de Negócio

### 4.1 Identidade por Email

```
Cliente identificado EXCLUSIVAMENTE por email (trim().toLowerCase())
CPF = opcional, apenas fiscal
auth.uid() NÃO vincula cliente
Mesmo email diferente = registros separados (MVP)
```

### 4.2 Contrato Lead ≠ Customer (CRÍTICO)

| Regra |
|-------|
| Lead NÃO cria customer automaticamente |
| Formulários/popups → `upsert_subscriber_only()` → só subscriber |
| Customer criado APENAS por: Checkout, Criação manual, Importação |

### 4.3 Tag "Cliente"

| Mecanismo | Quando |
|-----------|--------|
| `trg_auto_tag_cliente_on_payment` | Pedido aprovado |
| `core-customers` | Criação manual (via `ensure_customer_tag`) |
| `import-customers` | Importação |

### 4.4 Métricas Automáticas

| Campo | Cálculo |
|-------|---------|
| `total_orders` | COUNT(orders) onde payment_status='approved' e total>0 |
| `total_spent` | SUM(orders.total) dos aprovados |
| `average_ticket` | total_spent / total_orders |

> **⚠️** `total_orders` NÃO é usado para "1ª compra". A tarja usa `orders.is_first_sale`.

---

## 5. UI/UX

### 5.1 Lista

| Elemento | Comportamento |
|----------|---------------|
| Busca | Nome, email, telefone |
| Filtros | Status |
| Importação | CSV via motor canônico |
| Paginação | 50 por página |

### 5.2 Detalhes — Abas

| Aba | Conteúdo |
|-----|----------|
| Perfil | Dados cadastrais editáveis |
| Pedidos | Histórico de compras |
| Endereços | Gerenciamento |
| Notificações | Histórico de comunicações |

---

## 6. Importação

### 6.1 Mapeamento de Headers

| Campo | Headers aceitos |
|-------|----------------|
| email | `email`, `e-mail`, `email address` |
| full_name | `name`, `full_name`, `nome` |
| phone | `phone`, `telefone`, `celular` |
| cpf | `cpf`, `document`, `documento` |

### 6.2 Comportamento

- Emails duplicados ignorados
- Reimportação faz merge inteligente (preenche só campos vazios)
- Relatório ao final

---

## 7. Validações

| Campo | Regra |
|-------|-------|
| `email` | Obrigatório, formato válido, único por tenant |
| `full_name` | Obrigatório, min 2 chars |
| `cpf` | Opcional, formato válido se informado |

---

## 8. Exclusão

- Com pedidos: soft delete (`status = 'inactive'`)
- `coreCustomersApi.checkDependencies` verifica vínculos

---

## 9. Integração com Outros Módulos

| Módulo | Integração |
|--------|------------|
| Pedidos | Vínculo por `customer_email` |
| Checkout | Auto-criação de cliente |
| Email Marketing | Segmentação por tags |
| Suporte | Painel de informações |
| Descontos | Cupons de primeira compra |

---

## 10. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/customers` | `ecommerce` | `customers` |
| `/customers/:id` | `ecommerce` | `customers` |

---

## 11. Pendências

- [ ] Merge de clientes duplicados
- [ ] Histórico de alterações do perfil
- [ ] Validação de telefone (SMS)
- [ ] Integração com fidelidade externos

---

*Fim do documento.*
