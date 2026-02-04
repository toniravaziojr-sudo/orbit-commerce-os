/**
 * Tipos para Geração de Imagens v3.0
 * 
 * Suporta:
 * - Dual Provider (OpenAI + Gemini)
 * - 3 Estilos de Geração
 * - Scoring por Realismo
 */

// === Provedores ===
export type ImageProvider = 'openai' | 'gemini';

// === Estilos de Geração ===
export type ImageStyle = 'product_natural' | 'person_interacting' | 'promotional';

export const IMAGE_STYLE_CONFIG = {
  product_natural: {
    id: 'product_natural',
    label: 'Produto + Fundo (Natural)',
    description: 'Produto em cenário natural, sem pessoas',
    icon: 'Package',
  },
  person_interacting: {
    id: 'person_interacting',
    label: 'Pessoa Interagindo + Produto',
    description: 'Pessoa segurando, usando ou apresentando o produto',
    icon: 'User',
  },
  promotional: {
    id: 'promotional',
    label: 'Promocional (Efeitos)',
    description: 'Visual de anúncio com impacto, efeitos e destaque',
    icon: 'Sparkles',
  },
} as const;

// === Formatos de Saída ===
export type ImageFormat = '1:1' | '9:16' | '16:9';

export const IMAGE_FORMAT_CONFIG = {
  '1:1': { label: 'Quadrado (1:1)', resolution: '1024x1024' },
  '9:16': { label: 'Vertical (9:16)', resolution: '1024x1792' },
  '16:9': { label: 'Horizontal (16:9)', resolution: '1792x1024' },
} as const;

// === Campos por Estilo ===
export interface ProductNaturalSettings {
  environment: string;
  lighting: 'natural' | 'studio' | 'night';
  mood: 'clean' | 'premium' | 'organic' | 'vibrant';
}

export interface PersonInteractingSettings {
  action: 'holding' | 'using' | 'showing';
  personProfile: string;
  tone: 'ugc' | 'demo' | 'review' | 'lifestyle';
}

export interface PromotionalSettings {
  effectsIntensity: 'low' | 'medium' | 'high';
  visualElements: string[];
  overlayText?: string;
}

// === Form Completo ===
export interface ImageGenerationForm {
  // Provedores (multi-select)
  providers: ImageProvider[];
  
  // Estilo (single-select)
  style: ImageStyle;
  
  // Campos comuns
  productId: string;
  productName?: string;
  productImageUrl?: string;
  contextBrief: string;
  format: ImageFormat;
  variations: number;
  
  // Campos por estilo
  productNatural?: ProductNaturalSettings;
  personInteracting?: PersonInteractingSettings;
  promotional?: PromotionalSettings;
}

// === Resultado por Provedor ===
export interface ProviderResult {
  provider: ImageProvider;
  imageUrl: string;
  imageBase64?: string;
  realismScore: number;
  qualityScore: number;
  compositionScore: number;
  labelScore: number;
  overallScore: number;
  isWinner: boolean;
  error?: string;
}

// === Job de Imagem v3.0 ===
export interface ImageJobV3 {
  id: string;
  tenantId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  
  // Config
  providers: ImageProvider[];
  style: ImageStyle;
  productId: string;
  productName?: string;
  format: ImageFormat;
  variations: number;
  
  // Resultados
  results: ProviderResult[];
  recommendedResult?: ProviderResult;
  alternativeResults: ProviderResult[];
  
  // Custo
  estimatedCostCents: number;
  actualCostCents: number;
  
  // Metadados
  createdAt: string;
  completedAt?: string;
  error?: string;
}

// === Defaults ===
export const DEFAULT_IMAGE_FORM: ImageGenerationForm = {
  providers: ['openai', 'gemini'],
  style: 'person_interacting',
  productId: '',
  contextBrief: '',
  format: '1:1',
  variations: 2,
  personInteracting: {
    action: 'holding',
    personProfile: '',
    tone: 'lifestyle',
  },
};

// === Presets de Ambiente (Estilo 1) ===
export const ENVIRONMENT_PRESETS = [
  { value: 'bathroom', label: 'Banheiro' },
  { value: 'counter', label: 'Bancada/Pia' },
  { value: 'studio', label: 'Estúdio (fundo neutro)' },
  { value: 'nature', label: 'Natureza/Ar livre' },
  { value: 'kitchen', label: 'Cozinha' },
  { value: 'bedroom', label: 'Quarto' },
  { value: 'office', label: 'Escritório' },
  { value: 'gym', label: 'Academia' },
] as const;

// === Elementos Visuais (Estilo 3) ===
export const VISUAL_ELEMENTS = [
  { value: 'glow', label: 'Brilho/Glow' },
  { value: 'particles', label: 'Partículas' },
  { value: 'splash', label: 'Splash/Líquido' },
  { value: 'rays', label: 'Raios de luz' },
  { value: 'gradient', label: 'Gradiente vibrante' },
  { value: 'badge', label: 'Badge/Selo' },
] as const;
