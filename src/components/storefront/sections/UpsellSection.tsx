// =============================================
// UPSELL SECTION - Post-purchase upsell offers
// Appears ONLY on Thank You page
// Source of truth: Aumentar Ticket (/offers) module
// =============================================

import { Gift, ShoppingCart, ArrowRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { demoProducts } from '@/lib/builder/demoData';

interface UpsellSectionProps {
  tenantId?: string;
  orderId?: string;
  isEditing?: boolean;
}

/**
 * UpsellSection - Oferta pós-compra na página de Obrigado
 * 
 * REGRA: Upsell aparece SOMENTE na página de Obrigado
 * A configuração real vem do módulo Aumentar Ticket (/offers)
 * 
 * Se não houver oferta configurada, mostra placeholder no modo de edição
 * ou não renderiza nada em produção.
 */
export function UpsellSection({ isEditing }: UpsellSectionProps) {
  // Demo product for editing preview
  const demoProduct = demoProducts[5]; // Hidratante Facial
  const discountPercent = 20;
  const discountedPrice = demoProduct.price * (1 - discountPercent / 100);
  const savings = demoProduct.price - discountedPrice;

  // In editing mode, always show demo placeholder
  if (isEditing) {
    return (
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent my-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-lg">Oferta Especial para Você!</h3>
            <Badge variant="destructive" className="ml-auto">-{discountPercent}%</Badge>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Product Image */}
            <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
              <img 
                src={demoProduct.image} 
                alt={demoProduct.name}
                className="w-full h-full object-cover"
              />
            </div>

            {/* Product Info */}
            <div className="flex-1 text-center sm:text-left">
              <h4 className="font-medium text-base mb-1">{demoProduct.name}</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Aproveite esta oferta exclusiva pós-compra!
              </p>
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <span className="text-sm text-muted-foreground line-through">
                  R$ {demoProduct.price.toFixed(2)}
                </span>
                <span className="text-xl font-bold text-primary">
                  R$ {discountedPrice.toFixed(2)}
                </span>
                <Badge variant="secondary" className="text-xs">
                  Economize R$ {savings.toFixed(2)}
                </Badge>
              </div>
            </div>

            {/* CTA Button */}
            <Button className="gap-2 flex-shrink-0" size="lg">
              Aproveitar Oferta
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t">
            [Demonstrativo] Configure ofertas de upsell em <strong>Aumentar Ticket</strong>
          </p>
        </CardContent>
      </Card>
    );
  }

  // In production, show empty state with CTA to configure
  // TODO: Integrate with real upsell config from /offers when available
  return (
    <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-6 my-6">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <Gift className="h-6 w-6 text-primary" />
        </div>
        <h3 className="font-semibold">Oferta Pós-compra (Upsell)</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Configure ofertas de upsell para aumentar o valor médio do pedido após a compra.
        </p>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Configurar em Aumentar Ticket
        </Button>
      </div>
    </div>
  );
}
