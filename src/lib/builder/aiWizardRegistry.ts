// =============================================
// AI WIZARD REGISTRY — Contratos declarativos por bloco
// Phase 3.3: Unified Banner contract with mode + scope inside wizard
// =============================================
//
// PRINCÍPIO: IA não decide estrutura, dependências nem vínculos de dados.
// IA só gera conteúdo dentro da whitelist (aiGenerates) filtrado pelo scope.
// O usuário define modo, escopo, e vínculos via steps no wizard.
// O sistema deriva campos determinísticos (ex: linkUrl de produto/categoria).
// =============================================

// --- Step Types ---

export type WizardStepType =
  | 'banner-mode-select'
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
  /** Whether this block has text props the AI can generate */
  hasTextGeneration?: boolean;
}

// --- Contracts per Block ---

/**
 * Returns the wizard contract for a block, or null if the block uses direct fill (Group A).
 * Phase 3.3: Banner always returns the unified contract — mode is chosen INSIDE the wizard.
 */
export function getWizardContract(
  blockType: string,
  _currentProps?: Record<string, unknown>
): WizardBlockContract | null {
  switch (blockType) {
    case 'Banner':
      return BANNER_UNIFIED_CONTRACT;
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

// =============================================
// CONTRACT DEFINITIONS
// =============================================

/**
 * Unified Banner contract — Phase 3.3
 * Steps: Mode → Scope → Association (per slide if carousel) → Briefing → Confirm
 * The wizard dynamically expands association steps based on mode/slideCount.
 */
const BANNER_UNIFIED_CONTRACT: WizardBlockContract = {
  steps: [
    {
      id: 'bannerMode',
      type: 'banner-mode-select',
      label: 'Que tipo de banner quer criar?',
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
      id: 'association',
      type: 'banner-association',
      label: 'Para onde o banner direciona?',
      required: true,
      perSlide: true, // Dynamically expanded for carousel
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
  // All possible props — scope filtering happens at generation time
  aiGenerates: ['imageDesktop', 'imageMobile', 'title', 'subtitle', 'buttonText', 'slides'],
  aiNeverTouches: [
    'mode', 'linkUrl', 'buttonUrl', 'backgroundColor', 'textColor',
    'buttonColor', 'buttonTextColor', 'buttonHoverBgColor', 'buttonHoverTextColor',
    'alignment', 'buttonAlignment', 'overlayOpacity', 'height', 'bannerWidth',
    'autoplaySeconds', 'showArrows', 'showDots',
    'bannerType', 'hasEditableContent', 'layoutPreset',
  ],
  requiresImageGeneration: true,
  hasTextGeneration: true,
  imageSpecs: [
    { key: 'imageDesktop', width: 1920, height: 800, label: 'Banner Desktop' },
    { key: 'imageMobile', width: 750, height: 940, label: 'Banner Mobile' },
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

// =============================================
// IMAGE BLOCK CONTRACT — Pure image, no text
// Steps: Creative Style → Briefing → Confirm
// =============================================

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
    'alt', 'linkUrl', 'width', 'height', 'objectFit',
    'objectPosition', 'aspectRatio', 'rounded', 'shadow',
  ],
  requiresImageGeneration: true,
  hasTextGeneration: false,
  imageSpecs: [
    { key: 'imageDesktop', width: 1200, height: 800, label: 'Imagem Desktop' },
    { key: 'imageMobile', width: 800, height: 1000, label: 'Imagem Mobile' },
  ],
};

// =============================================
// CONTENT COLUMNS CONTRACT — Image-only via wizard (texts via aiFillable)
// Steps: Creative Style → Briefing → Confirm
// =============================================

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
      placeholder: 'Ex: Imagem ilustrativa para a seção, foto do produto em uso...',
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
    'title', 'subtitle', 'content', 'features', 'imagePosition',
    'iconColor', 'showButton', 'buttonText', 'buttonUrl',
    'backgroundColor', 'textColor',
  ],
  requiresImageGeneration: true,
  hasTextGeneration: false,
  imageSpecs: [
    { key: 'imageDesktop', width: 800, height: 600, label: 'Imagem Desktop' },
    { key: 'imageMobile', width: 600, height: 800, label: 'Imagem Mobile' },
  ],
};
