// =============================================
// INFO HIGHLIGHTS BLOCK - Icons with text (Frete, Pagamento, Segurança, etc.)
// =============================================

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { BlockRenderContext } from '@/lib/builder/types';
import { 
  Truck, 
  CreditCard, 
  Shield, 
  Clock, 
  Phone, 
  Gift,
  Award,
  ThumbsUp,
  Star,
  Heart,
  Package,
  Zap,
  CheckCircle,
  ShoppingBag,
  Percent,
  MapPin,
  Mail,
  HelpCircle,
  Info,
  AlertCircle,
  LucideIcon
} from 'lucide-react';

interface HighlightItem {
  id?: string;
  icon: string;
  title: string;
  description?: string;
}

interface InfoHighlightsBlockProps {
  items?: HighlightItem[];
  iconColor?: string;
  textColor?: string;
  layout?: 'horizontal' | 'vertical';
  context?: BlockRenderContext;
}

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  Truck: Truck,
  truck: Truck,
  CreditCard: CreditCard,
  credit_card: CreditCard,
  Shield: Shield,
  shield: Shield,
  Clock: Clock,
  clock: Clock,
  Phone: Phone,
  phone: Phone,
  Gift: Gift,
  gift: Gift,
  Award: Award,
  award: Award,
  ThumbsUp: ThumbsUp,
  thumbs_up: ThumbsUp,
  Star: Star,
  star: Star,
  Heart: Heart,
  heart: Heart,
  Package: Package,
  package: Package,
  Zap: Zap,
  zap: Zap,
  CheckCircle: CheckCircle,
  check_circle: CheckCircle,
  ShoppingBag: ShoppingBag,
  shopping_bag: ShoppingBag,
  Percent: Percent,
  percent: Percent,
  MapPin: MapPin,
  map_pin: MapPin,
  Mail: Mail,
  mail: Mail,
  HelpCircle: HelpCircle,
  help_circle: HelpCircle,
  Info: Info,
  info: Info,
  AlertCircle: AlertCircle,
  alert_circle: AlertCircle,
};

export function InfoHighlightsBlock({
  items = [],
  iconColor = '#6366f1',
  textColor = '#1f2937',
  layout = 'horizontal',
  context,
  isEditing = false,
}: InfoHighlightsBlockProps & { isEditing?: boolean }) {
  // Hook must be called unconditionally (Rules of Hooks)
  const deviceIsMobile = useIsMobile();
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && deviceIsMobile);
  const effectiveLayout = isMobile ? 'vertical' : layout;

  // Default demo highlights for builder preview
  const demoHighlights: HighlightItem[] = [
    { id: 'demo-1', icon: 'Truck', title: 'Frete Grátis', description: 'Para todo o Brasil' },
    { id: 'demo-2', icon: 'CreditCard', title: 'Parcelamos em 12x', description: 'Sem juros no cartão' },
    { id: 'demo-3', icon: 'Shield', title: 'Compra Segura', description: 'Site 100% protegido' },
    { id: 'demo-4', icon: 'Package', title: 'Troca Grátis', description: 'Em até 30 dias' },
  ];

  // Use demo highlights when editing and no items configured
  const displayItems = items && items.length > 0 ? items : (isEditing ? demoHighlights : []);
  
  if (displayItems.length === 0) {
    return null;
  }

  return (
    <section className="py-6 border-y bg-muted/20">
      <div className="max-w-7xl mx-auto px-4">
        <div className={cn(
          'flex gap-6',
          effectiveLayout === 'horizontal' 
            ? 'flex-row justify-center items-center flex-wrap' 
            : 'flex-col items-start'
        )}>
          {displayItems.map((item, index) => {
            const IconComponent = iconMap[item.icon] || Shield;
            
            return (
              <div 
                key={item.id || index}
                className={cn(
                  'flex items-center gap-3',
                  effectiveLayout === 'horizontal' ? 'flex-1 min-w-[200px] justify-center' : 'w-full'
                )}
              >
                <div 
                  className="flex-shrink-0 p-2 rounded-full bg-background"
                  style={{ color: iconColor || undefined }}
                >
                  <IconComponent className="h-5 w-5" />
                </div>
                <div>
                  <p 
                    className="font-medium text-sm"
                    style={{ color: textColor || undefined }}
                  >
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {isEditing && (!items || items.length === 0) && (
          <p className="text-xs text-center text-muted-foreground mt-3">
            [Exemplo demonstrativo] Configure benefícios reais no painel lateral
          </p>
        )}
      </div>
    </section>
  );
}
