import { useParams } from 'react-router-dom';
import { StorefrontFooterContent } from './StorefrontFooterContent';
import { usePublicGlobalLayout } from '@/hooks/useGlobalLayoutIntegration';

/**
 * StorefrontFooter - Wrapper component for public storefront footer
 * Uses the unified StorefrontFooterContent for consistent rendering
 * Fetches global layout and passes footer_config for proper priority
 */
export function StorefrontFooter() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  
  // Fetch global layout for footer config
  const { data: globalLayout } = usePublicGlobalLayout(tenantSlug || '');
  
  return (
    <StorefrontFooterContent 
      tenantSlug={tenantSlug || ''} 
      footerConfig={globalLayout?.footer_config}
      isEditing={false} 
    />
  );
}
