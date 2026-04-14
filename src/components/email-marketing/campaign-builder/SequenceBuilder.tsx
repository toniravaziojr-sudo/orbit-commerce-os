import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SequenceStep, SequenceStepType } from "@/hooks/useEmailCampaignBuilder";
import { Mail, Clock, GitBranch, Plus, Trash2, ArrowDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SequenceBuilderProps {
  steps: SequenceStep[];
  onAddStep: (type: SequenceStepType, index?: number) => void;
  onUpdateStep: (id: string, data: Partial<SequenceStep["data"]>) => void;
  onRemoveStep: (id: string) => void;
}

function StepIcon({ type }: { type: SequenceStepType }) {
  switch (type) {
    case "send_email": return <Mail className="h-4 w-4" />;
    case "wait": return <Clock className="h-4 w-4" />;
    case "condition": return <GitBranch className="h-4 w-4" />;
  }
}

function StepLabel({ type }: { type: SequenceStepType }) {
  switch (type) {
    case "send_email": return "Enviar Email";
    case "wait": return "Aguardar";
    case "condition": return "Condição";
  }
}

function StepColor({ type }: { type: SequenceStepType }) {
  switch (type) {
    case "send_email": return "bg-primary/10 text-primary border-primary/20";
    case "wait": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    case "condition": return "bg-violet-500/10 text-violet-600 border-violet-500/20";
  }
}

function AddStepButton({ onAdd, index }: { onAdd: (type: SequenceStepType, index?: number) => void; index?: number }) {
  return (
    <div className="flex justify-center py-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs border-dashed">
            <Plus className="h-3.5 w-3.5" /> Adicionar passo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => onAdd("send_email", index)}>
            <Mail className="h-4 w-4 mr-2" /> Enviar Email
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdd("wait", index)}>
            <Clock className="h-4 w-4 mr-2" /> Aguardar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onAdd("condition", index)}>
            <GitBranch className="h-4 w-4 mr-2" /> Condição
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function SequenceBuilder({ steps, onAddStep, onUpdateStep, onRemoveStep }: SequenceBuilderProps) {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-1">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold">Sequência de Automação</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Monte a sequência linear de passos que serão executados automaticamente
        </p>
      </div>

      {steps.length === 0 && (
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Comece adicionando o primeiro passo da sequência</p>
        </div>
      )}

      <AddStepButton onAdd={onAddStep} index={0} />

      {steps.map((step, idx) => (
        <div key={step.id}>
          {/* Connector arrow */}
          {idx > 0 && (
            <div className="flex justify-center py-1">
              <ArrowDown className="h-4 w-4 text-muted-foreground" />
            </div>
          )}

          <Card className={`border ${StepColor({ type: step.type }).split(" ").find(c => c.startsWith("border-"))}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className={`flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium ${StepColor({ type: step.type })}`}>
                  <StepIcon type={step.type} />
                  <StepLabel type={step.type} />
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemoveStep(step.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-3 space-y-3">
                {step.type === "send_email" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Assunto</Label>
                      <Input
                        value={step.data.subject || ""}
                        onChange={e => onUpdateStep(step.id, { subject: e.target.value })}
                        placeholder="Assunto do email"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Conteúdo (HTML)</Label>
                      <Textarea
                        value={step.data.bodyHtml || ""}
                        onChange={e => onUpdateStep(step.id, { bodyHtml: e.target.value })}
                        placeholder="Escreva o conteúdo do email..."
                        rows={4}
                        className="text-sm"
                      />
                    </div>
                  </>
                )}

                {step.type === "wait" && (
                  <div className="flex items-center gap-3">
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs">Tempo</Label>
                      <Input
                        type="number"
                        min={1}
                        value={step.data.delayValue || 1}
                        onChange={e => onUpdateStep(step.id, { delayValue: parseInt(e.target.value) || 1 })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      <Label className="text-xs">Unidade</Label>
                      <Select value={step.data.delayUnit || "days"} onValueChange={v => onUpdateStep(step.id, { delayUnit: v as any })}>
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hours">Horas</SelectItem>
                          <SelectItem value="days">Dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {step.type === "condition" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Verificar se o lead...</Label>
                    <Select value={step.data.conditionType || "opened"} onValueChange={v => onUpdateStep(step.id, { conditionType: v as any })}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="opened">Abriu o email anterior</SelectItem>
                        <SelectItem value="clicked">Clicou em algum link</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <AddStepButton onAdd={onAddStep} index={idx + 1} />
        </div>
      ))}
    </div>
  );
}
