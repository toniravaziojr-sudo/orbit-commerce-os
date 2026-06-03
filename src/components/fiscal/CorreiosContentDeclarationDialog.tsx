// =============================================
// CORREIOS CONTENT DECLARATION DIALOG
// Modal obrigatório de responsabilidade antes de gerar Declaração de Conteúdo dos Correios.
// NÃO é documento fiscal. Não substitui NF-e.
// Em massa: motivo e aceite valem para TODOS os pedidos selecionados.
// Peso é calculado automaticamente a partir dos itens do pedido (sem input manual).
// =============================================
import { useEffect, useState } from "react";
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

export interface DcDialogTarget {
  id: string;
  label: string; // ex: "Pedido #12345 — Maria"
}

export interface DcDialogConfirmPayload {
  reason: string;
  responsibility_acknowledged: true;
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

  useEffect(() => {
    if (!open) {
      setReasonOption("");
      setOtherDetail("");
      setAck(false);
    }
  }, [open]);

  const isBulk = targets.length > 1;
  const isOther = reasonOption === "Outro";
  const otherValid = !isOther || otherDetail.trim().length >= 3;
  const reasonValid = reasonOption !== "" && otherValid;

  const canConfirm = reasonValid && ack && !loading && targets.length > 0;

  const buildReason = (): string => (isOther ? `Outro: ${otherDetail.trim()}` : reasonOption);

  const handleConfirm = async () => {
    if (!canConfirm) return;
    await onConfirm({
      reason: buildReason(),
      responsibility_acknowledged: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Gerar Declaração de Conteúdo dos Correios
          </DialogTitle>
          <DialogDescription>
            {isBulk
              ? `Será gerado um único PDF com uma Declaração de Conteúdo por pedido selecionado (${targets.length} pedidos). O motivo escolhido será aplicado a todos.`
              : 'Você está prestes a gerar uma Declaração de Conteúdo. Ela ficará salva no pedido — depois você pode imprimir quando precisar pela opção "Imprimir Declaração de Conteúdo".'}
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

          <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
            O peso total e a quantidade de volumes são preenchidos automaticamente a partir dos dados do pedido
            (peso cadastrado nos produtos). Se algum produto estiver sem peso, a geração falhará para o pedido
            correspondente e será necessário cadastrar o peso do produto antes de tentar novamente.
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

          {/* Lista de pedidos (somente leitura, para conferência em massa) */}
          {isBulk && (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
              {targets.map((t) => (
                <div key={t.id} className="truncate" title={t.label}>{t.label}</div>
              ))}
            </div>
          )}

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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
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
