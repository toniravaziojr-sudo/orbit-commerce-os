// =============================================
// SOCIAL PROOF BLOCK - Unified (Testimonials + Reviews)
// mode: 'testimonials' = simple text + role (ex-Testimonials)
// mode: 'reviews' = star ratings + product info (ex-Reviews)
// =============================================

import React from 'react';
import { TestimonialsBlock } from '../interactive/TestimonialsBlock';
import { ReviewsBlock } from '../ReviewsBlock';
import type { SocialProofBlockProps } from './types';

export function SocialProofBlock({
  mode = 'testimonials',
  title,
  items,
  reviews,
  visibleCount = 3,
  context,
  isEditing = false,
}: SocialProofBlockProps) {
  if (mode === 'reviews') {
    return (
      <ReviewsBlock
        title={title}
        reviews={reviews}
        visibleCount={visibleCount}
        context={context}
        isEditing={isEditing}
      />
    );
  }

  // Testimonials mode (default)
  return (
    <TestimonialsBlock
      title={title}
      items={items}
      isEditing={isEditing}
    />
  );
}
