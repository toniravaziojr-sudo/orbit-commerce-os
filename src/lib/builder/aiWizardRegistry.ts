// =============================================
// AI WIZARD REGISTRY — Contratos declarativos por bloco
// v4.0.0: Simplified Banner wizard (Product → Briefing → Confirm)
// =============================================

// --- Step Types ---

export type WizardStepType =
  | 'product-select'
  | 'banner-mode-select'
  | 'output-mode-select'
  | 'creative-style-select'
  | 'scope-select'
  | 'banner-association'
  | 'quantity-select'
  | 'source-select'
  | 'briefing'
  | 'confirm';

export interface WizardStepConfig {
  id: string;
  type: WizardStepType;
  label: string;
  required: boolean;
  min?: number;
  max?: number;
  defaultValue?: number;
  placeholder?: string;
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

export interface ImageBlockWizardData {
  briefing: string;
}

export interface ContentColumnsWizardData {
  briefing: string;
}

export type WizardCollectedData =
  | BannerWizardData
  | BannerProductsWizardData
  | TextBannersWizardData
  | ImageCarouselWizardData
  | ImageGalleryWizardData
  | ImageBlockWizardData
  | ContentColumnsWizardData;

// --- Image Spec ---

export interface ImageSpec {
  key: string;
  width: number;
  height: number;
  label: string;
}

// --- Block Contract ---

export interface WizardBlockContract {
  steps: WizardStepConfig[];
  aiGenerates: string[];
  aiNeverTouches: string[];
  requiresImageGeneration: boolean;
  imageSpecs?: ImageSpec[];
  hasTextGeneration?: boolean;
}

// --- Contracts per Block ---

/**
 * Returns the wizard contract for a block, or null if the block uses direct fill.
 * v4.0.0: Banner uses simplified 2-step wizard (Product → Briefing → Confirm)
 */
export function getWizardContract(
  blockType: string,
  _currentProps?: Record<string, unknown>
): WizardBlockContract | null {
  switch (blockType) {
    case 'Banner':
      return BANNER_SIMPLIFIED_CONTRACT;
    case 'BannerProducts':
      return BANNER_PRODUCTS_CONTRACT;
    case 'TextBanners':
      return TEXT_BANNERS_CONTRACT;
    case 'ImageCarousel':
      return IMAGE_CAROUSEL_CONTRACT;
    case 'ImageGallery':
      return IMAGE_GALLERY_CONTRACT;
    case 'Image':
      return IMAGE_BLOCK_CONTRACT;
    case 'ContentColumns':
      return CONTENT_COLUMNS_CONTRACT;
    default:
      return null;
  }
}

/**
 * Returns the simplified wizard contract for per-slide AI generation.
 * v4.0.0: Same simplified contract as block-level — unified flow.
 */
export function getSlideWizardContract(): WizardBlockContract {
  return BANNER_SIMPLIFIED_CONTRACT;
}

// =============================================
// BANNER SIMPLIFIED CONTRACT — v4.0.0
// Steps: Product Select → Briefing → Confirm
// Only generates images. Text is separate.
// =============================================

const BANNER_SIMPLIFIED_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'productSelect',
      type: 'product-select',
      label: 'Associar a um produto?',
      required: true,
    },
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Descreva o banner que deseja',
      required: true,
      placeholder: 'Ex: Banner de lançamento para este produto, banner institucional moderno, promoção de verão...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['imageDesktop', 'imageMobile'],
  aiNeverTouches: [
    'mode', 'linkUrl', 'buttonUrl', 'backgroundColor', 'textColor',
    'buttonColor', 'buttonTextColor', 'buttonHoverBgColor', 'buttonHoverTextColor',
    'alignment', 'buttonAlignment', 'overlayOpacity', 'height', 'bannerWidth',
    'autoplaySeconds', 'showArrows', 'showDots',
    'bannerType', 'hasEditableContent', 'layoutPreset',
    'title', 'subtitle', 'buttonText', 'slides',
  ],
  requiresImageGeneration: true,
  hasTextGeneration: false,
  imageSpecs: [
    { key: 'imageDesktop', width: 1920, height: 800, label: 'Banner Desktop' },
    { key: 'imageMobile', width: 750, height: 940, label: 'Banner Mobile' },
  ],
};

// =============================================
// OTHER BLOCK CONTRACTS (unchanged)
// =============================================

const BANNER_PRODUCTS_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'sourceCheck',
      type: 'source-select',
      label: 'Fonte dos produtos',
      required: true,
    },
    {
      id: 'creativeStyle',
      type: 'creative-style-select',
      label: 'Estilo visual da imagem',
      required: true,
    },
    {
      id: 'scope',
      type: 'scope-select',
      label: 'O que deseja gerar?',
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
  hasTextGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop', width: 600, height: 400, label: 'Banner Desktop' },
    { key: 'imageMobile', width: 400, height: 500, label: 'Banner Mobile' },
  ],
};

const TEXT_BANNERS_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'creativeStyle',
      type: 'creative-style-select',
      label: 'Estilo visual das imagens',
      required: true,
    },
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
      id: 'creativeStyle',
      type: 'creative-style-select',
      label: 'Estilo visual das imagens',
      required: true,
    },
    {
      id: 'imageCount',
      type: 'quantity-select',
      label: 'Quantas imagens?',
      required: true,
      min: 1,
      max: 6,
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
      id: 'creativeStyle',
      type: 'creative-style-select',
      label: 'Estilo visual das imagens',
      required: true,
    },
    {
      id: 'imageCount',
      type: 'quantity-select',
      label: 'Quantas imagens?',
      required: true,
      min: 1,
      max: 6,
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

const IMAGE_BLOCK_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'creativeStyle',
      type: 'creative-style-select',
      label: 'Estilo visual da imagem',
      required: true,
    },
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Descreva a imagem desejada',
      required: false,
      placeholder: 'Ex: Produto em cenário natural, foto lifestyle...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['imageDesktop', 'imageMobile'],
  aiNeverTouches: [
    'alt', 'aspectRatio', 'borderRadius', 'shadow', 'width', 'maxWidth',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop', width: 1200, height: 800, label: 'Imagem Desktop' },
    { key: 'imageMobile', width: 800, height: 1000, label: 'Imagem Mobile' },
  ],
};

const CONTENT_COLUMNS_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'creativeStyle',
      type: 'creative-style-select',
      label: 'Estilo visual da imagem',
      required: true,
    },
    {
      id: 'briefing',
      type: 'briefing',
      label: 'Descreva a imagem desejada',
      required: false,
      placeholder: 'Ex: Foto dos bastidores, imagem da equipe, foto lifestyle...',
    },
    {
      id: 'confirm',
      type: 'confirm',
      label: 'Confirmar e gerar',
      required: true,
    },
  ],
  aiGenerates: ['imageDesktop', 'imageMobile'],
  aiNeverTouches: [
    'title', 'text', 'ctaText', 'ctaUrl', 'imagePosition',
    'backgroundColor', 'textColor', 'titleColor',
  ],
  requiresImageGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop', width: 800, height: 600, label: 'Imagem Desktop' },
    { key: 'imageMobile', width: 600, height: 800, label: 'Imagem Mobile' },
  ],
};
