/**
 * Tipos para Geração de Imagens — v10.0 (Prompt-Only)
 */

// === Formatos de Saída ===
export type ImageFormat = '1:1' | '9:16' | '16:9';

export const IMAGE_FORMAT_CONFIG = {
  '1:1': { label: 'Quadrado (1:1)', resolution: '1024x1024' },
  '9:16': { label: 'Vertical (9:16)', resolution: '1024x1792' },
  '16:9': { label: 'Horizontal (16:9)', resolution: '1792x1024' },
} as const;
