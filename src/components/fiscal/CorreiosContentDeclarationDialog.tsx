// =============================================
// CORREIOS CONTENT DECLARATION DIALOG
// Modal obrigatório de responsabilidade antes de gerar Declaração de Conteúdo dos Correios.
// NÃO é documento fiscal. Não substitui NF-e.
// No fluxo de múltiplos pedidos, o motivo selecionado se aplica a TODOS os pedidos selecionados.
// =============================================
import { useState } from "react";
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count?: number; // quantidade de pedidos selecionados (modo bulk)
  loading?: boolean;
  onConfirm: (payload: { reason: string; responsibility_acknowledged: true }) => void | Promise<void>;
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
  count = 1,
  loading = false,
  onConfirm,
}: Props) {
  const [reasonOption, setReasonOption] = useState<ReasonOption | "">("");
  const [otherDetail, setOtherDetail] = useState("");
  const [ack, setAck] = useState(false);

  const isOther = reasonOption === "Outro";
  const otherValid = !isOther || otherDetail.trim().length >= 3;
  const reasonValid = reasonOption !== "" && otherValid;
  const canConfirm = reasonValid && ack && !loading;

  const buildReason = (): string => {
    if (isOther) return `Outro: ${otherDetail.trim()}`;
    return reasonOption;
  };

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm({ reason: buildReason(), responsibility_acknowledged: true });
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setReasonOption("");
      setOtherDetail("");
      setAck(false);
    }
    onOpenChange(v);
  };

  const isBulk = count > 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Gerar Declaração de Conteúdo dos Correios
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `Você está prestes a emitir ${count} Declarações de Conteúdo. O motivo selecionado será aplicado a todos os pedidos.`
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
              <li>
                Para vendas comerciais por CNPJ (incluindo marketplaces), a NF-e é, em regra, obrigatória. Confirme se a
                remessa atual realmente dispensa NF-e antes de prosseguir.
              </li>
            </ul>
          </div>

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
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
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
            <p className="text-xs text-muted-foreground">
              {isBulk
                ? "Este motivo será registrado e impresso no PDF de todas as Declarações emitidas."
                : "Esse motivo fica registrado no histórico e impresso no PDF da Declaração de Conteúdo."}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-md border p-3">
            <Checkbox
              id="dc-ack"
              checked={ack}
              onCheckedChange={(v) => setAck(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="dc-ack" className="text-sm font-normal leading-snug cursor-pointer">
              Declaro, sob minha responsabilidade, que esta remessa não exige emissão de Nota Fiscal e estou ciente de que a
              Declaração de Conteúdo não substitui NF-e quando a emissão for obrigatória.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {loading ? "Gerando..." : isBulk ? `Gerar ${count} Declarações` : "Gerar Declaração"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
