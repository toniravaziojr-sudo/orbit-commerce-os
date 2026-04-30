---
name: Mercado Pago — 2 Contextos de Credenciais (atualizado 2026-04-30)
description: Integrador OAuth (platform_credentials) vs Recebedor por tenant (payment_providers via OAuth automático). Não existem mais 3 contextos — admin é só mais um tenant.
type: constraint
---

# Mercado Pago — Modelo final de credenciais

## Apenas 2 contextos (corrigido em 2026-04-30)

1. **Integrador (plataforma):** `mercadopago_client_id` + `mercadopago_client_secret` em `platform_credentials`. Configurado em `/platform-integrations` por admin. **Único** owner do app de developer do MP. Usado para emitir tokens OAuth de qualquer tenant que queira conectar conta recebedora.

2. **Recebedor (por tenant):** registro em `payment_providers` (`provider='mercado_pago'`, único por `tenant_id`). Criado automaticamente pelo fluxo OAuth — o tenant clica em **Conectar com Mercado Pago** em Minha Loja → Integrações → Pagamentos. Vale tanto para lojistas comuns quanto para o tenant admin (`cc000000-0000-0000-0000-000000000001`) — o admin é apenas mais um tenant que conecta sua conta MP recebedora dos pagamentos de assinatura SaaS.

## Proibido (anti-regressão)

- ❌ Pedir manualmente `access_token` ou `public_key` no formulário do tenant.
- ❌ Tratar a conta recebedora do admin como "terceiro contexto especial".
- ❌ Re-introduzir secrets `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `MP_WEBHOOK_SECRET` no ambiente.
- ❌ Criar fluxo paralelo de conexão MP em outras telas — sempre via `mercadopago-oauth-start`.

## Edge functions canônicas

- `mercadopago-oauth-start` (verify_jwt=false, mas valida Authorization em código + `user_has_tenant_access`)
- `mercadopago-oauth-callback` (verify_jwt=false, público — chamado pelo redirect do MP; valida nonce em `oauth_state_store`)
- `mercadopago-oauth-disconnect` (verify_jwt=false, valida Authorization em código + `user_has_tenant_access`)

## Redirect URI

Único e fixo: `https://<SUPABASE_URL>/functions/v1/mercadopago-oauth-callback`. Deve estar cadastrado no app de developer do Mercado Pago. Se mudar de projeto, precisa re-cadastrar.

## State / nonce

`oauth_state_store` com TTL de 10 min, RLS bloqueia anon e authenticated — só service_role acessa. Nonce é descartado após uso (callback faz DELETE).
