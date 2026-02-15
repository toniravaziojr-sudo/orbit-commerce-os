
# Hub Google Centralizado — CONCLUÍDO ✅

## Status: Todas as 8 fases implementadas

---

## Fases Concluídas

| Fase | Descrição | Status |
|------|-----------|--------|
| 1 | Hub Base (OAuth + DB + UI) | ✅ |
| 2 | Migração YouTube | ✅ |
| 3 | Google Merchant Center | ✅ |
| 4 | Google Ads Manager | ✅ |
| 5 | Google Analytics GA4 | ✅ |
| 6 | Google Search Console | ✅ |
| 7 | Google Meu Negócio | ✅ |
| 8 | Google Tag Manager | ✅ |

---

## Arquitetura

- **1 conexão por tenant** via `google_connections` (UNIQUE tenant_id)
- **OAuth incremental** com `include_granted_scopes=true`
- **7 Scope Packs**: youtube, ads, merchant, analytics, search_console, business, tag_manager
- **Cache híbrido**: tabelas locais + fallback API

## Tabelas Criadas

| Tabela | Fase |
|--------|------|
| `google_connections` | 1 |
| `google_oauth_states` | 1 |
| `google_merchant_products` | 3 |
| `google_ad_campaigns` | 4 |
| `google_ad_insights` | 4 |
| `google_analytics_reports` | 5 |
| `google_search_console_data` | 6 |
| `google_business_reviews` | 7 |
| `google_business_posts` | 7 |
| `google_tag_manager_containers` | 8 |

## Edge Functions

| Função | Fase |
|--------|------|
| `google-oauth-start` | 1 |
| `google-oauth-callback` | 1 |
| `google-token-refresh` | 1 |
| `google-merchant-sync` | 3 |
| `google-merchant-status` | 3 |
| `google-ads-campaigns` | 4 |
| `google-ads-insights` | 4 |
| `google-ads-audiences` | 4 |
| `google-analytics-report` | 5 |
| `google-search-console` | 6 |
| `google-business-reviews` | 7 |
| `google-business-posts` | 7 |
| `google-tag-manager` | 8 |

## Hooks Frontend

| Hook | Fase |
|------|------|
| `useGoogleConnection` | 1 |
| `useGoogleMerchant` | 3 |
| `useGoogleAds` | 4 |
| `useGoogleAnalytics` | 5 |
| `useGoogleSearchConsole` | 6 |
| `useGoogleBusiness` | 7 |
| `useGoogleTagManager` | 8 |

## Pré-requisitos do Integrador

1. Google Cloud Console: ativar APIs (Ads, Content, Analytics Data, Search Console, Business Profile, Tag Manager)
2. Redirect URI: `{SUPABASE_URL}/functions/v1/google-oauth-callback`
3. Google Ads Developer Token em `platform_credentials`
4. Submeter app para verificação de escopos sensíveis
