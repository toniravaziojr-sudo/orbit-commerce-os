# Especificação dos Campos de Cartão de Crédito no Checkout

**Atualizado:** 2026-04-11

## Campos e Comportamento

### 1. Número do Cartão (`card-number`)
- **Tipo:** text, classe `font-mono`
- **Formatação:** Remove não-dígitos, limita a 16 dígitos, agrupa de 4 em 4 com espaço (`XXXX XXXX XXXX XXXX`)
- **maxLength:** 19 (16 dígitos + 3 espaços)
- **Compatibilidade por bandeira:**
  - Visa, Mastercard, Elo, Hipercard: 16 dígitos → `XXXX XXXX XXXX XXXX` ✅
  - AMEX: 15 dígitos → `XXXX XXXX XXXX XXX` (cosmético; padrão AMEX é 4-6-5, mas funcional)
  - Diners: 14 dígitos → `XXXX XXXX XXXX XX` (cosmético; padrão Diners é 4-6-4, mas funcional)
  - JCB, Discover: 16 dígitos → padrão ✅

### 2. Nome no Cartão (`card-holder`)
- **Tipo:** text
- **Formatação:** `toUpperCase()` automático
- **Sem limite de caracteres** no input (validação no servidor)
- **Universal** para todas as bandeiras ✅

### 3. Validade (`card-expiry`)
- **Tipo:** text
- **Placeholder:** `MM/AA`
- **maxLength:** 5
- **Formatação (`formatExpiry`):** Remove não-dígitos, limita a 4 dígitos, insere `/` após o 2º dígito
- **Armazenamento:** Separado em `expMonth` e `expYear` no `CardData`
- **Visibilidade progressiva:** Reconstrói a string conforme digitação:
  - `"0"` → mostra `0`
  - `"01"` → mostra `01`
  - `"012"` → mostra `01/2`
  - `"0128"` → mostra `01/28`
- **Backspace funciona corretamente:** Remove dígito a dígito mantendo a formatação
- **Universal** para todas as bandeiras ✅

### 4. CVV (`card-cvv`)
- **Tipo:** password (segurança PII)
- **Classe:** `font-mono`
- **Formatação:** Remove não-dígitos, limita a 4 dígitos
- **maxLength:** 4
- **Compatibilidade:**
  - Visa, Mastercard, Elo, Hipercard, Diners, JCB, Discover: 3 dígitos ✅
  - AMEX: 4 dígitos (CID) ✅
  - O limite de 4 acomoda todas as bandeiras

## Bandeiras Suportadas (Detecção no Servidor)

A detecção da bandeira ocorre na edge function `billing-add-payment-method` via regex no número limpo:

| Bandeira | Prefixo | Dígitos |
|---|---|---|
| Visa | `4` | 16 |
| Mastercard | `51-55`, `22-27` | 16 |
| AMEX | `34`, `37` | 15 |
| Discover | `6011`, `65` | 16 |
| JCB | `2131`, `1800`, `35xxx` | 15-16 |
| Diners | `300-305`, `36`, `38` | 14 |
| Hipercard | `606282`, `3841` | 16 |
| Elo | `636368`, `438935`, `504175`, `451416`, `636297`, `5067`, `4576`, `4011` | 16 |

## Interface CardData

```typescript
interface CardData {
  number: string;      // Com espaços de formatação
  holderName: string;  // Sempre uppercase
  expMonth: string;    // "01" a "12"
  expYear: string;     // "25", "28", etc (2 dígitos)
  cvv: string;         // 3 ou 4 dígitos
}
```

## Sanitização ao Trocar Método

Ao trocar a forma de pagamento, todos os campos são limpos:
```typescript
setCardData({ number: '', holderName: '', expMonth: '', expYear: '', cvv: '' });
```

## Notas Importantes

- O número é enviado COM espaços ao servidor; a edge function faz `number.replace(/\D/g, '')` para limpar
- O agrupamento visual é sempre 4-4-4-X independente da bandeira (cosmético, sem impacto funcional)
- A validação de dados completos ocorre no servidor (edge function), não no cliente
