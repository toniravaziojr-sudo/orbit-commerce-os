import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CreditCard,
  FileText,
  TrendingUp,
  Package,
  Coins,
  Clock,
  ArrowDownCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

import { useCreditWallet, formatCredits } from "@/hooks/useCredits";
import {
  useCreditHistory,
  type CreditTransactionType,
  type CreditOperationStatus,
} from "@/hooks/useCreditHistory";
import { CreditHistoryTable } from "@/components/ai-packages/CreditHistoryTable";

type PeriodKey = "7d" | "30d" | "90d" | "all";

const PERIOD_DAYS: Record<PeriodKey, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

const PAGE_SIZE = 25;

function startDateForPeriod(period: PeriodKey): string | null {
  const days = PERIOD_DAYS[period];
  if (!days) return null;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export default function Billing() {
  const navigate = useNavigate();
  const { currentTenant } = useAuth();

  const tenantPlan = "free";
  const currentPlan = {
    name: tenantPlan,
    label: "Gratuito",
    price: "R$ 0/mês",
  };

  // Wallet (saldo)
  const { data: wallet, isLoading: walletLoading } = useCreditWallet();
  const balance = wallet?.balance_credits ?? 0;
  const reserved = wallet?.reserved_credits ?? 0;
  const available = balance - reserved;
  const lifetimeConsumed = wallet?.lifetime_consumed ?? 0;

  // Filtros do extrato
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [transactionType, setTransactionType] = useState<"all" | CreditTransactionType>("all");
  const [offset, setOffset] = useState(0);

  const startDate = useMemo(() => startDateForPeriod(period), [period]);

  const {
    data: historyItems,
    totalCount,
    isLoading: historyLoading,
    isError: historyError,
  } = useCreditHistory({
    startDate,
    transactionType: transactionType === "all" ? null : transactionType,
    limit: PAGE_SIZE,
    offset,
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title="Planos e Faturamento"
          description="Gerencie seu plano, créditos de IA e formas de pagamento"
        />
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Plano Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{currentPlan.label}</h3>
                  <Badge variant="secondary">{currentPlan.price}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Seu plano renova automaticamente
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate("/settings/billing")}>
                Alterar Plano
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Extrato de Créditos (substitui o antigo "Uso de Créditos de IA",
          que ficava desalinhado em relação ao saldo real do tenant) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Extrato de Créditos
          </CardTitle>
          <CardDescription>
            Histórico de movimentos de créditos de IA do seu tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Saldo cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="h-4 w-4 text-primary" />
                Disponível
              </div>
              <p className="mt-2 text-2xl font-bold">
                {walletLoading ? "—" : formatCredits(available)}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Reservado
              </div>
              <p className="mt-2 text-2xl font-bold">
                {walletLoading ? "—" : formatCredits(reserved)}
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ArrowDownCircle className="h-4 w-4 text-destructive" />
                Consumido total
              </div>
              <p className="mt-2 text-2xl font-bold">
                {walletLoading ? "—" : formatCredits(lifetimeConsumed)}
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Período:</span>
              <Select
                value={period}
                onValueChange={(v) => {
                  setPeriod(v as PeriodKey);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="all">Todo o período</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tipo:</span>
              <Select
                value={transactionType}
                onValueChange={(v) => {
                  setTransactionType(v as "all" | CreditTransactionType);
                  setOffset(0);
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="capture">Captura</SelectItem>
                  <SelectItem value="reserve">Reserva</SelectItem>
                  <SelectItem value="release">Liberação</SelectItem>
                  <SelectItem value="refund">Estorno</SelectItem>
                  <SelectItem value="purchase">Compra</SelectItem>
                  <SelectItem value="bonus">Bônus</SelectItem>
                  <SelectItem value="adjust">Ajuste</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Tabela */}
          {!currentTenant ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Selecione uma loja para ver o extrato.
            </div>
          ) : (
            <CreditHistoryTable
              items={historyItems}
              isLoading={historyLoading}
              isError={historyError}
              totalCount={totalCount}
              limit={PAGE_SIZE}
              offset={offset}
              onPageChange={setOffset}
              showAdminColumns={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Formas de Pagamento
          </CardTitle>
          <CardDescription>
            Gerencie suas formas de pagamento para cobrança
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma forma de pagamento</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Adicione um cartão de crédito ou configure outra forma de pagamento.
            </p>
            <Button>
              <CreditCard className="h-4 w-4 mr-2" />
              Adicionar Cartão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Billing History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Faturamento
          </CardTitle>
          <CardDescription>Visualize suas faturas anteriores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma fatura</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Seu histórico de faturas aparecerá aqui.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
