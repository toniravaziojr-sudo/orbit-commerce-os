// =============================================
// DEFAULT TEMPLATES - Fallback templates for each page type
// =============================================

import type { BlockNode } from './types';
import { generateBlockId } from './utils';

// Demo banners for HeroBanner (sistema - não entra no Meu Drive do tenant)
const demoBannerSlides = [
  {
    id: 'demo-1',
    imageDesktop: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1920&h=600&fit=crop&q=80',
    imageMobile: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=768&h=400&fit=crop&q=80',
    altText: 'Promoção Especial - Até 50% OFF',
    linkUrl: '',
  },
  {
    id: 'demo-2',
    imageDesktop: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&h=600&fit=crop&q=80',
    imageMobile: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=768&h=400&fit=crop&q=80',
    altText: 'Novidades - Confira os lançamentos',
    linkUrl: '',
  },
  {
    id: 'demo-3',
    imageDesktop: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1920&h=600&fit=crop&q=80',
    imageMobile: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=768&h=400&fit=crop&q=80',
    altText: 'Frete Grátis em todo Brasil',
    linkUrl: '',
  },
];

// Demo benefícios para InfoHighlights
const demoBenefitsItems = [
  { id: 'benefit-1', icon: 'Truck', title: 'Frete Grátis', description: 'Em compras acima de R$199' },
  { id: 'benefit-2', icon: 'CreditCard', title: 'Parcelamento', description: 'Em até 12x sem juros' },
  { id: 'benefit-3', icon: 'Shield', title: 'Compra Segura', description: 'Ambiente 100% protegido' },
  { id: 'benefit-4', icon: 'Package', title: 'Troca Fácil', description: '30 dias para trocar' },
];

// Demo depoimentos para Testimonials
const demoTestimonialsItems = [
  { name: 'Maria Silva', content: 'Produto excelente! Entrega super rápida e embalagem perfeita. Superou minhas expectativas!', rating: 5 },
  { name: 'João Santos', content: 'Comprei para presente e adoraram! Qualidade impecável e ótimo custo-benefício.', rating: 5 },
  { name: 'Ana Costa', content: 'Já é minha terceira compra. Atendimento nota 10 e produtos sempre conforme descrito.', rating: 5 },
];

// Default Home template - Template completo para novos tenants
export const defaultHomeTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    // 1. Cabeçalho
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: true,
        noticeText: 'Frete grátis em compras acima de R$199! Aproveite nossas ofertas.',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    // 2. Banner Principal (Carrossel)
    {
      id: generateBlockId('HeroBanner'),
      type: 'HeroBanner',
      props: {
        slides: demoBannerSlides,
        autoplaySeconds: 5,
        bannerWidth: 'full',
        showArrows: true,
        showDots: true,
      },
    },
    // 3. Barra de Benefícios
    {
      id: generateBlockId('InfoHighlights'),
      type: 'InfoHighlights',
      props: {
        items: demoBenefitsItems,
        iconColor: '#6366f1',
        textColor: '#1f2937',
        layout: 'horizontal',
      },
    },
    // 4. Categorias em Miniatura
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: 'transparent',
        paddingY: 48,
      },
      children: [
        {
          id: generateBlockId('FeaturedCategories'),
          type: 'FeaturedCategories',
          props: {
            title: 'Navegue por Categorias',
            limit: 6,
            columns: 6,
            showImage: true,
            showName: true,
            imageStyle: 'rounded',
          },
        },
      ],
    },
    // 5. Produtos em Destaque
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: '#f9fafb',
        paddingY: 48,
      },
      children: [
        {
          id: generateBlockId('ProductGrid'),
          type: 'ProductGrid',
          props: {
            title: 'Produtos em Destaque',
            source: 'featured',
            columns: 4,
            limit: 8,
            showPrice: true,
          },
        },
      ],
    },
    // 6. Depoimentos de Clientes
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: 'transparent',
        paddingY: 48,
      },
      children: [
        {
          id: generateBlockId('Testimonials'),
          type: 'Testimonials',
          props: {
            title: 'O que dizem nossos clientes',
            items: demoTestimonialsItems,
          },
        },
      ],
    },
    // 7. Últimos Posts do Blog
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: '#f9fafb',
        paddingY: 48,
      },
      children: [
        {
          id: generateBlockId('BlogListing'),
          type: 'BlogListing',
          props: {
            title: 'Blog',
            description: 'Dicas e novidades para você',
            postsPerPage: 3,
            showExcerpt: true,
            showImage: true,
            showTags: false,
            showPagination: false,
          },
        },
      ],
    },
    // 8. Rodapé
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Sua Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Category template - Template completo para páginas de categoria
export const defaultCategoryTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    // 1. Cabeçalho
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    // 2. Slot para Banner da Categoria (renderizado dinamicamente via context)
    // O banner e título da categoria são injetados automaticamente pelo StorefrontCategory
    // 3. Barra de Benefícios
    {
      id: generateBlockId('InfoHighlights'),
      type: 'InfoHighlights',
      props: {
        items: [
          { id: 'benefit-1', icon: 'Truck', title: 'Frete Grátis', description: 'Em compras acima de R$199' },
          { id: 'benefit-2', icon: 'CreditCard', title: 'Parcelamento', description: 'Em até 12x sem juros' },
          { id: 'benefit-3', icon: 'Shield', title: 'Compra Segura', description: 'Ambiente 100% protegido' },
        ],
        iconColor: '#6366f1',
        textColor: '#1f2937',
        layout: 'horizontal',
      },
    },
    // 4. Grid de Produtos da Categoria
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        paddingY: 48,
      },
      children: [
        {
          id: generateBlockId('ProductGrid'),
          type: 'ProductGrid',
          props: {
            title: '',
            source: 'category',
            categoryId: '{{category.id}}',
            columns: 4,
            limit: 24,
            showPrice: true,
          },
        },
      ],
    },
    // 5. Rodapé
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Sua Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Product template - Template completo para páginas de produto
export const defaultProductTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    // 1. Cabeçalho
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    // 2. Detalhes do Produto
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        paddingY: 32,
      },
      children: [
        {
          id: generateBlockId('ProductDetails'),
          type: 'ProductDetails',
          props: {
            showGallery: true,
            showDescription: true,
            showVariants: true,
            showStock: true,
          },
        },
      ],
    },
    // 3. Barra de Benefícios
    {
      id: generateBlockId('InfoHighlights'),
      type: 'InfoHighlights',
      props: {
        items: [
          { id: 'benefit-1', icon: 'Truck', title: 'Frete Grátis', description: 'Em compras acima de R$199' },
          { id: 'benefit-2', icon: 'CreditCard', title: 'Parcelamento', description: 'Em até 12x sem juros' },
          { id: 'benefit-3', icon: 'Shield', title: 'Compra Segura', description: 'Ambiente 100% protegido' },
          { id: 'benefit-4', icon: 'Package', title: 'Troca Fácil', description: '30 dias para trocar' },
        ],
        iconColor: '#6366f1',
        textColor: '#1f2937',
        layout: 'horizontal',
      },
    },
    // 4. Produtos Relacionados
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: '#f9fafb',
        paddingY: 48,
      },
      children: [
        {
          id: generateBlockId('ProductGrid'),
          type: 'ProductGrid',
          props: {
            title: 'Você também pode gostar',
            source: 'category',
            columns: 4,
            limit: 4,
            showPrice: true,
          },
        },
      ],
    },
    // 5. Depoimentos
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        paddingY: 48,
      },
      children: [
        {
          id: generateBlockId('Testimonials'),
          type: 'Testimonials',
          props: {
            title: 'O que dizem nossos clientes',
            items: [
              { name: 'Maria Silva', content: 'Produto excelente! Entrega super rápida.', rating: 5 },
              { name: 'João Santos', content: 'Qualidade impecável, recomendo!', rating: 5 },
              { name: 'Ana Costa', content: 'Ótimo custo-benefício.', rating: 5 },
            ],
          },
        },
      ],
    },
    // 6. Rodapé
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Sua Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Cart template
export const defaultCartTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('Cart'),
          type: 'Cart',
          props: {},
        },
      ],
    },
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Checkout template
export const defaultCheckoutTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: false,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('Checkout'),
          type: 'Checkout',
          props: {},
        },
      ],
    },
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: false,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Thank You / Order Confirmation template
export const defaultThankYouTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: false,
        showCart: false,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('ThankYou'),
          type: 'ThankYou',
          props: {
            showTimeline: true,
            showWhatsApp: true,
            whatsAppNumber: '+55 11 91955-5920',
          },
        },
      ],
    },
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Institutional Page template
export const defaultInstitutionalTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('Container'),
          type: 'Container',
          props: {
            maxWidth: 'md',
            centered: true,
          },
          children: [
            {
              id: generateBlockId('RichText'),
              type: 'RichText',
              props: {
                content: '<h1>{{page.title}}</h1><p>Conteúdo da página...</p>',
              },
            },
          ],
        },
      ],
    },
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Neutral Page template (for institutional and landing pages)
export const defaultNeutralPageTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('Container'),
          type: 'Container',
          props: {
            maxWidth: 'md',
            centered: true,
          },
          children: [
            {
              id: generateBlockId('RichText'),
              type: 'RichText',
              props: {
                content: '<h1>Título da Página</h1><p>Conteúdo da página...</p>',
              },
            },
          ],
        },
      ],
    },
  ],
};

// Default Account Hub template
export const defaultAccountTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('AccountHub'),
          type: 'AccountHub',
          props: {},
        },
      ],
    },
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Account Orders List template
export const defaultAccountOrdersTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('OrdersList'),
          type: 'OrdersList',
          props: {},
        },
      ],
    },
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Default Account Order Detail template
export const defaultAccountOrderDetailTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Header'),
      type: 'Header',
      props: {
        menuId: '',
        showSearch: true,
        showCart: true,
        sticky: true,
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('OrderDetail'),
          type: 'OrderDetail',
          props: {},
        },
      ],
    },
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
        footerBgColor: '',
        footerTextColor: '',
        noticeEnabled: false,
        noticeText: '',
        noticeBgColor: '#1e40af',
        noticeTextColor: '#ffffff',
      },
    },
  ],
};

// Get default template by page type
export function getDefaultTemplate(pageType: string): BlockNode {
  switch (pageType) {
    case 'home':
      return JSON.parse(JSON.stringify(defaultHomeTemplate));
    case 'category':
      return JSON.parse(JSON.stringify(defaultCategoryTemplate));
    case 'product':
      return JSON.parse(JSON.stringify(defaultProductTemplate));
    case 'cart':
      return JSON.parse(JSON.stringify(defaultCartTemplate));
    case 'checkout':
      return JSON.parse(JSON.stringify(defaultCheckoutTemplate));
    case 'thank_you':
    case 'obrigado':
      return JSON.parse(JSON.stringify(defaultThankYouTemplate));
    case 'account':
      return JSON.parse(JSON.stringify(defaultAccountTemplate));
    case 'account_orders':
      return JSON.parse(JSON.stringify(defaultAccountOrdersTemplate));
    case 'account_order_detail':
      return JSON.parse(JSON.stringify(defaultAccountOrderDetailTemplate));
    case 'neutral':
    case 'landing_page':
      return JSON.parse(JSON.stringify(defaultNeutralPageTemplate));
    case 'page_template':
      return JSON.parse(JSON.stringify(defaultInstitutionalTemplate));
    case 'blog':
      return JSON.parse(JSON.stringify(defaultNeutralPageTemplate)); // Blog uses neutral template as base
    case 'institutional':
    default:
      return JSON.parse(JSON.stringify(defaultInstitutionalTemplate));
  }
}
