---
name: Ads Meta Status — Source of Truth
description: Status técnico Meta no Gestor de Tráfego IA deve ler de tenant_meta_integrations, e a Página vinculada aos anúncios mora dentro da integração `anuncios`, nunca em Publicações/Comentários.
type: constraint
---

O alerta "Pendência técnica na integração Meta" exibido no card de cada conta de anúncios em `/ads` (Gestor de Tráfego IA → Configurações Gerais) DEVE derivar dos ativos reais selecionados pelo usuário na integração Meta (`tenant_meta_integrations` com `status='active'`):

- **Conta de anúncio:** integração `anuncios` com `selected_assets.ad_accounts[]` preenchido.
- **Página vinculada aos anúncios:** integração `anuncios` com `selected_assets.pages[]` (ou `.page`) preenchido — selecionada na seção "Identidade dos Anúncios" do card de Anúncios em Integrações. **Proibido** derivar a página de `facebook_publicacoes`, `instagram_publicacoes`, `facebook_messenger`, `facebook_comentarios`, `instagram_comentarios` ou `leads`. Essas integrações são de fluxo orgânico (publicação/atendimento) e não representam a identidade de anúncios.
- **Pixel:** integração `pixel_facebook` ou `conversions_api` com `pixels[]` ou `pixel` preenchido.
- **API de Conversões:** integração `conversions_api` ativa.

**Proibido** ler de `ads_meta_production_config` como fonte primária para status, análise estratégica, prompt do Strategist ou prontidão de publicação. Essa tabela é uma configuração interna opcional (sobrescrita avançada de defaults de público/CTA/formato) e ficou vazia desde a remoção do formulário manual na Onda D (2026-06-10). Ler dela como fonte primária gera falso alerta/limitação de pendência mesmo com integração Meta 100% conectada.

**Why:** Em 2026-06-10 dois bugs apareceram em sequência. (1) O alerta lia `ads_meta_production_config` (vazia) e disparava para todos. (2) Após o primeiro fix, o alerta passou a exigir "Página" vinda de Publicações/Comentários — mistura indevida entre orgânico e pago. Causa raiz comum: ausência de um local próprio para a Página de anúncios.

**How to apply:** Sempre que precisar checar prontidão Meta para análise/publicação no Gestor de Tráfego IA, usar os mesmos critérios de `useMetaIntegrationAssetsStatus` / `resolveAccountDefaults`: `tenant_meta_integrations` como fonte primária, Pixel oficial de marketing como fallback e `ads_meta_production_config` apenas como override avançado. A seleção é feita pelo componente `MetaAdsIdentitySection` dentro do card de Anúncios em Integrações.

