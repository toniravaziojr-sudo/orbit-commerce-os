import { useState, useEffect } from "react";
import { Bot, Settings2, Zap, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";

interface AdsGlobalConfigProps {
  globalConfig: AutopilotConfig | null;
  onSave: (config: Partial<AutopilotConfig> & { channel: string }) => void;
  onToggle: (channel: string, enabled: boolean) => void;
  onTriggerAnalysis: () => void;
  isAnalyzing: boolean;
  isSaving: boolean;
}

export function AdsGlobalConfig({ globalConfig, onSave, onToggle, onTriggerAnalysis, isAnalyzing, isSaving }: AdsGlobalConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [budgetMode, setBudgetMode] = useState(globalConfig?.budget_mode || "monthly");
  const [budgetValue, setBudgetValue] = useState(globalConfig?.budget_cents ? (globalConfig.budget_cents / 100).toString() : "");
  const [objective, setObjective] = useState(globalConfig?.objective || "sales");
  const [instructions, setInstructions] = useState(globalConfig?.user_instructions || "");
  const [marginPct, setMarginPct] = useState(String(globalConfig?.safety_rules?.gross_margin_pct || 50));
  const [minRoas, setMinRoas] = useState(String(globalConfig?.safety_rules?.min_roas || 2));
  const [targetRoasCold, setTargetRoasCold] = useState(String(globalConfig?.safety_rules?.target_roas_cold || 2));
  const [targetRoasRemarketing, setTargetRoasRemarketing] = useState(String(globalConfig?.safety_rules?.target_roas_remarketing || 4));
  const [minRoasPause, setMinRoasPause] = useState(String(globalConfig?.safety_rules?.min_roas_pause || 1));
  const [maxCpa, setMaxCpa] = useState(globalConfig?.safety_rules?.max_cpa_cents ? (globalConfig.safety_rules.max_cpa_cents / 100).toString() : "");

  useEffect(() => {
    if (globalConfig) {
      setBudgetMode(globalConfig.budget_mode);
      setBudgetValue((globalConfig.budget_cents / 100).toString());
      setObjective(globalConfig.objective);
      setInstructions(globalConfig.user_instructions || "");
      setMarginPct(String(globalConfig.safety_rules?.gross_margin_pct || 50));
      setMinRoas(String(globalConfig.safety_rules?.min_roas || 2));
      setTargetRoasCold(String(globalConfig.safety_rules?.target_roas_cold || 2));
      setTargetRoasRemarketing(String(globalConfig.safety_rules?.target_roas_remarketing || 4));
      setMinRoasPause(String(globalConfig.safety_rules?.min_roas_pause || 1));
      setMaxCpa(globalConfig.safety_rules?.max_cpa_cents ? (globalConfig.safety_rules.max_cpa_cents / 100).toString() : "");
    }
  }, [globalConfig]);

  const handleSave = () => {
    onSave({
      channel: "global",
      budget_mode: budgetMode,
      budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
      objective,
      user_instructions: instructions || null,
      is_enabled: globalConfig?.is_enabled ?? false,
      safety_rules: {
        ...(globalConfig?.safety_rules || {}),
        gross_margin_pct: parseFloat(marginPct) || 50,
        min_roas: parseFloat(minRoas) || 2,
        target_roas_cold: parseFloat(targetRoasCold) || 2,
        target_roas_remarketing: parseFloat(targetRoasRemarketing) || 4,
        min_roas_pause: parseFloat(minRoasPause) || 1,
        max_cpa_cents: maxCpa ? Math.round(parseFloat(maxCpa) * 100) : null,
      },
    });
  };

  const isEnabled = globalConfig?.is_enabled || false;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Piloto Automático IA</CardTitle>
              <p className="text-sm text-muted-foreground">
                {isEnabled
                  ? `Orçamento: R$ ${(globalConfig?.budget_cents || 0) / 100} / ${globalConfig?.budget_mode === "daily" ? "dia" : "mês"}`
                  : "Configure e ative para a IA gerenciar seu tráfego"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isEnabled && (
              <Button
                variant="outline"
                size="sm"
                onClick={onTriggerAnalysis}
                disabled={isAnalyzing}
                className="gap-2"
              >
                <Zap className={`h-4 w-4 ${isAnalyzing ? "animate-pulse" : ""}`} />
                {isAnalyzing ? "Analisando..." : "Executar Análise"}
              </Button>
            )}
            {globalConfig?.last_analysis_at && (
              <Badge variant="outline" className="text-xs">
                Última: {new Date(globalConfig.last_analysis_at).toLocaleString("pt-BR")}
              </Badge>
            )}
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => onToggle("global", checked)}
            />
          </div>
        </div>
      </CardHeader>

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
            <Settings2 className="h-4 w-4" />
            {isOpen ? "Fechar configurações" : "Configurar orçamento, objetivo e instruções"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-4 space-y-6">
            {/* Budget */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label>Objetivo</Label>
                <Select value={objective} onValueChange={setObjective}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Vendas</SelectItem>
                    <SelectItem value="traffic">Tráfego</SelectItem>
                    <SelectItem value="leads">Leads</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Margem Bruta (%)</Label>
                <Input
                  type="number"
                  value={marginPct}
                  onChange={(e) => setMarginPct(e.target.value)}
                  placeholder="50"
                />
              </div>
            </div>

            {/* Prompt de Direcionamento */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Prompt de Direcionamento
              </Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={5}
                placeholder={`Descreva como a IA deve gerenciar suas campanhas. Exemplos:\n\n• "Priorize campanhas de remarketing, nosso forte é reconversão"\n• "O produto carro-chefe é o Shampoo X, foque nele para público frio"\n• "Nunca pause campanhas de branding, mesmo com ROAS baixo"\n• "Nosso público principal são homens 25-45 anos, classe B"`}
              />
              <p className="text-xs text-muted-foreground">
                Este é o direcionamento estratégico que a IA seguirá ao tomar decisões sobre suas campanhas.
              </p>
            </div>

            {/* ROI por Tipo de Audiência */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Metas de ROAS por Audiência</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Defina o retorno esperado para cada tipo de campanha. A IA usará esses valores para otimizar e decidir quando pausar.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <Label className="text-xs text-blue-600 dark:text-blue-400">🧊 Público Frio (Prospecção)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={targetRoasCold}
                    onChange={(e) => setTargetRoasCold(e.target.value)}
                    placeholder="2.0"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    ROAS ideal para campanhas de aquisição de novos clientes
                  </p>
                </div>
                <div className="space-y-2 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                  <Label className="text-xs text-orange-600 dark:text-orange-400">🔥 Remarketing (Reconversão)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={targetRoasRemarketing}
                    onChange={(e) => setTargetRoasRemarketing(e.target.value)}
                    placeholder="4.0"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    ROAS ideal para campanhas de público quente / retargeting
                  </p>
                </div>
                <div className="space-y-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                  <Label className="text-xs text-red-600 dark:text-red-400">⛔ ROAS Mínimo (Pausar)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={minRoasPause}
                    onChange={(e) => setMinRoasPause(e.target.value)}
                    placeholder="1.0"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Abaixo desse valor a IA pausará a campanha automaticamente
                  </p>
                </div>
              </div>
            </div>

            {/* Safety Rules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>ROAS Mínimo Geral</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={minRoas}
                  onChange={(e) => setMinRoas(e.target.value)}
                  placeholder="2.0"
                />
                <p className="text-[11px] text-muted-foreground">
                  Usado como referência geral quando a IA não identifica o tipo de audiência
                </p>
              </div>
              <div className="space-y-2">
                <Label>CPA Máximo (R$)</Label>
                <Input
                  type="number"
                  value={maxCpa}
                  onChange={(e) => setMaxCpa(e.target.value)}
                  placeholder="Automático"
                />
                <p className="text-[11px] text-muted-foreground">
                  Opcional — se vazio, será calculado pela margem bruta
                </p>
              </div>
            </div>

            <Button onClick={handleSave} disabled={isSaving} className="w-full">
              {isSaving ? "Salvando..." : "Salvar Configuração"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
