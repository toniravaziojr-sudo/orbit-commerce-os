// =============================================
// BLOCK REGISTRY - Central registry of all blocks
// =============================================

import type { BlockCategory, BlockDefinition, BlockNode } from './types';

// Block definitions
const blockDefinitions: BlockDefinition[] = [
  // ========== LAYOUT BLOCKS ==========
  {
    type: 'Page',
    label: 'Página',
    category: 'layout',
    icon: 'FileText',
    defaultProps: {
      backgroundColor: 'transparent',
      padding: 'none',
    },
    propsSchema: {
      backgroundColor: {
        type: 'color',
        label: 'Cor de Fundo',
        defaultValue: 'transparent',
      },
      padding: {
        type: 'select',
        label: 'Espaçamento',
        defaultValue: 'none',
        options: [
          { label: 'Nenhum', value: 'none' },
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
        ],
      },
    },
    canHaveChildren: true,
    isRemovable: false,
  },
  {
    type: 'Section',
    label: 'Seção',
    category: 'layout',
    icon: 'LayoutDashboard',
    defaultProps: {
      backgroundColor: 'transparent',
      paddingX: 0,
      paddingY: 0,
      marginTop: 0,
      marginBottom: 0,
      gap: 16,
      alignItems: 'stretch',
      fullWidth: true,
    },
    propsSchema: {
      backgroundColor: {
        type: 'color',
        label: 'Cor de Fundo',
        defaultValue: 'transparent',
      },
      paddingX: {
        type: 'number',
        label: 'Padding Horizontal (px)',
        defaultValue: 0,
        min: 0,
        max: 100,
      },
      paddingY: {
        type: 'number',
        label: 'Padding Vertical (px)',
        defaultValue: 32,
        min: 0,
        max: 200,
      },
      marginTop: {
        type: 'number',
        label: 'Margem Superior (px)',
        defaultValue: 0,
        min: 0,
        max: 200,
      },
      marginBottom: {
        type: 'number',
        label: 'Margem Inferior (px)',
        defaultValue: 0,
        min: 0,
        max: 200,
      },
      gap: {
        type: 'number',
        label: 'Espaço entre Itens (px)',
        defaultValue: 16,
        min: 0,
        max: 100,
      },
      alignItems: {
        type: 'select',
        label: 'Alinhamento Vertical',
        defaultValue: 'stretch',
        options: [
          { label: 'Esticar', value: 'stretch' },
          { label: 'Início', value: 'flex-start' },
          { label: 'Centro', value: 'center' },
          { label: 'Fim', value: 'flex-end' },
        ],
      },
      fullWidth: {
        type: 'boolean',
        label: 'Largura Total',
        defaultValue: false,
      },
    },
    canHaveChildren: true,
  },
  {
    type: 'Container',
    label: 'Container',
    category: 'layout',
    icon: 'Square',
    defaultProps: {
      maxWidth: 'lg',
      padding: 16,
      marginTop: 0,
      marginBottom: 0,
      gap: 16,
    },
    propsSchema: {
      maxWidth: {
        type: 'select',
        label: 'Largura Máxima',
        defaultValue: 'lg',
        options: [
          { label: 'Pequeno (640px)', value: 'sm' },
          { label: 'Médio (768px)', value: 'md' },
          { label: 'Grande (1024px)', value: 'lg' },
          { label: 'Extra Grande (1280px)', value: 'xl' },
          { label: 'Total', value: 'full' },
        ],
      },
      padding: {
        type: 'number',
        label: 'Padding (px)',
        defaultValue: 16,
        min: 0,
        max: 100,
      },
      marginTop: {
        type: 'number',
        label: 'Margem Superior (px)',
        defaultValue: 0,
        min: 0,
        max: 200,
      },
      marginBottom: {
        type: 'number',
        label: 'Margem Inferior (px)',
        defaultValue: 0,
        min: 0,
        max: 200,
      },
      gap: {
        type: 'number',
        label: 'Espaço entre Itens (px)',
        defaultValue: 16,
        min: 0,
        max: 100,
      },
    },
    canHaveChildren: true,
  },
  {
    type: 'Columns',
    label: 'Colunas',
    category: 'layout',
    icon: 'Columns',
    defaultProps: {
      columns: 2,
      gap: 16,
      stackOnMobile: true,
      alignItems: 'stretch',
    },
    propsSchema: {
      columns: {
        type: 'select',
        label: 'Número de Colunas',
        defaultValue: '2',
        options: [
          { label: '2 Colunas', value: '2' },
          { label: '3 Colunas', value: '3' },
          { label: '4 Colunas', value: '4' },
        ],
      },
      gap: {
        type: 'number',
        label: 'Espaçamento (px)',
        defaultValue: 16,
        min: 0,
        max: 100,
      },
      stackOnMobile: {
        type: 'boolean',
        label: 'Empilhar no Mobile',
        defaultValue: true,
      },
      alignItems: {
        type: 'select',
        label: 'Alinhamento Vertical',
        defaultValue: 'stretch',
        options: [
          { label: 'Esticar', value: 'stretch' },
          { label: 'Início', value: 'flex-start' },
          { label: 'Centro', value: 'center' },
          { label: 'Fim', value: 'flex-end' },
        ],
      },
    },
    canHaveChildren: true,
    slotConstraints: { maxChildren: 4 },
  },
  {
    type: 'Divider',
    label: 'Divisor',
    category: 'layout',
    icon: 'Minus',
    defaultProps: {
      style: 'solid',
      color: '#e5e7eb',
    },
    propsSchema: {
      style: {
        type: 'select',
        label: 'Estilo',
        defaultValue: 'solid',
        options: [
          { label: 'Sólido', value: 'solid' },
          { label: 'Tracejado', value: 'dashed' },
          { label: 'Pontilhado', value: 'dotted' },
        ],
      },
      color: {
        type: 'color',
        label: 'Cor',
        defaultValue: '#e5e7eb',
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'Spacer',
    label: 'Espaçador',
    category: 'layout',
    icon: 'MoveVertical',
    defaultProps: {
      height: 'md',
    },
    propsSchema: {
      height: {
        type: 'select',
        label: 'Altura',
        defaultValue: 'md',
        options: [
          { label: 'Extra Pequeno', value: 'xs' },
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
          { label: 'Extra Grande', value: 'xl' },
        ],
      },
    },
    canHaveChildren: false,
  },

  // ========== HEADER / FOOTER BLOCKS ==========
  {
    type: 'Header',
    label: 'Cabeçalho',
    category: 'header-footer',
    icon: 'PanelTop',
    defaultProps: {
      menuId: '',
      showSearch: true,
      showCart: true,
      sticky: true,
      // Estilo do cabeçalho (Yampi)
      headerStyle: 'logo_left_menu_inline',
      headerBgColor: '',
      headerTextColor: '',
      headerIconColor: '',
      // Cores do menu (para estilos "menu abaixo")
      menuBgColor: '',
      menuTextColor: '',
      // Sticky mobile
      stickyOnMobile: true,
      // Contato no cabeçalho
      showWhatsApp: false,
      whatsAppNumber: '',
      whatsAppLabel: '',
      showPhone: false,
      phoneNumber: '',
      phoneLabel: '',
      // REMOVIDO: Categorias no cabeçalho (menu vem do Menu Builder)
      // Área do Cliente
      customerAreaEnabled: false,
      customerAreaLabel: 'Minhas compras',
      // Promoções em Destaque
      featuredPromosEnabled: false,
      featuredPromosLabel: 'Promoções',
      featuredPromosTextColor: '#d97706',
      featuredPromosPageId: '',
      featuredPromosPageSlug: '', // Legacy support
      // Barra Superior (Aviso Geral)
      noticeEnabled: false,
      noticeText: '',
      noticeBgColor: '', // Empty = inherits from theme primary color
      noticeTextColor: '#ffffff',
      noticeAnimation: 'fade',
      // Barra Superior - ação
      noticeActionEnabled: false,
      noticeActionLabel: '',
      noticeActionUrl: '',
      noticeActionTarget: '_self',
      noticeActionTextColor: '',
    },
    propsSchema: {
      // === ESTILO DO CABEÇALHO ===
      headerStyle: {
        type: 'select',
        label: 'Estilo do Cabeçalho',
        defaultValue: 'logo_left_menu_inline',
        options: [
          { label: 'Logo à esquerda, menu ao lado', value: 'logo_left_menu_inline' },
          { label: 'Logo à esquerda, menu abaixo', value: 'logo_left_menu_below' },
          { label: 'Logo centralizado, menu abaixo', value: 'logo_center_menu_below' },
        ],
      },
      // === CORES DO CABEÇALHO ===
      headerBgColor: {
        type: 'color',
        label: 'Cor de Fundo',
        placeholder: 'Padrão do tema',
      },
      headerTextColor: {
        type: 'color',
        label: 'Cor do Texto',
        placeholder: 'Padrão do tema',
      },
      headerIconColor: {
        type: 'color',
        label: 'Cor dos Ícones',
        placeholder: 'Padrão do tema',
      },
      // === CORES DO MENU (para estilos "menu abaixo") ===
      menuBgColor: {
        type: 'color',
        label: 'Cor de Fundo do Menu',
        placeholder: 'Mesmo do cabeçalho',
      },
      menuTextColor: {
        type: 'color',
        label: 'Cor do Texto do Menu',
        placeholder: 'Mesmo do cabeçalho',
      },
      // === CONFIGURAÇÕES GERAIS ===
      stickyOnMobile: {
        type: 'boolean',
        label: 'Fixar ao rolar (Mobile)',
        defaultValue: true,
      },
      sticky: {
        type: 'boolean',
        label: 'Fixo no Topo (Desktop)',
        defaultValue: true,
      },
      menuId: {
        type: 'menu',
        label: 'Menu',
        placeholder: 'Selecione um menu',
      },
      showSearch: {
        type: 'boolean',
        label: 'Mostrar Busca',
        defaultValue: true,
      },
      showCart: {
        type: 'boolean',
        label: 'Mostrar Carrinho',
        defaultValue: true,
      },
      // === CONTATO NO CABEÇALHO ===
      showWhatsApp: {
        type: 'boolean',
        label: 'Mostrar WhatsApp',
        defaultValue: false,
      },
      whatsAppNumber: {
        type: 'string',
        label: 'Número do WhatsApp',
        placeholder: 'Ex: 5511999999999',
      },
      whatsAppLabel: {
        type: 'string',
        label: 'Texto do WhatsApp (opcional)',
        placeholder: 'Ex: WhatsApp',
      },
      showPhone: {
        type: 'boolean',
        label: 'Mostrar Telefone',
        defaultValue: false,
      },
      phoneNumber: {
        type: 'string',
        label: 'Número do Telefone',
        placeholder: 'Ex: +55 (11) 99999-9999',
      },
      phoneLabel: {
        type: 'string',
        label: 'Texto do Telefone (opcional)',
        placeholder: 'Ex: Atendimento',
      },
      // REMOVIDO: Categorias no cabeçalho (menu vem do Menu Builder)
      // === ÁREA DO CLIENTE ===
      customerAreaEnabled: {
        type: 'boolean',
        label: 'Exibir "Minhas compras"',
        defaultValue: false,
      },
      customerAreaLabel: {
        type: 'string',
        label: 'Texto do link',
        defaultValue: 'Minhas compras',
        placeholder: 'Ex: Minhas compras',
      },
      // === PROMOÇÕES EM DESTAQUE ===
      featuredPromosEnabled: {
        type: 'boolean',
        label: 'Exibir link de Promoções',
        defaultValue: false,
      },
      featuredPromosLabel: {
        type: 'string',
        label: 'Texto do link',
        defaultValue: 'Promoções',
        placeholder: 'Ex: Promoções',
      },
      featuredPromosTextColor: {
        type: 'color',
        label: 'Cor do texto',
        defaultValue: '#d97706',
        placeholder: 'Ex: #d97706 (dourado)',
      },
      featuredPromosPageId: {
        type: 'string',
        label: 'Página de promoções',
        placeholder: 'Selecione uma página',
      },
      // Legacy prop - removed from schema as editor manages via ID now
      // === BARRA SUPERIOR (AVISO GERAL) ===
      noticeEnabled: {
        type: 'boolean',
        label: 'Exibir Barra Superior',
        defaultValue: false,
      },
      noticeText: {
        type: 'string',
        label: 'Texto',
        placeholder: 'Ex: Frete grátis em compras acima de R$199!',
      },
      noticeBgColor: {
        type: 'color',
        label: 'Cor de Fundo',
        defaultValue: '', // Empty = inherits from theme
        placeholder: 'Usar cor primária do tema',
      },
      noticeTextColor: {
        type: 'color',
        label: 'Cor do Texto',
        defaultValue: '#ffffff',
      },
      noticeAnimation: {
        type: 'select',
        label: 'Animação de Entrada',
        defaultValue: 'fade',
        options: [
          { label: 'Nenhuma', value: 'none' },
          { label: 'Fade', value: 'fade' },
          { label: 'Slide Vertical', value: 'slide-vertical' },
          { label: 'Slide Horizontal', value: 'slide-horizontal' },
          { label: 'Marquee (rolagem)', value: 'marquee' },
        ],
      },
      // Barra Superior - ação
      noticeActionEnabled: {
        type: 'boolean',
        label: 'Exibir Ação',
        defaultValue: false,
      },
      noticeActionLabel: {
        type: 'string',
        label: 'Texto da Ação',
        placeholder: 'Ex: Saiba mais',
      },
      noticeActionUrl: {
        type: 'string',
        label: 'URL da Ação',
        placeholder: 'Ex: /promocao',
      },
      noticeActionTarget: {
        type: 'select',
        label: 'Abrir em',
        defaultValue: '_self',
        options: [
          { label: 'Mesma aba', value: '_self' },
          { label: 'Nova aba', value: '_blank' },
        ],
      },
      noticeActionTextColor: {
        type: 'color',
        label: 'Cor do Texto da Ação',
      },
    },
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'Footer',
    label: 'Rodapé da Loja',
    category: 'header-footer',
    icon: 'PanelBottom',
    defaultProps: {
      // Seções (toggles)
      showLogo: true,
      showSac: true,
      showSocial: true,
      showLegal: true,
      // Conteúdo (override opcional)
      sacTitle: 'Atendimento (SAC)',
      legalTextOverride: '',
      // Cores do rodapé
      footerBgColor: '',
      footerTextColor: '',
      // Seções de imagens
      paymentMethods: { title: 'Formas de Pagamento', items: [] },
      securitySeals: { title: 'Selos de Segurança', items: [] },
      shippingMethods: { title: 'Formas de Envio', items: [] },
      officialStores: { title: 'Lojas Oficiais', items: [] },
    },
    propsSchema: {
      // === SEÇÕES ===
      showLogo: {
        type: 'boolean',
        label: 'Mostrar Logo',
        defaultValue: true,
      },
      showSac: {
        type: 'boolean',
        label: 'Mostrar Atendimento (SAC)',
        defaultValue: true,
      },
      showSocial: {
        type: 'boolean',
        label: 'Mostrar Redes Sociais',
        defaultValue: true,
      },
      showLegal: {
        type: 'boolean',
        label: 'Mostrar Informações Legais',
        defaultValue: true,
      },
      // === CONTEÚDO ===
      sacTitle: {
        type: 'string',
        label: 'Título do SAC',
        defaultValue: 'Atendimento (SAC)',
        placeholder: 'Ex: Atendimento ao Cliente',
      },
      legalTextOverride: {
        type: 'string',
        label: 'Texto Legal Personalizado',
        placeholder: 'Deixe vazio para usar dados da loja (CNPJ, endereço, etc.)',
      },
      // === CORES DO RODAPÉ ===
      footerBgColor: {
        type: 'color',
        label: 'Cor de Fundo',
        placeholder: 'Padrão do tema',
      },
      footerTextColor: {
        type: 'color',
        label: 'Cor do Texto',
        placeholder: 'Padrão do tema',
      },
      // === SEÇÕES DE IMAGENS ===
      paymentMethods: {
        type: 'array',
        label: 'Formas de Pagamento',
      },
      securitySeals: {
        type: 'array',
        label: 'Selos de Segurança',
      },
      shippingMethods: {
        type: 'array',
        label: 'Formas de Envio',
      },
      officialStores: {
        type: 'array',
        label: 'Lojas Oficiais',
      },
    },
    canHaveChildren: false,
    isRemovable: false,
  },

  // ========== CONTENT BLOCKS ==========
  // UNIFIED BANNER BLOCK (replaces Hero + HeroBanner)
  {
    type: 'Banner',
    label: 'Banner',
    category: 'media',
    icon: 'Image',
    defaultProps: {
      mode: 'single',
      // New Phase 1 props
      bannerType: 'image',
      hasEditableContent: false,
      // Single mode
      imageDesktop: '',
      imageMobile: '',
      title: '',
      subtitle: '',
      buttonText: '',
      buttonUrl: '',
      linkUrl: '',
      // Style
      backgroundColor: '',
      textColor: '#ffffff',
      buttonColor: '#ffffff',
      buttonTextColor: '',
      // Legacy props kept but unused in UI (backward compat only)
      buttonHoverBgColor: '',
      buttonHoverTextColor: '',
      overlayOpacity: 0,
      layoutPreset: 'standard',
      // Legacy (kept for backward compat, not shown in UI)
      height: 'auto',
      bannerWidth: 'full',
      // Carousel mode
      slides: [],
      autoplaySeconds: 5,
      showArrows: true,
      showDots: true,
    },
    // NOTE: Banner uses a custom panel (BannerPropsPanel) in PropsEditor.
    // The propsSchema below is kept for compatibility with AI fill, legacy fallback,
    // and documentation of all available props.
    propsSchema: {
      mode: {
        type: 'select',
        label: 'Modo',
        defaultValue: 'single',
        options: [
          { label: 'Banner Único', value: 'single' },
          { label: 'Carrossel', value: 'carousel' },
        ],
      },
      bannerType: {
        type: 'select',
        label: 'Tipo de Banner',
        defaultValue: 'image',
        options: [
          { label: 'Com Imagem', value: 'image' },
          { label: 'Cor de Fundo', value: 'solid' },
        ],
        showWhen: { mode: 'single' },
      },
      hasEditableContent: {
        type: 'boolean',
        label: 'Conteúdo editável (textos e botão)',
        defaultValue: false,
        showWhen: { mode: 'single' },
      },
      // === SINGLE MODE ===
      imageDesktop: {
        type: 'image',
        label: 'Imagem Desktop',
        helpText: 'Recomendado: 1920×800px (proporção 12:5)',
        showWhen: { mode: 'single' },
      },
      imageMobile: {
        type: 'image',
        label: 'Imagem Mobile',
        placeholder: 'Opcional - usa Desktop se vazio',
        helpText: 'Recomendado: 750×940px (proporção 4:5, vertical)',
        showWhen: { mode: 'single' },
      },
      linkUrl: {
        type: 'string',
        label: 'Link do Banner',
        placeholder: 'URL ao clicar no banner (sem CTA)',
        showWhen: { mode: 'single' },
      },
      // === CAROUSEL MODE ===
      slides: {
        type: 'array',
        label: 'Slides do Carrossel',
        defaultValue: [],
        helpText: 'Adicione slides com imagens para Desktop e Mobile',
        showWhen: { mode: 'carousel' },
      },
      autoplaySeconds: {
        type: 'number',
        label: 'Tempo de Autoplay (segundos)',
        defaultValue: 5,
        min: 0,
        max: 30,
        showWhen: { mode: 'carousel' },
      },
      showArrows: {
        type: 'boolean',
        label: 'Mostrar Setas',
        defaultValue: true,
        showWhen: { mode: 'carousel' },
      },
      showDots: {
        type: 'boolean',
        label: 'Mostrar Indicadores',
        defaultValue: true,
        showWhen: { mode: 'carousel' },
      },
      // === CTA OVERLAY (single mode, when hasEditableContent=true) ===
      title: {
        type: 'string',
        label: 'Título',
        placeholder: 'Texto principal do banner',
        showWhen: { mode: 'single', hasEditableContent: true },
        aiFillable: { hint: 'Título principal do banner, 3-8 palavras impactantes', format: 'text' },
      },
      subtitle: {
        type: 'string',
        label: 'Subtítulo',
        placeholder: 'Texto secundário',
        showWhen: { mode: 'single', hasEditableContent: true },
        aiFillable: { hint: 'Subtítulo do banner, 1 frase complementar ao título', format: 'text' },
      },
      buttonText: {
        type: 'string',
        label: 'Texto do Botão',
        placeholder: 'Ex: Ver Produtos',
        showWhen: { mode: 'single', hasEditableContent: true },
        aiFillable: { hint: 'Call-to-action curto, 2-4 palavras', format: 'cta' },
      },
      buttonUrl: {
        type: 'string',
        label: 'Link do Botão',
        placeholder: '/produtos',
        showWhen: { mode: 'single', hasEditableContent: true },
      },
      // === STYLE ===
      layoutPreset: {
        type: 'select',
        label: 'Modelo do Banner',
        defaultValue: 'standard',
        options: [
          { label: 'Padrão', value: 'standard' },
          { label: 'Compacto centralizado', value: 'compact-centered' },
          { label: 'Compacto cheio', value: 'compact-full' },
          { label: 'Grande', value: 'large' },
        ],
      },
      // Legacy props kept in schema for backward compat with AI and old data
      height: {
        type: 'select',
        label: 'Dimensão (legado)',
        defaultValue: 'auto',
        options: [
          { label: 'Proporcional', value: 'auto' },
          { label: 'Compacto', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
          { label: 'Tela Cheia', value: 'full' },
        ],
      },
      bannerWidth: {
        type: 'select',
        label: 'Largura (legado)',
        defaultValue: 'full',
        options: [
          { label: 'Largura Total', value: 'full' },
          { label: 'Contido', value: 'contained' },
        ],
      },
      // alignment and buttonAlignment removed from UI — layout is now fixed
      // buttonHoverBgColor and buttonHoverTextColor removed from UI — hover handled by CSS only
      backgroundColor: {
        type: 'color',
        label: 'Cor de Fundo',
        showWhen: { mode: 'single', bannerType: 'solid' },
      },
      textColor: {
        type: 'color',
        label: 'Cor do Texto',
        defaultValue: '#ffffff',
        showWhen: { mode: 'single', hasEditableContent: true },
      },
      overlayOpacity: {
        type: 'number',
        label: 'Escurecimento (%)',
        defaultValue: 0,
        min: 0,
        max: 100,
        showWhen: { mode: 'single' },
      },
      buttonColor: {
        type: 'color',
        label: 'Cor de Fundo do Botão',
        defaultValue: '#ffffff',
        showWhen: { mode: 'single', hasEditableContent: true },
      },
      buttonTextColor: {
        type: 'color',
        label: 'Cor do Texto do Botão',
        showWhen: { mode: 'single', hasEditableContent: true },
      },
      // buttonHoverBgColor and buttonHoverTextColor — removed from schema, kept in defaultProps for backward compat
    },
    canHaveChildren: false,
  },
  {
    type: 'RichText',
    label: 'Texto',
    category: 'content',
    icon: 'FileText',
    defaultProps: {
      content: '<p>Digite seu conteúdo aqui...</p>',
      fontFamily: 'inherit',
      fontSize: 'base',
      fontWeight: 'normal',
    },
    propsSchema: {
      content: {
        type: 'richtext',
        label: 'Conteúdo',
        defaultValue: '<p>Digite seu conteúdo aqui...</p>',
        aiFillable: { hint: 'Conteúdo informativo em HTML simples (p, strong, ul, li, h2, h3). 2-4 parágrafos.', format: 'html' },
      },
      fontFamily: {
        type: 'select',
        label: 'Fonte',
        defaultValue: 'inherit',
        options: [
          { label: 'Padrão do tema', value: 'inherit' },
          { label: 'Sans-serif', value: 'system-ui, sans-serif' },
          { label: 'Serif', value: 'Georgia, serif' },
          { label: 'Mono', value: 'monospace' },
          // Sans-serif fonts
          { label: 'Inter', value: 'Inter, sans-serif' },
          { label: 'Roboto', value: 'Roboto, sans-serif' },
          { label: 'Open Sans', value: 'Open Sans, sans-serif' },
          { label: 'Lato', value: 'Lato, sans-serif' },
          { label: 'Montserrat', value: 'Montserrat, sans-serif' },
          { label: 'Poppins', value: 'Poppins, sans-serif' },
          { label: 'Nunito', value: 'Nunito, sans-serif' },
          { label: 'Raleway', value: 'Raleway, sans-serif' },
          { label: 'Source Sans Pro', value: 'Source Sans Pro, sans-serif' },
          { label: 'Ubuntu', value: 'Ubuntu, sans-serif' },
          { label: 'Mulish', value: 'Mulish, sans-serif' },
          { label: 'Work Sans', value: 'Work Sans, sans-serif' },
          { label: 'Quicksand', value: 'Quicksand, sans-serif' },
          { label: 'DM Sans', value: 'DM Sans, sans-serif' },
          { label: 'Manrope', value: 'Manrope, sans-serif' },
          { label: 'Outfit', value: 'Outfit, sans-serif' },
          { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, sans-serif' },
          // Serif fonts
          { label: 'Playfair Display', value: 'Playfair Display, serif' },
          { label: 'Merriweather', value: 'Merriweather, serif' },
          { label: 'Lora', value: 'Lora, serif' },
          { label: 'PT Serif', value: 'PT Serif, serif' },
          { label: 'Crimson Text', value: 'Crimson Text, serif' },
          { label: 'Libre Baskerville', value: 'Libre Baskerville, serif' },
          { label: 'Cormorant Garamond', value: 'Cormorant Garamond, serif' },
          { label: 'EB Garamond', value: 'EB Garamond, serif' },
          { label: 'Bitter', value: 'Bitter, serif' },
          // Display fonts
          { label: 'Abril Fatface', value: 'Abril Fatface, serif' },
          { label: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
          { label: 'Oswald', value: 'Oswald, sans-serif' },
          { label: 'Josefin Sans', value: 'Josefin Sans, sans-serif' },
          { label: 'Righteous', value: 'Righteous, sans-serif' },
        ],
      },
      fontSize: {
        type: 'select',
        label: 'Tamanho',
        defaultValue: 'base',
        options: [
          { label: 'Extra Pequeno', value: 'xs' },
          { label: 'Pequeno', value: 'sm' },
          { label: 'Normal', value: 'base' },
          { label: 'Grande', value: 'lg' },
          { label: 'Extra Grande', value: 'xl' },
          { label: '2XL', value: '2xl' },
        ],
      },
      fontWeight: {
        type: 'select',
        label: 'Peso',
        defaultValue: 'normal',
        options: [
          { label: 'Normal', value: 'normal' },
          { label: 'Médio', value: '500' },
          { label: 'Semi-negrito', value: '600' },
          { label: 'Negrito', value: 'bold' },
        ],
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'PageContent',
    label: 'Conteúdo da Página',
    category: 'content',
    icon: 'FileInput',
    defaultProps: {},
    propsSchema: {},
    canHaveChildren: false,
  },
  {
    type: 'Image',
    label: 'Imagem',
    category: 'media',
    icon: 'ImageIcon',
    defaultProps: {
      imageDesktop: '',
      imageMobile: '',
      alt: 'Imagem',
      width: 'full',
      height: 'auto',
      objectFit: 'cover',
      objectPosition: 'center',
      aspectRatio: 'auto',
      rounded: 'none',
      shadow: 'none',
      linkUrl: '',
    },
    propsSchema: {
      imageDesktop: {
        type: 'image',
        label: 'Imagem Desktop',
        helpText: 'Recomendado: 1200×800px (proporção 3:2)',
      },
      imageMobile: {
        type: 'image',
        label: 'Imagem Mobile',
        placeholder: 'Opcional - usa Desktop se vazio',
        helpText: 'Recomendado: 800×1000px (proporção 4:5)',
      },
      alt: {
        type: 'string',
        label: 'Texto Alternativo',
        defaultValue: 'Imagem',
      },
      linkUrl: {
        type: 'string',
        label: 'Link (opcional)',
        placeholder: 'URL de destino ao clicar',
      },
      width: {
        type: 'select',
        label: 'Largura',
        defaultValue: 'full',
        options: [
          { label: '25%', value: '25' },
          { label: '50%', value: '50' },
          { label: '75%', value: '75' },
          { label: '100%', value: 'full' },
        ],
      },
      height: {
        type: 'select',
        label: 'Altura',
        defaultValue: 'auto',
        options: [
          { label: 'Automático', value: 'auto' },
          { label: '200px', value: '200px' },
          { label: '300px', value: '300px' },
          { label: '400px', value: '400px' },
          { label: '500px', value: '500px' },
          { label: '50vh', value: '50vh' },
          { label: '75vh', value: '75vh' },
        ],
      },
      aspectRatio: {
        type: 'select',
        label: 'Proporção',
        defaultValue: 'auto',
        options: [
          { label: 'Automático', value: 'auto' },
          { label: '1:1 (Quadrado)', value: '1:1' },
          { label: '4:3', value: '4:3' },
          { label: '16:9', value: '16:9' },
          { label: '21:9 (Ultra wide)', value: '21:9' },
        ],
      },
      objectFit: {
        type: 'select',
        label: 'Enquadramento',
        defaultValue: 'cover',
        options: [
          { label: 'Cobrir', value: 'cover' },
          { label: 'Conter', value: 'contain' },
          { label: 'Preencher', value: 'fill' },
          { label: 'Nenhum', value: 'none' },
        ],
      },
      objectPosition: {
        type: 'select',
        label: 'Posição',
        defaultValue: 'center',
        options: [
          { label: 'Centro', value: 'center' },
          { label: 'Topo', value: 'top' },
          { label: 'Baixo', value: 'bottom' },
          { label: 'Esquerda', value: 'left' },
          { label: 'Direita', value: 'right' },
        ],
      },
      rounded: {
        type: 'select',
        label: 'Bordas',
        defaultValue: 'none',
        options: [
          { label: 'Nenhum', value: 'none' },
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
          { label: 'Círculo', value: 'full' },
        ],
      },
      shadow: {
        type: 'select',
        label: 'Sombra',
        defaultValue: 'none',
        options: [
          { label: 'Nenhuma', value: 'none' },
          { label: 'Pequena', value: 'sm' },
          { label: 'Média', value: 'md' },
          { label: 'Grande', value: 'lg' },
        ],
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'Button',
    label: 'Botão',
    category: 'content',
    icon: 'MousePointerClick',
    defaultProps: {
      text: 'Clique Aqui',
      url: '#',
      variant: 'primary',
      size: 'md',
      alignment: 'left',
      fontFamily: 'inherit',
      fontWeight: 'semibold',
      backgroundColor: '',
      textColor: '',
      borderRadius: 'md',
      hoverBgColor: '',
      hoverTextColor: '',
      borderColor: '',
      hoverBorderColor: '',
    },
    propsSchema: {
      text: {
        type: 'string',
        label: 'Texto',
        defaultValue: 'Clique Aqui',
        aiFillable: { hint: 'Call-to-action curto, 2-5 palavras', format: 'cta' },
      },
      url: {
        type: 'string',
        label: 'Link',
        defaultValue: '#',
      },
      alignment: {
        type: 'select',
        label: 'Alinhamento',
        defaultValue: 'left',
        options: [
          { label: 'Esquerda', value: 'left' },
          { label: 'Centro', value: 'center' },
          { label: 'Direita', value: 'right' },
        ],
      },
      variant: {
        type: 'select',
        label: 'Estilo',
        defaultValue: 'primary',
        options: [
          { label: 'Primário', value: 'primary' },
          { label: 'Secundário', value: 'secondary' },
          { label: 'Contorno', value: 'outline' },
          { label: 'Fantasma', value: 'ghost' },
        ],
      },
      size: {
        type: 'select',
        label: 'Tamanho',
        defaultValue: 'md',
        options: [
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
        ],
      },
      fontFamily: {
        type: 'select',
        label: 'Fonte',
        defaultValue: 'inherit',
        options: [
          { label: 'Padrão do tema', value: 'inherit' },
          { label: 'Sans-serif', value: 'system-ui, sans-serif' },
          { label: 'Serif', value: 'Georgia, serif' },
          { label: 'Mono', value: 'monospace' },
          // Sans-serif fonts
          { label: 'Inter', value: 'Inter, sans-serif' },
          { label: 'Roboto', value: 'Roboto, sans-serif' },
          { label: 'Open Sans', value: 'Open Sans, sans-serif' },
          { label: 'Lato', value: 'Lato, sans-serif' },
          { label: 'Montserrat', value: 'Montserrat, sans-serif' },
          { label: 'Poppins', value: 'Poppins, sans-serif' },
          { label: 'Nunito', value: 'Nunito, sans-serif' },
          { label: 'Raleway', value: 'Raleway, sans-serif' },
          { label: 'DM Sans', value: 'DM Sans, sans-serif' },
          { label: 'Manrope', value: 'Manrope, sans-serif' },
          { label: 'Outfit', value: 'Outfit, sans-serif' },
          // Serif fonts
          { label: 'Playfair Display', value: 'Playfair Display, serif' },
          { label: 'Merriweather', value: 'Merriweather, serif' },
          { label: 'Lora', value: 'Lora, serif' },
          // Display fonts
          { label: 'Bebas Neue', value: 'Bebas Neue, sans-serif' },
          { label: 'Oswald', value: 'Oswald, sans-serif' },
        ],
      },
      fontWeight: {
        type: 'select',
        label: 'Peso da Fonte',
        defaultValue: 'semibold',
        options: [
          { label: 'Normal', value: 'normal' },
          { label: 'Médio', value: '500' },
          { label: 'Semi-negrito', value: 'semibold' },
          { label: 'Negrito', value: 'bold' },
        ],
      },
      backgroundColor: {
        type: 'color',
        label: 'Cor de Fundo',
      },
      textColor: {
        type: 'color',
        label: 'Cor do Texto',
      },
      hoverBgColor: {
        type: 'color',
        label: 'Cor de Fundo (Hover)',
      },
      hoverTextColor: {
        type: 'color',
        label: 'Cor do Texto (Hover)',
      },
      borderColor: {
        type: 'color',
        label: 'Cor da Borda',
      },
      hoverBorderColor: {
        type: 'color',
        label: 'Cor da Borda (Hover)',
      },
      borderRadius: {
        type: 'select',
        label: 'Bordas',
        defaultValue: 'md',
        options: [
          { label: 'Nenhum', value: 'none' },
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
          { label: 'Completo', value: 'full' },
        ],
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'FAQ',
    label: 'Perguntas Frequentes',
    category: 'content',
    icon: 'HelpCircle',
    defaultProps: {
      title: 'Perguntas Frequentes',
      items: [
        { question: 'Como faço para comprar?', answer: 'Adicione produtos ao carrinho e finalize o pedido.' },
        { question: 'Qual o prazo de entrega?', answer: 'O prazo varia conforme a região.' },
      ],
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Perguntas Frequentes',
        aiFillable: { hint: 'Título da seção de FAQ', format: 'text' },
      },
      titleAlign: {
        type: 'select',
        label: 'Alinhamento do título',
        options: [
          { value: 'left', label: 'Esquerda' },
          { value: 'center', label: 'Centro' },
          { value: 'right', label: 'Direita' },
        ],
        defaultValue: 'left',
      },
      items: {
        type: 'array',
        label: 'Perguntas',
        defaultValue: [],
        aiFillable: {
          hint: 'Perguntas frequentes relevantes ao negócio da loja',
          minItems: 3,
          maxItems: 6,
          itemSchema: {
            question: { hint: 'Pergunta clara e objetiva do cliente', enabled: true },
            answer: { hint: 'Resposta completa em 1-3 frases', enabled: true },
          },
        },
      },
      allowMultiple: {
        type: 'boolean',
        label: 'Permitir múltiplas abertas',
        defaultValue: false,
      },
    },
    canHaveChildren: false,
  },
  // CategoryPageLayout - Listagem de produtos de categoria com filtros (REGRAS.md)
  // NOTA: Este bloco NÃO possui propsSchema pois as configurações de categoria
  // são feitas via "Configurações do tema > Categoria" (CategorySettingsPanel)
  // e não via props do bloco. Isso evita que apareça painel de edição ao clicar.
  {
    type: 'CategoryPageLayout',
    label: 'Listagem de Categoria',
    category: 'ecommerce',
    icon: 'LayoutList',
    defaultProps: {
      showFilters: true,
      columns: 4,
      limit: 24,
    },
    // propsSchema vazio - configurações via CategorySettingsPanel
    propsSchema: {},
    canHaveChildren: false,
    isRemovable: false, // REGRAS.md: estrutura obrigatória
  },
  {
    type: 'ProductCard',
    label: 'Card de Produto',
    category: 'ecommerce',
    icon: 'Package',
    defaultProps: {
      productId: '',
      showPrice: true,
      showButton: true,
    },
    propsSchema: {
      productId: {
        type: 'product',
        label: 'Produto',
        placeholder: 'Selecione um produto',
      },
      showPrice: {
        type: 'boolean',
        label: 'Mostrar Preço',
        defaultValue: true,
      },
      showButton: {
        type: 'boolean',
        label: 'Mostrar Botão',
        defaultValue: true,
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'ProductDetails',
    label: 'Detalhes do Produto',
    category: 'ecommerce',
    icon: 'ShoppingBag',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Páginas > Produto
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'CartSummary',
    label: 'Resumo do Carrinho',
    category: 'ecommerce',
    icon: 'ShoppingCart',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Páginas > Carrinho
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'CheckoutSteps',
    label: 'Etapas do Checkout',
    category: 'ecommerce',
    icon: 'ListChecks',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Páginas > Checkout
    canHaveChildren: false,
    isRemovable: false,
  },

  {
    type: 'FeaturedCategories',
    label: 'Categorias em Destaque',
    category: 'ecommerce',
    icon: 'Circle',
    defaultProps: {
      title: 'Categorias',
      items: [],
      mobileStyle: 'carousel',
      showName: true,
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', defaultValue: 'Categorias' },
      items: {
        type: 'categoryMultiSelect',
        label: 'Categorias',
        max: 12,
        helpText: 'Selecione as categorias a exibir',
      },
      showName: { type: 'boolean', label: 'Exibir Nome', defaultValue: true },
      mobileStyle: {
        type: 'select',
        label: 'Estilo Mobile',
        defaultValue: 'carousel',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Carrossel', value: 'carousel' },
        ],
      },
    },
    canHaveChildren: false,
  },
  {
    // REGRAS.md linha 77: Banner configurado SOMENTE no menu Categorias
    // Sem opções de edição no builder - propsSchema vazio = sem painel direito
    type: 'CategoryBanner',
    label: 'Banner da Categoria',
    category: 'ecommerce',
    icon: 'Image',
    defaultProps: {},
    propsSchema: {},
    canHaveChildren: false,
  },
  {
    type: 'BannerProducts',
    label: 'Banner + Produtos',
    category: 'ecommerce',
    icon: 'Layers',
    defaultProps: {
      title: 'Oferta Especial',
      description: '',
      imageDesktop: '',
      imageMobile: '',
      source: 'manual',
      productIds: [],
      categoryId: '',
      limit: 4,
      showCta: false,
      ctaText: 'Ver mais',
      ctaUrl: '',
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Oferta Especial',
        aiFillable: { hint: 'Título chamativo para banner de oferta/promoção de produtos', format: 'text' },
      },
      description: {
        type: 'string',
        label: 'Descrição',
        placeholder: 'Descrição opcional',
        aiFillable: { hint: 'Descrição curta da promoção ou oferta (1-2 frases)', format: 'text' },
      },
      imageDesktop: {
        type: 'image',
        label: 'Imagem Desktop',
        placeholder: 'URL da imagem desktop',
        helpText: 'Recomendado: 600×400px (proporção 3:2)',
      },
      imageMobile: {
        type: 'image',
        label: 'Imagem Mobile',
        placeholder: 'URL da imagem mobile (opcional)',
        helpText: 'Recomendado: 400×500px (proporção 4:5)',
      },
      source: {
        type: 'select',
        label: 'Fonte dos Produtos',
        defaultValue: 'manual',
        options: [
          { label: 'Selecionados (manual)', value: 'manual' },
          { label: 'Categoria', value: 'category' },
        ],
      },
      productIds: {
        type: 'productMultiSelect',
        label: 'Produtos',
        showWhen: { source: 'manual' },
      },
      categoryId: {
        type: 'category',
        label: 'Categoria',
        placeholder: 'Selecione uma categoria',
        showWhen: { source: 'category' },
      },
      limit: {
        type: 'number',
        label: 'Limite de Produtos',
        defaultValue: 4,
        min: 2,
        max: 8,
      },
      showCta: {
        type: 'boolean',
        label: 'Mostrar CTA',
        defaultValue: false,
      },
      ctaText: {
        type: 'string',
        label: 'Texto do CTA',
        defaultValue: 'Ver mais',
        aiFillable: { hint: 'Texto curto e persuasivo para o botão de ação (2-4 palavras)', format: 'cta' },
      },
      ctaUrl: {
        type: 'string',
        label: 'URL do CTA',
        placeholder: 'Link do botão',
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'VideoCarousel',
    label: 'Carrossel de Vídeos',
    category: 'media',
    icon: 'PlayCircle',
    defaultProps: {
      title: '',
      videos: [],
      videosJson: '',
      showControls: true,
      aspectRatio: '16:9',
      maxWidth: 'full',
      layout: 'carousel',
      itemsPerSlide: 1,
      itemsPerRow: 3,
      itemsPerPage: 6,
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título (opcional)',
        placeholder: 'Nossos Vídeos',
      },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'carousel',
        options: [
          { label: 'Carrossel (deslizante)', value: 'carousel' },
          { label: 'Grade (múltiplos)', value: 'grid' },
        ],
      },
      maxWidth: {
        type: 'select',
        label: 'Largura Máxima',
        defaultValue: 'full',
        options: [
          { label: 'Pequeno (448px)', value: 'small' },
          { label: 'Médio (576px)', value: 'medium' },
          { label: 'Grande (768px)', value: 'large' },
          { label: 'Tela cheia', value: 'full' },
        ],
        helpText: 'Controla a largura máxima do bloco. Ideal usar "Médio" ou "Grande" para vídeos verticais (9:16)',
      },
      itemsPerSlide: {
        type: 'select',
        label: 'Itens por Slide',
        defaultValue: '1',
        options: [
          { label: '1 vídeo', value: '1' },
          { label: '2 vídeos', value: '2' },
          { label: '3 vídeos', value: '3' },
          { label: '4 vídeos', value: '4' },
        ],
        showWhen: { layout: 'carousel' },
        helpText: 'Quantos vídeos visíveis ao mesmo tempo no carrossel',
      },
      showControls: {
        type: 'boolean',
        label: 'Mostrar setas de navegação',
        defaultValue: true,
        showWhen: { layout: 'carousel' },
      },
      itemsPerRow: {
        type: 'select',
        label: 'Itens por Linha',
        defaultValue: '3',
        options: [
          { label: '1 coluna', value: '1' },
          { label: '2 colunas', value: '2' },
          { label: '3 colunas', value: '3' },
          { label: '4 colunas', value: '4' },
        ],
        showWhen: { layout: 'grid' },
      },
      itemsPerPage: {
        type: 'select',
        label: 'Itens por Página',
        defaultValue: '6',
        options: [
          { label: '3 vídeos', value: '3' },
          { label: '6 vídeos', value: '6' },
          { label: '9 vídeos', value: '9' },
          { label: '12 vídeos', value: '12' },
        ],
        showWhen: { layout: 'grid' },
      },
      videos: {
        type: 'array',
        label: 'Vídeos',
        helpText: 'YouTube: use "url". Upload: use "videoDesktop" e "videoMobile" (ou só videoDesktop)',
      },
      videosJson: {
        type: 'textarea',
        label: 'URLs dos Vídeos (alternativo)',
        placeholder: 'https://youtube.com/watch?v=abc123\nhttps://youtu.be/xyz456',
        helpText: 'Cole URLs do YouTube (uma por linha) ou JSON de vídeos',
      },
      aspectRatio: {
        type: 'select',
        label: 'Proporção',
        defaultValue: '16:9',
        options: [
          { label: '16:9 (Horizontal)', value: '16:9' },
          { label: '4:3 (Clássico)', value: '4:3' },
          { label: '1:1 (Quadrado)', value: '1:1' },
          { label: '9:16 (Vertical)', value: '9:16' },
        ],
      },
    },
    canHaveChildren: false,
  },
  // ========== ESSENTIAL ECOMMERCE BLOCKS (non-removable) ==========
  // ========== SYSTEM BLOCKS (Config via Theme Settings > Pages only) ==========
  // NOTE: propsSchema removed - all settings managed in Configurações do tema > Páginas
  {
    type: 'Cart',
    label: 'Carrinho',
    category: 'ecommerce',
    icon: 'ShoppingCart',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Pages > Carrinho
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'Checkout',
    label: 'Checkout',
    category: 'ecommerce',
    icon: 'CreditCard',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Pages > Checkout
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'ThankYou',
    label: 'Confirmação de Pedido',
    category: 'ecommerce',
    icon: 'CheckCircle',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Pages > Obrigado
    canHaveChildren: false,
    isRemovable: false,
  },
  // ========== ACCOUNT BLOCKS (essential, non-removable) ==========
  {
    type: 'AccountHub',
    label: 'Hub da Conta',
    category: 'ecommerce',
    icon: 'User',
    defaultProps: {},
    propsSchema: {},
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'OrdersList',
    label: 'Lista de Pedidos',
    category: 'ecommerce',
    icon: 'Package',
    defaultProps: {},
    propsSchema: {},
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'OrderDetail',
    label: 'Detalhe do Pedido',
    category: 'ecommerce',
    icon: 'FileText',
    defaultProps: {},
    propsSchema: {},
    canHaveChildren: false,
    isRemovable: false,
  },
  // ========== SYSTEM BLOCKS (Rastreio, Blog) - Config via Theme Settings ==========
  {
    type: 'TrackingLookup',
    label: 'Rastrear Pedido',
    category: 'ecommerce',
    icon: 'Package',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Pages > Rastreio
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'BlogListing',
    label: 'Listagem do Blog',
    category: 'content',
    icon: 'FileText',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Pages > Blog
    canHaveChildren: false,
    isRemovable: false,
  },
  // ========== UNIFIED BLOCKS ==========
  {
    type: 'CustomCode',
    label: 'Código Customizado',
    category: 'content',
    icon: 'Code',
    defaultProps: {
      source: 'inline',
      htmlContent: '<div style="padding: 40px; text-align: center; background: #f0f0f0;">\n  <h2>Código Customizado</h2>\n  <p>Edite o HTML e CSS nas propriedades do bloco.</p>\n</div>',
      cssContent: '',
      blockName: 'Código Customizado',
      baseUrl: '',
      customBlockId: '',
    },
    propsSchema: {
      source: {
        type: 'select',
        label: 'Fonte do Conteúdo',
        defaultValue: 'inline',
        options: [
          { label: 'HTML Direto', value: 'inline' },
          { label: 'Banco de Dados', value: 'database' },
        ],
      },
      customBlockId: {
        type: 'string',
        label: 'ID do Bloco (DB)',
        placeholder: 'UUID do custom_blocks',
        showWhen: { source: 'database' },
      },
      htmlContent: {
        type: 'textarea',
        label: 'Código HTML',
        placeholder: '<div>Seu HTML aqui...</div>',
      },
      cssContent: {
        type: 'textarea',
        label: 'Código CSS',
        placeholder: '.minha-classe { color: red; }',
      },
      blockName: {
        type: 'string',
        label: 'Nome do Bloco',
        defaultValue: 'Código Customizado',
      },
      baseUrl: {
        type: 'string',
        label: 'URL Base (para imagens relativas)',
        placeholder: 'https://exemplo.com/',
      },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'Highlights',
    label: 'Destaques / Benefícios',
    category: 'content',
    icon: 'Award',
    defaultProps: {
      style: 'bar',
      items: [
        { id: '1', icon: 'Truck', title: 'Frete Grátis', description: 'Em compras acima de R$199' },
        { id: '2', icon: 'CreditCard', title: 'Parcelamento', description: 'Em até 12x sem juros' },
        { id: '3', icon: 'Shield', title: 'Compra Segura', description: 'Seus dados protegidos' },
      ],
      layout: 'horizontal',
      iconColor: '',
      textColor: '',
      backgroundColor: 'transparent',
      showButton: false,
      buttonText: 'Saiba mais',
      buttonUrl: '#',
    },
    propsSchema: {
      style: {
        type: 'select',
        label: 'Estilo',
        defaultValue: 'bar',
        options: [
          { label: 'Barra (horizontal compacto)', value: 'bar' },
          { label: 'Lista (vertical com ícones)', value: 'list' },
        ],
      },
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: '',
        aiFillable: { hint: 'Título da seção de benefícios/features', format: 'text' },
      },
      subtitle: {
        type: 'string',
        label: 'Subtítulo',
        defaultValue: '',
        showWhen: { style: 'list' },
      },
      items: {
        type: 'array',
        label: 'Itens',
        defaultValue: [],
        aiFillable: {
          hint: 'Benefícios/diferenciais da loja (frete grátis, parcelamento, segurança, etc.)',
          minItems: 3,
          maxItems: 5,
          itemSchema: {
            icon: { hint: 'Nome do ícone Lucide (Truck, CreditCard, Shield, Check, etc.)', enabled: true },
            title: { hint: 'Benefício em 2-4 palavras', enabled: true },
            description: { hint: 'Descrição curta em 1 frase', enabled: true },
          },
        },
      },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'horizontal',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
        ],
        showWhen: { style: 'bar' },
      },
      iconColor: {
        type: 'color',
        label: 'Cor dos Ícones',
        placeholder: 'Padrão do tema',
      },
      textColor: {
        type: 'color',
        label: 'Cor do Texto',
        placeholder: 'Padrão do tema',
      },
      backgroundColor: {
        type: 'color',
        label: 'Cor de Fundo',
        defaultValue: 'transparent',
        showWhen: { style: 'list' },
      },
      showButton: {
        type: 'boolean',
        label: 'Mostrar Botão',
        defaultValue: false,
        showWhen: { style: 'list' },
      },
      buttonText: {
        type: 'string',
        label: 'Texto do Botão',
        defaultValue: 'Saiba mais',
        showWhen: { style: 'list' },
      },
      buttonUrl: {
        type: 'string',
        label: 'Link do Botão',
        defaultValue: '#',
        showWhen: { style: 'list' },
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'Video',
    label: 'Vídeo',
    category: 'media',
    icon: 'Video',
    defaultProps: {
      source: 'youtube',
      title: '',
      youtubeUrl: '',
      widthPreset: 'lg',
      aspectRatio: '16:9',
      videoDesktop: '',
      videoMobile: '',
      controls: true,
      autoplay: false,
      loop: false,
      muted: false,
      objectFit: 'contain',
    },
    propsSchema: {
      source: {
        type: 'select',
        label: 'Fonte do Vídeo',
        defaultValue: 'youtube',
        options: [
          { label: 'YouTube', value: 'youtube' },
          { label: 'Upload', value: 'upload' },
        ],
      },
      title: {
        type: 'string',
        label: 'Título (opcional)',
        placeholder: 'Título da seção',
        showWhen: { source: 'youtube' },
      },
      youtubeUrl: {
        type: 'string',
        label: 'URL do YouTube',
        placeholder: 'https://www.youtube.com/watch?v=...',
        showWhen: { source: 'youtube' },
      },
      widthPreset: {
        type: 'select',
        label: 'Largura do vídeo',
        defaultValue: 'lg',
        options: [
          { label: 'Pequeno (sm)', value: 'sm' },
          { label: 'Médio (md)', value: 'md' },
          { label: 'Grande (lg)', value: 'lg' },
          { label: 'Extra grande (xl)', value: 'xl' },
          { label: 'Largura total', value: 'full' },
        ],
        showWhen: { source: 'youtube' },
      },
      videoDesktop: {
        type: 'video',
        label: 'Vídeo Desktop',
        helpText: 'MP4, WEBM ou MOV',
        showWhen: { source: 'upload' },
      },
      videoMobile: {
        type: 'video',
        label: 'Vídeo Mobile',
        placeholder: 'Opcional - usa Desktop se vazio',
        showWhen: { source: 'upload' },
      },
      aspectRatio: {
        type: 'select',
        label: 'Proporção',
        defaultValue: '16:9',
        options: [
          { label: '16:9 (Horizontal)', value: '16:9' },
          { label: '4:3 (Clássico)', value: '4:3' },
          { label: '1:1 (Quadrado)', value: '1:1' },
          { label: '9:16 (Vertical)', value: '9:16' },
        ],
      },
      objectFit: {
        type: 'select',
        label: 'Encaixe',
        defaultValue: 'contain',
        options: [
          { label: 'Mostrar inteiro (contain)', value: 'contain' },
          { label: 'Preencher (cover)', value: 'cover' },
          { label: 'Esticar (fill)', value: 'fill' },
        ],
        showWhen: { source: 'upload' },
      },
      controls: {
        type: 'boolean',
        label: 'Mostrar Controles',
        defaultValue: true,
        showWhen: { source: 'upload' },
      },
      autoplay: {
        type: 'boolean',
        label: 'Reprodução Automática',
        defaultValue: false,
        showWhen: { source: 'upload' },
      },
      loop: {
        type: 'boolean',
        label: 'Repetir',
        defaultValue: false,
        showWhen: { source: 'upload' },
      },
      muted: {
        type: 'boolean',
        label: 'Sem Som (Mudo)',
        defaultValue: false,
        showWhen: { source: 'upload' },
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'SocialProof',
    label: 'Prova Social',
    category: 'content',
    icon: 'Star',
    defaultProps: {
      mode: 'testimonials',
      title: 'O que dizem nossos clientes',
      items: [
        { name: 'Maria Silva', content: 'Excelente atendimento! Recomendo!', rating: 5, role: 'Cliente verificada' },
        { name: 'João Santos', content: 'Produto chegou antes do prazo.', rating: 5, role: 'Cliente desde 2023' },
        { name: 'Ana Costa', content: 'Ótima experiência de compra!', rating: 4, role: 'Cliente fiel' },
      ],
      reviews: [],
      visibleCount: 3,
    },
    propsSchema: {
      mode: {
        type: 'select',
        label: 'Modo',
        defaultValue: 'testimonials',
        options: [
          { label: 'Depoimentos (texto simples)', value: 'testimonials' },
          { label: 'Avaliações (com estrelas e produto)', value: 'reviews' },
        ],
      },
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'O que dizem nossos clientes',
        aiFillable: { hint: 'Título da seção de depoimentos/avaliações', format: 'text' },
      },
      items: {
        type: 'array',
        label: 'Depoimentos',
        defaultValue: [],
        showWhen: { mode: 'testimonials' },
        aiFillable: {
          hint: 'Depoimentos de clientes satisfeitos',
          minItems: 3,
          maxItems: 5,
          itemSchema: {
            name: { hint: 'Nome brasileiro realista', enabled: true },
            content: { hint: 'Depoimento positivo em 1-2 frases', enabled: true },
            rating: { hint: 'Nota 4 ou 5', enabled: true },
            role: { hint: 'Descrição como "Cliente verificada"', enabled: true },
          },
        },
      },
      reviews: {
        type: 'array',
        label: 'Avaliações',
        defaultValue: [],
        showWhen: { mode: 'reviews' },
        aiFillable: {
          hint: 'Avaliações de clientes com produto',
          minItems: 3,
          maxItems: 5,
          itemSchema: {
            name: { hint: 'Nome brasileiro realista (ex: Maria S.)', enabled: true },
            rating: { hint: 'Nota 4 ou 5', enabled: true },
            text: { hint: 'Avaliação positiva em 1-2 frases', enabled: true },
          },
        },
      },
      visibleCount: {
        type: 'number',
        label: 'Quantidade Visível',
        defaultValue: 3,
        min: 1,
        max: 10,
        showWhen: { mode: 'reviews' },
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'ContentSection',
    label: 'Conteúdo + Imagem',
    category: 'content',
    icon: 'Columns',
    defaultProps: {
      style: 'content',
      title: 'Título da Seção',
      subtitle: '',
      content: '',
      imageDesktop: '',
      imageMobile: '',
      imagePosition: 'left',
      features: [],
      iconColor: '',
      showButton: false,
      buttonText: 'Saiba mais',
      buttonUrl: '#',
      backgroundColor: 'transparent',
      textColor: '',
      text: '',
      imageDesktop1: '',
      imageMobile1: '',
      imageDesktop2: '',
      imageMobile2: '',
      ctaEnabled: true,
      ctaText: 'Saiba mais',
      ctaUrl: '#',
      ctaBgColor: '',
      ctaTextColor: '',
      layout: 'text-left',
    },
    propsSchema: {
      style: {
        type: 'select',
        label: 'Estilo',
        defaultValue: 'content',
        options: [
          { label: 'Conteúdo (1 imagem + texto + features)', value: 'content' },
          { label: 'Editorial (2 imagens + texto)', value: 'editorial' },
        ],
      },
      title: {
        type: 'string',
        label: 'Título',
        aiFillable: { hint: 'Título da seção de conteúdo', format: 'text' },
      },
      subtitle: {
        type: 'string',
        label: 'Subtítulo',
        showWhen: { style: 'content' },
      },
      content: {
        type: 'richtext',
        label: 'Conteúdo',
        showWhen: { style: 'content' },
        aiFillable: { hint: 'Conteúdo descritivo em HTML simples', format: 'html' },
      },
      text: {
        type: 'textarea',
        label: 'Texto',
        showWhen: { style: 'editorial' },
        aiFillable: { hint: 'Texto descritivo sobre a marca', format: 'text' },
      },
      imageDesktop: {
        type: 'image',
        label: 'Imagem Desktop',
        showWhen: { style: 'content' },
      },
      imageMobile: {
        type: 'image',
        label: 'Imagem Mobile',
        showWhen: { style: 'content' },
      },
      imagePosition: {
        type: 'select',
        label: 'Posição da Imagem',
        defaultValue: 'left',
        options: [
          { label: 'Esquerda', value: 'left' },
          { label: 'Direita', value: 'right' },
        ],
        showWhen: { style: 'content' },
      },
      features: {
        type: 'array',
        label: 'Features',
        showWhen: { style: 'content' },
        aiFillable: {
          hint: 'Lista de diferenciais curtos',
          minItems: 0,
          maxItems: 4,
          itemSchema: {
            icon: { hint: 'Nome do ícone Lucide', enabled: true },
            text: { hint: 'Benefício em 1 frase curta', enabled: true },
          },
        },
      },
      iconColor: {
        type: 'color',
        label: 'Cor dos Ícones',
        showWhen: { style: 'content' },
      },
      showButton: {
        type: 'boolean',
        label: 'Mostrar Botão',
        defaultValue: false,
        showWhen: { style: 'content' },
      },
      buttonText: {
        type: 'string',
        label: 'Texto do Botão',
        showWhen: { style: 'content' },
      },
      buttonUrl: {
        type: 'string',
        label: 'Link do Botão',
        showWhen: { style: 'content' },
      },
      backgroundColor: {
        type: 'color',
        label: 'Cor de Fundo',
        showWhen: { style: 'content' },
      },
      textColor: {
        type: 'color',
        label: 'Cor do Texto',
        showWhen: { style: 'content' },
      },
      imageDesktop1: {
        type: 'image',
        label: 'Imagem 1 (Desktop)',
        showWhen: { style: 'editorial' },
      },
      imageMobile1: {
        type: 'image',
        label: 'Imagem 1 (Mobile)',
        showWhen: { style: 'editorial' },
      },
      imageDesktop2: {
        type: 'image',
        label: 'Imagem 2 (Desktop)',
        showWhen: { style: 'editorial' },
      },
      imageMobile2: {
        type: 'image',
        label: 'Imagem 2 (Mobile)',
        showWhen: { style: 'editorial' },
      },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'text-left',
        options: [
          { label: 'Texto à esquerda', value: 'text-left' },
          { label: 'Texto à direita', value: 'text-right' },
        ],
        showWhen: { style: 'editorial' },
      },
      ctaEnabled: {
        type: 'boolean',
        label: 'Mostrar CTA',
        defaultValue: true,
        showWhen: { style: 'editorial' },
      },
      ctaText: {
        type: 'string',
        label: 'Texto do CTA',
        showWhen: { style: 'editorial' },
      },
      ctaUrl: {
        type: 'string',
        label: 'URL do CTA',
        showWhen: { style: 'editorial' },
      },
      ctaBgColor: {
        type: 'color',
        label: 'Cor de Fundo do CTA',
        showWhen: { style: 'editorial' },
      },
      ctaTextColor: {
        type: 'color',
        label: 'Cor do Texto do CTA',
        showWhen: { style: 'editorial' },
      },
    },
    canHaveChildren: false,
  },

  // ========== NEW BLOCKS (6 novos) ==========
  {
    type: 'StepsTimeline',
    label: 'Passos / Timeline',
    category: 'content',
    icon: 'ListOrdered',
    defaultProps: {
      title: 'Como Funciona',
      subtitle: '',
      steps: [
        { number: 1, title: 'Passo 1', description: 'Descrição do primeiro passo' },
        { number: 2, title: 'Passo 2', description: 'Descrição do segundo passo' },
        { number: 3, title: 'Passo 3', description: 'Descrição do terceiro passo' },
      ],
      layout: 'horizontal',
      accentColor: '',
      showNumbers: true,
      backgroundColor: 'transparent',
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da seção de passos/timeline', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo complementar', format: 'text' } },
      steps: { type: 'array', label: 'Passos', aiFillable: { hint: 'Etapas de um processo (compra, entrega, etc.)', minItems: 3, maxItems: 5, itemSchema: { title: { hint: 'Título do passo em 2-4 palavras', enabled: true }, description: { hint: 'Descrição do passo em 1 frase', enabled: true }, number: { hint: 'Número sequencial', enabled: true } } } },
      layout: { type: 'select', label: 'Layout', options: [{ label: 'Horizontal', value: 'horizontal' }, { label: 'Vertical', value: 'vertical' }] },
      accentColor: { type: 'color', label: 'Cor de Destaque' },
      showNumbers: { type: 'boolean', label: 'Mostrar Números' },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'CountdownTimer',
    label: 'Contador Regressivo',
    category: 'content',
    icon: 'Timer',
    defaultProps: {
      title: 'Oferta por tempo limitado',
      subtitle: '',
      endDate: '',
      showDays: true,
      showHours: true,
      showMinutes: true,
      showSeconds: true,
      backgroundColor: '#dc2626',
      textColor: '#ffffff',
      expiredMessage: 'Oferta encerrada',
      buttonText: '',
      buttonUrl: '',
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título de urgência para oferta', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo reforçando a urgência', format: 'text' } },
      endDate: { type: 'datetime', label: 'Data de Término', helpText: 'Selecione a data e hora que a oferta termina' },
      showDays: { type: 'boolean', label: 'Mostrar Dias' },
      showHours: { type: 'boolean', label: 'Mostrar Horas' },
      showMinutes: { type: 'boolean', label: 'Mostrar Minutos' },
      showSeconds: { type: 'boolean', label: 'Mostrar Segundos' },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
      textColor: { type: 'color', label: 'Cor do Texto' },
      expiredMessage: { type: 'string', label: 'Mensagem de Expirado', aiFillable: { hint: 'Mensagem quando a oferta encerrar', format: 'feedback' } },
      buttonText: { type: 'string', label: 'Texto do Botão', aiFillable: { hint: 'Call-to-action de urgência, 2-4 palavras', format: 'cta' } },
      buttonUrl: { type: 'string', label: 'URL do Botão' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'LogosCarousel',
    label: 'Logos / Parceiros',
    category: 'content',
    icon: 'Building2',
    defaultProps: {
      title: 'Nossos Parceiros',
      subtitle: '',
      logos: [],
      autoplay: true,
      grayscale: true,
      columns: 5,
      backgroundColor: 'transparent',
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da seção de logos/parceiros (ex: Nossos Parceiros, Marcas que confiam)', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo complementar sobre os parceiros ou marcas', format: 'text' } },
      logos: { type: 'array', label: 'Logos' },
      autoplay: { type: 'boolean', label: 'Autoplay' },
      grayscale: { type: 'boolean', label: 'Escala de Cinza' },
      columns: { type: 'select', label: 'Colunas', options: [{ label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' }] },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'StatsNumbers',
    label: 'Estatísticas',
    category: 'content',
    icon: 'BarChart3',
    defaultProps: {
      title: '',
      subtitle: '',
      items: [
        { number: '10k+', label: 'Clientes satisfeitos' },
        { number: '99%', label: 'Aprovação' },
        { number: '24h', label: 'Entrega' },
      ],
      layout: 'horizontal',
      animateNumbers: true,
      backgroundColor: 'transparent',
      accentColor: '',
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da seção de estatísticas', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo complementar', format: 'text' } },
      items: { type: 'array', label: 'Estatísticas', aiFillable: { hint: 'Números impressionantes do negócio', minItems: 3, maxItems: 4, itemSchema: { number: { hint: 'Número formatado (ex: 10k+, 99%, 24h)', enabled: true }, label: { hint: 'Label curto do número', enabled: true } } } },
      layout: { type: 'select', label: 'Layout', options: [{ label: 'Horizontal', value: 'horizontal' }, { label: 'Grid', value: 'grid' }] },
      animateNumbers: { type: 'boolean', label: 'Animar Números' },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
      accentColor: { type: 'color', label: 'Cor de Destaque' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'ImageGallery',
    label: 'Galeria de Imagens',
    category: 'media',
    icon: 'Images',
    defaultProps: {
      title: '',
      subtitle: '',
      images: [],
      layout: 'grid',
      columns: 3,
      gap: 'md',
      enableLightbox: true,
      aspectRatio: 'square',
      borderRadius: 8,
      backgroundColor: 'transparent',
      slidesPerView: 1,
      autoplay: false,
      autoplayInterval: 5,
      showArrows: true,
      showDots: true,
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da galeria de imagens (ex: Nossa Galeria, Inspire-se)', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo descritivo da galeria', format: 'text' } },
      images: { type: 'array', label: 'Imagens' },
      layout: {
        type: 'select',
        label: 'Layout',
        options: [{ label: 'Grade', value: 'grid' }, { label: 'Carrossel', value: 'carousel' }],
      },
      columns: { type: 'select', label: 'Colunas', options: [{ label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }], showWhen: { layout: 'grid' } },
      borderRadius: { type: 'number', label: 'Arredondamento (px)', showWhen: { layout: 'grid' } },
      slidesPerView: {
        type: 'select',
        label: 'Itens por Slide',
        options: [{ label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }],
        showWhen: { layout: 'carousel' },
      },
      autoplay: { type: 'boolean', label: 'Autoplay', showWhen: { layout: 'carousel' } },
      autoplayInterval: { type: 'number', label: 'Intervalo de Autoplay (s)', defaultValue: 5, min: 1, max: 30, showWhen: { layout: 'carousel' } },
      showArrows: { type: 'boolean', label: 'Mostrar Setas', defaultValue: true, showWhen: { layout: 'carousel' } },
      showDots: { type: 'boolean', label: 'Mostrar Indicadores', defaultValue: true, showWhen: { layout: 'carousel' } },
      gap: { type: 'select', label: 'Espaçamento', options: [{ label: 'Pequeno', value: 'sm' }, { label: 'Médio', value: 'md' }, { label: 'Grande', value: 'lg' }] },
      enableLightbox: { type: 'boolean', label: 'Habilitar Lightbox' },
      aspectRatio: {
        type: 'select',
        label: 'Proporção',
        options: [
          { label: 'Quadrado', value: 'square' },
          { label: '4:3', value: '4:3' },
          { label: '16:9', value: '16:9' },
          { label: '1:1', value: '1:1' },
          { label: '21:9', value: '21:9' },
          { label: 'Auto', value: 'auto' },
        ],
      },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },

  {
    type: 'ContactForm',
    label: 'Formulário de Contato',
    category: 'content',
    icon: 'MessageSquare',
    defaultProps: {
      title: 'Entre em Contato',
      subtitle: 'Preencha o formulário abaixo e entraremos em contato em breve.',
      layout: 'simple',
      showName: true,
      showPhone: false,
      showSubject: true,
      nameLabel: 'Nome',
      emailLabel: 'E-mail',
      phoneLabel: 'Telefone',
      subjectLabel: 'Assunto',
      messageLabel: 'Mensagem',
      buttonText: 'Enviar Mensagem',
      successMessage: 'Mensagem enviada com sucesso! Entraremos em contato em breve.',
      showContactInfo: true,
      contactEmail: 'contato@sualoja.com',
      contactPhone: '(11) 99999-9999',
      contactAddress: 'Rua Exemplo, 123 - São Paulo, SP',
      contactHours: 'Seg - Sex: 9h às 18h',
      backgroundColor: '',
      textColor: '',
      buttonBgColor: '',
      buttonTextColor: '',
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da seção de contato', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo convidativo para entrar em contato', format: 'text' } },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'simple',
        options: [
          { label: 'Simples', value: 'simple' },
          { label: 'Com Informações', value: 'with-info' },
          { label: 'Lado a Lado', value: 'split' },
        ],
      },
      showName: { type: 'boolean', label: 'Campo Nome', defaultValue: true },
      showPhone: { type: 'boolean', label: 'Campo Telefone', defaultValue: false },
      showSubject: { type: 'boolean', label: 'Campo Assunto', defaultValue: true },
      nameLabel: { type: 'string', label: 'Label Nome', aiFillable: { hint: 'Label do campo nome', format: 'label' } },
      emailLabel: { type: 'string', label: 'Label E-mail', aiFillable: { hint: 'Label do campo e-mail', format: 'label' } },
      phoneLabel: { type: 'string', label: 'Label Telefone', aiFillable: { hint: 'Label do campo telefone', format: 'label' } },
      subjectLabel: { type: 'string', label: 'Label Assunto', aiFillable: { hint: 'Label do campo assunto', format: 'label' } },
      messageLabel: { type: 'string', label: 'Label Mensagem', aiFillable: { hint: 'Label do campo mensagem', format: 'label' } },
      buttonText: { type: 'string', label: 'Texto do Botão', aiFillable: { hint: 'Call-to-action de envio, 1-3 palavras', format: 'cta' } },
      successMessage: { type: 'string', label: 'Mensagem de Sucesso', aiFillable: { hint: 'Mensagem de confirmação após envio', format: 'feedback' } },
      showContactInfo: { type: 'boolean', label: 'Mostrar Info de Contato', defaultValue: true },
      contactEmail: { type: 'string', label: 'E-mail de Contato' },
      contactPhone: { type: 'string', label: 'Telefone de Contato' },
      contactAddress: { type: 'string', label: 'Endereço' },
      contactHours: { type: 'string', label: 'Horário de Atendimento' },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
      textColor: { type: 'color', label: 'Cor do Texto' },
      buttonBgColor: { type: 'color', label: 'Cor do Botão' },
      buttonTextColor: { type: 'color', label: 'Cor do Texto do Botão' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'Map',
    label: 'Mapa',
    category: 'content',
    icon: 'MapPin',
    defaultProps: {
      title: '',
      subtitle: '',
      address: 'Av. Paulista, 1000 - São Paulo, SP',
      embedUrl: '',
      latitude: '',
      longitude: '',
      zoom: 15,
      height: 'md',
      showAddress: true,
      showDirectionsButton: true,
      directionsButtonText: 'Como Chegar',
      layout: 'full',
      showContactInfo: true,
      contactTitle: 'Nosso Endereço',
      contactAddress: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
      contactPhone: '(11) 99999-9999',
      contactEmail: 'contato@sualoja.com',
      contactHours: 'Seg - Sex: 9h às 18h',
      rounded: true,
      shadow: true,
      backgroundColor: '',
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da seção de mapa/localização', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo da seção de localização', format: 'text' } },
      address: { type: 'string', label: 'Endereço para o Mapa' },
      embedUrl: { type: 'string', label: 'URL do Embed (opcional)', placeholder: 'Cole o URL de incorporação do Google Maps' },
      latitude: { type: 'string', label: 'Latitude (opcional)' },
      longitude: { type: 'string', label: 'Longitude (opcional)' },
      zoom: { type: 'number', label: 'Zoom', defaultValue: 15, min: 1, max: 20 },
      height: {
        type: 'select',
        label: 'Altura',
        defaultValue: 'md',
        options: [
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
          { label: 'Extra Grande', value: 'xl' },
        ],
      },
      showAddress: { type: 'boolean', label: 'Mostrar Endereço', defaultValue: true },
      showDirectionsButton: { type: 'boolean', label: 'Botão "Como Chegar"', defaultValue: true },
      directionsButtonText: { type: 'string', label: 'Texto do Botão', aiFillable: { hint: 'Texto do botão de direções', format: 'cta' } },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'full',
        options: [
          { label: 'Largura Total', value: 'full' },
          { label: 'Com Informações', value: 'with-info' },
          { label: 'Lado a Lado', value: 'side-by-side' },
        ],
      },
      showContactInfo: { type: 'boolean', label: 'Mostrar Info de Contato', defaultValue: true },
      contactTitle: { type: 'string', label: 'Título da Seção', aiFillable: { hint: 'Título da seção de contato do mapa', format: 'text' } },
      contactAddress: { type: 'string', label: 'Endereço Completo' },
      contactPhone: { type: 'string', label: 'Telefone' },
      contactEmail: { type: 'string', label: 'E-mail' },
      contactHours: { type: 'string', label: 'Horário' },
      rounded: { type: 'boolean', label: 'Bordas Arredondadas', defaultValue: true },
      shadow: { type: 'boolean', label: 'Sombra', defaultValue: true },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'SocialFeed',
    label: 'Feed Social',
    category: 'content',
    icon: 'Instagram',
    defaultProps: {
      title: 'Siga-nos no Instagram',
      subtitle: 'Acompanhe as novidades e compartilhe seus momentos conosco!',
      platform: 'instagram',
      layout: 'grid',
      columns: 6,
      showCaption: false,
      showStats: true,
      maxPosts: 6,
      posts: [],
      showProfile: true,
      profileUsername: '@sualoja',
      profileUrl: 'https://instagram.com/sualoja',
      followButtonText: 'Seguir',
      gap: 'sm',
      rounded: true,
      hoverEffect: true,
      backgroundColor: '',
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título convidativo para seguir a rede social', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo engajante para o feed social', format: 'text' } },
      platform: {
        type: 'select',
        label: 'Plataforma',
        defaultValue: 'instagram',
        options: [
          { label: 'Instagram', value: 'instagram' },
          { label: 'Facebook', value: 'facebook' },
          { label: 'Twitter', value: 'twitter' },
        ],
      },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'grid',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Carrossel', value: 'carousel' },
          { label: 'Masonry', value: 'masonry' },
        ],
      },
      columns: {
        type: 'select',
        label: 'Colunas',
        defaultValue: '6',
        options: [
          { label: '2 Colunas', value: '2' },
          { label: '3 Colunas', value: '3' },
          { label: '4 Colunas', value: '4' },
          { label: '6 Colunas', value: '6' },
        ],
      },
      showCaption: { type: 'boolean', label: 'Mostrar Legenda', defaultValue: false },
      showStats: { type: 'boolean', label: 'Mostrar Curtidas/Comentários', defaultValue: true },
      maxPosts: { type: 'number', label: 'Máximo de Posts', defaultValue: 6, min: 2, max: 12 },
      showProfile: { type: 'boolean', label: 'Mostrar Perfil', defaultValue: true },
      profileUsername: { type: 'string', label: 'Nome de Usuário' },
      profileUrl: { type: 'string', label: 'URL do Perfil' },
      followButtonText: { type: 'string', label: 'Texto do Botão Seguir', aiFillable: { hint: 'Call-to-action para seguir, 1-2 palavras', format: 'cta' } },
      gap: {
        type: 'select',
        label: 'Espaçamento',
        defaultValue: 'sm',
        options: [
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
        ],
      },
      rounded: { type: 'boolean', label: 'Bordas Arredondadas', defaultValue: true },
      hoverEffect: { type: 'boolean', label: 'Efeito Hover', defaultValue: true },
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
    },
    canHaveChildren: false,
    isRemovable: true,
  },
  {
    type: 'PersonalizedProducts',
    label: 'Produtos Personalizados',
    category: 'content',
    icon: 'Sparkles',
    defaultProps: {
      title: 'Recomendados para Você',
      subtitle: 'Produtos selecionados com base em suas preferências',
      layout: 'grid',
      columns: 4,
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da seção de recomendações personalizadas (ex: Recomendados para Você)', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo que explica a personalização (ex: Baseado nas suas preferências)', format: 'text' } },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'grid',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Carrossel', value: 'carousel' },
        ],
      },
      columns: {
        type: 'select',
        label: 'Colunas',
        defaultValue: '4',
        options: [
          { label: '2 Colunas', value: '2' },
          { label: '3 Colunas', value: '3' },
          { label: '4 Colunas', value: '4' },
        ],
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'LivePurchases',
    label: 'Comprando Agora',
    category: 'content',
    icon: 'ShoppingCart',
    defaultProps: {
      title: 'Comprando Agora',
      layout: 'cards',
      showStats: true,
      purchasesToday: 127,
      viewersNow: 43,
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título de prova social de compras em tempo real (ex: Comprando Agora, Vendas ao Vivo)', format: 'text' } },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'cards',
        options: [
          { label: 'Cards', value: 'cards' },
          { label: 'Ticker', value: 'ticker' },
          { label: 'Popup', value: 'popup' },
        ],
      },
      showStats: { type: 'boolean', label: 'Mostrar Estatísticas', defaultValue: true },
    },
    canHaveChildren: false,
  },
  {
    type: 'PricingTable',
    label: 'Tabela de Preços',
    category: 'content',
    icon: 'CreditCard',
    defaultProps: {
      title: 'Escolha o Plano Ideal',
      subtitle: 'Comece gratuitamente e escale conforme cresce',
      layout: 'cards',
      showAnnualToggle: true,
      annualDiscount: 20,
    },
    propsSchema: {
      title: { type: 'string', label: 'Título', aiFillable: { hint: 'Título da tabela de preços/planos', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo complementar', format: 'text' } },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'cards',
        options: [
          { label: 'Cards', value: 'cards' },
          { label: 'Tabela', value: 'table' },
        ],
      },
      showAnnualToggle: { type: 'boolean', label: 'Toggle Mensal/Anual', defaultValue: true },
      annualDiscount: { type: 'number', label: 'Desconto Anual (%)', defaultValue: 20, min: 0, max: 50 },
    },
    canHaveChildren: false,
  },
  // ========== OFFER SLOT BLOCKS ==========
  {
    type: 'CompreJuntoSlot',
    label: 'Compre Junto',
    category: 'ecommerce',
    icon: 'ShoppingBag',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Páginas > Produto
    canHaveChildren: false,
  },
  {
    type: 'CrossSellSlot',
    label: 'Sugestões no Carrinho',
    category: 'ecommerce',
    icon: 'Gift',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Páginas > Carrinho
    canHaveChildren: false,
  },
  // NOTE: OrderBumpSlot was REMOVED - duplicated logic with CheckoutContent's internal OrderBumpSection
  // Order Bump is now handled ONLY internally by Checkout block, controlled by showOrderBump toggle
  
  {
    type: 'NewsletterPopup',
    label: 'Popup Newsletter',
    category: 'utilities',
    icon: 'MessageSquare',
    defaultProps: {
      listId: '',
      title: 'Não perca nossas ofertas!',
      subtitle: 'Cadastre-se e ganhe 10% de desconto',
      showName: true,
      showPhone: false,
      showBirthDate: false,
      buttonText: 'Quero meu desconto',
      successMessage: 'Cadastro realizado com sucesso!',
      // Trigger settings
      triggerType: 'delay',
      delaySeconds: 5,
      scrollPercentage: 50,
      // Display settings
      showOnPages: 'all',
      pageTypes: [],
      showOnMobile: true,
      frequency: 'once',
      // Visual
      overlayColor: 'rgba(0,0,0,0.5)',
      popupBgColor: '',
      popupTextColor: '',
      buttonColor: '',
      buttonTextColor: '',
      borderRadius: 16,
      showCloseButton: true,
    },
    propsSchema: {
      listId: {
        type: 'string',
        label: 'Lista de Email',
        placeholder: 'Selecione uma lista',
        required: true,
        helpText: 'Crie listas no módulo Email Marketing',
      },
      title: { type: 'string', label: 'Título', defaultValue: 'Não perca nossas ofertas!', aiFillable: { hint: 'Título urgente e persuasivo para popup de newsletter/desconto', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', defaultValue: 'Cadastre-se e ganhe 10% de desconto', aiFillable: { hint: 'Subtítulo com benefício claro do cadastro (desconto, acesso antecipado)', format: 'text' } },
      showName: { type: 'boolean', label: 'Mostrar campo Nome', defaultValue: true },
      showPhone: { type: 'boolean', label: 'Mostrar campo Telefone', defaultValue: false },
      showBirthDate: { type: 'boolean', label: 'Mostrar campo Data de Nascimento', defaultValue: false },
      buttonText: { type: 'string', label: 'Texto do Botão', defaultValue: 'Quero meu desconto', aiFillable: { hint: 'CTA curto e direto para o botão de cadastro (2-4 palavras)', format: 'cta' } },
      successMessage: { type: 'string', label: 'Mensagem de Sucesso', defaultValue: 'Cadastro realizado com sucesso!', aiFillable: { hint: 'Mensagem positiva após cadastro bem-sucedido', format: 'feedback' } },
      triggerType: {
        type: 'select',
        label: 'Gatilho de Exibição',
        defaultValue: 'delay',
        options: [
          { label: 'Após X segundos', value: 'delay' },
          { label: 'Ao rolar X%', value: 'scroll' },
          { label: 'Intenção de saída', value: 'exit_intent' },
        ],
      },
      delaySeconds: {
        type: 'number',
        label: 'Atraso (segundos)',
        defaultValue: 5,
        min: 1,
        max: 120,
        showWhen: { triggerType: 'delay' },
      },
      scrollPercentage: {
        type: 'number',
        label: 'Porcentagem de Scroll',
        defaultValue: 50,
        min: 10,
        max: 100,
        showWhen: { triggerType: 'scroll' },
      },
      showOnPages: {
        type: 'select',
        label: 'Exibir em',
        defaultValue: 'all',
        options: [
          { label: 'Todas as páginas', value: 'all' },
          { label: 'Páginas específicas', value: 'specific' },
          { label: 'Apenas esta página', value: 'current' },
        ],
      },
      showOnMobile: { type: 'boolean', label: 'Mostrar no Mobile', defaultValue: true },
      frequency: {
        type: 'select',
        label: 'Frequência',
        defaultValue: 'once',
        options: [
          { label: 'Uma vez por sessão', value: 'once' },
          { label: 'Uma vez por dia', value: 'daily' },
          { label: 'Sempre', value: 'always' },
        ],
      },
      overlayColor: { type: 'color', label: 'Cor do Overlay', defaultValue: 'rgba(0,0,0,0.5)' },
      popupBgColor: { type: 'color', label: 'Cor de Fundo do Popup', placeholder: 'Padrão do tema' },
      popupTextColor: { type: 'color', label: 'Cor do Texto', placeholder: 'Padrão do tema' },
      buttonColor: { type: 'color', label: 'Cor do Botão', placeholder: 'Padrão do tema' },
      buttonTextColor: { type: 'color', label: 'Cor do Texto do Botão', placeholder: 'Padrão do tema' },
      borderRadius: { type: 'number', label: 'Arredondamento (px)', defaultValue: 16, min: 0, max: 48 },
      showCloseButton: { type: 'boolean', label: 'Mostrar botão fechar', defaultValue: true },
    },
    canHaveChildren: false,
  },
  {
    type: 'QuizEmbed',
    label: 'Quiz Interativo',
    category: 'utilities',
    icon: 'ClipboardList',
    defaultProps: {
      quizId: '',
      showTitle: true,
      showDescription: true,
      style: 'card',
    },
    propsSchema: {
      quizId: {
        type: 'string',
        label: 'Quiz',
        placeholder: 'Selecione um quiz',
        required: true,
        helpText: 'Crie quizzes no módulo Marketing > Quiz',
      },
      showTitle: { type: 'boolean', label: 'Mostrar Título', defaultValue: true },
      showDescription: { type: 'boolean', label: 'Mostrar Descrição', defaultValue: true },
      style: {
        type: 'select',
        label: 'Estilo',
        defaultValue: 'card',
        options: [
          { label: 'Card', value: 'card' },
          { label: 'Inline', value: 'inline' },
          { label: 'Fullwidth', value: 'fullwidth' },
        ],
      },
    },
    canHaveChildren: false,
  },

  {
    type: 'UpsellSlot',
    label: 'Oferta Pós-Compra',
    category: 'ecommerce',
    icon: 'TrendingUp',
    defaultProps: {},
    propsSchema: {}, // Settings managed in Theme Settings > Páginas > Obrigado
    canHaveChildren: false,
  },

  // ========== EMBED SOCIAL POST ==========
  {
    type: 'EmbedSocialPost',
    label: 'Embed de Post Social',
    category: 'utilities',
    icon: 'Share2',
    defaultProps: {
      url: '',
      maxWidth: 550,
    },
    propsSchema: {
      url: {
        type: 'string',
        label: 'URL do Post',
        placeholder: 'https://www.instagram.com/p/...',
        helpText: 'Cole a URL de um post público do Facebook, Instagram ou Threads',
        required: true,
      },
      maxWidth: {
        type: 'number',
        label: 'Largura Máxima (px)',
        defaultValue: 550,
        min: 300,
        max: 800,
      },
    },
    canHaveChildren: false,
    isRemovable: true,
  },

  // ========== UNIFIED BLOCKS ==========
  {
    type: 'NewsletterUnified',
    label: 'Newsletter',
    category: 'content',
    icon: 'Mail',
    defaultProps: {
      mode: 'inline',
      title: 'Receba nossas novidades',
      subtitle: 'Cadastre-se e receba ofertas exclusivas em primeira mão!',
      buttonText: 'Inscrever-se',
      layout: 'horizontal',
      showIcon: true,
    },
    propsSchema: {
      mode: {
        type: 'select',
        label: 'Modo',
        defaultValue: 'inline',
        options: [
          { label: 'Simples (só email)', value: 'inline' },
          { label: 'Formulário completo', value: 'form' },
          { label: 'Popup/Modal', value: 'popup' },
        ],
      },
      title: { type: 'string', label: 'Título', defaultValue: 'Receba nossas novidades', aiFillable: { hint: 'Título de engajamento para newsletter (ex: Fique por dentro, Novidades exclusivas)', format: 'text' } },
      subtitle: { type: 'string', label: 'Subtítulo', aiFillable: { hint: 'Subtítulo com benefício do cadastro na newsletter', format: 'text' } },
      buttonText: { type: 'string', label: 'Texto do Botão', defaultValue: 'Inscrever-se', aiFillable: { hint: 'CTA curto para botão de inscrição (2-3 palavras)', format: 'cta' } },
      // Inline mode
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'horizontal',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
          { label: 'Card', value: 'card' },
        ],
        showWhen: { mode: 'inline' },
      },
      showIcon: { type: 'boolean', label: 'Mostrar Ícone', defaultValue: true, showWhen: { mode: 'inline' } },
      showIncentive: { type: 'boolean', label: 'Mostrar Incentivo', defaultValue: false, showWhen: { mode: 'inline' } },
      incentiveText: { type: 'string', label: 'Texto do Incentivo', showWhen: { mode: 'inline' } },
      // Form mode
      listId: { type: 'emailList', label: 'Lista de Email', placeholder: 'Selecione uma lista', showWhen: { mode: 'form' } },
      showName: { type: 'boolean', label: 'Campo Nome', defaultValue: true, showWhen: { mode: 'form' } },
      showPhone: { type: 'boolean', label: 'Campo Telefone', defaultValue: false, showWhen: { mode: 'form' } },
      showBirthDate: { type: 'boolean', label: 'Campo Data de Nascimento', defaultValue: false, showWhen: { mode: 'form' } },
      // Popup mode
      type: {
        type: 'select', label: 'Tipo de Popup', defaultValue: 'newsletter',
        options: [
          { label: 'Newsletter', value: 'newsletter' },
          { label: 'Promoção', value: 'promotion' },
          { label: 'Anúncio', value: 'announcement' },
        ],
        showWhen: { mode: 'popup' },
      },
      discountCode: { type: 'string', label: 'Código de Desconto', showWhen: { mode: 'popup' } },
      // Visual
      backgroundColor: { type: 'color', label: 'Cor de Fundo' },
      textColor: { type: 'color', label: 'Cor do Texto' },
      buttonBgColor: { type: 'color', label: 'Cor do Botão' },
      buttonTextColor: { type: 'color', label: 'Cor do Texto do Botão' },
    },
    canHaveChildren: false,
  },
  {
    type: 'CategoryShowcase',
    label: 'Vitrine de Categorias',
    category: 'ecommerce',
    icon: 'FolderTree',
    defaultProps: {
      style: 'cards',
      title: 'Categorias',
      source: 'auto',
      layout: 'grid',
      columnsDesktop: 4,
      columnsMobile: 2,
      showImage: true,
      showName: true,
      items: [],
    },
    propsSchema: {
      style: {
        type: 'select',
        label: 'Estilo',
        defaultValue: 'cards',
        options: [
          { label: 'Cards (retangular)', value: 'cards' },
          { label: 'Círculos', value: 'circles' },
        ],
      },
      title: { type: 'string', label: 'Título', defaultValue: 'Categorias' },
      // Cards mode
      source: {
        type: 'select', label: 'Fonte', defaultValue: 'auto',
        options: [
          { label: 'Automático', value: 'auto' },
          { label: 'Apenas principais', value: 'parent' },
          { label: 'Selecionar manualmente', value: 'custom' },
        ],
        showWhen: { style: 'cards' },
      },
      layout: {
        type: 'select', label: 'Layout', defaultValue: 'grid',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Lista', value: 'list' },
        ],
        showWhen: { style: 'cards' },
      },
      columnsDesktop: {
        type: 'select', label: 'Colunas (Desktop)', defaultValue: '4',
        options: [
          { label: '2', value: '2' }, { label: '3', value: '3' },
          { label: '4', value: '4' }, { label: '5', value: '5' },
        ],
        showWhen: { style: 'cards' },
      },
      columnsMobile: {
        type: 'select', label: 'Colunas (Mobile)', defaultValue: '2',
        options: [{ label: '1', value: '1' }, { label: '2', value: '2' }],
        showWhen: { style: 'cards' },
      },
      showImage: { type: 'boolean', label: 'Mostrar Imagem', defaultValue: true, showWhen: { style: 'cards' } },
      showDescription: { type: 'boolean', label: 'Mostrar Descrição', defaultValue: false, showWhen: { style: 'cards' } },
      // Both modes - manual selection
      items: {
        type: 'categoryMultiSelect', label: 'Categorias', max: 12,
        helpText: 'Selecione as categorias a exibir',
      },
      // Circles mode
      showName: { type: 'boolean', label: 'Exibir Nome', defaultValue: true, showWhen: { style: 'circles' } },
      mobileStyle: {
        type: 'select', label: 'Estilo Mobile', defaultValue: 'grid',
        options: [{ label: 'Grade', value: 'grid' }, { label: 'Carrossel', value: 'carousel' }],
        showWhen: { style: 'circles' },
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'ProductShowcase',
    label: 'Vitrine de Produtos',
    category: 'ecommerce',
    icon: 'LayoutGrid',
    defaultProps: {
      source: 'featured',
      layout: 'grid',
      title: 'Produtos',
      limit: 8,
      columnsDesktop: 4,
      columnsMobile: 2,
      showPrice: true,
      showButton: true,
      buttonText: 'Ver produto',
    },
    propsSchema: {
      source: {
        type: 'select',
        label: 'Fonte dos Produtos',
        defaultValue: 'featured',
        options: [
          { label: 'Destaques', value: 'featured' },
          { label: 'Novidades', value: 'newest' },
          { label: 'Todos', value: 'all' },
          { label: 'Por Categoria', value: 'category' },
          { label: 'Seleção Manual', value: 'manual' },
        ],
      },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'grid',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Carrossel', value: 'carousel' },
        ],
      },
      title: { type: 'string', label: 'Título', defaultValue: 'Produtos' },
      limit: { type: 'number', label: 'Limite', defaultValue: 8, min: 1, max: 24 },
      columnsDesktop: {
        type: 'select', label: 'Colunas (Desktop)', defaultValue: '4',
        options: [
          { label: '2', value: '2' }, { label: '3', value: '3' },
          { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' },
        ],
        showWhen: { layout: 'grid' },
      },
      columnsMobile: {
        type: 'select', label: 'Colunas (Mobile)', defaultValue: '2',
        options: [{ label: '1', value: '1' }, { label: '2', value: '2' }],
        showWhen: { layout: 'grid' },
      },
      // Category source
      categoryId: { type: 'category', label: 'Categoria', placeholder: 'Selecione', showWhen: { source: 'category' } },
      categorySlug: { type: 'string', label: 'Slug da Categoria (para link)', showWhen: { source: 'category' } },
      showViewAll: { type: 'boolean', label: 'Mostrar "Ver todos"', defaultValue: true, showWhen: { source: 'category' } },
      // Manual source
      productIds: { type: 'productMultiSelect', label: 'Produtos', showWhen: { source: 'manual' } },
      // Common
      showPrice: { type: 'boolean', label: 'Mostrar Preço', defaultValue: true },
      showButton: { type: 'boolean', label: 'Mostrar Botão', defaultValue: true },
      buttonText: { type: 'string', label: 'Texto do Botão', defaultValue: 'Ver produto' },
    },
    canHaveChildren: false,
  },
];

// Registry class
class BlockRegistry {
  private blocks: Map<string, BlockDefinition> = new Map();

  constructor() {
    blockDefinitions.forEach(block => {
      this.blocks.set(block.type, block);
    });
  }

  get(type: string): BlockDefinition | undefined {
    return this.blocks.get(type);
  }

  getAll(): BlockDefinition[] {
    return Array.from(this.blocks.values());
  }

  getByCategory(category: BlockCategory): BlockDefinition[] {
    return this.getAll().filter(block => block.category === category);
  }

  getCategorizedBlocks(): Record<BlockCategory, BlockDefinition[]> {
    return {
      layout: this.getByCategory('layout'),
      'header-footer': this.getByCategory('header-footer'),
      content: this.getByCategory('content'),
      media: this.getByCategory('media'),
      ecommerce: this.getByCategory('ecommerce'),
      utilities: this.getByCategory('utilities'),
    };
  }

  exists(type: string): boolean {
    return this.blocks.has(type);
  }

  createDefaultNode(type: string): BlockNode | null {
    const definition = this.get(type);
    if (!definition) return null;

    return {
      id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      props: { ...definition.defaultProps },
      children: definition.canHaveChildren ? [] : undefined,
    };
  }
}

// Singleton instance
export const blockRegistry = new BlockRegistry();

// Category labels
export const categoryLabels: Record<BlockCategory, string> = {
  layout: 'Layout',
  'header-footer': 'Cabeçalho / Rodapé',
  content: 'Conteúdo',
  media: 'Mídia',
  ecommerce: 'E-commerce',
  utilities: 'Utilitários',
};