// =============================================
// STOREFRONT 404 - Dedicated 404 page for storefront routes
// Never redirects to Home, shows clear error message
// =============================================

import { Link } from 'react-router-dom';
import { Home, FileX, ShoppingBag, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPublicHomeUrl } from '@/lib/publicUrls';

interface Storefront404Props {
  tenantSlug: string;
  entityType?: 'product' | 'category' | 'page' | 'landing' | 'generic';
  entitySlug?: string;
}

const messages = {
  product: {
    title: 'Produto não encontrado',
    description: 'O produto que você procura não existe ou não está mais disponível.',
    icon: ShoppingBag,
  },
  category: {
    title: 'Categoria não encontrada',
    description: 'A categoria que você procura não existe ou não está ativa.',
    icon: Search,
  },
  page: {
    title: 'Página não encontrada',
    description: 'A página que você procura não existe ou não está publicada.',
    icon: FileX,
  },
  landing: {
    title: 'Página não encontrada',
    description: 'A landing page que você procura não existe ou não está publicada.',
    icon: FileX,
  },
  generic: {
    title: 'Página não encontrada',
    description: 'A página que você procura não existe.',
    icon: FileX,
  },
};

export function Storefront404({ 
  tenantSlug, 
  entityType = 'generic',
  entitySlug 
}: Storefront404Props) {
  const config = messages[entityType];
  const Icon = config.icon;
  const homeUrl = getPublicHomeUrl(tenantSlug);

  // Log 404 for debugging (dev only)
  if (import.meta.env.DEV) {
    console.warn(`[Storefront 404] Type: ${entityType}, Slug: ${entitySlug || 'N/A'}, Tenant: ${tenantSlug}`);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <div className="mx-auto w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon className="h-10 w-10 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {config.title}
          </h1>
          <p className="text-muted-foreground">
            {config.description}
          </p>
          {entitySlug && import.meta.env.DEV && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              Slug: {entitySlug}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link to={homeUrl}>
              <Home className="h-4 w-4 mr-2" />
              Ir para a loja
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
