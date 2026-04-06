# Teste E2E — Fluxo NF-e → Remessa → Despacho

> **Data:** 2026-04-06  
> **Versão:** v2.4.0 (nfe-shipment-link)  
> **Status:** Teste simulado (sem APIs externas reais)

---

## Objetivo

Validar o fluxo completo pós-pagamento: criação automática de rascunhos fiscal/logístico, emissão da NF-e, vínculo com a remessa e disponibilidade de impressão.

---

## Dados de Teste

| Item | Valor |
|------|-------|
| Tenant | `38c8a488-01da-4f4c-8ae7-238c1e56b0e1` |
| Produto | "Produto Teste Fluxo E2E", R$ 49,90, 500g, 15×10×20cm |
| Cliente | "Cliente Teste E2E", CPF 12345678901 |
| Pedido | TEST-E2E-001, total R$ 59,90 (produto + frete R$ 10,00) |
| Transportadora | Correios (PAC) |

---

## Resultados por Etapa

### 1. Trigger de Pagamento Aprovado ✅
- `UPDATE orders SET payment_status = 'approved'` disparou trigger `trg_enqueue_fiscal_draft`
- `fiscal_draft_queue`: item criado com status `pending` → processado como `done`
- `shipping_draft_queue`: item criado com provider `correios` → processado como `done`
- **Tempo:** < 3 segundos do insert na fila ao processamento

### 2. Rascunho Logístico (Shipment Draft) ✅
- Shipment criado com `delivery_status = 'draft'`
- Metadata correta: `weight_grams: 500`, `height_cm: 10`, `width_cm: 15`, `length_cm: 20`
- Carrier: `correios`, recipient_name e recipient_zip preenchidos

### 3. Rascunho Fiscal (Fiscal Invoice Draft) ⚠️ → ✅ (após correção)
- **Primeira tentativa:** Queue marcada como `done` mas NÃO criou fiscal_invoice
- **Causa:** `fiscal_settings` não existia para o tenant → function saiu silenciosamente
- **Correção:** Após criar fiscal_settings com `is_configured = true`, resetou a queue e reprocessou com sucesso
- Invoice criada: numero=1, serie=1, dest_cpf_cnpj correto, valores corretos

### 4. Vínculo NF-e → Shipment ✅ (simulado manualmente)
- Após simular autorização da NF-e (status `authorized`, chave_acesso preenchida)
- Shipment atualizado com `nfe_key` e `invoice_id` corretos
- Pedido atualizado para `status = 'processing'`

### 5. Emissão de Remessa (shipping-create-shipment) 🐛 BUGS ENCONTRADOS
- Não foi possível testar via chamada real — ver bugs abaixo

---

## Bugs Encontrados

### BUG 1 — CRÍTICO: `shipping-create-shipment` incompatível com chamada interna (auto_create_shipment)

**Descrição:** Quando `nfe-shipment-link.ts` chama `shipping-create-shipment` com `Authorization: Bearer SERVICE_ROLE_KEY`, a function tenta `auth.getUser()` que retorna `null` (service_role não é um user JWT). Resultado: retorna 401.

**Impacto:** O modo `auto_create_shipment = true` (criação automática de remessa após autorização da NF-e) nunca funcionará.

**Correção sugerida:** 
- Opção A: Detectar chamada via service_role e extrair `tenant_id` do body em vez de `profiles`
- Opção B: Passar `tenant_id` no body e permitir bypass de auth para chamadas internas

### BUG 2 — MÉDIO: `order_history` INSERT com colunas erradas

**Descrição:** `shipping-create-shipment` (linha ~738) tenta inserir em `order_history` com colunas `status` e `notes`, mas a tabela real usa `action` e `description`.

**Impacto:** O registro de histórico do pedido falhará silenciosamente ao criar uma remessa.

**Correção:** Mapear: `status` → `action`, `notes` → `description`.

### BUG 3 — BAIXO: Fila fiscal marcada como `done` sem fiscal_settings

**Descrição:** Quando `fiscal_settings` não está configurado (`is_configured = false` ou inexistente), a function `fiscal-auto-create-drafts` retorna `{ created: 0, errors: [] }` — e o scheduler marca como `done` porque `result.ok` é true.

**Impacto:** Se o usuário ainda não configurou o módulo fiscal, a fila é consumida sem criar o rascunho e NUNCA será reprocessada. Quando o usuário configurar o fiscal depois, precisará emitir manualmente.

**Correção sugerida:** Retornar `{ success: false, error: 'Fiscal not configured' }` com status 422, para que a queue volte para `pending` e seja reprocessada quando as configurações existirem. Ou pelo menos não marcar como `done`.

---

## Estado Final Validado

| Componente | Estado | Resultado |
|-----------|--------|-----------|
| Trigger SQL | ✅ Funcional | Cria ambos os itens nas filas atomicamente |
| shipping_draft_queue | ✅ Funcional | Processada pelo scheduler, shipment draft criado |
| fiscal_draft_queue | ⚠️ Funcional (com pré-requisito) | Requer fiscal_settings configurado |
| Shipment draft (metadata) | ✅ Correto | Peso, dimensões, carrier, destinatário OK |
| Fiscal invoice draft | ✅ Correto | Número, série, dest, valores OK |
| Vínculo NF-e → Shipment | ✅ Lógica correta | nfe-shipment-link.ts funciona conforme esperado |
| Emissão de remessa automática | 🐛 Não funcional | Bug de autenticação impede chamada interna |
| Registro de histórico | 🐛 Colunas erradas | order_history usa action/description, não status/notes |

---

## Dados de Teste — Limpeza

Todos os dados de teste foram removidos após o teste:
- Produto, Cliente, Pedido, Order Items
- Fiscal Invoice, Fiscal Draft Queue, Shipping Draft Queue
- Shipment
- Fiscal Settings (criado só para teste)

---

## Próximos Passos

1. **Corrigir BUG 1** — Permitir chamada interna via service_role no shipping-create-shipment
2. **Corrigir BUG 2** — Mapear colunas corretas em order_history
3. **Corrigir BUG 3** — Não consumir fila fiscal quando fiscal_settings não está configurado
4. Testar com credenciais reais de transportadora (Correios/Loggi)
5. Testar impressão de etiqueta e DANFE via UI
