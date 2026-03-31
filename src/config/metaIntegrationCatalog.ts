/**
 * META INTEGRATION CATALOG — V4
 * 
 * Fonte de verdade para as integrações atômicas Meta.
 * Cada toggle ativo = 1 registro em `tenant_meta_integrations`.
 * 
 * Disponibilidade por 3 camadas:
 * 1. Auth capability — escopos do grant suportam?
 * 2. Plano/feature — plano do tenant libera?
 * 3. Estado operacional — ativo, inativo, pendente etc.
 */

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
  },
  {
    id: 'whatsapp_atendimento',
    label: 'Atendimento',
    description: 'Receber e responder mensagens de clientes pelo WhatsApp',
    group: 'whatsapp',
    icon: 'MessageCircle',
    requiredScopes: ['whatsapp_business_messaging', 'whatsapp_business_management'],
    featureKey: null,
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
  },
  {
    id: 'instagram_direct',
    label: 'Direct',
    description: 'Receber e responder DMs do Instagram',
    group: 'instagram',
    icon: 'Send',
    requiredScopes: ['instagram_manage_messages'],
    featureKey: null,
  },
  {
    id: 'instagram_comentarios',
    label: 'Comentários',
    description: 'Gerenciar comentários nas publicações',
    group: 'instagram',
    icon: 'MessageSquare',
    requiredScopes: ['instagram_manage_comments'],
    featureKey: null,
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
  },
  {
    id: 'facebook_messenger',
    label: 'Messenger',
    description: 'Receber e responder mensagens via Messenger',
    group: 'facebook',
    icon: 'MessagesSquare',
    requiredScopes: ['pages_messaging'],
    featureKey: null,
  },
  {
    id: 'facebook_lives',
    label: 'Lives',
    description: 'Transmissões ao vivo no Facebook',
    group: 'facebook',
    icon: 'Video',
    requiredScopes: ['publish_video'],
    featureKey: null,
  },
  {
    id: 'facebook_comentarios',
    label: 'Comentários',
    description: 'Gerenciar comentários nas publicações do Facebook',
    group: 'facebook',
    icon: 'MessageSquare',
    requiredScopes: ['pages_manage_engagement', 'pages_read_engagement'],
    featureKey: null,
  },

  // === Marketing & Conversão ===
  {
    id: 'pixel_facebook',
    label: 'Pixel Facebook',
    description: 'Conexão e configuração do pixel de rastreamento client-side',
    group: 'marketing',
    icon: 'Crosshair',
    requiredScopes: ['ads_management'],
    featureKey: null,
    hasConfigSection: true,
    configSectionKey: 'pixel_facebook',
  },
  {
    id: 'conversions_api',
    label: 'API de Conversões',
    description: 'Envio server-side de eventos via Conversions API (CAPI)',
    group: 'marketing',
    icon: 'Server',
    requiredScopes: ['ads_management'],
    featureKey: null,
    hasConfigSection: true,
    configSectionKey: 'conversions_api',
  },
  {
    id: 'leads',
    label: 'Lead Ads',
    description: 'Captura de leads via formulários de anúncios',
    group: 'marketing',
    icon: 'Users',
    requiredScopes: ['leads_retrieval', 'pages_manage_ads'],
    featureKey: null,
  },
  {
    id: 'anuncios',
    label: 'Anúncios',
    description: 'Criar e gerenciar campanhas de anúncios',
    group: 'marketing',
    icon: 'Megaphone',
    requiredScopes: ['ads_management', 'ads_read'],
    featureKey: null,
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
  },
  {
    id: 'catalogo_insights',
    label: 'Insights',
    description: 'Métricas de páginas, perfis e anúncios',
    group: 'commerce',
    icon: 'BarChart3',
    requiredScopes: ['read_insights', 'pages_read_engagement'],
    featureKey: null,
  },

  // === Outros ===
  {
    id: 'threads',
    label: 'Threads',
    description: 'Publicar e gerenciar conteúdo no Threads',
    group: 'outros',
    icon: 'AtSign',
    requiredScopes: ['threads_basic', 'threads_content_publish'],
    featureKey: null,
    separateAuth: true,
  },
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
