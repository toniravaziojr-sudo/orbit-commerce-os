import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, History, Plus, ShieldCheck, ShieldOff, Power, PowerOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  PricingRow,
  useCreatePricing,
  useServicePricingCatalog,
  useServicePricingHistory,
  useSetLiveApproval,
  useSetPricingActive,
  useVersionPricing,
} from "@/hooks/useServicePricingCatalog";
import { formatDateTimeBR } from "@/lib/date-format";

const CATEGORY_OPTIONS = [
  "ai_text", "ai_image", "ai_video", "ai_audio", "embedding",
  "fiscal", "email", "whatsapp", "scrape", "other",
];

function isPlaceholder(r: PricingRow) {
  return !!r.metadata?.placeholder;
}
function isApprovedForLive(r: PricingRow) {
  return !!r.metadata?.approved_for_live;
}
function sellUsd(r: PricingRow) {
  return r.cost_usd * (1 + Number(r.markup_pct) / 100);
}

function ReasonField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label>Motivo (obrigatório)</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Ex.: Atualização de tabela do provedor em 01/06/2026" />
    </div>
  );
}

function VersionDialog({ row, onClose }: { row: PricingRow | null; onClose: () => void }) {
  const mutation = useVersionPricing();
  const [costUsd, setCostUsd] = useState<string>("");
  const [markupPct, setMarkupPct] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [provider, setProvider] = useState<string>("");
  const [model, setModel] = useState<string>("");
  const [reason, setReason] = useState("");

  if (!row) return null;
  const submit = async () => {
    try {
      const payload: Record<string, any> = {};
      if (costUsd !== "") payload.cost_usd = Number(costUsd);
      if (markupPct !== "") payload.markup_pct = Number(markupPct);
      if (unit) payload.unit = unit;
      if (provider) payload.provider = provider;
      if (model) payload.model = model;
      await mutation.mutateAsync({ currentId: row.id, payload, reason });
      toast.success("Nova versão criada");
      onClose();
    } catch (e) {
      toast.error("Erro", { description: (e as Error).message });
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Versionar preço — {row.service_key}</DialogTitle>
          <DialogDescription>
            Cria uma nova vigência. A versão atual é encerrada e o histórico é preservado. Não recalcula transações antigas.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>cost_usd (atual: {row.cost_usd})</Label>
            <Input type="number" step="0.0001" value={costUsd} onChange={(e) => setCostUsd(e.target.value)} placeholder={String(row.cost_usd)} />
          </div>
          <div className="space-y-1">
            <Label>markup_pct (atual: {row.markup_pct})</Label>
            <Input type="number" step="0.01" value={markupPct} onChange={(e) => setMarkupPct(e.target.value)} placeholder={String(row.markup_pct)} />
          </div>
          <div className="space-y-1">
            <Label>unit (atual: {row.unit})</Label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={row.unit} />
          </div>
          <div className="space-y-1">
            <Label>provider (atual: {row.provider})</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={row.provider} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>model (atual: {row.model ?? "—"})</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={row.model ?? ""} />
          </div>
          <div className="col-span-2">
            <ReasonField value={reason} onChange={setReason} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending || reason.trim().length < 3}>
            {mutation.isPending ? "Salvando…" : "Criar nova versão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const mutation = useCreatePricing();
  const [form, setForm] = useState({
    service_key: "", category: "other", display_name: "", provider: "",
    model: "", unit: "", cost_usd: "", markup_pct: "50", placeholder: true,
  });
  const [reason, setReason] = useState("");
  const submit = async () => {
    try {
      await mutation.mutateAsync({
        payload: {
          service_key: form.service_key.trim(),
          category: form.category,
          display_name: form.display_name.trim(),
          provider: form.provider.trim(),
          model: form.model.trim(),
          unit: form.unit.trim(),
          cost_usd: Number(form.cost_usd),
          markup_pct: Number(form.markup_pct),
          metadata: {
            placeholder: form.placeholder,
            approved_for_live: false,
            price_source: form.placeholder ? "manual_placeholder" : "manual_admin",
            requires_review: form.placeholder,
            created_by_phase: "manual",
            ...(form.placeholder && { live_block_reason: "placeholder_price_not_approved" }),
          },
        },
        reason,
      });
      toast.success("Preço criado");
      onClose();
    } catch (e) {
      toast.error("Erro", { description: (e as Error).message });
    }
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Novo preço de serviço</DialogTitle>
          <DialogDescription>
            Registros marcados como provisórios (placeholder) ficam bloqueados para cobrança real até aprovação manual com preço validado.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label>service_key</Label>
            <Input value={form.service_key} onChange={(e) => setForm({ ...form, service_key: e.target.value })} placeholder="ex.: nfe-emit" />
          </div>
          <div className="space-y-1">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Provider</Label>
            <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Display name</Label>
            <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Model</Label>
            <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Unit</Label>
            <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>cost_usd</Label>
            <Input type="number" step="0.0001" value={form.cost_usd} onChange={(e) => setForm({ ...form, cost_usd: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>markup_pct</Label>
            <Input type="number" step="0.01" value={form.markup_pct} onChange={(e) => setForm({ ...form, markup_pct: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Switch checked={form.placeholder} onCheckedChange={(c) => setForm({ ...form, placeholder: c })} />
            <Label>Marcar como placeholder (recomendado quando não há contrato real validado)</Label>
          </div>
          <div className="col-span-2"><ReasonField value={reason} onChange={setReason} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending || reason.trim().length < 3}>
            {mutation.isPending ? "Salvando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfirmReasonDialog({
  title, description, onClose, onConfirm, pending, confirmLabel = "Confirmar",
}: {
  title: string; description: string; onClose: () => void;
  onConfirm: (reason: string) => Promise<void>; pending: boolean; confirmLabel?: string;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ReasonField value={reason} onChange={setReason} />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onConfirm(reason)} disabled={pending || reason.trim().length < 3}>
            {pending ? "Salvando…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ serviceKey, onClose }: { serviceKey: string | null; onClose: () => void }) {
  const { data, isLoading } = useServicePricingHistory(serviceKey);
  if (!serviceKey) return null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico — {serviceKey}</DialogTitle>
          <DialogDescription>Auditoria completa de alterações deste service_key.</DialogDescription>
        </DialogHeader>
        {isLoading && <div className="text-muted-foreground">Carregando…</div>}
        <div className="max-h-[60vh] overflow-auto space-y-2">
          {(data ?? []).map((h) => (
            <div key={h.id} className="rounded border p-3 text-xs">
              <div className="flex justify-between mb-1">
                <Badge variant="outline">{h.action}</Badge>
                <span className="text-muted-foreground">{formatDateTimeBR(h.changed_at)}</span>
              </div>
              <div className="text-sm mb-1"><strong>Motivo:</strong> {h.reason}</div>
              {h.before && <details><summary className="cursor-pointer">before</summary><pre className="mt-1 bg-muted p-2 rounded overflow-auto">{JSON.stringify(h.before, null, 2)}</pre></details>}
              {h.after && <details><summary className="cursor-pointer">after</summary><pre className="mt-1 bg-muted p-2 rounded overflow-auto">{JSON.stringify(h.after, null, 2)}</pre></details>}
            </div>
          ))}
          {!isLoading && (data ?? []).length === 0 && <div className="text-muted-foreground text-sm">Sem histórico.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function PricingCatalogTab() {
  const { data, isLoading, error } = useServicePricingCatalog();
  const setActive = useSetPricingActive();
  const setApproval = useSetLiveApproval();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [provider, setProvider] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [placeholderFilter, setPlaceholderFilter] = useState<string>("all");
  const [approvedFilter, setApprovedFilter] = useState<string>("all");

  const [creating, setCreating] = useState(false);
  const [versioning, setVersioning] = useState<PricingRow | null>(null);
  const [historyKey, setHistoryKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    kind: "active" | "approve"; row: PricingRow; nextValue: boolean;
  } | null>(null);

  const filtered = useMemo(() => {
    const all = data ?? [];
    return all.filter((r) => {
      if (search && !r.service_key.includes(search) && !r.display_name.toLowerCase().includes(search.toLowerCase())) return false;
      if (category !== "all" && r.category !== category) return false;
      if (provider !== "all" && r.provider !== provider) return false;
      if (activeFilter === "active" && !r.is_active) return false;
      if (activeFilter === "inactive" && r.is_active) return false;
      if (placeholderFilter === "yes" && !isPlaceholder(r)) return false;
      if (placeholderFilter === "no" && isPlaceholder(r)) return false;
      if (approvedFilter === "yes" && !isApprovedForLive(r)) return false;
      if (approvedFilter === "no" && isApprovedForLive(r)) return false;
      return true;
    });
  }, [data, search, category, provider, activeFilter, placeholderFilter, approvedFilter]);

  const providers = useMemo(() => {
    const s = new Set((data ?? []).map((r) => r.provider));
    return Array.from(s).sort();
  }, [data]);

  const placeholderActiveTenantPaid = (data ?? []).filter(
    (r) => r.is_active && isPlaceholder(r) && !isApprovedForLive(r) && r.metadata?.usage_owner === "tenant"
  ).length;

  const exportCsv = () => {
    const rows = [
      ["service_key","display_name","category","provider","unit","cost_usd","markup_pct","sell_usd","is_active","placeholder","approved_for_live","effective_from","effective_until"],
      ...filtered.map((r) => [
        r.service_key, r.display_name, r.category, r.provider, r.unit,
        r.cost_usd, r.markup_pct, sellUsd(r).toFixed(6),
        r.is_active, isPlaceholder(r), isApprovedForLive(r),
        r.effective_from, r.effective_until ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `service_pricing_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Catálogo de preços</h2>
          <p className="text-sm text-muted-foreground">Tabela versionada de cost_usd e markup por service_key. Visível apenas para platform_admin.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>Exportar CSV</Button>
          <Button size="sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5 mr-1" />Novo preço</Button>
        </div>
      </div>

      {placeholderActiveTenantPaid > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{placeholderActiveTenantPaid} preço(s) provisório(s) tenant-paid sem aprovação</AlertTitle>
          <AlertDescription>
            Tentativas de cobrança real serão bloqueadas com <code>PRICE_NOT_APPROVED</code> até validação do preço e aprovação manual.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>{filtered.length} de {(data ?? []).length} registros</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-6 gap-2">
          <Input placeholder="Buscar key/nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {CATEGORY_OPTIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger><SelectValue placeholder="Provider" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos providers</SelectItem>
              {providers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={activeFilter} onValueChange={setActiveFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ativos e inativos</SelectItem>
              <SelectItem value="active">Apenas ativos</SelectItem>
              <SelectItem value="inactive">Apenas inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={placeholderFilter} onValueChange={setPlaceholderFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Placeholder: todos</SelectItem>
              <SelectItem value="yes">Apenas placeholder</SelectItem>
              <SelectItem value="no">Sem placeholder</SelectItem>
            </SelectContent>
          </Select>
          <Select value={approvedFilter} onValueChange={setApprovedFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Aprovação: todos</SelectItem>
              <SelectItem value="yes">Aprovados live</SelectItem>
              <SelectItem value="no">Não aprovados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading && <div className="text-muted-foreground">Carregando…</div>}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service key</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">cost_usd</TableHead>
                <TableHead className="text-right">markup</TableHead>
                <TableHead className="text-right">sell_usd</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Vigência</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const ph = isPlaceholder(r);
                const ap = isApprovedForLive(r);
                const tenantPaid = r.metadata?.usage_owner === "tenant";
                const liveBlocked = ph && !ap && tenantPaid;
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-mono text-xs">{r.service_key}</div>
                      <div className="text-xs text-muted-foreground">{r.display_name}</div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                    <TableCell className="text-xs">{r.provider}</TableCell>
                    <TableCell className="text-xs">{r.unit}</TableCell>
                    <TableCell className="text-right text-xs">{Number(r.cost_usd).toFixed(6)}</TableCell>
                    <TableCell className="text-right text-xs">{r.markup_pct}%</TableCell>
                    <TableCell className="text-right text-xs">{sellUsd(r).toFixed(6)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={r.is_active ? "default" : "outline"}>{r.is_active ? "ativo" : "inativo"}</Badge>
                        {ph && <Badge className="bg-amber-500 hover:bg-amber-500">placeholder</Badge>}
                        {ap ? <Badge className="bg-emerald-600 hover:bg-emerald-600">live ✓</Badge> : <Badge variant="outline">live ✗</Badge>}
                        {liveBlocked && <Badge variant="destructive">bloqueado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDateTimeBR(r.effective_from)}
                      {r.effective_until && <div className="text-muted-foreground">→ {formatDateTimeBR(r.effective_until)}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" title="Versionar" onClick={() => setVersioning(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title="Histórico" onClick={() => setHistoryKey(r.service_key)}>
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" title={r.is_active ? "Desativar" : "Reativar"}
                          onClick={() => setConfirmAction({ kind: "active", row: r, nextValue: !r.is_active })}>
                          {r.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                        </Button>
                        <Button size="sm" variant="ghost"
                          title={ap ? "Revogar aprovação live" : "Aprovar para live"}
                          disabled={!ap && ph && r.metadata?.price_source === "manual_placeholder"}
                          onClick={() => setConfirmAction({ kind: "approve", row: r, nextValue: !ap })}>
                          {ap ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && !isLoading && (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-6">Nenhum registro com os filtros atuais.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {creating && <CreateDialog onClose={() => setCreating(false)} />}
      {versioning && <VersionDialog row={versioning} onClose={() => setVersioning(null)} />}
      {historyKey && <HistoryDialog serviceKey={historyKey} onClose={() => setHistoryKey(null)} />}
      {confirmAction && (
        <ConfirmReasonDialog
          title={
            confirmAction.kind === "active"
              ? (confirmAction.nextValue ? "Reativar preço" : "Desativar preço")
              : (confirmAction.nextValue ? "Aprovar para cobrança live" : "Revogar aprovação live")
          }
          description={
            confirmAction.kind === "approve" && confirmAction.nextValue
              ? "Aprovar permite cobrança real de tenants. A aprovação só é permitida quando o preço tem origem validada."
              : "Esta ação será registrada na auditoria do catálogo."
          }
          confirmLabel={confirmAction.nextValue ? "Aprovar" : "Confirmar"}
          pending={setActive.isPending || setApproval.isPending}
          onClose={() => setConfirmAction(null)}
          onConfirm={async (reason) => {
            try {
              if (confirmAction.kind === "active") {
                await setActive.mutateAsync({ id: confirmAction.row.id, active: confirmAction.nextValue, reason });
              } else {
                await setApproval.mutateAsync({ id: confirmAction.row.id, approved: confirmAction.nextValue, reason });
              }
              toast.success("Atualizado");
              setConfirmAction(null);
            } catch (e) {
              toast.error("Erro", { description: (e as Error).message });
            }
          }}
        />
      )}
    </div>
  );
}
