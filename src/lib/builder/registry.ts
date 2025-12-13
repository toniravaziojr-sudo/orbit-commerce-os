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
    },
    propsSchema: {
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
      sticky: {
        type: 'boolean',
        label: 'Fixo no Topo',
        defaultValue: true,
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
      menuId: '',
      showSocial: true,
      copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
    },
    propsSchema: {
      menuId: {
        type: 'menu',
        label: 'Menu',
        placeholder: 'Selecione um menu',
      },
      showSocial: {
        type: 'boolean',
        label: 'Mostrar Redes Sociais',
        defaultValue: true,
      },
      copyrightText: {
        type: 'string',
        label: 'Texto de Copyright',
        defaultValue: '© 2024 Minha Loja. Todos os direitos reservados.',
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
      buttonColor: '',
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
        label: 'Cor do Botão (vazio = tema)',
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
    category: 'content',
    icon: 'Megaphone',
    defaultProps: {
      imageUrl: '',
      altText: 'Banner promocional',
      linkUrl: '',
      aspectRatio: '16:9',
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
    category: 'content',
    icon: 'ImageIcon',
    defaultProps: {
      src: '',
      alt: 'Imagem',
      width: 'full',
      rounded: 'none',
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
        label: 'Cor de Fundo (vazio = tema)',
      },
      textColor: {
        type: 'color',
        label: 'Cor do Texto (vazio = tema)',
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
