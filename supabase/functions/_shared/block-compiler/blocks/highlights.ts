// =============================================
// HIGHLIGHTS BLOCK COMPILER — Unified (FeatureList + InfoHighlights)
// Alias compiler: routes to featureList or infoHighlights based on style
// =============================================

import type { BlockCompilerFn, CompilerContext } from '../types.ts';
import { featureListToStaticHTML } from './feature-list.ts';
import { infoHighlightsToStaticHTML } from './info-highlights.ts';

export const highlightsToStaticHTML: BlockCompilerFn = (
  props: Record<string, unknown>,
  context: CompilerContext,
): string => {
  const style = (props.style as string) || 'bar';

  if (style === 'list') {
    // Normalize items: HighlightItem -> FeatureItem
    const items = (props.items as any[]) || [];
    const normalizedItems = items.map(item => ({
      id: item.id,
      icon: item.icon || 'Check',
      text: item.text || item.title || item.description || '',
    }));
    return featureListToStaticHTML({ ...props, items: normalizedItems }, context);
  }

  // Bar mode: normalize items -> InfoHighlights format
  const items = (props.items as any[]) || [];
  const normalizedItems = items.map(item => ({
    id: item.id,
    icon: item.icon || 'Shield',
    title: item.title || item.text || '',
    description: item.description || '',
  }));
  return infoHighlightsToStaticHTML({ ...props, items: normalizedItems }, context);
};
