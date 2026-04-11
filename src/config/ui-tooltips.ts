// =============================================
// CENTRALIZED UI TOOLTIP DESCRIPTIONS
// All user-facing help texts in one place.
// Max ~120 chars per description, business language.
// =============================================

export const uiTooltips: Record<string, string> = {
  // ── Sidebar modules ──
  "sidebar.command-center": "Painel central com dashboard, execuções, insights e assistente de IA",
  "sidebar.orders": "Gerencie pedidos, pagamentos e status de envio",
  "sidebar.products": "Catálogo de produtos com variantes, preços e estoque",
  "sidebar.customers": "Base de clientes com histórico de compras e segmentação",
  "sidebar.categories": "Organize produtos em categorias e subcategorias",
  "sidebar.discounts": "Crie e gerencie cupons de desconto e promoções",
  "sidebar.affiliates": "Programa de afiliados com comissões e rastreamento",
  "sidebar.shipping": "Gestão de envios, transportadoras e regras de frete",
  "sidebar.finance": "Controle financeiro com receitas, despesas e margem",
  "sidebar.fiscal": "Emissão e gestão de notas fiscais eletrônicas",
  "sidebar.notifications": "Central de notificações e automações de envio",
  "sidebar.reviews": "Moderação de avaliações de produtos",
  "sidebar.blog": "Gerencie posts e conteúdo do blog da loja",
  "sidebar.marketing": "Integrações de marketing e catálogos de produto",
  "sidebar.email-marketing": "Listas, templates, campanhas e automações de email",
  "sidebar.settings": "Configurações gerais da loja e da conta",
  "sidebar.support": "Central de suporte e atendimento ao cliente",
  "sidebar.integrations": "Conexões com plataformas e serviços externos",
  "sidebar.payments": "Configurações de meios de pagamento",
  "sidebar.pages": "Páginas institucionais e landing pages",
  "sidebar.storefront": "Personalize a aparência da sua loja virtual",
  "sidebar.media": "Biblioteca de arquivos e mídias da loja",
  "sidebar.menus": "Gerencie menus de navegação do storefront",
  "sidebar.quizzes": "Crie quizzes interativos para engajar clientes",
  "sidebar.buy-together": "Configure ofertas de compre junto",
  "sidebar.offers": "Gerencie ofertas especiais e promoções avançadas",
  "sidebar.purchases": "Gestão de compras e fornecedores",
  "sidebar.reports": "Relatórios analíticos do desempenho da loja",
  "sidebar.ads-manager": "Gestão de anúncios com IA e autopilot",
  "sidebar.creatives": "Biblioteca de criativos para campanhas",
  "sidebar.attribution": "Atribuição de conversões por canal",
  "sidebar.influencers": "Gestão de parcerias com influenciadores",
  "sidebar.abandoned-checkouts": "Recuperação de carrinhos abandonados",
  "sidebar.landing-pages": "Crie landing pages otimizadas para conversão",

  // ── Command Center tabs ──
  "cc.tab.dashboard": "Visão geral de métricas e indicadores do dia",
  "cc.tab.executions": "Fila de tarefas pendentes e automações em andamento",
  "cc.tab.insights": "Sugestões inteligentes baseadas nos dados da loja",
  "cc.tab.assistant": "Chat com IA para tirar dúvidas e executar ações",
  "cc.tab.agenda": "Calendário de tarefas, compromissos e lembretes",

  // ── Orders page ──
  "orders.btn.new": "Criar um pedido manualmente",
  "orders.btn.import": "Importar pedidos de uma planilha CSV",
  "orders.btn.export": "Exportar lista de pedidos para planilha",
  "orders.stat.total": "Quantidade total de pedidos no período",
  "orders.stat.approved": "Pedidos com pagamento aprovado",
  "orders.stat.awaiting": "Pedidos aguardando confirmação de pagamento",
  "orders.stat.canceled": "Pedidos cancelados, expirados ou recusados",
  "orders.stat.awaiting-nf": "Pedidos prontos para emissão de nota fiscal",
  "orders.stat.nf-issued": "Pedidos com nota fiscal já emitida",
  "orders.stat.returning": "Pedidos em processo de devolução",
  "orders.stat.chargeback": "Pedidos com disputas de chargeback",

  // ── Products page ──
  "products.btn.new": "Cadastrar um novo produto no catálogo",
  "products.btn.import": "Importar produtos de uma planilha CSV",

  // ── Customers page ──
  "customers.btn.new": "Cadastrar um novo cliente manualmente",
  "customers.btn.import": "Importar clientes de uma planilha CSV",
  "customers.btn.export": "Exportar lista de clientes para planilha",
  "customers.btn.tags": "Gerenciar tags para segmentação de clientes",

  // ── Discounts page ──
  "discounts.btn.new": "Criar um novo cupom ou desconto",

  // ── Marketing page tabs ──
  "marketing.tab.integrations": "Configure pixels e tags de rastreamento",
  "marketing.tab.feeds": "Gerencie catálogos de produtos para plataformas",
  "marketing.tab.analytics": "Relatórios de performance de marketing",

  // ── Email Marketing ──
  "email.btn.new-list": "Criar uma nova lista de contatos",
  "email.btn.new-template": "Criar um novo template de email",
  "email.btn.new-campaign": "Criar e agendar uma campanha de email",
  "email.btn.new-automation": "Criar um fluxo de automação de email",

  // ── Shipping tabs ──
  "shipping.tab.shipments": "Lista de envios e rastreamento de entregas",
  "shipping.tab.carriers": "Configure transportadoras e métodos de envio",
  "shipping.tab.free-shipping": "Regras de frete grátis por valor ou região",
  "shipping.tab.custom-rules": "Regras personalizadas de cálculo de frete",

  // ── Finance ──
  "finance.btn.new-income": "Registrar uma nova receita manual",
  "finance.btn.new-expense": "Registrar uma nova despesa",
  "finance.btn.export": "Exportar lançamentos financeiros",

  // ── Fiscal ──
  "fiscal.btn.settings": "Configurar dados fiscais e certificado digital",
  "fiscal.tab.orders": "Pedidos prontos para emissão de NF-e",
  "fiscal.tab.invoices": "Notas fiscais emitidas e seus status",

  // ── Blog ──
  "blog.btn.new-post": "Criar um novo artigo para o blog",

  // ── Reviews ──
  "reviews.btn.add": "Adicionar uma avaliação manualmente",
  "reviews.btn.generate": "Gerar avaliações de exemplo com IA",

  // ── Notifications ──
  "notifications.btn.new-rule": "Criar uma nova regra de notificação automática",
  "notifications.tab.history": "Histórico de notificações enviadas",
  "notifications.tab.rules": "Regras de disparo automático de notificações",

  // ── Settings ──
  "settings.card.store": "Informações básicas, logo e dados de contato da loja",
  "settings.card.domains": "Gerencie domínios personalizados da loja",
  "settings.card.team": "Gerencie usuários, funções e permissões de acesso",
  "settings.card.security": "Configurações de autenticação e segurança",
  "settings.card.notifications": "Preferências de alertas do sistema",
  "settings.card.appearance": "Personalize cores, tema e identidade visual",

  // ── Header ──
  "header.user-menu": "Acesse configurações da conta e opções de perfil",
  "header.account-data": "Visualize e edite seus dados pessoais",
  "header.billing": "Gerencie seu plano, créditos e faturamento",
  "header.admin-toggle": "Alternar entre modo operador e modo lojista",
  "header.alerts": "Alertas e avisos importantes da plataforma",
  "header.tutorial": "Acesse o tutorial do módulo atual",
};

export function getTooltip(key: string): string | undefined {
  return uiTooltips[key];
}
