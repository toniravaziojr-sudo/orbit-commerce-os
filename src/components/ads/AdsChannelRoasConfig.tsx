import { useState, useEffect } from "react";
import { Target } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AutopilotConfig } from "@/hooks/useAdsAutopilot";

interface AdsChannelRoasConfigProps {
  channel: string;
  channelConfig: AutopilotConfig | null;
  onSave: (config: Partial<AutopilotConfig> & { channel: string }) => void;
  isSaving: boolean;
}

const CHANNEL_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  tiktok: "TikTok Ads",
};

export function AdsChannelRoasConfig({ channel, channelConfig, onSave, isSaving }: AdsChannelRoasConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rules = channelConfig?.safety_rules || ({} as Record<string, any>);

  const [targetRoasCold, setTargetRoasCold] = useState(String(rules.target_roas_cold || 2));
  const [targetRoasRemarketing, setTargetRoasRemarketing] = useState(String(rules.target_roas_remarketing || 4));
  const [minRoasPauseCold, setMinRoasPauseCold] = useState(String(rules.min_roas_pause_cold || 0.8));
  const [minRoasPauseRemarketing, setMinRoasPauseRemarketing] = useState(String(rules.min_roas_pause_remarketing || 1.5));

  useEffect(() => {
    if (channelConfig?.safety_rules) {
      const r = channelConfig.safety_rules as Record<string, any>;
      setTargetRoasCold(String(r.target_roas_cold || 2));
      setTargetRoasRemarketing(String(r.target_roas_remarketing || 4));
      setMinRoasPauseCold(String(r.min_roas_pause_cold || 0.8));
      setMinRoasPauseRemarketing(String(r.min_roas_pause_remarketing || 1.5));
    }
  }, [channelConfig]);

  const handleSave = () => {
    onSave({
      channel,
      safety_rules: {
        ...(channelConfig?.safety_rules || {}),
        target_roas_cold: parseFloat(targetRoasCold) || 2,
        target_roas_remarketing: parseFloat(targetRoasRemarketing) || 4,
        min_roas_pause_cold: parseFloat(minRoasPauseCold) || 0.8,
        min_roas_pause_remarketing: parseFloat(minRoasPauseRemarketing) || 1.5,
      },
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground border border-dashed">
          <Target className="h-4 w-4" />
          {isOpen ? "Fechar metas de ROAS" : `Definir metas de ROAS para ${CHANNEL_LABELS[channel] || channel}`}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3 space-y-4">
        <p className="text-xs text-muted-foreground">
          Defina o ROAS ideal e o mínimo para pausa <strong>específicos de {CHANNEL_LABELS[channel]}</strong>. Cada negócio tem margens diferentes por canal.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Público Frio */}
          <div className="space-y-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Label className="text-xs font-semibold">🧊 Público Frio (Prospecção)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">ROAS Ideal</span>
                <Input
                  type="number"
                  step="0.1"
                  value={targetRoasCold}
                  onChange={(e) => setTargetRoasCold(e.target.value)}
                  placeholder="2.0"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-destructive">⛔ ROAS p/ Pausar</span>
                <Input
                  type="number"
                  step="0.1"
                  value={minRoasPauseCold}
                  onChange={(e) => setMinRoasPauseCold(e.target.value)}
                  placeholder="0.8"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Lookalike, interesses amplos, broad targeting
            </p>
          </div>

          {/* Remarketing */}
          <div className="space-y-2 p-3 rounded-lg bg-accent/50 border border-accent">
            <Label className="text-xs font-semibold">🔥 Remarketing (Reconversão)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">ROAS Ideal</span>
                <Input
                  type="number"
                  step="0.1"
                  value={targetRoasRemarketing}
                  onChange={(e) => setTargetRoasRemarketing(e.target.value)}
                  placeholder="4.0"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-destructive">⛔ ROAS p/ Pausar</span>
                <Input
                  type="number"
                  step="0.1"
                  value={minRoasPauseRemarketing}
                  onChange={(e) => setMinRoasPauseRemarketing(e.target.value)}
                  placeholder="1.5"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Público quente, retargeting, carrinhos abandonados
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving} size="sm" className="w-full">
          {isSaving ? "Salvando..." : `Salvar Metas de ${CHANNEL_LABELS[channel]}`}
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
