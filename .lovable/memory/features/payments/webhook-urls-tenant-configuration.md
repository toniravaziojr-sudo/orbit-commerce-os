# Webhook URLs — Configuração pelo Tenant

**Versão:** 1.0.0  
**Data:** 2026-04-11  
**Componente:** `PaymentGatewaySettings.tsx`

## Visão Geral

Cada provedor de pagamento requer que o tenant configure uma URL de webhook no painel externo do provedor para receber notificações de pagamento (aprovações, estornos, disputas). O sistema exibe essa URL de forma visível e copiável na tela de Integrações.

## URLs por Provedor

| Provedor | URL | Edge Function |
|----------|-----|---------------|
| Pagar.me | `https://{SUPABASE_URL}/functions/v1/pagarme-webhook` | `pagarme-webhook` |
| Mercado Pago | `https://{SUPABASE_URL}/functions/v1/mercadopago-storefront-webhook` | `mercadopago-storefront-webhook` |

## Onde Aparece

Na tela **Integrações > Pagamentos**, dentro do card expandido de cada provedor **já conectado**. A seção inclui:

1. Título "URL do Webhook" com ícone informativo.
2. Campo de texto read-only com a URL completa.
3. Botão de copiar (com feedback visual de "copiado").
4. Instruções contextualizadas:
   - **Pagar.me**: "Configure esta URL em Pagar.me Dashboard → Configurações → Webhooks"
   - **Mercado Pago**: "Configure esta URL em Mercado Pago → Suas integrações → Webhooks"

## Regras

- A seção de webhook só aparece quando o provedor **está conectado** (tem credenciais salvas).
- A URL é construída dinamicamente usando `import.meta.env.VITE_SUPABASE_URL`.
- O `notification_url` também é enviado programaticamente em cada transação (Preference do MP, por exemplo), mas a configuração global no painel do provedor é necessária para eventos assíncronos como chargebacks e disputas.

## Arquivo

- `src/components/payments/PaymentGatewaySettings.tsx`
