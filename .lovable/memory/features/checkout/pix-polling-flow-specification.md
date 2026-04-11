# PIX Payment Polling — Especificação Técnica

**Versão:** 1.0.0  
**Data:** 2026-04-11  
**Componente:** `ThankYouContent.tsx`

## Visão Geral

Após a geração de um pagamento PIX, a página de Obrigado (Thank You) exibe os dados de pagamento (QR Code + código copia-e-cola) e inicia um polling automático para detectar a confirmação do pagamento em tempo real, sem necessidade de recarregamento manual.

## Comportamento

### Fluxo Principal
1. **Geração do PIX** → Checkout cria o pedido via Edge Function, recebe QR Code e código PIX.
2. **Redirecionamento** → Navega para `/obrigado?pedido=XXX`.
3. **Thank You carrega** → Busca dados reais do pedido via `get-order` Edge Function.
4. **Polling ativo** → Se `payment_status === 'pending'` e método é PIX, inicia polling a cada **5 segundos**.
5. **Detecção de pagamento** → Se `payment_status` muda para `approved` ou `paid`, o polling para e a UI transiciona para o estado de confirmação com animação.
6. **Timeout (10 minutos)** → Se o pagamento não for detectado em 10 minutos, o polling para silenciosamente. O sistema de webhooks/reconciliação padrão assume a responsabilidade.

### Estados Visuais

| Estado | Header | QR Code | Indicador |
|--------|--------|---------|-----------|
| **Aguardando** | Ícone Clock pulsando (amarelo) + "Aguardando pagamento PIX" | Visível com borda pulsante | "Verificando pagamento automaticamente..." com spinner |
| **Confirmado** | Ícone Check (verde) + "Pagamento PIX confirmado! 🎉" com animação zoom-in | Oculto, substituído por card verde de confirmação | Toast de sucesso |
| **Timeout** | Permanece no estado "Aguardando" sem spinner | QR Code continua visível | Indicador de polling removido |

### Parâmetros

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `PIX_POLL_INTERVAL` | 5.000ms (5s) | Intervalo entre verificações |
| `PIX_POLL_MAX_DURATION` | 600.000ms (10min) | Tempo máximo de polling |

### Cleanup
- O `setInterval` é limpo via `useEffect` cleanup quando:
  - Componente desmonta
  - Pagamento é confirmado
  - Timeout de 10 minutos é atingido
  - Condições de polling deixam de ser verdadeiras (ex: `payment_status` muda)

## Segurança
- O polling usa `refetch()` do `useOrderDetails` que chama a Edge Function `get-order` — não expõe dados sensíveis.
- Não há risco de sobrecarga: intervalo de 5s é conservador e o timeout de 10min limita o número máximo de requests a ~120.

## Fallback
- Após o timeout, o webhook do gateway (`pagarme-webhook`) continua sendo o mecanismo principal de confirmação.
- O polling é um complemento de UX, não substitui o pipeline de webhooks.

## Arquivos Impactados
- `src/components/storefront/ThankYouContent.tsx` — lógica de polling e estados visuais
