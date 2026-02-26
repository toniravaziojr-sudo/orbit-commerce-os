import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { CampaignConfig } from "@/hooks/useEmailCampaignBuilder";
import { ListPlus, Settings } from "lucide-react";

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
            <Label>Tipo</Label>
            <Select value={config.type} onValueChange={v => onChange({ ...config, type: v as any })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="broadcast">Broadcast (envio único)</SelectItem>
                <SelectItem value="automation">Automação</SelectItem>
              </SelectContent>
            </Select>
          </div>

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
