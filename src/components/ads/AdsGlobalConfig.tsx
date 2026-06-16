import { useState, useEffect } from "react";
import { Bot, Settings2, DollarSign, Target, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";
import {
  BrandComplianceFieldsBlock,
  brandComplianceToPersist,
  brandCompliancePersistToForm,
  EMPTY_BRAND_COMPLIANCE,
  type BrandComplianceValue,
} from "./BrandComplianceFieldsBlock";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
  const [autonomyMode, setAutonomyMode] = useState<"off" | "technical_only">(
    (globalConfig?.autonomy_mode === "technical_only" ? "technical_only" : "off")
  );

  const { currentTenant } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;

  // Bloco de marca (H.4.0) — fonte de verdade global
  const { data: brandRow } = useQuery({
    queryKey: ["tenant-brand-context-h4", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_brand_context")
        .select("approved_main_promise, allowed_claims, banned_claims, do_not_do, compliance_notes, no_additional_restrictions_confirmed")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });
  const [brand, setBrand] = useState<BrandComplianceValue>(EMPTY_BRAND_COMPLIANCE);
  const [savingBrand, setSavingBrand] = useState(false);
  useEffect(() => {
    setBrand(brandCompliancePersistToForm(brandRow));
  }, [brandRow]);

  const handleSaveBrand = async () => {
    if (!tenantId) return;
    setSavingBrand(true);
    try {
      const patch = brandComplianceToPersist(brand);
      const { data: existing } = await supabase
        .from("tenant_brand_context")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from("tenant_brand_context")
          .update({ ...patch, manually_edited_at: new Date().toISOString() })
          .eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_brand_context")
          .insert({ tenant_id: tenantId, ...patch, manually_edited_at: new Date().toISOString() });
        if (error) throw error;
      }
      toast.success("Promessas, claims e restrições da marca salvas");
      qc.invalidateQueries({ queryKey: ["tenant-brand-context-h4", tenantId] });
    } catch (e: any) {
      toast.error("Erro ao salvar marca: " + (e?.message || ""));
    } finally {
      setSavingBrand(false);
    }
  };

  useEffect(() => {
    if (globalConfig) {
      setBudgetMode(globalConfig.budget_mode);
      setBudgetValue((globalConfig.budget_cents / 100).toString());
      setInstructions(globalConfig.user_instructions || "");
      setTargetRoi((globalConfig.safety_rules as any)?.target_roi?.toString() || "");
      setAutonomyMode(globalConfig.autonomy_mode === "technical_only" ? "technical_only" : "off");
    }
  }, [globalConfig]);

  const handleSave = () => {
    onSave({
      channel: "global",
      budget_mode: budgetMode,
      budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
      objective: "sales",
      user_instructions: instructions || null,
      autonomy_mode: autonomyMode,
      safety_rules: {
        ...(globalConfig?.safety_rules as any || {}),
        target_roi: parseFloat(targetRoi || "0") || null,
      },
    });
  };

  const handleAutonomyToggle = (checked: boolean) => {
    const next: "off" | "technical_only" = checked ? "technical_only" : "off";
    setAutonomyMode(next);
    // Persiste imediatamente — toggle de segurança não precisa esperar "Salvar"
    onSave({
      channel: "global",
      budget_mode: budgetMode,
      budget_cents: Math.round(parseFloat(budgetValue || "0") * 100),
      objective: "sales",
      user_instructions: instructions || null,
      autonomy_mode: next,
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
            {/* Fase C.4 — Execução automática diária (GLOBAL) */}
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <Label htmlFor="autonomy-global-toggle" className="text-sm font-semibold">
                      Execução automática diária
                    </Label>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {autonomyMode === "technical_only" ? "Ativada" : "Desligada"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Aplica a execução automática de ações técnicas diárias para contas que não
                    possuem configuração individual. Contas com configuração própria seguem sua
                    regra individual.
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    Prioridade: Individual &gt; Global &gt; Desligado por padrão.
                  </p>
                </div>
                <Switch
                  id="autonomy-global-toggle"
                  checked={autonomyMode === "technical_only"}
                  onCheckedChange={handleAutonomyToggle}
                />
              </div>
            </div>

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

            {/* H.4.0 — Bloco de marca: promessas, claims e restrições */}
            <BrandComplianceFieldsBlock value={brand} onChange={setBrand} mode="global" />
            <Button
              onClick={handleSaveBrand}
              disabled={savingBrand || !tenantId}
              variant="secondary"
              className="w-full"
            >
              {savingBrand ? "Salvando marca..." : "Salvar promessas, claims e restrições"}
            </Button>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
