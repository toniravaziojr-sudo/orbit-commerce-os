import { useState, useEffect } from "react";
import { Bot, DollarSign, Target, AlertTriangle, Zap, Scale, TrendingUp, ChevronDown, ChevronUp, Info, Sparkles, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { AccountConfig } from "@/hooks/useAdsAccountConfigs";
import { isAccountConfigComplete } from "@/hooks/useAdsAccountConfigs";
import { getPromptTemplateForChannel } from "./adsPromptTemplates";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface AdAccount {
  id: string;
  name: string;
}

interface AdsAccountConfigProps {
  channel: string;
  adAccounts: AdAccount[];
  getAccountConfig: (channel: string, accountId: string) => AccountConfig | null;
  aiEnabledAccountIds: string[];
  onSave: (config: Partial<AccountConfig> & { channel: string; ad_account_id: string }) => void;
  isSaving: boolean;
  onToggleAI: (accountId: string, enabled: boolean) => void;
  onToggleKillSwitch: (accountId: string, enabled: boolean) => void;
}

const STRATEGY_OPTIONS = [
  { value: "aggressive", label: "Agressiva", icon: "🔥", desc: "Foco em vendas a curto prazo" },
  { value: "balanced", label: "Balanceada", icon: "⚖️", desc: "Equilíbrio entre vendas e crescimento (Recomendada)" },
  { value: "long_term", label: "Médio/Longo Prazo", icon: "🌱", desc: "Branding e crescimento sustentável" },
];


function AccountConfigCard({
  accountId,
  accountName,
  channel,
  config,
  isAIEnabled,
  onSave,
  isSaving,
  onToggleAI,
  onToggleKillSwitch,
  tenantId,
}: {
  accountId: string;
  accountName: string;
  channel: string;
  config: AccountConfig | null;
  isAIEnabled: boolean;
  onSave: (accountId: string, data: Partial<AccountConfig>) => void;
  isSaving: boolean;
  onToggleAI: (accountId: string, enabled: boolean) => void;
  onToggleKillSwitch: (accountId: string, enabled: boolean) => void;
  tenantId: string | undefined;
}) {
  const [budgetMode, setBudgetMode] = useState(config?.budget_mode || "monthly");
  const [budgetValue, setBudgetValue] = useState(config?.budget_cents ? (config.budget_cents / 100).toString() : "");
  const [targetRoi, setTargetRoi] = useState(config?.target_roi?.toString() || "");
  const [instructions, setInstructions] = useState(config?.user_instructions || "");
  const [minRoiCold, setMinRoiCold] = useState(String(config?.min_roi_cold ?? 2));
  const [minRoiWarm, setMinRoiWarm] = useState(String(config?.min_roi_warm ?? 3));
  const [roasScalingThreshold, setRoasScalingThreshold] = useState(String(config?.roas_scaling_threshold ?? ""));
  const [strategyMode, setStrategyMode] = useState(config?.strategy_mode || "balanced");
  const [funnelSplitMode, setFunnelSplitMode] = useState(config?.funnel_split_mode || "manual");
  const [funnelSplits, setFunnelSplits] = useState<Record<string, number>>(
    (config?.funnel_splits as Record<string, number>) || { cold: 60, remarketing: 25, tests: 15, leads: 0 }
  );
  
  const [showTemplate, setShowTemplate] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [showDeactivateWarning, setShowDeactivateWarning] = useState(false);

  useEffect(() => {
    if (config) {
      setBudgetMode(config.budget_mode || "monthly");
      setBudgetValue(config.budget_cents ? (config.budget_cents / 100).toString() : "");
      setTargetRoi(config.target_roi?.toString() || "");
      setInstructions(config.user_instructions || "");
      setMinRoiCold(String(config.min_roi_cold ?? 2));
      setMinRoiWarm(String(config.min_roi_warm ?? 3));
      setRoasScalingThreshold(String(config.roas_scaling_threshold ?? ""));
      setStrategyMode(config.strategy_mode || "balanced");
      setFunnelSplitMode(config.funnel_split_mode || "manual");
      setFunnelSplits((config.funnel_splits as Record<string, number>) || { cold: 60, remarketing: 25, tests: 15, leads: 0 });
      
    }
  }, [config]);

  const splitTotal = Object.values(funnelSplits).reduce((s, v) => s + (v || 0), 0);
  const splitValid = funnelSplitMode === "ai_decides" || splitTotal === 100;

  const currentFormConfig: AccountConfig = {
    id: config?.id || "",
    tenant_id: config?.tenant_id || "",
    channel,
    ad_account_id: accountId,
    is_ai_enabled: isAIEnabled,
    budget_mode: budgetMode,
    budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
    target_roi: parseFloat(targetRoi || "0") || null,
    min_roi_cold: parseFloat(minRoiCold) || null,
    min_roi_warm: parseFloat(minRoiWarm) || null,
    roas_scaling_threshold: parseFloat(roasScalingThreshold || "0") || null,
    user_instructions: instructions,
    strategy_mode: strategyMode,
    funnel_split_mode: funnelSplitMode,
    funnel_splits: funnelSplitMode === "manual" ? funnelSplits : null,
    kill_switch: config?.kill_switch || false,
    human_approval_mode: "approve_high_impact",
    created_at: config?.created_at || null,
    updated_at: config?.updated_at || null,
  };

  const validation = isAccountConfigComplete(currentFormConfig);

  const handleSave = () => {
    onSave(accountId, {
      budget_mode: budgetMode,
      budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
      target_roi: parseFloat(targetRoi || "0") || null,
      user_instructions: instructions,
      min_roi_cold: parseFloat(minRoiCold) || 2,
      min_roi_warm: parseFloat(minRoiWarm) || 3,
      roas_scaling_threshold: parseFloat(roasScalingThreshold || "0") || null,
      strategy_mode: strategyMode,
      funnel_split_mode: funnelSplitMode,
      funnel_splits: funnelSplitMode === "manual" ? funnelSplits : null,
      human_approval_mode: "approve_high_impact",
    } as any);
  };

  const handleSplitChange = (key: string, val: string) => {
    setFunnelSplits(prev => ({ ...prev, [key]: parseInt(val) || 0 }));
  };

  const handleToggleAI = (enabled: boolean) => {
    if (enabled && !validation.valid) return;
    if (!enabled && isAIEnabled) {
      // Show warning before deactivating
      setShowDeactivateWarning(true);
      return;
    }
    onToggleAI(accountId, enabled);
  };

  const confirmDeactivate = () => {
    setShowDeactivateWarning(false);
    onToggleAI(accountId, false);
  };

  const killSwitchActive = config?.kill_switch || false;
  const channelLabel = channel === "meta" ? "Meta" : channel === "google" ? "Google" : channel === "tiktok" ? "TikTok" : channel;
  const promptTemplate = getPromptTemplateForChannel(channel);

  return (
    <Card className={`border ${killSwitchActive ? "border-destructive/50 bg-destructive/5" : "border-primary/30 bg-primary/5"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${killSwitchActive ? "bg-destructive/10" : "bg-primary/10"}`}>
              <Bot className={`h-5 w-5 ${killSwitchActive ? "text-destructive" : "text-primary"}`} />
            </div>
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                {accountName || accountId}
                {killSwitchActive ? (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">PARADA</Badge>
                ) : isAIEnabled ? (
                  <Badge className="text-[10px] px-1.5 py-0 bg-blue-500">IA Ativa</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-yellow-600 border-yellow-500/50">IA Inativa</Badge>
                )}
              </CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`ai-toggle-${accountId}`} className="text-xs text-muted-foreground">
                      {isAIEnabled ? "Ativada" : "Desativada"}
                    </Label>
                    <Switch
                      id={`ai-toggle-${accountId}`}
                      checked={isAIEnabled}
                      onCheckedChange={handleToggleAI}
                      disabled={!validation.valid && !isAIEnabled}
                    />
                  </div>
                </TooltipTrigger>
                {!validation.valid && !isAIEnabled && (
                  <TooltipContent side="left" className="max-w-xs">
                    <p className="font-semibold mb-1">Preencha antes de ativar:</p>
                    <ul className="text-xs list-disc pl-3">
                      {validation.missing.map(m => <li key={m}>{m}</li>)}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-5">
        {/* Budget */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Orçamento
          </Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="number" value={budgetValue} onChange={(e) => setBudgetValue(e.target.value)} className="pl-9" placeholder="1000" />
            </div>
            <Select value={budgetMode} onValueChange={setBudgetMode}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">/ dia</SelectItem>
                <SelectItem value="monthly">/ mês</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ROI Ideal */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            ROI Ideal
          </Label>
          <div className="flex items-center gap-2">
            <Input type="number" step="0.1" min="0" value={targetRoi} onChange={(e) => setTargetRoi(e.target.value)} placeholder="5" className="w-24" />
            <span className="text-sm text-muted-foreground font-medium">x</span>
          </div>
        </div>

        {/* ROI Mínimos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2 p-3 rounded-lg bg-background border">
            <Label className="text-xs font-semibold">🧊 ROI mín. Frio (Pausa)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.1" min="0" value={minRoiCold} onChange={(e) => setMinRoiCold(e.target.value)} className="max-w-20 h-8 text-sm" />
              <span className="text-xs text-muted-foreground">x</span>
            </div>
          </div>
          <div className="space-y-2 p-3 rounded-lg bg-background border">
            <Label className="text-xs font-semibold">🔥 ROI mín. Quente (Pausa)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" step="0.1" min="0" value={minRoiWarm} onChange={(e) => setMinRoiWarm(e.target.value)} className="max-w-20 h-8 text-sm" />
              <span className="text-xs text-muted-foreground">x</span>
            </div>
          </div>
        </div>

        {/* ROAS Scaling Threshold */}
        <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
          <Label className="text-xs font-semibold flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            ROAS de Escalonamento
          </Label>
          <p className="text-[9px] text-muted-foreground">Acima → escala orçamento. Abaixo → reduz. IA respeita limites da plataforma.</p>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-muted-foreground">ROAS:</span>
            <Input type="number" step="0.1" min="0" value={roasScalingThreshold} onChange={(e) => setRoasScalingThreshold(e.target.value)} placeholder="3" className="max-w-16 h-6 text-xs" />
            <span className="text-[9px] text-muted-foreground">x</span>
          </div>
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
              <Label htmlFor={`ai-decides-${accountId}`} className="text-xs text-muted-foreground">IA decide</Label>
              <Switch
                id={`ai-decides-${accountId}`}
                checked={funnelSplitMode === "ai_decides"}
                onCheckedChange={(checked) => setFunnelSplitMode(checked ? "ai_decides" : "manual")}
              />
            </div>
          </div>

          {funnelSplitMode === "manual" ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { key: "cold", label: "🧊 Frio", required: true },
                  { key: "remarketing", label: "🔥 Remarketing", required: true },
                  { key: "tests", label: "🧪 Testes", required: true },
                  { key: "leads", label: "📋 Leads", required: false },
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


        {/* Prompt */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Prompt Estratégico
          </Label>

          {/* Prompt Priority Alert */}
          <Alert className="border-amber-500/30 bg-amber-500/5 py-2">
            <Info className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-[11px] text-amber-700 dark:text-amber-400">
              O prompt é <strong>sugestivo</strong>. As configurações manuais (ROI, orçamento, estratégia) <strong>sempre prevalecem</strong> em caso de conflito.
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              placeholder="Descreva sua estratégia ou clique em '✨ Gerar com IA' para criar um prompt personalizado automaticamente..."
            />
          </div>

          {/* Generate with AI button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 text-xs border-primary/30 hover:bg-primary/10"
            disabled={isGeneratingPrompt || !tenantId}
            onClick={async () => {
              if (!tenantId) return;
              setIsGeneratingPrompt(true);
              try {
                const { data, error } = await supabase.functions.invoke("ads-autopilot-generate-prompt", {
                  body: { tenant_id: tenantId, channel },
                });
                if (error) throw error;
                if (data && !data.success) throw new Error(data.error || "Erro na geração");
                if (data?.data?.prompt) {
                  setInstructions(data.data.prompt);
                  toast.success(`Prompt gerado para ${data.data.store_name} (${data.data.products_count} produtos analisados)`);
                }
              } catch (err: any) {
                toast.error(err.message || "Erro ao gerar prompt");
              } finally {
                setIsGeneratingPrompt(false);
              }
            }}
          >
            {isGeneratingPrompt ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Gerando prompt personalizado...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                ✨ Gerar com IA (baseado nos seus produtos)
              </>
            )}
          </Button>

          {/* Template Toggle */}
          <Collapsible open={showTemplate} onOpenChange={setShowTemplate}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full text-xs gap-1 text-muted-foreground hover:text-foreground">
                {showTemplate ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {showTemplate ? "Ocultar template" : `📋 Ver template de exemplo para ${channelLabel}`}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="relative">
                <pre className="text-[10px] text-muted-foreground bg-muted/50 border rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                  {promptTemplate}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute top-2 right-2 text-[10px] h-6"
                  onClick={() => setInstructions(promptTemplate)}
                >
                  Usar template
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <p className="text-[11px] text-muted-foreground">
            Mínimo 10 caracteres. ({instructions.trim().length}/10)
          </p>
        </div>

        {/* Validation warnings */}
        {!validation.valid && (
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 space-y-1">
            <p className="text-xs font-semibold text-yellow-700 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Campos obrigatórios pendentes:
            </p>
            <ul className="text-[11px] text-yellow-600 list-disc pl-4">
              {validation.missing.map(m => <li key={m}>{m}</li>)}
            </ul>
          </div>
        )}

        <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full">
          {isSaving ? "Salvando..." : "Salvar Configurações"}
        </Button>

        {/* Kill Switch */}
        <div className="pt-2 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant={killSwitchActive ? "outline" : "destructive"}
                size="sm"
                className="w-full gap-2"
              >
                <AlertTriangle className="h-4 w-4" />
                {killSwitchActive ? "Desativar Kill Switch" : "🛑 Kill Switch — Parar IA"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {killSwitchActive ? "Reativar Autopilot?" : "🛑 Ativar Kill Switch?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {killSwitchActive
                    ? "A IA voltará a operar normalmente nesta conta."
                    : "TODA atividade da IA será interrompida IMEDIATAMENTE nesta conta. Campanhas em execução não serão afetadas, mas nenhuma ação nova será tomada."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => onToggleKillSwitch(accountId, !killSwitchActive)}>
                  {killSwitchActive ? "Reativar" : "Ativar Kill Switch"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Deactivation Warning Dialog */}
        <AlertDialog open={showDeactivateWarning} onOpenChange={setShowDeactivateWarning}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Desativar IA de Tráfego?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Ao desativar a IA, ela parará de gerenciar esta conta imediatamente.
                </p>
                <p className="font-medium text-foreground">
                  ⚠️ Ao ativar novamente, a IA fará uma <strong>varredura completa</strong> de toda a conta — como se fosse a primeira vez. Isso inclui:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Sincronização completa dos últimos 7 dias de dados</li>
                  <li>Reanálise de todas as campanhas, conjuntos e anúncios</li>
                  <li>Possível reestruturação de campanhas existentes</li>
                  <li>Criação de novas campanhas se necessário</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Manter Ativada</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDeactivate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Desativar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export function AdsAccountConfig({ channel, adAccounts, getAccountConfig, aiEnabledAccountIds, onSave, isSaving, onToggleAI, onToggleKillSwitch }: AdsAccountConfigProps) {
  const { currentTenant } = useAuth();
  if (adAccounts.length === 0) return null;

  const handleAccountSave = (accountId: string, data: Partial<AccountConfig>) => {
    onSave({ ...data, channel, ad_account_id: accountId });
  };

  return (
    <div className="space-y-4">
      {adAccounts.map((account) => (
        <AccountConfigCard
          key={account.id}
          accountId={account.id}
          accountName={account.name}
          channel={channel}
          config={getAccountConfig(channel, account.id)}
          isAIEnabled={aiEnabledAccountIds.includes(account.id)}
          onSave={handleAccountSave}
          isSaving={isSaving}
          onToggleAI={onToggleAI}
          onToggleKillSwitch={onToggleKillSwitch}
          tenantId={currentTenant?.id}
        />
      ))}
    </div>
  );
}
