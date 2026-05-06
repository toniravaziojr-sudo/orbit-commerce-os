/**
 * CreditAggregateCards — Etapa 1D Fase A3.2
 *
 * Cards de resumo. IMPORTANTE: agregam apenas os registros exibidos na
 * página atual (limitação assumida nesta etapa). Label obrigatório.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, DollarSign, TrendingUp, Percent, Info } from "lucide-react";
import type { CreditHistoryItem } from "@/hooks/useCreditHistory";

interface CreditAggregateCardsProps {
  items: CreditHistoryItem[];
}

function fmtBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(n);
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function CreditAggregateCards({ items }: CreditAggregateCardsProps) {
  // Considera apenas movimentos de captura (cobrança real).
  const captures = items.filter((i) => i.transaction_type === "capture");

  const creditsConsumed = captures.reduce(
    (sum, i) => sum + Math.abs(Number(i.credits_delta || 0)),
    0
  );
  const costBrl = captures.reduce(
    (sum, i) => sum + Number(i.cost_brl ?? 0),
    0
  );
  const sellBrl = captures.reduce(
    (sum, i) => sum + Number(i.sell_brl ?? 0),
    0
  );
  const marginBrl = sellBrl - costBrl;
  const marginPct = sellBrl > 0 ? (marginBrl / sellBrl) * 100 : 0;

  const hasFinancialFields = captures.some(
    (i) => i.cost_brl != null || i.sell_brl != null
  );

  return (
    <div className="space-y-2">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Créditos consumidos
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{creditsConsumed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Custo
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasFinancialFields ? fmtBRL(costBrl) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Receita
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasFinancialFields ? fmtBRL(sellBrl) : "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Margem
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasFinancialFields ? fmtBRL(marginBrl) : "—"}
            </div>
            {hasFinancialFields && (
              <div className="text-xs text-muted-foreground mt-1">
                {fmtPct(marginPct)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Info className="h-3.5 w-3.5" />
        Resumo dos registros exibidos — não representa o total do período.
      </p>
    </div>
  );
}
