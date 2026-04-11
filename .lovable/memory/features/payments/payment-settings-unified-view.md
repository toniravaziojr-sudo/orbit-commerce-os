# Configurações de Pagamento — Visão Unificada

**Versão:** 1.0.0  
**Data:** 2026-04-11  
**Componente:** `PaymentSettingsTab.tsx`

## Visão Geral

A tela **Sistema > Configurações > Pagamentos** apresenta uma visão unificada onde o tenant configura, para cada forma de pagamento padrão (PIX, Cartão, Boleto), qual provedor conectado será o responsável pelo processamento transparente.

## Estrutura da UI

### Cards por Método (PIX, Cartão, Boleto)
Cada card contém:
1. **Toggle de ativação** — Habilita/desabilita o método no checkout.
2. **Dropdown de provedor** — Lista apenas provedores ativos em Integrações. O tenant escolhe qual provedor processa aquele método.
3. **Desconto por método** — Tipo (percentual/fixo) e valor de desconto para incentivo.
4. **Parcelas** (apenas Cartão) — Configuração de parcelas máximas e parcela mínima.

### Seção Mercado Pago Redirect
- Toggle para ativar o checkout externo do MP como 4ª opção no checkout.
- Só aparece se o tenant tem Mercado Pago ativo em Integrações.
- Independente dos 3 métodos acima.

### Alerta de Configuração
- Se nenhum provedor está conectado, exibe alerta com link para Integrações.

## Persistência

- **Mapeamento método→provedor**: Tabela `payment_method_gateway_map` via `usePaymentGatewayMap`.
- **Descontos por método**: Tabela `payment_method_discounts` via `usePaymentMethodDiscounts`.
- **Flag redirect**: Campo `mp_redirect_enabled` na tabela `payment_providers`.

## Provedores no Dropdown

O dropdown lista apenas provedores com `is_enabled = true` na tabela `payment_providers`. Labels mapeados:
- `pagarme` → "Pagar.me"
- `mercado_pago` / `mercadopago` → "Mercado Pago"
- `pagbank` → "PagBank"

## Arquivo

- `src/components/system-settings/PaymentSettingsTab.tsx`
