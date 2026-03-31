# Plano: Diferenciação de Escopos Meta por Tipo de Tenant

**Status:** ✅ Implementado

## O que foi feito

### 1. Banco de dados
- Removido `config_id` do perfil `meta_auth_external` (tenants normais)
- Ambos os perfis agora usam escopos diretos na URL OAuth (sem Facebook Login for Business)
- `meta_auth_external`: apenas escopos aprovados pela Meta para uso público
- `meta_auth_full`: todos os escopos (para tenants especiais/admin)

### 2. Catálogo de integrações (`metaIntegrationCatalog.ts`)
- Adicionada constante `META_APPROVED_PUBLIC_SCOPES` com a lista de escopos aprovados
- Fonte de verdade centralizada — atualizar conforme novos escopos forem aprovados

### 3. Hook `useMetaIntegrations`
- Nova camada de validação (Layer 0): verifica se os escopos da integração estão aprovados publicamente
- Tenants normais: toggles com escopos não aprovados mostram "Em breve — aguardando aprovação"
- Tenants especiais (`isUnlimited`): ignoram essa camada, todos os toggles disponíveis

### Escopos aprovados atualmente
- `public_profile`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`
- `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`
- `whatsapp_business_management`, `whatsapp_business_messaging`, `read_insights`

### Integrações disponíveis para tenants normais
- ✅ WhatsApp (Notificações, Atendimento)
- ✅ Instagram (Publicações, Comentários)
- ✅ Facebook (Publicações)
- ✅ Insights
- ✅ Pixel/CAPI (sem escopo necessário ou via ads_management para especiais)

### Integrações bloqueadas para tenants normais (aguardando aprovação)
- ❌ Instagram Direct (`instagram_manage_messages`)
- ❌ Facebook Messenger (`pages_messaging`)
- ❌ Facebook Lives (`publish_video`)
- ❌ Facebook Comentários (`pages_manage_engagement`, `pages_read_user_content`)
- ❌ Lead Ads (`leads_retrieval`, `pages_manage_ads`)
- ❌ Anúncios (`ads_management`, `ads_read`)
- ❌ Catálogos (`catalog_management`)
- ❌ Threads (`threads_basic`, `threads_content_publish`)
