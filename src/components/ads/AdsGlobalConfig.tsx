import { useState, useEffect } from "react";
import { Bot, Settings2, DollarSign, Target } from "lucide-react";
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
  const [targetRoi, setTargetRoi] = useState(
    (globalConfig?.safety_rules as any)?.target_roi?.toString() || ""
  );

  useEffect(() => {
    if (globalConfig) {
      setBudgetMode(globalConfig.budget_mode);
      setBudgetValue((globalConfig.budget_cents / 100).toString());
      setInstructions(globalConfig.user_instructions || "");
      setTargetRoi((globalConfig.safety_rules as any)?.target_roi?.toString() || "");
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
        ...(globalConfig?.safety_rules as any || {}),
        target_roi: parseFloat(targetRoi || "0") || null,
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
                      ? `Orçamento: R$ ${(globalConfig.budget_cents / 100).toLocaleString("pt-BR")} / ${globalConfig.budget_mode === "daily" ? "dia" : "mês"}${(globalConfig.safety_rules as any)?.target_roi ? ` · ROI ideal: ${(globalConfig.safety_rules as any).target_roi}x` : ""}`
                      : "Defina o orçamento total e direcionamento estratégico"}
                  </p>
                </div>
              </div>
              <Settings2 className="h-5 w-5 text-muted-foreground" />
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            {/* Budget */}
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
              <p className="text-[11px] text-muted-foreground">
                Limite máximo que a IA pode distribuir entre todos os canais
              </p>
            </div>

            {/* ROI Ideal */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                ROI Ideal (Meta Global)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={targetRoi}
                  onChange={(e) => setTargetRoi(e.target.value)}
                  placeholder="5"
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground font-medium">x</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Meta de retorno global que a IA buscará alcançar somando todo investimento × todas as campanhas em todos os canais. Ex: ROI 5 = R$ 5 de retorno para cada R$ 1 investido.
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
