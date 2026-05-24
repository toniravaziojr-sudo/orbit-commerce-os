// ============================================================
// Frente 6 — Tela admin da Ficha Institucional do tenant.
//
// Persiste 9 campos em `ai_support_config.metadata.institutional_sheet`
// (jsonb). Esses campos alimentam o bloco institucional injetado pelo
// pipeline da IA quando o turno é institucional/objeção/política.
// ============================================================
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useAiSupportConfig, type AiSupportConfig } from "@/hooks/useAiSupportConfig";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

type Sheet = {
  delivery_coverage?: string;
  business_hours?: string;
  payment_methods?: string;
  coupons_policy?: string;
  guarantee_policy?: string;
  social_proof?: string;
  physical_store?: string;
  contact_human?: string;
  notes?: string;
};

const FIELDS: Array<{
  key: keyof Sheet;
  label: string;
  description: string;
  placeholder: string;
  long?: boolean;
}> = [
  {
    key: "delivery_coverage",
    label: "Cobertura e prazos de entrega",
    description: "Regiões atendidas, prazos médios e exceções.",
    placeholder: "Ex.: Brasil todo. Sudeste 3-5 dias úteis. Nordeste 7-10 dias úteis.",
    long: true,
  },
  {
    key: "business_hours",
    label: "Horário de atendimento",
    description: "Quando há atendimento humano disponível.",
    placeholder: "Ex.: Seg-sex 9h-18h. Sábado 9h-13h.",
  },
  {
    key: "payment_methods",
    label: "Formas de pagamento e parcelamento",
    description: "Métodos aceitos, parcelamento e juros.",
    placeholder: "Ex.: Pix, cartão em até 12x sem juros, boleto.",
    long: true,
  },
  {
    key: "coupons_policy",
    label: "Cupons e descontos",
    description: "Política de cupom, regras e exceções.",
    placeholder: "Ex.: Cupom BEMVINDO10 só primeira compra. Não acumula com promoção.",
    long: true,
  },
  {
    key: "guarantee_policy",
    label: "Garantia, troca e devolução",
    description: "Como funciona garantia, prazo e processo.",
    placeholder: "Ex.: 30 dias para troca. Reembolso em até 7 dias úteis após recebimento.",
    long: true,
  },
  {
    key: "social_proof",
    label: "Prova social",
    description: "Avaliações, mídia, depoimentos relevantes.",
    placeholder: "Ex.: 4.8 no Google (1.200 avaliações). Citado pela revista X em 2024.",
    long: true,
  },
  {
    key: "physical_store",
    label: "Loja física",
    description: "Endereço e horário da loja física, se houver.",
    placeholder: "Ex.: Rua X, 123 — São Paulo/SP. Visita com hora marcada.",
  },
  {
    key: "contact_human",
    label: "Atendimento humano",
    description: "Como o cliente fala com uma pessoa real.",
    placeholder: "Ex.: WhatsApp (11) 99999-9999 em horário comercial.",
  },
  {
    key: "notes",
    label: "Observações",
    description: "Outras informações que a IA pode usar em pergunta institucional.",
    placeholder: "Ex.: CNPJ ativo, somos revendedores autorizados da marca Y.",
    long: true,
  },
];

export function AIInstitutionalSheetSection() {
  const { config, isLoading, upsertConfig } = useAiSupportConfig();
  const [sheet, setSheet] = useState<Sheet>({});

  useEffect(() => {
    if (!config) return;
    const meta = (config.metadata || {}) as Record<string, unknown>;
    const raw = (meta.institutional_sheet || {}) as Sheet;
    setSheet(raw);
  }, [config?.id]);

  const setField = (key: keyof Sheet, value: string) => {
    setSheet((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    const meta = (config?.metadata || {}) as Record<string, unknown>;
    const cleaned: Sheet = {};
    for (const k of Object.keys(sheet) as Array<keyof Sheet>) {
      const v = (sheet[k] || "").trim();
      if (v) cleaned[k] = v;
    }
    upsertConfig.mutate({
      metadata: { ...meta, institutional_sheet: cleaned } as AiSupportConfig["metadata"],
    });
  };

  return (
    <Card id="bloco-ficha-institucional" className="scroll-mt-24">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-lg">Ficha institucional</CardTitle>
          <CardDescription>
            Dados que a IA usa em perguntas institucionais, objeções e questões de política
            comercial. Quando um campo está em branco, a IA é orientada a NÃO inventar e
            oferecer atendimento humano.
          </CardDescription>
        </div>
        <Button onClick={handleSave} disabled={upsertConfig.isPending || isLoading}>
          <Save className="mr-1 h-4 w-4" />
          {upsertConfig.isPending ? "Salvando..." : "Salvar ficha"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.map((field) => (
            <div key={field.key} className={field.long ? "md:col-span-2 space-y-2" : "space-y-2"}>
              <Label className="text-sm font-medium">{field.label}</Label>
              <p className="text-xs text-muted-foreground">{field.description}</p>
              {field.long ? (
                <Textarea
                  rows={3}
                  placeholder={field.placeholder}
                  value={sheet[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
              ) : (
                <Input
                  placeholder={field.placeholder}
                  value={sheet[field.key] ?? ""}
                  onChange={(e) => setField(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
