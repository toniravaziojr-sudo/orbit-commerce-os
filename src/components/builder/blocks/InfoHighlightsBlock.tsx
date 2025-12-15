// =============================================
// INFO HIGHLIGHTS BLOCK - Icons with text (Frete, Pagamento, Segurança, etc.)
// =============================================

import { useState } from 'react';
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
  LucideIcon
} from 'lucide-react';

interface HighlightItem {
  id: string;
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
  truck: Truck,
  credit_card: CreditCard,
  shield: Shield,
  clock: Clock,
  phone: Phone,
  gift: Gift,
  award: Award,
  thumbs_up: ThumbsUp,
};

const defaultItems: HighlightItem[] = [
  { id: '1', icon: 'truck', title: 'Envio rápido e garantido', description: 'para todo Brasil' },
  { id: '2', icon: 'credit_card', title: 'Parcele suas compras', description: 'com cartão de crédito' },
  { id: '3', icon: 'shield', title: 'Loja confiável', description: 'com tecnologia 100% segura' },
];

export function InfoHighlightsBlock({
  items = defaultItems,
  iconColor = '#6366f1',
  textColor = '#1f2937',
  layout = 'horizontal',
  context,
}: InfoHighlightsBlockProps) {
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && useIsMobile());
  const effectiveLayout = isMobile ? 'vertical' : layout;

  if (items.length === 0) {
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
          {items.map((item) => {
            const IconComponent = iconMap[item.icon] || Shield;
            
            return (
              <div 
                key={item.id}
                className={cn(
                  'flex items-center gap-3',
                  effectiveLayout === 'horizontal' ? 'flex-1 min-w-[200px] justify-center' : 'w-full'
                )}
              >
                <div 
                  className="flex-shrink-0 p-2 rounded-full bg-background"
                  style={{ color: iconColor }}
                >
                  <IconComponent className="h-5 w-5" />
                </div>
                <div>
                  <p 
                    className="font-medium text-sm"
                    style={{ color: textColor }}
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
      </div>
    </section>
  );
}
