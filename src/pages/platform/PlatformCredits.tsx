/**
 * /platform/credits — Etapa 1D Fase A3.2
 *
 * Painel admin de auditoria de créditos por tenant.
 * - Tenant obrigatório (sem "Todos os tenants" nesta etapa).
 * - Consome RPC get_credit_history como platform_admin (showAdminColumns=true).
 * - Cards são "Resumo dos registros exibidos" (label obrigatório).
 * - Não altera motor / wallet / ledger / pricing. Apenas leitura.
 */

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RefreshCw, Coins, ShieldCheck } from "lucide-react";
import { PlatformAdminGate } from "@/components/auth/PlatformAdminGate";
import { PlatformAccessDenied } from "@/components/auth/PlatformAccessDenied";
import { TenantCombobox } from "@/components/platform/credits/TenantCombobox";
import { CreditAggregateCards } from "@/components/platform/credits/CreditAggregateCards";
import { CreditHistoryTable } from "@/components/ai-packages/CreditHistoryTable";
import { usePlatformCreditHistory } from "@/hooks/usePlatformCreditHistory";
import type {
  CreditTransactionType,
  CreditOperationStatus,
} from "@/hooks/useCreditHistory";

const PAGE_SIZE = 50;

type PeriodKey = "7d" | "30d" | "90d";

function periodToRange(p: PeriodKey): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  const days = p === "7d" ? 7 : p === "30d" ? 30 : 90;
  start.setDate(end.getDate() - days);
  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

function PlatformCreditsContent() {
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantLabel, setTenantLabel] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [transactionType, setTransactionType] = useState<string>("all");
  const [operationStatus, setOperationStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("");
  const [provider, setProvider] = useState<string>("");
  const [serviceKey, setServiceKey] = useState<string>("");
  const [includePlatform, setIncludePlatform] = useState<boolean>(false);
  const [offset, setOffset] = useState<number>(0);

  const range = useMemo(() => periodToRange(period), [period]);

  const { data, totalCount, isLoading, isFetching, isError, refetch } =
    usePlatformCreditHistory({
      tenantId,
      startDate: range.startDate,
      endDate: range.endDate,
      transactionType:
        transactionType === "all"
          ? null
          : (transactionType as CreditTransactionType),
      operationStatus:
        operationStatus === "all"
          ? null
          : (operationStatus as CreditOperationStatus),
      category: category.trim() || null,
      provider: provider.trim() || null,
      serviceKey: serviceKey.trim() || null,
      includePlatform,
      limit: PAGE_SIZE,
      offset,
    });

  const handleTenantChange = (id: string | null, t: { name: string } | null) => {
    setTenantId(id);
    setTenantLabel(t?.name ?? null);
    setOffset(0);
  };

  const resetPage = () => setOffset(0);

  return (
    <div className="space-y-6 animate-fade-in p-4 md:p-6">
      <PageHeader
        title="Créditos da Plataforma"
        description="Auditoria de consumo, custo e margem por tenant"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={!tenantId || isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`}
            />
            Atualizar
          </Button>
        }
      />

      {/* Top controls */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Tenant</Label>
              <TenantCombobox
                value={tenantId}
                onChange={handleTenantChange}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Período</Label>
              <Select
                value={period}
                onValueChange={(v) => {
                  setPeriod(v as PeriodKey);
                  resetPage();
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pb-2">
              <Checkbox
                id="include-platform"
                checked={includePlatform}
                onCheckedChange={(v) => {
                  setIncludePlatform(!!v);
                  resetPage();
                }}
              />
              <Label
                htmlFor="include-platform"
                className="text-xs cursor-pointer"
              >
                Incluir transações de plataforma
              </Label>
            </div>
          </div>

          {/* Advanced filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={transactionType}
                onValueChange={(v) => {
                  setTransactionType(v);
                  resetPage();
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="capture">Captura</SelectItem>
                  <SelectItem value="reserve">Reserva</SelectItem>
                  <SelectItem value="release">Liberação</SelectItem>
                  <SelectItem value="refund">Estorno</SelectItem>
                  <SelectItem value="adjust">Ajuste</SelectItem>
                  <SelectItem value="purchase">Compra</SelectItem>
                  <SelectItem value="bonus">Bônus</SelectItem>
                  <SelectItem value="consume">Consumo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={operationStatus}
                onValueChange={(v) => {
                  setOperationStatus(v);
                  resetPage();
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="reserved">Reservado</SelectItem>
                  <SelectItem value="captured">Capturado</SelectItem>
                  <SelectItem value="released">Liberado</SelectItem>
                  <SelectItem value="completed">Completo</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Input
                placeholder="ai_image, ai_video…"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  resetPage();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Input
                placeholder="fal, openai, gemini…"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  resetPage();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Service key</Label>
              <Input
                placeholder="fal.gpt-image-1.5…"
                value={serviceKey}
                onChange={(e) => {
                  setServiceKey(e.target.value);
                  resetPage();
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Empty state when no tenant selected */}
      {!tenantId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Coins className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              Selecione um tenant para visualizar o extrato de créditos.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <CreditAggregateCards items={data} />

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  <span>
                    Visão admin · {tenantLabel ?? "tenant"} ·{" "}
                    {totalCount} movimento(s)
                  </span>
                </div>
              </div>
              <CreditHistoryTable
                items={data}
                isLoading={isLoading}
                isError={isError}
                totalCount={totalCount}
                limit={PAGE_SIZE}
                offset={offset}
                onPageChange={setOffset}
                showAdminColumns
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default function PlatformCredits() {
  return (
    <PlatformAdminGate fallback={<PlatformAccessDenied />}>
      <PlatformCreditsContent />
    </PlatformAdminGate>
  );
}
