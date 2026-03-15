

# Correção: Valores de Pagamento e Diagnóstico de Falhas

## Diagnóstico Completo

Investigação dos dados reais do banco revelou **3 problemas concretos**:

### 1. Bug de exibição: valores multiplicados por 100
O campo `amount` na tabela `payment_transactions` é gravado **em centavos** (ex: `27298` = R$ 272,98). O componente `PaymentAttemptsCard` exibe sem dividir, mostrando "R$ 27.298,00" — valor assustador mas incorreto.

Mesmo problema para `paid_amount` (quando exibido).

### 2. Erro silencioso: `error_message` nunca é salvo
Nenhuma das 3 Edge Functions de cobrança (`pagarme-create-charge`, `mercadopago-create-charge`, `pagbank-create-charge`) grava o campo `error_message` na tabela `payment_transactions` quando o gateway rejeita. Resultado: na tela, o erro aparece como `null` — impossível diagnosticar a causa da falha sem ir direto ao gateway.

Evidência no banco — todas as 10 transações recentes têm `error_message: NULL`, mesmo as rejeitadas.

### 3. PIX com múltiplas falhas sem visibilidade
O pedido #37 (gilberto aquino) teve **5 tentativas de PIX em 1 minuto**, todas falharam. A causa provável é o CPF inválido (já corrigido com a validação módulo 11). Mas sem `error_message` salvo, era impossível diagnosticar isso pela interface.

## Análise de Segurança com Gateways

Verifiquei o fluxo completo `frontend → Edge Function → API do gateway`:

| Aspecto | Status | Detalhe |
|---------|--------|---------|
| Valor enviado ao gateway | OK | Frontend: `Math.round(total * 100)` → centavos corretos |
| CPF formatado | OK | `.replace(/\D/g, '')` remove máscara antes de enviar |
| Telefone formatado | OK | DDD + número separados corretamente |
| MercadoPago `transaction_amount` | OK | Converte centavos → BRL decimal (`/ 100`) |
| Pagar.me items.amount | OK | Centavos direto, sem conversão |
| PagBank items.unit_amount | OK | Centavos direto |
| Dados do cartão | OK | Enviados server-side, redacted nos logs |

**Nenhum dado divergente é enviado aos gateways.** As rejeições analisadas foram legítimas (saldo insuficiente, CPF inválido).

## Plano de Execução

### Arquivo 1: `src/components/orders/PaymentAttemptsCard.tsx`
- Linha 79: `formatCurrency(tx.amount)` → `formatCurrency(tx.amount / 100)`

### Arquivo 2: `supabase/functions/pagarme-create-charge/index.ts`
- Quando charge falha (bloco linhas 266-281), adicionar `error_message` ao `transactionData`:
  ```
  error_message: failureReason  (acquirer_message ou gateway error)
  ```

### Arquivo 3: `supabase/functions/mercadopago-create-charge/index.ts`
- Quando `internalStatus === 'failed'`, salvar `error_message` no insert:
  ```
  error_message: failureReasons[statusDetail] || statusDetail
  ```

### Arquivo 4: `supabase/functions/pagbank-create-charge/index.ts`
- Quando `status === 'failed'`, salvar `error_message` no insert com detalhes do PagBank.

### Total: 4 arquivos, correção cirúrgica em cada um.

