// =============================================
// AI WIZARD REGISTRY — Contratos declarativos por bloco
// Fase 3.1: Infraestrutura do wizard de preenchimento guiado
// =============================================
//
// PRINCÍPIO: IA não decide estrutura, dependências nem vínculos de dados.
// IA só gera conteúdo dentro da whitelist (aiGenerates).
// O usuário define dependências obrigatórias via steps.
// O sistema deriva campos determinísticos (ex: linkUrl de produto/categoria).
// =============================================

// --- Step Types ---

export type WizardStepType =
  | 'banner-association'
  | 'quantity-select'
  | 'source-select'
  | 'briefing'
  | 'confirm';

export interface WizardStepConfig {
  id: string;
  type: WizardStepType;
  label: string;
  /** If true, the user cannot skip this step */
  required: boolean;
  /** For quantity-select: min value */
  min?: number;
  /** For quantity-select: max value */
  max?: number;
  /** For quantity-select: default value */
  defaultValue?: number;
  /** For briefing: placeholder text */
  placeholder?: string;
  /** For banner-association in carousel: repeated per slide (handled by wizard logic) */
  perSlide?: boolean;
}

// --- Collected Data Shapes ---

export interface BannerAssociationPayload {
  associationType: 'product' | 'category' | 'url' | 'none';
  productId?: string;
  productName?: string;
  categoryId?: string;
  categoryName?: string;
  manualUrl?: string;
  /** Derived by the system, never by AI */
  derivedLinkUrl: string;
}

export interface BannerSingleWizardData {
  mode: 'single';
  association: BannerAssociationPayload;
  briefing?: string;
}

export interface BannerCarouselWizardData {
  mode: 'carousel';
  slideCount: number;
  slides: Array<{
    index: number;
    association: BannerAssociationPayload;
    briefing?: string;
  }>;
}

export type BannerWizardData = BannerSingleWizardData | BannerCarouselWizardData;

export interface BannerProductsWizardData {
  source: 'manual' | 'category';
  productIds?: string[];
  categoryId?: string;
  briefing?: string;
}

export interface TextBannersWizardData {
  briefing: string;
}

export interface ImageCarouselWizardData {
  imageCount: number;
  briefing: string;
}

export interface ImageGalleryWizardData {
  imageCount: number;
  briefing: string;
}

export type WizardCollectedData =
  | BannerWizardData
  | BannerProductsWizardData
  | TextBannersWizardData
  | ImageCarouselWizardData
  | ImageGalleryWizardData;

// --- Image Spec ---

export interface ImageSpec {
  /** The prop key this image fills */
  key: string;
  width: number;
  height: number;
  label: string;
}

// --- Block Contract ---

export interface WizardBlockContract {
  /** Steps the user must complete before generation */
  steps: WizardStepConfig[];
  /** Props the AI CAN generate (strict whitelist) */
  aiGenerates: string[];
  /** Props the AI NEVER touches (enforced at merge) */
  aiNeverTouches: string[];
  /** Does this wizard require image generation? */
  requiresImageGeneration: boolean;
  /** Image specs when image generation is needed */
  imageSpecs?: ImageSpec[];
}

// --- Contracts per Block ---

/**
 * Returns the wizard contract for a block, or null if the block uses direct fill (Group A).
 * For Banner, the contract varies by mode (single vs carousel).
 */
export function getWizardContract(
  blockType: string,
  currentProps?: Record<string, unknown>
): WizardBlockContract | null {
  switch (blockType) {
    case 'Banner': {
      const mode = currentProps?.mode ?? 'single';
      return mode === 'carousel' ? BANNER_CAROUSEL_CONTRACT : BANNER_SINGLE_CONTRACT;
    }
    case 'BannerProducts':
      return BANNER_PRODUCTS_CONTRACT;
    case 'TextBanners':
      return TEXT_BANNERS_CONTRACT;
    case 'ImageCarousel':
      return IMAGE_CAROUSEL_CONTRACT;
    case 'ImageGallery':
      return IMAGE_GALLERY_CONTRACT;
    default:
      return null;
  }
}

// =============================================
// CONTRACT DEFINITIONS
// =============================================

const BANNER_SINGLE_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'association',
      type: 'banner-association',
      label: 'Para onde o banner direciona?',
      required: true,
    },
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Descreva o objetivo do banner',
      required: false,
      placeholder: 'Ex: Promoção de verão, lançamento da coleção X...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['imageDesktop', 'imageMobile', 'title', 'subtitle', 'buttonText'],
  aiNeverTouches: [
    'mode', 'linkUrl', 'buttonUrl', 'backgroundColor', 'textColor',
    'buttonColor', 'buttonTextColor', 'buttonHoverBgColor', 'buttonHoverTextColor',
    'alignment', 'overlayOpacity', 'height', 'bannerWidth',
    'slides', 'autoplaySeconds', 'showArrows', 'showDots',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop', width: 1920, height: 700, label: 'Banner Desktop' },
    { key: 'imageMobile', width: 750, height: 420, label: 'Banner Mobile' },
  ],
};

const BANNER_CAROUSEL_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'slideCount',
      type: 'quantity-select',
      label: 'Quantos slides?',
      required: true,
      min: 1,
      max: 3,
      defaultValue: 3,
    },
    {
      id: 'slideAssociations',
      type: 'banner-association',
      label: 'Configurar slide',
      required: true,
      perSlide: true,
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['slides'],
  aiNeverTouches: [
    'mode', 'autoplaySeconds', 'showArrows', 'showDots',
    'backgroundColor', 'textColor', 'buttonColor', 'buttonTextColor',
    'buttonHoverBgColor', 'buttonHoverTextColor',
    'alignment', 'overlayOpacity', 'height', 'bannerWidth',
    'imageDesktop', 'imageMobile', 'title', 'subtitle', 'buttonText', 'buttonUrl', 'linkUrl',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop', width: 1920, height: 700, label: 'Banner Desktop (por slide)' },
    { key: 'imageMobile', width: 750, height: 420, label: 'Banner Mobile (por slide)' },
  ],
};

const BANNER_PRODUCTS_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'sourceCheck',
      type: 'source-select',
      label: 'Fonte dos produtos',
      required: true,
    },
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Descreva o tema do banner',
      required: false,
      placeholder: 'Ex: Promoção de inverno, produtos em destaque...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['imageDesktop', 'imageMobile', 'title', 'description'],
  aiNeverTouches: [
    'source', 'productIds', 'categoryId', 'limit',
    'showCta', 'ctaText', 'ctaUrl',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop', width: 600, height: 400, label: 'Banner Desktop' },
    { key: 'imageMobile', width: 400, height: 500, label: 'Banner Mobile' },
  ],
};

const TEXT_BANNERS_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Qual o tema das imagens?',
      required: true,
      placeholder: 'Ex: Fotos de lifestyle da marca, produtos artesanais...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['imageDesktop1', 'imageMobile1', 'imageDesktop2', 'imageMobile2'],
  aiNeverTouches: [
    'title', 'text', 'ctaText', 'ctaUrl', 'ctaEnabled',
    'ctaBgColor', 'ctaTextColor', 'layout',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop1', width: 600, height: 800, label: 'Imagem 1 Desktop' },
    { key: 'imageMobile1', width: 400, height: 500, label: 'Imagem 1 Mobile' },
    { key: 'imageDesktop2', width: 600, height: 800, label: 'Imagem 2 Desktop' },
    { key: 'imageMobile2', width: 400, height: 500, label: 'Imagem 2 Mobile' },
  ],
};

const IMAGE_CAROUSEL_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'imageCount',
      type: 'quantity-select',
      label: 'Quantas imagens?',
      required: true,
      min: 1,
      max: 10,
      defaultValue: 4,
    },
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Qual o tema das imagens?',
      required: true,
      placeholder: 'Ex: Fotos de produtos em uso, ambiente da loja...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['images'],
  aiNeverTouches: [
    'title', 'autoplay', 'autoplayInterval', 'showArrows', 'showDots',
    'enableLightbox', 'aspectRatio', 'slidesPerView', 'gap',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'image', width: 800, height: 600, label: 'Imagem do carrossel' },
  ],
};

const IMAGE_GALLERY_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'imageCount',
      type: 'quantity-select',
      label: 'Quantas imagens?',
      required: true,
      min: 1,
      max: 12,
      defaultValue: 6,
    },
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Qual o tema das imagens?',
      required: true,
      placeholder: 'Ex: Bastidores da produção, galeria de clientes...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['images'],
  aiNeverTouches: [
    'title', 'subtitle', 'columns', 'gap', 'enableLightbox',
    'aspectRatio', 'borderRadius', 'backgroundColor',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'image', width: 800, height: 800, label: 'Imagem da galeria' },
  ],
};
