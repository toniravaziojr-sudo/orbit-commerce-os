# Billing SaaS vs Pagamentos das Lojas — Separação de Domínios

> **STATUS:** 🟢 Normativo (Onda 3.0.2 — 2026-05-12)
> **Camada:** Layer 3 — Especificações / Sistema
> **Doc relacionado:** [`planos-billing.md`](./planos-billing.md), [`hub-integracoes.md`](./hub-integracoes.md)

---

## 1. Por que este doc existe

O sistema possui **dois domínios de pagamento independentes** que estavam sendo
misturados em código e documentação. Este doc é a fonte de verdade da
separação.

---

## 2. Domínio A — Billing SaaS da Plataforma

| Item | Valor |
|---|---|
| Quem cobra | Plataforma Comando Central |
| Quem paga | Tenant (assinatura mensal/anual, créditos de IA, Pix de validação) |
| Recebedor | Conta **Mercado Pago** da plataforma |
| Onde mora a credencial | `payment_providers` do tenant admin (`cc000000-0000-0000-0000-000000000001`) |
| Provider canônico (chave) | `mercadopago` *(ver §6 — divergência atual com OAuth callback)* |
| Gateway permitido | **Mercado Pago — exclusivo** |
| Tabelas | `tenant_subscriptions`, `free_pix_validations`, `tenant_addons`, `billing_plans`, `plan_limits` |
| Edge functions canônicas | `billing-create-checkout`, `billing-webhook`, `billing-add-payment-method`, `billing-activate-subscription`, `billing-check-pix-validation`, `billing-generate-invoice`, `credits-purchase-checkout`, `start-create-checkout`, `retry-card-payment` |
| UI | `/start/*`, `/settings/add-payment-method`, `/settings/billing` |
| Helper de leitura | `supabase/functions/_shared/platform-receiver-credentials.ts` (cache 60s) |

**Proibido no Domínio A:**
- ❌ Usar Pagar.me (`PAGARME_API_KEY`) em qualquer fluxo novo de Billing SaaS.
- ❌ Ler credenciais de `payment_providers` de tenant que não seja o admin.
- ❌ Reusar `MP_ACCESS_TOKEN`/`MP_PUBLIC_KEY`/`MP_WEBHOOK_SECRET` (removidos em 2026-04-30).

---

## 3. Domínio B — Pagamentos das Lojas dos Tenants

| Item | Valor |
|---|---|
| Quem cobra | Tenant (loja) |
| Quem paga | Cliente final da loja |
| Recebedor | Próprio tenant |
| Onde mora a credencial | `payment_providers` do próprio tenant |
| Gateways permitidos | Mercado Pago, Pagar.me, PagSeguro/PagBank, e outros |
| Tabelas | `orders`, `order_payment_attempts`, `order_payment_events` |
| Edge functions canônicas | `mercadopago-create-charge`, `mercadopago-create-preference`, `mercadopago-storefront-webhook`, `mercadopago-refund`, `pagarme-create-charge`, `pagarme-webhook`, `pagarme-refund`, `checkout-create-order`, `payment-refund`, `monitor-chargebacks`, `verify-payment-status`, `reconcile-payments` |
| UI | Storefront público, `/orders`, `/cart-checkout`, Minha Loja → Integrações → Pagamentos |

**Proibido no Domínio B:**
- ❌ Ler credenciais do tenant admin para emitir cobrança de loja.
- ❌ Misturar credenciais entre tenants.

**Caso especial — Respeite o Homem (`d1a4d0ed-…b25`)**: tenant `is_special`,
isento de Billing SaaS. Mantém `payment_providers` Pagar.me em produção para
sua loja real. **Nunca tocar nesse registro nem usá-lo em testes de Domínio
A.**

---

## 4. Tabela `payment_providers` — uma só, dois usos

| Tenant do registro | Domínio | Finalidade |
|---|---|---|
| Admin (`cc000000-…0001`) | A | Recebedor SaaS da plataforma |
| Qualquer outro tenant | B | Recebedor de pedidos da loja |

A separação é **lógica** (filtro por `tenant_id`), não física.

---

## 5. Decisões Aprovadas pelo Operador (Onda 3.0.1)

1. Billing SaaS exclusivo Mercado Pago.
2. Lojas/tenants continuam multi-gateway (MP, Pagar.me, outros).
3. Sandbox primeiro, produção só após validação.
4. Pix de validação: **R$ 100, expiração 1h, reembolso em até 24h.**
5. Cartão da assinatura: **1x, sem parcelamento nesta fase.**
6. Trocar cartão: **substituição direta**, sem histórico de múltiplos cartões.
7. Cartão recusado: erro amigável + **fallback para Pix.**
8. Inadimplência: mantém regra atual (Layer 3 SaaS Billing Protocol v2.3).
9. Tenants legados com `tenant_subscriptions.payment_provider='pagarme'`:
   **histórico inerte** — não migrar; recadastro só quando o tenant trocar/reativar pagamento, e o recadastro será via fluxo MP novo.
10. Qualquer texto/UI novo de pagamento exige aprovação prévia do operador.

---

## 6. Divergência crítica detectada (BLOQUEIO)

A chave canônica do provider Mercado Pago **não é consistente** entre componentes:

| Local | Valor escrito/lido | Arquivo |
|---|---|---|
| Helper recebedor da plataforma | `'mercadopago'` (sem underscore) | `supabase/functions/_shared/platform-receiver-credentials.ts:41,56` |
| Edge `mercadopago-oauth-callback` (insert) | `'mercado_pago'` (com underscore) | `supabase/functions/mercadopago-oauth-callback/index.ts:121` |
| Doc atual | `'mercadopago'` | `planos-billing.md:14` |
| DB hoje | nenhum registro MP — apenas 2 linhas `'pagarme'` (ambas Domínio B) | `payment_providers` |

**Consequência prática:** se o operador conectar a conta MP da plataforma
agora via OAuth, o callback vai gravar `provider='mercado_pago'`, e o helper
de Domínio A vai procurar por `provider='mercadopago'` e devolver `null` — o
billing seguirá quebrado de forma silenciosa.

**Pendência:** padronizar a chave canônica antes de qualquer conexão real.
Decisão proposta (a confirmar pelo operador): adotar `'mercado_pago'` (snake
case, igual ao callback OAuth e aos enums internos do MP) e ajustar o helper
+ doc + chamadas em `billing-*` em uma sub-onda dedicada (`Onda 3.0.1.b`).

---

## 7. Critérios de aceite estruturais

- Toda chamada do Domínio A passa por `getPlatformReceiverCredentials(...)`.
- `grep` por `PAGARME_API_KEY` em pasta `billing-*` deve retornar zero
  ocorrências no estado-alvo.
- Tenants do Domínio B com `payment_providers` continuam intocados.
- `tenant_subscriptions.payment_provider` em ativações novas = chave canônica
  MP definida em §6.
- Nenhum log expõe `access_token`, `card_token`, PAN, CVV, `pix_code`
  completo ou payload sensível.

