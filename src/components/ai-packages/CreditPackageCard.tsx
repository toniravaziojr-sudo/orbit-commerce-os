/**
 * Credit Package Card
 * Displays a purchasable credit package
 */

import { Sparkles, Gift, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditPackage, formatCredits, formatPrice } from "@/hooks/useCredits";

interface CreditPackageCardProps {
  package: CreditPackage;
  isPopular?: boolean;
  onPurchase: (pkg: CreditPackage) => void;
  isPurchasing?: boolean;
}

export function CreditPackageCard({ 
  package: pkg, 
  isPopular, 
  onPurchase,
  isPurchasing 
}: CreditPackageCardProps) {
  const totalCredits = pkg.credits + pkg.bonus_credits;
  const pricePerCredit = pkg.price_cents / pkg.credits;

  return (
    <Card className={isPopular ? 'border-primary ring-1 ring-primary' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{pkg.name}</CardTitle>
          {isPopular && (
            <Badge className="bg-primary">Mais popular</Badge>
          )}
        </div>
        {pkg.description && (
          <CardDescription>{pkg.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Credits Display */}
        <div className="text-center py-4">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="text-3xl font-bold">{formatCredits(pkg.credits)}</span>
          </div>
          {pkg.bonus_credits > 0 && (
            <div className="flex items-center justify-center gap-1 mt-2 text-primary">
              <Gift className="h-4 w-4" />
              <span className="text-sm font-medium">
                +{formatCredits(pkg.bonus_credits)} bônus
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Total: {formatCredits(totalCredits)} créditos
          </p>
        </div>

        {/* Price */}
        <div className="text-center">
          <p className="text-2xl font-bold">
            {formatPrice(pkg.price_cents)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatPrice(pricePerCredit)}/crédito
          </p>
        </div>

        {/* Purchase Button */}
        <Button 
          className="w-full" 
          onClick={() => onPurchase(pkg)}
          disabled={isPurchasing}
          variant={isPopular ? 'default' : 'outline'}
        >
          <CreditCard className="h-4 w-4 mr-2" />
          {isPurchasing ? 'Processando...' : 'Comprar'}
        </Button>
      </CardContent>
    </Card>
  );
}
