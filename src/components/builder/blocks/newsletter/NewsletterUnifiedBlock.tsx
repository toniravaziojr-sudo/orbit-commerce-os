// =============================================
// NEWSLETTER BLOCK - Unified orchestrator
// Routes to: NewsletterBlock (inline) | NewsletterFormBlock (form) | PopupModalBlock (popup)
// =============================================

import { NewsletterBlock } from '../interactive/NewsletterBlock';
import { NewsletterFormBlock } from '../interactive/NewsletterFormBlock';
import { PopupModalBlock } from '../interactive/PopupModalBlock';
import type { UnifiedNewsletterBlockProps } from './types';

export function NewsletterUnifiedBlock(props: UnifiedNewsletterBlockProps) {
  const { mode = 'inline', ...rest } = props;

  if (mode === 'form') {
    return <NewsletterFormBlock {...rest as any} />;
  }

  if (mode === 'popup') {
    return <PopupModalBlock {...rest as any} />;
  }

  // Default: inline
  return <NewsletterBlock {...rest as any} />;
}
