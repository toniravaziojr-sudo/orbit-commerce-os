// =============================================
// CORREIOS CONTENT DECLARATION DIALOG
// Modal obrigatório de responsabilidade antes de gerar Declaração de Conteúdo dos Correios.
// NÃO é documento fiscal. Não substitui NF-e.
// Em massa: motivo e aceite valem para TODOS; peso/volumes são por pedido.
// Peso é OBRIGATÓRIO — não permite gerar PDF com peso vazio.
// =============================================
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

export interface DcDialogTarget {
  id: string;
  label: string;             // ex: "Pedido #12345 — Maria"
  prefilledWeightKg?: number | null;
  prefilledVolumes?: number | null;
}

export interface DcDialogConfirmPayload {
  reason: string;
  responsibility_acknowledged: true;
  perTarget: Array<{ id: string; weightGrams: number; volumes: number }>;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targets: DcDialogTarget[];
  loading?: boolean;
  onConfirm: (payload: DcDialogConfirmPayload) => void | Promise<void>;
}

const REASON_OPTIONS = [
  "Venda/remessa sem emissão de NF-e por decisão do remetente",
  "Devolução de consumidor final",
  "Troca",
  "Amostra sem valor comercial",
  "Brinde",
  "Bem pessoal",
  "Outro",
] as const;

type ReasonOption = (typeof REASON_OPTIONS)[number];

export function CorreiosContentDeclarationDialog({
  open,
  onOpenChange,
  targets,
  loading = false,
  onConfirm,
}: Props) {
  const [reasonOption, setReasonOption] = useState<ReasonOption | "">("");
  const [otherDetail, setOtherDetail] = useState("");
  const [ack, setAck] = useState(false);

  // Estado por pedido: peso (kg) e volumes
  const [perTarget, setPerTarget] = useState<Record<string, { weightKg: string; volumes: string }>>({});

  // Reseta a cada abertura quando mudam os alvos
  useEffect(() => {
    if (!open) return;
    const init: Record<string, { weightKg: string; volumes: string }> = {};
    for (const t of targets) {
      const w = t.prefilledWeightKg && t.prefilledWeightKg > 0 ? String(t.prefilledWeightKg) : "";
      const v = t.prefilledVolumes && t.prefilledVolumes > 0 ? String(t.prefilledVolumes) : "1";
      init[t.id] = { weightKg: w, volumes: v };
    }
    setPerTarget(init);
  }, [open, targets]);

  const isBulk = targets.length > 1;
  const isOther = reasonOption === "Outro";
  const otherValid = !isOther || otherDetail.trim().length >= 3;
  const reasonValid = reasonOption !== "" && otherValid;

  const allWeightsValid = useMemo(() => {
    return targets.every((t) => {
      const v = perTarget[t.id];
      if (!v) return false;
      const wkg = Number(v.weightKg.replace(",", "."));
      const vols = Number(v.volumes);
      return Number.isFinite(wkg) && wkg > 0 && Number.isFinite(vols) && vols >= 1;
    });
  }, [targets, perTarget]);

  const canConfirm = reasonValid && ack && allWeightsValid && !loading && targets.length > 0;

  const buildReason = (): string => (isOther ? `Outro: ${otherDetail.trim()}` : reasonOption);

  // Aplicar valor a todos (apenas em modo bulk)
  const applyWeightToAll = (kg: string) => {
    setPerTarget((prev) => {
      const next = { ...prev };
      for (const t of targets) next[t.id] = { ...next[t.id], weightKg: kg };
      return next;
    });
  };
  const applyVolumesToAll = (vols: string) => {
    setPerTarget((prev) => {
      const next = { ...prev };
      for (const t of targets) next[t.id] = { ...next[t.id], volumes: vols };
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    const payload: DcDialogConfirmPayload = {
      reason: buildReason(),
      responsibility_acknowledged: true,
      perTarget: targets.map((t) => {
        const v = perTarget[t.id];
        const wkg = Number(v.weightKg.replace(",", "."));
        const vols = Number(v.volumes);
        return { id: t.id, weightGrams: Math.round(wkg * 1000), volumes: Math.max(1, Math.floor(vols)) };
      }),
    };
    await onConfirm(payload);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setReasonOption("");
      setOtherDetail("");
      setAck(false);
      setPerTarget({});
    }
    onOpenChange(v);
  };

  // Bulk apply controles (só aparecem quando isBulk)
  const [bulkWeight, setBulkWeight] = useState("");
  const [bulkVolumes, setBulkVolumes] = useState("");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Gerar Declaração de Conteúdo dos Correios
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `Será gerado um único PDF com uma Declaração de Conteúdo por pedido selecionado (${targets.length} pedidos). O motivo escolhido será aplicado a todos.`
              : "Você está prestes a gerar uma Declaração de Conteúdo."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Atenção — leia antes de continuar:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                A Declaração de Conteúdo é um documento dos Correios para transporte. <strong>Não é documento fiscal</strong> e
                <strong> não substitui Nota Fiscal</strong> quando a emissão de NF-e for obrigatória.
              </li>
              <li>O remetente é integralmente responsável pelas informações declaradas.</li>
              <li>É proibido enviar objetos restritos ou proibidos pela legislação postal.</li>
            </ul>
          </div>

          {/* Motivo */}
          <div className="space-y-2">
            <Label htmlFor="dc-reason">
              Motivo da emissão <span className="text-destructive">*</span>
            </Label>
            <Select value={reasonOption} onValueChange={(v) => setReasonOption(v as ReasonOption)}>
              <SelectTrigger id="dc-reason">
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent>
                {REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isOther && (
              <Textarea
                placeholder="Descreva o motivo..."
                value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value)}
                rows={3}
              />
            )}
          </div>

          {/* Peso e volumes */}
          <div className="space-y-2">
            <Label>
              Peso e volumes <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              O peso total é obrigatório. Volumes padrão é 1 e pode ser ajustado.
            </p>

            {isBulk && (
              <div className="flex items-end gap-2 rounded-md border bg-muted/30 p-2 text-xs">
                <div className="space-y-1">
                  <Label className="text-xs">Aplicar peso (kg) a todos</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,500"
                    value={bulkWeight}
                    onChange={(e) => setBulkWeight(e.target.value)}
                    className="h-8 w-24"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => applyWeightToAll(bulkWeight)} disabled={!bulkWeight}>
                  Aplicar peso
                </Button>
                <div className="space-y-1">
                  <Label className="text-xs">Volumes para todos</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1"
                    value={bulkVolumes}
                    onChange={(e) => setBulkVolumes(e.target.value)}
                    className="h-8 w-20"
                  />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => applyVolumesToAll(bulkVolumes || "1")}>
                  Aplicar volumes
                </Button>
              </div>
            )}

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border p-2">
              {targets.map((t) => {
                const v = perTarget[t.id] || { weightKg: "", volumes: "1" };
                const wkg = Number(v.weightKg.replace(",", "."));
                const wInvalid = !Number.isFinite(wkg) || wkg <= 0;
                return (
                  <div key={t.id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 truncate" title={t.label}>{t.label}</div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="decimal"
                        placeholder="kg"
                        value={v.weightKg}
                        onChange={(e) =>
                          setPerTarget((prev) => ({ ...prev, [t.id]: { ...v, weightKg: e.target.value } }))
                        }
                        className={`h-8 w-20 ${wInvalid ? "border-destructive" : ""}`}
                      />
                      <span className="text-xs text-muted-foreground">kg</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={1}
                        value={v.volumes}
                        onChange={(e) =>
                          setPerTarget((prev) => ({ ...prev, [t.id]: { ...v, volumes: e.target.value } }))
                        }
                        className="h-8 w-16"
                      />
                      <span className="text-xs text-muted-foreground">vol.</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {!allWeightsValid && (
              <p className="text-xs text-destructive">Informe peso (&gt; 0) e volumes (≥ 1) para todos os pedidos.</p>
            )}
          </div>

          {/* Aceite */}
          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox id="dc-ack" checked={ack} onCheckedChange={(v) => setAck(v === true)} className="mt-0.5" />
            <Label htmlFor="dc-ack" className="cursor-pointer text-sm font-normal leading-snug">
              Declaro, sob minha responsabilidade, que as informações prestadas são verdadeiras e que esta Declaração de
              Conteúdo é adequada para a remessa, ciente de que ela não substitui Nota Fiscal quando a emissão for obrigatória.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {loading
              ? "Gerando..."
              : isBulk
              ? `Gerar Declarações de Conteúdo (${targets.length})`
              : "Gerar Declaração de Conteúdo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
