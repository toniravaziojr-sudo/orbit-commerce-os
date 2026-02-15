import { useState, useEffect } from "react";
import { Bot } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Settings2 } from "lucide-react";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";

interface AdsChannelRoasConfigProps {
  channel: string;
  channelConfig: AutopilotConfig | null;
  onSave: (config: Partial<AutopilotConfig> & { channel: string }) => void;
  onToggleChannel: (channel: string, enabled: boolean) => void;
  isSaving: boolean;
}

const CHANNEL_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
};

export function AdsChannelRoasConfig({ channel, channelConfig, onSave, onToggleChannel, isSaving }: AdsChannelRoasConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rules = channelConfig?.safety_rules || ({} as Record<string, any>);
  const isEnabled = channelConfig?.is_enabled || false;

  const [minRoiCold, setMinRoiCold] = useState(String(rules.min_roi_cold || 2));
  const [minRoiWarm, setMinRoiWarm] = useState(String(rules.min_roi_warm || 3));

  useEffect(() => {
    if (channelConfig?.safety_rules) {
      const r = channelConfig.safety_rules as Record<string, any>;
      setMinRoiCold(String(r.min_roi_cold || 2));
      setMinRoiWarm(String(r.min_roi_warm || 3));
    }
  }, [channelConfig]);

  const handleSave = () => {
    onSave({
      channel,
      safety_rules: {
        ...(channelConfig?.safety_rules || {}),
        min_roi_cold: parseFloat(minRoiCold) || 2,
        min_roi_warm: parseFloat(minRoiWarm) || 3,
      },
    });
  };

  return (
    <Card className={`border ${isEnabled ? "border-primary/30 bg-primary/5" : "border-dashed"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isEnabled ? "bg-primary/10" : "bg-muted"}`}>
              <Bot className={`h-5 w-5 ${isEnabled ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                IA {CHANNEL_LABELS[channel] || channel}
                {isEnabled && <Badge variant="default" className="text-[10px] px-1.5 py-0">Ativa</Badge>}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {isEnabled
                  ? `ROI mín. frio: ${(channelConfig?.safety_rules as any)?.min_roi_cold || 2}x · quente: ${(channelConfig?.safety_rules as any)?.min_roi_warm || 3}x`
                  : "Ative a IA para gerenciar este canal"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => onToggleChannel(channel, checked)}
            />
          </div>
        </div>
      </CardHeader>

      {isEnabled && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
              <Settings2 className="h-4 w-4" />
              {isOpen ? "Fechar metas de ROI" : "Configurar metas de ROI"}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-3 space-y-4">
              <p className="text-xs text-muted-foreground">
                Defina o ROI mínimo para que a IA <strong>pause campanhas</strong> que não atingem o retorno esperado. 
                Ex: ROI 2 = R$ 2 de retorno para cada R$ 1 investido.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Público Frio */}
                <div className="space-y-3 p-4 rounded-lg bg-background border">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    🧊 Público Frio (Prospecção)
                  </Label>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">ROI Mínimo para Pausar</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={minRoiCold}
                        onChange={(e) => setMinRoiCold(e.target.value)}
                        placeholder="2"
                        className="max-w-24"
                      />
                      <span className="text-sm text-muted-foreground font-medium">x</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Lookalike, interesses amplos, broad targeting
                  </p>
                </div>

                {/* Público Quente */}
                <div className="space-y-3 p-4 rounded-lg bg-background border">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    🔥 Público Quente (Remarketing)
                  </Label>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground">ROI Mínimo para Pausar</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={minRoiWarm}
                        onChange={(e) => setMinRoiWarm(e.target.value)}
                        placeholder="3"
                        className="max-w-24"
                      />
                      <span className="text-sm text-muted-foreground font-medium">x</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Retargeting, visitantes, carrinhos abandonados
                  </p>
                </div>
              </div>

              <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full">
                {isSaving ? "Salvando..." : `Salvar Metas de ${CHANNEL_LABELS[channel]}`}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      )}
    </Card>
  );
}
