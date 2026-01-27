/**
 * Credit Balance Card
 * Shows current credit balance with visual indicator
 */

import { Coins, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCreditWallet, formatCredits } from "@/hooks/useCredits";
import { Skeleton } from "@/components/ui/skeleton";

interface CreditBalanceProps {
  onBuyClick?: () => void;
}

export function CreditBalance({ onBuyClick }: CreditBalanceProps) {
  const { data: wallet, isLoading } = useCreditWallet();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-24" />
        </CardContent>
      </Card>
    );
  }

  const balance = wallet?.balance_credits ?? 0;
  const reserved = wallet?.reserved_credits ?? 0;
  const available = balance - reserved;
  const lifetimePurchased = wallet?.lifetime_purchased ?? 0;
  const lifetimeConsumed = wallet?.lifetime_consumed ?? 0;

  // Calculate usage percentage (of lifetime purchased)
  const usagePercent = lifetimePurchased > 0 
    ? Math.min(100, (lifetimeConsumed / lifetimePurchased) * 100)
    : 0;

  // Low balance warning threshold
  const isLowBalance = available < 100;

  return (
    <Card className={isLowBalance ? 'border-destructive/50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5 text-primary" />
            Saldo de Créditos
          </CardTitle>
          {reserved > 0 && (
            <Badge variant="secondary" className="text-xs">
              {formatCredits(reserved)} reservados
            </Badge>
          )}
        </div>
        <CardDescription>
          Créditos disponíveis para uso de IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Balance */}
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold">
            {formatCredits(available)}
          </span>
          <span className="text-muted-foreground">créditos</span>
          {isLowBalance && (
            <AlertCircle className="h-5 w-5 text-destructive ml-2" />
          )}
        </div>

        {/* Usage Progress */}
        {lifetimePurchased > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uso total</span>
              <span>{usagePercent.toFixed(0)}%</span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4 text-primary" />
            <div>
              <p className="text-muted-foreground text-xs">Comprados</p>
              <p className="font-medium">{formatCredits(lifetimePurchased)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-muted-foreground text-xs">Consumidos</p>
              <p className="font-medium">{formatCredits(lifetimeConsumed)}</p>
            </div>
          </div>
        </div>

        {/* Buy Button */}
        {onBuyClick && (
          <Button 
            onClick={onBuyClick} 
            className="w-full mt-2"
            variant={isLowBalance ? 'default' : 'outline'}
          >
            <Coins className="h-4 w-4 mr-2" />
            Comprar Créditos
          </Button>
        )}

        {/* Low Balance Warning */}
        {isLowBalance && (
          <p className="text-xs text-destructive">
            ⚠️ Saldo baixo. Considere comprar mais créditos para evitar interrupções.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
