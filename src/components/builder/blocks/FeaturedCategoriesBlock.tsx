// =============================================
// FEATURED CATEGORIES BLOCK - Category showcase with images
// =============================================

import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight, ImageIcon, Loader2 } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';
import { getLogoImageUrl } from '@/lib/imageTransform';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { getPublicCategoryUrl } from '@/lib/publicUrls';


interface CategoryItemConfig {
  categoryId: string;
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
  // Hook must be called unconditionally (Rules of Hooks)
  const deviceIsMobile = useIsMobile();
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && deviceIsMobile);
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

  // Check if we have explicit category selections
  const hasExplicitSelection = normalizedItems.length > 0 && normalizedItems.some(item => item.categoryId);

  // Fetch categories with error boundary protection
  useEffect(() => {
    let isMounted = true;
    
    const fetchCategories = async () => {
      try {
        if (isMounted) setIsLoading(true);
        
        const categoryIdsToFetch = normalizedItems.map(item => item.categoryId).filter(Boolean);
        
        // If no explicit selection, don't fetch - show placeholder instead
        // This prevents loading tenant-specific data in new templates
        if (categoryIdsToFetch.length === 0) {
          if (isMounted) {
            setCategories([]);
            setIsLoading(false);
          }
          return;
        }
        
        const { data, error } = await supabase
          .from('categories')
          .select('id, name, slug, image_url')
          .eq('is_active', true)
          .in('id', categoryIdsToFetch)
          .order('sort_order', { ascending: true });

        if (!isMounted) return;
        
        if (error) {
          console.error('Error fetching categories:', error);
          setCategories([]);
          return;
        }
        
        // Merge category data with config (mini images)
        const mergedData = (data || []).map(cat => {
          const config = normalizedItems.find(item => item.categoryId === cat.id);
          return { ...cat, config };
        });
        
        // Maintain order from items array
        mergedData.sort((a, b) => {
          const indexA = categoryIdsToFetch.indexOf(a.id);
          const indexB = categoryIdsToFetch.indexOf(b.id);
          return indexA - indexB;
        });
        
        setCategories(mergedData);
      } catch (error) {
        console.error('Error fetching categories:', error);
        if (isMounted) setCategories([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchCategories();
    
    return () => {
      isMounted = false;
    };
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

  // Show demo categories when editing and no categories found
  if (categories.length === 0) {
    if (isEditing) {
      const demoCategories = [
        { id: 'demo-1', name: 'Moda', slug: 'moda' },
        { id: 'demo-2', name: 'Eletrônicos', slug: 'eletronicos' },
        { id: 'demo-3', name: 'Casa & Decoração', slug: 'casa-decoracao' },
        { id: 'demo-4', name: 'Esportes', slug: 'esportes' },
        { id: 'demo-5', name: 'Beleza', slug: 'beleza' },
        { id: 'demo-6', name: 'Infantil', slug: 'infantil' },
      ];

      return (
        <section className="py-6 sm:py-8">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{title}</h2>
            <div className={cn(
              'grid gap-4 sm:gap-6 justify-items-center',
              isMobile ? 'grid-cols-3' : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6'
            )}>
              {demoCategories.map((cat) => (
                <div key={cat.id} className="group flex flex-col items-center cursor-pointer">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-muted/30 overflow-hidden mb-2 ring-2 ring-transparent group-hover:ring-primary transition-all flex items-center justify-center">
                    <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/30" />
                  </div>
                  {showName && (
                    <span className="text-xs sm:text-sm font-medium text-center mt-1 group-hover:text-primary transition-colors line-clamp-2">
                      {cat.name}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              [Exemplo demonstrativo] Selecione categorias reais no painel lateral
            </p>
          </div>
        </section>
      );
    }
    return null;
  }

  const displayCategories = categories;

  const CategoryCard = ({ category }: { category: CategoryData & { config?: CategoryItemConfig } }) => {
    // Use category.image_url directly (miniatures are managed in Categories)
    const imageUrl = category.image_url;
    const isCategoryDemo = category.id.startsWith('demo-');

    const cardContent = (
      <>
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-muted/30 overflow-hidden mb-2 ring-2 ring-transparent group-hover:ring-primary transition-all flex-shrink-0">
          {imageUrl ? (
            <img
              src={getLogoImageUrl(imageUrl, 200)}
              alt={category.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/30" />
            </div>
          )}
        </div>
        {showName && (
          <span className="text-xs sm:text-sm font-medium text-center mt-1 group-hover:text-primary transition-colors line-clamp-2">
            {category.name}
          </span>
        )}
      </>
    );

    if (isEditing || isCategoryDemo) {
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
    <section className="py-6 sm:py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold">{title}</h2>
          {useCarousel && displayCategories.length > 6 && (
            <div className="flex gap-2">
              <button onClick={scrollPrev} className="p-2 rounded-full border hover:bg-muted transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={scrollNext} className="p-2 rounded-full border hover:bg-muted transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {useCarousel ? (
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex gap-4 sm:gap-6">
              {displayCategories.map((category) => (
                <div key={category.id} className="flex-shrink-0">
                  <CategoryCard category={category} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={cn(
            'grid gap-4 sm:gap-6 justify-items-center',
            isMobile ? 'grid-cols-3' : 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6'
          )}>
            {displayCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}

        {useCarousel && displayCategories.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-4">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="w-2 h-2 rounded-full bg-muted-foreground/30" />
          </div>
        )}
      </div>
    </section>
  );
}
