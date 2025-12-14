// =============================================
// DEFAULT TEMPLATES - Fallback templates for each page type
// =============================================

import type { BlockNode } from './types';
import { generateBlockId } from './utils';

// Default Home template
export const defaultHomeTemplate: BlockNode = {
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
      id: generateBlockId('Hero'),
      type: 'Hero',
      props: {
        title: 'Bem-vindo à Nossa Loja',
        subtitle: 'Descubra produtos incríveis com os melhores preços',
        backgroundImage: '',
        buttonText: 'Ver Produtos',
        buttonUrl: '/produtos',
        alignment: 'center',
        overlayOpacity: 50,
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: 'transparent',
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('CategoryList'),
          type: 'CategoryList',
          props: {
            title: 'Categorias',
            layout: 'grid',
            columns: 4,
            showDescription: false,
          },
        },
      ],
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: '#f9fafb',
        padding: 'lg',
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
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
      },
    },
  ],
};

// Default Category template
export const defaultCategoryTemplate: BlockNode = {
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
        padding: 'md',
      },
      children: [
        {
          id: generateBlockId('RichText'),
          type: 'RichText',
          props: {
            content: '<h1>{{category.name}}</h1><p>{{category.description}}</p>',
          },
        },
      ],
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        padding: 'lg',
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
    {
      id: generateBlockId('Footer'),
      type: 'Footer',
      props: {
        menuId: '',
        showSocial: true,
        copyrightText: '© 2024 Minha Loja. Todos os direitos reservados.',
      },
    },
  ],
};

// Default Product template
export const defaultProductTemplate: BlockNode = {
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
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: '#f9fafb',
        padding: 'lg',
      },
      children: [
        {
          id: generateBlockId('ProductGrid'),
          type: 'ProductGrid',
          props: {
            title: 'Produtos Relacionados',
            source: 'category',
            columns: 4,
            limit: 4,
            showPrice: true,
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
          id: generateBlockId('RichText'),
          type: 'RichText',
          props: {
            content: '<h1>Seu Carrinho</h1>',
          },
        },
        {
          id: generateBlockId('CartSummary'),
          type: 'CartSummary',
          props: {
            showThumbnails: true,
            showQuantityControls: true,
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
          id: generateBlockId('CheckoutSteps'),
          type: 'CheckoutSteps',
          props: {
            steps: ['Identificação', 'Entrega', 'Pagamento', 'Confirmação'],
          },
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
    case 'neutral':
    case 'landing_page':
      return JSON.parse(JSON.stringify(defaultNeutralPageTemplate));
    case 'institutional':
    default:
      return JSON.parse(JSON.stringify(defaultInstitutionalTemplate));
  }
}
