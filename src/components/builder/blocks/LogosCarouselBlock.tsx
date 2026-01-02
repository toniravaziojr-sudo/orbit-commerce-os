import React from 'react';
import { cn } from '@/lib/utils';

interface Logo {
  id?: string;
  imageUrl: string;
  alt?: string;
  linkUrl?: string;
}

interface LogosCarouselBlockProps {
  title?: string;
  subtitle?: string;
  logos: Logo[];
  autoplay?: boolean;
  grayscale?: boolean;
  columns?: number;
  backgroundColor?: string;
  padding?: 'sm' | 'md' | 'lg';
}

export function LogosCarouselBlock({
  title = 'Nossos Parceiros',
  subtitle,
  logos = [],
  autoplay = true,
  grayscale = true,
  columns = 5,
  backgroundColor = 'transparent',
  padding = 'md',
}: LogosCarouselBlockProps) {
  const paddingClasses = {
    sm: 'py-6',
    md: 'py-10 md:py-14',
    lg: 'py-14 md:py-20',
  };

  const gridCols = {
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-6',
  };

  return (
    <section 
      className={cn('px-4', paddingClasses[padding])}
      style={{ backgroundColor }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        {(title || subtitle) && (
          <div className="text-center mb-8 md:mb-10">
            {title && (
              <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-2">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-muted-foreground text-sm">
                {subtitle}
              </p>
            )}
          </div>
        )}

        {/* Logos Grid */}
        {logos.length > 0 ? (
          <div className={cn(
            'grid gap-6 md:gap-8 items-center justify-items-center',
            gridCols[columns as keyof typeof gridCols] || gridCols[5]
          )}>
            {logos.map((logo, index) => {
              const LogoImg = (
                <img
                  src={logo.imageUrl}
                  alt={logo.alt || `Logo ${index + 1}`}
                  className={cn(
                    'max-h-12 md:max-h-16 w-auto object-contain transition-all duration-300',
                    grayscale && 'grayscale hover:grayscale-0 opacity-60 hover:opacity-100'
                  )}
                />
              );

              if (logo.linkUrl) {
                return (
                  <a
                    key={logo.id || index}
                    href={logo.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    {LogoImg}
                  </a>
                );
              }

              return (
                <div key={logo.id || index}>
                  {LogoImg}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
            Adicione logos de parceiros ou marcas
          </div>
        )}

        {/* Infinite scroll animation for autoplay (CSS-based) */}
        {autoplay && logos.length > columns && (
          <style>{`
            @keyframes scroll-logos {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        )}
      </div>
    </section>
  );
}

export default LogosCarouselBlock;
