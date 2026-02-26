import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { X, Trash2 } from "lucide-react";
import type { AutomationNode, AutomationNodeData } from "@/hooks/useAutomationBuilder";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";

interface AutomationNodePanelProps {
  node: AutomationNode | null;
  onUpdate: (nodeId: string, data: Partial<AutomationNodeData>) => void;
  onRemove: (nodeId: string) => void;
  onClose: () => void;
}

export function AutomationNodePanel({
  node,
  onUpdate,
  onRemove,
  onClose,
}: AutomationNodePanelProps) {
  const { lists, templates } = useEmailMarketing();

  if (!node) {
    return (
      <div className="w-72 border-l bg-muted/20 p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center">
          Selecione um bloco no canvas para editar suas propriedades
        </p>
      </div>
    );
  }

  const { nodeType, config, label } = node.data;

  const updateConfig = (key: string, value: any) => {
    onUpdate(node.id, { config: { ...config, [key]: value } });
  };

  return (
    <div className="w-72 border-l bg-background overflow-y-auto shrink-0">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="text-sm font-semibold">Propriedades</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-xs">Nome do bloco</Label>
          <Input
            value={label}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        {/* Send Email Config */}
        {nodeType === "send_email" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Assunto</Label>
              <Input
                value={config.subject || ""}
                onChange={(e) => updateConfig("subject", e.target.value)}
                placeholder="Assunto do email..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select
                value={config.template_id || ""}
                onValueChange={(v) => updateConfig("template_id", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {templates?.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {/* Delay Config */}
        {nodeType === "delay" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Tempo de espera</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  value={config.value || 1}
                  onChange={(e) => updateConfig("value", parseInt(e.target.value) || 1)}
                  className="h-8 text-sm w-20"
                />
                <Select
                  value={config.unit || "days"}
                  onValueChange={(v) => updateConfig("unit", v)}
                >
                  <SelectTrigger className="h-8 text-sm flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minuto(s)</SelectItem>
                    <SelectItem value="hours">Hora(s)</SelectItem>
                    <SelectItem value="days">Dia(s)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </>
        )}

        {/* Condition Config */}
        {nodeType === "condition" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">Condição</Label>
              <Select
                value={config.field || "opened_email"}
                onValueChange={(v) => updateConfig("field", v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opened_email">Abriu o email</SelectItem>
                  <SelectItem value="clicked_link">Clicou no link</SelectItem>
                  <SelectItem value="has_tag">Possui tag</SelectItem>
                  <SelectItem value="is_customer">É cliente</SelectItem>
                  <SelectItem value="order_count">Qtd. pedidos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {config.field === "has_tag" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Tag</Label>
                <Input
                  value={config.tag_name || ""}
                  onChange={(e) => updateConfig("tag_name", e.target.value)}
                  placeholder="Nome da tag..."
                  className="h-8 text-sm"
                />
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              Saída verde = Sim • Saída vermelha = Não
            </p>
          </>
        )}

        {/* Tag Config */}
        {(nodeType === "add_tag" || nodeType === "remove_tag") && (
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da Tag</Label>
            <Input
              value={config.tag_name || ""}
              onChange={(e) => updateConfig("tag_name", e.target.value)}
              placeholder="Ex: Lead Quente"
              className="h-8 text-sm"
            />
          </div>
        )}

        {/* Move to List Config */}
        {nodeType === "move_to_list" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Lista destino</Label>
            <Select
              value={config.list_id || ""}
              onValueChange={(v) => updateConfig("list_id", v)}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {lists?.map((l: any) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Split A/B Config */}
        {nodeType === "split_ab" && (
          <>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Variante A: {config.variant_a_pct || 50}%
              </Label>
              <Slider
                value={[config.variant_a_pct || 50]}
                onValueChange={([v]) => updateConfig("variant_a_pct", v)}
                min={10}
                max={90}
                step={5}
              />
              <p className="text-[10px] text-muted-foreground">
                Variante B: {100 - (config.variant_a_pct || 50)}%
              </p>
            </div>
          </>
        )}

        {/* Trigger Config */}
        {nodeType === "trigger" && (
          <p className="text-xs text-muted-foreground">
            O trigger é configurado na barra superior. Este é o ponto de entrada
            do fluxo.
          </p>
        )}

        {/* End Config */}
        {nodeType === "end" && (
          <p className="text-xs text-muted-foreground">
            Subscribers que chegam aqui saem do fluxo automaticamente.
          </p>
        )}

        {/* Delete button */}
        {nodeType !== "trigger" && (
          <div className="pt-4 border-t">
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => onRemove(node.id)}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Remover bloco
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
