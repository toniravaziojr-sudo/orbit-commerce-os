import { useState, useEffect } from "react";
import { Bot, Settings2, DollarSign, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";

interface AccountConfig {
  budget_mode: string;
  budget_cents: number;
  target_roi: number | null;
  user_instructions: string;
  min_roi_cold: number;
  min_roi_warm: number;
}

interface AdAccount {
  id: string;
  name: string;
}

interface AdsAccountConfigProps {
  channel: string;
  channelConfig: AutopilotConfig | null;
  aiEnabledAccountIds: string[];
  adAccounts: AdAccount[];
  onSave: (config: Partial<AutopilotConfig> & { channel: string }) => void;
  isSaving: boolean;
}

const CHANNEL_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
};

function getAccountConfig(channelConfig: AutopilotConfig | null, accountId: string): AccountConfig {
  const configs = (channelConfig?.safety_rules as any)?.account_configs || {};
  const c = configs[accountId];
  return {
    budget_mode: c?.budget_mode || "monthly",
    budget_cents: c?.budget_cents || 0,
    target_roi: c?.target_roi ?? null,
    user_instructions: c?.user_instructions || "",
    min_roi_cold: c?.min_roi_cold ?? 2,
    min_roi_warm: c?.min_roi_warm ?? 3,
  };
}

function AccountConfigCard({
  accountId,
  accountName,
  config,
  onSave,
  isSaving,
}: {
  accountId: string;
  accountName: string;
  config: AccountConfig;
  onSave: (accountId: string, config: AccountConfig) => void;
  isSaving: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [budgetMode, setBudgetMode] = useState(config.budget_mode);
  const [budgetValue, setBudgetValue] = useState(config.budget_cents ? (config.budget_cents / 100).toString() : "");
  const [targetRoi, setTargetRoi] = useState(config.target_roi?.toString() || "");
  const [instructions, setInstructions] = useState(config.user_instructions);
  const [minRoiCold, setMinRoiCold] = useState(String(config.min_roi_cold));
  const [minRoiWarm, setMinRoiWarm] = useState(String(config.min_roi_warm));

  useEffect(() => {
    setBudgetMode(config.budget_mode);
    setBudgetValue(config.budget_cents ? (config.budget_cents / 100).toString() : "");
    setTargetRoi(config.target_roi?.toString() || "");
    setInstructions(config.user_instructions);
    setMinRoiCold(String(config.min_roi_cold));
    setMinRoiWarm(String(config.min_roi_warm));
  }, [config]);

  const handleSave = () => {
    onSave(accountId, {
      budget_mode: budgetMode,
      budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
      target_roi: parseFloat(targetRoi || "0") || null,
      user_instructions: instructions,
      min_roi_cold: parseFloat(minRoiCold) || 2,
      min_roi_warm: parseFloat(minRoiWarm) || 3,
    });
  };

  const summary = config.budget_cents
    ? `R$ ${(config.budget_cents / 100).toLocaleString("pt-BR")} / ${config.budget_mode === "daily" ? "dia" : "mês"}${config.target_roi ? ` · ROI: ${config.target_roi}x` : ""}`
    : "Configure orçamento e metas";

  return (
    <Card className="border border-primary/30 bg-primary/5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm flex items-center gap-2">
                    {accountName || accountId}
                    <Badge variant="default" className="text-[10px] px-1.5 py-0">IA Ativa</Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">{summary}</p>
                </div>
              </div>
              <Settings2 className="h-4 w-4 text-muted-foreground" />
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-5">
            {/* Budget */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Orçamento</Label>
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
                Limite máximo que a IA pode distribuir nesta conta
              </p>
            </div>

            {/* ROI Ideal */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                ROI Ideal
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
              <p className="text-[11px] text-muted-foreground">
                Meta de retorno que a IA buscará alcançar nesta conta
              </p>
            </div>

            {/* ROI Mínimos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2 p-3 rounded-lg bg-background border">
                <Label className="text-xs font-semibold">🧊 ROI mín. Frio</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.1" min="0" value={minRoiCold} onChange={(e) => setMinRoiCold(e.target.value)} className="max-w-20 h-8 text-sm" />
                  <span className="text-xs text-muted-foreground">x</span>
                </div>
              </div>
              <div className="space-y-2 p-3 rounded-lg bg-background border">
                <Label className="text-xs font-semibold">🔥 ROI mín. Quente</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" step="0.1" min="0" value={minRoiWarm} onChange={(e) => setMinRoiWarm(e.target.value)} className="max-w-20 h-8 text-sm" />
                  <span className="text-xs text-muted-foreground">x</span>
                </div>
              </div>
            </div>

            {/* Prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                Prompt Estratégico
              </Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder={`Ex: "Priorize remarketing" ou "Foque no produto X"`}
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full">
              {isSaving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export function AdsAccountConfig({ channel, channelConfig, aiEnabledAccountIds, adAccounts, onSave, isSaving }: AdsAccountConfigProps) {
  if (aiEnabledAccountIds.length === 0) return null;

  const handleSaveAccount = (accountId: string, accountCfg: AccountConfig) => {
    const currentRules = (channelConfig?.safety_rules || {}) as Record<string, any>;
    const currentConfigs = currentRules.account_configs || {};
    onSave({
      channel,
      safety_rules: {
        ...currentRules,
        account_configs: {
          ...currentConfigs,
          [accountId]: accountCfg,
        },
      },
    });
  };

  const enabledAccounts = adAccounts.filter(a => aiEnabledAccountIds.includes(a.id));

  return (
    <div className="space-y-3">
      {enabledAccounts.map(acc => (
        <AccountConfigCard
          key={acc.id}
          accountId={acc.id}
          accountName={acc.name}
          config={getAccountConfig(channelConfig, acc.id)}
          onSave={handleSaveAccount}
          isSaving={isSaving}
        />
      ))}
    </div>
  );
}
