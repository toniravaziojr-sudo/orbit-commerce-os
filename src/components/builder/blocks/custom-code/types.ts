// =============================================
// CUSTOM CODE BLOCK - Unified types
// Merges: CustomBlock (database) + HTMLSection (inline)
// =============================================

export interface CustomCodeBlockProps {
  source?: 'inline' | 'database';
  // Database mode (ex-CustomBlock)
  customBlockId?: string;
  // Inline mode (ex-HTMLSection)
  htmlContent?: string;
  htmlDesktop?: string;
  htmlMobile?: string;
  cssContent?: string;
  blockName?: string;
  baseUrl?: string;
  className?: string;
  context?: any;
  isEditing?: boolean;
}
