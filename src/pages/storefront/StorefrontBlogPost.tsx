// =============================================
// STOREFRONT BLOG POST - Renders individual blog post
// =============================================

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePublicStorefront } from '@/hooks/useStorefront';
import { PublicTemplateRenderer } from '@/components/storefront/PublicTemplateRenderer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import { Storefront404 } from '@/components/storefront/Storefront404';
import { getDefaultTemplate } from '@/lib/builder/defaults';
import type { BlockNode } from '@/lib/builder/types';
import type { Json } from '@/integrations/supabase/types';

export default function StorefrontBlogPost() {
  const { tenantSlug, postSlug } = useParams<{ tenantSlug?: string; postSlug: string }>();
  const { storeSettings, headerMenu, footerMenu, categories, isLoading: storeLoading } = usePublicStorefront(tenantSlug || '');
  const basePath = getStoreBaseUrl(tenantSlug || '');

  // Fetch blog post by slug
  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['blog-post', storeSettings?.tenant_id, postSlug],
    queryFn: async () => {
      if (!storeSettings?.tenant_id || !postSlug) return null;

      const { data, error } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('tenant_id', storeSettings.tenant_id)
        .eq('slug', postSlug)
        .eq('status', 'published')
        .maybeSingle();

      if (error) {
        console.error('Error fetching blog post:', error);
        return null;
      }

      return data;
    },
    enabled: !!storeSettings?.tenant_id && !!postSlug,
  });

  const isLoading = storeLoading || postLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-16 w-full" />
        <div className="container mx-auto max-w-4xl py-12 px-4">
          <Skeleton className="h-8 w-32 mb-8" />
          <Skeleton className="h-12 w-3/4 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <Skeleton className="aspect-video w-full mb-8" />
          <div className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return <Storefront404 tenantSlug={tenantSlug || ''} entityType="page" entitySlug={postSlug} />;
  }

  // Build context for the renderer
  const context = {
    tenantSlug: tenantSlug || '',
    tenantId: storeSettings?.tenant_id,
    isPreview: false,
    settings: {
      store_name: storeSettings?.store_name || undefined,
      logo_url: storeSettings?.logo_url || undefined,
      primary_color: storeSettings?.primary_color || undefined,
    },
    headerMenu: headerMenu?.items?.map((item: any) => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    footerMenu: footerMenu?.items?.map((item: any) => ({
      id: item.id,
      label: item.label,
      url: item.url || undefined,
    })),
    categories: categories?.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
    })),
  };

  // If post has content (builder content), render it
  if (post.content) {
    return (
      <PublicTemplateRenderer
        content={post.content as unknown as BlockNode}
        context={context}
      />
    );
  }

  // Otherwise, render a default blog post layout
  return (
    <PublicTemplateRenderer
      content={getDefaultTemplate('institutional')}
      context={{
        ...context,
        afterHeaderSlot: (
          <article className="container mx-auto max-w-4xl py-12 px-4">
            <Link to={`${basePath}/blog`}>
              <Button variant="ghost" className="mb-8 -ml-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar ao blog
              </Button>
            </Link>

            <header className="mb-8">
              <h1 className="text-4xl font-bold mb-4">{post.title}</h1>
              <div className="flex items-center gap-4 text-muted-foreground">
                {post.published_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(post.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </span>
                )}
                {post.read_time_minutes && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {post.read_time_minutes} min de leitura
                  </span>
                )}
              </div>
            </header>

            {post.featured_image_url && (
              <img
                src={post.featured_image_url}
                alt={post.featured_image_alt || post.title}
                className="w-full aspect-video object-cover rounded-lg mb-8"
              />
            )}

            {post.excerpt && (
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                {post.excerpt}
              </p>
            )}

            {post.tags && post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t">
                {post.tags.map((tag: string) => (
                  <span key={tag} className="bg-muted px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>
        ),
      }}
    />
  );
}
