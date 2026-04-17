// =============================================
// CIRCLES VARIANT — Items normalization
// SRP: Convert legacy/new prop shapes to a single canonical list.
// Pure function. No side effects.
// =============================================

import type { CategoryItemConfig } from './types';

/**
 * Normaliza props legacy (`categoryIds: string[]`) e modernos (`items`)
 * em uma única lista canônica de itens de categoria.
 */
export function normalizeCategoryItems(
  items: CategoryItemConfig[] | undefined,
  categoryIds: string[] | undefined,
): CategoryItemConfig[] {
  if (items && items.length > 0) return items;
  if (categoryIds && categoryIds.length > 0) {
    return categoryIds.map((id) => ({ categoryId: id }));
  }
  return [];
}

/**
 * Extrai apenas IDs válidos (não-nulos, não-vazios), preservando a ordem.
 */
export function extractCategoryIds(items: CategoryItemConfig[]): string[] {
  return items.map((item) => item.categoryId).filter(Boolean);
}
