---
name: Ads Meta Status — Source of Truth
description: Status técnico Meta no Gestor de Tráfego IA deve ler de tenant_meta_integrations, nunca de ads_meta_production_config.
type: constraint
---

O alerta "Pendência técnica na integração Meta" exibido no card de cada conta de anúncios em `/ads` (Gestor de Tráfego IA → Configurações Gerais) DEVE derivar dos ativos reais selecionados pelo usuário na integração Meta (`tenant_meta_integrations` com `status='active'`):

- Conta de anúncio: integração `anuncios` com `selected_assets.ad_accounts[]` preenchido.
- Página: qualquer integração de Facebook/Instagram (`facebook_publicacoes`, `instagram_publicacoes`, `facebook_messenger`, `facebook_comentarios`, `instagram_comentarios`, `leads`) com `pages[]` ou `page` preenchido.
- Pixel: integração `pixel_facebook` ou `conversions_api` com `pixels[]` ou `pixel` preenchido.
- API de Conversões: integração `conversions_api` ativa.

**Proibido** ler de `ads_meta_production_config` para esse status. Essa tabela é uma configuração interna opcional (sobrescrita avançada de defaults de público/CTA/formato) e ficou vazia desde a remoção do formulário manual na Onda D (2026-06-10). Ler dela gera falso alerta de pendência mesmo com integração Meta 100% conectada.

**Why:** Em 2026-06-10 o alerta amarelo aparecia para todos os tenants porque `ads_meta_production_config` estava vazia. Causa raiz: separação entre "configuração técnica avançada interna" e "ativos selecionados na integração real".

**How to apply:** Sempre que precisar checar prontidão Meta para análise/publicação no Gestor de Tráfego IA, usar `useMetaIntegrationAssetsStatus` (lê `tenant_meta_integrations`). Não criar lógica paralela que leia `ads_meta_production_config` para esse fim.
