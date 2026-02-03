// =============================================
// STANDARD PRESET - Template Padrão do Sistema
// Baseado no design "Respeite o Homem" - Versão genérica
// =============================================

import type { BlockNode } from './types';
import { generateBlockId } from './utils';

/**
 * Standard Template Preset
 * 
 * Características:
 * - Home: Banner (carousel mode) + FeaturedCategories (grid) + FeaturedProducts + ImageCarousel promocional
 * - Category: Banner com overlay + Grid de produtos com filtros
 * - Product: Detalhes do produto (sem slots extras na estrutura, configura via Tema)
 * - Cart: Carrinho simples
 * - Checkout: Header customizado (fundo escuro) + Footer completo com badges de pagamento
 * - Thank You: Página de confirmação limpa
 * - Account pages: Estrutura padrão
 * 
 * themeSettings incluídos:
 * - Cores escuras/premium
 * - Footer global com badges de pagamento, selos de segurança, lojas oficiais
 */

// ========== HOME ==========
const standardHomeTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    // Seção principal (sem Header/Footer - usa Global Layout)
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: {
        backgroundColor: 'transparent',
        paddingX: 0,
        paddingY: 0,
      },
      children: [
        // 1. Banner (carrossel)
        {
          id: generateBlockId('Banner'),
          type: 'Banner',
          props: {
            mode: 'carousel',
            slides: [], // Usuário adiciona seus banners
            autoplaySeconds: 5,
            bannerWidth: 'full',
            showArrows: false,
            showDots: true,
          },
        },
        // 2. Categorias em Destaque (grid mobile)
        {
          id: generateBlockId('FeaturedCategories'),
          type: 'FeaturedCategories',
          props: {
            title: 'Categorias',
            items: [], // Preenchido dinamicamente
            mobileStyle: 'grid',
            showName: true,
          },
        },
        // 3. Produtos em Destaque
        {
          id: generateBlockId('FeaturedProducts'),
          type: 'FeaturedProducts',
          props: {
            title: 'Promoção da semana',
            productIds: [], // Usuário seleciona
            columns: 4,
            limit: 4,
            showPrice: true,
            showButton: true,
            buttonText: 'Ver produto',
          },
        },
        // 4. Carrossel de Imagens (banners secundários/promoções)
        {
          id: generateBlockId('ImageCarousel'),
          type: 'ImageCarousel',
          props: {
            title: '',
            images: [], // Usuário adiciona imagens promocionais
            slidesPerView: 1,
            showArrows: false,
            showDots: false,
            autoplay: false,
            gap: 'sm',
            aspectRatio: 'auto',
            enableLightbox: false,
          },
        },
      ],
    },
  ],
};

// ========== CATEGORY ==========
const standardCategoryTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    // Banner da categoria
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
      children: [
        {
          id: generateBlockId('CategoryBanner'),
          type: 'CategoryBanner',
          props: {
            showTitle: true,
            titlePosition: 'center',
            overlayOpacity: 40,
            height: 'md',
          },
        },
      ],
    },
    // Grid de produtos com filtros
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
      children: [
        {
          id: generateBlockId('CategoryPageLayout'),
          type: 'CategoryPageLayout',
          props: {
            showFilters: true,
            columns: 4,
            limit: 24,
          },
        },
      ],
    },
  ],
};

// ========== PRODUCT ==========
const standardProductTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
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
  ],
};

// ========== CART ==========
const standardCartTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
      children: [
        {
          id: generateBlockId('Cart'),
          type: 'Cart',
          props: {},
        },
      ],
    },
  ],
};

// ========== CHECKOUT ==========
// Header e Footer customizados para checkout (cores escuras, badges de pagamento)
const standardCheckoutTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    // Header customizado do checkout (fundo escuro, centralizado)
    {
      id: 'checkout-header',
      type: 'Header',
      hidden: false,
      props: {
        menuId: '',
        showSearch: false,
        showCart: true,
        showHeaderMenu: false,
        sticky: true,
        noticeEnabled: false,
        logoPosition: 'center',
        logoSize: 'large',
        headerBgColor: '#000000',
        headerTextColor: '#fafafa',
        headerIconColor: '#ffffff',
        customerAreaEnabled: false,
        featuredPromosEnabled: false,
      },
    },
    // Checkout principal
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
      children: [
        {
          id: generateBlockId('Checkout'),
          type: 'Checkout',
          props: {
            showTimeline: true,
          },
        },
      ],
    },
    // Footer customizado do checkout (completo com badges)
    {
      id: 'checkout-footer',
      type: 'Footer',
      hidden: false,
      props: {
        menuId: '',
        menuVisualStyle: 'classic',
        footerBgColor: '#0d0c0c',
        footerTextColor: '#fffafa',
        showLogo: true,
        showCopyright: true,
        showFooter1: false,
        showFooter2: false,
        showSocial: false,
        showNewsletterSection: false,
        showSac: false,
        showStoreInfo: false,
        // Badges de pagamento (SVGs padrão inline)
        showPaymentMethods: true,
        paymentMethods: {
          title: 'Formas de Pagamento',
          items: [
            // Visa
            { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%231A1F71'/%3E%3Cpath d='M19.5 21.5h-3l1.875-11.5h3L19.5 21.5zm8.25-11.25c-.594-.219-1.5-.469-2.625-.469-2.906 0-4.969 1.5-4.969 3.656 0 1.594 1.469 2.469 2.594 3 1.156.531 1.531.906 1.531 1.375 0 .75-.938 1.094-1.781 1.094-1.187 0-1.812-.156-2.781-.563l-.406-.188-.406 2.5c.688.313 1.969.594 3.281.594 3.094 0 5.094-1.5 5.094-3.781 0-1.25-.781-2.219-2.469-3-.031-.031-1.5-.75-1.5-1.5 0-.469.5-.969 1.5-.969.875 0 1.531.188 2.031.406l.25.125.375-2.281zm7.406-.25h-2.25c-.719 0-1.25.188-1.563.906l-4.406 10.594h3.094s.5-1.406.625-1.719h3.781c.094.406.375 1.719.375 1.719h2.75l-2.406-11.5zm-3.344 7.5c.25-.656 1.188-3.156 1.188-3.156s.25-.656.406-1.063l.188.969.719 3.25h-2.5zM15 10l-2.875 7.875-.313-1.5c-.531-1.75-2.188-3.656-4.031-4.594l2.625 9.719h3.125L18.125 10H15z' fill='white'/%3E%3C/svg%3E", linkUrl: '' },
            // Mastercard
            { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%23F5F5F5'/%3E%3Ccircle cx='19' cy='16' r='9' fill='%23EB001B'/%3E%3Ccircle cx='29' cy='16' r='9' fill='%23F79E1B'/%3E%3Cpath d='M24 9.3a9 9 0 0 0 0 13.4 9 9 0 0 0 0-13.4z' fill='%23FF5F00'/%3E%3C/svg%3E", linkUrl: '' },
            // Elo
            { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%23000'/%3E%3Cpath d='M12 14c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z' fill='%23FFCB05'/%3E%3Cpath d='M18 18c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z' fill='%2300A4E0'/%3E%3Cpath d='M24 14c0-2.2 1.8-4 4-4s4 1.8 4 4-1.8 4-4 4-4-1.8-4-4z' fill='%23EF4123'/%3E%3Ctext x='24' y='26' text-anchor='middle' fill='white' font-size='8' font-family='Arial' font-weight='bold'%3Eelo%3C/text%3E%3C/svg%3E", linkUrl: '' },
            // Pix
            { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%2332BCAD'/%3E%3Cpath d='M28.2 11.8l-4.2 4.2-4.2-4.2-2.1 2.1 4.2 4.2-4.2 4.2 2.1 2.1 4.2-4.2 4.2 4.2 2.1-2.1-4.2-4.2 4.2-4.2-2.1-2.1z' fill='white'/%3E%3C/svg%3E", linkUrl: '' },
            // Boleto
            { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%23333'/%3E%3Crect x='10' y='8' width='2' height='16' fill='white'/%3E%3Crect x='14' y='8' width='1' height='16' fill='white'/%3E%3Crect x='17' y='8' width='3' height='16' fill='white'/%3E%3Crect x='22' y='8' width='1' height='16' fill='white'/%3E%3Crect x='25' y='8' width='2' height='16' fill='white'/%3E%3Crect x='29' y='8' width='1' height='16' fill='white'/%3E%3Crect x='32' y='8' width='3' height='16' fill='white'/%3E%3Crect x='37' y='8' width='1' height='16' fill='white'/%3E%3C/svg%3E", linkUrl: '' },
          ],
        },
        // Selos de segurança (placeholder - usuário adiciona os seus)
        showSecuritySeals: true,
        securitySeals: {
          title: 'Selos de Segurança',
          items: [], // Usuário adiciona seus selos (Google Safe, SSL, etc.)
        },
        // Lojas oficiais (placeholder)
        officialStores: {
          title: 'Lojas Oficiais',
          items: [], // Usuário adiciona logos de marketplaces
        },
        // Formas de envio (placeholder)
        shippingMethods: {
          title: 'Formas de Envio',
          items: [], // Usuário adiciona (Correios, Jadlog, etc.)
        },
        badgeSize: 'large',
      },
    },
  ],
};

// ========== THANK YOU ==========
const standardThankYouTemplate: BlockNode = {
  id: 'root',
  type: 'Page',
  props: {},
  children: [
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
      children: [
        {
          id: generateBlockId('ThankYou'),
          type: 'ThankYou',
          props: {
            showTimeline: true,
            showWhatsApp: false,
          },
        },
      ],
    },
  ],
};

// ========== ACCOUNT HUB ==========
const standardAccountTemplate: BlockNode = {
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
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
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
        copyrightText: '© 2024 Sua Loja. Todos os direitos reservados.',
      },
    },
  ],
};

// ========== ACCOUNT ORDERS ==========
const standardAccountOrdersTemplate: BlockNode = {
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
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
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
        copyrightText: '© 2024 Sua Loja. Todos os direitos reservados.',
      },
    },
  ],
};

// ========== ACCOUNT ORDER DETAIL ==========
const standardAccountOrderDetailTemplate: BlockNode = {
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
      },
    },
    {
      id: generateBlockId('Section'),
      type: 'Section',
      props: { paddingY: 32 },
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
        copyrightText: '© 2024 Sua Loja. Todos os direitos reservados.',
      },
    },
  ],
};

// ========== THEME SETTINGS PADRÃO ==========
export const standardThemeSettings = {
  colors: {
    // Cores escuras/premium (baseado em Respeite o Homem)
    accentColor: '#000000',
    buttonPrimaryBg: '#0f0f0f',
    buttonPrimaryHover: '#333333',
    buttonPrimaryText: '#ffffff',
    buttonSecondaryBg: '#ffffff',
    buttonSecondaryHover: '#f5f5f5',
    buttonSecondaryText: '#000000',
    textPrimary: '#1a1a1a',
    textSecondary: '#666666',
    highlightBg: '#000000',
    highlightText: '#ffffff',
    successBg: '#10b981',
    successText: '#ffffff',
    dangerBg: '#ef4444',
    dangerText: '#ffffff',
    warningBg: '#f97316',
    warningText: '#ffffff',
  },
  typography: {
    headingFont: 'inter',
    bodyFont: 'inter',
    baseFontSize: 16,
  },
  footer: {
    footerBgColor: '#1a1919',
    footerTextColor: '#fffafa',
    copyrightText: '',
    // Badges de pagamento padrão
    paymentMethods: {
      title: 'Formas de Pagamento',
      items: [
        { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%231A1F71'/%3E%3Cpath d='M19.5 21.5h-3l1.875-11.5h3L19.5 21.5zm8.25-11.25c-.594-.219-1.5-.469-2.625-.469-2.906 0-4.969 1.5-4.969 3.656 0 1.594 1.469 2.469 2.594 3 1.156.531 1.531.906 1.531 1.375 0 .75-.938 1.094-1.781 1.094-1.187 0-1.812-.156-2.781-.563l-.406-.188-.406 2.5c.688.313 1.969.594 3.281.594 3.094 0 5.094-1.5 5.094-3.781 0-1.25-.781-2.219-2.469-3-.031-.031-1.5-.75-1.5-1.5 0-.469.5-.969 1.5-.969.875 0 1.531.188 2.031.406l.25.125.375-2.281zm7.406-.25h-2.25c-.719 0-1.25.188-1.563.906l-4.406 10.594h3.094s.5-1.406.625-1.719h3.781c.094.406.375 1.719.375 1.719h2.75l-2.406-11.5zm-3.344 7.5c.25-.656 1.188-3.156 1.188-3.156s.25-.656.406-1.063l.188.969.719 3.25h-2.5zM15 10l-2.875 7.875-.313-1.5c-.531-1.75-2.188-3.656-4.031-4.594l2.625 9.719h3.125L18.125 10H15z' fill='white'/%3E%3C/svg%3E", linkUrl: '' },
        { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%23F5F5F5'/%3E%3Ccircle cx='19' cy='16' r='9' fill='%23EB001B'/%3E%3Ccircle cx='29' cy='16' r='9' fill='%23F79E1B'/%3E%3Cpath d='M24 9.3a9 9 0 0 0 0 13.4 9 9 0 0 0 0-13.4z' fill='%23FF5F00'/%3E%3C/svg%3E", linkUrl: '' },
        { imageUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 32' fill='none'%3E%3Crect width='48' height='32' rx='4' fill='%2332BCAD'/%3E%3Cpath d='M28.2 11.8l-4.2 4.2-4.2-4.2-2.1 2.1 4.2 4.2-4.2 4.2 2.1 2.1 4.2-4.2 4.2 4.2 2.1-2.1-4.2-4.2 4.2-4.2-2.1-2.1z' fill='white'/%3E%3C/svg%3E", linkUrl: '' },
      ],
    },
    securitySeals: {
      title: 'Segurança',
      items: [],
    },
    officialStores: {
      title: 'Lojas Oficiais',
      items: [],
    },
    shippingMethods: {
      title: 'Formas de Envio',
      items: [],
    },
    showPaymentMethods: true,
    showSecuritySeals: false,
    badgeSize: 'medium',
  },
  customCss: '',
};

/**
 * Get Standard template for a specific page type
 * Returns a deep clone to prevent mutations
 */
export function getStandardTemplate(pageType: string): BlockNode {
  const templates: Record<string, BlockNode> = {
    home: standardHomeTemplate,
    category: standardCategoryTemplate,
    product: standardProductTemplate,
    cart: standardCartTemplate,
    checkout: standardCheckoutTemplate,
    thank_you: standardThankYouTemplate,
    account: standardAccountTemplate,
    account_orders: standardAccountOrdersTemplate,
    account_order_detail: standardAccountOrderDetailTemplate,
  };

  const template = templates[pageType];
  if (!template) {
    // Fallback para páginas não mapeadas
    return JSON.parse(JSON.stringify(standardHomeTemplate));
  }

  return JSON.parse(JSON.stringify(template));
}

/**
 * Get all Standard templates for all page types
 * Used when creating a new template with 'standard' preset
 */
export function getAllStandardTemplates(): Record<string, BlockNode> {
  const pageTypes = [
    'home',
    'category',
    'product',
    'cart',
    'checkout',
    'thank_you',
    'account',
    'account_orders',
    'account_order_detail',
  ];

  const templates: Record<string, BlockNode> = {};
  for (const pageType of pageTypes) {
    templates[pageType] = getStandardTemplate(pageType);
  }

  // Incluir themeSettings no draft_content
  (templates as any).themeSettings = JSON.parse(JSON.stringify(standardThemeSettings));

  return templates;
}
