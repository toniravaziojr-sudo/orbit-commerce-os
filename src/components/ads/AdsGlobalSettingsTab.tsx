import { useState, useEffect } from "react";
import { Bot, DollarSign, Target, Shield, Zap, Scale, AlertTriangle, Info, Globe, TrendingUp, ChevronDown, ChevronUp, Power } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";
import { PROMPT_TEMPLATE_GLOBAL } from "./adsPromptTemplates";

interface AdsGlobalSettingsTabProps {
  globalConfig: AutopilotConfig | null;
  onSave: (config: Partial<AutopilotConfig> & { channel: string }) => void;
  isSaving: boolean;
  hasAccountOverrides: boolean;
  isGlobalEnabled: boolean;
  onToggleGlobal: (enabled: boolean) => void;
  isTogglingGlobal?: boolean;
}

const STRATEGY_OPTIONS = [
  { value: "aggressive", label: "Agressiva", icon: "🔥", desc: "Foco em vendas a curto prazo" },
  { value: "balanced", label: "Balanceada", icon: "⚖️", desc: "Equilíbrio entre vendas e crescimento (Recomendada)" },
  { value: "long_term", label: "Médio/Longo Prazo", icon: "🌱", desc: "Branding e crescimento sustentável" },
];

const APPROVAL_OPTIONS = [
  { value: "auto", label: "Auto-executar tudo", desc: "IA executa todas as ações automaticamente" },
  { value: "approve_high_impact", label: "Aprovar alto impacto", desc: "Criar campanha, budget >20%, trocar objetivo" },
];

export function AdsGlobalSettingsTab({ globalConfig, onSave, isSaving, hasAccountOverrides, isGlobalEnabled, onToggleGlobal, isTogglingGlobal }: AdsGlobalSettingsTabProps) {
  const [budgetMode, setBudgetMode] = useState(globalConfig?.budget_mode || "monthly");
  const [budgetValue, setBudgetValue] = useState(globalConfig?.budget_cents ? (globalConfig.budget_cents / 100).toString() : "");
  const [targetRoi, setTargetRoi] = useState(
    (globalConfig?.safety_rules as any)?.target_roi?.toString() || ""
  );
  const [minRoiCold, setMinRoiCold] = useState(
    String((globalConfig?.safety_rules as any)?.min_roi_cold ?? "")
  );
  const [minRoiWarm, setMinRoiWarm] = useState(
    String((globalConfig?.safety_rules as any)?.min_roi_warm ?? "")
  );
  const [roasScalingThreshold, setRoasScalingThreshold] = useState(
    String((globalConfig?.safety_rules as any)?.roas_scaling_threshold ?? "")
  );
  const [instructions, setInstructions] = useState(globalConfig?.user_instructions || "");
  const [strategyMode, setStrategyMode] = useState(globalConfig?.strategy_mode || "balanced");
  const [funnelSplitMode, setFunnelSplitMode] = useState(globalConfig?.funnel_split_mode || "ai_decides");
  const [funnelSplits, setFunnelSplits] = useState<Record<string, number>>(
    (globalConfig?.funnel_splits as Record<string, number>) || { cold: 60, remarketing: 25, tests: 15, leads: 0 }
  );
  const [approvalMode, setApprovalMode] = useState(globalConfig?.human_approval_mode || "auto");
  const [showTemplate, setShowTemplate] = useState(false);

  useEffect(() => {
    if (globalConfig) {
      setBudgetMode(globalConfig.budget_mode || "monthly");
      setBudgetValue(globalConfig.budget_cents ? (globalConfig.budget_cents / 100).toString() : "");
      setTargetRoi((globalConfig.safety_rules as any)?.target_roi?.toString() || "");
      setMinRoiCold(String((globalConfig.safety_rules as any)?.min_roi_cold ?? ""));
      setMinRoiWarm(String((globalConfig.safety_rules as any)?.min_roi_warm ?? ""));
      setRoasScalingThreshold(String((globalConfig.safety_rules as any)?.roas_scaling_threshold ?? ""));
      setInstructions(globalConfig.user_instructions || "");
      setStrategyMode(globalConfig.strategy_mode || "balanced");
      setFunnelSplitMode(globalConfig.funnel_split_mode || "ai_decides");
      setFunnelSplits((globalConfig.funnel_splits as Record<string, number>) || { cold: 60, remarketing: 25, tests: 15, leads: 0 });
      setApprovalMode(globalConfig.human_approval_mode || "auto");
    }
  }, [globalConfig]);

  const splitTotal = Object.values(funnelSplits).reduce((s, v) => s + (v || 0), 0);
  const splitValid = funnelSplitMode === "ai_decides" || splitTotal === 100;

  const handleSave = () => {
    onSave({
      channel: "global",
      budget_mode: budgetMode,
      budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
      objective: "sales",
      user_instructions: instructions || null,
      strategy_mode: strategyMode,
      funnel_split_mode: funnelSplitMode,
      funnel_splits: funnelSplitMode === "manual" ? funnelSplits : null,
      human_approval_mode: approvalMode,
      safety_rules: {
        ...(globalConfig?.safety_rules as any || {}),
        target_roi: parseFloat(targetRoi || "0") || null,
        min_roi_cold: parseFloat(minRoiCold || "0") || null,
        min_roi_warm: parseFloat(minRoiWarm || "0") || null,
        roas_scaling_threshold: parseFloat(roasScalingThreshold || "0") || null,
      },
    });
  };

  const handleSplitChange = (key: string, val: string) => {
    setFunnelSplits(prev => ({ ...prev, [key]: parseInt(val) || 0 }));
  };

  return (
    <div className="space-y-6">
      {/* Global AI Toggle */}
      <Card className={`border-2 transition-colors ${isGlobalEnabled ? "border-green-500/30 bg-green-500/5" : "border-muted"}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isGlobalEnabled ? "bg-green-500/10" : "bg-muted"}`}>
                <Power className={`h-5 w-5 ${isGlobalEnabled ? "text-green-600" : "text-muted-foreground"}`} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">IA Global</h3>
                <p className="text-xs text-muted-foreground">
                  {isGlobalEnabled
                    ? "A IA está ativa e gerenciando todas as contas sem regras exclusivas"
                    : "Ative para que a IA gerencie automaticamente as contas sem regras exclusivas"}
                </p>
              </div>
            </div>
            <Switch
              checked={isGlobalEnabled}
              onCheckedChange={onToggleGlobal}
              disabled={isTogglingGlobal}
            />
          </div>
        </CardContent>
      </Card>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertTitle className="text-blue-700 dark:text-blue-400 font-semibold">
          Como funciona a hierarquia de regras
        </AlertTitle>
        <AlertDescription className="text-sm space-y-2 mt-2">
          <div className="flex items-start gap-2">
            <span className="font-bold text-blue-600 dark:text-blue-400 shrink-0">Prioridade 1:</span>
            <span>Regras exclusivas por conta de anúncios/plataforma. Se configuradas, prevalecem sobre tudo.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-bold text-muted-foreground shrink-0">Prioridade 2:</span>
            <span>Estas configurações globais. Servem como <strong>fallback</strong> para contas que NÃO possuem regras exclusivas.</span>
          </div>
          <p className="text-xs text-muted-foreground pt-1 border-t mt-2">
            💡 Para que todas as contas sejam regidas apenas por estas regras globais, remova ou não preencha as regras exclusivas de cada conta de anúncios no Gerenciador.
          </p>
        </AlertDescription>
      </Alert>

      {/* Warning if overrides exist */}
      {hasAccountOverrides && (
        <Alert className="border-yellow-500/30 bg-yellow-500/5">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-sm text-yellow-700 dark:text-yellow-400">
            <strong>Atenção:</strong> Existem contas com regras exclusivas configuradas. Essas contas <strong>não serão afetadas</strong> por estas regras globais. Para que a regra global se aplique a elas, remova as configurações individuais no Gerenciador.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Config Card */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Regras Globais da IA</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configurações aplicadas a todas as contas e plataformas sem regras exclusivas
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Budget */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Orçamento Total (distribuído pela IA entre canais)
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="number" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} className="pl-9" placeholder="5000" />
              </div>
              <Select value={budgetMode} onValueChange={setBudgetMode}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">/ dia</SelectItem>
                  <SelectItem value="monthly">/ mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground">
              A IA distribui automaticamente este orçamento entre Meta, Google e TikTok com base na performance
            </p>
          </div>

          {/* ROI Ideal */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              ROI Ideal (Meta Global)
            </Label>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.1" min="0" value={targetRoi} onChange={(e) => setTargetRoi(e.target.value)} placeholder="5" className="w-24" />
              <span className="text-sm text-muted-foreground font-medium">x</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Meta de retorno global: R$ X de retorno para cada R$ 1 investido, somando todos os canais.
            </p>
          </div>

          {/* ROI Mínimos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2 p-3 rounded-lg bg-background border">
              <Label className="text-xs font-semibold">🧊 ROI mín. Público Frio (Pausa)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" step="0.1" min="0" value={minRoiCold} onChange={(e) => setMinRoiCold(e.target.value)} placeholder="2" className="max-w-20 h-8 text-sm" />
                <span className="text-xs text-muted-foreground">x</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Abaixo disso a IA PAUSA a campanha</p>
            </div>
            <div className="space-y-2 p-3 rounded-lg bg-background border">
              <Label className="text-xs font-semibold">🔥 ROI mín. Remarketing (Pausa)</Label>
              <div className="flex items-center gap-2">
                <Input type="number" step="0.1" min="0" value={minRoiWarm} onChange={(e) => setMinRoiWarm(e.target.value)} placeholder="3" className="max-w-20 h-8 text-sm" />
                <span className="text-xs text-muted-foreground">x</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Abaixo disso a IA PAUSA a campanha</p>
            </div>
          </div>

          {/* ROAS Scaling Threshold */}
          <div className="space-y-3 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              ROAS de Escalonamento
            </Label>
            <p className="text-xs text-muted-foreground">
              ROAS acima deste valor → IA escala orçamento. Abaixo → IA reduz. Ajustes respeitam os limites de cada plataforma.
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">ROAS alvo:</span>
              <Input type="number" step="0.1" min="0" value={roasScalingThreshold} onChange={(e) => setRoasScalingThreshold(e.target.value)} placeholder="Ex: 3" className="max-w-20 h-8 text-sm" />
              <span className="text-sm text-muted-foreground">x</span>
            </div>
            <p className="text-[10px] text-muted-foreground border-t pt-2">
              ⚡ Hierarquia: ROI mín. (pausa) → ROAS escalonamento (ajuste) → ROI ideal (meta final). A IA decide o percentual de ajuste respeitando os limites da plataforma (Meta ±10%, Google ±15%, TikTok ±7%).
            </p>
          </div>

          {/* Strategy Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Estratégia Geral
            </Label>
            <Select value={strategyMode} onValueChange={setStrategyMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STRATEGY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">— {opt.desc}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Funnel Splits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Scale className="h-4 w-4 text-primary" />
                Splits de Funil
              </Label>
              <div className="flex items-center gap-2">
                <Label htmlFor="global-ai-decides" className="text-xs text-muted-foreground">IA decide</Label>
                <Switch
                  id="global-ai-decides"
                  checked={funnelSplitMode === "ai_decides"}
                  onCheckedChange={(checked) => setFunnelSplitMode(checked ? "ai_decides" : "manual")}
                />
              </div>
            </div>

            {funnelSplitMode === "manual" ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { key: "cold", label: "🧊 Frio" },
                    { key: "remarketing", label: "🔥 Remarketing" },
                    { key: "tests", label: "🧪 Testes" },
                    { key: "leads", label: "📋 Leads" },
                  ].map(item => (
                    <div key={item.key} className="space-y-1 p-2 rounded-lg bg-background border">
                      <Label className="text-[11px] font-semibold">{item.label}</Label>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={funnelSplits[item.key] ?? 0}
                          onChange={(e) => handleSplitChange(item.key, e.target.value)}
                          className="h-7 text-sm w-16"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`text-xs font-medium ${splitValid ? "text-green-600" : "text-destructive"}`}>
                  Total: {splitTotal}% {splitValid ? "✓" : `(faltam ${100 - splitTotal}%)`}
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground bg-background border rounded-lg p-3">
                A IA distribuirá automaticamente o orçamento entre público frio, remarketing e testes com base nas métricas de performance.
              </p>
            )}
          </div>

          {/* Approval Mode */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Modo de Aprovação
            </Label>
            <Select value={approvalMode} onValueChange={setApprovalMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPROVAL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">— {opt.desc}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Prompt de Direcionamento Global
            </Label>
            
            {/* Prompt Priority Alert */}
            <Alert className="border-amber-500/30 bg-amber-500/5 py-2">
              <Info className="h-3.5 w-3.5 text-amber-600" />
              <AlertDescription className="text-[11px] text-amber-700 dark:text-amber-400">
                O prompt é <strong>sugestivo e complementar</strong>. As configurações manuais acima (ROI, orçamento, estratégia, splits) <strong>sempre prevalecem</strong>. 
                Em caso de conflito entre o prompt e uma configuração manual, a configuração manual é seguida. O prompt serve para dar contexto de negócio, expertise e direcionamento estratégico detalhado à IA.
              </AlertDescription>
            </Alert>

            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={6}
              placeholder="Cole ou adapte o template abaixo para seu negócio..."
            />
            
            {/* Template Toggle */}
            <Collapsible open={showTemplate} onOpenChange={setShowTemplate}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground hover:text-foreground">
                  {showTemplate ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showTemplate ? "Ocultar template de exemplo" : "📋 Ver template de exemplo para prompt global"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="relative">
                  <pre className="text-[10px] text-muted-foreground bg-muted/50 border rounded-lg p-3 max-h-64 overflow-y-auto whitespace-pre-wrap font-mono">
                    {PROMPT_TEMPLATE_GLOBAL}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 text-[10px] h-6"
                    onClick={() => setInstructions(PROMPT_TEMPLATE_GLOBAL)}
                  >
                    Usar template
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            <p className="text-[11px] text-muted-foreground">
              Direcionamento estratégico que a IA seguirá em todas as plataformas e contas sem regra exclusiva.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? "Salvando..." : "Salvar Configurações Globais"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
