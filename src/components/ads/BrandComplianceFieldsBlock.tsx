// =============================================================================
// H.4.0 — Bloco de campos de promessa/claims/restrições da marca
// Componente CONTROLADO. Reusado em Configurações Globais e por conta de anúncios.
// Modo "global": grava no contexto de marca do tenant.
// Modo "override": grava como override opcional na configuração da conta.
// =============================================================================
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export interface BrandComplianceValue {
  approved_main_promise: string;
  allowed_claims: string; // CSV
  banned_claims: string; // CSV
  do_not_do: string; // CSV
  compliance_notes: string;
  no_additional_restrictions_confirmed: boolean;
}

export const EMPTY_BRAND_COMPLIANCE: BrandComplianceValue = {
  approved_main_promise: "",
  allowed_claims: "",
  banned_claims: "",
  do_not_do: "",
  compliance_notes: "",
  no_additional_restrictions_confirmed: false,
};

interface Props {
  value: BrandComplianceValue;
  onChange: (next: BrandComplianceValue) => void;
  mode: "global" | "override";
}

export function BrandComplianceFieldsBlock({ value, onChange, mode }: Props) {
  const set = <K extends keyof BrandComplianceValue>(k: K, v: BrandComplianceValue[K]) =>
    onChange({ ...value, [k]: v });

  const hintEmpty =
    mode === "override"
      ? "Deixe vazio para herdar das Configurações Globais."
      : "Fonte de verdade que a IA usa para gerar criativos.";

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">
          Promessas, claims e restrições da marca {mode === "override" ? "(override desta conta)" : ""}
        </Label>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Define o que a IA pode e não pode dizer nos criativos. Sem isso, a geração de criativos fica bloqueada. {hintEmpty}
      </p>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Promessa principal aprovada</Label>
        <Textarea
          value={value.approved_main_promise}
          onChange={(e) => set("approved_main_promise", e.target.value)}
          rows={2}
          placeholder='Ex: "Cabelos mais fortes em 30 dias, sem química agressiva"'
        />
        <p className="text-[11px] text-muted-foreground">
          A IA não inventa promessa — usa esta. {mode === "override" && "Vazio = usa a global."}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Claims permitidas</Label>
        <Input
          value={value.allowed_claims}
          onChange={(e) => set("allowed_claims", e.target.value)}
          placeholder="Ex: hidrata, fortalece a raiz, reduz queda visível"
        />
        <p className="text-[11px] text-muted-foreground">Separadas por vírgula.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Observações comerciais ou de compliance</Label>
        <Textarea
          value={value.compliance_notes}
          onChange={(e) => set("compliance_notes", e.target.value)}
          rows={2}
          placeholder="Ex: evitar comparação com concorrentes; não citar diagnósticos médicos"
        />
      </div>

      <div className="pt-2 border-t border-primary/10 space-y-4">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <Label className="text-xs font-semibold">Restrições</Label>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Claims proibidas</Label>
          <Input
            value={value.banned_claims}
            onChange={(e) => set("banned_claims", e.target.value)}
            placeholder="Ex: resultados médicos, antes/depois, cura"
          />
          <p className="text-[11px] text-muted-foreground">Separadas por vírgula. A IA evitará esses termos.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Não fazer</Label>
          <Textarea
            value={value.do_not_do}
            onChange={(e) => set("do_not_do", e.target.value)}
            rows={2}
            placeholder="Ex: inventar rótulos, alterar cores do produto, mostrar mãos"
          />
          <p className="text-[11px] text-muted-foreground">Separados por vírgula.</p>
        </div>

        <label className="flex items-start gap-3 rounded-md border bg-background p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.no_additional_restrictions_confirmed}
            onChange={(e) => set("no_additional_restrictions_confirmed", e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-input"
          />
          <div>
            <div className="text-xs font-medium">
              Confirmo que não há restrições adicionais
            </div>
            <p className="text-[11px] text-muted-foreground">
              Marcar libera a geração de criativos mesmo sem listar claims proibidas ou regras de "não fazer".
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// Helpers ---------------------------------------------------------------------

const splitCsv = (s: string): string[] =>
  (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const joinCsv = (a: string[] | null | undefined): string =>
  Array.isArray(a) ? a.join(", ") : "";

/** Converte o estado do form para o formato persistido no banco (arrays + nulls). */
export function brandComplianceToPersist(v: BrandComplianceValue) {
  return {
    approved_main_promise: v.approved_main_promise.trim() || null,
    allowed_claims: splitCsv(v.allowed_claims),
    banned_claims: splitCsv(v.banned_claims),
    do_not_do: splitCsv(v.do_not_do),
    compliance_notes: v.compliance_notes.trim() || null,
    no_additional_restrictions_confirmed: v.no_additional_restrictions_confirmed,
  };
}

/** Converte um registro persistido (banco/override jsonb) para o estado do form. */
export function brandCompliancePersistToForm(row: any | null | undefined): BrandComplianceValue {
  if (!row) return { ...EMPTY_BRAND_COMPLIANCE };
  return {
    approved_main_promise: row.approved_main_promise || "",
    allowed_claims: joinCsv(row.allowed_claims),
    banned_claims: joinCsv(row.banned_claims),
    do_not_do: joinCsv(row.do_not_do),
    compliance_notes: row.compliance_notes || "",
    no_additional_restrictions_confirmed: !!row.no_additional_restrictions_confirmed,
  };
}
