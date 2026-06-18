# Baseline de Capacidades das Plataformas de Anúncios

> **Status:** ✅ Onda 0 — Baseline manual  
> **Versão:** v2026-06-10  
> **Camada:** Layer 3 — Especificações / Marketing  
> **Tabela:** `platform_capabilities`  
> **Última atualização:** 2026-06-10

Esta baseline é a fonte de verdade do que o Gestor de Tráfego IA assume hoje sobre cada plataforma (objetivos, eventos, posicionamentos, formatos, campos obrigatórios e defaults seguros). Ela é semeada manualmente nesta entrega; o verificador mensal automático fica para uma onda futura.

## Princípios

- Memória da IA, knowledge interno e código **não** são fonte de verdade. Só esta baseline e o registro em banco são.
- Cada plataforma carrega `status`: `verificado`, `nao_verificado`, `revisao_necessaria`, `vencido`, `verificacao_falhou`.
- Plataforma fora de `verificado` **bloqueia** aprovação de estratégia e qualquer geração de criativo até nova verificação humana.
- Última verificação acima de 60 dias bloqueia aprovação.
- Capacidades adicionadas/removidas só entram via migração ou ação manual do admin de plataforma — nunca por IA.

## Meta Ads — verificado

- **API**: Graph API / Marketing API v21.0  
- **Versão da baseline**: `meta-2026-06-10-baseline`  
- **Última verificação**: 2026-06-10  
- **Próxima verificação**: 2026-07-10

### Fontes oficiais consultadas

| Fonte | URL |
|---|---|
| Meta Marketing API — Campaign | https://developers.facebook.com/docs/marketing-api/reference/ad-campaign-group |
| Meta Marketing API — AdSet | https://developers.facebook.com/docs/marketing-api/reference/ad-campaign |
| Meta Marketing API — Ad Creative | https://developers.facebook.com/docs/marketing-api/reference/ad-creative |
| Meta Marketing API — Targeting | https://developers.facebook.com/docs/marketing-api/audiences/reference/advanced-targeting |
| Meta Pixel — Standard Events | https://developers.facebook.com/docs/meta-pixel/reference |

### Capacidades suportadas

- **Objetivos**: OUTCOME_SALES · OUTCOME_LEADS · OUTCOME_TRAFFIC · OUTCOME_AWARENESS · OUTCOME_ENGAGEMENT · OUTCOME_APP_PROMOTION
- **Modo de compra**: AUCTION (Leilão) · RESERVED
- **Tipos de orçamento**: daily · lifetime · adset_level · campaign_level
- **Metas de otimização**: OFFSITE_CONVERSIONS · LINK_CLICKS · IMPRESSIONS · REACH · LANDING_PAGE_VIEWS · VALUE · LEAD_GENERATION · QUALITY_LEAD · ENGAGED_USERS
- **Eventos de cobrança**: IMPRESSIONS · LINK_CLICKS · THRUPLAY
- **Eventos de conversão**: PURCHASE · ADD_TO_CART · INITIATED_CHECKOUT · LEAD · COMPLETE_REGISTRATION · VIEW_CONTENT · SEARCH · ADD_PAYMENT_INFO · CONTACT · SUBSCRIBE · START_TRIAL
- **Locais de conversão**: Site · Site e App · App · Site e Loja Física · Site e ligações
- **Posicionamentos**: advantage_plus · facebook_feed · instagram_feed · instagram_reels · facebook_reels · facebook_stories · instagram_stories · marketplace · messenger · audience_network
- **Botões de ação (CTAs)**: SHOP_NOW · LEARN_MORE · SIGN_UP · BUY_NOW · ORDER_NOW · GET_OFFER · SEND_WHATSAPP_MESSAGE · CONTACT_US · SUBSCRIBE · DOWNLOAD · WATCH_MORE · BOOK_NOW · APPLY_NOW
- **Formatos criativos**: SINGLE_IMAGE · SINGLE_VIDEO · CAROUSEL · COLLECTION

### Defaults seguros aplicados pelo motor

| Campo | Default |
|---|---|
| campaign.buying_type | AUCTION |
| campaign.planned_status | PAUSED |
| adset.location | BR |
| adset.placements | advantage_plus |
| adset.conversion_location | Site |
| adset.age_min / age_max | 18 / 65 |
| adset.gender | Todos |

### Limitações conhecidas

- Categorias especiais (Crédito/Emprego/Moradia/Política) restringem targeting demográfico.
- Advantage+ shopping têm restrições próprias de targeting.
- Advantage+ Posicionamentos e Advantage+ Público são recursos diferentes. O default `adset.placements = advantage_plus` significa posicionamento automático e não deve ativar automação de público. Quando Advantage+ Público é ativado explicitamente, a Meta não aceita idade mínima acima de 25 anos; para públicos com 30+, manter segmentação manual, apenas posicionamentos automáticos e opt-out explícito de Advantage+ Público.
- Pixel exige evento padrão (não custom) para otimização confiável.

## Google Ads — não verificado

- **Versão da baseline**: `google-placeholder`  
- **Status**: bloqueia geração de criativo e publicação até verificação humana  
- **Fonte oficial pendente**: https://developers.google.com/google-ads/api/reference/rpc

## TikTok Ads — não verificado

- **Versão da baseline**: `tiktok-placeholder`  
- **Status**: bloqueia geração de criativo e publicação até verificação humana  
- **Fonte oficial pendente**: https://business-api.tiktok.com/portal/docs

## Lacunas a resolver

- Verificador automático mensal (sem IA), com hash de capacidades, alertas e admin de revisão — fica para a próxima onda.
- Capacidades reais de Google Ads e TikTok Ads precisam ser semeadas em uma Onda futura, após verificação humana das fontes oficiais.

---

## Objective Mapper (canônico ↔ plataforma) — Onda C

| Enum canônico interno | Label PT-BR | Meta Ads | Google Ads | TikTok Ads |
|---|---|---|---|---|
| `sales` | Vendas | `OUTCOME_SALES` | (placeholder, não verificado) | (placeholder, não verificado) |
| `leads` | Geração de leads | `OUTCOME_LEADS` | (placeholder) | (placeholder) |
| `traffic` | Tráfego | `OUTCOME_TRAFFIC` | (placeholder) | (placeholder) |
| `awareness` | Reconhecimento de marca | `OUTCOME_AWARENESS` | (placeholder) | (placeholder) |
| `engagement` | Engajamento | `OUTCOME_ENGAGEMENT` | (placeholder) | (placeholder) |
| `app_promotion` | Promoção de aplicativo | `OUTCOME_APP_PROMOTION` | (placeholder) | (placeholder) |

**Regra de comparação:** o Platform Compatibility Gate **nunca** compara o
enum canônico direto com a lista de objetivos suportados da plataforma. A
comparação ocorre sempre depois de traduzir o canônico para o enum oficial
via `translateObjectiveToMeta()` (ou o adapter equivalente da plataforma).
Comparar `"SALES"` direto com `["OUTCOME_SALES", ...]` é proibido e foi a
causa do bug histórico "objetivo SALES não suportado".

Mesma regra se aplica a CTA, evento de conversão, posicionamento e formato
criativo. Mappers ficam em `src/lib/ads/platform/metaAdapter.ts` (e
adapters futuros por plataforma).
