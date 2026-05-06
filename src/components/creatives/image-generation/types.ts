/**
 * Tipos para Geração de Imagens — v10.1 (Catálogo Fal GPT Image 1.5)
 *
 * Formatos alinhados ao catálogo real em service_pricing:
 *  - 1024x1024 (square)
 *  - 1024x1536 (portrait)
 *  - 1536x1024 (landscape)
 *
 * Os labels antigos "9:16" e "16:9" foram removidos porque mapeavam para
 * 1024x1792 / 1792x1024, dimensões que NÃO existem em service_pricing.
 */

// === Formatos de Saída ===
export type ImageFormat = 'square' | 'portrait' | 'landscape';

export interface ImageFormatConfig {
  label: string;
  resolution: '1024x1024' | '1024x1536' | '1536x1024';
  width: number;
  height: number;
}

export const IMAGE_FORMAT_CONFIG: Record<ImageFormat, ImageFormatConfig> = {
  square:    { label: 'Quadrado (1024×1024)',  resolution: '1024x1024', width: 1024, height: 1024 },
  portrait:  { label: 'Retrato (1024×1536)',   resolution: '1024x1536', width: 1024, height: 1536 },
  landscape: { label: 'Paisagem (1536×1024)',  resolution: '1536x1024', width: 1536, height: 1024 },
} as const;

// Qualidade fixa nesta fase (seletor low/high virá em etapa futura)
export const DEFAULT_IMAGE_QUALITY = 'medium' as const;
export type ImageQuality = 'low' | 'medium' | 'high';
