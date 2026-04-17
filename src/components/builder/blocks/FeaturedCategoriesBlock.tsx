// =============================================
// FEATURED CATEGORIES BLOCK — Backward-compat shim
// =============================================
// O bloco original ("circular") foi refatorado para o módulo
// `category-showcase/circles/` seguindo SRP + Clean Code.
// Este arquivo é mantido apenas para preservar imports legados
// (registry, presets, templates antigos). Toda a lógica vive
// agora em `CirclesVariantBlock`.
//
// Ref: docs/tecnico/base-de-conhecimento-tecnico.md › 10.6
// =============================================

export { CirclesVariantBlock as FeaturedCategoriesBlock } from './category-showcase/circles';
export type { CirclesVariantProps as FeaturedCategoriesBlockProps } from './category-showcase/circles';
