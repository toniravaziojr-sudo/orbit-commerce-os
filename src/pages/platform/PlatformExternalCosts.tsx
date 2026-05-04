import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertTriangle, RefreshCcw, ExternalLink, Pencil, Info } from "lucide-react";
import { toast } from "sonner";
import {
  usePlatformExternalCosts,
  useSyncExternalCosts,
  useUpdateExternalCost,
  daysUntil,
  isCostAlerting,
  type PlatformExternalCost,
} from "@/hooks/usePlatformExternalCosts";
import { formatDateBR, formatDateTimeBR } from "@/lib/date-format";

function formatMoney(c: PlatformExternalCost): string {
  if (c.monthly_cost_brl != null) return `R$ ${c.monthly_cost_brl.toFixed(2)}`;
  if (c.monthly_cost_usd != null) return `US$ ${c.monthly_cost_usd.toFixed(2)}`;
  return "—";
}

function formatBalance(c: PlatformExternalCost): string {
  if (c.current_balance == null) return "—";
  return `${c.current_balance.toLocaleString("pt-BR")} ${c.balance_unit ?? ""}`.trim();
}

function ServiceRow({
  cost,
  columns,
  onEdit,
}: {
  cost: PlatformExternalCost;
  columns: ("monthly" | "renewal" | "balance" | "lastSync")[];
  onEdit: (c: PlatformExternalCost) => void;
}) {
  const alert = isCostAlerting(cost);
  const days = daysUntil(cost.renewal_date);
  return (
    <tr className={alert === "critical" ? "bg-destructive/5" : alert === "warning" ? "bg-amber-500/5" : ""}>
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="font-medium">{cost.display_name}</span>
          {!cost.is_active && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
          {cost.vendor_url && (
            <a href={cost.vendor_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {cost.description && <div className="text-xs text-muted-foreground mt-0.5">{cost.description}</div>}
      </td>
      {columns.includes("monthly") && <td className="py-3 px-4 text-sm">{formatMoney(cost)}</td>}
      {columns.includes("renewal") && (
        <td className="py-3 px-4 text-sm">
          {cost.renewal_date ? (
            <span className={alert === "critical" ? "text-destructive font-medium" : alert === "warning" ? "text-amber-600 font-medium" : ""}>
              {formatDateBR(cost.renewal_date)}
              {days != null && <span className="text-xs text-muted-foreground ml-1">({days}d)</span>}
            </span>
          ) : "—"}
        </td>
      )}
      {columns.includes("balance") && <td className="py-3 px-4 text-sm">{formatBalance(cost)}</td>}
      {columns.includes("lastSync") && (
        <td className="py-3 px-4 text-xs text-muted-foreground">
          {cost.last_sync_at ? (
            <>
              {formatDateTimeBR(cost.last_sync_at)}
              {cost.last_sync_status === "error" && <div className="text-destructive">{cost.last_sync_error}</div>}
            </>
          ) : "—"}
        </td>
      )}
      <td className="py-3 px-4 text-right">
        <Button variant="ghost" size="sm" onClick={() => onEdit(cost)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function Section({
  title,
  description,
  costs,
  columns,
  headers,
  action,
  onEdit,
}: {
  title: string;
  description: string;
  costs: PlatformExternalCost[];
  columns: ("monthly" | "renewal" | "balance" | "lastSync")[];
  headers: string[];
  action?: React.ReactNode;
  onEdit: (c: PlatformExternalCost) => void;
}) {
  if (costs.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full">
          <thead className="border-t border-b bg-muted/40">
            <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 px-4 font-medium">Serviço</th>
              {headers.map((h) => <th key={h} className="py-2 px-4 font-medium">{h}</th>)}
              <th className="py-2 px-4" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {costs.map((c) => <ServiceRow key={c.id} cost={c} columns={columns} onEdit={onEdit} />)}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function EditCostDialog({ cost, onClose }: { cost: PlatformExternalCost | null; onClose: () => void }) {
  const update = useUpdateExternalCost();
  const [form, setForm] = useState<Partial<PlatformExternalCost>>({});
  if (!cost) return null;
  const v = { ...cost, ...form };

  const submit = async () => {
    try {
      await update.mutateAsync({
        id: cost.id,
        patch: {
          monthly_cost_brl: v.monthly_cost_brl ?? null,
          monthly_cost_usd: v.monthly_cost_usd ?? null,
          current_balance: v.current_balance ?? null,
          balance_unit: v.balance_unit || null,
          renewal_date: v.renewal_date || null,
          is_active: v.is_active,
          notes: v.notes || null,
        },
      });
      toast.success("Custo atualizado");
      onClose();
    } catch (e) {
      toast.error("Erro ao salvar", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Dialog open={!!cost} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{cost.display_name}</DialogTitle>
          <DialogDescription>Atualize valores, vencimento e observações.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Custo mensal (R$)</Label>
            <Input type="number" step="0.01" value={v.monthly_cost_brl ?? ""} onChange={(e) => setForm({ ...form, monthly_cost_brl: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label>Custo mensal (US$)</Label>
            <Input type="number" step="0.01" value={v.monthly_cost_usd ?? ""} onChange={(e) => setForm({ ...form, monthly_cost_usd: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          {cost.billing_model === "prepaid" && (
            <>
              <div className="space-y-1">
                <Label>Saldo atual</Label>
                <Input type="number" step="0.01" value={v.current_balance ?? ""} onChange={(e) => setForm({ ...form, current_balance: e.target.value === "" ? null : Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Input placeholder="USD, créditos..." value={v.balance_unit ?? ""} onChange={(e) => setForm({ ...form, balance_unit: e.target.value })} />
              </div>
            </>
          )}
          {cost.billing_model === "subscription" && (
            <div className="space-y-1 col-span-2">
              <Label>Renovação / Vencimento</Label>
              <Input type="date" value={v.renewal_date ?? ""} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} />
            </div>
          )}
          <div className="flex items-center gap-2 col-span-2">
            <Switch checked={v.is_active} onCheckedChange={(c) => setForm({ ...form, is_active: c })} />
            <Label>Ativo</Label>
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Observações</Label>
            <Textarea rows={2} value={v.notes ?? ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={update.isPending}>{update.isPending ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function PlatformExternalCosts() {
  const { data, isLoading, error } = usePlatformExternalCosts();
  const sync = useSyncExternalCosts();
  const [editing, setEditing] = useState<PlatformExternalCost | null>(null);

  const list = (data ?? []).filter((c) => c.is_active);
  const subscription = list.filter((c) => c.billing_model === "subscription");
  const prepaid = list.filter((c) => c.billing_model === "prepaid");
  const payg = list.filter((c) => c.billing_model === "payg");
  const hasAutoSync = list.some((c) => c.sync_mode === "auto");
  const autoSyncNames = list.filter((c) => c.sync_mode === "auto").map((c) => c.display_name).join(", ");

  const alerts = list.map((c) => ({ cost: c, level: isCostAlerting(c) })).filter((a) => a.level);
  const total = list.reduce((sum, c) => sum + (c.monthly_cost_brl ?? (c.monthly_cost_usd ?? 0) * 5.5), 0);

  const handleSync = async () => {
    try {
      const res = await sync.mutateAsync();
      const ok = (res?.results ?? []).filter((r: { status: string }) => r.status === "ok").length;
      toast.success(`Sincronização concluída — ${ok} serviço(s) atualizado(s)`);
    } catch (e) {
      toast.error("Erro na sync", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  const syncButton = hasAutoSync ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button onClick={handleSync} disabled={sync.isPending} size="sm" variant="outline">
            <RefreshCcw className={`h-3.5 w-3.5 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
            Sincronizar saldos
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Consulta apenas serviços com API pública de saldo: <strong>{autoSyncNames}</strong>. Roda automaticamente a cada 6h. Os demais devem ser atualizados manualmente.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Custos Externos</h1>
        <p className="text-muted-foreground">Serviços de terceiros pagos pela plataforma, agrupados por modelo de cobrança.</p>
      </div>

      {alerts.length > 0 && (
        <Alert variant={alerts.some((a) => a.level === "critical") ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{alerts.length} serviço(s) próximos do vencimento</AlertTitle>
          <AlertDescription>
            {alerts.map((a) => (
              <div key={a.cost.id}>
                <strong>{a.cost.display_name}</strong> — vence {a.cost.renewal_date ? formatDateBR(a.cost.renewal_date) : "—"} ({daysUntil(a.cost.renewal_date)}d)
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-normal flex items-center gap-1">
            Custo mensal estimado
            <Info className="h-3 w-3" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">R$ {total.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground mt-1">Soma das assinaturas mensais (USD convertido a R$ 5,50). Não inclui pré-pagos nem pay-as-you-go.</div>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar custos</AlertTitle>
          <AlertDescription>{error instanceof Error ? error.message : String(error)}</AlertDescription>
        </Alert>
      )}

      <Section
        title="Assinatura mensal"
        description="Serviços com mensalidade fixa e data de renovação."
        costs={subscription}
        columns={["monthly", "renewal"]}
        headers={["Custo mensal", "Renovação"]}
        onEdit={setEditing}
      />

      <Section
        title="Saldo pré-pago"
        description="Serviços com créditos comprados antecipadamente. Recarregue antes que zere."
        costs={prepaid}
        columns={["balance", "monthly", "lastSync"]}
        headers={["Saldo", "Gasto no mês", "Última sync"]}
        action={syncButton}
        onEdit={setEditing}
      />

      <Section
        title="Pay-as-you-go (cobrado por uso)"
        description="Sem assinatura nem saldo. A fatura chega no fim do mês conforme o consumo."
        costs={payg}
        columns={["monthly"]}
        headers={["Gasto no mês"]}
        onEdit={setEditing}
      />

      <EditCostDialog cost={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
