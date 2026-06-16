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
  tone_of_voice: string;
  approved_main_promise: string;
  allowed_claims: string; // CSV
  banned_claims: string; // CSV
  do_not_do: string; // CSV
  compliance_notes: string;
  no_additional_restrictions_confirmed: boolean;
}

export const EMPTY_BRAND_COMPLIANCE: BrandComplianceValue = {
  tone_of_voice: "",
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
      : "Estas regras orientam a IA na hora de gerar os criativos.";

  return (
    <div className="space-y-4 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <Label className="text-sm font-semibold">
          Regras da marca para criativos {mode === "override" ? "(específicas desta conta)" : ""}
        </Label>
      </div>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Definem o que a IA pode e não pode dizer ou mostrar nos criativos. Sem isso, a geração fica bloqueada. {hintEmpty}
      </p>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Tom de comunicação</Label>
        <Input
          value={value.tone_of_voice}
          onChange={(e) => set("tone_of_voice", e.target.value)}
          placeholder='Ex: "Direto, masculino, sem firulas, com humor leve"'
        />
        <p className="text-[11px] text-muted-foreground">
          Define o jeito de falar da marca nos criativos. {mode === "override" && "Vazio = usa o global."}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Promessa principal da marca</Label>
        <Textarea
          value={value.approved_main_promise}
          onChange={(e) => set("approved_main_promise", e.target.value)}
          rows={2}
          placeholder='Ex: "Cabelos mais fortes em 30 dias, sem química agressiva"'
        />
        <p className="text-[11px] text-muted-foreground">
          Frase-chave que a IA vai usar como promessa central — ela não inventa outra. {mode === "override" && "Vazio = usa a global."}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Benefícios que a IA pode usar</Label>
        <Input
          value={value.allowed_claims}
          onChange={(e) => set("allowed_claims", e.target.value)}
          placeholder="Ex: hidrata, fortalece a raiz, reduz queda visível"
        />
        <p className="text-[11px] text-muted-foreground">Lista de benefícios liberados, separados por vírgula.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold">Regras comerciais e da marca</Label>
        <Textarea
          value={value.compliance_notes}
          onChange={(e) => set("compliance_notes", e.target.value)}
          rows={2}
          placeholder="Ex: evitar comparação com concorrentes; não citar diagnósticos médicos"
        />
        <p className="text-[11px] text-muted-foreground">Observações gerais que a IA deve respeitar.</p>
      </div>

      <div className="pt-2 border-t border-primary/10 space-y-4">
        <div className="flex items-center gap-2 text-amber-700">
          <AlertTriangle className="h-4 w-4" />
          <Label className="text-xs font-semibold">Restrições</Label>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Frases que a IA não pode usar</Label>
          <Input
            value={value.banned_claims}
            onChange={(e) => set("banned_claims", e.target.value)}
            placeholder="Ex: cura, resultado médico, antes e depois"
          />
          <p className="text-[11px] text-muted-foreground">Separadas por vírgula. A IA evitará esses termos nos criativos.</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-semibold">O que evitar nos criativos</Label>
          <Textarea
            value={value.do_not_do}
            onChange={(e) => set("do_not_do", e.target.value)}
            rows={2}
            placeholder="Ex: comparar com concorrente, mostrar mãos, mudar a cor do produto"
          />
          <p className="text-[11px] text-muted-foreground">Restrições visuais ou de abordagem, separadas por vírgula.</p>
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
              Marque para liberar a geração de criativos mesmo sem listar frases proibidas ou itens a evitar.
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
    tone_of_voice: v.tone_of_voice.trim() || null,
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
    tone_of_voice: row.tone_of_voice || "",
    approved_main_promise: row.approved_main_promise || "",
    allowed_claims: joinCsv(row.allowed_claims),
    banned_claims: joinCsv(row.banned_claims),
    do_not_do: joinCsv(row.do_not_do),
    compliance_notes: row.compliance_notes || "",
    no_additional_restrictions_confirmed: !!row.no_additional_restrictions_confirmed,
  };
}
