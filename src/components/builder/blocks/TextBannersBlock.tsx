// =============================================
// TEXT + BANNERS BLOCK - Text content with banner images and CTA
// =============================================

import { cn } from '@/lib/utils';
import { ImageIcon } from 'lucide-react';
import { BlockRenderContext } from '@/lib/builder/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { Link } from 'react-router-dom';

interface TextBannersBlockProps {
  title?: string;
  text?: string;
  imageDesktop1?: string;
  imageMobile1?: string;
  imageDesktop2?: string;
  imageMobile2?: string;
  ctaEnabled?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  ctaBgColor?: string;
  ctaTextColor?: string;
  layout?: 'text-left' | 'text-right';
  context?: BlockRenderContext;
}

export function TextBannersBlock({
  title = 'Título legal',
  text = 'Escreva seu texto aqui, falando um pouco sobre sua marca, produto, empresa ou promoção. Solte sua imaginação!',
  imageDesktop1,
  imageMobile1,
  imageDesktop2,
  imageMobile2,
  ctaEnabled = true,
  ctaText = 'Saiba mais',
  ctaUrl = '#',
  ctaBgColor,
  ctaTextColor,
  layout = 'text-left',
  context,
}: TextBannersBlockProps) {
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && useIsMobile());
  
  const image1 = isMobile && imageMobile1 ? imageMobile1 : imageDesktop1;
  const image2 = isMobile && imageMobile2 ? imageMobile2 : imageDesktop2;

  const ImagePlaceholder = () => (
    <div className="w-full h-full bg-muted/30 flex items-center justify-center">
      <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
    </div>
  );

  const TextContent = () => (
    <div className={cn(
      'flex flex-col justify-center',
      isMobile ? 'py-6' : 'py-8'
    )}>
      <h2 className="text-2xl md:text-3xl font-bold mb-4">{title}</h2>
      {text && (
        <p className="text-muted-foreground mb-6 leading-relaxed">{text}</p>
      )}
      {ctaEnabled && ctaText && (
        <div>
          <Link
            to={ctaUrl}
            className="inline-flex items-center justify-center px-6 py-3 rounded-md font-medium transition-colors"
            style={{
              backgroundColor: ctaBgColor || 'hsl(var(--primary))',
              color: ctaTextColor || 'hsl(var(--primary-foreground))',
            }}
          >
            {ctaText}
          </Link>
        </div>
      )}
    </div>
  );

  const ImagesContent = () => (
    <div className={cn(
      'grid gap-4',
      isMobile ? 'grid-cols-2' : 'grid-cols-2'
    )}>
      <div className="aspect-[3/4] rounded-lg overflow-hidden">
        {image1 ? (
          <img src={image1} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
      </div>
      <div className="aspect-[3/4] rounded-lg overflow-hidden">
        {image2 ? (
          <img src={image2} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImagePlaceholder />
        )}
      </div>
    </div>
  );

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className={cn(
          'grid gap-8 items-center',
          isMobile ? 'grid-cols-1' : 'grid-cols-2'
        )}>
          {layout === 'text-left' ? (
            <>
              <TextContent />
              <ImagesContent />
            </>
          ) : (
            <>
              <ImagesContent />
              <TextContent />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
