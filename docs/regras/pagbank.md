# PagBank (PagSeguro) — Regras e Especificações

> **Status:** ✅ Ready

## Visão Geral

Integração com PagBank (anteriormente PagSeguro) para processamento de pagamentos via PIX, Boleto e Cartão de Crédito (com parcelamento).

**Nota:** PagSeguro e PagBank são a mesma empresa/produto. Os endpoints ainda usam domínio `pagseguro` mas a marca oficial é PagBank.

---

## Credenciais

### Como Obter

1. Acesse o [PagBank Developers](https://dev.pagbank.uol.com.br/)
2. Crie uma conta (sandbox ou produção)
3. Gere o **Token** de autenticação
4. Copie o **Email** da conta

### Ambientes

| Ambiente | API Base URL |
|----------|--------------|
| Sandbox | `https://sandbox.api.pagseguro.com` |
| Produção | `https://api.pagseguro.com` |

### Armazenamento

As credenciais são salvas na tabela `payment_providers`:

```sql
-- Estrutura
{
  tenant_id: uuid,
  provider: 'pagbank',
  environment: 'sandbox' | 'production',
  credentials: {
    token: string,    -- Token de autenticação
    email: string,    -- Email da conta
  },
  is_enabled: boolean,
}
```

---

## Edge Functions

| Function | Descrição |
|----------|-----------|
| `pagbank-create-charge` | Criação de pedido/cobrança |
| `pagbank-webhook` | Recebimento de notificações |
| `pagbank-refund` | Cancelamento/estorno |

---

## API de Pedidos (Orders)

### Criar Pedido

**Endpoint:** `POST /orders`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
x-idempotency-key: {reference_id}
```

### Estrutura do Payload

```typescript
{
  reference_id: string,           // ID interno (idempotência)
  customer: {
    name: string,
    email: string,
    tax_id: string,               // CPF (apenas números)
    phones: [{
      country: '55',
      area: string,               // DDD
      number: string,             // Número
      type: 'MOBILE',
    }],
  },
  items: [{
    reference_id: string,
    name: string,
    quantity: number,
    unit_amount: number,          // Valor em centavos
  }],
  notification_urls: [string],    // URLs de webhook
  
  // Para PIX
  qr_codes?: [{
    amount: { value: number },
    expiration_date: string,      // ISO 8601
  }],
  
  // Para Boleto ou Cartão
  charges?: [{
    reference_id: string,
    description: string,
    amount: { value: number, currency: 'BRL' },
    payment_method: {
      type: 'BOLETO' | 'CREDIT_CARD',
      // Campos específicos por método
    },
  }],
}
```

---

## Métodos de Pagamento

### PIX

```typescript
qr_codes: [{
  amount: { value: 10000 },  // R$ 100,00
  expiration_date: '2024-12-31T23:59:59-03:00',
}]
```

**Resposta inclui:**
- `qr_codes[0].text` - Código PIX copia/cola
- `qr_codes[0].links[media='image/png'].href` - URL da imagem QR Code

### Boleto

```typescript
charges: [{
  payment_method: {
    type: 'BOLETO',
    boleto: {
      due_date: '2024-12-31',
      instruction_lines: {
        line_1: 'Não receber após vencimento',
        line_2: 'Pedido #1234',
      },
      holder: {
        name: string,
        tax_id: string,
        email: string,
        address: {
          street: string,
          number: string,
          locality: string,
          city: string,
          region_code: string,  // UF
          country: 'BRA',
          postal_code: string,
        },
      },
    },
  },
}]
```

**Resposta inclui:**
- `charges[0].payment_method.boleto.barcode` - Código de barras
- `charges[0].links[rel='SELF'].href` - URL do boleto

### Cartão de Crédito

```typescript
charges: [{
  payment_method: {
    type: 'CREDIT_CARD',
    installments: 1,           // Número de parcelas
    capture: true,             // Captura automática
    card: {
      // Dados do cartão (não tokenizado)
      number: string,
      exp_month: string,       // '01' a '12'
      exp_year: string,        // '2025'
      security_code: string,
      holder: { name: string },
      
      // OU cartão tokenizado
      encrypted: string,       // Dados criptografados
    },
  },
}]
```

---

## Webhooks

### URL de Notificação

```
https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/pagbank-webhook
```

### Eventos Processados

| Status PagBank | Status Interno |
|----------------|----------------|
| `AUTHORIZED` | `pending` |
| `PAID` | `paid` |
| `IN_ANALYSIS` | `pending` |
| `DECLINED` | `failed` |
| `CANCELED` | `cancelled` |
| `WAITING` | `pending` |

### PIX Status (QR Codes)

| Status PagBank | Status Interno |
|----------------|----------------|
| `ACTIVE` | `pending` |
| `PAID` | `paid` |
| `EXPIRED` | `expired` |

---

## Estorno/Cancelamento

**Endpoint:** `POST /charges/{charge_id}/cancel`

```typescript
{
  amount: {
    value: number  // Valor em centavos (parcial ou total)
  }
}
```

**Regras:**
- Estorno total: valor = valor original
- Estorno parcial: valor < valor original
- Requer `charge_id` (obtido na criação do pagamento)

---

## Mapeamento de Status

### PagBank → Comando Central

| PagBank Charge | Comando Central | Descrição |
|----------------|-----------------|-----------|
| `AUTHORIZED` | `pending` | Autorizado, aguardando captura |
| `PAID` | `paid` | Pagamento confirmado |
| `IN_ANALYSIS` | `pending` | Em análise de fraude |
| `DECLINED` | `failed` | Recusado |
| `CANCELED` | `cancelled` | Cancelado |

---

## Validações

### Antes de Emitir Cobrança

- [ ] Credenciais configuradas no tenant
- [ ] CPF válido (11 dígitos)
- [ ] Email válido
- [ ] Valor > 0 (mínimo R$ 1,00 para boleto)
- [ ] Para cartão: dados completos ou token

### Idempotência

- Usar `reference_id` único por pedido
- Header `x-idempotency-key` obrigatório

---

## Testes (Sandbox)

### Cartões de Teste

| Cenário | Número |
|---------|--------|
| Aprovado | `4111111111111111` |
| Recusado | `5155901222280001` |

### Simulação de PIX

- QR Code gerado é válido apenas em sandbox
- Use simulador do PagBank para marcar como pago

---

## Checklist de Homologação

- [ ] Criar pedido PIX e receber QR Code
- [ ] Webhook atualiza status quando PIX é pago
- [ ] Criar pedido Boleto e receber código de barras
- [ ] Webhook atualiza status quando Boleto é pago
- [ ] Criar pedido Cartão e processar
- [ ] Parcelamento funciona corretamente
- [ ] Estorno total funciona
- [ ] Estorno parcial funciona

---

## Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `src/components/payments/PaymentGatewaySettings.tsx` | UI de configuração |
| `src/hooks/usePaymentProviders.ts` | Hook de credenciais |
| `supabase/functions/pagbank-create-charge/` | Criação de cobrança |
| `supabase/functions/pagbank-webhook/` | Recebimento de webhooks |
| `supabase/functions/pagbank-refund/` | Estorno/cancelamento |

---

## Referências

- [PagBank Developers](https://dev.pagbank.uol.com.br/)
- [API de Pedidos (Orders)](https://dev.pagbank.uol.com.br/reference/criar-um-pedido)
- [Webhooks](https://dev.pagbank.uol.com.br/reference/notificacoes)
- [Cancelamento](https://dev.pagbank.uol.com.br/reference/cancelar-cobranca)
