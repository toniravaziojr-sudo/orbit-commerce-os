// =============================================
// FEATURED CATEGORIES BLOCK - Category showcase with images
// =============================================

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { getPublicCategoryUrl } from '@/lib/publicUrls';

interface CategoryItemConfig {
  categoryId: string;
  miniImageDesktop?: string;
  miniImageMobile?: string;
}

interface CategoryData {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
}

interface FeaturedCategoriesBlockProps {
  title?: string;
  items?: CategoryItemConfig[];
  // Legacy support
  categoryIds?: string[];
  mobileStyle?: 'carousel' | 'grid';
  showName?: boolean;
  context?: BlockRenderContext;
  isEditing?: boolean;
}

export function FeaturedCategoriesBlock({
  title = 'Categorias',
  items = [],
  categoryIds = [],
  mobileStyle = 'carousel',
  showName = true,
  context,
  isEditing = false,
}: FeaturedCategoriesBlockProps) {
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && useIsMobile());
  const [categories, setCategories] = useState<(CategoryData & { config?: CategoryItemConfig })[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    slidesToScroll: isMobile ? 3 : 6,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Normalize items - support both new format (items) and legacy (categoryIds)
  const normalizedItems: CategoryItemConfig[] = items.length > 0 
    ? items 
    : categoryIds.map(id => ({ categoryId: id }));

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        
        const categoryIdsToFetch = normalizedItems.map(item => item.categoryId).filter(Boolean);
        
        let query = supabase
          .from('categories')
          .select('id, name, slug, image_url')
          .eq('is_active', true);

        if (categoryIdsToFetch.length > 0) {
          query = query.in('id', categoryIdsToFetch);
        } else {
          query = query.limit(8);
        }

        const { data, error } = await query.order('sort_order', { ascending: true });

        if (error) throw error;
        
        // Merge category data with config (mini images)
        const mergedData = (data || []).map(cat => {
          const config = normalizedItems.find(item => item.categoryId === cat.id);
          return { ...cat, config };
        });
        
        // Maintain order from items array
        if (categoryIdsToFetch.length > 0) {
          mergedData.sort((a, b) => {
            const indexA = categoryIdsToFetch.indexOf(a.id);
            const indexB = categoryIdsToFetch.indexOf(b.id);
            return indexA - indexB;
          });
        }
        
        setCategories(mergedData);
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, [JSON.stringify(normalizedItems)]);

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </section>
    );
  }

  if (categories.length === 0) {
    // Demo placeholder categories when none exist
    const placeholderCategories = [
      { id: 'demo-1', name: 'Categoria 1', slug: '#', image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&h=200&fit=crop&q=80' },
      { id: 'demo-2', name: 'Categoria 2', slug: '#', image_url: 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=200&h=200&fit=crop&q=80' },
      { id: 'demo-3', name: 'Categoria 3', slug: '#', image_url: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=200&h=200&fit=crop&q=80' },
      { id: 'demo-4', name: 'Categoria 4', slug: '#', image_url: 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=200&h=200&fit=crop&q=80' },
      { id: 'demo-5', name: 'Categoria 5', slug: '#', image_url: 'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?w=200&h=200&fit=crop&q=80' },
      { id: 'demo-6', name: 'Categoria 6', slug: '#', image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&h=200&fit=crop&q=80' },
    ];

    return (
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          {title && (
            <h2 className="text-2xl font-bold mb-6 text-center">{title}</h2>
          )}
          {/* Show placeholder grid with overlay */}
          <div className="relative">
            <div className={cn(
              'grid gap-6 justify-items-center opacity-50',
              isMobile 
                ? 'grid-cols-3' 
                : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6'
            )}>
              {placeholderCategories.map((cat) => (
                <div key={cat.id} className="flex flex-col items-center">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted/30 overflow-hidden mb-2 ring-2 ring-transparent">
                    <img
                      src={cat.image_url}
                      alt={cat.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-sm font-medium text-center mt-1">{cat.name}</span>
                </div>
              ))}
            </div>
            {/* Overlay with CTA */}
            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px] rounded-lg">
              <div className="text-center p-6 rounded-lg bg-card shadow-lg border">
                <p className="text-muted-foreground mb-3">Suas categorias aparecerão aqui</p>
                {isEditing && (
                  <p className="text-xs text-muted-foreground">
                    Crie categorias no menu Produtos → Categorias
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const CategoryCard = ({ category }: { category: CategoryData & { config?: CategoryItemConfig } }) => {
    // Priority: mini image (viewport-aware) > category.image_url > placeholder
    const miniImage = isMobile && category.config?.miniImageMobile 
      ? category.config.miniImageMobile 
      : (category.config?.miniImageDesktop || null);
    
    const imageUrl = miniImage || category.image_url;

    const cardContent = (
      <>
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-muted/30 overflow-hidden mb-2 ring-2 ring-transparent group-hover:ring-primary transition-all">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={category.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
        {showName && (
          <span className="text-sm font-medium text-center mt-1 group-hover:text-primary transition-colors">
            {category.name}
          </span>
        )}
      </>
    );

    // In editor mode, don't use Link to prevent navigation
    if (isEditing) {
      return (
        <div className="group flex flex-col items-center cursor-pointer">
          {cardContent}
        </div>
      );
    }

    return (
      <Link 
        to={getPublicCategoryUrl(context?.tenantSlug || '', category.slug)}
        className="group flex flex-col items-center"
      >
        {cardContent}
      </Link>
    );
  };

  const useCarousel = isMobile && mobileStyle === 'carousel';

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">{title}</h2>
          {useCarousel && categories.length > 6 && (
            <div className="flex gap-2">
              <button
                onClick={scrollPrev}
                className="p-2 rounded-full border hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={scrollNext}
                className="p-2 rounded-full border hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Categories */}
        {useCarousel ? (
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-6">
              {categories.map((category) => (
                <div key={category.id} className="flex-shrink-0">
                  <CategoryCard category={category} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn(
            'grid gap-6 justify-items-center',
            isMobile 
              ? 'grid-cols-3' 
              : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7'
          )}>
            {categories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}

        {/* Dots indicator for carousel */}
        {useCarousel && categories.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          </div>
        )}
      </div>
    </section>
  );
}
