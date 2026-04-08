// =============================================
// HIGHLIGHTS BLOCK - Unified (FeatureList + InfoHighlights)
// style: 'list' = vertical list with icons (ex-FeatureList)
// style: 'bar' = horizontal compact bar (ex-InfoHighlights)
// =============================================

import React from 'react';
import { FeatureListBlock } from '../FeatureListBlock';
import { InfoHighlightsBlock } from '../InfoHighlightsBlock';
import type { HighlightsBlockProps } from './types';

export function HighlightsBlock({
  style = 'bar',
  title,
  subtitle,
  items = [],
  iconColor,
  textColor,
  backgroundColor,
  showButton,
  buttonText,
  buttonUrl,
  layout,
  context,
  isEditing = false,
}: HighlightsBlockProps) {
  if (style === 'list') {
    // Normalize items: HighlightItem -> FeatureItem (text field)
    const featureItems = items.map(item => ({
      id: item.id,
      icon: item.icon || 'Check',
      text: item.text || item.title || item.description || '',
    }));

    return (
      <FeatureListBlock
        title={title}
        subtitle={subtitle}
        items={featureItems}
        iconColor={iconColor}
        textColor={textColor}
        backgroundColor={backgroundColor}
        showButton={showButton}
        buttonText={buttonText}
        buttonUrl={buttonUrl}
        context={context}
      />
    );
  }

  // Bar mode (default)
  // Normalize items: HighlightItem -> InfoHighlights format (title + description)
  const highlightItems = items.map(item => ({
    id: item.id,
    icon: item.icon || 'Shield',
    title: item.title || item.text || '',
    description: item.description || '',
  }));

  return (
    <InfoHighlightsBlock
      items={highlightItems}
      iconColor={iconColor}
      textColor={textColor}
      layout={layout}
      context={context}
      isEditing={isEditing}
    />
  );
}
