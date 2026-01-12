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
import { demoCategories } from '@/lib/builder/demoData';

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

  // Use demo categories from demoData when no real categories exist
  const displayCategories = categories.length > 0 
    ? categories 
    : demoCategories.map(c => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        image_url: c.image_url,
      }));

  const isDemo = categories.length === 0;

  const CategoryCard = ({ category }: { category: CategoryData & { config?: CategoryItemConfig } }) => {
    const miniImage = isMobile && category.config?.miniImageMobile 
      ? category.config.miniImageMobile 
      : (category.config?.miniImageDesktop || null);
    
    const imageUrl = miniImage || category.image_url;
    const isCategoryDemo = category.id.startsWith('demo-');

    const cardContent = (
      <>
        <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full bg-muted/30 overflow-hidden mb-2 ring-2 ring-transparent group-hover:ring-primary transition-all">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={category.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
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
          {isDemo && isEditing && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
              Demonstrativo
            </span>
          )}
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
