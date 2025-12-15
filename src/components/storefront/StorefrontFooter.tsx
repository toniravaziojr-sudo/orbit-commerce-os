import { useParams } from 'react-router-dom';
import { StorefrontFooterContent } from './StorefrontFooterContent';

/**
 * StorefrontFooter - Wrapper component for public storefront footer
 * Uses the unified StorefrontFooterContent for consistent rendering
 */
export function StorefrontFooter() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  
  // Create a minimal context for the footer content
  const context = {
    tenantSlug: tenantSlug || '',
    settings: null,
    isCheckout: false,
    isPreview: false,
  };

  return <StorefrontFooterContent context={context} isEditing={false} />;
}
