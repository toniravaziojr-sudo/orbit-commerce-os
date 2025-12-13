// =============================================
// STOREFRONT PAGE - Public institutional page
// =============================================

import { useParams, Link } from 'react-router-dom';
import { usePublicStorefront, usePublicPage } from '@/hooks/useStorefront';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Home } from 'lucide-react';

export default function StorefrontPage() {
  const { tenantSlug, pageSlug } = useParams<{ tenantSlug: string; pageSlug: string }>();
  const { storeSettings, isLoading: storeLoading, isPublished } = usePublicStorefront(tenantSlug || '');
  const { page, isLoading: pageLoading } = usePublicPage(tenantSlug || '', pageSlug || '');

  if (storeLoading || pageLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!isPublished) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loja não disponível</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Página não encontrada</h1>
        <p className="text-muted-foreground mb-6">
          A página que você procura não existe ou não está publicada.
        </p>
        <Link 
          to={`/store/${tenantSlug}`}
          className="inline-flex items-center text-primary hover:underline"
        >
          <Home className="h-4 w-4 mr-2" />
          Voltar para a loja
        </Link>
      </div>
    );
  }

  // Extract content text
  const contentText = typeof page.content === 'object' && page.content !== null && 'text' in page.content
    ? (page.content as { text: string }).text
    : '';

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to={`/store/${tenantSlug}`} className="hover:text-foreground">
          Início
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{page.title}</span>
      </nav>

      {/* Page Content */}
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold mb-6">{page.title}</h1>
        
        <div className="prose prose-lg max-w-none">
          {contentText.split('\n').map((paragraph, i) => (
            paragraph.trim() ? (
              <p key={i} className="mb-4 text-muted-foreground leading-relaxed">
                {paragraph}
              </p>
            ) : null
          ))}
        </div>
      </article>
    </div>
  );
}
