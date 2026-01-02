// =============================================
// FEATURE LIST BLOCK - Vertical list with icons
// =============================================

import { cn } from '@/lib/utils';
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
  Package,
  ThumbsUp,
  Info,
  LucideIcon
} from 'lucide-react';

interface FeatureItem {
  id?: string;
  icon: string;
  text: string;
}

interface FeatureListBlockProps {
  title?: string;
  subtitle?: string;
  items?: FeatureItem[];
  iconColor?: string;
  textColor?: string;
  showButton?: boolean;
  buttonText?: string;
  buttonUrl?: string;
  backgroundColor?: string;
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
  Package: Package,
  package: Package,
  ThumbsUp: ThumbsUp,
  thumbs_up: ThumbsUp,
  Info: Info,
  info: Info,
};

const defaultItems: FeatureItem[] = [
  { id: '1', icon: 'Check', text: 'Feature principal do produto' },
  { id: '2', icon: 'Check', text: 'Outro benefício importante' },
  { id: '3', icon: 'Check', text: 'Mais uma característica' },
];

export function FeatureListBlock({
  title,
  subtitle,
  items = defaultItems,
  iconColor = '#22c55e',
  textColor,
  showButton = false,
  buttonText = 'Saiba mais',
  buttonUrl = '#',
  backgroundColor = 'transparent',
  context,
}: FeatureListBlockProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section 
      className="py-8 px-4"
      style={{ backgroundColor: backgroundColor || 'transparent' }}
    >
      <div className="max-w-3xl mx-auto">
        {/* Title */}
        {title && (
          <h2 
            className="text-2xl md:text-3xl font-bold mb-2"
            style={{ color: textColor || undefined }}
          >
            {title}
          </h2>
        )}
        
        {/* Subtitle */}
        {subtitle && (
          <p className="text-muted-foreground mb-6">
            {subtitle}
          </p>
        )}
        
        {/* Feature items - vertical list */}
        <ul className="space-y-3">
          {items.map((item, index) => {
            const IconComponent = iconMap[item.icon] || Check;
            
            return (
              <li 
                key={item.id || index}
                className="flex items-start gap-3"
              >
                <span 
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: iconColor || undefined }}
                >
                  <IconComponent className="h-5 w-5" />
                </span>
                <span 
                  className="text-base"
                  style={{ color: textColor || undefined }}
                >
                  {item.text}
                </span>
              </li>
            );
          })}
        </ul>
        
        {/* Optional CTA button */}
        {showButton && buttonText && (
          <div className="mt-6">
            <a
              href={buttonUrl}
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              {buttonText}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
