---
name: Marketplace Scrub Determinístico (Reg #19)
description: Gate pós-resposta para canais mercadolivre/shopee/tiktok_shop/facebook_comments/instagram_comments — remove URLs externas, telefones, e-mails e menções a WhatsApp/Instagram/Telegram. Independe de configuração do lojista.
type: constraint
---

## Regra
Em canais de marketplace e comentários públicos, a resposta da IA passa por `scrubMarketplaceResponse` (em `_shared/sales-pipeline/marketplace-scrub.ts`) ANTES da persistência. Whitelist do domínio próprio via `storeUrl`. Se a resposta esvaziar, devolve fallback do canal pedindo continuidade dentro da plataforma.

## Por quê
Restrição prompt-only é frágil. Marketplaces banem conta por direcionar fora da plataforma. Gate determinístico é a única garantia.

## Como aplicar
Novos canais de marketplace entram no `MARKETPLACE_CHANNELS` em `marketplace-scrub.ts` e no `channelRestrictions` em `ai-support-chat/index.ts`. Nunca tirar o gate sem aprovação explícita.
