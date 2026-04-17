import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { CampaignConfig, AutomationBuilderStyle } from "@/hooks/useEmailCampaignBuilder";
import { ListPlus, Settings, Workflow, ListOrdered } from "lucide-react";

interface StepConfigProps {
  config: CampaignConfig;
  onChange: (config: CampaignConfig) => void;
}

export function StepConfig({ config, onChange }: StepConfigProps) {
  const { lists } = useEmailMarketing();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-primary" />
            Configuração da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Nome da Campanha *</Label>
            <Input
              id="campaign-name"
              placeholder="Ex: Black Friday 2025"
              value={config.name}
              onChange={e => onChange({ ...config, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo de Campanha</Label>
            <Select
              value={config.type === "broadcast" ? "broadcast" : "automation"}
              onValueChange={v => {
                if (v === "broadcast") {
                  onChange({ ...config, type: "broadcast" });
                } else {
                  // ao virar automação, mantém estilo atual ou define linear
                  const style: AutomationBuilderStyle = config.builderStyle || "linear";
                  onChange({
                    ...config,
                    type: style === "visual" ? "automation" : "sequence",
                    builderStyle: style,
                  });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="broadcast">Envio Único — dispara um e-mail agora</SelectItem>
                <SelectItem value="automation">Automação — sequência ou fluxo automatizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(config.type === "sequence" || config.type === "automation") && (
            <div className="space-y-2">
              <Label>Estilo do Construtor</Label>
              <Select
                value={config.builderStyle || "linear"}
                onValueChange={v => {
                  const style = v as AutomationBuilderStyle;
                  onChange({
                    ...config,
                    builderStyle: style,
                    type: style === "visual" ? "automation" : "sequence",
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="h-4 w-4 text-muted-foreground" />
                      Linear (simples) — passos um após o outro
                    </div>
                  </SelectItem>
                  <SelectItem value="visual">
                    <div className="flex items-center gap-2">
                      <Workflow className="h-4 w-4 text-muted-foreground" />
                      Visual (avançado) — fluxograma com condições e ramificações
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {config.builderStyle === "visual"
                  ? "Use o construtor visual para criar fluxos com gatilhos, ramificações condicionais, A/B e ações de tag/lista."
                  : "Use a sequência linear para enviar e-mails em ordem, com tempos de espera e condições simples entre eles."}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Lista de Destino *</Label>
            <Select value={config.list_id} onValueChange={v => onChange({ ...config, list_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma lista..." />
              </SelectTrigger>
              <SelectContent>
                {lists.map((list: any) => (
                  <SelectItem key={list.id} value={list.id}>
                    <div className="flex items-center gap-2">
                      <ListPlus className="h-4 w-4 text-muted-foreground" />
                      {list.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {lists.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhuma lista encontrada. Crie uma lista primeiro em Email Marketing → Listas.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}