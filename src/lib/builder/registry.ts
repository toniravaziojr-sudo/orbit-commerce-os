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
      paddingX: 16,
      paddingY: 32,
      marginTop: 0,
      marginBottom: 0,
      gap: 16,
      alignItems: 'stretch',
      fullWidth: false,
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
        defaultValue: 16,
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
      noticeBgColor: '#1e40af',
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
        defaultValue: '#1e40af',
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
          { label: 'Slide', value: 'slide' },
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
    label: 'Rodapé',
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
    },
    canHaveChildren: false,
    isRemovable: false,
  },

  // ========== CONTENT BLOCKS ==========
  {
    type: 'Hero',
    label: 'Hero Banner',
    category: 'content',
    icon: 'Image',
    defaultProps: {
      title: 'Bem-vindo à Nossa Loja',
      subtitle: 'Descubra produtos incríveis',
      backgroundImage: '',
      backgroundColor: '#6366f1',
      textColor: '#ffffff',
      buttonText: 'Ver Produtos',
      buttonUrl: '/produtos',
      buttonColor: '#ffffff',
      buttonTextColor: '',
      buttonHoverBgColor: '',
      buttonHoverTextColor: '',
      alignment: 'center',
      overlayOpacity: 50,
      height: 'md',
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Bem-vindo à Nossa Loja',
      },
      subtitle: {
        type: 'string',
        label: 'Subtítulo',
        defaultValue: 'Descubra produtos incríveis',
      },
      backgroundImage: {
        type: 'image',
        label: 'Imagem de Fundo',
      },
      backgroundColor: {
        type: 'color',
        label: 'Cor de Fundo (se sem imagem)',
        defaultValue: '#6366f1',
      },
      textColor: {
        type: 'color',
        label: 'Cor do Texto',
        defaultValue: '#ffffff',
      },
      buttonText: {
        type: 'string',
        label: 'Texto do Botão',
        defaultValue: 'Ver Produtos',
      },
      buttonUrl: {
        type: 'string',
        label: 'Link do Botão',
        defaultValue: '/produtos',
      },
      buttonColor: {
        type: 'color',
        label: 'Cor de Fundo do Botão',
        defaultValue: '#ffffff',
      },
      buttonTextColor: {
        type: 'color',
        label: 'Cor do Texto do Botão',
      },
      buttonHoverBgColor: {
        type: 'color',
        label: 'Cor de Fundo (Hover)',
      },
      buttonHoverTextColor: {
        type: 'color',
        label: 'Cor do Texto (Hover)',
      },
      alignment: {
        type: 'select',
        label: 'Alinhamento',
        defaultValue: 'center',
        options: [
          { label: 'Esquerda', value: 'left' },
          { label: 'Centro', value: 'center' },
          { label: 'Direita', value: 'right' },
        ],
      },
      height: {
        type: 'select',
        label: 'Altura',
        defaultValue: 'md',
        options: [
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
          { label: 'Tela Cheia', value: 'full' },
        ],
      },
      overlayOpacity: {
        type: 'number',
        label: 'Opacidade do Overlay (%)',
        defaultValue: 50,
        min: 0,
        max: 100,
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'Banner',
    label: 'Banner',
    category: 'media',
    icon: 'Megaphone',
    defaultProps: {
      imageUrl: '',
      altText: 'Banner promocional',
      linkUrl: '',
      aspectRatio: '16:9',
      height: '',
      objectFit: 'cover',
      objectPosition: 'center',
      rounded: 'md',
      shadow: 'none',
    },
    propsSchema: {
      imageUrl: {
        type: 'image',
        label: 'Imagem',
      },
      altText: {
        type: 'string',
        label: 'Texto Alternativo',
        defaultValue: 'Banner promocional',
      },
      linkUrl: {
        type: 'string',
        label: 'Link',
        placeholder: 'URL de destino',
      },
      aspectRatio: {
        type: 'select',
        label: 'Proporção',
        defaultValue: '16:9',
        options: [
          { label: '16:9', value: '16:9' },
          { label: '4:3', value: '4:3' },
          { label: '1:1', value: '1:1' },
          { label: '21:9', value: '21:9' },
        ],
      },
      height: {
        type: 'select',
        label: 'Altura Fixa',
        defaultValue: '',
        options: [
          { label: 'Usar Proporção', value: '' },
          { label: '200px', value: '200px' },
          { label: '300px', value: '300px' },
          { label: '400px', value: '400px' },
          { label: '50vh', value: '50vh' },
        ],
      },
      objectFit: {
        type: 'select',
        label: 'Enquadramento',
        defaultValue: 'cover',
        options: [
          { label: 'Cobrir', value: 'cover' },
          { label: 'Conter', value: 'contain' },
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
        ],
      },
      rounded: {
        type: 'select',
        label: 'Bordas',
        defaultValue: 'md',
        options: [
          { label: 'Nenhum', value: 'none' },
          { label: 'Pequeno', value: 'sm' },
          { label: 'Médio', value: 'md' },
          { label: 'Grande', value: 'lg' },
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
        ],
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'RichText',
    label: 'Texto Rico',
    category: 'content',
    icon: 'FileText',
    defaultProps: {
      content: '<p>Digite seu conteúdo aqui...</p>',
    },
    propsSchema: {
      content: {
        type: 'richtext',
        label: 'Conteúdo',
        defaultValue: '<p>Digite seu conteúdo aqui...</p>',
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'Image',
    label: 'Imagem',
    category: 'media',
    icon: 'ImageIcon',
    defaultProps: {
      src: '',
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
      src: {
        type: 'image',
        label: 'Imagem',
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
      },
      url: {
        type: 'string',
        label: 'Link',
        defaultValue: '#',
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
      },
      items: {
        type: 'array',
        label: 'Perguntas',
        defaultValue: [],
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'Testimonials',
    label: 'Depoimentos',
    category: 'content',
    icon: 'MessageCircle',
    defaultProps: {
      title: 'O que dizem nossos clientes',
      items: [
        { name: 'Maria', text: 'Ótima experiência de compra!', rating: 5 },
        { name: 'João', text: 'Produtos de qualidade e entrega rápida.', rating: 5 },
      ],
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'O que dizem nossos clientes',
      },
      items: {
        type: 'array',
        label: 'Depoimentos',
        defaultValue: [],
      },
    },
    canHaveChildren: false,
  },

  // ========== ECOMMERCE BLOCKS ==========
  {
    type: 'CategoryList',
    label: 'Lista de Categorias',
    category: 'ecommerce',
    icon: 'FolderTree',
    defaultProps: {
      title: 'Categorias',
      layout: 'grid',
      columns: 4,
      showDescription: false,
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Categorias',
      },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'grid',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Lista', value: 'list' },
          { label: 'Carrossel', value: 'carousel' },
        ],
      },
      columns: {
        type: 'select',
        label: 'Colunas',
        defaultValue: '4',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '6', value: '6' },
        ],
      },
      showDescription: {
        type: 'boolean',
        label: 'Mostrar Descrição',
        defaultValue: false,
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'ProductGrid',
    label: 'Grade de Produtos',
    category: 'ecommerce',
    icon: 'LayoutGrid',
    defaultProps: {
      title: 'Produtos',
      source: 'featured',
      categoryId: '',
      columns: 4,
      limit: 8,
      showPrice: true,
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Produtos',
      },
      source: {
        type: 'select',
        label: 'Fonte',
        defaultValue: 'featured',
        options: [
          { label: 'Destaques', value: 'featured' },
          { label: 'Mais Vendidos', value: 'bestsellers' },
          { label: 'Novidades', value: 'newest' },
          { label: 'Categoria', value: 'category' },
        ],
      },
      categoryId: {
        type: 'category',
        label: 'Categoria (se fonte = Categoria)',
        placeholder: 'Selecione uma categoria',
      },
      columns: {
        type: 'select',
        label: 'Colunas',
        defaultValue: '4',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
        ],
      },
      limit: {
        type: 'number',
        label: 'Limite de Produtos',
        defaultValue: 8,
        min: 1,
        max: 24,
      },
      showPrice: {
        type: 'boolean',
        label: 'Mostrar Preço',
        defaultValue: true,
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'ProductCarousel',
    label: 'Carrossel de Produtos',
    category: 'ecommerce',
    icon: 'Carousel',
    defaultProps: {
      title: 'Produtos em Destaque',
      source: 'featured',
      categoryId: '',
      limit: 8,
      showPrice: true,
      showButton: true,
      buttonText: 'Ver produto',
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Produtos em Destaque',
      },
      source: {
        type: 'select',
        label: 'Fonte',
        defaultValue: 'featured',
        options: [
          { label: 'Destaques', value: 'featured' },
          { label: 'Novidades', value: 'newest' },
          { label: 'Todos', value: 'all' },
          { label: 'Categoria', value: 'category' },
        ],
      },
      categoryId: {
        type: 'category',
        label: 'Categoria (se fonte = Categoria)',
        placeholder: 'Selecione uma categoria',
      },
      limit: {
        type: 'number',
        label: 'Limite de Produtos',
        defaultValue: 8,
        min: 4,
        max: 20,
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
      buttonText: {
        type: 'string',
        label: 'Texto do Botão',
        defaultValue: 'Ver produto',
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'FeaturedProducts',
    label: 'Produtos Selecionados',
    category: 'ecommerce',
    icon: 'Star',
    defaultProps: {
      title: 'Produtos em Destaque',
      productIds: [],
      limit: 4,
      columns: 4,
      showPrice: true,
      showButton: true,
      buttonText: 'Ver produto',
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Produtos em Destaque',
      },
      productIds: {
        type: 'textarea',
        label: 'IDs dos Produtos (um por linha ou separados por vírgula)',
        placeholder: 'Cole os IDs dos produtos aqui',
      },
      limit: {
        type: 'number',
        label: 'Limite (fallback se sem IDs)',
        defaultValue: 4,
        min: 1,
        max: 12,
      },
      columns: {
        type: 'select',
        label: 'Colunas',
        defaultValue: '4',
        options: [
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '4', value: '4' },
        ],
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
      buttonText: {
        type: 'string',
        label: 'Texto do Botão',
        defaultValue: 'Ver produto',
      },
    },
    canHaveChildren: false,
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
    defaultProps: {
      exampleProductId: '',
      showGallery: true,
      showDescription: true,
      showVariants: true,
      showStock: true,
    },
    propsSchema: {
      exampleProductId: {
        type: 'product',
        label: 'Produto de Exemplo',
        placeholder: 'Para pré-visualização no editor',
      },
      showGallery: {
        type: 'boolean',
        label: 'Mostrar Galeria',
        defaultValue: true,
      },
      showDescription: {
        type: 'boolean',
        label: 'Mostrar Descrição',
        defaultValue: true,
      },
      showVariants: {
        type: 'boolean',
        label: 'Mostrar Variantes',
        defaultValue: true,
      },
      showStock: {
        type: 'boolean',
        label: 'Mostrar Estoque',
        defaultValue: true,
      },
    },
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'CartSummary',
    label: 'Resumo do Carrinho',
    category: 'ecommerce',
    icon: 'ShoppingCart',
    defaultProps: {
      showThumbnails: true,
      showQuantityControls: true,
    },
    propsSchema: {
      showThumbnails: {
        type: 'boolean',
        label: 'Mostrar Miniaturas',
        defaultValue: true,
      },
      showQuantityControls: {
        type: 'boolean',
        label: 'Controles de Quantidade',
        defaultValue: true,
      },
    },
    canHaveChildren: false,
    isRemovable: false,
  },
  {
    type: 'CheckoutSteps',
    label: 'Etapas do Checkout',
    category: 'ecommerce',
    icon: 'ListChecks',
    defaultProps: {
      steps: ['Identificação', 'Entrega', 'Pagamento', 'Confirmação'],
    },
    propsSchema: {
      steps: {
        type: 'array',
        label: 'Etapas',
        defaultValue: ['Identificação', 'Entrega', 'Pagamento', 'Confirmação'],
      },
    },
    canHaveChildren: false,
    isRemovable: false,
  },

  // ========== ESSENTIAL BLOCKS (8 novos) ==========
  {
    type: 'HeroBanner',
    label: 'Banner Principal',
    category: 'media',
    icon: 'Image',
    defaultProps: {
      slides: [],
      autoplaySeconds: 5,
      bannerWidth: 'full',
      showArrows: true,
      showDots: true,
    },
    propsSchema: {
      slides: {
        type: 'array',
        label: 'Slides do Banner',
        defaultValue: [],
      },
      autoplaySeconds: {
        type: 'number',
        label: 'Tempo de Autoplay (segundos)',
        defaultValue: 5,
        min: 0,
        max: 30,
      },
      bannerWidth: {
        type: 'select',
        label: 'Largura do Banner',
        defaultValue: 'full',
        options: [
          { label: 'Largura Total', value: 'full' },
          { label: 'Contido', value: 'contained' },
        ],
      },
      showArrows: {
        type: 'boolean',
        label: 'Mostrar Setas',
        defaultValue: true,
      },
      showDots: {
        type: 'boolean',
        label: 'Mostrar Indicadores',
        defaultValue: true,
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'CollectionSection',
    label: 'Categoria/Coleção',
    category: 'ecommerce',
    icon: 'LayoutGrid',
    defaultProps: {
      title: 'Coleção',
      categoryId: '',
      displayStyle: 'grid',
      limit: 8,
      columns: 4,
      mobileColumns: 2,
      showViewAll: true,
      viewAllText: 'Ver todos',
      showPrice: true,
      showButton: true,
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título da Seção',
        defaultValue: 'Coleção',
      },
      categoryId: {
        type: 'category',
        label: 'Categoria',
        placeholder: 'Selecione uma categoria',
      },
      displayStyle: {
        type: 'select',
        label: 'Estilo de Exibição',
        defaultValue: 'grid',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Carrossel', value: 'carousel' },
        ],
      },
      limit: {
        type: 'number',
        label: 'Quantidade de Produtos',
        defaultValue: 8,
        min: 4,
        max: 24,
      },
      columns: {
        type: 'select',
        label: 'Colunas (Desktop)',
        defaultValue: '4',
        options: [
          { label: '3', value: '3' },
          { label: '4', value: '4' },
          { label: '5', value: '5' },
        ],
      },
      mobileColumns: {
        type: 'select',
        label: 'Colunas (Mobile)',
        defaultValue: '2',
        options: [
          { label: '1', value: '1' },
          { label: '2', value: '2' },
        ],
      },
      showViewAll: {
        type: 'boolean',
        label: 'Mostrar "Ver todos"',
        defaultValue: true,
      },
      viewAllText: {
        type: 'string',
        label: 'Texto do Link',
        defaultValue: 'Ver todos',
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
    type: 'InfoHighlights',
    label: 'Destaques Informativos',
    category: 'content',
    icon: 'Award',
    defaultProps: {
      items: [
        { icon: 'Truck', title: 'Frete Grátis', description: 'Em compras acima de R$199' },
        { icon: 'CreditCard', title: 'Parcelamento', description: 'Em até 12x sem juros' },
        { icon: 'Shield', title: 'Compra Segura', description: 'Seus dados protegidos' },
      ],
      layout: 'horizontal',
      iconColor: '',
      textColor: '',
    },
    propsSchema: {
      items: {
        type: 'array',
        label: 'Itens',
        defaultValue: [],
      },
      layout: {
        type: 'select',
        label: 'Layout',
        defaultValue: 'horizontal',
        options: [
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'Vertical', value: 'vertical' },
        ],
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
    },
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
      },
      description: {
        type: 'string',
        label: 'Descrição',
        placeholder: 'Descrição opcional',
      },
      imageDesktop: {
        type: 'image',
        label: 'Imagem Desktop',
        placeholder: 'URL da imagem desktop',
      },
      imageMobile: {
        type: 'image',
        label: 'Imagem Mobile',
        placeholder: 'URL da imagem mobile (opcional)',
      },
      productIds: {
        type: 'textarea',
        label: 'IDs dos Produtos (um por linha)',
        placeholder: 'IDs específicos ou deixe vazio para usar categoria',
      },
      categoryId: {
        type: 'category',
        label: 'Categoria (fallback)',
        placeholder: 'Usado se nenhum ID for informado',
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
    type: 'YouTubeVideo',
    label: 'Vídeo (YouTube)',
    category: 'media',
    icon: 'Youtube',
    defaultProps: {
      title: '',
      youtubeUrl: '',
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título (opcional)',
        placeholder: 'Título da seção',
      },
      youtubeUrl: {
        type: 'string',
        label: 'URL do YouTube',
        placeholder: 'https://www.youtube.com/watch?v=...',
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'Reviews',
    label: 'Avaliações',
    category: 'content',
    icon: 'Star',
    defaultProps: {
      title: 'O que nossos clientes dizem',
      reviews: [
        { name: 'Maria S.', rating: 5, text: 'Produto excelente, entrega rápida!' },
        { name: 'João P.', rating: 5, text: 'Superou minhas expectativas.' },
      ],
      visibleCount: 3,
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'O que nossos clientes dizem',
      },
      reviews: {
        type: 'array',
        label: 'Avaliações',
        defaultValue: [],
      },
      visibleCount: {
        type: 'number',
        label: 'Quantidade Visível',
        defaultValue: 3,
        min: 1,
        max: 10,
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'FeaturedCategories',
    label: 'Categorias em Destaque',
    category: 'ecommerce',
    icon: 'Grid3x3',
    defaultProps: {
      title: 'Categorias',
      categoryIds: [],
      showName: true,
      mobileStyle: 'grid',
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        defaultValue: 'Categorias',
      },
      categoryIds: {
        type: 'textarea',
        label: 'IDs das Categorias (um por linha)',
        placeholder: 'IDs das categorias ou deixe vazio para todas',
      },
      showName: {
        type: 'boolean',
        label: 'Exibir Nome',
        defaultValue: true,
      },
      mobileStyle: {
        type: 'select',
        label: 'Estilo Mobile',
        defaultValue: 'grid',
        options: [
          { label: 'Grade', value: 'grid' },
          { label: 'Carrossel', value: 'carousel' },
        ],
      },
    },
    canHaveChildren: false,
  },
  {
    type: 'TextBanners',
    label: 'Texto + Banners',
    category: 'content',
    icon: 'FileText',
    defaultProps: {
      title: '',
      text: '',
      imageDesktop: '',
      imageMobile: '',
      showCta: false,
      ctaText: 'Saiba mais',
      ctaUrl: '',
      imagePosition: 'right',
    },
    propsSchema: {
      title: {
        type: 'string',
        label: 'Título',
        placeholder: 'Título da seção',
      },
      text: {
        type: 'textarea',
        label: 'Texto',
        placeholder: 'Conteúdo do texto',
      },
      imageDesktop: {
        type: 'image',
        label: 'Imagem Desktop',
        placeholder: 'URL da imagem desktop',
      },
      imageMobile: {
        type: 'image',
        label: 'Imagem Mobile',
        placeholder: 'URL da imagem mobile (opcional)',
      },
      imagePosition: {
        type: 'select',
        label: 'Posição da Imagem',
        defaultValue: 'right',
        options: [
          { label: 'Direita', value: 'right' },
          { label: 'Esquerda', value: 'left' },
        ],
      },
      showCta: {
        type: 'boolean',
        label: 'Mostrar CTA',
        defaultValue: false,
      },
      ctaText: {
        type: 'string',
        label: 'Texto do CTA',
        defaultValue: 'Saiba mais',
      },
      ctaUrl: {
        type: 'string',
        label: 'URL do CTA',
        placeholder: 'Link do botão',
      },
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
