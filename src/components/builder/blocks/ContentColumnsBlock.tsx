// =============================================
// CONTENT COLUMNS BLOCK - Image + Text side by side
// =============================================

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { BlockRenderContext } from '@/lib/builder/types';
import { 
  Check,
  CheckCircle,
  Shield,
  Zap,
  Star,
  Heart,
  Award,
  Truck,
  Clock,
  Gift,
  Percent,
  LucideIcon
} from 'lucide-react';

interface FeatureItem {
  id?: string;
  icon: string;
  text: string;
}

interface ContentColumnsBlockProps {
  title?: string;
  subtitle?: string;
  content?: string;
  imageDesktop?: string;
  imageMobile?: string;
  imagePosition?: 'left' | 'right';
  features?: FeatureItem[];
  iconColor?: string;
  showButton?: boolean;
  buttonText?: string;
  buttonUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  context?: BlockRenderContext;
}

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  Check: Check,
  check: Check,
  CheckCircle: CheckCircle,
  check_circle: CheckCircle,
  Shield: Shield,
  shield: Shield,
  Zap: Zap,
  zap: Zap,
  Star: Star,
  star: Star,
  Heart: Heart,
  heart: Heart,
  Award: Award,
  award: Award,
  Truck: Truck,
  truck: Truck,
  Clock: Clock,
  clock: Clock,
  Gift: Gift,
  gift: Gift,
  Percent: Percent,
  percent: Percent,
};

export function ContentColumnsBlock({
  title = 'Título da Seção',
  subtitle,
  content,
  imageDesktop,
  imageMobile,
  imagePosition = 'left',
  features = [],
  iconColor = '#22c55e',
  showButton = false,
  buttonText = 'Saiba mais',
  buttonUrl = '#',
  backgroundColor = 'transparent',
  textColor,
  context,
}: ContentColumnsBlockProps) {
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && useIsMobile());
  
  // Use mobile image if available, else fall back to desktop
  const displayImage = isMobile && imageMobile ? imageMobile : imageDesktop;
  
  const imageColumn = displayImage && (
    <div className="flex-1 min-w-0">
      <img
        src={displayImage}
        alt={title || 'Imagem'}
        className="w-full h-auto rounded-lg shadow-lg object-cover"
      />
    </div>
  );
  
  const contentColumn = (
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      {/* Title */}
      {title && (
        <h2 
          className="text-2xl md:text-3xl font-bold mb-3"
          style={{ color: textColor || undefined }}
        >
          {title}
        </h2>
      )}
      
      {/* Subtitle */}
      {subtitle && (
        <p 
          className="text-lg text-muted-foreground mb-4"
        >
          {subtitle}
        </p>
      )}
      
      {/* Content text */}
      {content && (
        <div 
          className="prose prose-sm max-w-none mb-4"
          style={{ color: textColor || undefined }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      )}
      
      {/* Features list */}
      {features.length > 0 && (
        <ul className="space-y-2 mb-4">
          {features.map((feature, index) => {
            const IconComponent = iconMap[feature.icon] || Check;
            
            return (
              <li 
                key={feature.id || index}
                className="flex items-start gap-2"
              >
                <span 
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: iconColor }}
                >
                  <IconComponent className="h-5 w-5" />
                </span>
                <span 
                  className="text-sm"
                  style={{ color: textColor || undefined }}
                >
                  {feature.text}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      
      {/* CTA Button */}
      {showButton && buttonText && (
        <div>
          <a
            href={buttonUrl}
            className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            {buttonText}
          </a>
        </div>
      )}
    </div>
  );

  return (
    <section 
      className="py-12 px-4"
      style={{ backgroundColor: backgroundColor || 'transparent' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className={cn(
          'flex gap-8 md:gap-12',
          isMobile ? 'flex-col' : 'flex-row items-center',
          !isMobile && imagePosition === 'right' && 'flex-row-reverse'
        )}>
          {imageColumn}
          {contentColumn}
        </div>
      </div>
    </section>
  );
}
