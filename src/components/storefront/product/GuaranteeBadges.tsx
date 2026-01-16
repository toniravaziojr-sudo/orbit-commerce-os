// =============================================
// GUARANTEE BADGES - Bandeirinhas editáveis de garantia
// =============================================

import React from 'react';
import { Shield, RotateCcw, Lock, Truck, Award, ThumbsUp } from 'lucide-react';

interface GuaranteeBadge {
  icon: 'shield' | 'return' | 'lock' | 'truck' | 'award' | 'thumbsup';
  title: string;
  description?: string;
}

interface GuaranteeBadgesProps {
  badges?: GuaranteeBadge[];
  className?: string;
}

const iconMap = {
  shield: Shield,
  return: RotateCcw,
  lock: Lock,
  truck: Truck,
  award: Award,
  thumbsup: ThumbsUp,
};

const defaultBadges: GuaranteeBadge[] = [
  { icon: 'shield', title: 'Garantia de 30 dias', description: 'Sua compra garantida' },
  { icon: 'return', title: 'Troca Grátis', description: '7 dias para trocar' },
  { icon: 'lock', title: 'Pagamento Seguro', description: 'Site 100% seguro' },
];

/**
 * Renders guarantee/trust badges below the CTAs
 * Conforme REGRAS.md: "bandeirinhas editáveis para colocar informações de garantia"
 */
export function GuaranteeBadges({
  badges = defaultBadges,
  className = '',
}: GuaranteeBadgesProps) {
  if (!badges || badges.length === 0) return null;

  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`}>
      {badges.map((badge, index) => {
        const IconComponent = iconMap[badge.icon] || Shield;
        
        return (
          <div 
            key={index}
            className="flex flex-col items-center text-center p-3 bg-muted/50 rounded-lg"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <IconComponent className="w-5 h-5 text-primary" />
            </div>
            <p className="text-xs font-medium leading-tight">{badge.title}</p>
            {badge.description && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{badge.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
