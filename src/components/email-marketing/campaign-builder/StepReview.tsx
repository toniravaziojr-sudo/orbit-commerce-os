import { useState } from "react";
import { DateTimePickerField } from '@/components/ui/datetime-picker-field';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { EmailPreview } from "./EmailPreview";
import { CampaignConfig, CampaignContent } from "@/hooks/useEmailCampaignBuilder";
import { useEmailMarketing } from "@/hooks/useEmailMarketing";
import { Send, Clock, Loader2, Mail, Users, ListPlus, GitBranch, ArrowDown } from "lucide-react";

interface StepReviewProps {
  config: CampaignConfig;
  content: CampaignContent;
  html: string;
  onSend: (scheduledAt?: string) => Promise<void>;
  isSending: boolean;
}

export function StepReview({ config, content, html, onSend, isSending }: StepReviewProps) {
  const { lists } = useEmailMarketing();
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduleDate, setScheduleDate] = useState("");

  const selectedList = lists.find((l: any) => l.id === config.list_id);
  const isSequence = config.type === "sequence";

  const handleSend = () => {
    if (mode === "schedule" && scheduleDate) {
      onSend(new Date(scheduleDate).toISOString());
    } else {
      onSend();
    }
  };

  const getTypeLabel = () => {
    switch (config.type) {
      case "broadcast": return "Envio Único";
      case "sequence": return "Sequência";
      case "automation": return "Automação";
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumo da Campanha</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Campanha</p>
                <p className="font-medium text-sm truncate">{config.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <ListPlus className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Lista</p>
                <p className="font-medium text-sm truncate">{selectedList?.name || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-primary shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">{isSequence ? "Passos" : "Assunto"}</p>
                <p className="font-medium text-sm truncate">
                  {isSequence ? `${(content.sequenceSteps || []).length} passos` : content.subject}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <Badge variant="secondary">{getTypeLabel()}</Badge>
            {!isSequence && <Badge variant="outline">{content.blocks.length} blocos</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Sequence steps review */}
      {isSequence && (content.sequenceSteps || []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Passos da Sequência</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(content.sequenceSteps || []).map((step, idx) => (
                <div key={step.id}>
                  {idx > 0 && (
                    <div className="flex justify-center py-1">
                      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      {step.type === "send_email" && <><Mail className="h-4 w-4 text-primary" /> Enviar: {step.data.subject || "(sem assunto)"}</>}
                      {step.type === "wait" && <><Clock className="h-4 w-4 text-amber-600" /> Aguardar {step.data.delayValue} {step.data.delayUnit === "hours" ? "hora(s)" : "dia(s)"}</>}
                      {step.type === "condition" && <><GitBranch className="h-4 w-4 text-violet-600" /> Se {step.data.conditionType === "opened" ? "abriu email" : "clicou em link"}</>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview (broadcast only) */}
      {!isSequence && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview do Email</CardTitle>
          </CardHeader>
          <CardContent>
            <EmailPreview html={html} />
          </CardContent>
        </Card>
      )}

      {/* Send options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{isSequence ? "Ativar Sequência" : "Envio"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSequence && (
            <div className="flex gap-3">
              <Button
                variant={mode === "now" ? "default" : "outline"}
                onClick={() => setMode("now")}
                className="gap-2"
              >
                <Send className="h-4 w-4" /> Enviar agora
              </Button>
              <Button
                variant={mode === "schedule" ? "default" : "outline"}
                onClick={() => setMode("schedule")}
                className="gap-2"
              >
                <Clock className="h-4 w-4" /> Agendar
              </Button>
            </div>
          )}

          {!isSequence && mode === "schedule" && (
            <div className="space-y-2 max-w-xs">
              <Label>Data e hora de envio</Label>
              <DateTimePickerField
                value={scheduleDate ? new Date(scheduleDate) : undefined}
                onChange={(date) => setScheduleDate(date ? date.toISOString() : '')}
                placeholder="Selecione data e hora"
                minDate={new Date()}
              />
            </div>
          )}

          <Button
            size="lg"
            onClick={handleSend}
            disabled={isSending || (!isSequence && mode === "schedule" && !scheduleDate)}
            className="gap-2 mt-2"
          >
            {isSending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {isSequence ? "Ativando..." : "Enviando..."}</>
            ) : (
              <><Send className="h-4 w-4" /> {isSequence ? "Ativar Sequência" : mode === "now" ? "Enviar Campanha" : "Agendar Campanha"}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}