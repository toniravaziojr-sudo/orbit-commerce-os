import { useState } from "react";
import { PlatformAdminGate } from "@/components/auth/PlatformAdminGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, RefreshCcw, ExternalLink, Pencil, CalendarClock, Wallet } from "lucide-react";
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

const CATEGORY_LABEL: Record<PlatformExternalCost["category"], string> = {
  email: "E-mail",
  infra: "Infraestrutura",
  ai: "IA",
  fiscal: "Fiscal",
  cloud: "Cloud",
  payments: "Pagamentos",
  other: "Outros",
};

function CostCard({ cost, onEdit }: { cost: PlatformExternalCost; onEdit: (c: PlatformExternalCost) => void }) {
  const alert = isCostAlerting(cost);
  const days = daysUntil(cost.renewal_date);

  return (
    <Card className={alert === "critical" ? "border-destructive" : alert === "warning" ? "border-amber-500" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {cost.display_name}
              {!cost.is_active && <Badge variant="outline">inativo</Badge>}
              <Badge variant="secondary" className="text-[10px]">{CATEGORY_LABEL[cost.category]}</Badge>
            </CardTitle>
            {cost.description && <CardDescription className="mt-1">{cost.description}</CardDescription>}
          </div>
          <div className="flex gap-1">
            {cost.vendor_url && (
              <Button variant="ghost" size="icon" asChild>
                <a href={cost.vendor_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onEdit(cost)}><Pencil className="h-4 w-4" /></Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Custo mensal</div>
            <div className="font-medium">
              {cost.monthly_cost_brl != null ? `R$ ${cost.monthly_cost_brl.toFixed(2)}` : cost.monthly_cost_usd != null ? `US$ ${cost.monthly_cost_usd.toFixed(2)}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><CalendarClock className="h-3 w-3" />Renovação</div>
            <div className="font-medium">
              {cost.renewal_date ? `${formatDateBR(cost.renewal_date)}${days != null ? ` (${days}d)` : ""}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Saldo</div>
            <div className="font-medium">
              {cost.current_balance != null ? `${cost.current_balance.toLocaleString("pt-BR")} ${cost.balance_unit ?? ""}` : "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Sync</div>
            <Badge variant={cost.sync_mode === "auto" ? "default" : "outline"}>{cost.sync_mode}</Badge>
          </div>
        </div>
        {cost.last_sync_at && (
          <div className="text-xs text-muted-foreground">
            Última sync: {formatDateTimeBR(cost.last_sync_at)} — {cost.last_sync_status}
            {cost.last_sync_error && <div className="text-destructive">{cost.last_sync_error}</div>}
          </div>
        )}
        {cost.notes && <div className="text-xs italic text-muted-foreground border-l-2 pl-2">{cost.notes}</div>}
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
          sync_mode: v.sync_mode,
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
          <DialogDescription>Atualize saldo, vencimento e observações.</DialogDescription>
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
          <div className="space-y-1">
            <Label>Saldo atual</Label>
            <Input type="number" step="0.01" value={v.current_balance ?? ""} onChange={(e) => setForm({ ...form, current_balance: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label>Unidade</Label>
            <Input placeholder="USD, créditos, emails..." value={v.balance_unit ?? ""} onChange={(e) => setForm({ ...form, balance_unit: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Renovação / Vencimento</Label>
            <Input type="date" value={v.renewal_date ?? ""} onChange={(e) => setForm({ ...form, renewal_date: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Switch checked={v.sync_mode === "auto"} onCheckedChange={(c) => setForm({ ...form, sync_mode: c ? "auto" : "manual" })} />
            <Label>Sync automática (quando houver adapter)</Label>
          </div>
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

function PlatformExternalCostsContent() {
  const { data, isLoading } = usePlatformExternalCosts();
  const sync = useSyncExternalCosts();
  const [editing, setEditing] = useState<PlatformExternalCost | null>(null);

  const alerts = (data ?? []).filter((c) => c.is_active).map((c) => ({ cost: c, level: isCostAlerting(c) })).filter((a) => a.level);
  const total = (data ?? []).filter((c) => c.is_active).reduce((sum, c) => sum + (c.monthly_cost_brl ?? (c.monthly_cost_usd ?? 0) * 5.5), 0);

  const handleSync = async () => {
    try {
      await sync.mutateAsync();
      toast.success("Sincronização concluída");
    } catch (e) {
      toast.error("Erro na sync", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Custos Externos</h1>
          <p className="text-muted-foreground">Serviços de terceiros pagos pela plataforma. Atualizado a cada 6h via cron.</p>
        </div>
        <Button onClick={handleSync} disabled={sync.isPending}>
          <RefreshCcw className={`h-4 w-4 mr-2 ${sync.isPending ? "animate-spin" : ""}`} />
          Sincronizar agora
        </Button>
      </div>

      {alerts.length > 0 && (
        <Alert variant={alerts.some((a) => a.level === "critical") ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Atenção: {alerts.length} serviço(s) próximos do vencimento</AlertTitle>
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
        <CardHeader>
          <CardTitle className="text-base">Custo mensal estimado</CardTitle>
          <CardDescription>Soma dos serviços ativos (USD convertido a R$ 5,50)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">R$ {total.toFixed(2)}</div>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground">Carregando…</div>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((c) => <CostCard key={c.id} cost={c} onEdit={setEditing} />)}
      </div>

      <EditCostDialog cost={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

export default function PlatformExternalCosts() {
  return (
    <PlatformAdminGate>
      <PlatformExternalCostsContent />
    </PlatformAdminGate>
  );
}
