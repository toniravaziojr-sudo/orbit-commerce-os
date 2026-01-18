// =============================================
// BLOG LISTING BLOCK - Lists published blog posts
// =============================================

import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// Note: useStorefrontConfig removed - calling hooks inside try-catch violates Rules of Hooks
import { getStoreBaseUrl } from '@/lib/publicUrls';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  published_at: string | null;
  read_time_minutes: number | null;
  tags: string[] | null;
}

interface BlogListingBlockProps {
  title?: string;
  description?: string;
  postsPerPage?: number;
  showExcerpt?: boolean;
  showImage?: boolean;
  showTags?: boolean;
  showPagination?: boolean;
  context?: any;
  isEditing?: boolean;
}

export function BlogListingBlock({
  title = 'Blog',
  description = 'Novidades e dicas',
  postsPerPage = 9,
  showExcerpt = true,
  showImage = true,
  showTags = true,
  showPagination = true,
  context,
  isEditing,
}: BlogListingBlockProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [currentPage, setCurrentPage] = React.useState(1);
  
  // Get tenant ID from context first (provided by Builder), otherwise try URL param
  // Note: useStorefrontConfig was removed because calling hooks inside try-catch
  // violates React's Rules of Hooks and causes error #300
  const tenantId = context?.tenantId || context?.settings?.tenant_id;
  const basePath = getStoreBaseUrl(tenantSlug || '');

  // Fetch total count for pagination
  const { data: totalCount } = useQuery({
    queryKey: ['blog-posts-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      
      const { count, error } = await supabase
        .from('blog_posts')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'published');

      if (error) return 0;
      return count || 0;
    },
    enabled: !!tenantId && !isEditing && showPagination,
  });

  const totalPages = Math.ceil((totalCount || 0) / postsPerPage);

  // Fetch published posts with pagination
  const { data: posts, isLoading } = useQuery({
    queryKey: ['blog-posts-public', tenantId, currentPage, postsPerPage],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const from = (currentPage - 1) * postsPerPage;
      const to = from + postsPerPage - 1;
      
      const { data, error } = await supabase
        .from('blog_posts')
        .select('id, title, slug, excerpt, featured_image_url, featured_image_alt, published_at, read_time_minutes, tags')
        .eq('tenant_id', tenantId)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching blog posts:', error);
        return [];
      }

      return data as BlogPost[];
    },
    enabled: !!tenantId && !isEditing,
  });

  // Editor preview
  if (isEditing) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">{title}</h1>
          {description && <p className="text-xl text-muted-foreground">{description}</p>}
        </div>

        <div className="sf-blog-grid">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden group cursor-pointer hover:shadow-lg transition-shadow">
              {showImage && (
                <div className="aspect-video bg-muted" />
              )}
              <CardHeader>
                <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                  Título do post de exemplo {i}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    15 de Dez, 2024
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    5 min de leitura
                  </span>
                </CardDescription>
              </CardHeader>
              {showExcerpt && (
                <CardContent>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    Este é um exemplo de resumo do post. Ele aparece aqui para mostrar como fica no layout final.
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-8">
          [Prévia do bloco de listagem do blog - posts reais aparecem no storefront]
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center mb-12">
          <Skeleton className="h-10 w-48 mx-auto mb-3" />
          <Skeleton className="h-6 w-64 mx-auto" />
        </div>

        <div className="sf-blog-grid">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-video" />
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Show demo blog posts when no posts exist (runtime - after isEditing check which already shows demo)
  if (!posts || posts.length === 0) {
    const demoPosts = [
      { id: 'demo-1', title: 'Dicas para escolher o produto ideal', excerpt: 'Confira nossas dicas para fazer a melhor escolha.', date: '15 de Jan, 2024', time: '5 min' },
      { id: 'demo-2', title: 'Novidades da temporada', excerpt: 'Descubra o que há de novo em nossa loja.', date: '12 de Jan, 2024', time: '3 min' },
      { id: 'demo-3', title: 'Guia completo de cuidados', excerpt: 'Aprenda a cuidar melhor dos seus produtos.', date: '10 de Jan, 2024', time: '8 min' },
    ];

    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-3">{title}</h1>
          {description && <p className="text-xl text-muted-foreground">{description}</p>}
        </div>

        <div className="sf-blog-grid">
          {demoPosts.map((post) => (
            <Card key={post.id} className="overflow-hidden group pointer-events-none">
              {showImage && (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <span className="text-4xl">📝</span>
                </div>
              )}
              <CardHeader>
                <CardTitle className="line-clamp-2 text-muted-foreground">
                  {post.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {post.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {post.time}
                  </span>
                </CardDescription>
              </CardHeader>
              {showExcerpt && (
                <CardContent>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {post.excerpt}
                  </p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        <p className="text-xs text-center text-muted-foreground mt-8">
          [Exemplo demonstrativo] Crie posts reais em Marketing → Blog
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-3">{title}</h1>
        {description && <p className="text-xl text-muted-foreground">{description}</p>}
      </div>

      <div className="sf-blog-grid">
        {posts.map((post) => (
          <Link key={post.id} to={`${basePath}/blog/${post.slug}`}>
            <Card className="overflow-hidden h-full group cursor-pointer hover:shadow-lg transition-shadow">
              {showImage && post.featured_image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={post.featured_image_url}
                    alt={post.featured_image_alt || post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              {showImage && !post.featured_image_url && (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <span className="text-4xl">📝</span>
                </div>
              )}
              
              <CardHeader>
                <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </CardTitle>
                <CardDescription className="flex items-center gap-4 text-xs">
                  {post.published_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(post.published_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                    </span>
                  )}
                  {post.read_time_minutes && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {post.read_time_minutes} min
                    </span>
                  )}
                </CardDescription>
              </CardHeader>

              {showExcerpt && post.excerpt && (
                <CardContent>
                  <p className="text-muted-foreground text-sm line-clamp-2">
                    {post.excerpt}
                  </p>
                </CardContent>
              )}

              {showTags && post.tags && post.tags.length > 0 && (
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-1">
                    {post.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs bg-muted px-2 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          
          <span className="text-sm text-muted-foreground px-4">
            Página {currentPage} de {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Próxima
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
