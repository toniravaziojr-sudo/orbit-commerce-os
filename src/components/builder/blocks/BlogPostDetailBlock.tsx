// =============================================
// BLOG POST DETAIL BLOCK - Renders blog post content from context
// Consumes blogPost data from BlockRenderContext
// =============================================

import { Link } from 'react-router-dom';
import { Calendar, Clock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getStoreBaseUrl } from '@/lib/publicUrls';
import type { BlockRenderContext } from '@/lib/builder/types';

interface BlogPostDetailBlockProps {
  context?: BlockRenderContext & { blogPost?: BlogPostData };
  isEditing?: boolean;
}

interface BlogPostData {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  featured_image_url?: string | null;
  featured_image_alt?: string | null;
  published_at?: string | null;
  read_time_minutes?: number | null;
  tags?: string[] | null;
  content?: unknown;
}

export function BlogPostDetailBlock({ context, isEditing = false }: BlogPostDetailBlockProps) {
  const blogPost = context?.blogPost;
  const tenantSlug = context?.tenantSlug || '';
  const basePath = getStoreBaseUrl(tenantSlug);

  // Empty state for editor
  if (!blogPost) {
    if (isEditing) {
      return (
        <div className="container mx-auto max-w-4xl py-12 px-4">
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-12 text-center">
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Conteúdo do Post
            </h3>
            <p className="text-sm text-muted-foreground">
              Este bloco renderiza o conteúdo do post do blog automaticamente.
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <article className="container mx-auto max-w-4xl py-12 px-4">
      <Link to={`${basePath}/blog`}>
        <Button variant="ghost" className="mb-8 -ml-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao blog
        </Button>
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold mb-4">{blogPost.title}</h1>
        <div className="flex items-center gap-4 text-muted-foreground">
          {blogPost.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(blogPost.published_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </span>
          )}
          {blogPost.read_time_minutes && (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {blogPost.read_time_minutes} min de leitura
            </span>
          )}
        </div>
      </header>

      {blogPost.featured_image_url && (
        <img
          src={blogPost.featured_image_url}
          alt={blogPost.featured_image_alt || blogPost.title}
          className="w-full aspect-video object-cover rounded-lg mb-8"
        />
      )}

      {blogPost.excerpt && (
        <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
          {blogPost.excerpt}
        </p>
      )}

      {blogPost.tags && blogPost.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-8 pt-8 border-t">
          {blogPost.tags.map((tag: string) => (
            <span key={tag} className="bg-muted px-3 py-1 rounded-full text-sm">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export default BlogPostDetailBlock;
