/**
 * META INTEGRATION CATALOG — V4.4
 * 
 * Fonte de verdade para as integrações atômicas Meta.
 * Cada toggle ativo = 1 registro em `tenant_meta_integrations`.
 * 
 * Disponibilidade por 4 camadas:
 * 1. Aprovação pública — escopo aprovado pela Meta para uso público?
 * 2. Auth capability — escopos do grant suportam?
 * 3. Plano/feature — plano do tenant libera?
 * 4. Estado operacional — ativo, inativo, pendente etc.
 * 
 * Tenants especiais (isUnlimited) ignoram camada 1 e 2.
 */

/**
 * Escopos aprovados pela Meta para uso público (App Review aprovado).
 * Tenants normais só podem solicitar esses escopos no OAuth.
 * Tenants especiais/admin podem solicitar TODOS os escopos.
 * 
 * Atualizar esta lista conforme novos escopos forem aprovados pela Meta.
 */
export const META_APPROVED_PUBLIC_SCOPES: string[] = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'instagram_manage_comments',
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'read_insights',
  // Threads usa OAuth separado (threads.net) — escopos NÃO vão no Facebook OAuth
];

/**
 * Tipos de ativo que uma integração pode requerer.
 * Usado pelo MetaAssetSelector para filtrar discovered_assets.
 */
export type MetaAssetType = 
  | 'page'
  | 'instagram_account'
  | 'waba_phone'
  | 'pixel'
  | 'ad_account'
  | 'catalog'
  | 'none';

export interface MetaIntegrationDef {
  /** Unique ID — matches integration_id in tenant_meta_integrations */
  id: string;
  /** Display label */
  label: string;
  /** Short description */
  description: string;
  /** Visual grouping */
  group: MetaIntegrationGroup;
  /** Lucide icon name */
  icon: string;
  /** Meta Graph API scopes required for this integration */
  requiredScopes: string[];
  /** Feature key for plan gating (checked via canAccess) — null = no plan restriction */
  featureKey: string | null;
  /** Whether this integration requires separate auth (e.g. Threads) */
  separateAuth?: boolean;
  /** Whether this integration has an expandable config section */
  hasConfigSection?: boolean;
  /** Component key for legacy config section to embed */
  configSectionKey?: string;
  /** Type of Meta asset this integration requires for activation */
  assetType: MetaAssetType;
  /** Human-readable label for the asset selector */
  assetLabel?: string;
}

export type MetaIntegrationGroup = 
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'marketing'
  | 'commerce'
  | 'outros';

export interface MetaIntegrationGroupDef {
  id: MetaIntegrationGroup;
  label: string;
  description: string;
}

export const META_INTEGRATION_GROUPS: MetaIntegrationGroupDef[] = [
  { id: 'whatsapp', label: 'WhatsApp', description: 'Mensagens e atendimento via WhatsApp Business' },
  { id: 'instagram', label: 'Instagram', description: 'Publicações, mensagens e comentários' },
  { id: 'facebook', label: 'Facebook', description: 'Páginas, publicações e messenger' },
  { id: 'marketing', label: 'Marketing & Conversão', description: 'Pixel, CAPI, leads e anúncios' },
  { id: 'commerce', label: 'Commerce & Dados', description: 'Catálogos e insights' },
  { id: 'outros', label: 'Outros', description: 'Threads e demais integrações' },
];

export const META_INTEGRATION_CATALOG: MetaIntegrationDef[] = [
  // === WhatsApp ===
  {
    id: 'whatsapp_notificacoes',
    label: 'Notificações',
    description: 'Envio de notificações de pedido, rastreio e lembretes via WhatsApp',
    group: 'whatsapp',
    icon: 'Bell',
    requiredScopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    featureKey: null,
    hasConfigSection: true,
    configSectionKey: 'whatsapp_registration',
    assetType: 'waba_phone',
    assetLabel: 'Número de WhatsApp',
  },
  {
    id: 'whatsapp_atendimento',
    label: 'Atendimento',
    description: 'Receber e responder mensagens de clientes pelo WhatsApp',
    group: 'whatsapp',
    icon: 'MessageCircle',
    requiredScopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    featureKey: null,
    assetType: 'waba_phone',
    assetLabel: 'Número de WhatsApp',
  },

  // === Instagram ===
  {
    id: 'instagram_publicacoes',
    label: 'Publicações',
    description: 'Postar feed, stories e reels no Instagram',
    group: 'instagram',
    icon: 'Image',
    requiredScopes: ['instagram_basic', 'instagram_content_publish'],
    featureKey: null,
    assetType: 'instagram_account',
    assetLabel: 'Conta Instagram',
  },
  {
    id: 'instagram_direct',
    label: 'Direct',
    description: 'Receber e responder DMs do Instagram',
    group: 'instagram',
    icon: 'Send',
    requiredScopes: ['instagram_manage_messages'],
    featureKey: null,
    assetType: 'instagram_account',
    assetLabel: 'Conta Instagram',
  },
  {
    id: 'instagram_comentarios',
    label: 'Comentários',
    description: 'Gerenciar comentários nas publicações',
    group: 'instagram',
    icon: 'MessageSquare',
    requiredScopes: ['instagram_manage_comments'],
    featureKey: null,
    assetType: 'instagram_account',
    assetLabel: 'Conta Instagram',
  },

  // === Facebook ===
  {
    id: 'facebook_publicacoes',
    label: 'Publicações',
    description: 'Postar em páginas do Facebook',
    group: 'facebook',
    icon: 'FileText',
    requiredScopes: ['pages_manage_posts', 'pages_read_engagement'],
    featureKey: null,
    assetType: 'page',
    assetLabel: 'Página do Facebook',
  },
  {
    id: 'facebook_messenger',
    label: 'Messenger',
    description: 'Receber e responder mensagens via Messenger',
    group: 'facebook',
    icon: 'MessagesSquare',
    requiredScopes: ['pages_messaging'],
    featureKey: null,
    assetType: 'page',
    assetLabel: 'Página do Facebook',
  },
  {
    id: 'facebook_lives',
    label: 'Lives',
    description: 'Transmissões ao vivo no Facebook',
    group: 'facebook',
    icon: 'Video',
    requiredScopes: ['publish_video'],
    featureKey: null,
    assetType: 'page',
    assetLabel: 'Página do Facebook',
  },
  {
    id: 'facebook_comentarios',
    label: 'Comentários',
    description: 'Gerenciar comentários nas publicações do Facebook',
    group: 'facebook',
    icon: 'MessageSquare',
    requiredScopes: ['pages_manage_engagement', 'pages_read_engagement', 'pages_read_user_content'],
    featureKey: null,
    assetType: 'page',
    assetLabel: 'Página do Facebook',
  },

  // === Marketing & Conversão ===
  {
    id: 'pixel_facebook',
    label: 'Pixel Facebook',
    description: 'Conexão e configuração do pixel de rastreamento client-side',
    group: 'marketing',
    icon: 'Crosshair',
    requiredScopes: [],
    featureKey: null,
    hasConfigSection: true,
    configSectionKey: 'pixel_facebook',
    assetType: 'pixel',
    assetLabel: 'Pixel',
  },
  {
    id: 'conversions_api',
    label: 'API de Conversões',
    description: 'Envio server-side de eventos via Conversions API (CAPI)',
    group: 'marketing',
    icon: 'Server',
    requiredScopes: [],
    featureKey: null,
    hasConfigSection: true,
    configSectionKey: 'conversions_api',
    assetType: 'pixel',
    assetLabel: 'Pixel',
  },
  {
    id: 'leads',
    label: 'Lead Ads',
    description: 'Captura de leads via formulários de anúncios',
    group: 'marketing',
    icon: 'Users',
    requiredScopes: ['leads_retrieval', 'pages_manage_ads'],
    featureKey: null,
    assetType: 'page',
    assetLabel: 'Página do Facebook',
  },
  {
    id: 'anuncios',
    label: 'Anúncios',
    description: 'Criar e gerenciar campanhas de anúncios',
    group: 'marketing',
    icon: 'Megaphone',
    requiredScopes: ['ads_management', 'ads_read'],
    featureKey: null,
    assetType: 'ad_account',
    assetLabel: 'Conta de Anúncio',
  },

  // === Commerce & Dados ===
  {
    id: 'catalogos',
    label: 'Catálogos',
    description: 'Sincronizar produtos com o Commerce Manager',
    group: 'commerce',
    icon: 'ShoppingBag',
    requiredScopes: ['catalog_management'],
    featureKey: null,
    hasConfigSection: true,
    configSectionKey: 'product_feeds',
    assetType: 'catalog',
    assetLabel: 'Catálogo',
  },
  {
    id: 'catalogo_insights',
    label: 'Insights',
    description: 'Métricas de páginas, perfis e anúncios',
    group: 'commerce',
    icon: 'BarChart3',
    requiredScopes: ['read_insights', 'pages_read_engagement'],
    featureKey: null,
    assetType: 'page',
    assetLabel: 'Página',
  },

  // === Outros ===
  // Threads removido do catálogo Meta — possui OAuth próprio separado (threads.net)
  // Gerenciado por useThreadsConnection + ThreadsConnectCard
];

/**
 * Get integrations grouped by their group key
 */
export function getIntegrationsByGroup(): Record<MetaIntegrationGroup, MetaIntegrationDef[]> {
  const grouped: Record<MetaIntegrationGroup, MetaIntegrationDef[]> = {
    whatsapp: [],
    instagram: [],
    facebook: [],
    marketing: [],
    commerce: [],
    outros: [],
  };

  for (const integration of META_INTEGRATION_CATALOG) {
    grouped[integration.group].push(integration);
  }

  return grouped;
}

/**
 * Get a single integration definition by ID
 */
export function getIntegrationDef(id: string): MetaIntegrationDef | undefined {
  return META_INTEGRATION_CATALOG.find(i => i.id === id);
}
