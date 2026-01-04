import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface GalleryImage {
  id?: string;
  src: string;
  alt?: string;
  caption?: string;
}

interface ImageGalleryBlockProps {
  title?: string;
  subtitle?: string;
  images: GalleryImage[];
  columns?: 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  enableLightbox?: boolean;
  aspectRatio?: 'square' | '4:3' | '16:9' | 'auto';
  borderRadius?: number;
  backgroundColor?: string;
}

interface ImageGalleryBlockPropsWithContext extends ImageGalleryBlockProps {
  context?: { viewport?: 'desktop' | 'mobile' | 'tablet' };
}

export function ImageGalleryBlock({
  title,
  subtitle,
  images = [],
  columns = 3,
  gap = 'md',
  enableLightbox = true,
  aspectRatio = 'square',
  borderRadius = 8,
  backgroundColor = 'transparent',
  context,
}: ImageGalleryBlockPropsWithContext) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  
  // Detect if we're in builder mode (disable interactions)
  const isInBuilder = context?.viewport !== undefined;

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };

  const colClasses = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  };

  const aspectClasses = {
    square: 'aspect-square',
    '4:3': 'aspect-[4/3]',
    '16:9': 'aspect-video',
    auto: '',
  };

  const openLightbox = (index: number) => {
    // Disable lightbox in builder mode
    if (enableLightbox && !isInBuilder) {
      setLightboxIndex(index);
    }
  };

  const closeLightbox = () => setLightboxIndex(null);

  const goToPrev = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
    }
  };

  const goToNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % images.length);
    }
  };

  return (
    <section 
      className="py-10 md:py-14 px-4"
      style={{ backgroundColor }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        {(title || subtitle) && (
          <div className="text-center mb-8 md:mb-10">
            {title && (
              <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Gallery Grid */}
        {images.length > 0 ? (
          <div className={cn(
            'grid',
            colClasses[columns],
            gapClasses[gap]
          )}>
            {images.map((image, index) => (
              <div
                key={image.id || index}
                className={cn(
                  'relative overflow-hidden group',
                  enableLightbox && 'cursor-pointer'
                )}
                style={{ borderRadius }}
                onClick={() => openLightbox(index)}
              >
                <img
                  src={image.src}
                  alt={image.alt || `Imagem ${index + 1}`}
                  className={cn(
                    'w-full h-full object-cover transition-transform duration-300 group-hover:scale-105',
                    aspectClasses[aspectRatio]
                  )}
                />
                {image.caption && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 translate-y-full group-hover:translate-y-0 transition-transform">
                    <p className="text-white text-sm">{image.caption}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
            Adicione imagens à galeria
          </div>
        )}

        {/* Lightbox */}
        {lightboxIndex !== null && images[lightboxIndex] && (
          <div 
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-50"
            >
              <X className="w-8 h-8" />
            </button>

            {/* Navigation */}
            {images.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); goToPrev(); }}
                  className="absolute left-4 text-white/80 hover:text-white p-2"
                >
                  <ChevronLeft className="w-10 h-10" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); goToNext(); }}
                  className="absolute right-4 text-white/80 hover:text-white p-2"
                >
                  <ChevronRight className="w-10 h-10" />
                </button>
              </>
            )}

            {/* Image */}
            <img
              src={images[lightboxIndex].src}
              alt={images[lightboxIndex].alt || ''}
              className="max-w-[90vw] max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Caption */}
            {images[lightboxIndex].caption && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-center px-4">
                <p>{images[lightboxIndex].caption}</p>
                <p className="text-sm text-white/60 mt-1">
                  {lightboxIndex + 1} / {images.length}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default ImageGalleryBlock;
