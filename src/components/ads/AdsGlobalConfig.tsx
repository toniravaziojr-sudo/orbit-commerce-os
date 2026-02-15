import { useState, useEffect } from "react";
import { Bot, Settings2, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";

interface AdsGlobalConfigProps {
  globalConfig: AutopilotConfig | null;
  onSave: (config: Partial<AutopilotConfig> & { channel: string }) => void;
  isSaving: boolean;
}

export function AdsGlobalConfig({ globalConfig, onSave, isSaving }: AdsGlobalConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [budgetMode, setBudgetMode] = useState(globalConfig?.budget_mode || "monthly");
  const [budgetValue, setBudgetValue] = useState(globalConfig?.budget_cents ? (globalConfig.budget_cents / 100).toString() : "");
  const [instructions, setInstructions] = useState(globalConfig?.user_instructions || "");
  const [marginPct, setMarginPct] = useState(String(globalConfig?.safety_rules?.gross_margin_pct || 50));
  const [maxCpa, setMaxCpa] = useState(globalConfig?.safety_rules?.max_cpa_cents ? (globalConfig.safety_rules.max_cpa_cents / 100).toString() : "");

  useEffect(() => {
    if (globalConfig) {
      setBudgetMode(globalConfig.budget_mode);
      setBudgetValue((globalConfig.budget_cents / 100).toString());
      setInstructions(globalConfig.user_instructions || "");
      setMarginPct(String(globalConfig.safety_rules?.gross_margin_pct || 50));
      setMaxCpa(globalConfig.safety_rules?.max_cpa_cents ? (globalConfig.safety_rules.max_cpa_cents / 100).toString() : "");
    }
  }, [globalConfig]);

  const handleSave = () => {
    onSave({
      channel: "global",
      budget_mode: budgetMode,
      budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
      objective: "sales",
      user_instructions: instructions || null,
      safety_rules: {
        ...(globalConfig?.safety_rules || {}),
        gross_margin_pct: parseFloat(marginPct) || 50,
        max_cpa_cents: maxCpa ? Math.round(parseFloat(maxCpa) * 100) : null,
      },
    });
  };

  return (
    <Card className="border-primary/20">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Configuração Global</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {globalConfig?.budget_cents
                      ? `Orçamento: R$ ${(globalConfig.budget_cents / 100).toLocaleString("pt-BR")} / ${globalConfig.budget_mode === "daily" ? "dia" : "mês"} · Margem: ${globalConfig.safety_rules?.gross_margin_pct || 50}%`
                      : "Defina o orçamento total e margem bruta"}
                  </p>
                </div>
              </div>
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Budget + Margin */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orçamento Total</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      value={budgetValue}
                      onChange={(e) => setBudgetValue(e.target.value)}
                      className="pl-9"
                      placeholder="1000"
                    />
                  </div>
                  <Select value={budgetMode} onValueChange={setBudgetMode}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">/ dia</SelectItem>
                      <SelectItem value="monthly">/ mês</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Margem Bruta (%)</Label>
                <Input
                  type="number"
                  value={marginPct}
                  onChange={(e) => setMarginPct(e.target.value)}
                  placeholder="50"
                />
                <p className="text-[11px] text-muted-foreground">
                  Usada pela IA para calcular CPA máximo automaticamente
                </p>
              </div>
            </div>

            {/* CPA Máximo */}
            <div className="space-y-2">
              <Label>CPA Máximo (R$)</Label>
              <Input
                type="number"
                value={maxCpa}
                onChange={(e) => setMaxCpa(e.target.value)}
                placeholder="Automático"
                className="max-w-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Opcional — se vazio, será calculado pela margem bruta
              </p>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Prompt de Direcionamento
              </Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
                placeholder={`Descreva como a IA deve gerenciar suas campanhas. Exemplos:\n\n• "Priorize campanhas de remarketing, nosso forte é reconversão"\n• "O produto carro-chefe é o Shampoo X, foque nele para público frio"\n• "Nosso público principal são homens 25-45 anos, classe B"`}
              />
              <p className="text-xs text-muted-foreground">
                Direcionamento estratégico que a IA seguirá nas decisões.
              </p>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? "Salvando..." : "Salvar Configuração Global"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
