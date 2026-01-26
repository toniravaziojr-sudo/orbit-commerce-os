// =============================================
// STOREFRONT PAGE RENDERER - Renders builder content
// =============================================

import { useParams } from 'react-router-dom';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { usePublicTemplate } from '@/hooks/usePublicTemplate';
import { BlockRenderer } from '@/components/builder/BlockRenderer';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';

interface StorefrontPageRendererProps {
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout';
  categoryData?: {
    id: string;
    name: string;
    slug: string;
    description?: string;
  };
  productData?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    description?: string;
    images?: { url: string; alt_text?: string }[];
  };
}

export function StorefrontPageRenderer({ 
  pageType, 
  categoryData, 
  productData 
}: StorefrontPageRendererProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { storeSettings, headerMenu, footerMenu } = usePublicStorefront(tenantSlug || '');
  const { content, isLoading } = usePublicTemplate(tenantSlug || '', pageType);

  if (isLoading) {
    return (
      <div className="min-h-screen p-8 space-y-8">
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const context: BlockRenderContext = {
    tenantSlug: tenantSlug || '',
    isPreview: false,
    category: categoryData,
    product: productData,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      // NOTE: primary_color removed - colors managed via Configuração do tema > Cores
    },
    headerMenu: headerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    footerMenu: footerMenu?.items?.map(item => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
  };

  return (
    <BlockRenderer
      node={content}
      context={context}
      isEditing={false}
    />
  );
}
