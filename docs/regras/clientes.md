# Módulo: Clientes (Admin)

> **Status**: ✅ Funcional e Protegido  
> **Última atualização**: 2026-04-01

---

## 1. Visão Geral

O módulo de Clientes é um CRM integrado ao e-commerce, permitindo gerenciar a base de clientes com segmentação por tags, múltiplos endereços, histórico de compras e notas internas. A identidade do cliente é baseada exclusivamente no **email** (normalizado), não no CPF ou auth.uid().

---

## 2. Arquitetura de Componentes

### 2.1 Páginas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Customers.tsx` | Lista de clientes com busca, filtros, tags e paginação |
| `src/pages/CustomerDetail.tsx` | Perfil completo do cliente com abas |
| `src/pages/CustomerNew.tsx` | Criação de novo cliente |

### 2.2 Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/customers/CustomerList.tsx` | Tabela de clientes com status, tier e ações |
| `src/components/customers/CustomerForm.tsx` | Formulário completo de criação/edição |
| `src/components/customers/CustomerAddressForm.tsx` | Formulário de endereço |
| `src/components/customers/CustomerTagsManager.tsx` | Gerenciador de tags (CRUD) |
| `src/components/customers/CustomerImport.tsx` | Importação em lote (CSV) |
| `src/components/customers/CustomerInfoPanel.tsx` | Painel resumo (usado no suporte) |

### 2.3 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/useCustomers.ts` | CRUD de clientes via coreCustomersApi |
| `src/hooks/useCustomerOrders.ts` | Pedidos do cliente (por email) |

### 2.4 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `core-customers` | API canônica: create, update, delete, addAddress, updateTags, addNote |
| `import-customers` | Importação em lote de clientes |
| `assign-tag-to-all-customers` | Atribuição de tag em massa |

---

## 3. Modelo de Dados

### 3.1 Tabela `customers`

```typescript
interface Customer {
  id: string;                    // UUID PK
  tenant_id: string;             // FK → tenants
  auth_user_id: string | null;   // FK → auth.users (se tiver conta)
  
  // === Identificação ===
  email: string;                 // ÚNICO por tenant (normalizado)
  full_name: string;
  cpf: string | null;            // Opcional, apenas fiscal
  phone: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | 'not_informed' | null;
  
  // === Pessoa Jurídica ===
  person_type: 'pf' | 'pj' | null;
  cnpj: string | null;
  company_name: string | null;
  ie: string | null;             // Inscrição Estadual
  state_registration_is_exempt: boolean | null;
  rg: string | null;
  
  // === Status ===
  status: 'active' | 'inactive' | 'blocked' | null;
  email_verified: boolean | null;
  phone_verified: boolean | null;
  
  // === Marketing ===
  accepts_marketing: boolean | null;  // Legacy, geral
  accepts_email_marketing: boolean | null;
  accepts_sms_marketing: boolean | null;
  accepts_whatsapp_marketing: boolean | null;
  unsubscribed_at: string | null;
  bounced_at: string | null;
  
  // === Métricas (calculadas via trigger recalc_customer_metrics) ===
  total_orders: number | null;     // Recalculado automaticamente com base em pedidos aprovados (payment_status='approved', total>0)
  total_spent: number | null;      // Soma dos totais dos pedidos aprovados
  average_ticket: number | null;   // total_spent / total_orders
  first_order_at: string | null;   // Data do primeiro pedido aprovado
  last_order_at: string | null;    // Data do último pedido aprovado
  // NOTA: A tarja "1ª compra" NÃO usa total_orders. Usa orders.is_first_sale (flag imutável).
  
  // === Fidelidade (calculada automaticamente pelo trigger) ===
  loyalty_points: number | null;
  loyalty_tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  // Progressão automática de tier:
  //   Bronze: padrão
  //   Prata: 5+ pedidos OU R$1.000+ gastos
  //   Ouro: 15+ pedidos OU R$5.000+ gastos
  //   Platina: 30+ pedidos OU R$15.000+ gastos
  
  // === Origem ===
  last_source_platform: string | null;
  last_external_id: string | null;
  
  // === Notas ===
  notes: string | null;          // Campo de texto livre
  
  created_at: string;
  updated_at: string;
}
```

### 3.2 Tabela `customer_addresses`

```typescript
interface CustomerAddress {
  id: string;
  customer_id: string;           // FK → customers
  label: string;                 // Ex: "Casa", "Trabalho"
  is_default: boolean;
  recipient_name: string;
  recipient_cpf: string | null;
  recipient_phone: string | null;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;                 // 2 caracteres (UF)
  postal_code: string;
  country: string;               // Default: "BR"
  reference: string | null;      // Ponto de referência
  ibge_code: string | null;
  address_type: 'residential' | 'commercial' | 'other' | null;
  created_at: string;
  updated_at: string;
}
```

### 3.3 Tabela `customer_tags`

```typescript
interface CustomerTag {
  id: string;
  tenant_id: string;
  name: string;                  // Único por tenant
  color: string;                 // Hex color
  description: string | null;
  created_at: string;
}
```

### 3.4 Tabela `customer_tag_assignments`

```typescript
interface CustomerTagAssignment {
  id: string;
  customer_id: string;
  tag_id: string;
  created_at: string;
}
```

### 3.5 Tabela `customer_notes`

```typescript
interface CustomerNote {
  id: string;
  customer_id: string;
  author_id: string;             // Quem escreveu
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}
```

---

## 4. Fluxos de Negócio

### 4.1 Identidade por Email

```
REGRA FUNDAMENTAL:
- Cliente é identificado EXCLUSIVAMENTE por email (normalizado: trim().toLowerCase())
- CPF é opcional e usado APENAS para fins fiscais
- auth.uid() não é usado para vincular cliente
- Pedidos persistem com orders.customer_email
- Mesmo cliente com emails diferentes = registros separados (esperado no MVP)
```

### 4.2 Criação de Cliente

```mermaid
graph TD
    A[Admin ou Checkout] --> B[Normaliza email]
    B --> C{Email já existe?}
    C -->|Sim| D[Retorna erro DUPLICATE_EMAIL]
    C -->|Não| E[coreCustomersApi.create]
    E --> F[Cria registro]
    F --> G[ensure_customer_tag → tag 'Cliente']
    G --> H[Invalida cache]
```

> **✅ Regra (01/04/2026):** A criação manual de clientes via `core-customers` atribui automaticamente a tag sistêmica "Cliente" usando `ensure_customer_tag`, sem depender de listas de email marketing.

### 4.3 Contrato Lead ≠ Customer (CRÍTICO)

```
REGRAS FUNDAMENTAIS:
1. Lead NÃO cria customer automaticamente
   - Formulários, popups, chat usam upsert_subscriber_only() → só cria subscriber
   - Se já existir customer com mesmo email, vincula (customer_id no subscriber)
   - Se NÃO existir customer → NÃO cria

2. Customer é criado APENAS por:
   - Checkout (pedido criado)
   - Criação manual (admin)
   - Importação (CSV)

3. Tag "Cliente" é atribuída por:
   - trg_auto_tag_cliente_on_payment → pedido aprovado (trigger direto, sem depender de lista)
   - core-customers → criação manual (via ensure_customer_tag)
   - import-customers → importação (via customer_tag_assignments direto)

4. Customer sem email:
   - É customer válido (tags, métricas funcionam via customer_id)
   - NÃO cria subscriber/list_member (email obrigatório para marketing)
   - Trigger `trg_recalc_customer_on_order` registra evento auditável via `log_marketing_sync_audit` com status=skipped, reason=missing_email
   - Evento consultável na tabela `email_marketing_sync_audit`
```

### 4.4 Funções de Banco — Contrato de Responsabilidades

| Função | Responsabilidade | O que NÃO faz |
|--------|-----------------|---------------|
| `upsert_subscriber_only` | Cria/atualiza subscriber, adiciona em lista, vincula a customer existente | NÃO cria customer |
| ~~`sync_subscriber_to_customer_with_tag`~~ | [REMOVIDO em 01/04/2026] Função legada eliminada do banco | — |
| `ensure_customer_tag` | Atribui tag sistêmica a customer por ID | NÃO cria customer nem subscriber |
| `recalc_customer_metrics` | Recalcula métricas de compra | NÃO atribui tags |
| `auto_tag_cliente_on_payment_approved` | Atribui tag "Cliente" quando pagamento aprovado | NÃO depende de lista de marketing |

### 4.5 Triggers Ativos na Tabela `orders`

| Trigger | Função | Quando dispara | O que faz |
|---------|--------|----------------|-----------|
| `trg_auto_tag_cliente_on_payment` | `auto_tag_cliente_on_payment_approved()` | INSERT/UPDATE de payment_status | Se `approved`: atribui tag "Cliente" via customer_id (sem lista) |
| `trg_recalc_customer_metrics_on_order` | `trg_recalc_customer_on_order()` | INSERT/UPDATE | Se `approved`: recalcula métricas + sincroniza subscriber (sem criar customer) |

> **⚠️ Trigger removido (01/04/2026):** `trigger_update_customer_first_order` foi removido por inflacionar `total_orders` em todo INSERT independente de status de pagamento. `recalc_customer_metrics` é a fonte canônica de métricas.

### 4.6 Nomes Canônicos

| Conceito | Nome no banco | Chave de busca |
|----------|--------------|----------------|
| Tag sistêmica | `Cliente` (singular) | `customer_tags.name = 'Cliente'` |
| Lista de marketing | `Clientes` (plural) | `email_marketing_lists.tag_id` → tag "Cliente" |

### 4.7 Métricas Automáticas

As métricas do cliente são atualizadas automaticamente após cada pedido:

| Campo | Cálculo |
|-------|---------|
| `total_orders` | COUNT(orders) onde payment_status='approved' e total>0 |
| `total_spent` | SUM(orders.total) dos pedidos aprovados |
| `average_ticket` | total_spent / total_orders |
| `first_order_at` | MIN(orders.created_at) dos aprovados |
| `last_order_at` | MAX(orders.created_at) dos aprovados |

> **⚠️ IMPORTANTE:** `total_orders` NÃO é usado para determinar "1ª compra". A tarja usa exclusivamente `orders.is_first_sale` (flag imutável gravado no momento da criação do pedido).

### 4.8 Tiers de Fidelidade (Progressão Automática)

| Tier | Critério |
|------|----------|
| Bronze | Padrão inicial |
| Silver | 5+ pedidos OU R$1.000+ gastos |
| Gold | 15+ pedidos OU R$5.000+ gastos |
| Platinum | 30+ pedidos OU R$15.000+ gastos |

> **✅ Implementado**: A progressão é calculada automaticamente pelo trigger `trg_recalc_customer_metrics_on_order` sempre que um pedido é aprovado.

---

## 5. UI/UX

### 5.1 Lista de Clientes

| Elemento | Comportamento |
|----------|---------------|
| Busca | Por nome, email, telefone |
| Filtros | Status (ativo, inativo, bloqueado) |
| Tags | Botão para gerenciar tags |
| Estatísticas | Total de clientes, novos no mês |
| Importação | Upload de CSV |
| Ações | Ver, Editar, Excluir |
| Paginação | 50 por página |

### 5.2 Detalhes do Cliente

| Seção | Conteúdo |
|-------|----------|
| **Cabeçalho** | Avatar, nome, badges (status, tier) |
| **Dados Pessoais** | Email, telefone, CPF, nascimento |
| **Empresa** | CNPJ, razão social, IE (se PJ) |
| **Métricas** | Pedidos, total gasto, ticket médio |
| **Endereços** | Lista com ações (editar, excluir, definir padrão) |
| **Tags** | Tags atribuídas, adicionar/remover |
| **Notas** | Notas internas com autor e data |
| **Histórico** | Lista de pedidos recentes |

### 5.3 Abas na Página de Detalhe

| Aba | Conteúdo |
|-----|----------|
| **Perfil** | Dados cadastrais editáveis |
| **Pedidos** | Histórico de compras |
| **Endereços** | Gerenciamento de endereços |
| **Notificações** | Histórico de comunicações |

---

## 6. Segmentação com Tags

### 6.1 Uso de Tags

- Organização de clientes em grupos
- Filtro em campanhas de email marketing
- Regras de desconto por segmento
- Atendimento personalizado

### 6.2 Cores Disponíveis

```typescript
const colorOptions = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];
```

---

## 7. Importação de Clientes

### 7.1 Formato CSV (Universal)

O importador aceita CSVs de qualquer plataforma (Shopify, WooCommerce, Nuvemshop, Tray, genérico). Os headers são mapeados automaticamente.

### 7.2 Mapeamento de Headers

| Campo do sistema | Headers aceitos |
|------------------|----------------|
| email | `email`, `e-mail`, `email address`, `customer email` |
| full_name | `name`, `full_name`, `nome`, `nome completo`, `First Name + Last Name` |
| phone | `phone`, `telefone`, `celular`, `mobile`, `whatsapp` |
| cpf | `cpf`, `document`, `documento`, `tax id` |
| status | `status`, `state` (default: active) |
| accepts_marketing | `accepts_marketing`, `marketing`, `aceita marketing` |
| birth_date | `birth_date`, `birthday`, `data_nascimento`, `nascimento` |
| gender | `gender`, `sexo`, `gênero` |

### 7.3 Comportamento

- Emails duplicados no mesmo arquivo são ignorados
- Reimportação de cliente existente faz merge inteligente: preenche apenas campos vazios ou nulos
- Dados já existentes nunca são sobrescritos por valores vazios ou nulos do arquivo
- Diferenças de maiúsculas/minúsculas no email são tratadas como o mesmo cliente
- Endereços só são preenchidos quando o cliente ainda não possui endereço salvo
- Clientes importados continuam sendo adicionados como subscribers na lista de email marketing
- Relatório ao final com importados/atualizados/ignorados/erros
- Suporta separadores `,` e `;`

---

## 8. Integração com Outros Módulos

| Módulo | Integração |
|--------|------------|
| **Pedidos** | Vínculo por `customer_email` |
| **Checkout** | Auto-criação de cliente se não existe |
| **Email Marketing** | Segmentação por tags e consentimento |
| **Suporte** | Painel de informações do cliente |
| **Descontos** | Cupons de primeira compra |
| **Notificações** | Comunicações transacionais |

---

## 9. Consentimentos de Marketing

| Campo | Uso |
|-------|-----|
| `accepts_marketing` | Consentimento geral (legacy) |
| `accepts_email_marketing` | Específico para email |
| `accepts_sms_marketing` | Específico para SMS |
| `accepts_whatsapp_marketing` | Específico para WhatsApp |
| `unsubscribed_at` | Data de opt-out |
| `bounced_at` | Data de bounce de email |

---

## 10. Regras de Negócio

### 10.1 Validações

| Campo | Regra |
|-------|-------|
| `email` | Obrigatório, formato válido, único por tenant |
| `full_name` | Obrigatório, min 2 caracteres |
| `cpf` | Opcional, formato válido se informado |
| `phone` | Opcional, formato válido se informado |

### 10.2 Exclusão

- Clientes com pedidos: soft delete (`status = 'inactive'`)
- `coreCustomersApi.checkDependencies` verifica vínculos
- Dependências verificadas: pedidos, conversas, endereços, notas, tags

---

## 11. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/customers` | `ecommerce` | `customers` |
| `/customers/:id` | `ecommerce` | `customers` |
| `/customers/new` | `ecommerce` | `customers` |

---

## 12. Arquivos Relacionados

- `src/pages/Customers.tsx`
- `src/pages/CustomerDetail.tsx`
- `src/components/customers/*`
- `src/hooks/useCustomers.ts`
- `src/hooks/useCustomerOrders.ts`
- `src/lib/coreApi.ts` (coreCustomersApi)
- `src/lib/normalizeEmail.ts`
- `supabase/functions/core-customers/`
- `supabase/functions/import-customers/`

---

## 13. Componentes de Data Padronizados

| Campo | Componente | Tela |
|-------|------------|------|
| `birth_date` | `DatePickerField` | CustomerForm, CustomerDetail |

> Ver `regras-gerais.md` § Padrão de Datas para especificação completa.

---

## 14. Pendências

- [x] ~~Exportação de clientes (CSV)~~ — Implementado em 01/04/2026
- [x] ~~Progressão automática de tier~~ — Implementado em 01/04/2026
- [x] ~~Métricas recalculadas com base em pedidos reais~~ — Implementado em 01/04/2026
- [x] ~~Importação universal (multi-plataforma)~~ — Implementado em 01/04/2026
- [x] ~~Sync automático com email marketing~~ — Implementado em 01/04/2026
- [x] ~~Auditoria de skip para customer sem email~~ — Implementado em 01/04/2026 (tabela `email_marketing_sync_audit`)
- [ ] Merge de clientes duplicados
- [ ] Histórico de alterações do perfil
- [ ] Validação de telefone (SMS)
- [ ] Integração com sistemas de fidelidade externos
